import { Module } from '@nestjs/common';
import {
  Controller, Get, Post, Body, Param, Query, Inject, UseGuards, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { DbModule, PG_POOL } from '../common/db.module';
import { AuthGuard, Roles, RolesGuard, CurrentUser, AuthUser } from '../common/auth';

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
class AdminController {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  /** 看板：按技师 / 服务类型统计异常率、退款、质量关联 */
  @Get('stats/overview')
  async overview() {
    const totals = (await this.db.query(`
      select
        (select count(*) from service_records) as total_records,
        (select count(*) from service_records where status='risk_blocked') as risk_blocked,
        (select count(*) from service_records where status='pending_accept') as pending_accept,
        (select count(*) from incidents where status in ('reported','processing')) as open_incidents,
        (select count(*) from incidents) as total_incidents,
        (select count(*) from refunds where status='requested') as pending_refunds,
        (select count(*) from settlements where insurance_status='failed' or subsidy_status='failed') as failed_settlements,
        (select count(*) from incidents where quality_related=true) as quality_incidents,
        (select coalesce(sum(amount),0) from refunds where status='refunded') as refunded_amount
    `)).rows[0];

    const byTherapist = (await this.db.query(`
      select t.id, t.name, t.title, t.years_exp, t.rating,
             count(distinct r.id) filter (where r.id is not null) as served,
             count(distinct r.id) filter (where r.status in ('completed','settled','refunded')) as finished,
             count(distinct i.id) as incidents,
             count(distinct r.id) filter (where exists (select 1 from incidents qi where qi.record_id=r.id and qi.quality_related=true)) as quality_incident_records,
             count(distinct r.id) filter (where exists (select 1 from incidents ai where ai.record_id=r.id)) as incident_records,
             count(distinct rf.id) filter (where rf.status='refunded') as refunds,
             round(100.0 * count(distinct r.id) filter (where exists (select 1 from incidents qi where qi.record_id=r.id and qi.quality_related=true))
                   / nullif(count(distinct r.id) filter (where r.status in ('completed','settled','refunded')),0), 1) as quality_incident_rate,
             round(100.0 * count(distinct r.id) filter (where exists (select 1 from incidents ai where ai.record_id=r.id))
                   / nullif(count(distinct r.id) filter (where r.status in ('completed','settled','refunded')),0), 1) as incident_rate
        from therapists t
        left join service_records r on r.assigned_therapist_id=t.id
        left join incidents i on i.record_id=r.id
        left join refunds rf on rf.record_id=r.id and rf.status='refunded'
       group by t.id order by quality_incident_rate desc nulls last, t.id
    `)).rows;

    const byServiceType = (await this.db.query(`
      select st.id, st.name, st.category,
             count(distinct r.id) as records,
             count(distinct r.id) filter (where exists (select 1 from incidents ai where ai.record_id=r.id)) as incident_records,
             count(distinct r.id) filter (where exists (select 1 from incidents di where di.record_id=r.id and di.type='服务不适')) as discomfort,
             count(distinct r.id) filter (where exists (select 1 from incidents qi where qi.record_id=r.id and qi.quality_related=true)) as quality_incidents,
             round(100.0 * count(distinct r.id) filter (where exists (select 1 from incidents ai where ai.record_id=r.id))
                   / nullif(count(distinct r.id),0), 1) as incident_rate
        from service_types st
        left join service_records r on r.service_type_id=st.id
       group by st.id order by incident_rate desc nulls last
    `)).rows;

    // 异常类型分布
    const incidentTypes = (await this.db.query(`
      select type, count(*) as cnt,
             count(*) filter (where quality_related=true) as quality_related
        from incidents group by type order by cnt desc
    `)).rows;

    return { totals, byTherapist, byServiceType, incidentTypes };
  }

  /** 待派单（含风控阻断待复核） */
  @Get('dispatch/pending')
  async pendingDispatch(@Query('scope') scope: string) {
    const where = scope === 'blocked' ? `r.status='risk_blocked'` : `r.status in ('risk_blocked','pending_accept')`;
    return (await this.db.query(
      `select r.id,r.record_no,r.status,r.appointment_start,r.address,
              st.name as service_name, st.category,
              us.name as user_name, a.risk_score,a.risk_level,a.risk_tags,a.risk_advice,
              r.assigned_therapist_id, t.name as assigned_name
         from service_records r
         join service_types st on st.id=r.service_type_id
         join users us on us.id=r.user_id
         join assessments a on a.record_id=r.id
         left join therapists t on t.id=r.assigned_therapist_id
        where ${where}
        order by a.risk_score desc, r.appointment_start asc`,
    )).rows;
  }

  /** 风控复核：高风险记录放行进入待派单 */
  @Post('records/:id/risk-review')
  async riskReview(@CurrentUser() admin: AuthUser, @Param('id') id: string,
    @Body() body: { pass: boolean; note: string }) {
    const rec = (await this.db.query('select * from service_records where id=$1', [id])).rows[0];
    if (!rec) throw new NotFoundException('记录不存在');
    if (rec.status !== 'risk_blocked') throw new BadRequestException('仅风控阻断状态可复核');
    if (body.pass) {
      await this.db.query(`update service_records set status='pending_accept', updated_at=now() where id=$1`, [id]);
      await this.db.query(
        `insert into dispatch_logs (record_id,action,reason,operator_id)
         values ($1,'assign',$2,$3)`,
        [id, `平台风控复核通过：${body.note || '高风险非禁忌，放行派单，须资深技师并遵守风险提示'}`, admin.id],
      );
    } else {
      await this.db.query(
        `update service_records set status='rejected', rejected_reason=$1, updated_at=now() where id=$2`,
        [`平台风控复核不通过：${body.note || '健康风险高于商业疗程收益，建议先就医'}`, id],
      );
    }
    return { ok: true };
  }

  /** 管理端指派 / 改派 */
  @Post('records/:id/assign')
  async assign(@CurrentUser() admin: AuthUser, @Param('id') id: string,
    @Body() body: { therapist_id: number; reason?: string }) {
    const rec = (await this.db.query('select * from service_records where id=$1', [id])).rows[0];
    if (!rec) throw new NotFoundException('记录不存在');
    if (!['pending_accept','rejected'].includes(rec.status)) throw new BadRequestException('当前状态不可派单');
    const t = (await this.db.query("select * from therapists where id=$1 and status='active'", [body.therapist_id])).rows[0];
    if (!t) throw new BadRequestException('技师不存在或不可接单');
    await this.db.query(
      `update service_records set status='pending_accept', assigned_therapist_id=$1, updated_at=now() where id=$2`,
      [body.therapist_id, id],
    );
    await this.db.query(
      `insert into dispatch_logs (record_id,therapist_id,action,reason,operator_id)
       values ($1,$2,$3,$4,$5)`,
      [id, body.therapist_id, rec.assigned_therapist_id ? 'reassign' : 'assign', body.reason || '管理端派单（参考异常率与擅长匹配）', admin.id],
    );
    return { ok: true };
  }

  /** 异常处理中心 */
  @Get('incidents')
  async incidents(@Query('status') status: string) {
    const where = status && status !== 'all' ? 'where i.status=$1' : '';
    const params = status && status !== 'all' ? [status] : [];
    return (await this.db.query(
      `select i.*, r.record_no, st.name as service_name,
              us.name as user_name, t.name as therapist_name
         from incidents i
         join service_records r on r.id=i.record_id
         join service_types st on st.id=r.service_type_id
         join users us on us.id=r.user_id
         left join therapists t on t.id=r.assigned_therapist_id
         ${where}
        order by case i.severity when 'high' then 1 when 'medium' then 2 else 3 end, i.created_at desc`,
      params,
    )).rows;
  }

  /** 处理异常：登记结论 + 是否与服务质量有关 */
  @Post('incidents/:id/handle')
  async handleIncident(@CurrentUser() admin: AuthUser, @Param('id') id: string,
    @Body() body: { resolution: string; quality_related: boolean; close?: boolean }) {
    const exists = (await this.db.query('select * from incidents where id=$1', [id])).rows[0];
    if (!exists) throw new NotFoundException('异常不存在');
    await this.db.query(
      `update incidents set status=$1, resolution=$2, quality_related=$3, handler_id=$4, resolved_at=$5
        where id=$6`,
      [body.close ? 'closed' : 'resolved', body.resolution,
       body.quality_related ?? null, admin.id, new Date(), id],
    );
    return { ok: true };
  }

  /** 结算失败列表（医保 / 补贴） */
  @Get('settlements/failed')
  async failedSettlements() {
    return (await this.db.query(
      `select s.*, r.record_no, st.name as service_name, us.name as user_name
         from settlements s
         join service_records r on r.id=s.record_id
         join service_types st on st.id=r.service_type_id
         join users us on us.id=r.user_id
        where s.insurance_status='failed' or s.subsidy_status='failed'
        order by s.id desc`,
    )).rows;
  }

  /** 结算重试：模拟渠道恢复，成功后重算分摊 */
  @Post('settlements/:id/retry')
  async retrySettlement(@Param('id') id: string, @Body() body: { channel: 'insurance' | 'subsidy' }) {
    const s = (await this.db.query('select * from settlements where id=$1', [id])).rows[0];
    if (!s) throw new NotFoundException('结算单不存在');
    const channelStatus = body.channel === 'insurance' ? s.insurance_status : s.subsidy_status;
    if (channelStatus !== 'failed') throw new BadRequestException('该渠道无需重试');

    // 模拟：重试即渠道恢复成功（管理端也可选择核销挂账）
    const total = Number(s.total_amount);
    let insurance = Number(s.insurance_amount);
    let subsidy = Number(s.subsidy_amount);
    if (body.channel === 'insurance') {
      insurance = +(total * 0.6).toFixed(2);
      // 医保成功后，补贴按补贴比例重算剩余部分
      const course = s.course_id ? (await this.db.query('select subsidy_rate from courses where id=$1', [s.course_id])).rows[0] : null;
      subsidy = course ? +((total - insurance) * Number(course.subsidy_rate)).toFixed(2) : subsidy;
    } else {
      const course = s.course_id ? (await this.db.query('select subsidy_rate from courses where id=$1', [s.course_id])).rows[0] : null;
      if (course) subsidy = +((total - insurance) * Number(course.subsidy_rate)).toFixed(2);
    }
    const selfPay = +(total - insurance - subsidy).toFixed(2);
    const bothOk =
      (s.insurance_status === 'failed' ? body.channel === 'insurance' : s.insurance_status === 'success' || s.insurance_status === 'none' || s.insurance_status === 'manual_success') &&
      (s.subsidy_status === 'failed' ? body.channel === 'subsidy' : s.subsidy_status === 'success' || s.subsidy_status === 'none' || s.subsidy_status === 'manual_success');

    await this.db.query(
      `update settlements
         set insurance_amount=$1, subsidy_amount=$2, self_pay_amount=$3,
             insurance_status=case when $4='insurance' then 'manual_success' else insurance_status end,
             subsidy_status=case when $4='subsidy' then 'manual_success' else subsidy_status end,
             fail_reason=null, settled_at=now()
       where id=$5`,
      [insurance, subsidy, selfPay, body.channel, id],
    );
    if (bothOk) {
      await this.db.query(`update service_records set status='settled' where id=$1`, [s.record_id]);
    }
    // 同步关闭对应异常
    await this.db.query(
      `update incidents set status='closed', resolution=coalesce(resolution,'') || ' 管理端重试结算成功', resolved_at=now()
        where record_id=$1 and type=$2 and status<>'closed'`,
      [s.record_id, body.channel === 'insurance' ? '医保结算失败' : '补贴结算失败'],
    );
    return { ok: true, self_pay: selfPay, record_settled: bothOk };
  }

  /** 退款审批：全额/驳回，标记是否与服务质量有关（影响技师派单评分） */
  @Get('refunds')
  async refunds(@Query('status') status: string) {
    const where = status && status !== 'all' ? 'where rf.status=$1' : '';
    const params = status && status !== 'all' ? [status] : [];
    return (await this.db.query(
      `select rf.*, r.record_no, st.name as service_name, us.name as user_name,
              t.name as therapist_name, s.pay_status
         from refunds rf
         join service_records r on r.id=rf.record_id
         join service_types st on st.id=r.service_type_id
         join users us on us.id=r.user_id
         left join therapists t on t.id=r.assigned_therapist_id
         left join settlements s on s.record_id=rf.record_id
         ${where} order by rf.id desc`,
      params,
    )).rows;
  }

  @Post('refunds/:id/decide')
  async decideRefund(@CurrentUser() admin: AuthUser, @Param('id') id: string,
    @Body() body: { approve: boolean; quality_related: boolean; admin_note?: string }) {
    const rf = (await this.db.query('select * from refunds where id=$1', [id])).rows[0];
    if (!rf) throw new NotFoundException('退款单不存在');
    if (rf.status !== 'requested') throw new BadRequestException('该退款已处理');
    const client = await this.db.connect();
    try {
      await client.query('begin');
      if (body.approve) {
        await client.query(
          `update refunds set status='refunded', quality_related=$1, admin_note=$2, decided_by=$3, decided_at=now()
            where id=$4`,
          [body.quality_related, body.admin_note || '同意退款', admin.id, id],
        );
        await client.query(
          `update service_records set status='refunded' where id=$1`, [rf.record_id],
        );
        await client.query(
          `update settlements set pay_status='refunded' where record_id=$1`, [rf.record_id],
        );
        await client.query(
          `update incidents set status='closed', quality_related=$1, resolution=$2, handler_id=$3, resolved_at=now()
            where record_id=$4 and type='退款申请'`,
          [body.quality_related, body.admin_note || '退款已执行', admin.id, rf.record_id],
        );
      } else {
        await client.query(
          `update refunds set status='rejected', quality_related=$1, admin_note=$2, decided_by=$3, decided_at=now()
            where id=$4`,
          [body.quality_related, body.admin_note || '驳回退款', admin.id, id],
        );
        await client.query(
          `update incidents set status='closed', quality_related=$1, resolution=$2, handler_id=$3, resolved_at=now()
            where record_id=$4 and type='退款申请'`,
          [body.quality_related, body.admin_note || '退款驳回', admin.id, rf.record_id],
        );
      }
      await client.query('commit');
      return { ok: true };
    } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }
  }
}

@Module({ imports: [DbModule], controllers: [AdminController] })
export class AdminModule {}
