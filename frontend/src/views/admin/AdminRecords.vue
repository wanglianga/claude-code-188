<template>
  <div class="page">
    <div class="page-title">服务记录管理</div>
    <el-card class="section-card">
      <div class="flex wrap">
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 140px">
          <el-option v-for="(v, k) in RECORD_STATUS" :key="k" :value="k" :label="v.label" />
        </el-select>
        <el-select v-model="filters.therapistId" placeholder="技师" clearable style="width: 140px">
          <el-option v-for="t in therapists" :key="t.id" :value="t.id" :label="t.name" />
        </el-select>
        <el-select v-model="filters.category" placeholder="服务类目" clearable style="width: 160px">
          <el-option v-for="(v, k) in CATEGORY_LABELS" :key="k" :value="k" :label="v" />
        </el-select>
        <el-checkbox v-model="onlyException">仅看有异常</el-checkbox>
        <el-button type="primary" @click="load">查询</el-button>
      </div>
    </el-card>

    <el-card>
      <el-table :data="rows" size="default">
        <el-table-column prop="recordNo" label="记录编号" width="150" />
        <el-table-column label="用户" width="90">
          <template #default="{ row }">{{ row.user?.name }}</template>
        </el-table-column>
        <el-table-column label="项目" min-width="180">
          <template #default="{ row }">{{ row.itemNames.join('、') }}</template>
        </el-table-column>
        <el-table-column label="技师" width="90">
          <template #default="{ row }">{{ row.therapist?.name || '—' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="RECORD_STATUS[row.status].type">{{ RECORD_STATUS[row.status].label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="异常" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.openExceptionCount" size="small" type="danger">{{ row.openExceptionCount }} 待处理</el-tag>
            <span v-else-if="row.exceptionCount" class="muted">{{ row.exceptionCount }}</span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="100">
          <template #default="{ row }">{{ fmtMoney(row.totalAmount) }}</template>
        </el-table-column>
        <el-table-column label="预约时间" width="150">
          <template #default="{ row }">{{ fmtTime(row.appointmentAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/records/${row.id}`)">详情</el-button>
            <el-button v-if="row.status === 'PENDING_DISPATCH'" link type="warning" @click="openDispatch(row)">派单</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dispatchDialog" title="派单" width="480px">
      <el-alert v-if="dispatchTarget" type="info" :closable="false" class="mb16"
        :title="`记录 ${dispatchTarget.recordNo} · ${dispatchTarget.itemNames.join('、')}`" />
      <el-select v-model="dispatchForm.therapistId" placeholder="选择技师" style="width: 100%">
        <el-option v-for="t in therapists" :key="t.id" :value="t.id"
          :label="`${t.name}（${t.profile?.title || '技师'} · ${t.profile?.serviceArea || '片区未填'}）`" />
      </el-select>
      <el-input v-model="dispatchForm.note" placeholder="派单备注（可选）" class="mt8" />
      <template #footer>
        <el-button @click="dispatchDialog = false">取消</el-button>
        <el-button type="primary" @click="doDispatch">确认派单</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { adminRecords, dispatchRecord, listTherapists } from '../../api';
import { CATEGORY_LABELS, RECORD_STATUS, fmtMoney, fmtTime } from '../../utils';

const rows = ref([]);
const therapists = ref([]);
const filters = reactive({ status: '', therapistId: '', category: '' });
const onlyException = ref(false);
const dispatchDialog = ref(false);
const dispatchTarget = ref(null);
const dispatchForm = reactive({ therapistId: null, note: '' });

const load = async () => {
  rows.value = await adminRecords({
    status: filters.status || undefined,
    therapistId: filters.therapistId || undefined,
    category: filters.category || undefined,
    hasException: onlyException.value ? 'true' : undefined,
  });
};

const openDispatch = (row) => {
  dispatchTarget.value = row;
  dispatchForm.therapistId = null;
  dispatchForm.note = '';
  dispatchDialog.value = true;
};

const doDispatch = async () => {
  if (!dispatchForm.therapistId) return ElMessage.warning('请选择技师');
  await dispatchRecord(dispatchTarget.value.id, dispatchForm);
  dispatchDialog.value = false;
  ElMessage.success('已派单');
  load();
};

onMounted(async () => {
  therapists.value = await listTherapists();
  await load();
});
</script>
