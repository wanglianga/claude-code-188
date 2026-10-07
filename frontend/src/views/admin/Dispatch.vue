<template>
  <div>
    <el-radio-group v-model="scope" @change="load" class="scope">
      <el-radio-button label="all">全部待处理（{{ list.length }}）</el-radio-button>
      <el-radio-button label="blocked">高风险阻断待复核</el-radio-button>
    </el-radio-group>

    <el-card shadow="never" v-loading="loading">
      <el-empty v-if="!list.length" description="暂无待派单记录" />
      <el-card v-for="r in list" :key="r.id" shadow="hover" class="rec-card">
        <div class="rc-head">
          <div>
            <el-tag :type="r.status === 'risk_blocked' ? 'danger' : 'warning'" effect="dark" size="small">
              {{ r.status === 'risk_blocked' ? `风险阻断 ${r.risk_score} 分` : `待接单 ${r.risk_score} 分` }}
            </el-tag>
            <strong class="rc-name">{{ r.service_name }}</strong>
            <span class="sub">{{ r.record_no }} · {{ r.user_name }} · {{ dt(r.appointment_start) }}</span>
          </div>
          <div>
            <el-button size="small" @click="$router.push(`/admin/records/${r.id}`)">查看完整记录</el-button>
            <el-button v-if="r.status === 'risk_blocked'" type="danger" size="small" @click="openReview(r, false)">不适合服务/建议就医</el-button>
            <el-button v-if="r.status === 'risk_blocked'" type="success" size="small" @click="openReview(r, true)">风控复核放行</el-button>
            <el-button type="primary" size="small" @click="openAssign(r)">{{ r.assigned_name ? '改派技师' : '指派技师' }}</el-button>
          </div>
        </div>
        <div class="rc-tags">
          <el-tag v-for="t in r.risk_tags" :key="t" type="danger" size="small" effect="plain" class="rtag">{{ t }}</el-tag>
        </div>
        <div class="rc-advice">{{ r.risk_advice }}</div>
      </el-card>
    </el-card>

    <!-- 风控复核 -->
    <el-dialog v-model="reviewDlg" :title="reviewPass ? '风控复核放行' : '风控复核不通过'" width="560px">
      <el-alert v-if="reviewPass" type="success" :closable="false" show-icon
        title="放行后记录进入待派单，请结合下方派单评分指派资深技师并要求遵守风险提示。" class="dlg-alert" />
      <el-alert v-else type="error" :closable="false" show-icon
        title="记录将终止派单（健康风险高于商业疗程收益），平台会建议用户先线下就医。" class="dlg-alert" />
      <el-input v-model="reviewNote" type="textarea" :rows="3" :placeholder="reviewPass ? '复核意见，如：高风险非禁忌，须资深技师、强度≤3、到场先测血压' : '不通过原因，如：存在未控制的重症风险，建议先就医评估'" />
      <template #footer><el-button @click="reviewDlg = false">取消</el-button>
        <el-button :type="reviewPass ? 'success' : 'danger'" @click="doReview">确认</el-button></template>
    </el-dialog>

    <!-- 指派 + 智能评分 -->
    <el-dialog v-model="assignDlg" title="智能派单建议（按技师能力与异常率评分）" width="760px">
      <el-alert v-if="assignData?.equipment_missing?.length" type="warning" :closable="false" show-icon
        :title="`器械缺口：${assignData.equipment_missing.join('、')}（台账不可用），派单前需解决器械`" class="dlg-alert" />
      <el-table :data="assignData?.suggestions || []" highlight-current-row @row-click="(row) => chosen = row.therapist_id" max-height="380">
        <el-table-column width="55"><template #default="{ row }"><el-radio v-model="chosen" :value="row.therapist_id"><span></span></el-radio></template></el-table-column>
        <el-table-column label="技师" min-width="130">
          <template #default="{ row }"><div>{{ row.name }}</div><div class="sub">{{ row.title }} · {{ row.years_exp }} 年</div></template>
        </el-table-column>
        <el-table-column label="评分" prop="rating" width="70" />
        <el-table-column label="擅长匹配" width="90">
          <template #default="{ row }"><el-tag :type="row.skill_match ? 'success' : 'info'" size="small">{{ row.skill_match ? '匹配' : '不匹配' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="在手工单" prop="active_orders" width="80" />
        <el-table-column label="完工单" prop="finished_orders" width="70" />
        <el-table-column label="质量异常" prop="quality_incidents" width="80" />
        <el-table-column label="异常率" width="80"><template #default="{ row }">{{ row.incident_rate }}%</template></el-table-column>
        <el-table-column label="派单评分" width="100">
          <template #default="{ row }"><strong :class="row.score === assignData.suggestions[0]?.score ? 'best' : ''">{{ row.score }}</strong></template>
        </el-table-column>
      </el-table>
      <el-input v-model="assignReason" placeholder="派单备注（可选）" class="dlg-input" />
      <template #footer><el-button @click="assignDlg = false">取消</el-button>
        <el-button type="primary" :disabled="!chosen" @click="doAssign">确认指派</el-button></template>
    </el-dialog>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../../api';
import { dt } from '../../constants';

const scope = ref('all');
const list = ref([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  list.value = await api.get(`/admin/dispatch/pending?scope=${scope.value}`);
  loading.value = false;
}
onMounted(load);

// 复核
const reviewDlg = ref(false);
const reviewPass = ref(true);
const reviewNote = ref('');
let reviewRec = null;
function openReview(r, pass) { reviewRec = r; reviewPass.value = pass; reviewNote.value = ''; reviewDlg.value = true; }
async function doReview() {
  await api.post(`/admin/records/${reviewRec.id}/risk-review`, { pass: reviewPass.value, note: reviewNote.value });
  ElMessage.success(reviewPass.value ? '已放行进入待派单' : '已终止派单');
  reviewDlg.value = false;
  load();
}

// 派单
const assignDlg = ref(false);
const assignData = ref(null);
const chosen = ref(null);
const assignReason = ref('');
let assignRec = null;
async function openAssign(r) {
  assignRec = r; chosen.value = r.assigned_therapist_id || null; assignReason.value = '';
  assignData.value = await api.get(`/records/${r.id}/dispatch-suggestions`);
  assignDlg.value = true;
}
async function doAssign() {
  await api.post(`/admin/records/${assignRec.id}/assign`, { therapist_id: chosen.value, reason: assignReason.value });
  ElMessage.success('派单成功');
  assignDlg.value = false;
  load();
}
</script>
<style scoped>
.scope { margin-bottom: 12px; }
.rec-card { margin-bottom: 10px; }
.rc-head { display: flex; justify-content: space-between; align-items: center; }
.rc-name { font-size: 15px; margin: 0 10px; }
.sub { font-size: 12px; color: #99a9bf; }
.rc-tags { margin: 8px 0 4px; }
.rtag { margin: 2px 4px; }
.rc-advice { font-size: 12px; color: #8492a6; background: #fafbfc; padding: 8px; border-radius: 6px; }
.dlg-alert { margin-bottom: 10px; }
.dlg-input { margin-top: 10px; }
.best { color: #27ae60; }
</style>
