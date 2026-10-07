<template>
  <div>
    <el-card shadow="never">
      <template #header><div class="head"><strong>我的健康服务记录</strong>
        <el-button type="primary" @click="$router.push('/user/booking')">新建预约</el-button>
      </div></template>
      <el-table :data="records" v-loading="loading" stripe @row-click="(r) => $router.push(`/user/records/${r.id}`)" class="records-table">
        <el-table-column prop="record_no" label="记录号" width="150" />
        <el-table-column label="服务项目" min-width="170">
          <template #default="{ row }">
            <div>{{ row.service_name }}</div>
            <div class="sub">{{ row.category }}</div>
          </template>
        </el-table-column>
        <el-table-column label="预约时间" width="170"><template #default="{ row }">{{ dt(row.appointment_start) }}</template></el-table-column>
        <el-table-column label="风险" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.risk_level" :type="RISK_MAP[row.risk_level].type" size="small">{{ row.risk_score }} 分 {{ RISK_MAP[row.risk_level].label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="therapist_name" label="技师" width="100" />
        <el-table-column label="异常/随访" width="100">
          <template #default="{ row }">
            <el-badge v-if="row.incident_count" :value="row.incident_count" type="danger" class="badge"><span class="dot-text">异常</span></el-badge>
            <span v-else class="sub">无异常</span>
            <span class="sub"> · 随访 {{ row.followup_count }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="140">
          <template #default="{ row }"><el-tag :type="STATUS_MAP[row.status].type" size="small">{{ STATUS_MAP[row.status].label }}</el-tag></template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import api from '../../api';
import { STATUS_MAP, RISK_MAP, dt } from '../../constants';
const records = ref([]);
const loading = ref(true);
onMounted(async () => { records.value = await api.get('/records/mine'); loading.value = false; });
</script>
<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; }
.records-table { cursor: pointer; }
.sub { font-size: 12px; color: #99a9bf; }
.badge { margin-right: 4px; }
.dot-text { font-size: 12px; }
</style>
