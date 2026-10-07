import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numericTransformer } from './core.entities';
import {
  ExceptionStatus,
  ExceptionType,
  ReferralStatus,
  SettlementChannel,
  SettlementStatus,
} from './enums';
import { ServiceRecord, Visit } from './record.entities';

/** 异常事件（加项/不适/家属不满/迟到/器械故障/结算失败/退款/转诊等） */
@Entity('exception_events')
export class ExceptionEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  recordId: string;

  @ManyToOne(() => ServiceRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recordId' })
  record: ServiceRecord;

  @Column({ nullable: true })
  visitId: string;

  @Column({ type: 'enum', enum: ExceptionType })
  type: ExceptionType;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true })
  createdBy: string; // 上报人用户 id

  @Column({ nullable: true })
  createdByRole: string;

  @Column({ type: 'enum', enum: ExceptionStatus, default: ExceptionStatus.OPEN })
  status: ExceptionStatus;

  @Column({ type: 'text', nullable: true })
  resolution: string; // 处理结果

  @Column({ nullable: true })
  handledBy: string; // 处理人（管理员）

  /** 附加信息，如退款金额、加项明细 */
  @Column({ type: 'simple-json', nullable: true })
  meta: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;
}

/** 结算单（含医保/社区补贴/自费与退款） */
@Entity('settlements')
export class Settlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  recordId: string;

  @OneToOne(() => ServiceRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recordId' })
  record: ServiceRecord;

  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: numericTransformer })
  totalAmount: number; // 应收总额

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0, transformer: numericTransformer })
  insuranceAmount: number; // 医保承担

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0, transformer: numericTransformer })
  subsidyAmount: number; // 社区补贴承担

  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: numericTransformer })
  selfPayAmount: number; // 个人自付

  @Column({ type: 'enum', enum: SettlementStatus, default: SettlementStatus.PENDING })
  status: SettlementStatus;

  @Column({ type: 'enum', enum: SettlementChannel, nullable: true })
  channel: SettlementChannel;

  @Column({ type: 'text', nullable: true })
  failureReason: string; // 结算失败原因

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true, transformer: numericTransformer })
  refundAmount: number;

  @Column({ type: 'text', nullable: true })
  refundReason: string;

  @Column({ type: 'timestamp', nullable: true })
  refundedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}

/** 随访记录 */
@Entity('follow_ups')
export class FollowUp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  recordId: string;

  @ManyToOne(() => ServiceRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recordId' })
  record: ServiceRecord;

  @Column({ nullable: true })
  visitId: string;

  @Column({ default: '电话' })
  method: string; // 随访方式

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'int', nullable: true })
  painScoreAfter: number; // 随访时疼痛评分

  @Column({ type: 'int', nullable: true })
  satisfaction: number; // 满意度 1-5

  @Column({ type: 'text', nullable: true })
  nextPlan: string; // 后续计划

  @Column({ nullable: true })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;
}

/** 转诊/复诊建议 */
@Entity('referrals')
export class Referral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  recordId: string;

  @ManyToOne(() => ServiceRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recordId' })
  record: ServiceRecord;

  @Column({ type: 'text' })
  reason: string; // 转诊原因

  @Column()
  suggestedDepartment: string; // 建议科室

  @Column({ type: 'text', nullable: true })
  doctorAdvice: string; // 医生建议

  @Column({ type: 'enum', enum: ReferralStatus, default: ReferralStatus.SUGGESTED })
  status: ReferralStatus;

  @Column({ nullable: true })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
