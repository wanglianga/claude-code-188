import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ServiceCategory, UserRole } from './enums';

/** numeric 列在 pg 驱动下返回 string，这里统一转 number */
export const numericTransformer = {
  to: (v?: number) => v,
  from: (v?: string) => (v === null || v === undefined ? v : parseFloat(v)),
};

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  phone: string;

  @Column()
  passwordHash: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

/** 用户健康档案：既往病史、影像报告、用药、禁忌等 */
@Entity('health_profiles')
export class HealthProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  gender: string;

  @Column({ type: 'int', nullable: true })
  age: number;

  @Column({ type: 'text', nullable: true })
  medicalHistory: string; // 既往病史

  @Column({ type: 'text', nullable: true })
  medications: string; // 在服药物

  @Column({ type: 'text', nullable: true })
  contraindications: string; // 禁忌描述

  @Column({ type: 'simple-json', nullable: true })
  contraindicationTags: string[]; // 结构化禁忌标签（与项目禁忌标签对齐）

  @Column({ type: 'text', nullable: true })
  imagingReports: string; // 影像报告摘要

  @Column({ type: 'text', nullable: true })
  allergies: string;

  @Column({ nullable: true })
  insuranceNo: string; // 医保账号（空表示无医保通道）

  @Column({ default: false })
  hasSubsidy: boolean; // 是否有社区补贴资格

  @UpdateDateColumn()
  updatedAt: Date;
}

/** 技师（康复师/理疗师）档案 */
@Entity('therapist_profiles')
export class TherapistProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  title: string; // 职称

  @Column({ type: 'simple-json', nullable: true })
  skills: string[]; // 可服务类目

  @Column({ type: 'simple-json', nullable: true })
  equipment: string[]; // 可携带器械

  @Column({ nullable: true })
  serviceArea: string; // 服务片区

  @Column({ type: 'int', default: 0 })
  yearsExp: number;

  @Column({ type: 'text', nullable: true })
  bio: string;
}

/** 服务项目目录 */
@Entity('service_items')
export class ServiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: ServiceCategory })
  category: ServiceCategory;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: numericTransformer })
  price: number;

  @Column({ type: 'int', default: 45 })
  durationMin: number;

  /** 基础风险等级 1低 2中 3高 */
  @Column({ type: 'int', default: 1 })
  baseRisk: number;

  @Column({ type: 'simple-json', nullable: true })
  requiredEquipment: string[]; // 所需器械

  @Column({ type: 'simple-json', nullable: true })
  contraindicationTags: string[]; // 禁忌标签

  @Column({ default: true })
  active: boolean;
}
