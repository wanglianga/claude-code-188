export const STATUS_MAP = {
  assessing: { label: '评估中', type: 'info' },
  risk_blocked: { label: '风险阻断待复核', type: 'danger' },
  pending_accept: { label: '待接单', type: 'warning' },
  accepted: { label: '已接单', type: 'primary' },
  in_service: { label: '服务中', type: '' },
  completed: { label: '服务完成', type: 'success' },
  settled: { label: '已结算', type: 'success' },
  refunded: { label: '已退款', type: 'info' },
  rejected: { label: '不适合上门/已终止', type: 'danger' },
  cancelled: { label: '已取消', type: 'info' },
};

export const RISK_MAP = {
  low: { label: '低风险', type: 'success' },
  medium: { label: '中风险', type: 'warning' },
  high: { label: '高风险', type: 'danger' },
};

export const STAGE_STYLE = {
  评估: '#2c7be5', 派单: '#6b7fd7', 上门: '#27ae60', 服务: '#0ea5a4',
  异常: '#e74c3c', 随访: '#f39c12', 结算: '#8e44ad', 退款: '#c0392b',
  复诊建议: '#16a085', 取消: '#909399',
};

export const INCIDENT_TYPES = ['临时加项', '服务不适', '家属不满', '技师迟到', '器械故障', '医保结算失败', '补贴结算失败', '退款申请', '转诊建议'];

export const DECISION_MAP = {
  continue: { label: '建议继续疗程', type: 'success' },
  pause: { label: '建议暂停疗程', type: 'warning' },
  terminate: { label: '建议终止疗程', type: 'danger' },
  referral: { label: '建议转诊就医', type: 'danger' },
};

export const fmt = (v) => (v === null || v === undefined || v === '' ? '—' : v);
export const money = (v) => `¥${Number(v || 0).toFixed(2)}`;
export const dt = (v) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');
