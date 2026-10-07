<template>
  <div class="page">
    <div class="page-title">运营看板</div>

    <el-row :gutter="14" class="mb16" v-if="overview">
      <el-col :md="4" :xs="12" v-for="s in statCards" :key="s.label">
        <el-card shadow="hover">
          <div class="stat-num" :style="{ color: s.color }">{{ s.value }}</div>
          <div class="stat-label">{{ s.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="14">
      <el-col :md="12" :xs="24">
        <el-card class="section-card">
          <template #header><b>技师维度：完成量 / 异常 / 退款</b></template>
          <div ref="therapistChart" style="height: 320px" />
        </el-card>
      </el-col>
      <el-col :md="12" :xs="24">
        <el-card class="section-card">
          <template #header><b>服务类目：单量与异常率</b></template>
          <div ref="categoryChart" style="height: 320px" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="14">
      <el-col :md="12" :xs="24">
        <el-card class="section-card">
          <template #header><b>异常类型分布</b></template>
          <div ref="exceptionChart" style="height: 300px" />
        </el-card>
      </el-col>
      <el-col :md="12" :xs="24">
        <el-card class="section-card">
          <template #header>
            <div class="flex-between">
              <b>技师服务质量明细</b>
              <span class="muted">异常与退款是否集中于个别技师，用于优化派单</span>
            </div>
          </template>
          <el-table :data="byTherapist" size="small">
            <el-table-column prop="name" label="技师" width="90" />
            <el-table-column prop="completedVisits" label="完成" width="70" />
            <el-table-column prop="exceptionCount" label="异常" width="70">
              <template #default="{ row }">
                <span :style="{ color: row.exceptionCount > 2 ? '#dc2626' : 'inherit' }">{{ row.exceptionCount }}</span>
              </template>
            </el-table-column>
            <el-table-column label="异常率" width="90">
              <template #default="{ row }">
                <el-tag size="small" :type="row.exceptionRate > 50 ? 'danger' : row.exceptionRate > 20 ? 'warning' : 'success'">
                  {{ row.exceptionRate }}%
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="refundCount" label="退款" width="70" />
            <el-table-column label="平均疼痛改善" width="110">
              <template #default="{ row }">
                <span v-if="row.avgPainRelief == null" class="muted">—</span>
                <span v-else :style="{ color: row.avgPainRelief < 0 ? '#dc2626' : '#16a34a' }">
                  {{ row.avgPainRelief > 0 ? '+' : '' }}{{ row.avgPainRelief }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="建议" min-width="140">
              <template #default="{ row }">
                <span class="muted" style="font-size: 12px">{{ suggest(row) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import * as echarts from 'echarts';
import {
  statsByServiceType, statsByTherapist, statsExceptionsByType, statsOverview,
} from '../../api';
import { CATEGORY_LABELS, EXCEPTION_TYPES } from '../../utils';

const overview = ref(null);
const byTherapist = ref([]);
const therapistChart = ref(null);
const categoryChart = ref(null);
const exceptionChart = ref(null);

const statCards = computed(() => [
  { label: '服务记录总数', value: overview.value?.totalRecords ?? 0, color: '#0f8a7d' },
  { label: '待派单', value: overview.value?.byStatus?.PENDING_DISPATCH ?? 0, color: '#d97706' },
  { label: '异常事件', value: overview.value?.totalExceptions ?? 0, color: '#dc2626' },
  { label: '待处理异常', value: overview.value?.openExceptions ?? 0, color: '#dc2626' },
  { label: '已结算金额', value: `¥${overview.value?.revenue ?? 0}`, color: '#16a34a' },
  { label: '退款金额', value: `¥${overview.value?.refundAmount ?? 0}`, color: '#7a8a93' },
]);

const suggest = (row) => {
  if (row.exceptionRate > 50 || row.refundCount >= 2) return '异常/退款集中，建议暂停派单并复盘服务质量';
  if (row.exceptionRate > 20) return '异常率偏高，派单时降低风险等级匹配';
  if (row.avgPainRelief != null && row.avgPainRelief < 0) return '疼痛改善为负，建议复核手法与转诊';
  return '表现正常，可优先派单';
};

onMounted(async () => {
  const [ov, bt, bc, be] = await Promise.all([
    statsOverview(), statsByTherapist(), statsByServiceType(), statsExceptionsByType(),
  ]);
  overview.value = ov;
  byTherapist.value = bt;

  echarts.init(therapistChart.value).setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['完成服务', '异常事件', '退款'] },
    xAxis: { type: 'category', data: bt.map((t) => t.name) },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      { name: '完成服务', type: 'bar', data: bt.map((t) => t.completedVisits), itemStyle: { color: '#0f8a7d' } },
      { name: '异常事件', type: 'bar', data: bt.map((t) => t.exceptionCount), itemStyle: { color: '#f59e0b' } },
      { name: '退款', type: 'bar', data: bt.map((t) => t.refundCount), itemStyle: { color: '#dc2626' } },
    ],
  });

  echarts.init(categoryChart.value).setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['单量', '异常率%'] },
    xAxis: { type: 'category', data: bc.map((c) => CATEGORY_LABELS[c.category]) },
    yAxis: [{ type: 'value', minInterval: 1 }, { type: 'value', max: 100 }],
    series: [
      { name: '单量', type: 'bar', data: bc.map((c) => c.recordCount), itemStyle: { color: '#0f8a7d' } },
      { name: '异常率%', type: 'line', yAxisIndex: 1, data: bc.map((c) => c.exceptionRate), itemStyle: { color: '#dc2626' } },
    ],
  });

  echarts.init(exceptionChart.value).setOption({
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: be.filter((e) => e.count > 0).map((e) => ({ name: EXCEPTION_TYPES[e.type], value: e.count })),
      label: { formatter: '{b}: {c}' },
    }],
  });
});
</script>
