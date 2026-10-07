import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../../common/current-user.decorator';
import {
  ExceptionEvent,
  ExceptionType,
  RecordStatus,
  ServiceRecord,
  Settlement,
  SettlementChannel,
  SettlementStatus,
  UserRole,
} from '../../entities';
import { PayDto, RefundHandleDto, RefundRequestDto } from './dto';

@Injectable()
export class SettlementsService {
  constructor(
    @InjectRepository(Settlement) private settlements: Repository<Settlement>,
    @InjectRepository(ServiceRecord) private records: Repository<ServiceRecord>,
    @InjectRepository(ExceptionEvent) private exceptions: Repository<ExceptionEvent>,
  ) {}

  /** 发起结算（医保/社区补贴/自费通道；可模拟通道失败） */
  async pay(recordId: string, user: AuthUser, dto: PayDto) {
    const record = await this.records.findOne({ where: { id: recordId } });
    if (!record) throw new NotFoundException('记录不存在');
    if (user.role !== UserRole.ADMIN && record.userId !== user.id) {
      throw new ForbiddenException('无权操作该记录');
    }
    const settlement = await this.settlements.findOne({ where: { recordId } });
    if (!settlement) throw new BadRequestException('结算单尚未生成');
    if (![SettlementStatus.PENDING, SettlementStatus.FAILED].includes(settlement.status)) {
      throw new BadRequestException('当前结算状态不可支付');
    }

    const channelName =
      dto.channel === SettlementChannel.INSURANCE
        ? '医保'
        : dto.channel === SettlementChannel.SUBSIDY
          ? '社区补贴'
          : '自费';

    if (dto.simulateFailure && dto.channel !== SettlementChannel.SELF) {
      // 医保/社区补贴结算失败：登记异常，等待改用自费或重试
      settlement.status = SettlementStatus.FAILED;
      settlement.channel = dto.channel;
      settlement.failureReason = `${channelName}通道结算失败：通道返回异常（演示模拟），可改用自费或重试`;
      await this.settlements.save(settlement);
      await this.exceptions.save(
        this.exceptions.create({
          recordId,
          type: ExceptionType.SETTLEMENT_FAILED,
          description: settlement.failureReason,
          createdBy: user.id,
          createdByRole: user.role,
          meta: { channel: dto.channel, amount: settlement.totalAmount },
        }),
      );
      return settlement;
    }

    settlement.status = SettlementStatus.PAID;
    settlement.channel = dto.channel;
    settlement.failureReason = null;
    settlement.paidAt = new Date();
    await this.settlements.save(settlement);
    record.status = RecordStatus.SETTLED;
    await this.records.save(record);
    return settlement;
  }

  /** 用户申请退款 → 生成退款异常单待管理端审批 */
  async requestRefund(recordId: string, user: AuthUser, dto: RefundRequestDto) {
    const record = await this.records.findOne({ where: { id: recordId } });
    if (!record) throw new NotFoundException('记录不存在');
    if (record.userId !== user.id) throw new ForbiddenException('无权操作该记录');
    const settlement = await this.settlements.findOne({ where: { recordId } });
    if (!settlement || settlement.status !== SettlementStatus.PAID) {
      throw new BadRequestException('仅已支付的结算可申请退款');
    }
    const existing = await this.exceptions.findOne({
      where: { recordId, type: ExceptionType.REFUND_REQUEST, status: 'OPEN' as any },
    });
    if (existing) throw new BadRequestException('已有待处理的退款申请');
    const amount = dto.amount ?? settlement.totalAmount;
    if (amount > settlement.totalAmount) throw new BadRequestException('退款金额不能超过实付总额');
    await this.exceptions.save(
      this.exceptions.create({
        recordId,
        type: ExceptionType.REFUND_REQUEST,
        description: `用户申请退款 ¥${amount}：${dto.reason}`,
        createdBy: user.id,
        createdByRole: user.role,
        meta: { amount, reason: dto.reason },
      }),
    );
    return settlement;
  }

  /** 管理端审批退款 */
  async handleRefund(settlementId: string, adminId: string, dto: RefundHandleDto) {
    const settlement = await this.settlements.findOne({ where: { id: settlementId } });
    if (!settlement) throw new NotFoundException('结算单不存在');
    const refundReq = await this.exceptions.findOne({
      where: { recordId: settlement.recordId, type: ExceptionType.REFUND_REQUEST, status: 'OPEN' as any },
      order: { createdAt: 'DESC' },
    });
    if (!refundReq) throw new BadRequestException('没有待审批的退款申请');

    refundReq.handledBy = adminId;
    refundReq.resolvedAt = new Date();
    if (dto.approve) {
      settlement.status = SettlementStatus.REFUNDED;
      settlement.refundAmount = refundReq.meta?.amount ?? settlement.totalAmount;
      settlement.refundReason = refundReq.meta?.reason;
      settlement.refundedAt = new Date();
      refundReq.status = 'RESOLVED' as any;
      refundReq.resolution = `退款已批准：${dto.resolution}`;
    } else {
      refundReq.status = 'REJECTED' as any;
      refundReq.resolution = `退款已驳回：${dto.resolution}`;
    }
    await this.settlements.save(settlement);
    await this.exceptions.save(refundReq);
    return settlement;
  }

  /** 结算单列表（管理端） */
  async list(status?: SettlementStatus) {
    const all = await this.settlements.find({ order: { createdAt: 'DESC' } });
    const records = await this.records.find({ relations: ['user'] });
    const rMap = new Map(records.map((r) => [r.id, r]));
    let rows = all.map((s) => {
      const r = rMap.get(s.recordId);
      return {
        ...s,
        recordNo: r?.recordNo,
        userName: (r as any)?.user?.name,
        recordStatus: r?.status,
      };
    });
    if (status) rows = rows.filter((s) => s.status === status);
    return rows;
  }
}
