<template>
  <div class="record-detail" v-loading="loading">
    <template v-if="rec">
      <!-- 顶部概要 -->
      <el-page-header @back="$router.back()" class="back">
        <template #content>
          <span class="record-no">{{ rec.record_no }}</span>
          <el-tag :type="STATUS_MAP[rec.status]?.type" effect="dark" size="small">{{ STATUS_MAP[rec.status]?.label }}</el-tag>
          <el-tag v-if="rec.assessment" :type="RISK_MAP[rec.assessment.risk_level]?.type" size="small">
            风险 {{ rec.assessment.risk_score }} 分 · {{ RISK_MAP[rec.assessment.risk_level]?.label }}
          </el-tag>
        </template>
      </el-page-header>

      <el-row :gutter="14" class="summary-cards">
        <el-col :span="6"><el-card shadow="never"><div class="sc-label">服务项目</div><div class="sc-value">{{ rec.service_name }}</div><div class="sc-sub">{{ rec.category }}</div></el-card></el-col>
        <el-col :span="6"><el-card shadow="never"><div class="sc-label">预约时间</div><div class="sc-value-sm">{{ dt(rec.appointment_start) }}</div></el-card></el-col>
        <el-col :span="6"><el-card shadow="never"><div class="sc-label">服务技师</div><div class="sc-value">{{ fmt(rec.therapist_name || '待派单') }}</div><div class="sc-sub">{{ rec.therapist_title || '' }}</div></el-card></el-col>
        <el-col :span="6"><el-card shadow="never"><div class="sc-label">上门地址</div><div class="sc-value-sm">{{ rec.address }}</div><div class="sc-sub">{{ rec.floor_no ? rec.floor_no + ' 楼' : '' }}{{ rec.has_elevator === true ? ' · 有电梯' : rec.has_elevator === false ? ' · 无电梯' : '' }}{{ rec.family_present ? ' · 家属陪同' : '' }}</div></el-card></el-col>
      </el-row>

      <!-- 角色操作条 -->
      <el-card shadow="never" class="action-bar">
        <template v-if="role === 'therapist'">
          <template v-if="rec.status === 'pending_accept' && (!rec.assigned_therapist_id || rec.assigned_therapist_id === auth.user.id)">
            <el-button type="primary" @click="doAccept">已阅读风险边界与禁忌，确认适合上门（接单）</el-button>
            <el-button type="danger" plain @click="rejectDlg = true">评估后不适合上门（拒单）</el-button>
          </template>
          <el-button v-if="rec.status === 'accepted'" type="success" size="large" @click="doCheckin"><el-icon><position /></el-icon> 到场签到</el-button>
          <template v-if="rec.status === 'in_service'">
            <el-button type="primary" @click="openReport">提交到场服务报告并结算</el-button>
            <el-button @click="incidentDlg = true">上报异常</el-button>
          </template>
          <template v-if="['completed','settled','refunded'].includes(rec.status)">
            <el-button @click="followDlg = true">记录随访</el-button>
            <el-button @click="revisitDlg = true">填写复诊/继续/转诊建议</el-button>
          </template>
        </template>
        <template v-if="role === 'user'">
          <el-button v-if="['completed','settled'].includes(rec.status) && !rec.refund" type="warning" @click="refundDlg = true">申请退款</el-button>
          <el-button v-if="['assessing','risk_blocked','pending_accept'].includes(rec.status)" plain @click="doCancel">取消预约</el-button>
          <el-tag type="info" effect="plain">本页展示本次服务的全部依据：评估 → 派单 → 现场报告 → 随访 → 结算 → 复诊建议</el-tag>
        </template>
        <template v-if="role === 'admin'">
          <el-tag type="danger" effect="plain">风控/派单/异常处理/结算重试/退款审批请在对应管理页操作；本页呈现完整服务记录</el-tag>
        </template>
      </el-card>

      <el-row :gutter="14">
        <el-col :span="14">
          <!-- 上门前评估：用户看依据，技师看风险边界 -->
          <el-card shadow="never" class="block">
            <template #header><div class="block-title">上门前健康风险评估（{{ role === 'therapist' ? '技师风险边界' : '服务依据' }}）</div></template>
            <div v-if="rec.assessment">
              <el-alert :title="rec.assessment.risk_advice" :type="RISK_MAP[rec.assessment.risk_level]?.type" :closable="false" show-icon class="risk-alert" />
              <div class="tags">
                <el-tag v-for="t in rec.assessment.risk_tags" :key="t" type="danger" size="small" effect="plain" class="rtag">{{ t }}</el-tag>
              </div>
              <el-descriptions :column="2" border size="small" class="desc">
                <el-descriptions-item label="疼痛部位">{{ (rec.assessment.pain_sites || []).join('、') || '—' }}</el-descriptions-item>
                <el-descriptions-item label="疼痛评分">{{ rec.assessment.pain_level ?? '—' }} / 10</el-descriptions-item>
                <el-descriptions-item label="起病情况" :span="2">{{ fmt(rec.assessment.onset) }}</el-descriptions-item>
                <el-descriptions-item label="既往病史" :span="2">{{ fmt(rec.assessment.history) }}</el-descriptions-item>
                <el-descriptions-item label="影像报告" :span="2">{{ fmt(rec.assessment.imaging_report) }}</el-descriptions-item>
                <el-descriptions-item label="当前用药" :span="2">{{ fmt(rec.assessment.medications) }}</el-descriptions-item>
                <el-descriptions-item label="禁忌（红线）" :span="2"><span class="danger-text">{{ fmt(rec.assessment.contraindications) }}</span></el-descriptions-item>
                <el-descriptions-item label="过敏史">{{ fmt(rec.assessment.allergies) }}</el-descriptions-item>
                <el-descriptions-item label="可服务时间">{{ fmt(rec.assessment.available_times) }}</el-descriptions-item>
                <el-descriptions-item label="家属/备注" :span="2">{{ fmt(rec.family_contact) }} {{ rec.assessment.notes ? '；' + rec.assessment.notes : '' }}</el-descriptions-item>
              </el-descriptions>
            </div>
          </el-card>

          <!-- 现场服务报告 -->
          <el-card shadow="never" class="block" v-for="rpt in rec.reports" :key="rpt.id">
            <template #header><div class="block-title">到场服务报告 · {{ dt(rpt.created_at) }}</div></template>
            <el-row :gutter="10" class="pain-row">
              <el-col :span="6"><div class="pain-box"><div class="pb-label">服务前疼痛</div><div class="pb-score">{{ rpt.pain_before }}</div></div></el-col>
              <el-col :span="6"><div class="pain-box"><div class="pb-label">服务后疼痛</div><div class="pb-score" :class="rpt.pain_after > rpt.pain_before ? 'worse' : 'better'">{{ rpt.pain_after }}</div></div></el-col>
              <el-col :span="6"><div class="pain-box"><div class="pb-label">手法强度</div><div class="pb-score">{{ rpt.intensity }}<span class="pb-max">/10</span></div></div></el-col>
              <el-col :span="6"><div class="pain-box"><div class="pb-label">时长(分)</div><div class="pb-score">{{ rpt.duration_min }}</div></div></el-col>
            </el-row>
            <el-alert v-if="rpt.adverse_reaction" type="error" :closable="false" show-icon title="理疗中出现不适" :description="rpt.adverse_reaction" class="risk-alert" />
            <el-descriptions :column="2" border size="small" class="desc">
              <el-descriptions-item label="生命体征" :span="2">血压 {{ rpt.vital_signs?.bp || '—' }} ｜ 心率 {{ rpt.vital_signs?.hr || '—' }} ｜ 血氧 {{ rpt.vital_signs?.spo2 || '—' }} ｜ 体温 {{ rpt.vital_signs?.temp || '—' }}</el-descriptions-item>
              <el-descriptions-item label="动作受限" :span="2">
                <el-tag v-for="m in rpt.motion_limitation" :key="m.action" size="small" class="rtag">{{ m.action }}：{{ m.level }}</el-tag>
                <span v-if="!rpt.motion_limitation?.length">—</span>
              </el-descriptions-item>
              <el-descriptions-item label="实际服务项目" :span="2">
                <div v-for="it in rpt.items_actual" :key="it.name">{{ it.name }} · {{ it.minutes }} 分钟 · {{ money(it.price) }}</div>
              </el-descriptions-item>
              <el-descriptions-item label="器械使用" :span="2">
                <div v-for="e in rpt.equipment_used" :key="e.name">{{ e.name }}<span v-if="e.note">（{{ e.note }}）</span></div>
                <span v-if="!rpt.equipment_used?.length">—</span>
              </el-descriptions-item>
              <el-descriptions-item label="用户反馈" :span="2">{{ fmt(rpt.user_feedback) }}</el-descriptions-item>
            </el-descriptions>
          </el-card>

          <!-- 异常列表 -->
          <el-card shadow="never" class="block">
            <template #header><div class="block-title">异常事件（{{ rec.incidents.length }}）</div></template>
            <el-empty v-if="!rec.incidents.length" description="无异常" :image-size="60" />
            <el-timeline v-else>
              <el-timeline-item v-for="i in rec.incidents" :key="i.id" :type="i.severity === 'high' ? 'danger' : i.severity === 'medium' ? 'warning' : 'info'" :timestamp="dt(i.created_at)">
                <div class="inc-title">
                  <strong>{{ i.type }}</strong>
                  <el-tag size="small" :type="i.status === 'closed' ? 'success' : i.status === 'resolved' ? 'primary' : 'danger'">{{ { reported: '待处理', processing: '处理中', resolved: '已处理', closed: '已关闭' }[i.status] }}</el-tag>
                  <el-tag size="small" :type="i.quality_related === true ? 'danger' : i.quality_related === false ? 'success' : 'info'">
                    {{ i.quality_related === true ? '与服务质量有关' : i.quality_related === false ? '与服务质量无关' : '质量关联待判定' }}
                  </el-tag>
                </div>
                <div class="inc-desc">{{ i.description }}</div>
                <div v-if="i.resolution" class="inc-resolution">处理结论：{{ i.resolution }}</div>
              </el-timeline-item>
            </el-timeline>
          </el-card>
        </el-col>

        <el-col :span="10">
          <!-- 疗程 -->
          <el-card v-if="rec.course" shadow="never" class="block">
            <template #header><div class="block-title">疗程包 {{ rec.course.course_no }}</div></template>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="项目">{{ rec.course.service_type_name }}</el-descriptions-item>
              <el-descriptions-item label="进度">{{ rec.course.used_sessions }} / {{ rec.course.total_sessions }} 次
                <el-progress :percentage="Math.round(rec.course.used_sessions / rec.course.total_sessions * 100)" :stroke-width="8" class="cprog" />
              </el-descriptions-item>
              <el-descriptions-item label="单次折算价">{{ money(rec.course.per_session_price) }}</el-descriptions-item>
              <el-descriptions-item label="医保号">{{ fmt(rec.course.insurance_no) }}</el-descriptions-item>
              <el-descriptions-item label="社区补贴比例">{{ (rec.course.subsidy_rate * 100).toFixed(0) }}%</el-descriptions-item>
              <el-descriptions-item label="医生建议">{{ fmt(rec.course.doctor_advice) }}</el-descriptions-item>
            </el-descriptions>
          </el-card>

          <!-- 结算 -->
          <el-card shadow="never" class="block">
            <template #header><div class="block-title">结算单</div></template>
            <div v-if="!rec.settlement" class="muted">服务完成后生成结算单</div>
            <div v-else>
              <el-descriptions :column="1" border size="small">
                <el-descriptions-item label="疗程折算 / 基础费用">{{ money(rec.settlement.base_amount) }}</el-descriptions-item>
                <el-descriptions-item label="临时加项费用">{{ money(rec.settlement.items_amount) }}</el-descriptions-item>
                <el-descriptions-item label="合计"><strong>{{ money(rec.settlement.total_amount) }}</strong></el-descriptions-item>
                <el-descriptions-item label="医保支付"><span :class="rec.settlement.insurance_status === 'failed' ? 'danger-text' : ''">{{ money(rec.settlement.insurance_amount) }}（{{ statusText(rec.settlement.insurance_status) }}）</span></el-descriptions-item>
                <el-descriptions-item label="社区补贴"><span :class="rec.settlement.subsidy_status === 'failed' ? 'danger-text' : ''">{{ money(rec.settlement.subsidy_amount) }}（{{ statusText(rec.settlement.subsidy_status) }}）</span></el-descriptions-item>
                <el-descriptions-item label="用户自费"><strong class="self-pay">{{ money(rec.settlement.self_pay_amount) }}</strong></el-descriptions-item>
              </el-descriptions>
              <el-alert v-if="rec.settlement.fail_reason" type="warning" :closable="false" show-icon :title="rec.settlement.fail_reason" class="risk-alert" />
            </div>
          </el-card>

          <!-- 退款 -->
          <el-card v-if="rec.refund" shadow="never" class="block">
            <template #header><div class="block-title">退款 {{ money(rec.refund.amount) }}</div></template>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="状态">{{ { requested: '待审批', approved: '已批准', rejected: '已驳回', refunded: '已退款' }[rec.refund.status] }}</el-descriptions-item>
              <el-descriptions-item label="申请原因">{{ rec.refund.reason }}</el-descriptions-item>
              <el-descriptions-item label="质量关联">
                <el-tag :type="rec.refund.quality_related ? 'danger' : 'success'" size="small">{{ rec.refund.quality_related ? '与服务质量有关（影响技师派单评分）' : '与服务质量无关' }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="审批说明">{{ fmt(rec.refund.admin_note) }}</el-descriptions-item>
            </el-descriptions>
          </el-card>

          <!-- 复诊建议 -->
          <el-card v-if="rec.recommendation" shadow="never" class="block">
            <template #header><div class="block-title">复诊 / 是否继续建议</div></template>
            <el-tag :type="DECISION_MAP[rec.recommendation.decision]?.type" effect="dark">{{ DECISION_MAP[rec.recommendation.decision]?.label }}</el-tag>
            <p class="reco-reason">{{ rec.recommendation.reason }}</p>
            <div v-if="rec.recommendation.referral_hospital" class="referral">转诊：{{ rec.recommendation.referral_hospital }} · {{ rec.recommendation.referral_department }}</div>
            <div v-if="rec.recommendation.suggested_sessions" class="referral">建议再做 {{ rec.recommendation.suggested_sessions }} 次（{{ rec.recommendation.suggested_type_name }}）</div>
          </el-card>

          <!-- 随访 -->
          <el-card shadow="never" class="block">
            <template #header><div class="block-title">随访记录（{{ rec.follow_ups.length }}）</div></template>
            <el-empty v-if="!rec.follow_ups.length" description="暂无随访" :image-size="50" />
            <div v-for="f in rec.follow_ups" :key="f.id" class="follow-item">
              <div class="f-head">{{ dt(f.created_at) }} · {{ f.channel }} · {{ f.therapist_name }}
                <el-tag size="small" :type="f.adverse_flag ? 'danger' : 'success'">{{ f.adverse_flag ? '有不良反应' : '无不良反应' }}</el-tag>
              </div>
              <div class="f-body">疼痛 {{ f.pain_score ?? '—' }} / 10 ｜ {{ f.recovery_note }}<span v-if="f.next_advice"> ｜ 建议：{{ f.next_advice }}</span></div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 全流程时间线 -->
      <el-card shadow="never" class="block">
        <template #header><div class="block-title">同一条健康服务记录 · 全流程时间线（{{ rec.timeline.length }} 个节点）</div></template>
        <el-timeline>
          <el-timeline-item v-for="(e, idx) in rec.timeline" :key="idx" :color="STAGE_STYLE[e.stage] || '#999'" :timestamp="dt(e.at)">
            <div class="tl">
              <el-tag size="small" :color="STAGE_STYLE[e.stage]" effect="dark" class="stage-tag">{{ e.stage }}</el-tag>
              <span :class="{ alert: e.alert, adverse: e.adverse }">{{ e.title }}</span>
            </div>
            <div v-if="e.detail" class="tl-detail">{{ e.detail }}</div>
          </el-timeline-item>
        </el-timeline>
      </el-card>
    </template>

    <!-- ===== 技师操作弹窗 ===== -->
    <el-dialog v-model="rejectDlg" title="拒单原因" width="460px">
      <el-input v-model="rejectReason" type="textarea" :rows="3" placeholder="如：禁忌超出本人执业范围 / 器械无法保障 / 时间冲突" />
      <template #footer><el-button @click="rejectDlg = false">取消</el-button><el-button type="danger" @click="doReject">确认拒单</el-button></template>
    </el-dialog>

    <el-dialog v-model="reportDlg" title="到场服务报告（提交后自动生成结算单）" width="720px">
      <el-form label-width="110px">
        <el-row :gutter="10">
          <el-col :span="8"><el-form-item label="服务前疼痛"><el-input-number v-model="report.pain_before" :min="0" :max="10" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="服务后疼痛"><el-input-number v-model="report.pain_after" :min="0" :max="10" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="手法强度"><el-input-number v-model="report.intensity" :min="1" :max="10" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="血压/心率/血氧/体温">
          <el-input v-model="report.bp" placeholder="135/85" style="width:120px" />
          <el-input v-model="report.hr" placeholder="78" style="width:90px;margin:0 8px" />
          <el-input v-model="report.spo2" placeholder="97" style="width:90px" />
          <el-input v-model="report.temp" placeholder="36.6" style="width:100px;margin-left:8px" />
        </el-form-item>
        <el-form-item label="动作受限"><el-input v-model="report.motionText" placeholder="如：下蹲-中度受限；直腿抬高-重度受限" style="width:100%" /></el-form-item>
        <el-form-item label="实际项目(JSON)"><el-input v-model="report.itemsJson" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="器械使用(JSON)"><el-input v-model="report.equipJson" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="服务时长(分)"><el-input-number v-model="report.duration_min" :min="1" :max="300" /></el-form-item>
        <el-form-item label="用户反馈"><el-input v-model="report.user_feedback" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="理疗中不适"><el-input v-model="report.adverse_reaction" type="textarea" :rows="2" placeholder="留空表示无不适；填写后将自动登记高优先级异常" /></el-form-item>
        <el-form-item label="临时加项说明"><el-input v-model="report.add_item_note" type="textarea" :rows="2" placeholder="如：用户现场要求增加拔罐 60 元，已告知价格" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="reportDlg = false">取消</el-button><el-button type="primary" @click="doReport">提交报告并结算</el-button></template>
    </el-dialog>

    <el-dialog v-model="incidentDlg" title="上报异常" width="520px">
      <el-form label-width="90px">
        <el-form-item label="异常类型"><el-select v-model="incident.type"><el-option v-for="t in INCIDENT_TYPES" :key="t" :label="t" :value="t" /></el-select></el-form-item>
        <el-form-item label="严重程度"><el-radio-group v-model="incident.severity"><el-radio-button label="low">低</el-radio-button><el-radio-button label="medium">中</el-radio-button><el-radio-button label="high">高</el-radio-button></el-radio-group></el-form-item>
        <el-form-item label="情况描述"><el-input v-model="incident.description" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="incidentDlg = false">取消</el-button><el-button type="danger" @click="doIncident">提交异常</el-button></template>
    </el-dialog>

    <el-dialog v-model="followDlg" title="记录随访" width="520px">
      <el-form label-width="90px">
        <el-form-item label="随访方式"><el-radio-group v-model="follow.channel"><el-radio-button label="电话">电话</el-radio-button><el-radio-button label="微信">微信</el-radio-button><el-radio-button label="上门">上门</el-radio-button></el-radio-group></el-form-item>
        <el-form-item label="疼痛评分"><el-input-number v-model="follow.pain_score" :min="0" :max="10" /></el-form-item>
        <el-form-item label="恢复情况"><el-input v-model="follow.recovery_note" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="不良反应"><el-switch v-model="follow.adverse_flag" /></el-form-item>
        <el-form-item label="下一步建议"><el-input v-model="follow.next_advice" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="followDlg = false">取消</el-button><el-button type="primary" @click="doFollow">提交随访</el-button></template>
    </el-dialog>

    <el-dialog v-model="revisitDlg" title="复诊 / 是否继续 / 转诊建议" width="560px">
      <el-form label-width="100px">
        <el-form-item label="建议"><el-radio-group v-model="revisit.decision"><el-radio-button label="continue">继续</el-radio-button><el-radio-button label="pause">暂停</el-radio-button><el-radio-button label="terminate">终止</el-radio-button><el-radio-button label="referral">转诊</el-radio-button></el-radio-group></el-form-item>
        <el-form-item label="判断理由"><el-input v-model="revisit.reason" type="textarea" :rows="3" placeholder="结合疼痛变化、禁忌、家属期待与本人能力判断；改善并非每次线性" /></el-form-item>
        <template v-if="revisit.decision === 'referral'">
          <el-form-item label="转诊医院"><el-input v-model="revisit.referral_hospital" /></el-form-item>
          <el-form-item label="转诊科室"><el-input v-model="revisit.referral_department" /></el-form-item>
        </template>
        <template v-if="revisit.decision === 'continue'">
          <el-form-item label="建议次数"><el-input-number v-model="revisit.suggested_sessions" :min="1" :max="20" /></el-form-item>
        </template>
      </el-form>
      <template #footer><el-button @click="revisitDlg = false">取消</el-button><el-button type="primary" @click="doRevisit">提交建议</el-button></template>
    </el-dialog>

    <!-- 用户退款弹窗 -->
    <el-dialog v-model="refundDlg" title="申请退款" width="480px">
      <el-form label-width="90px">
        <el-form-item label="退款金额"><el-input-number v-model="refundAmount" :min="1" :max="Number(rec.settlement?.total_amount || 0)" :precision="2" /></el-form-item>
        <el-form-item label="退款原因"><el-input v-model="refundReason" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="refundDlg = false">取消</el-button><el-button type="warning" @click="doRefund">提交申请</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../api';
import { useAuthStore } from '../stores/auth';
import { STATUS_MAP, RISK_MAP, STAGE_STYLE, INCIDENT_TYPES, DECISION_MAP, fmt, money, dt } from '../constants';

const route = useRoute();
const auth = useAuthStore();
const role = computed(() => auth.user.role);
const loading = ref(false);
const rec = ref(null);

async function load() {
  loading.value = true;
  try {
    rec.value = await api.get(`/records/${route.params.id}`);
  } finally { loading.value = false; }
}
onMounted(load);

const statusText = (s) => ({ none: '无', pending: '处理中', success: '成功', failed: '失败', manual_success: '手工重传成功', unpaid: '未支付', paid: '已支付', refunded: '已退款' }[s] || s);

// ---- 技师操作 ----
async function doAccept() {
  await api.post(`/records/${rec.value.id}/accept`);
  ElMessage.success('接单成功：请严格遵守风险边界与禁忌条款');
  load();
}
const rejectDlg = ref(false);
const rejectReason = ref('');
async function doReject() {
  await api.post(`/records/${rec.value.id}/reject`, { reason: rejectReason.value || '技师评估后认为不适合上门' });
  ElMessage.success('已拒单，记录回到平台调度');
  rejectDlg.value = false;
  load();
}
async function doCheckin() {
  await api.post(`/records/${rec.value.id}/checkin`);
  ElMessage.success('签到成功，请先复核生命体征与疼痛情况');
  load();
}
const reportDlg = ref(false);
const report = reactive({ pain_before: 5, pain_after: 4, intensity: 4, bp: '', hr: '', spo2: '', temp: '', motionText: '', itemsJson: '[]', equipJson: '[]', duration_min: 60, user_feedback: '', adverse_reaction: '', add_item_note: '' });
function openReport() {
  // 预填基础服务项目（疗程单由后端按折算价结算，这里仅记录名称/时长）
  const baseItem = { name: rec.value.service_name, minutes: rec.value.duration_min || 60, price: Number(rec.value.base_price || 0), included: true };
  report.itemsJson = JSON.stringify([baseItem]);
  report.equipJson = JSON.stringify((rec.value.required_equipment || []).map((name) => ({ name, note: '' })));
  report.intensity = rec.value.assessment?.risk_level === 'high' ? Math.min(report.intensity || 4, 4) : report.intensity || 5;
  reportDlg.value = true;
}
async function doReport() {
  const parseArr = (s) => { try { return JSON.parse(s || '[]'); } catch { ElMessage.error('JSON 格式错误'); throw new Error('json'); } };
  const items = parseArr(report.itemsJson);
  const equipment = parseArr(report.equipJson);
  const motion = report.motionText.split(/[；;\n]/).filter(Boolean).map((p) => { const [action, level] = p.split(/[-—]/); return { action: action?.trim(), level: level?.trim() || '' }; });
  await api.post(`/records/${rec.value.id}/report`, {
    pain_before: report.pain_before, pain_after: report.pain_after, intensity: report.intensity,
    motion_limitation: motion,
    vital_signs: { bp: report.bp, hr: Number(report.hr) || null, spo2: Number(report.spo2) || null, temp: Number(report.temp) || null },
    items_actual: items, equipment_used: equipment, duration_min: report.duration_min,
    user_feedback: report.user_feedback, adverse_reaction: report.adverse_reaction, add_item_note: report.add_item_note,
  });
  ElMessage.success('报告已提交，结算单已生成');
  reportDlg.value = false;
  load();
}
const incidentDlg = ref(false);
const incident = reactive({ type: '技师迟到', severity: 'medium', description: '' });
async function doIncident() {
  if (!incident.description) return ElMessage.warning('请描述异常情况');
  await api.post(`/records/${rec.value.id}/incident`, { ...incident });
  ElMessage.success('异常已上报管理端');
  incidentDlg.value = false;
  load();
}
const followDlg = ref(false);
const follow = reactive({ channel: '电话', pain_score: 4, recovery_note: '', adverse_flag: false, next_advice: '' });
async function doFollow() {
  await api.post(`/records/${rec.value.id}/followup`, { ...follow });
  ElMessage.success('随访已记录');
  followDlg.value = false;
  load();
}
const revisitDlg = ref(false);
const revisit = reactive({ decision: 'continue', reason: '', suggested_sessions: 6, referral_hospital: '', referral_department: '' });
async function doRevisit() {
  if (!revisit.reason) return ElMessage.warning('请填写判断理由');
  await api.post(`/records/${rec.value.id}/revisit`, { ...revisit });
  ElMessage.success('复诊建议已提交');
  revisitDlg.value = false;
  load();
}

// ---- 用户操作 ----
const refundDlg = ref(false);
const refundAmount = ref(0);
const refundReason = ref('');
async function doRefund() {
  if (!refundReason.value) return ElMessage.warning('请填写退款原因');
  await api.post(`/records/${rec.value.id}/refund-request`, { amount: refundAmount.value, reason: refundReason.value });
  ElMessage.success('退款申请已提交，等待管理端审批');
  refundDlg.value = false;
  load();
}
async function doCancel() {
  await ElMessageBox.confirm('确认取消该预约？', '提示', { type: 'warning' });
  await api.post(`/records/${rec.value.id}/cancel`, { reason: '用户主动取消' });
  ElMessage.success('已取消');
  load();
}
</script>

<style scoped>
.record-detail { padding-bottom: 20px; }
.back { margin-bottom: 12px; }
.record-no { font-weight: 700; margin-right: 10px; }
.summary-cards { margin-bottom: 12px; }
.sc-label { font-size: 12px; color: #99a9bf; }
.sc-value { font-size: 16px; font-weight: 600; margin: 4px 0; }
.sc-value-sm { font-size: 13px; font-weight: 600; margin: 6px 0; line-height: 1.5; }
.sc-sub { font-size: 12px; color: #8492a6; }
.action-bar { margin-bottom: 12px; display: flex; gap: 10px; align-items: center; }
.block { margin-bottom: 14px; }
.block-title { font-weight: 600; }
.risk-alert { margin: 8px 0; }
.tags { margin: 8px 0; }
.rtag { margin: 2px 6px 2px 0; }
.desc { margin-top: 8px; }
.danger-text { color: #e74c3c; font-weight: 600; }
.muted { color: #99a9bf; font-size: 13px; }
.pain-row { margin: 6px 0 10px; }
.pain-box { background: #f7f9fc; border-radius: 8px; text-align: center; padding: 10px 4px; }
.pb-label { font-size: 12px; color: #8492a6; }
.pb-score { font-size: 24px; font-weight: 700; color: #2c7be5; }
.pb-max { font-size: 13px; color: #99a9bf; }
.pb-score.worse { color: #e74c3c; }
.pb-score.better { color: #27ae60; }
.self-pay { color: #e74c3c; font-size: 15px; }
.reco-reason { margin: 8px 0; line-height: 1.6; }
.referral { font-size: 13px; color: #5e6d82; margin-top: 4px; }
.follow-item { padding: 8px 0; border-bottom: 1px dashed #e5e9f2; }
.f-head { font-size: 13px; font-weight: 600; }
.f-body { font-size: 13px; color: #5e6d82; margin-top: 4px; }
.tl { font-size: 14px; }
.stage-tag { color: #fff; border: none; margin-right: 8px; }
.tl .alert { color: #e74c3c; font-weight: 600; }
.tl .adverse { color: #e67e22; }
.tl-detail { font-size: 12px; color: #8492a6; margin-top: 2px; }
.inc-title { display: flex; gap: 8px; align-items: center; }
.inc-desc { font-size: 13px; margin: 4px 0; }
.inc-resolution { font-size: 12px; color: #27ae60; }
.cprog { margin-left: 10px; width: 120px; }
</style>
