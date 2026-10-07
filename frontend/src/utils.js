import dayjs from 'dayjs';

export const fmtTime = (t) => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '—');
export const fmtMoney = (n) => (n == null ? '—' : `¥${Number(n).toFixed(2)}`);

export const CATEGORY_LABELS = {
  PAIN: '颈肩腰腿痛理疗',
  POST_SURGERY: '术后康复',
  POSTPARTUM: '产后修复',
  ELDERLY: '老人关节训练',
};

export const RECORD_STATUS = {
  PENDING_DISPATCH: { label: '待派单', type: 'warning' },
  DISPATCHED: { label: '待接单', type: 'warning' },
  ACCEPTED: { label: '已接单', type: 'primary' },
  IN_SERVICE: { label: '服务中', type: 'primary' },
  COMPLETED: { label: '待结算', type: 'success' },
  SETTLED: { label: '已结算', type: 'success' },
  CLOSED: { label: '已关闭', type: 'info' },
  CANCELLED: { label: '已取消', type: 'info' },
};

export const RISK_LEVELS = {
  LOW: { label: '低风险', type: 'success' },
  MEDIUM: { label: '中风险', type: 'warning' },
  HIGH: { label: '高风险', type: 'danger' },
  CRITICAL: { label: '严重风险·不宜上门', type: 'danger' },
};

export const EXCEPTION_TYPES = {
  ADD_ITEM: '临时加项',
  DISCOMFORT: '理疗中不适',
  FAMILY_COMPLAINT: '家属不满',
  TECH_LATE: '技师迟到',
  EQUIPMENT_FAILURE: '器械故障',
  SETTLEMENT_FAILED: '结算失败',
  REFUND_REQUEST: '退款申请',
  REFERRAL_SUGGESTED: '建议转诊',
  OTHER: '其他',
};

export const EXCEPTION_STATUS = {
  OPEN: { label: '待处理', type: 'danger' },
  PROCESSING: { label: '处理中', type: 'warning' },
  RESOLVED: { label: '已解决', type: 'success' },
  REJECTED: { label: '已驳回', type: 'info' },
};

export const SETTLEMENT_STATUS = {
  PENDING: { label: '待支付', type: 'warning' },
  PAID: { label: '已支付', type: 'success' },
  FAILED: { label: '结算失败', type: 'danger' },
  REFUNDED: { label: '已退款', type: 'info' },
};

export const CONTRAINDICATION_TAGS = [
  '高血压未控制', '心脏病/起搏器', '骨质疏松', '急性损伤期', '皮肤破损/感染',
  '出血倾向', '孕期', '恶性肿瘤', '发热/急性感染', '深静脉血栓',
];

export const PAIN_PARTS = ['颈部', '肩部', '腰部', '腿部', '膝关节', '盆底', '腹部', '全身'];

export const TIME_SLOTS = ['工作日上午', '工作日下午', '工作日晚间', '周末上午', '周末下午'];

export const INTENSITIES = ['轻柔', '中等', '常规', '强'];
