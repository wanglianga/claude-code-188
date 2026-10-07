<template>
  <div>
    <el-radio-group v-model="statusFilter" @change="load" class="scope">
      <el-radio-button label="requested">待审批</el-radio-button>
      <el-radio-button label="all">全部</el-radio-button>
      <el-radio-button label="refunded">已退款</el-radio-button>
      <el-radio-button label="rejected">已驳回</el-radio-button>
    </el-radio-group>

    <el-card shadow="never" v-loading="loading">
      <el-table :data="list" stripe>
        <el-table-column prop="record_no" label="记录号" width="140" />
        <el-table-column label="服务/用户/技师" min-width="190">
          <template #default="{ row }"><div>{{ row.service_name }}</div><div class="sub">{{ row.user_name }} / 技师 {{ row.therapist_name || '—' }}</div></template>
        </el-table-column>
        <el-table-column label="退款金额" width="100"><template #default="{ row }"><strong class="money">{{ money(row.amount) }}</strong></template></el-table-column>
        <el-table-column prop="reason" label="用户申请原因" min-width="200" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'refunded' ? 'warning' : row.status === 'rejected' ? 'info' : 'danger'" size="small">
              {{ { requested: '待审批', approved: '已批准', rejected: '已驳回', refunded: '已退款' }[row.status] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="质量关联" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.quality_related === true" type="danger" size="small">与质量有关</el-tag>
            <el-tag v-else-if="row.quality_related === false" type="success" size="small">与质量无关</el-tag>
            <span v-else class="sub">待判定</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="$router.push(`/admin/records/${row.record_id}`)">查看记录</el-button>
            <el-button v-if="row.status === 'requested'" type="warning" size="small" @click="openDecide(row, true)">同意退款</el-button>
            <el-button v-if="row.status === 'requested'" size="small" @click="openDecide(row, false)">驳回</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dlg" :title="approve ? '审批退款' : '驳回退款'" width="560px">
      <el-form label-width="150px">
        <el-form-item label="退款金额"><strong>{{ money(current?.amount) }}</strong></el-form-item>
        <el-form-item label="是否与服务质量有关">
          <el-radio-group v-model="quality_related">
            <el-radio-button :value="true">有关（技师计入质量异常率，影响派单）</el-radio-button>
            <el-radio-button :value="false">无关（疾病非线性改善/家属期待差等）</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="审批说明"><el-input v-model="adminNote" type="textarea" :rows="3" :placeholder="approve ? '如：规范操作无过错，但考虑用户体验同意退款，并沟通预期管理' : '驳回原因'" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dlg = false">取消</el-button>
        <el-button :type="approve ? 'warning' : 'info'" @click="submit">确认{{ approve ? '退款' : '驳回' }}</el-button></template>
    </el-dialog>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../../api';
import { money } from '../../constants';
const statusFilter = ref('requested');
const list = ref([]);
const loading = ref(false);
async function load() {
  loading.value = true;
  list.value = await api.get(`/admin/refunds?status=${statusFilter.value}`);
  loading.value = false;
}
onMounted(load);
const dlg = ref(false);
const approve = ref(true);
const quality_related = ref(false);
const adminNote = ref('');
let current = null;
function openDecide(row, ok) {
  current = row; approve.value = ok; quality_related.value = false; adminNote.value = ''; dlg.value = true;
}
async function submit() {
  await api.post(`/admin/refunds/${current.id}/decide`, { approve: approve.value, quality_related: quality_related.value, admin_note: adminNote.value });
  ElMessage.success(approve.value ? '退款已执行' : '已驳回');
  dlg.value = false;
  load();
}
</script>
<style scoped>
.scope { margin-bottom: 12px; }
.sub { font-size: 12px; color: #99a9bf; }
.money { color: #e74c3c; }
</style>
