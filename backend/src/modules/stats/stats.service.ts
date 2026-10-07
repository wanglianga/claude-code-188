import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Dispatch,
  DispatchStatus,
  ExceptionEvent,
  ExceptionStatus,
  ExceptionType,
  RecordItem,
  RecordStatus,
  ServiceCategory,
  ServiceItem,
  ServiceRecord,
  Settlement,
  SettlementStatus,
  User,
  UserRole,
  Visit,
  VisitStatus,
} from '../../entities';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(ServiceRecord) private records: Repository<ServiceRecord>,
    @InjectRepository(RecordItem) private recordItems: Repository<RecordItem>,
    @InjectRepository(Dispatch) private dispatches: Repository<Dispatch>,
    @InjectRepository(Visit) private visits: Repository<Visit>,
    @InjectRepository(ExceptionEvent) private exceptions: Repository<ExceptionEvent>,
    @InjectRepository(Settlement) private settlements: Repository<Settlement>,
    @InjectRepository(ServiceItem) private serviceItems: Repository<ServiceItem>,
    @InjectRepository(User) private users: Repository<User>,
  ) {}

  async overview() {
    const [records, exceptions, settlements] = await Promise.all([
      this.records.find(),
      this.exceptions.find(),
      this.settlements.find(),
    ]);
    const byStatus: Record<string, number> = {};
    for (const s of Object.values(RecordStatus)) {
      byStatus[s] = records.filter((r) => r.status === s).length;
    }
    const paid = settlements.filter((s) => s.status === SettlementStatus.PAID);
    const refunded = settlements.filter((s) => s.status === SettlementStatus.REFUNDED);
    return {
      totalRecords: records.length,
      byStatus,
      totalExceptions: exceptions.length,
      openExceptions: exceptions.filter(
        (e) => e.status === ExceptionStatus.OPEN || e.status === ExceptionStatus.PROCESSING,
      ).length,
      refundRequests: exceptions.filter((e) => e.type === ExceptionType.REFUND_REQUEST).length,
      refundedCount: refunded.length,
      revenue: Math.round(paid.reduce((s, x) => s + Number(x.totalAmount), 0) * 100) / 100,
      refundAmount: Math.round(refunded.reduce((s, x) => s + Number(x.refundAmount || 0), 0) * 100) / 100,
    };
  }

  /** 按技师：派单、完成、异常、退款、疼痛改善（效果并非线性，允许为负） */
  async byTherapist() {
    const therapists = await this.users.find({ where: { role: UserRole.THERAPIST } });
    const [dispatches, visits, exceptions, settlements, records] = await Promise.all([
      this.dispatches.find(),
      this.visits.find(),
      this.exceptions.find(),
      this.settlements.find(),
      this.records.find(),
    ]);
    const recordMap = new Map(records.map((r) => [r.id, r]));

    return therapists.map((t) => {
      const myDispatches = dispatches.filter((d) => d.therapistId === t.id);
      const accepted = myDispatches.filter((d) => d.status === DispatchStatus.ACCEPTED);
      const rejected = myDispatches.filter((d) => d.status === DispatchStatus.REJECTED);
      const recordIds = new Set(accepted.map((d) => d.recordId));
      const myVisits = visits.filter((v) => v.therapistId === t.id && v.status === VisitStatus.COMPLETED);
      const myExceptions = exceptions.filter((e) => recordIds.has(e.recordId));
      const mySettlements = settlements.filter((s) => recordIds.has(s.recordId));
      const refunds = mySettlements.filter((s) => s.status === SettlementStatus.REFUNDED);

      // 疼痛改善 = 预约评分 - 最后一次服务评分（负值表示加重）
      const reliefs: number[] = [];
      for (const rid of recordIds) {
        const rec = recordMap.get(rid);
        const recVisits = myVisits
          .filter((v) => v.recordId === rid && v.painScore != null)
          .sort((a, b) => +new Date(a.completedAt || 0) - +new Date(b.completedAt || 0));
        const last = recVisits[recVisits.length - 1];
        if (rec && last) reliefs.push(rec.painScoreInitial - last.painScore);
      }
      const completed = myVisits.length;
      return {
        therapistId: t.id,
        name: t.name,
        assigned: myDispatches.length,
        accepted: accepted.length,
        rejected: rejected.length,
        completedVisits: completed,
        exceptionCount: myExceptions.length,
        openExceptions: myExceptions.filter(
          (e) => e.status === ExceptionStatus.OPEN || e.status === ExceptionStatus.PROCESSING,
        ).length,
        refundCount: refunds.length,
        exceptionRate: completed ? Math.round((myExceptions.length / completed) * 1000) / 10 : 0,
        avgPainRelief: reliefs.length
          ? Math.round((reliefs.reduce((a, b) => a + b, 0) / reliefs.length) * 100) / 100
          : null,
      };
    });
  }

  /** 按服务类目：单量、金额、异常率、退款 */
  async byServiceType() {
    const [records, items, serviceItems, exceptions, settlements] = await Promise.all([
      this.records.find(),
      this.recordItems.find(),
      this.serviceItems.find(),
      this.exceptions.find(),
      this.settlements.find(),
    ]);
    const catMap = new Map(serviceItems.map((s) => [s.id, s.category]));
    const result: Record<string, any> = {};
    for (const c of Object.values(ServiceCategory)) {
      result[c] = { category: c, recordIds: new Set<string>(), amount: 0, exceptionCount: 0, refundCount: 0 };
    }
    for (const it of items) {
      const cat = catMap.get(it.serviceItemId);
      if (!cat) continue;
      result[cat].recordIds.add(it.recordId);
      result[cat].amount += Number(it.price) * it.quantity;
    }
    const refundedRecordIds = new Set(
      settlements.filter((s) => s.status === SettlementStatus.REFUNDED).map((s) => s.recordId),
    );
    const exceptionRecordIds = new Map<string, number>();
    for (const e of exceptions) {
      exceptionRecordIds.set(e.recordId, (exceptionRecordIds.get(e.recordId) || 0) + 1);
    }
    for (const c of Object.values(ServiceCategory)) {
      const ids: Set<string> = result[c].recordIds;
      let exc = 0;
      let ref = 0;
      for (const id of ids) {
        exc += exceptionRecordIds.get(id) || 0;
        if (refundedRecordIds.has(id)) ref += 1;
      }
      const count = ids.size;
      result[c] = {
        category: c,
        recordCount: count,
        amount: Math.round(result[c].amount * 100) / 100,
        exceptionCount: exc,
        refundCount: ref,
        exceptionRate: count ? Math.round((exc / count) * 1000) / 10 : 0,
      };
    }
    // 排除已取消记录的单量统计更合理，但保留全量口径，前端可结合状态过滤
    void records;
    return Object.values(result);
  }

  async exceptionsByType() {
    const exceptions = await this.exceptions.find();
    return Object.values(ExceptionType).map((t) => ({
      type: t,
      count: exceptions.filter((e) => e.type === t).length,
      open: exceptions.filter(
        (e) => e.type === t && (e.status === ExceptionStatus.OPEN || e.status === ExceptionStatus.PROCESSING),
      ).length,
    }));
  }
}
