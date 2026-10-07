<template>
  <div>
    <el-alert title="模拟渠道规则：医保/补贴接口可能超时或批次校验失败。失败时先挂账，用户侧仍可见依据；渠道恢复后在此手工重试，成功后记录自动转「已结算」并关闭对应异常。"
      type="info" :closable="false" show-icon class="page-alert" />
    <el-card shadow="never" v-loading="loading">
      <template #header><strong>失败结算挂账列表（医保 / 社区补贴）</strong></template>
      <el-empty v-if="!list.length" description="没有失败的结算渠道" />
      <el-table :data="list" stripe v-else>
        <el-table-column prop="record_no" label="记录号" width="150" />
        <el-table-column label="记录摘要" min-width="170">
          <template #default="{ row }"><div>{{ row.service_name }}</div><div class="sub">{{ row.user_name }}</div></template>
        </el-table-column>
        <el-table-column label="合计 / 已确认自费" min-width="150">
          <template #default="{ row }"><div>{{ money(row.total_amount) }}</div><div class="sub">当前自费 {{ money(row.self_pay_amount) }}</div></template>
        </el-table-column>
        <el-table-column label="医保渠道" width="140">
          <template #default="{ row }">
            <el-tag :type="row.insurance_status === 'failed' ? 'danger' : row.insurance_status === 'success' || row.insurance_status === 'manual_success' ? 'success' : 'info'" size="small">
              {{ statusText(row.insurance_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="补贴渠道" width="140">
          <template #default="{ row }">
            <el-tag :type="row.subsidy_status === 'failed' ? 'danger' : row.subsidy_status === 'success' || row.subsidy_status === 'manual_success' ? 'success' : 'info'" size="small">
              {{ statusText(row.subsidy_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="fail_reason" label="失败原因" min-width="200" />
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" :disabled="row.insurance_status !== 'failed' || retrying === row.id"
              @click="retry(row, 'insurance')">重试医保</el-button>
            <el-button type="success" size="small" :disabled="row.subsidy_status !== 'failed' || retrying === row.id"
              @click="retry(row, 'subsidy')">重试补贴</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../../api';
import { money } from '../../constants';
const list = ref([]);
const loading = ref(false);
const retrying = ref(null);
async function load() {
  loading.value = true;
  list.value = await api.get('/admin/settlements/failed');
  loading.value = false;
}
onMounted(load);
const statusText = (s) => ({ none: '无', pending: '—', success: '成功', failed: '失败', manual_success: '手工成功' }[s] || s);
async function retry(row, channel) {
  retrying.value = row.id;
  try {
    const res = await api.post(`/admin/settlements/${row.id}/retry`, { channel });
    ElMessage.success(channel === 'insurance' ? '医保渠道恢复，分摊金额已重算' : '补贴渠道恢复，分摊金额已重算');
    if (res.record_settled) ElMessage.success('全部渠道成功，记录已转「已结算」');
    load();
  } finally { retrying.value = null; }
}
</script>
<style scoped>
.page-alert { margin-bottom: 12px; }
.sub { font-size: 12px; color: #99a9bf; }
</style>
