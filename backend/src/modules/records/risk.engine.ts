import { HealthProfile, RiskLevel, ServiceItem, ServiceRecord } from '../../entities';

/** 平台统一禁忌标签词表（健康档案与服务项目共用） */
export const CONTRAINDICATION_TAGS = [
  '高血压未控制',
  '心脏病/起搏器',
  '骨质疏松',
  '急性损伤期',
  '皮肤破损/感染',
  '出血倾向',
  '孕期',
  '恶性肿瘤',
  '发热/急性感染',
  '深静脉血栓',
];

const HISTORY_KEYWORDS = ['骨折', '肿瘤', '心梗', '脑卒中', '血栓', '植入', '癫痫'];

const LEVEL_ORDER: RiskLevel[] = [
  RiskLevel.LOW,
  RiskLevel.MEDIUM,
  RiskLevel.HIGH,
  RiskLevel.CRITICAL,
];

export interface RiskFlag {
  flag: string;
  level: RiskLevel;
  detail: string;
}

export interface RiskResult {
  riskLevel: RiskLevel;
  homeVisitSuitable: boolean;
  riskFlags: RiskFlag[];
  requiredEquipment: string[];
  maxIntensity: string;
  suggestions: string;
}

function maxLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  return LEVEL_ORDER.indexOf(a) >= LEVEL_ORDER.indexOf(b) ? a : b;
}

/**
 * 规则引擎：根据健康档案 + 预约信息 + 所选项目生成风险评估。
 * 健康风险优先于商业疗程：禁忌冲突直接抬高等级，严重时判定不适合上门。
 */
export function evaluateRisk(
  profile: HealthProfile | null,
  record: Pick<ServiceRecord, 'painScoreInitial' | 'floor' | 'hasElevator'>,
  items: ServiceItem[],
): RiskResult {
  const flags: RiskFlag[] = [];
  const userTags: string[] = profile?.contraindicationTags || [];

  // 1. 禁忌冲突（用户禁忌标签 ∩ 项目禁忌标签）
  const conflicts: string[] = [];
  for (const item of items) {
    for (const tag of item.contraindicationTags || []) {
      if (userTags.includes(tag)) conflicts.push(`${tag}（${item.name}）`);
    }
  }
  for (const c of conflicts) {
    flags.push({ flag: '禁忌冲突', level: RiskLevel.HIGH, detail: `用户禁忌与服务项目冲突：${c}` });
  }

  // 2. 年龄
  const age = profile?.age;
  if (age != null && age >= 85) {
    flags.push({ flag: '超高龄', level: RiskLevel.HIGH, detail: `年龄 ${age} 岁，≥85 岁属超高龄，需家属陪同并降低强度` });
  } else if (age != null && age >= 70) {
    flags.push({ flag: '高龄', level: RiskLevel.MEDIUM, detail: `年龄 ${age} 岁，≥70 岁建议家属陪同` });
  }

  // 3. 疼痛评分
  if ((record.painScoreInitial ?? 0) >= 8) {
    flags.push({
      flag: '疼痛评分高',
      level: RiskLevel.MEDIUM,
      detail: `预约疼痛评分 ${record.painScoreInitial}/10，建议先明确诊断再安排手法`,
    });
  }

  // 4. 既往病史关键词
  const history = `${profile?.medicalHistory || ''} ${profile?.imagingReports || ''}`;
  for (const kw of HISTORY_KEYWORDS) {
    if (history.includes(kw)) {
      flags.push({ flag: '病史风险', level: RiskLevel.MEDIUM, detail: `既往病史/影像报告含「${kw}」，操作时需规避相关部位` });
    }
  }

  // 5. 项目基础风险
  const maxBaseRisk = Math.max(...items.map((i) => i.baseRisk || 1), 1);
  if (maxBaseRisk >= 3) {
    flags.push({ flag: '高风险项目', level: RiskLevel.MEDIUM, detail: '所选项目本身属高风险操作，需资深技师执行' });
  }

  // 6. 居家环境
  if (!record.hasElevator && (record.floor ?? 1) >= 5) {
    flags.push({ flag: '搬运困难', level: RiskLevel.LOW, detail: `无电梯 ${record.floor} 楼，大型器械搬运困难，建议精简器械` });
  }

  // 汇总等级
  let level = RiskLevel.LOW;
  for (const f of flags) level = maxLevel(level, f.level);
  if (conflicts.length >= 2) level = RiskLevel.CRITICAL;

  const homeVisitSuitable = level !== RiskLevel.CRITICAL;
  const maxIntensity =
    level === RiskLevel.CRITICAL
      ? '不建议上门'
      : level === RiskLevel.HIGH
        ? '轻柔'
        : level === RiskLevel.MEDIUM
          ? '中等'
          : '常规';

  const requiredEquipment = [...new Set(items.flatMap((i) => i.requiredEquipment || []))];

  const suggestions: string[] = [];
  if (!homeVisitSuitable) {
    suggestions.push('存在多项禁忌冲突，不建议上门服务，建议用户先到医疗机构评估。');
  }
  if (conflicts.length === 1) {
    suggestions.push('存在单项禁忌冲突，上门前需与用户确认当前禁忌状态，必要时改约或转诊。');
  }
  if (level === RiskLevel.HIGH) {
    suggestions.push('高风险用户：手法强度不超过「轻柔」，全程监测生命体征，需家属在场。');
  } else if (level === RiskLevel.MEDIUM) {
    suggestions.push('中风险用户：手法强度不超过「中等」，服务前后各测一次生命体征。');
  } else {
    suggestions.push('低风险用户：可按常规流程服务。');
  }
  if (requiredEquipment.length) {
    suggestions.push(`上门需携带器械：${requiredEquipment.join('、')}。`);
  }
  suggestions.push('理疗效果并非每次线性改善，如出现疼痛加重或不适，应立即停止并记录异常。');

  return {
    riskLevel: level,
    homeVisitSuitable,
    riskFlags: flags,
    requiredEquipment,
    maxIntensity,
    suggestions: suggestions.join('\n'),
  };
}
