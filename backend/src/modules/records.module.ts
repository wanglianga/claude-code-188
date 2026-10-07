import { Module } from '@nestjs/common';
import {
  Controller, Get, Post, Body, Param, Query, Inject, UseGuards,
  BadRequestException, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { DbModule, PG_POOL } from '../common/db.module';
import { AuthGuard, Roles, RolesGuard, CurrentUser, AuthUser } from '../common/auth';
import { evaluateRisk } from '../common/risk';

// ---------------- DTO ----------------
class AssessmentDto {
  pain_sites?: string[]; pain_level?: number; onset?: string; history?: string;
  imaging_report?: string; medications?: string; contraindications?: string;
  allergies?: string; available_times?: string; notes?: string;
}
class CreateRecordDto extends AssessmentDto {
  service_type_id: number; course_id?: number;
  address: string; floor_no?: number; has_elevator?: boolean;
  family_present?: boolean; family_contact?: string;
  appointment_start: string; appointment_end?: string;
}
class ReportDto {
  pain_before: number; pain_after: number;
  motion_limitation?: any[]; vital_signs?: any;
  items_actual?: any[]; equipment_used?: any[];
  intensity: number; user_feedback?: string; adverse_reaction?: string;
  duration_min?: number;
  add_item_note?: string; // 现场临时加项说明（可选）
}

function genRecordNo() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `R${stamp}${rand}`;
}

@Controller()
@UseGuards(AuthGuard, RolesGuard)
class RecordsController {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  // ============ 用户：提交前风险试评（不落库） ============
  @Post('risk-preview')
  @Roles('user')
  async riskPreview(@CurrentUser() u: AuthUser, @Body() dto: CreateRecordDto) {
    const st = (await this.db.query('select * from service_types where id=$1', [dto.service_type_id])).rows[0];
    if (!st) throw new BadRequestException('服务类型不存在');
    const user = (await this.db.query('select birth_date from users where id=$1', [u.id])).rows[0];
    return evaluateRisk({
      birthDate: user.birth_date,
      painLevel: dto.pain_level,
      history: dto.history,
      imagingReport: dto.imaging_report,
      medications: dto.medications,
      contraindications: dto.contraindications,
      floorNo: dto.floor_no,
      hasElevator: dto.has_elevator,
      serviceRiskBase: st.risk_base,
    });
  }

  // ============ 用户：预约 + 上门前评估 ============
  @Post('records')
  @Roles('user')
  async create(@CurrentUser() u: AuthUser, @Body() dto: CreateRecordDto) {
    if (!dto.service_type_id || !dto.address || !dto.appointment_start) {
      throw new BadRequestException('服务类型、地址、预约时间为必填');
    }
    const st = (await this.db.query('select * from service_types where id=$1', [dto.service_type_id])).rows[0];
    if (!st) throw new BadRequestException('服务类型不存在');

    const user = (await this.db.query('select birth_date from users where id=$1', [u.id])).rows[0];
    let course: any = null;
    if (dto.course_id) {
      course = (await this.db.query(
        'select * from courses where id=$1 and user_id=$2 and status=$3',
        [dto.course_id, u.id, 'active'],
      )).rows[0];
      if (!course) throw new BadRequestException('疗程包不可用');
      if (course.used_sessions >= course.total_sessions) throw new BadRequestException('疗程次数已用完');
    }

    const risk = evaluateRisk({
      birthDate: user.birth_date,
      painLevel: dto.pain_level,
      painSites: dto.pain_sites,
      history: dto.history,
      imagingReport: dto.imaging_report,
      medications: dto.medications,
      contraindications: dto.contraindications,
      floorNo: dto.floor_no,
      hasElevator: dto.has_elevator,
      serviceRiskBase: st.risk_base,
    });

    const client = await this.db.connect();
    try {
      await client.query('begin');
      const recordNo = genRecordNo();
      // 高风险：健康风险置于商业派单之前，记录停在 risk_blocked，等待管理端风控复核
      const status = risk.blocked ? 'risk_blocked' : 'pending_accept';
      const rec = (await client.query(
        `insert into service_records
           (record_no,user_id,service_type_id,course_id,status,address,floor_no,has_elevator,
            family_present,family_contact,appointment_start,appointment_end)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
        [recordNo, u.id, dto.service_type_id, dto.course_id || null, status, dto.address,
         dto.floor_no ?? null, dto.has_elevator ?? null, dto.family_present ?? null,
         dto.family_contact || null, dto.appointment_start, dto.appointment_end || null],
      )).rows[0];
      await client.query(
        `insert into assessments
           (record_id,pain_sites,pain_level,onset,history,imaging_report,medications,
            contraindications,allergies,available_times,notes,risk_score,risk_level,risk_tags,risk_advice)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [rec.id, dto.pain_sites || [], dto.pain_level ?? null, dto.onset || null, dto.history || null,
         dto.imaging_report || null, dto.medications || null, dto.contraindications || null,
         dto.allergies || null, dto.available_times || null, dto.notes || null,
         risk.score, risk.level, risk.tags, risk.advice],
      );
      await client.query(
        `insert into dispatch_logs (record_id,action,reason) values ($1,'suggest',$2)`,
        [rec.id, `系统风险评估：${risk.score} 分（${risk.level === 'high' ? '高风险，暂阻断派单，待平台复核' : risk.level === 'medium' ? '中风险，可派单但需技师关注' : '低风险'}）`],
      );
      await client.query('commit');
      return { id: rec.id, record_no: rec.record_no, status: rec.status, risk };
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  }

  // ============ 用户：我的记录 ============
  @Get('records/mine')
  @Roles('user')
  async mine(@CurrentUser() u: AuthUser) {
    return (await this.db.query(
      `select r.id,r.record_no,r.status,r.appointment_start,r.address,r.created_at,
              st.name as service_name, st.category,
              a.risk_level, a.risk_score,
              t.name as therapist_name,
              (select count(*) from incidents i where i.record_id=r.id) as incident_count,
              (select count(*) from follow_ups f where f.record_id=r.id) as followup_count
         from service_records r
         join service_types st on st.id=r.service_type_id
         left join assessments a on a.record_id=r.id
         left join therapists t on t.id=r.assigned_therapist_id
        where r.user_id=$1 order by r.appointment_start desc nulls last, r.id desc`,
      [u.id],
    )).rows;
  }

  // ============ 技师：待接单大厅 / 我的工单 ============
  @Get('therapist/orders')
  @Roles('therapist')
  async therapistOrders(@CurrentUser() u: AuthUser, @Query('view') view: string) {
    if (view === 'mine') {
      return (await this.db.query(
        `select r.id,r.record_no,r.status,r.appointment_start,r.address,r.checked_in_at,
                st.name as service_name, st.category,
                a.risk_level, a.risk_score, us.name as user_name, us.phone as user_phone,
                (select count(*) from incidents i where i.record_id=r.id) as incident_count
           from service_records r
           join service_types st on st.id=r.service_type_id
           join users us on us.id=r.user_id
           left join assessments a on a.record_id=r.id
          where r.assigned_therapist_id=$1 and r.status in ('accepted','in_service','completed','settled')
          order by r.appointment_start desc`,
        [u.id],
      )).rows;
    }
    // 待接单：已派给我待确认 + 高风险复核后待抢单
    return (await this.db.query(
      `select r.id,r.record_no,r.status,r.appointment_start,r.address,r.floor_no,r.has_elevator,
              r.family_present,r.family_contact,
              st.name as service_name, st.category, st.required_equipment,
              a.risk_level,a.risk_score,a.risk_tags,a.risk_advice,
              a.pain_sites,a.pain_level,a.contraindications,
              us.name as user_name, us.phone as user_phone,
              exists(select 1 from therapist_skills sk where sk.therapist_id=$1 and sk.service_type_id=r.service_type_id) as skill_match
         from service_records r
         join service_types st on st.id=r.service_type_id
         join users us on us.id=r.user_id
         join assessments a on a.record_id=r.id
        where r.status='pending_accept'
          and (r.assigned_therapist_id is null or r.assigned_therapist_id=$1)
        order by a.risk_score desc, r.appointment_start asc`,
      [u.id],
    )).rows;
  }

  // ============ 统一记录详情（评估/派单/上门/疗程/异常/随访/结算/复诊 同一视图） ============
  @Get('records/:id')
  async detail(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const rec = (await this.db.query(
      `select r.*, st.name as service_name, st.category, st.base_price, st.duration_min,
              st.required_equipment, st.risk_base,
              us.name as user_name, us.phone as user_phone, us.gender, us.birth_date,
              t.name as therapist_name, t.phone as therapist_phone, t.title as therapist_title
         from service_records r
         join service_types st on st.id=r.service_type_id
         join users us on us.id=r.user_id
         left join therapists t on t.id=r.assigned_therapist_id
        where r.id=$1`,
      [id],
    )).rows[0];
    if (!rec) throw new NotFoundException('服务记录不存在');
    if (u.role === 'user' && rec.user_id !== u.id) throw new ForbiddenException('无权查看该记录');
    if (u.role === 'therapist' && rec.assigned_therapist_id !== u.id &&
        !(await this.db.query(`select 1 from service_records where id=$1 and status='pending_accept'`, [id])).rows[0]) {
      throw new ForbiddenException('无权查看该记录');
    }

    const one = async (sql: string) => (await this.db.query(sql, [id])).rows;
    const [assessment, dispatches, reports, incidents, followUps, settlements, refunds, recommendations, timeline] = await Promise.all([
      one(`select * from assessments where record_id=$1`),
      one(`select dl.*, t.name as therapist_name, adm.name as operator_name
            from dispatch_logs dl left join therapists t on t.id=dl.therapist_id
            left join admins adm on adm.id=dl.operator_id where dl.record_id=$1 order by dl.id`),
      one(`select * from service_reports where record_id=$1 order by id`),
      one(`select * from incidents where record_id=$1 order by id`),
      one(`select f.*, t.name as therapist_name from follow_ups f left join therapists t on t.id=f.therapist_id where f.record_id=$1 order by f.id`),
      one(`select * from settlements where record_id=$1 order by id`),
      one(`select * from refunds where record_id=$1 order by id`),
      one(`select rv.*, t.name as therapist_name, st.name as suggested_type_name
            from revisit_recommendations rv
            left join therapists t on t.id=rv.therapist_id
            left join service_types st on st.id=rv.suggested_type_id
           where rv.record_id=$1 order by rv.id desc limit 1`),
      this.buildTimeline(Number(id)),
    ]);

    let course = null;
    if (rec.course_id) {
      course = (await this.db.query(
        `select c.*, st.name as service_type_name from courses c
           join service_types st on st.id=c.service_type_id where c.id=$1`,
        [rec.course_id],
      )).rows[0];
    }

    return {
      ...rec,
      assessment: assessment[0] || null,
      course,
      dispatches,
      reports,
      incidents,
      follow_ups: followUps,
      settlement: settlements[0] || null,
      refund: refunds[0] || null,
      recommendation: recommendations[0] || null,
      timeline,
    };
  }

  /** 把全流程事件汇成同一条时间线 */
  private async buildTimeline(recordId: number) {
    const events: any[] = [];
    const q = async (sql: string, params: any[]) => (await this.db.query(sql, params)).rows;
    for (const x of await q(`select created_at, risk_score, risk_level, risk_advice from assessments where record_id=$1`, [recordId])) {
      events.push({ at: x.created_at, stage: '评估', title: `上门前健康风险评估完成（${x.risk_score} 分 / ${x.risk_level === 'high' ? '高' : x.risk_level === 'medium' ? '中' : '低'}风险）`, detail: x.risk_advice });
    }
    for (const x of await q(`select dl.created_at,dl.action,dl.reason,t.name as therapist_name,adm.name as operator_name
                              from dispatch_logs dl left join therapists t on t.id=dl.therapist_id
                              left join admins adm on adm.id=dl.operator_id where dl.record_id=$1 order by dl.id`, [recordId])) {
      const map: any = { suggest: '系统派单建议', assign: `管理员派单${x.therapist_name ? '给 ' + x.therapist_name : ''}`, accept: `${x.therapist_name || '技师'}确认接单`, reject: `${x.therapist_name || '技师'}拒单`, reassign: '管理员改派' };
      events.push({ at: x.created_at, stage: '派单', title: map[x.action] || x.action, detail: x.reason });
    }
    for (const x of await q(`select checked_in_at, checked_out_at, rejected_reason, cancel_reason from service_records where id=$1`, [recordId])) {
      if (x.checked_in_at) events.push({ at: x.checked_in_at, stage: '上门', title: '技师到场签到', detail: '开始现场服务，先做生命体征与疼痛复核' });
      if (x.rejected_reason) events.push({ at: x.created_at, stage: '派单', title: '不适合上门，记录终止派单', detail: x.rejected_reason });
      if (x.cancel_reason) events.push({ at: x.created_at, stage: '取消', title: '记录取消', detail: x.cancel_reason });
    }
    for (const x of await q(`select * from service_reports where record_id=$1`, [recordId])) {
      events.push({ at: x.created_at, stage: '服务', title: `现场服务报告（疼痛 ${x.pain_before}→${x.pain_after}，手法强度 ${x.intensity}）`, detail: x.user_feedback, adverse: !!x.adverse_reaction });
      if (x.checked_out_at || true) {
        const rec = (await q(`select checked_out_at from service_records where id=$1`, [recordId]))[0];
        if (rec?.checked_out_at) events.push({ at: rec.checked_out_at, stage: '上门', title: '技师签退，现场服务结束' });
      }
    }
    for (const x of await q(`select * from incidents where record_id=$1 order by id`, [recordId])) {
      events.push({ at: x.created_at, stage: '异常', title: `异常：${x.type}（${x.severity === 'high' ? '高' : x.severity === 'medium' ? '中' : '低'}）`, detail: x.description, alert: true });
      if (x.resolved_at) events.push({ at: x.resolved_at, stage: '异常', title: `${x.type} 已处理${x.quality_related === true ? '（判定与服务质量有关）' : x.quality_related === false ? '（判定与服务质量无关）' : ''}`, detail: x.resolution });
    }
    for (const x of await q(`select * from follow_ups where record_id=$1 order by id`, [recordId])) {
      events.push({ at: x.created_at, stage: '随访', title: `随访完成（疼痛 ${x.pain_score ?? '-'}）${x.adverse_flag ? '，有不良反应' : ''}`, detail: x.recovery_note });
    }
    const st = (await q(`select * from settlements where record_id=$1`, [recordId]))[0];
    if (st) {
      events.push({ at: st.created_at, stage: '结算', title: `生成结算单（合计 ¥${st.total_amount}）`, detail: `医保：${st.insurance_status}；补贴：${st.subsidy_status}` });
      if (st.fail_reason) events.push({ at: st.created_at, stage: '结算', title: '结算渠道异常', detail: st.fail_reason, alert: true });
      if (st.settled_at) events.push({ at: st.settled_at, stage: '结算', title: `结算完成：医保 ¥${st.insurance_amount} / 补贴 ¥${st.subsidy_amount} / 自费 ¥${st.self_pay_amount}` });
    }
    for (const x of await q(`select * from refunds where record_id=$1 order by id`, [recordId])) {
      events.push({ at: x.created_at, stage: '退款', title: `用户申请退款 ¥${x.amount}`, detail: x.reason, alert: true });
      if (x.decided_at) events.push({ at: x.decided_at, stage: '退款', title: x.status === 'refunded' ? `退款已执行 ¥${x.amount}` : '退款申请被驳回', detail: x.admin_note });
    }
    for (const x of await q(`select rv.*, st.name as tn from revisit_recommendations rv left join service_types st on st.id=rv.suggested_type_id where rv.record_id=$1`, [recordId])) {
      const map: any = { continue: '建议继续疗程', pause: '建议暂停疗程', terminate: '建议终止疗程', referral: '建议转诊就医' };
      events.push({ at: x.created_at, stage: '复诊建议', title: map[x.decision], detail: x.reason || x.referral_hospital ? `${x.referral_hospital || ''} ${x.referral_department || ''} ${x.reason || ''}`.trim() : null });
    }
    return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }

  // ============ 技师：接单 / 拒单 ============
  @Post('records/:id/accept')
  @Roles('therapist')
  async accept(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const rec = (await this.db.query(`select * from service_records where id=$1`, [id])).rows[0];
    if (!rec) throw new NotFoundException('记录不存在');
    if (rec.status !== 'pending_accept') throw new BadRequestException('当前状态不可接单');
    // 已指派给其他技师的单不可抢单；未指派（抢单池）的单任何在线技师可接
    if (rec.assigned_therapist_id && rec.assigned_therapist_id !== u.id) {
      throw new ForbiddenException('该单已指派给其他技师');
    }
    await this.db.query(
      `update service_records set status='accepted', assigned_therapist_id=$1, accepted_at=now(), updated_at=now()
        where id=$2`,
      [u.id, id],
    );
    await this.db.query(
      `insert into dispatch_logs (record_id,therapist_id,action,reason)
       values ($1,$2,'accept','技师已查看风险评估、禁忌与所需器械，确认适合上门')`,
      [id, u.id],
    );
    return { ok: true };
  }

  @Post('records/:id/reject')
  @Roles('therapist')
  async reject(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: { reason: string }) {
    const rec = (await this.db.query(`select * from service_records where id=$1`, [id])).rows[0];
    if (!rec) throw new NotFoundException('记录不存在');
    if (!['pending_accept'].includes(rec.status)) throw new BadRequestException('当前状态不可拒单');
    await this.db.query(
      `update service_records set status='rejected', assigned_therapist_id=$1, rejected_reason=$2, updated_at=now()
        where id=$3`,
      [rec.assigned_therapist_id || u.id, body.reason || '技师评估后认为不适合上门', id],
    );
    await this.db.query(
      `insert into dispatch_logs (record_id,therapist_id,action,reason) values ($1,$2,'reject',$3)`,
      [id, rec.assigned_therapist_id || u.id, body.reason || '不适合上门'],
    );
    return { ok: true };
  }

  // ============ 技师：签到 ============
  @Post('records/:id/checkin')
  @Roles('therapist')
  async checkin(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const rec = await this.assertAssigned(u, id);
    if (rec.status !== 'accepted') throw new BadRequestException('仅已接单记录可签到');
    await this.db.query(
      `update service_records set status='in_service', checked_in_at=now(), updated_at=now() where id=$1`, [id],
    );
    return { ok: true, checked_in_at: new Date() };
  }

  // ============ 技师：提交到场服务报告（完成服务 + 自动结算） ============
  @Post('records/:id/report')
  @Roles('therapist')
  async report(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ReportDto) {
    const rec = await this.assertAssigned(u, id);
    if (rec.status !== 'in_service') throw new BadRequestException('请先签到再提交服务报告');
    const client = await this.db.connect();
    try {
      await client.query('begin');

      await client.query(
        `insert into service_reports
           (record_id,pain_before,pain_after,motion_limitation,vital_signs,items_actual,
            equipment_used,intensity,user_feedback,adverse_reaction,duration_min)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [id, dto.pain_before ?? null, dto.pain_after ?? null,
         JSON.stringify(dto.motion_limitation || []), JSON.stringify(dto.vital_signs || {}),
         JSON.stringify(dto.items_actual || []), JSON.stringify(dto.equipment_used || []),
         dto.intensity ?? null, dto.user_feedback || null, dto.adverse_reaction || null,
         dto.duration_min ?? null],
      );
      await client.query(
        `update service_records set status='completed', checked_out_at=now(), updated_at=now() where id=$1`, [id],
      );

      // 理疗中出现不适 → 自动登记高优先级异常，进入管理端异常处理中心
      if (dto.adverse_reaction && dto.adverse_reaction.trim()) {
        await client.query(
          `insert into incidents (record_id,type,severity,description) values ($1,'服务不适','high',$2)`,
          [id, `现场不良反应：${dto.adverse_reaction}`],
        );
      }
      // 现场临时加项
      if (dto.add_item_note && dto.add_item_note.trim()) {
        await client.query(
          `insert into incidents (record_id,type,severity,description,status) values ($1,'临时加项','low',$2,'closed')`,
          [id, dto.add_item_note],
        );
      }

      // ---- 结算金额：疗程走单次折算价，其余走目录价；加项另计 ----
      const st = (await client.query('select * from service_types where id=$1', [rec.service_type_id])).rows[0];
      let base = Number(st.base_price);
      let course: any = null;
      if (rec.course_id) {
        course = (await client.query('select * from courses where id=$1 for update', [rec.course_id])).rows[0];
        base = Number(course.per_session_price);
        await client.query('update courses set used_sessions = used_sessions + 1 where id=$1', [rec.course_id]);
      }
      const items: any[] = dto.items_actual || [];
      const itemsAmount = items.filter((x) => !x.included).reduce((s, x) => s + Number(x.price || 0), 0);
      const total = +(base + itemsAmount).toFixed(2);

      // ---- 模拟医保 / 社区补贴实时结算渠道（确定性规则，便于演示失败-重试） ----
      let insuranceStatus: any = 'none';
      let subsidyStatus: any = 'none';
      let insuranceAmount = 0;
      let subsidyAmount = 0;
      let failReason: string | null = null;
      const rid = Number(id);
      if (course?.insurance_no) {
        insuranceStatus = rid % 4 === 1 ? 'failed' : 'success';
        insuranceAmount = insuranceStatus === 'success' ? +(total * 0.6).toFixed(2) : 0;
        if (insuranceStatus === 'failed') failReason = '医保实时结算接口超时（模拟），可在管理端手工重试';
      }
      if (course && Number(course.subsidy_rate) > 0) {
        const remain = total - insuranceAmount;
        subsidyStatus = rid % 5 === 2 ? 'failed' : 'success';
        subsidyAmount = subsidyStatus === 'success' ? +(remain * Number(course.subsidy_rate)).toFixed(2) : 0;
        if (subsidyStatus === 'failed') failReason = (failReason ? failReason + '；' : '') + '社区补贴批次校验失败（模拟），可重试';
      }
      const selfPay = +(total - insuranceAmount - subsidyAmount).toFixed(2);
      const settled = insuranceStatus !== 'failed' && subsidyStatus !== 'failed';

      await client.query(
        `insert into settlements
           (record_id,course_id,base_amount,items_amount,total_amount,insurance_amount,subsidy_amount,
            self_pay_amount,insurance_status,subsidy_status,pay_status,fail_reason,settled_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [id, rec.course_id, base, itemsAmount, total, insuranceAmount, subsidyAmount, selfPay,
         insuranceStatus, subsidyStatus, 'paid', failReason, settled ? new Date() : null],
      );
      if (settled) await client.query(`update service_records set status='settled' where id=$1`, [id]);

      await client.query('commit');
      return { ok: true, settled, fail_reason: failReason, total, self_pay: selfPay };
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  }

  // ============ 技师：上报异常（迟到/器械故障/家属不满/转诊 等） ============
  @Post('records/:id/incident')
  @Roles('therapist')
  async addIncident(@CurrentUser() u: AuthUser, @Param('id') id: string,
    @Body() body: { type: string; severity: string; description: string }) {
    await this.assertAssigned(u, id);
    const allowed = ['临时加项','服务不适','家属不满','技师迟到','器械故障','医保结算失败','补贴结算失败','退款申请','转诊建议'];
    if (!allowed.includes(body.type)) throw new BadRequestException('异常类型不合法');
    const ins = (await this.db.query(
      `insert into incidents (record_id,type,severity,description) values ($1,$2,$3,$4) returning *`,
      [id, body.type, body.severity || 'medium', body.description],
    )).rows[0];
    return ins;
  }

  // ============ 技师：随访 ============
  @Post('records/:id/followup')
  @Roles('therapist')
  async followup(@CurrentUser() u: AuthUser, @Param('id') id: string,
    @Body() body: { channel: string; pain_score?: number; recovery_note?: string; adverse_flag?: boolean; next_advice?: string }) {
    await this.assertAssigned(u, id);
    return (await this.db.query(
      `insert into follow_ups (record_id,therapist_id,channel,pain_score,recovery_note,adverse_flag,next_advice)
       values ($1,$2,$3,$4,$5,$6,$7) returning *`,
      [id, u.id, body.channel || '电话', body.pain_score ?? null, body.recovery_note || null,
       !!body.adverse_flag, body.next_advice || null],
    )).rows[0];
  }

  // ============ 技师：复诊 / 是否继续 / 转诊建议 ============
  @Post('records/:id/revisit')
  @Roles('therapist')
  async revisit(@CurrentUser() u: AuthUser, @Param('id') id: string,
    @Body() body: { decision: string; reason?: string; suggested_type_id?: number; suggested_sessions?: number;
                    referral_hospital?: string; referral_department?: string }) {
    await this.assertAssigned(u, id);
    if (!['continue','pause','terminate','referral'].includes(body.decision)) throw new BadRequestException('建议类型不合法');
    return (await this.db.query(
      `insert into revisit_recommendations
         (record_id,therapist_id,decision,reason,suggested_type_id,suggested_sessions,referral_hospital,referral_department)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [id, u.id, body.decision, body.reason || null, body.suggested_type_id || null,
       body.suggested_sessions || null, body.referral_hospital || null, body.referral_department || null],
    )).rows[0];
  }

  // ============ 用户：申请退款（挂入同一条记录） ============
  @Post('records/:id/refund-request')
  @Roles('user')
  async refundRequest(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: { amount?: number; reason: string }) {
    const rec = (await this.db.query('select * from service_records where id=$1 and user_id=$2', [id, u.id])).rows[0];
    if (!rec) throw new NotFoundException('记录不存在');
    if (!['completed','settled'].includes(rec.status)) throw new BadRequestException('当前状态不可申请退款');
    const st = (await this.db.query('select total_amount from settlements where record_id=$1', [id])).rows[0];
    const amount = body.amount || Number(st?.total_amount || 0);
    const client = await this.db.connect();
    try {
      await client.query('begin');
      const exists = (await client.query('select 1 from refunds where record_id=$1', [id])).rows[0];
      if (exists) throw new BadRequestException('该记录已提交退款申请');
      await client.query(
        `insert into refunds (record_id,amount,reason) values ($1,$2,$3)`,
        [id, amount, body.reason],
      );
      await client.query(
        `insert into incidents (record_id,type,severity,description) values ($1,'退款申请','high',$2)`,
        [id, `用户申请退款 ¥${amount}：${body.reason}`],
      );
      await client.query('commit');
      return { ok: true };
    } catch (e) {
      await client.query('rollback'); throw e;
    } finally { client.release(); }
  }

  // ============ 用户：取消待派单记录 ============
  @Post('records/:id/cancel')
  @Roles('user')
  async cancel(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: { reason?: string }) {
    const rec = (await this.db.query('select * from service_records where id=$1 and user_id=$2', [id, u.id])).rows[0];
    if (!rec) throw new NotFoundException('记录不存在');
    if (!['assessing','risk_blocked','pending_accept'].includes(rec.status)) throw new BadRequestException('当前状态不可取消');
    await this.db.query(
      `update service_records set status='cancelled', cancel_reason=$1, updated_at=now() where id=$2`,
      [body.reason || '用户取消', id],
    );
    return { ok: true };
  }

  // ============ 派单建议（管理端 + 技师可见评分依据） ============
  @Get('records/:id/dispatch-suggestions')
  async suggestions(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    if (u.role === 'user') throw new ForbiddenException();
    const rec = (await this.db.query(
      `select r.*, a.risk_score, a.risk_level from service_records r
         join assessments a on a.record_id=r.id where r.id=$1`, [id],
    )).rows[0];
    if (!rec) throw new NotFoundException('记录不存在');

    const rows = await this.db.query(
      `select t.*,
              exists(select 1 from therapist_skills sk where sk.therapist_id=t.id and sk.service_type_id=$1) as skill_match,
              (select count(*) from service_records sr where sr.assigned_therapist_id=t.id
                 and sr.status in ('accepted','in_service')) as active_orders,
              (select count(*) from service_records sr where sr.assigned_therapist_id=t.id
                 and sr.status in ('completed','settled','refunded')) as finished_orders,
              (select count(distinct i.record_id) from incidents i
                 join service_records sr on sr.id=i.record_id
                where sr.assigned_therapist_id=t.id and i.quality_related=true) as quality_incident_records
         from therapists t where t.status='active' order by t.id`,
      [rec.service_type_id],
    );
    const availableEquip = new Set((await this.db.query(
      `select name from equipment where status='available'`,
    )).rows.map((e: any) => e.name));
    const required: string[] = (await this.db.query('select required_equipment from service_types where id=$1', [rec.service_type_id])).rows[0]?.required_equipment || [];
    const missing = required.filter((n) => !availableEquip.has(n));

    const suggestions = rows.rows.map((t: any) => {
      // 评分 = 擅长匹配 30 + 用户评分 12*rating + 年资 1.5/年 − 在手工单*5
      //        − 质量异常率*40（按"质量异常记录/完工记录"归一化，避免资深技师单多反垫底）
      // 高风险单：低年资额外 −25，且无质量记录的新人不给予质量信誉
      const finished = Number(t.finished_orders) || 0;
      const qualityRate = finished ? Number(t.quality_incident_records) / finished : 0;
      let score = (t.skill_match ? 30 : 0) + Number(t.rating) * 12 + t.years_exp * 1.5
        - t.active_orders * 5 - qualityRate * 40;
      if (rec.risk_level === 'high' && t.years_exp < 3) score -= 25;
      return {
        therapist_id: t.id, name: t.name, title: t.title, years_exp: t.years_exp,
        rating: Number(t.rating), skill_match: t.skill_match,
        active_orders: t.active_orders, finished_orders: finished,
        quality_incidents: Number(t.quality_incident_records),
        incident_rate: +(qualityRate * 100).toFixed(1),
        score: +score.toFixed(1),
      };
    }).sort((a, b) => b.score - a.score);

    return { risk_level: rec.risk_level, risk_score: rec.risk_score, equipment_missing: missing, suggestions };
  }

  private async assertAssigned(u: AuthUser, id: string) {
    const rec = (await this.db.query('select * from service_records where id=$1', [id])).rows[0];
    if (!rec) throw new NotFoundException('记录不存在');
    if (rec.assigned_therapist_id !== u.id) throw new ForbiddenException('该记录未指派给你');
    return rec;
  }
}

@Module({ imports: [DbModule], controllers: [RecordsController] })
export class RecordsModule {}
