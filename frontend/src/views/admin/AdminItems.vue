<template>
  <div class="page">
    <div class="flex-between mb16">
      <div class="page-title">服务项目管理</div>
      <el-button type="primary" @click="openEdit(null)">新增项目</el-button>
    </div>
    <el-card>
      <el-table :data="rows" size="default">
        <el-table-column prop="code" label="编码" width="100" />
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column label="类目" width="140">
          <template #default="{ row }">{{ CATEGORY_LABELS[row.category] }}</template>
        </el-table-column>
        <el-table-column prop="price" label="价格" width="90" />
        <el-table-column prop="durationMin" label="时长(分)" width="90" />
        <el-table-column label="风险" width="70">
          <template #default="{ row }">
            <el-tag size="small" :type="['success', 'warning', 'danger'][row.baseRisk - 1]">
              {{ ['低', '中', '高'][row.baseRisk - 1] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.active ? 'success' : 'info'">{{ row.active ? '上架' : '下架' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link :type="row.active ? 'danger' : 'success'" @click="toggle(row)">
              {{ row.active ? '下架' : '上架' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" :title="form.id ? '编辑项目' : '新增项目'" width="560px">
      <el-form label-width="100px">
        <el-form-item label="编码"><el-input v-model="form.code" :disabled="!!form.id" style="width: 180px" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="类目">
          <el-select v-model="form.category" style="width: 220px">
            <el-option v-for="(v, k) in CATEGORY_LABELS" :key="k" :value="k" :label="v" />
          </el-select>
        </el-form-item>
        <el-form-item label="价格"><el-input-number v-model="form.price" :min="0" /></el-form-item>
        <el-form-item label="时长(分)"><el-input-number v-model="form.durationMin" :min="10" :max="240" /></el-form-item>
        <el-form-item label="基础风险">
          <el-radio-group v-model="form.baseRisk">
            <el-radio :value="1">低</el-radio><el-radio :value="2">中</el-radio><el-radio :value="3">高</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="所需器械">
          <el-select v-model="form.requiredEquipment" multiple filterable allow-create default-first-option style="width: 100%" />
        </el-form-item>
        <el-form-item label="禁忌标签">
          <el-checkbox-group v-model="form.contraindicationTags">
            <el-checkbox v-for="t in CONTRAINDICATION_TAGS" :key="t" :value="t">{{ t }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { createServiceItem, listServiceItems, updateServiceItem } from '../../api';
import { CATEGORY_LABELS, CONTRAINDICATION_TAGS } from '../../utils';

const rows = ref([]);
const dialog = ref(false);
const blank = {
  id: null, code: '', name: '', category: 'PAIN', price: 100, durationMin: 45,
  baseRisk: 1, requiredEquipment: [], contraindicationTags: [], description: '',
};
const form = reactive({ ...blank });

const load = async () => {
  rows.value = await listServiceItems({ all: 'true' });
};

const openEdit = (row) => {
  Object.assign(form, blank, row ? {
    id: row.id, code: row.code, name: row.name, category: row.category,
    price: Number(row.price), durationMin: row.durationMin, baseRisk: row.baseRisk,
    requiredEquipment: row.requiredEquipment || [],
    contraindicationTags: row.contraindicationTags || [],
    description: row.description || '',
  } : {});
  dialog.value = true;
};

const save = async () => {
  if (!form.code || !form.name) return ElMessage.warning('请填写编码与名称');
  const { id, ...data } = form;
  if (id) await updateServiceItem(id, data);
  else await createServiceItem(data);
  dialog.value = false;
  ElMessage.success('已保存');
  load();
};

const toggle = async (row) => {
  await updateServiceItem(row.id, { active: !row.active });
  ElMessage.success(row.active ? '已下架' : '已上架');
  load();
};

onMounted(load);
</script>
