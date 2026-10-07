<template>
  <div>
    <el-alert title="接单前请逐条查看风险评估、禁忌条款与所需器械。健康风险优先于接单收益：超出本人能力或器械无法保障时请直接拒单。"
      type="warning" :closable="false" show-icon class="page-alert" />
    <el-card shadow="never">
      <template #header><strong>待接单（按风险分由高到低排序）</strong></template>
      <div v-loading="loading" class="order-list">
        <el-empty v-if="!orders.length" description="暂无待接单" />
        <el-card v-for="o in orders" :key="o.id" shadow="hover" class="order-card">
          <div class="oc-head">
            <div>
              <el-tag :type="RISK_MAP[o.risk_level].type" effect="dark" size="small">{{ o.risk_score }} 分 {{ RISK_MAP[o.risk_level].label }}</el-tag>
              <strong class="oc-name">{{ o.service_name }}</strong>
              <el-tag size="small" type="info">{{ o.category }}</el-tag>
              <el-tag v-if="o.skill_match" size="small" type="success">我的擅长</el-tag>
              <el-tag v-else size="small" type="warning">非本人主擅长</el-tag>
            </div>
            <div class="oc-time">{{ dt(o.appointment_start) }}</div>
          </div>

          <el-row :gutter="12" class="oc-body">
            <el-col :span="14">
              <div class="risk-line"><span class="lbl">风险标签：</span>
                <el-tag v-for="t in o.risk_tags" :key="t" type="danger" size="small" effect="plain" class="rtag">{{ t }}</el-tag>
              </div>
              <div class="risk-line"><span class="lbl">疼痛：</span>{{ (o.pain_sites || []).join('、') }} · {{ o.pain_level }}/10</div>
              <div class="risk-line danger"><span class="lbl">禁忌红线：</span>{{ o.contraindications || '无特殊禁忌' }}</div>
              <div class="risk-line"><span class="lbl">风险处置建议：</span>{{ o.risk_advice }}</div>
            </el-col>
            <el-col :span="10">
              <div class="risk-line"><span class="lbl">用户：</span>{{ o.user_name }} {{ o.user_phone }}</div>
              <div class="risk-line"><span class="lbl">地址：</span>{{ o.address }} · {{ o.floor_no }} 楼 · {{ o.has_elevator ? '有电梯' : '无电梯' }}</div>
              <div class="risk-line"><span class="lbl">家属：</span>{{ o.family_present ? `陪同（${o.family_contact || '见记录'}）` : '无陪同' }}</div>
              <div class="risk-line"><span class="lbl">所需器械：</span>
                <el-tag v-for="e in o.required_equipment" :key="e" size="small" class="rtag">{{ e }}</el-tag>
              </div>
            </el-col>
          </el-row>

          <div class="oc-foot">
            <el-button @click="$router.push(`/therapist/records/${o.id}`)">查看完整评估</el-button>
            <el-button type="primary" @click="accept(o)">已阅读风险边界，确认适合上门</el-button>
            <el-button type="danger" plain @click="reject(o)">不适合上门</el-button>
          </div>
        </el-card>
      </div>
    </el-card>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../../api';
import { RISK_MAP, dt } from '../../constants';
const orders = ref([]);
const loading = ref(true);
async function load() {
  loading.value = true;
  orders.value = await api.get('/therapist/orders?view=pending');
  loading.value = false;
}
onMounted(load);
async function accept(o) {
  await ElMessageBox.confirm('请确认：已阅读禁忌条款、风险建议与器械要求，可在约定时间安全上门。', '接单确认', { type: 'warning' });
  await api.post(`/records/${o.id}/accept`);
  ElMessage.success('接单成功');
  load();
}
async function reject(o) {
  const { value } = await ElMessageBox.prompt('请说明不适合上门的原因', '拒单', {
    inputPlaceholder: '如：禁忌超执业范围 / 器械故障 / 高风险需更资深技师',
    confirmButtonText: '确认拒单', type: 'warning',
  });
  await api.post(`/records/${o.id}/reject`, { reason: value });
  ElMessage.success('已拒单');
  load();
}
</script>
<style scoped>
.page-alert { margin-bottom: 12px; }
.order-card { margin-bottom: 12px; }
.oc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.oc-name { font-size: 16px; margin: 0 8px; }
.oc-time { color: #8492a6; font-size: 13px; }
.oc-body { background: #fafbfc; border-radius: 8px; padding: 10px; }
.risk-line { font-size: 13px; line-height: 1.9; color: #5e6d82; }
.risk-line.danger { color: #e74c3c; }
.lbl { color: #1f2d3d; font-weight: 600; }
.rtag { margin: 2px 4px; }
.oc-foot { margin-top: 10px; text-align: right; }
</style>
