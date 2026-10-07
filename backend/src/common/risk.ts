// ============================================================
// 健康风险评估引擎
// 原则：健康风险在商业疗程之前 —— 高风险记录默认阻断派单，
//       需平台风控复核放行 + 技师接单前确认风险边界。
// 评分全部由可解释规则累加，前端/记录详情展示每一条依据。
// ============================================================

export interface RiskInput {
  birthDate?: string | null;          // ISO 日期
  painLevel?: number | null;
  painSites?: string[];
  history?: string | null;            // 既往病史
  imagingReport?: string | null;      // 影像报告
  medications?: string | null;        // 当前用药
  contraindications?: string | null;  // 禁忌（自由文本）
  floorNo?: number | null;
  hasElevator?: boolean | null;
  serviceRiskBase?: number;            // 服务类型固有风险
}

export interface RiskRule {
  tag: string;
  points: number;
  advice: string;
}

export interface RiskResult {
  score: number;
  level: 'low' | 'medium' | 'high';
  tags: string[];
  advice: string;
  blocked: boolean;                   // true = 商业派单前必须人工复核
  rules: RiskRule[];
}

function ageOf(birthDate?: string | null): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  // 以固定评估基准日计算，避免依赖系统时钟造成不可重复
  const now = new Date('2026-10-07');
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function evaluateRisk(input: RiskInput): RiskResult {
  const rules: RiskRule[] = [];
  const text = `${input.history || ''} ${input.contraindications || ''} ${input.imagingReport || ''} ${input.medications || ''}`;
  const has = (kw: string | string[]) =>
    (Array.isArray(kw) ? kw : [kw]).some((k) => text.includes(k));

  // 1) 服务类型固有风险
  if (input.serviceRiskBase) {
    rules.push({ tag: '服务固有风险', points: input.serviceRiskBase, advice: '该类服务本身存在固有风险，须按规范操作' });
  }

  // 2) 年龄
  const age = ageOf(input.birthDate);
  if (age !== null) {
    if (age >= 75) rules.push({ tag: '高龄(≥75)', points: 15, advice: '高龄用户耐受差，建议低强度、短时多次，到场先评估生命体征' });
    else if (age >= 60) rules.push({ tag: '老年(60-74)', points: 8, advice: '老年用户注意训练强度与体位变化' });
  }

  // 3) 疼痛评分
  if (input.painLevel !== null && input.painLevel !== undefined) {
    if (input.painLevel >= 8) rules.push({ tag: '剧烈疼痛(≥8)', points: 18, advice: '剧烈疼痛期先排除急症/重症，不建议直接上理疗' });
    else if (input.painLevel >= 6) rules.push({ tag: '中重度疼痛(6-7)', points: 10, advice: '中重度疼痛以轻柔评估为主，避免重手法' });
  }

  // 4) 既往病史与用药
  if (has(['高血压'])) rules.push({ tag: '高血压', points: 6, advice: '训练前测血压；收缩压≥160 或舒张压≥100 暂缓服务' });
  if (has(['冠心病', '支架', '心脏支架'])) rules.push({ tag: '冠心病/支架术后', points: 10, advice: '避免憋气与爆发用力，携带急救用药信息，必要时家属陪同' });
  if (has(['糖尿病'])) rules.push({ tag: '糖尿病', points: 6, advice: '注意低血糖与皮肤破损，避免空腹训练' });
  if (has(['骨质疏松'])) rules.push({ tag: '骨质疏松', points: 10, advice: '禁暴力掰动与强屈曲，防止骨折' });
  if (has(['骨折'])) rules.push({ tag: '骨折史', points: 6, advice: '确认骨折愈合情况，愈合期遵医嘱训练' });
  if (has(['椎间盘', '突出'])) rules.push({ tag: '椎间盘突出', points: 8, advice: '急性期慎牵引重手法，警惕马尾综合征' });
  if (has(['放射痛', '麻木'])) rules.push({ tag: '神经刺激征象', points: 12, advice: '出现放射痛/麻木提示神经根刺激，操作中加重须立即停止' });
  if (has(['产后', '顺产', '剖宫产'])) rules.push({ tag: '产后', points: 4, advice: '产后训练须确认复查通过，循序渐进' });

  // 5) 禁忌（明确“禁/忌/不可”）
  if (has(['禁', '忌'])) {
    rules.push({ tag: '存在明确禁忌', points: 15, advice: '评估表含明确禁忌条款，技师必须逐条阅读并在服务中规避' });
  }

  // 6) 多药联用
  const meds = input.medications || '';
  if (meds.split(/[、,，;；]/).filter((s) => s.trim().length > 0).length >= 2) {
    rules.push({ tag: '多重用药', points: 4, advice: '多重用药需关注相互作用与当日服药情况' });
  }

  // 7) 上门条件：高楼层无电梯
  if (input.floorNo && input.floorNo >= 4 && input.hasElevator === false) {
    rules.push({ tag: '高楼层无电梯', points: 6, advice: '器械搬运与老人出行有风险，建议家属楼下接应、轻装上门' });
  }

  const score = rules.reduce((s, r) => s + r.points, 0);
  const level: RiskResult['level'] = score >= 65 ? 'high' : score >= 35 ? 'medium' : 'low';
  const blocked = level === 'high';
  const advice = blocked
    ? '【高风险·商业派单前须复核】' + rules.map((r) => r.advice).join('；')
    : rules.map((r) => r.advice).join('；') || '未发现明显风险，可按标准流程服务';

  return {
    score,
    level,
    blocked,
    tags: rules.map((r) => r.tag),
    advice,
    rules,
  };
}
