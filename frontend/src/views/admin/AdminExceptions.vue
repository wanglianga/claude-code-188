<template>
  <div class="page">
    <div class="page-title">异常处理</div>
    <el-card class="section-card">
      <div class="flex wrap">
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 140px">
          <el-option v-for="(v, k) in EXCEPTION_STATUS" :key="k" :value="k" :label="v.label" />
        </el-select>
        <el-select v-model="filters.type" placeholder="类型" clearable style="width: 160px">
          <el-option v-for="(v, k) in EXCEPTION_TYPES" :key="k" :value="k" :label="v" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
      </div>
    </el-card>

    <el-card>
      <el-table :data="rows" size="default">
        <el-table-column prop="recordNo" label="记录编号" width="150" />
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            <el-tag size="small" type="warning" effect="plain">{{ EXCEPTION_TYPES[row.type] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="260" show-overflow-tooltip />
        <el-table-column label="上报方" width="90">
          <template #default="{ row }">
            {{ { USER: '用户', THERAPIST: '技师', ADMIN: '管理员', SYSTEM: '系统' }[row.createdByRole] || '—' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="EXCEPTION_STATUS[row.status].type">{{ EXCEPTION_STATUS[row.status].label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="150">
          <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/records/${row.recordId}`)">记录</el-button>
            <el-button v-if="['OPEN', 'PROCESSING'].includes(row.status)" link type="warning" @click="openHandle(row)">
              处理
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="handleDialog" title="处理异常" width="480px">
      <el-alert v-if="handleTarget" type="warning" :closable="false" class="mb16" :title="handleTarget.description" />
      <el-form label-width="90px">
        <el-form-item label="处理结果">
          <el-radio-group v-model="handleForm.status">
            <el-radio value="PROCESSING">处理中</el-radio>
            <el-radio value="RESOLVED">已解决</el-radio>
            <el-radio value="REJECTED">驳回</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="处理说明">
          <el-input v-model="handleForm.resolution" type="textarea" :rows="3" placeholder="记录处理措施与结论" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="handleDialog = false">取消</el-button>
        <el-button type="primary" @click="doHandle">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { handleException, listExceptions } from '../../api';
import { EXCEPTION_STATUS, EXCEPTION_TYPES, fmtTime } from '../../utils';

const rows = ref([]);
const filters = reactive({ status: '', type: '' });
const handleDialog = ref(false);
const handleTarget = ref(null);
const handleForm = reactive({ status: 'RESOLVED', resolution: '' });

const load = async () => {
  rows.value = await listExceptions({
    status: filters.status || undefined,
    type: filters.type || undefined,
  });
};

const openHandle = (row) => {
  handleTarget.value = row;
  handleForm.status = 'RESOLVED';
  handleForm.resolution = '';
  handleDialog.value = true;
};

const doHandle = async () => {
  if (!handleForm.resolution) return ElMessage.warning('请填写处理说明');
  await handleException(handleTarget.value.id, handleForm);
  handleDialog.value = false;
  ElMessage.success('已处理');
  load();
};

onMounted(load);
</script>
