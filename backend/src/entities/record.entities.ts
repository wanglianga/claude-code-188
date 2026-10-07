import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { numericTransformer, ServiceItem, User } from './core.entities';
import {
  CourseStatus,
  DispatchStatus,
  RecordStatus,
  RiskLevel,
  VisitStatus,
} from './enums';

/** 疗程计划 */
@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  serviceItemId: string;

  @ManyToOne(() => ServiceItem)
  @JoinColumn({ name: 'serviceItemId' })
  serviceItem: ServiceItem;

  @Column()
  name: string;

  @Column({ type: 'int' })
  totalSessions: number;

  @Column({ type: 'int', default: 0 })
  usedSessions: number;

  @Column({ type: 'enum', enum: CourseStatus, default: CourseStatus.ACTIVE })
  status: CourseStatus;

  @CreateDateColumn()
  createdAt: Date;
}

/**
 * 健康服务记录（平台核心脊柱）：
 * 评估、派单、上门、疗程、异常、随访、结算、复诊建议全部挂在同一记录上。
 */
@Entity('service_records')
export class ServiceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  recordNo: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // ---- 预约信息 ----
  @Column({ type: 'simple-json', nullable: true })
  painParts: string[]; // 疼痛部位

  @Column({ type: 'int', default: 0 })
  painScoreInitial: number; // 预约时疼痛评分 0-10

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'int', default: 1 })
  floor: number; // 楼层

  @Column({ default: true })
  hasElevator: boolean; // 是否有电梯

  @Column({ type: 'simple-json', nullable: true })
  availableSlots: string[]; // 可服务时间段

  @Column({ default: false })
  familyAccompany: boolean; // 家属陪同

  @Column({ type: 'text', nullable: true })
  familyNotes: string; // 家属/陪同备注

  @Column({ type: 'timestamp', nullable: true })
  appointmentAt: Date; // 预约上门时间

  @Column({ type: 'text', nullable: true })
  userNote: string;

  // ---- 疗程 ----
  @Column({ nullable: true })
  courseId: string;

  @Column({ type: 'int', default: 1 })
  sessionNo: number; // 疗程第几次

  @Column({ type: 'int', default: 1 })
  totalSessions: number; // 疗程总次数（单次服务为 1）

  @Column({ type: 'enum', enum: RecordStatus, default: RecordStatus.PENDING_DISPATCH })
  status: RecordStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/** 记录内的服务项目明细（含服务中临时加项） */
@Entity('record_items')
export class RecordItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  recordId: string;

  @ManyToOne(() => ServiceRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recordId' })
  record: ServiceRecord;

  @Column()
  serviceItemId: string;

  @Column()
  name: string; // 快照

  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: numericTransformer })
  price: number; // 快照

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ default: false })
  addedDuringVisit: boolean; // 是否服务中临时加项
}

/** 风险评估（接单前展示给技师的风险边界） */
@Entity('risk_assessments')
export class RiskAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  recordId: string;

  @OneToOne(() => ServiceRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recordId' })
  record: ServiceRecord;

  @Column({ type: 'enum', enum: RiskLevel })
  riskLevel: RiskLevel;

  @Column({ default: true })
  homeVisitSuitable: boolean; // 是否适合上门

  /** [{ flag, level, detail }] 风险点清单 */
  @Column({ type: 'simple-json', nullable: true })
  riskFlags: { flag: string; level: RiskLevel; detail: string }[];

  @Column({ type: 'simple-json', nullable: true })
  requiredEquipment: string[]; // 所需器械汇总

  @Column({ nullable: true })
  maxIntensity: string; // 建议手法强度上限：轻柔/中等/常规/不建议

  @Column({ type: 'text', nullable: true })
  suggestions: string; // 服务建议（服务依据的一部分）

  @CreateDateColumn()
  createdAt: Date;
}

/** 派单 */
@Entity('dispatches')
export class Dispatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  recordId: string;

  @ManyToOne(() => ServiceRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recordId' })
  record: ServiceRecord;

  @Column()
  therapistId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'therapistId' })
  therapist: User;

  @Column({ type: 'enum', enum: DispatchStatus, default: DispatchStatus.PENDING })
  status: DispatchStatus;

  @Column({ type: 'text', nullable: true })
  note: string; // 派单备注

  @Column({ type: 'text', nullable: true })
  rejectReason: string; // 拒单原因

  @Column({ nullable: true })
  assignedBy: string; // 派单管理员

  @CreateDateColumn()
  assignedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  respondedAt: Date;
}

/** 上门服务记录（签到 + 疗程记录） */
@Entity('visits')
export class Visit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  recordId: string;

  @ManyToOne(() => ServiceRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recordId' })
  record: ServiceRecord;

  @Column()
  therapistId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'therapistId' })
  therapist: User;

  @Column({ type: 'timestamp', nullable: true })
  checkinAt: Date; // 到场签到时间

  @Column({ nullable: true })
  checkinLocation: string; // 签到定位/地址

  @Column({ type: 'int', nullable: true })
  painScore: number; // 本次疼痛评分 0-10

  @Column({ type: 'text', nullable: true })
  movementLimitation: string; // 动作受限情况

  /** 生命体征 { bp, hr, temp, spo2 } */
  @Column({ type: 'simple-json', nullable: true })
  vitals: { bp?: string; hr?: number; temp?: number; spo2?: number };

  /** 实际服务项目 [{ name, price }] */
  @Column({ type: 'simple-json', nullable: true })
  actualItems: { name: string; price: number }[];

  @Column({ type: 'simple-json', nullable: true })
  equipmentUsed: string[]; // 器械使用

  @Column({ nullable: true })
  techniqueIntensity: string; // 手法强度：轻柔/中等/常规/强

  @Column({ type: 'text', nullable: true })
  userFeedback: string; // 用户反馈

  @Column({ type: 'text', nullable: true })
  therapistNote: string; // 技师记录

  @Column({ type: 'text', nullable: true })
  nextVisitSuggestion: string; // 复诊建议

  @Column({ type: 'enum', enum: VisitStatus, default: VisitStatus.CHECKED_IN })
  status: VisitStatus;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
