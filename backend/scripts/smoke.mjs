/**
 * 端到端冒烟测试：覆盖 预约→风险评估→派单→接单→签到→服务记录→加项→异常→结算→退款→随访→转诊→统计
 * 运行：node scripts/smoke.mjs  （需后端已启动，BASE_URL 默认 http://localhost:3000/api）
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api';

let passed = 0;
let failed = 0;
const ok = (cond, name, extra = '') => {
  if (cond) { passed++; console.log(`  ✔ ${name}`); }
  else { failed++; console.error(`  ✘ ${name} ${extra}`); }
};

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}

const login = async (phone, password) => (await req('POST', '/auth/login', { body: { phone, password } })).data;

async function main() {
  console.log(`\n== 冒烟测试 ${BASE} ==\n`);

  // ---------- 认证 ----------
  console.log('[认证与权限]');
  const admin = (await login('13800000001', 'admin123')).token;
  const therapist2 = (await login('13800000003', '123456')).token; // 李理疗
  const therapist3 = (await login('13800000004', '123456')).token; // 赵产后
  const user3 = (await login('13800000012', '123456')).token; // 陈女士
  ok(!!admin && !!therapist2 && !!therapist3 && !!user3, '种子账号登录');

  const badLogin = await req('POST', '/auth/login', { body: { phone: '13800000001', password: 'wrong' } });
  ok(badLogin.status === 401, '错误密码拒绝登录');

  const phone = `139${String(Date.now()).slice(-8)}`;
  const reg = await req('POST', '/auth/register', { body: { phone, password: '123456', name: '测试用户' } });
  ok(reg.status === 201 && reg.data.token, '新用户注册');
  const newUser = reg.data.token;

  const forbidden = await req('GET', '/stats/overview', { token: newUser });
  ok(forbidden.status === 403, '普通用户访问管理端统计被拒绝(403)');
  const noAuth = await req('GET', '/records/my');
  ok(noAuth.status === 401, '未登录访问受保护接口被拒绝(401)');

  // ---------- 健康档案与风险评估 ----------
  console.log('[健康档案与风险评估]');
  const items = (await req('GET', '/service-items')).data;
  ok(items.length === 8, `服务目录 8 项（实际 ${items.length}）`);
  const pain02 = items.find((i) => i.code === 'PAIN-02'); // 禁忌：心脏病/起搏器、皮肤破损/感染、恶性肿瘤
  const pain01 = items.find((i) => i.code === 'PAIN-01');

  await req('PUT', '/health-profiles/me', {
    token: newUser,
    body: { age: 72, contraindicationTags: ['心脏病/起搏器'], medicalHistory: '冠心病史', insuranceNo: 'YB0001', hasSubsidy: true },
  });

  // 单项禁忌冲突 → HIGH，仍可上门
  const rHigh = (await req('POST', '/records', {
    token: newUser,
    body: {
      serviceItemIds: [pain02.id], painParts: ['腰部'], painScoreInitial: 5,
      address: '测试地址 1 号', floor: 3, hasElevator: true,
      appointmentAt: new Date(Date.now() + 86400000).toISOString(),
    },
  })).data;
  ok(rHigh.riskAssessment?.riskLevel === 'HIGH', `单禁忌冲突评估为 HIGH（实际 ${rHigh.riskAssessment?.riskLevel}）`);
  ok(rHigh.riskAssessment?.homeVisitSuitable === true, 'HIGH 仍适合上门');
  ok(rHigh.riskAssessment?.maxIntensity === '轻柔', 'HIGH 手法强度上限为轻柔');
  ok(rHigh.riskAssessment?.requiredEquipment?.includes('中频治疗仪'), '评估汇总所需器械');

  // 两项禁忌冲突 → CRITICAL，不适合上门
  await req('PUT', '/health-profiles/me', {
    token: newUser,
    body: { contraindicationTags: ['心脏病/起搏器', '皮肤破损/感染'] },
  });
  const rCrit = (await req('POST', '/records', {
    token: newUser,
    body: {
      serviceItemIds: [pain02.id], painParts: ['腰部'], painScoreInitial: 5,
      address: '测试地址 1 号', floor: 3, hasElevator: true,
      appointmentAt: new Date(Date.now() + 86400000).toISOString(),
    },
  })).data;
  ok(rCrit.riskAssessment?.riskLevel === 'CRITICAL', `双禁忌冲突评估为 CRITICAL（实际 ${rCrit.riskAssessment?.riskLevel}）`);
  ok(rCrit.riskAssessment?.homeVisitSuitable === false, 'CRITICAL 判定不适合上门');
  await req('POST', `/records/${rCrit.id}/cancel`, { token: newUser });
  await req('POST', `/records/${rHigh.id}/cancel`, { token: newUser });

  // ---------- 主流程：派单→接单→签到→记录→加项→完成→结算→退款 ----------
  console.log('[主流程：陈女士 产后修复单]');
  // 种子数据已派单给赵产后
  const queue = (await req('GET', '/records/queue', { token: therapist3 })).data;
  ok(queue.length >= 1, '技师待接队列有单');
  const rec3 = queue[0].record;
  ok(!!rec3.riskAssessment && !!rec3.items?.length, '待接单含风险评估与项目明细');

  const reject0 = await req('POST', `/records/${rec3.id}/respond`, { token: therapist2, body: { accept: true } });
  ok(reject0.status === 400 || reject0.status === 403, '非被派单技师不能接单');

  // 拒单 → 回到待派单 → 重新派单 → 接单
  await req('POST', `/records/${rec3.id}/respond`, { token: therapist3, body: { accept: false, reason: '时间冲突' } });
  let detail = (await req('GET', `/records/${rec3.id}`, { token: admin })).data;
  ok(detail.status === 'PENDING_DISPATCH', '拒单后回到待派单');
  const therapists = (await req('GET', '/therapists', { token: admin })).data;
  const t3id = therapists.find((t) => t.name === '赵产后').id;
  await req('POST', `/records/${rec3.id}/dispatch`, { token: admin, body: { therapistId: t3id, note: '重新派单' } });
  const acc = await req('POST', `/records/${rec3.id}/respond`, { token: therapist3, body: { accept: true } });
  ok(acc.data?.recordStatus === 'ACCEPTED', '重新派单后接单成功');

  // 签到（预约时间在未来 → 不迟到）
  const visit = (await req('POST', `/records/${rec3.id}/checkin`, { token: therapist3, body: { location: '桂花苑 2 栋' } })).data;
  ok(!!visit.id, '到场签到');
  detail = (await req('GET', `/records/${rec3.id}`, { token: therapist3 })).data;
  ok(detail.status === 'IN_SERVICE', '签到后进入服务中');

  // 填写服务记录
  const up = await req('PUT', `/records/${rec3.id}/visit`, {
    token: therapist3,
    body: {
      painScore: 2, movementLimitation: '盆底肌力 2 级',
      vitals: { bp: '110/70', hr: 72 }, equipmentUsed: ['生物反馈仪'],
      techniqueIntensity: '轻柔', userFeedback: '无不适', therapistNote: '首次评估+指导',
      actualItems: [{ name: '产后盆底肌修复指导', price: 238 }],
      nextVisitSuggestion: '建议 1 周后复评',
    },
  });
  ok(up.status === 200, '填写服务记录（疼痛评分/生命体征/器械/手法强度）');

  // 服务中临时加项 → 自动登记 ADD_ITEM 异常
  const post02 = items.find((i) => i.code === 'POST-02');
  await req('POST', `/records/${rec3.id}/items`, { token: therapist3, body: { serviceItemIds: [post02.id] } });
  detail = (await req('GET', `/records/${rec3.id}`, { token: therapist3 })).data;
  ok(detail.items.some((i) => i.addedDuringVisit), '临时加项已入明细');
  ok(detail.exceptions.some((e) => e.type === 'ADD_ITEM'), '加项自动登记异常事件');

  // 完成服务 → 生成结算单
  const done = (await req('POST', `/records/${rec3.id}/complete-visit`, { token: therapist3 })).data;
  ok(Math.abs(done.settlement?.totalAmount - 456) < 0.01, `结算总额=238+218=456（实际 ${done.settlement?.totalAmount}）`);
  ok(done.settlement?.selfPayAmount === done.settlement?.totalAmount, '无医保无补贴全额自付');

  // 结算：模拟医保失败 → 自费成功（陈女士无医保，改用刘先生流程已覆盖医保；这里测失败通道）
  const failPay = await req('POST', `/records/${rec3.id}/settlement/pay`, {
    token: user3, body: { channel: 'SUBSIDY', simulateFailure: true },
  });
  ok(failPay.data?.status === 'FAILED', '补贴通道结算失败');
  detail = (await req('GET', `/records/${rec3.id}`, { token: user3 })).data;
  ok(detail.exceptions.some((e) => e.type === 'SETTLEMENT_FAILED'), '结算失败自动登记异常');
  const payOk = await req('POST', `/records/${rec3.id}/settlement/pay`, { token: user3, body: { channel: 'SELF' } });
  ok(payOk.data?.status === 'PAID', '改自费结算成功');

  // 用户上报异常：家属不满
  const exc = await req('POST', `/records/${rec3.id}/exceptions`, {
    token: user3, body: { type: 'FAMILY_COMPLAINT', description: '家属认为一次服务效果不明显，要求说明疗程依据' },
  });
  ok(exc.status === 201, '用户上报家属不满异常');

  // 退款申请 → 管理端审批
  await req('POST', `/records/${rec3.id}/settlement/refund-request`, {
    token: user3, body: { reason: '对加项费用有异议', amount: 218 },
  });
  const settlements = (await req('GET', '/settlements', { token: admin })).data;
  const st3 = settlements.find((s) => s.recordId === rec3.id || s.recordNo === detail.recordNo);
  const refund = await req('POST', `/settlements/${st3.id}/refund`, {
    token: admin, body: { approve: true, resolution: '加项未充分告知，退还加项费用' },
  });
  ok(refund.data?.status === 'REFUNDED' && Number(refund.data?.refundAmount) === 218, '退款审批通过并入账');

  // 异常处理闭环
  const excList = (await req('GET', '/exceptions?status=OPEN', { token: admin })).data;
  const familyExc = excList.find((e) => e.type === 'FAMILY_COMPLAINT' && e.recordId === rec3.id);
  const handle = await req('POST', `/exceptions/${familyExc.id}/handle`, {
    token: admin, body: { status: 'RESOLVED', resolution: '已向家属说明疗程依据并部分退款' },
  });
  ok(handle.data?.status === 'RESOLVED', '管理端处理异常闭环');

  // 随访 + 转诊
  const fu = await req('POST', `/records/${rec3.id}/follow-ups`, {
    token: therapist3, body: { content: '电话随访：无不适', painScoreAfter: 2, satisfaction: 4, nextPlan: '继续疗程' },
  });
  ok(fu.status === 201, '技师登记随访');
  const ref = await req('POST', `/records/${rec3.id}/referrals`, {
    token: therapist3, body: { reason: '盆底肌力恢复缓慢', suggestedDepartment: '妇科盆底门诊', doctorAdvice: '建议门诊进一步评估' },
  });
  ok(ref.status === 201, '登记转诊建议');
  detail = (await req('GET', `/records/${rec3.id}`, { token: user3 })).data;
  ok(detail.exceptions.some((e) => e.type === 'REFERRAL_SUGGESTED'), '转诊建议同步登记异常事件');
  ok(detail.followUps.length >= 1 && detail.referrals.length >= 1 && detail.settlement?.status === 'REFUNDED',
    '同一记录聚合：评估/派单/上门/异常/随访/结算/转诊齐全');

  // ---------- 技师迟到自动异常 ----------
  console.log('[技师迟到]');
  const user2 = (await login('13800000011', '123456')).token; // 刘先生
  const surg02 = items.find((i) => i.code === 'SURG-02');
  const rLate = (await req('POST', '/records', {
    token: user2,
    body: {
      serviceItemIds: [surg02.id], painParts: ['右膝'], painScoreInitial: 3,
      address: '滨江花园 8 栋', floor: 12, hasElevator: true,
      appointmentAt: new Date(Date.now() - 3600000).toISOString(), // 1 小时前 → 必迟到
    },
  })).data;
  const t1id = therapists.find((t) => t.name === '王康复').id;
  const therapist1 = (await login('13800000002', '123456')).token;
  await req('POST', `/records/${rLate.id}/dispatch`, { token: admin, body: { therapistId: t1id } });
  await req('POST', `/records/${rLate.id}/respond`, { token: therapist1, body: { accept: true } });
  await req('POST', `/records/${rLate.id}/checkin`, { token: therapist1, body: {} });
  const lateDetail = (await req('GET', `/records/${rLate.id}`, { token: admin })).data;
  ok(lateDetail.exceptions.some((e) => e.type === 'TECH_LATE'), '迟到签到自动生成 TECH_LATE 异常');
  // 服务中不适异常（技师上报）
  await req('POST', `/records/${rLate.id}/exceptions`, {
    token: therapist1, body: { type: 'DISCOMFORT', description: '训练中用户诉头晕，已停止并休息观察' },
  });
  const lateDetail2 = (await req('GET', `/records/${rLate.id}`, { token: admin })).data;
  ok(lateDetail2.exceptions.some((e) => e.type === 'DISCOMFORT'), '理疗中不适异常上报');

  // ---------- 统计看板 ----------
  console.log('[统计看板]');
  const overview = (await req('GET', '/stats/overview', { token: admin })).data;
  ok(overview.totalRecords >= 4 && overview.totalExceptions >= 4, `总览统计（记录 ${overview.totalRecords}，异常 ${overview.totalExceptions}）`);
  const byT = (await req('GET', '/stats/by-therapist', { token: admin })).data;
  const t3stats = byT.find((t) => t.name === '赵产后');
  ok(byT.length === 3 && t3stats?.completedVisits >= 1, '按技师统计（完成量/异常率/退款）');
  ok(typeof t3stats.exceptionRate === 'number' && t3stats.refundCount >= 1, '技师维度异常率与退款关联');
  const byC = (await req('GET', '/stats/by-service-type', { token: admin })).data;
  ok(byC.length === 4 && byC.some((c) => c.recordCount > 0), '按服务类目统计');
  const byE = (await req('GET', '/stats/exceptions-by-type', { token: admin })).data;
  ok(byE.length === 9, '按异常类型统计');

  // 管理端记录过滤
  const filtered = (await req('GET', '/records?hasException=true', { token: admin })).data;
  ok(filtered.every((r) => r.exceptionCount > 0), '管理端按异常过滤记录');
  const byTherapist = (await req('GET', `/records?therapistId=${t3id}`, { token: admin })).data;
  ok(byTherapist.every((r) => r.therapist?.id === t3id), '管理端按技师过滤记录');

  // ---------- 汇总 ----------
  console.log(`\n== 结果：${passed} 通过，${failed} 失败 ==\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('冒烟测试异常：', e); process.exit(1); });
