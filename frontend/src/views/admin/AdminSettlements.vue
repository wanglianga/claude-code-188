<template>
  <div class="page">
    <div class="page-title">结算与退款</div>
    <el-card class="section-card">
      <div class="flex">
        <el-select v-model="status" placeholder="状态" clearable style="width: 140px" @change="load">
          <el-option v-for="(v, k) in SETTLEMENT_STATUS" :key="k" :value="k" :label="v.label" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
      </div>
    </el-card>

    <el-card>
      <el-table :data="rows" size="default">
        <el-table-column prop="recordNo" label="记录编号" width="150" />
        <el-table-column prop="userName" label="用户" width="90" />
        <el-table-column label="总额" width="100">
          <template #default="{ row }">{{ fmtMoney(row.totalAmount) }}</template>
        </el-table-column>
        <el-table-column label="医保" width="90">
          <template #default="{ row }">{{ fmtMoney(row.insuranceAmount) }}</template>
        </el-table-column>
        <el-table-column label="补贴" width="90">
          <template #default="{ row }">{{ fmtMoney(row.subsidyAmount) }}</template>
        </el-table-column>
        <el-table-column label="自付" width="100">
          <template #default="{ row }"><b>{{ fmtMoney(row.selfPayAmount) }}</b></template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="SETTLEMENT_STATUS[row.status].type">{{ SETTLEMENT_STATUS[row.status].label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="退款" min-width="160">
          <template #default="{ row }">
            <span v-if="row.refundAmount">{{ fmtMoney(row.refundAmount) }}（{{ row.refundReason }}）</span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/records/${row.recordId}`)">记录</el-button>
            <el-button v-if="row.status === 'PAID'" link type="danger" @click="openRefund(row)">退款审批</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="refundDialog" title="退款审批" width="480px">
      <el-alert v-if="refundTarget" type="info" :closable="false" class="mb16"
        :title="`记录 ${refundTarget.recordNo} · 实收 ${fmtMoney(refundTarget.totalAmount)}`" />
      <el-form label-width="90px">
        <el-form-item label="审批结果">
          <el-radio-group v-model="refundForm.approve">
            <el-radio :value="true">同意退款</el-radio>
            <el-radio :value="false">驳回</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="处理说明">
          <el-input v-model="refundForm.resolution" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="refundDialog = false">取消</el-button>
        <el-button type="danger" @click="doRefund">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { handleRefund, listSettlements } from '../../api';
import { SETTLEMENT_STATUS, fmtMoney } from '../../utils';

const rows = ref([]);
const status = ref('');
const refundDialog = ref(false);
const refundTarget = ref(null);
const refundForm = reactive({ approve: true, resolution: '' });

const load = async () => {
  rows.value = await listSettlements({ status: status.value || undefined });
};

const openRefund = (row) => {
  refundTarget.value = row;
  refundForm.approve = true;
  refundForm.resolution = '';
  refundDialog.value = true;
};

const doRefund = async () => {
  if (!refundForm.resolution) return ElMessage.warning('请填写处理说明');
  await handleRefund(refundTarget.value.id, refundForm);
  refundDialog.value = false;
  ElMessage.success('已处理');
  load();
};

onMounted(load);
</script>
