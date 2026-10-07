<template>
  <div class="page">
    <div class="page-title">账号管理</div>
    <el-card>
      <div class="flex mb16">
        <el-radio-group v-model="role" @change="load">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="USER">用户</el-radio-button>
          <el-radio-button value="THERAPIST">技师</el-radio-button>
          <el-radio-button value="ADMIN">管理员</el-radio-button>
        </el-radio-group>
      </div>
      <el-table :data="rows" size="default">
        <el-table-column prop="name" label="姓名" width="140" />
        <el-table-column prop="phone" label="手机号" width="160" />
        <el-table-column label="角色" width="100">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">
              {{ { USER: '用户', THERAPIST: '技师', ADMIN: '管理员' }[row.role] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="170">
          <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.active ? 'success' : 'info'">{{ row.active ? '正常' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button v-if="row.role !== 'ADMIN'" link :type="row.active ? 'danger' : 'success'" @click="toggle(row)">
              {{ row.active ? '停用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { listUsers, setUserActive } from '../../api';
import { fmtTime } from '../../utils';

const rows = ref([]);
const role = ref('');

const load = async () => {
  rows.value = await listUsers({ role: role.value || undefined });
};

const toggle = async (row) => {
  await setUserActive(row.id, !row.active);
  ElMessage.success('已更新');
  load();
};

onMounted(load);
</script>
