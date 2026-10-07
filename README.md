# 社区上门理疗预约评估疗程结算平台

面向城市社区的上门理疗服务平台：用户预约颈肩腰腿痛理疗、术后康复、产后修复、老人关节训练，平台把**评估、派单、上门、疗程、异常、随访、结算、复诊建议**聚合在同一条健康服务记录里，坚持**健康风险优先于商业疗程**。

## 技术栈

- **前端**：Vue 3 + Vite + Element Plus + Pinia + ECharts（用户端 / 技师端 / 管理端三角色）
- **后端**：NestJS + TypeORM + JWT + Swagger（`/api/docs`）
- **数据库**：PostgreSQL 16（Docker）/ 15+（本地）

## 一键启动（Docker Compose）

```bash
docker compose up --build
```

启动后访问：

| 入口 | 地址 |
| --- | --- |
| 平台前端 | http://localhost:8080 |
| 后端 API | http://localhost:3000/api |
| Swagger 文档 | http://localhost:3000/api/docs |

首次启动自动建表并写入种子数据（测试账号 + 8 个服务项目 + 3 条演示业务记录）。

## 本地开发

```bash
# 1. 准备 PostgreSQL（也可用 docker run -p 5432:5432 -e POSTGRES_USER=physio \
#    -e POSTGRES_PASSWORD=physio123 -e POSTGRES_DB=physio postgres:16）
#    建库：create user physio password 'physio123'; create database physio owner physio;

# 2. 后端（默认读 .env.example 同值的环境变量，可用 DB_HOST 等覆盖）
cd backend && npm install && npm run build && npm start   # http://localhost:3000/api

# 3. 前端（vite 已配置 /api 代理到 3000）
cd frontend && npm install && npm run dev                 # http://localhost:5173
```

## 测试账号

| 角色 | 手机号 | 密码 | 说明 |
| --- | --- | --- | --- |
| 管理员 | 13800000001 | admin123 | 运营看板 / 派单 / 异常处理 / 退款审批 |
| 技师·王康复 | 13800000002 | 123456 | 术后康复、颈肩腰腿痛 |
| 技师·李理疗 | 13800000003 | 123456 | 老人关节、慢性疼痛 |
| 技师·赵产后 | 13800000004 | 123456 | 产后修复（有待接订单） |
| 用户·张阿姨 | 13800000010 | 123456 | 68 岁，高血压标签，有医保+社区补贴 |
| 用户·刘先生 | 13800000011 | 123456 | 术后康复，有医保 |
| 用户·陈女士 | 13800000012 | 123456 | 产后修复，纯自费 |

## 本题验证方式

### 自动化冒烟测试（已实际执行：43 项全部通过）

后端运行状态下执行：

```bash
cd backend && node scripts/smoke.mjs
```

覆盖：注册登录与权限拦截、健康档案、风险评估（单禁忌→HIGH/双禁忌→CRITICAL 不宜上门）、派单→拒单→重新派单→接单、签到（迟到自动生成异常）、服务记录（疼痛评分/生命体征/器械/手法强度）、服务中临时加项（自动登记异常）、结算（医保/补贴失败→自费兜底）、退款申请与审批、家属不满异常处理闭环、随访、转诊建议、按技师/类目/异常类型统计、管理端过滤查询。

### 手工验证路径

1. **用户端**：陈女士登录 → 服务预约 → 选项目下单（可看风险评估弹窗）→ 我的服务记录 → 进入详情看「评估/派单/上门/异常/随访/结算/转诊」同一时间线；结算时可勾选「模拟通道异常」演示医保/补贴结算失败 → 改自费；已支付后可申请退款。
2. **技师端**：赵产后登录 → 待接订单（查看风险边界：风险点、手法强度上限、所需器械）→ 接单 → 我的订单 → 进入服务 → 到场签到 → 填写疼痛评分/生命体征/器械/手法强度 → 可临时加项 → 完成服务生成结算单；服务完成后可登记随访与转诊建议。
3. **管理端**：admin 登录 → 运营看板（技师维度异常率/退款/疼痛改善、类目异常率、异常类型分布）→ 服务记录（按状态/技师/类目/异常过滤、派单）→ 异常处理（处理家属不满、退款外的各类异常）→ 结算退款（审批退款）。

## 关键设计

- **同一条健康服务记录**：`service_records` 为脊柱，评估（risk_assessments）、派单（dispatches）、上门（visits）、异常（exception_events）、随访（follow_ups）、结算（settlements）、转诊（referrals）、疗程（courses）全部挂在同一记录上，详情页即完整时间线。
- **健康风险优先**：预约即触发规则引擎（禁忌标签冲突、年龄、疼痛评分、病史关键词、楼层电梯），输出风险等级/风险点/手法强度上限/所需器械/是否适合上门；双禁忌冲突直接判定 CRITICAL 不建议上门，技师端在风险边界内选择手法强度。
- **效果非线性**：疼痛评分逐次记录，看板展示平均疼痛改善（允许为负）并与异常率、退款关联，辅助判断异常和退款是否与服务质量有关。
- **异常即数据**：迟到（签到超时自动）、加项（自动）、结算失败（自动）、不适/家属不满/器械故障/退款/转诊（人工上报）统一入 `exception_events`，驱动管理端派单优化。

## 目录结构

```
├── docker-compose.yml      # 一键启动：postgres + backend + frontend
├── backend/                # NestJS 后端
│   ├── src/entities/       # 14 张表实体（含枚举）
│   ├── src/modules/        # auth/users/catalog/records/exceptions/settlements/stats
│   ├── src/seed/           # 首启种子数据（含演示业务流）
│   └── scripts/smoke.mjs   # 端到端冒烟测试（43 项断言）
└── frontend/               # Vue 3 前端
    ├── src/views/user/     # 用户端
    ├── src/views/therapist/# 技师端
    ├── src/views/admin/    # 管理端
    └── src/views/shared/   # 记录详情（三角色共用）
```

## 说明

- 演示环境使用 TypeORM `synchronize` 自动建表，生产应改为迁移；JWT 密钥等请通过环境变量覆盖。
- 医保/社区补贴为模拟通道：有医保账号可抵扣 60%（封顶 ¥200），社区补贴抵扣余额 30%（封顶 ¥100）；支付时勾选「模拟通道异常」可演示结算失败→异常登记→自费兜底流程。
