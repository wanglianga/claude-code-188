<template>
  <div>
    <el-card shadow="never">
      <template #header><strong>我的工单</strong><span class="sub">签到 → 记录疼痛/生命体征/项目器械/手法强度 → 提交后自动结算</span></template>
      <el-table :data="orders" v-loading="loading" stripe>
        <el-table-column prop="record_no" label="记录号" width="150" />
        <el-table-column label="服务/用户" min-width="180">
          <template #default="{ row }">
            <div>{{ row.service_name }}</div>
            <div class="sub">{{ row.user_name }} · {{ row.user_phone }}</div>
          </template>
        </el-table-column>
        <el-table-column label="时间/地址" min-width="200">
          <template #default="{ row }"><div>{{ dt(row.appointment_start) }}</div><div class="sub">{{ row.address }}</div></template>
        </el-table-column>
        <el-table-column label="风险" width="100">
          <template #default="{ row }"><el-tag :type="RISK_MAP[row.risk_level].type" size="small">{{ row.risk_score }}分</el-tag></template>
        </el-table-column>
        <el-table-column label="异常" width="70">
          <template #default="{ row }">
            <el-tag v-if="Number(row.incident_count) > 0" type="danger" size="small">{{ row.incident_count }}</el-tag>
            <span v-else class="sub">无</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }"><el-tag :type="STATUS_MAP[row.status].type" size="small">{{ STATUS_MAP[row.status].label }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="$router.push(`/therapist/records/${row.id}`)">
              {{ row.status === 'accepted' ? '去签到' : row.status === 'in_service' ? '去服务' : '查看记录' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import api from '../../api';
import { STATUS_MAP, RISK_MAP, dt } from '../../constants';
const orders = ref([]);
const loading = ref(true);
onMounted(async () => { orders.value = await api.get('/therapist/orders?view=mine'); loading.value = false; });
</script>
<style scoped>
.sub { font-size: 12px; color: #99a9bf; }
</style>
