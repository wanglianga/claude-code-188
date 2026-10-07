<template>
  <div v-loading="loading">
    <el-row :gutter="12" class="stat-row">
      <el-col :span="6"><el-card shadow="never" class="stat-card"><div class="s-num">{{ totals.total_records || 0 }}</div><div class="s-label">服务记录总数</div></el-card></el-col>
      <el-col :span="6"><el-card shadow="never" class="stat-card danger"><div class="s-num">{{ totals.risk_blocked || 0 }}</div><div class="s-label">高风险阻断待复核</div></el-card></el-col>
      <el-col :span="6"><el-card shadow="never" class="stat-card warning"><div class="s-num">{{ totals.open_incidents || 0 }}</div><div class="s-label">未关闭异常</div></el-card></el-col>
      <el-col :span="6"><el-card shadow="never" class="stat-card"><div class="s-num">{{ totals.pending_refunds || 0 }}</div><div class="s-label">待审批退款 / 失败结算 {{ totals.failed_settlements || 0 }}</div></el-card></el-col>
    </el-row>

    <el-card shadow="never" class="block">
      <template #header><strong>按技师：异常率 / 质量关联 / 退款（用于优化派单）</strong></template>
      <el-table :data="byTherapist" stripe>
        <el-table-column label="技师" min-width="130">
          <template #default="{ row }"><div>{{ row.name }}</div><div class="sub">{{ row.title }} · {{ row.years_exp }} 年 · 评分 {{ row.rating }}</div></template>
        </el-table-column>
        <el-table-column prop="finished" label="完工单" width="90" />
        <el-table-column label="有异常的单" width="100">
          <template #default="{ row }">{{ row.incident_records }}</template>
        </el-table-column>
        <el-table-column label="总异常率" width="180">
          <template #default="{ row }">
            <el-progress :percentage="Number(row.incident_rate || 0)" :status="Number(row.incident_rate) >= 100 ? 'exception' : Number(row.incident_rate) >= 50 ? 'warning' : 'success'" />
          </template>
        </el-table-column>
        <el-table-column label="质量相关异常率" width="180">
          <template #default="{ row }">
            <el-progress :percentage="Number(row.quality_incident_rate || 0)" :status="Number(row.quality_incident_rate) >= 50 ? 'exception' : 'warning'" :stroke-width="14" />
          </template>
        </el-table-column>
        <el-table-column prop="incidents" label="异常总条数" width="100" />
        <el-table-column prop="refunds" label="已退款单" width="90" />
      </el-table>
      <p class="note">派单评分规则：擅长匹配 + 用户评分 + 年资 − 在手工单负荷 − 质量异常重罚；高风险单对低年资技师额外扣分。见「风控复核与派单」页。</p>
    </el-card>

    <el-row :gutter="12">
      <el-col :span="14">
        <el-card shadow="never" class="block">
          <template #header><strong>按服务类型：异常率</strong></template>
          <el-table :data="byServiceType" stripe>
            <el-table-column prop="category" label="类别" width="140" />
            <el-table-column prop="name" label="服务" min-width="140" />
            <el-table-column prop="records" label="记录数" width="80" />
            <el-table-column prop="incident_records" label="异常单数" width="90" />
            <el-table-column prop="discomfort" label="服务不适" width="90" />
            <el-table-column label="异常率" width="170">
              <template #default="{ row }"><el-progress :percentage="Number(row.incident_rate || 0)" :status="Number(row.incident_rate) >= 50 ? 'warning' : 'success'" /></template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card shadow="never" class="block">
          <template #header><strong>异常类型分布</strong></template>
          <div v-for="t in incidentTypes" :key="t.type" class="type-row">
            <span class="t-name">{{ t.type }}</span>
            <el-progress :percentage="pct(t.cnt)" :format="() => `${t.cnt}（质量相关 ${t.quality_related}）`" :stroke-width="16"
              :status="t.type.includes('不适') || t.type.includes('退款') ? 'exception' : ''" class="t-prog" />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../../api';
const loading = ref(true);
const data = ref({ totals: {}, byTherapist: [], byServiceType: [], incidentTypes: [] });
const totals = computed(() => data.value.totals);
const byTherapist = computed(() => data.value.byTherapist);
const byServiceType = computed(() => data.value.byServiceType);
const incidentTypes = computed(() => data.value.incidentTypes);
const maxType = computed(() => Math.max(1, ...incidentTypes.value.map((t) => Number(t.cnt))));
const pct = (n) => Math.round(Number(n) / maxType.value * 100);
onMounted(async () => { data.value = await api.get('/admin/stats/overview'); loading.value = false; });
</script>
<style scoped>
.stat-row { margin-bottom: 12px; }
.stat-card { text-align: center; }
.stat-card.danger :deep(.s-num) { color: #e74c3c; }
.stat-card.warning :deep(.s-num) { color: #e6a23c; }
.s-num { font-size: 30px; font-weight: 700; color: #2c7be5; }
.s-label { font-size: 13px; color: #8492a6; margin-top: 4px; }
.block { margin-bottom: 12px; }
.sub { font-size: 12px; color: #99a9bf; }
.note { font-size: 12px; color: #99a9bf; margin-top: 10px; }
.type-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.t-name { width: 100px; font-size: 13px; flex-shrink: 0; }
.t-prog { flex: 1; }
</style>
