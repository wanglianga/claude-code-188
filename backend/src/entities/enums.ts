export enum UserRole {
  USER = 'USER',
  THERAPIST = 'THERAPIST',
  ADMIN = 'ADMIN',
}

/** 服务记录（健康服务记录）主状态 */
export enum RecordStatus {
  PENDING_DISPATCH = 'PENDING_DISPATCH', // 待派单
  DISPATCHED = 'DISPATCHED', // 已派单待接单
  ACCEPTED = 'ACCEPTED', // 技师已接单
  IN_SERVICE = 'IN_SERVICE', // 服务中（已签到）
  COMPLETED = 'COMPLETED', // 服务完成待结算
  SETTLED = 'SETTLED', // 已结算
  CLOSED = 'CLOSED', // 已关闭（随访/复诊完成归档）
  CANCELLED = 'CANCELLED', // 已取消
}

export enum DispatchStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum VisitStatus {
  CHECKED_IN = 'CHECKED_IN',
  COMPLETED = 'COMPLETED',
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ExceptionType {
  ADD_ITEM = 'ADD_ITEM', // 用户临时要求增加项目
  DISCOMFORT = 'DISCOMFORT', // 理疗中出现不适
  FAMILY_COMPLAINT = 'FAMILY_COMPLAINT', // 家属对疗程效果不满
  TECH_LATE = 'TECH_LATE', // 技师迟到
  EQUIPMENT_FAILURE = 'EQUIPMENT_FAILURE', // 器械故障
  SETTLEMENT_FAILED = 'SETTLEMENT_FAILED', // 医保/社区补贴结算失败
  REFUND_REQUEST = 'REFUND_REQUEST', // 用户要求退款
  REFERRAL_SUGGESTED = 'REFERRAL_SUGGESTED', // 医生建议转诊
  OTHER = 'OTHER',
}

export enum ExceptionStatus {
  OPEN = 'OPEN',
  PROCESSING = 'PROCESSING',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

export enum SettlementStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum SettlementChannel {
  INSURANCE = 'INSURANCE', // 医保
  SUBSIDY = 'SUBSIDY', // 社区补贴
  SELF = 'SELF', // 自费
}

export enum ServiceCategory {
  PAIN = 'PAIN', // 颈肩腰腿痛理疗
  POST_SURGERY = 'POST_SURGERY', // 术后康复
  POSTPARTUM = 'POSTPARTUM', // 产后修复
  ELDERLY = 'ELDERLY', // 老人关节训练
}

export enum CourseStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ReferralStatus {
  SUGGESTED = 'SUGGESTED',
  ACCEPTED = 'ACCEPTED',
  DONE = 'DONE',
}
