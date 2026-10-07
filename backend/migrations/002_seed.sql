-- ============================================================
-- 种子数据（幂等：on conflict do nothing，可重复执行）
-- 覆盖：四类服务、三端账号、高/中/低风险评估、
--       临时加项/不适/家属不满/迟到/器械故障/医保失败/退款/转诊 等异常链路
-- ============================================================

-- ---------- 账号（密码明文仅用于演示，登录接口直接比对） ----------
insert into users (id, name, phone, password, gender, birth_date) values
  (1, '张桂芳', '13800000001', 'user123', '女', '1958-03-12'),
  (2, '李建国', '13800000002', 'user123', '男', '1985-07-22'),
  (3, '王晓婷', '13800000003', 'user123', '女', '1993-11-05'),
  (4, '陈秀兰', '13800000004', 'user123', '女', '1949-01-30'),
  (5, '赵敏',   '13800000005', 'user123', '女', '1990-09-18')
on conflict do nothing;
select setval(pg_get_serial_sequence('users','id'), (select max(id) from users));

insert into therapists (id, name, phone, password, title, years_exp, bio, rating, status) values
  (1, '刘康复', '13900000001', 'ther123', '康复师', 12, '擅长术后关节功能重建与老年康复训练', 4.9, 'active'),
  (2, '周理疗', '13900000002', 'ther123', '理疗师', 7,  '擅长颈肩腰腿痛手法理疗与中频电疗',     4.6, 'active'),
  (3, '孙产后', '13900000003', 'ther123', '康复师', 5,  '产后盆底与腹直肌修复专项',             4.8, 'active'),
  (4, '吴新手', '13900000004', 'ther123', '理疗师', 1,  '刚入职，擅长放松按摩',                 3.9, 'active')
on conflict do nothing;
select setval(pg_get_serial_sequence('therapists','id'), (select max(id) from therapists));

insert into admins (id, name, username, password) values
  (1, '平台调度员', 'admin', 'admin123')
on conflict do nothing;
select setval(pg_get_serial_sequence('admins','id'), (select max(id) from admins));

-- ---------- 服务类型 ----------
insert into service_types (id, code, name, category, description, base_price, duration_min, risk_base, required_equipment) values
  (1, 'NECK_SHOULDER',  '颈肩舒缓理疗',  '颈肩腰腿痛理疗', '手法松解 + 中频电疗，缓解颈肩肌肉紧张', 199.00, 60,  5, '{"中频电疗仪","按摩油"}'),
  (2, 'LUMBAR',         '腰椎疼痛理疗',  '颈肩腰腿痛理疗', '腰椎牵引与腰肌松解，禁忌需现场复核',     259.00, 75,  10,'{"腰椎牵引器","TDP神灯"}'),
  (3, 'POST_OP_KNEE',   '膝关节术后康复','术后康复',       '关节活动度训练 + 肌力训练',             329.00, 90,  12,'{"关节训练器","弹力带","冰敷袋"}'),
  (4, 'POSTPARTUM',     '产后盆底修复',  '产后修复',       '盆底肌评估与训练、腹直肌分离修复',       299.00, 60,  6, '{"盆底肌训练仪","瑜伽垫"}'),
  (5, 'ELDER_JOINT',    '老人关节训练',  '老人关节训练',   '适老化关节活动与平衡训练，家属可陪同',   159.00, 60,  15,'{"平衡训练垫","弹力带"}')
on conflict do nothing;
select setval(pg_get_serial_sequence('service_types','id'), (select max(id) from service_types));

insert into therapist_skills (therapist_id, service_type_id) values
  (1,3),(1,5),(1,2),
  (2,1),(2,2),
  (3,4),
  (4,1)
on conflict do nothing;

-- ---------- 器械 ----------
insert into equipment (id, name, spec, status, note) values
  (1, '中频电疗仪',   'FK-100',  'available', null),
  (2, '腰椎牵引器',   'QY-08',   'available', null),
  (3, 'TDP神灯',      'TDP-220', 'defect',    '加热不稳，已报修，禁止外带'),
  (4, '关节训练器',   'CPM-II',  'available', null),
  (5, '弹力带',       '通用',    'available', null),
  (6, '冰敷袋',       '医用',    'available', null),
  (7, '盆底肌训练仪', 'PD-300',  'available', null),
  (8, '平衡训练垫',   '适老款',  'available', null)
on conflict do nothing;
select setval(pg_get_serial_sequence('equipment','id'), (select max(id) from equipment));

-- ---------- 疗程包 ----------
insert into courses (id, course_no, user_id, service_type_id, total_sessions, used_sessions,
                     package_price, per_session_price, insurance_no, subsidy_rate, status, doctor_advice) values
  (1, 'C20260901001', 1, 5, 10, 2, 1280.00, 128.00, 'YB11010519580312', 0.20, 'active',
   '骨关节炎 II 期，医生建议每周 2 次低强度关节训练，避免暴力掰动'),
  (2, 'C20260905002', 3, 4, 8,  0, 2160.00, 270.00, null, 0.10, 'active',
   '顺产 42 天后，腹直肌分离 2 指'),
  (3, 'C20260820003', 2, 3, 12, 6, 3480.00, 290.00, 'YB11010519850722', 0.15, 'active',
   'ACL 重建术后第 8 周，可进阶抗阻训练')
on conflict do nothing;
select setval(pg_get_serial_sequence('courses','id'), (select max(id) from courses));

-- ---------- 服务记录 1：老人关节训练 · 已完成 · 技师迟到 + 家属不满 + 医保失败手工重传 + 随访建议继续 ----------
insert into service_records (id, record_no, user_id, service_type_id, course_id, status,
  address, floor_no, has_elevator, family_present, family_contact,
  appointment_start, appointment_end, assigned_therapist_id, accepted_at, checked_in_at, checked_out_at)
values (1, 'R20261001001', 1, 5, 1, 'settled',
  '幸福里社区 3 号楼 601', 6, true, true, '女儿 张女士 13700001111',
  '2026-10-01 09:00+08','2026-10-01 10:00+08', 1,
  '2026-09-29 14:20+08','2026-10-01 09:32+08','2026-10-01 10:25+08')
on conflict do nothing;

insert into assessments (record_id, pain_sites, pain_level, onset, history, imaging_report, medications,
  contraindications, allergies, available_times, notes, risk_score, risk_level, risk_tags, risk_advice)
values (1, array['右膝','腰部'], 6, '右膝疼痛 3 个月，上下楼加重',
  '高血压 10 年（规律服药）、双膝骨关节炎 II 期、2025 年腰椎压缩性骨折保守治疗',
  '2026-07 右膝 X 光：关节间隙变窄，骨赘形成',
  '苯磺酸氨氯地平 5mg/日',
  '严重骨质疏松禁暴力掰动；血压未控制时暂缓训练',
  '青霉素过敏',
  '周二、周四上午；周末需提前一天约',
  '老人独自在家时间多，女儿要求到场观看',
  58, 'high', array['高龄','高血压','严重骨质疏松史','疼痛≥6'],
  '高风险但非禁忌：仅允许低强度关节活动，手法强度 ≤4，训练前测血压；若收缩压≥160 立即停止并转诊')
on conflict do nothing;

insert into dispatch_logs (record_id, therapist_id, action, reason, operator_id) values
  (1, 1, 'suggest', '系统：擅长老人关节训练，评分最高', null),
  (1, 1, 'assign', '管理员派单', 1),
  (1, 1, 'accept', '已查看风险评估与器械清单，确认可上门', null)
on conflict do nothing;

insert into service_reports (record_id, pain_before, pain_after, motion_limitation, vital_signs,
  items_actual, equipment_used, intensity, user_feedback, adverse_reaction, duration_min)
values (1, 6, 5,
  '[{"action":"下蹲","level":"中度受限"},{"action":"右膝屈伸","level":"轻度受限"}]',
  '{"bp":"148/90","hr":82,"spo2":97,"temp":36.5}',
  '[{"name":"老人关节训练（疗程单次）","minutes":50,"price":128}]',
  '[{"id":8,"name":"平衡训练垫","note":"正常"},{"id":5,"name":"弹力带","note":"轻度抗阻"}]',
  3, '老人觉得比上次轻松一点；女儿认为迟到 32 分钟且效果不明显，不满意',
  null, 53)
on conflict do nothing;

insert into incidents (record_id, type, severity, description, status, resolution, quality_related, created_at, resolved_at) values
  (1, '技师迟到', 'medium', '约定 09:00 到场，实际 09:32 签到，迟到 32 分钟（社区门口施工绕行）',
  'closed', '技师电话提前告知，平台补偿 500 积分并提醒合理留足路程时间', true,
  '2026-10-01 09:35+08','2026-10-01 11:00+08'),
  (1, '家属不满', 'medium', '家属认为训练后疼痛仅下降 1 分，质疑疗程效果，要求解释',
  'resolved', '康复师出示评估依据与 X 光报告，说明骨关节炎 II 期改善非线性，前 3 次以适应为主，第 4 次起逐步加量',
  true, '2026-10-01 10:30+08','2026-10-02 10:00+08'),
  (1, '医保结算失败', 'medium', '医保实时结算接口返回「参保地目录匹配超时」，自动重试 2 次仍失败',
  'resolved', '平台挂账，次日医保系统恢复后手工重传成功，自费部分不变',
  false, '2026-10-01 10:40+08','2026-10-02 09:20+08')
on conflict do nothing;

insert into follow_ups (record_id, therapist_id, channel, pain_score, recovery_note, adverse_flag, next_advice, created_at)
values (1, 1, '电话', 5, '训练后 24 小时右膝轻度酸胀，属正常反应；热敷后缓解', false,
  '按疗程继续，下周维持低强度，关注血压', '2026-10-03 15:00+08')
on conflict do nothing;

insert into settlements (record_id, course_id, base_amount, items_amount, total_amount,
  insurance_amount, subsidy_amount, self_pay_amount, insurance_status, subsidy_status, pay_status, fail_reason, settled_at)
values (1, 1, 128.00, 0, 128.00, 76.80, 10.24, 40.96, 'manual_success', 'success', 'paid',
  '医保接口超时，2026-10-02 手工重传成功', '2026-10-02 09:20+08')
on conflict do nothing;

insert into revisit_recommendations (record_id, therapist_id, decision, reason, suggested_type_id, suggested_sessions)
values (1, 1, 'continue', '骨关节炎改善非线性，当前处于适应期，疼痛与活动度均无恶化，建议按疗程继续', 5, 8)
on conflict do nothing;

-- ---------- 服务记录 2：腰椎理疗 · 服务中不适 + 临时加项 + 转诊建议（暂停疗程） ----------
insert into service_records (id, record_no, user_id, service_type_id, status,
  address, floor_no, has_elevator, family_present, family_contact,
  appointment_start, appointment_end, assigned_therapist_id, accepted_at, checked_in_at, checked_out_at)
values (2, 'R20261003002', 2, 2, 'completed',
  '建设小区 12 号楼 202', 2, false, false, null,
  '2026-10-03 19:00+08','2026-10-03 20:30+08', 2,
  '2026-10-02 20:00+08','2026-10-03 19:05+08','2026-10-03 20:10+08')
on conflict do nothing;

insert into assessments (record_id, pain_sites, pain_level, onset, history, imaging_report, medications,
  contraindications, allergies, available_times, notes, risk_score, risk_level, risk_tags, risk_advice)
values (2, array['下腰部','左小腿外侧'], 7, '腰痛 2 周，3 天前搬重物后加重并伴左腿放射痛',
  '腰椎间盘突出史 3 年',
  '2026-09-20 MRI：L4/L5 椎间盘左后突出，硬膜囊受压',
  '无',
  '马尾综合征征象（大小便障碍/会阴麻木）禁止牵引并立即转诊；放射痛急性期慎用重手法',
  '无',
  '工作日 19:00 后', null,
  62, 'high', array['疼痛≥6','神经根放射痛','急性期'],
  '高风险：本次以轻柔手法 + 观察为主，禁止腰椎牵引；出现麻木加重或会阴麻木立即停止并转诊骨科')
on conflict do nothing;

insert into dispatch_logs (record_id, therapist_id, action, reason, operator_id) values
  (2, 2, 'suggest', '系统：颈肩腰腿痛类匹配，但风险提示牵引禁忌', null),
  (2, 2, 'assign', '管理员派单', 1),
  (2, 2, 'accept', '已知悉禁止牵引，TDP 神灯故障不带，采用手法替代', null)
on conflict do nothing;

insert into service_reports (record_id, pain_before, pain_after, motion_limitation, vital_signs,
  items_actual, equipment_used, intensity, user_feedback, adverse_reaction, duration_min)
values (2, 7, 7,
  '[{"action":"直腿抬高","level":"重度受限（左侧40°）"},{"action":"前屈","level":"中度受限"}]',
  '{"bp":"128/80","hr":76,"spo2":98,"temp":36.6}',
  '[{"name":"腰部轻柔松解","minutes":35,"price":159},{"name":"拔罐放松（用户现场要求增加）","minutes":15,"price":60}]',
  '[{"id":2,"name":"腰椎牵引器","note":"按风险提示未使用"}]',
  4, '用户理解转诊建议，同意先去骨科复查',
  '松解到左臀中点时左小腿放射痛一过性加重、伴发麻，立即停止该手法，休息 10 分钟后麻木缓解', 50)
on conflict do nothing;

insert into incidents (record_id, type, severity, description, status, resolution, quality_related, created_at, resolved_at) values
  (2, '服务不适', 'high', '手法刺激左臀中点诱发左小腿放射痛加重伴麻木，立即停止操作',
  'resolved', '立即停止、休息观察 15 分钟麻木缓解；记录生命体征并建议骨科复查',
  false, '2026-10-03 19:40+08','2026-10-03 20:15+08'),
  (2, '临时加项', 'low', '用户现场要求增加拔罐放松，已告知价格 60 元并取得口头确认',
  'closed', '加项已计入本次结算', false, '2026-10-03 19:50+08','2026-10-03 20:10+08'),
  (2, '器械故障', 'low', '常规所需 TDP 神灯当前故障报修，本次未携带，以手法替代',
  'closed', '已在接单确认中说明；设备维修完成前调度系统对该器械标记不可用',
  false, '2026-10-02 20:05+08','2026-10-03 20:10+08')
on conflict do nothing;

insert into settlements (record_id, base_amount, items_amount, total_amount,
  insurance_amount, subsidy_amount, self_pay_amount, insurance_status, subsidy_status, pay_status, settled_at)
values (2, 259.00, 60.00, 319.00, 0, 0, 319.00, 'none', 'none', 'paid', '2026-10-03 20:10+08')
on conflict do nothing;

insert into revisit_recommendations (record_id, therapist_id, decision, reason, referral_hospital, referral_department)
values (2, 2, 'referral', '急性期神经根刺激征明显，MRI 提示突出压迫，理疗不宜继续，建议骨科评估是否需要进一步影像复查或干预',
  '市第一人民医院', '骨科（脊柱外科）')
on conflict do nothing;

-- ---------- 服务记录 3：产后修复 · 服务完成 + 补贴结算失败重试成功 ----------
insert into service_records (id, record_no, user_id, service_type_id, course_id, status,
  address, floor_no, has_elevator, family_present, family_contact,
  appointment_start, appointment_end, assigned_therapist_id, accepted_at, checked_in_at, checked_out_at)
values (3, 'R20261005003', 3, 4, 2, 'settled',
  '悦湖花园 7 栋 1502', 15, true, false, null,
  '2026-10-05 14:00+08','2026-10-05 15:00+08', 3,
  '2026-10-04 10:00+08','2026-10-05 14:02+08','2026-10-05 14:58+08')
on conflict do nothing;

insert into assessments (record_id, pain_sites, pain_level, onset, history, imaging_report, medications,
  contraindications, allergies, available_times, notes, risk_score, risk_level, risk_tags, risk_advice)
values (3, array['腰骶部','下腹部'], 3, '产后腰背酸胀、漏尿',
  '顺产 42 天后；腹直肌分离 2 指',
  '产后 42 天复查超声：盆底肌 I 类肌纤维疲劳度 -9%',
  '无', '恶露未净禁阴道内电极训练；会阴伤口未愈合禁训练', '无',
  '工作日下午', null,
  30, 'low', array['产后 42 天+'],
  '低风险：可按标准方案进行盆底训练，强度循序渐进')
on conflict do nothing;

insert into dispatch_logs (record_id, therapist_id, action, reason, operator_id) values
  (3, 3, 'suggest', '系统：产后修复专项匹配', null),
  (3, 3, 'assign', '管理员派单', 1),
  (3, 3, 'accept', '已确认产后复查报告齐全，可上门', null)
on conflict do nothing;

insert into service_reports (record_id, pain_before, pain_after, motion_limitation, vital_signs,
  items_actual, equipment_used, intensity, user_feedback, adverse_reaction, duration_min)
values (3, 3, 2, '[]', '{"bp":"112/72","hr":74,"spo2":99,"temp":36.6}',
  '[{"name":"产后盆底修复（疗程首次）","minutes":55,"price":270}]',
  '[{"id":7,"name":"盆底肌训练仪","note":"正常"},{"id":5,"name":"弹力带","note":"核心激活"}]',
  3, '第一次训练，动作找到了发力感', null, 56)
on conflict do nothing;

insert into incidents (record_id, type, severity, description, status, resolution, quality_related, created_at, resolved_at)
values (3, '补贴结算失败', 'low', '社区优生优育补贴接口首次返回「批次未生效」',
  'resolved', '系统 5 分钟后自动重试成功，补贴 27 元到账', false,
  '2026-10-05 15:05+08','2026-10-05 15:10+08')
on conflict do nothing;

insert into follow_ups (record_id, therapist_id, channel, pain_score, recovery_note, adverse_flag, next_advice, created_at)
values (3, 3, '微信', 2, '居家凯格尔训练每日 2 组，无不适', false, '按疗程每周 2 次', '2026-10-07 10:00+08')
on conflict do nothing;

insert into settlements (record_id, course_id, base_amount, items_amount, total_amount,
  insurance_amount, subsidy_amount, self_pay_amount, insurance_status, subsidy_status, pay_status, fail_reason, settled_at)
values (3, 2, 270.00, 0, 270.00, 0, 27.00, 243.00, 'none', 'success', 'paid',
  '补贴批次未生效，自动重试成功', '2026-10-05 15:10+08')
on conflict do nothing;

insert into revisit_recommendations (record_id, therapist_id, decision, reason, suggested_type_id, suggested_sessions)
values (3, 3, 'continue', '首次训练反馈良好，按疗程推进', 4, 7)
on conflict do nothing;

-- ---------- 服务记录 4：颈肩理疗 · 已退款（新手技师服务质量问题） ----------
insert into service_records (id, record_no, user_id, service_type_id, status,
  address, floor_no, has_elevator, family_present, family_contact,
  appointment_start, appointment_end, assigned_therapist_id, accepted_at, checked_in_at, checked_out_at)
values (4, 'R20260928004', 5, 1, 'refunded',
  '和平家园 2 号楼 302', 3, false, false, null,
  '2026-09-28 10:00+08','2026-09-28 11:00+08', 4,
  '2026-09-27 16:00+08','2026-09-28 10:10+08','2026-09-28 10:55+08')
on conflict do nothing;

insert into assessments (record_id, pain_sites, pain_level, onset, history, imaging_report, medications,
  contraindications, allergies, available_times, notes, risk_score, risk_level, risk_tags, risk_advice)
values (4, array['颈部','右肩'], 4, '长期伏案，颈肩酸胀 1 个月',
  '无特殊', '无', '无', '颈椎不稳慎扳法', '无', '工作日上午', null,
  22, 'low', '{}', '低风险：放松为主，禁用颈椎扳法')
on conflict do nothing;

insert into dispatch_logs (record_id, therapist_id, action, reason, operator_id) values
  (4, 4, 'assign', '当时在线技师不足，管理员派给新入职技师', 1),
  (4, 4, 'accept', '可上门', null)
on conflict do nothing;

insert into service_reports (record_id, pain_before, pain_after, motion_limitation, vital_signs,
  items_actual, equipment_used, intensity, user_feedback, adverse_reaction, duration_min)
values (4, 4, 6, '[]', '{"bp":"118/76","hr":80,"spo2":98,"temp":36.6}',
  '[{"name":"颈肩舒缓理疗","minutes":40,"price":199}]',
  '[{"id":1,"name":"中频电疗仪","note":"电极片接触不良，仅使用 5 分钟"}]',
  7, '用户反馈手法过重，结束后颈部疼痛加重、转头受限，要求退款',
  '手法强度 7，超出用户耐受，结束后颈部疼痛加重', 45)
on conflict do nothing;

insert into incidents (record_id, type, severity, description, status, resolution, quality_related, created_at, resolved_at)
values (4, '退款申请', 'high', '用户称服务后颈部疼痛加重，质疑新手技师手法过重，申请全额退款',
  'closed', '管理端复核：服务报告强度 7 超出建议，且电极片接触不良未更换，判定与服务质量有关，全额退款 199 元，技师停单复训',
  true, '2026-09-28 13:00+08','2026-09-29 17:00+08')
on conflict do nothing;

insert into settlements (record_id, base_amount, items_amount, total_amount,
  insurance_amount, subsidy_amount, self_pay_amount, insurance_status, subsidy_status, pay_status, settled_at)
values (4, 199.00, 0, 199.00, 0, 0, 199.00, 'none', 'none', 'refunded', '2026-09-29 17:00+08')
on conflict do nothing;

insert into refunds (record_id, amount, reason, status, quality_related, admin_note, decided_by, decided_at)
values (4, 199.00, '服务后疼痛加重，怀疑手法不当', 'refunded', true,
  '强度 7 超出低风险建议上限；设备接触不良未处理。全额退款，技师吴新手暂停接单并安排复训',
  1, '2026-09-29 17:00+08')
on conflict do nothing;

insert into revisit_recommendations (record_id, therapist_id, decision, reason)
values (4, 1, 'pause', '本次服务后症状加重，暂停该疗程，建议症状缓解后由资深技师重新评估')
on conflict do nothing;

-- ---------- 服务记录 5：待接单（管理端派单优化演示） ----------
insert into service_records (id, record_no, user_id, service_type_id, status,
  address, floor_no, has_elevator, family_present, family_contact,
  appointment_start, appointment_end, assigned_therapist_id)
values (5, 'R20261008005', 4, 5, 'pending_accept',
  '康宁苑 9 号楼 401', 4, false, true, '儿子 陈先生 13700002222',
  '2026-10-08 09:30+08','2026-10-08 10:30+08', null)
on conflict do nothing;

insert into assessments (record_id, pain_sites, pain_level, onset, history, imaging_report, medications,
  contraindications, allergies, available_times, notes, risk_score, risk_level, risk_tags, risk_advice)
values (5, array['双髋','双膝关节'], 5, '关节僵硬半年，晨起明显',
  '冠心病（支架术后 2 年）、糖尿病、双膝骨关节炎',
  '2026-06 双髋 X 光：退行性改变',
  '阿司匹林 100mg/日、二甲双胍',
  '血压血糖未控制时暂缓；避免长时间无电梯登高',
  '无', '每日上午，需家属陪同', '4 楼无电梯，家属将下楼接应',
  71, 'high', array['高龄','冠心病支架术后','糖尿病','多重用药','无电梯'],
  '高风险但非禁忌：须由资深康复师接单；携带适老器械；到场先测血压血糖，准备硝酸甘油应急联系信息，强度 ≤3')
on conflict do nothing;

select setval(pg_get_serial_sequence('service_records','id'), (select max(id) from service_records));
