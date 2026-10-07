-- ============================================================
-- 城市社区上门理疗预约评估疗程结算平台 - 初始化 schema
-- 核心模型：service_records 为「同一条健康服务记录」，
-- 评估 / 派单 / 上门 / 疗程 / 异常 / 随访 / 结算 / 复诊建议 全部挂在该记录下
-- ============================================================

-- ---------- 用户 ----------
create table if not exists users (
  id           bigserial primary key,
  name         text not null,
  phone        text not null unique,
  password     text not null,
  gender       text check (gender in ('男','女')),
  birth_date   date,
  created_at   timestamptz not null default now()
);

-- ---------- 技师（康复师 / 理疗师） ----------
create table if not exists therapists (
  id          bigserial primary key,
  name        text not null,
  phone       text not null unique,
  password    text not null,
  title       text not null check (title in ('康复师','理疗师')),
  years_exp   int  not null default 0,
  bio         text,
  rating      numeric(2,1) not null default 5.0,
  status      text not null default 'active' check (status in ('active','leave','disabled')),
  created_at  timestamptz not null default now()
);

-- ---------- 服务类型 ----------
create table if not exists service_types (
  id                 bigserial primary key,
  code               text not null unique,
  name               text not null,
  category           text not null check (category in ('颈肩腰腿痛理疗','术后康复','产后修复','老人关节训练')),
  description        text,
  base_price         numeric(10,2) not null,
  duration_min       int not null default 60,
  risk_base          int not null default 0,           -- 该类服务固有风险分
  required_equipment text[] not null default '{}'      -- 常规所需器械名称
);

-- ---------- 技师擅长服务 ----------
create table if not exists therapist_skills (
  therapist_id     bigint not null references therapists(id) on delete cascade,
  service_type_id  bigint not null references service_types(id) on delete cascade,
  primary key (therapist_id, service_type_id)
);

-- ---------- 器械台账 ----------
create table if not exists equipment (
  id         bigserial primary key,
  name       text not null,
  spec       text,
  status     text not null default 'available' check (status in ('available','defect','repairing')),
  note       text,
  created_at timestamptz not null default now()
);

-- ---------- 健康服务记录（一条记录贯穿全流程） ----------
create table if not exists service_records (
  id                    bigserial primary key,
  record_no             text not null unique,
  user_id               bigint not null references users(id),
  service_type_id       bigint not null references service_types(id),
  course_id             bigint,
  -- assessing: 评估中; risk_blocked: 高风险禁止派单; pending_accept: 待接单;
  -- accepted: 已接单; in_service: 服务中; completed: 服务完成;
  -- settled: 已结算; refunded: 已退款; rejected: 技师/平台不适合上门; cancelled: 已取消
  status                text not null default 'assessing'
    check (status in ('assessing','risk_blocked','pending_accept','accepted','in_service',
                      'completed','settled','refunded','rejected','cancelled')),
  address               text,
  floor_no              int,
  has_elevator          boolean,
  family_present        boolean,
  family_contact        text,
  appointment_start     timestamptz,
  appointment_end       timestamptz,
  assigned_therapist_id bigint references therapists(id),
  accepted_at           timestamptz,
  rejected_reason       text,
  checked_in_at         timestamptz,
  checked_out_at        timestamptz,
  cancel_reason         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_records_user on service_records(user_id);
create index if not exists idx_records_therapist on service_records(assigned_therapist_id);
create index if not exists idx_records_status on service_records(status);

-- ---------- 上门前评估（每记录一份） ----------
create table if not exists assessments (
  id               bigserial primary key,
  record_id        bigint not null unique references service_records(id) on delete cascade,
  pain_sites       text[] not null default '{}',
  pain_level       int check (pain_level between 0 and 10),
  onset            text,                                  -- 起病情况
  history          text,                                  -- 既往病史
  imaging_report   text,                                  -- 影像报告
  medications      text,                                  -- 当前用药
  contraindications text,                                 -- 禁忌
  allergies        text,
  available_times  text,                                  -- 可服务时间（自然语言/JSON 字符串）
  notes            text,
  risk_score       int not null default 0,
  risk_level       text not null check (risk_level in ('low','medium','high')),
  risk_tags        text[] not null default '{}',
  risk_advice      text,
  created_at       timestamptz not null default now()
);

-- ---------- 疗程包 ----------
create table if not exists courses (
  id                  bigserial primary key,
  course_no           text not null unique,
  user_id             bigint not null references users(id),
  service_type_id     bigint not null references service_types(id),
  total_sessions      int not null,
  used_sessions       int not null default 0,
  package_price       numeric(10,2) not null,            -- 疗程包总价
  per_session_price   numeric(10,2) not null,            -- 单次折算价（结算用）
  insurance_no        text,                              -- 医保号
  subsidy_rate        numeric(4,2) not null default 0,   -- 社区补贴比例 0~1
  status              text not null default 'active' check (status in ('active','completed','terminated')),
  doctor_advice       text,
  created_at          timestamptz not null default now()
);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_records_course') then
    alter table service_records add constraint fk_records_course
      foreign key (course_id) references courses(id) on delete set null;
  end if;
end$$;

-- ---------- 派单 / 接单 / 拒单日志 ----------
create table if not exists dispatch_logs (
  id           bigserial primary key,
  record_id    bigint not null references service_records(id) on delete cascade,
  therapist_id bigint references therapists(id),
  action       text not null check (action in ('suggest','assign','accept','reject','reassign')),
  reason       text,
  operator_id  bigint,                                   -- 管理员操作人（assign/reassign）
  created_at   timestamptz not null default now()
);
create index if not exists idx_dispatch_record on dispatch_logs(record_id);

-- ---------- 到场服务报告 ----------
create table if not exists service_reports (
  id                bigserial primary key,
  record_id         bigint not null unique references service_records(id) on delete cascade,
  pain_before       int check (pain_before between 0 and 10),
  pain_after        int check (pain_after between 0 and 10),
  motion_limitation jsonb not null default '[]'::jsonb,  -- [{action:'前屈',level:'中度受限'}]
  vital_signs       jsonb not null default '{}'::jsonb,  -- {bp:'135/85',hr:78,spo2:97,temp:36.6}
  items_actual      jsonb not null default '[]'::jsonb,  -- [{name:'关节松动',minutes:30,price:120}]
  equipment_used    jsonb not null default '[]'::jsonb,  -- [{id:1,name:'中频电疗仪',note:''}]
  intensity         int check (intensity between 1 and 10), -- 手法强度
  user_feedback     text,
  adverse_reaction  text,                                -- 理疗中不适
  duration_min      int,
  created_at        timestamptz not null default now()
);

-- ---------- 异常事件 ----------
create table if not exists incidents (
  id              bigserial primary key,
  record_id       bigint not null references service_records(id) on delete cascade,
  type            text not null check (type in (
                    '临时加项','服务不适','家属不满','技师迟到','器械故障',
                    '医保结算失败','补贴结算失败','退款申请','转诊建议')),
  severity        text not null check (severity in ('low','medium','high')),
  description     text not null,
  status          text not null default 'reported' check (status in ('reported','processing','resolved','closed')),
  handler_id      bigint,
  resolution      text,
  quality_related boolean,                               -- 管理端判定：是否与服务质量有关
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);
create index if not exists idx_incidents_record on incidents(record_id);
create index if not exists idx_incidents_therapist_join on incidents(record_id);

-- ---------- 随访 ----------
create table if not exists follow_ups (
  id             bigserial primary key,
  record_id      bigint not null references service_records(id) on delete cascade,
  therapist_id   bigint references therapists(id),
  channel        text check (channel in ('电话','微信','上门')),
  pain_score     int check (pain_score between 0 and 10),
  recovery_note  text,
  adverse_flag   boolean not null default false,
  next_advice    text,
  created_at     timestamptz not null default now()
);

-- ---------- 结算 ----------
create table if not exists settlements (
  id               bigserial primary key,
  record_id        bigint not null unique references service_records(id) on delete cascade,
  course_id        bigint references courses(id),
  base_amount      numeric(10,2) not null default 0,    -- 疗程单次折算价
  items_amount     numeric(10,2) not null default 0,    -- 实际加项金额
  total_amount     numeric(10,2) not null default 0,
  insurance_amount numeric(10,2) not null default 0,
  subsidy_amount   numeric(10,2) not null default 0,
  self_pay_amount  numeric(10,2) not null default 0,
  insurance_status text not null default 'none' check (insurance_status in ('none','pending','success','failed','manual_success')),
  subsidy_status   text not null default 'none' check (subsidy_status in ('none','pending','success','failed','manual_success')),
  pay_status       text not null default 'unpaid' check (pay_status in ('unpaid','paid','refunded')),
  fail_reason      text,
  settled_at       timestamptz,
  created_at       timestamptz not null default now()
);

-- ---------- 退款 ----------
create table if not exists refunds (
  id               bigserial primary key,
  record_id        bigint not null unique references service_records(id) on delete cascade,
  amount           numeric(10,2) not null,
  reason           text not null,
  status           text not null default 'requested' check (status in ('requested','approved','rejected','refunded')),
  quality_related  boolean,                              -- 管理端判定：退款是否与服务质量有关
  admin_note       text,
  decided_by       bigint,
  decided_at       timestamptz,
  created_at       timestamptz not null default now()
);

-- ---------- 复诊 / 转诊 / 是否继续建议 ----------
create table if not exists revisit_recommendations (
  id                  bigserial primary key,
  record_id           bigint not null references service_records(id) on delete cascade,
  therapist_id        bigint references therapists(id),
  decision            text not null check (decision in ('continue','pause','terminate','referral')),
  reason              text,
  suggested_type_id   bigint references service_types(id),
  suggested_sessions  int,
  referral_hospital   text,
  referral_department text,
  created_at          timestamptz not null default now()
);

-- ---------- 管理端账号 ----------
create table if not exists admins (
  id         bigserial primary key,
  name       text not null,
  username   text not null unique,
  password   text not null,
  created_at timestamptz not null default now()
);
