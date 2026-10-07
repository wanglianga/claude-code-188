<template>
  <div class="page" style="max-width: 720px">
    <div class="page-title">技师档案</div>
    <el-card>
      <el-form :model="form" label-width="110px">
        <el-form-item label="职称">
          <el-input v-model="form.title" placeholder="如：资深康复师" style="width: 280px" />
        </el-form-item>
        <el-form-item label="从业年限">
          <el-input-number v-model="form.yearsExp" :min="0" :max="50" />
        </el-form-item>
        <el-form-item label="可服务类目">
          <el-checkbox-group v-model="form.skills">
            <el-checkbox v-for="(label, key) in CATEGORY_LABELS" :key="key" :value="key">{{ label }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="可携带器械">
          <el-select v-model="form.equipment" multiple filterable allow-create default-first-option
            placeholder="选择或输入器械" style="width: 100%">
            <el-option v-for="e in EQUIPMENT_POOL" :key="e" :value="e" :label="e" />
          </el-select>
        </el-form-item>
        <el-form-item label="服务片区">
          <el-input v-model="form.serviceArea" placeholder="如：城东片区" style="width: 280px" />
        </el-form-item>
        <el-form-item label="个人简介">
          <el-input v-model="form.bio" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getMyTherapistProfile, saveMyTherapistProfile } from '../../api';
import { CATEGORY_LABELS } from '../../utils';

const EQUIPMENT_POOL = [
  '便携按摩床', '一次性床单', '中频治疗仪', '热敷包', '弹力带', '角度尺',
  '握力器', '生物反馈仪', '平衡垫', '助行器',
];

const saving = ref(false);
const form = reactive({ title: '', yearsExp: 0, skills: [], equipment: [], serviceArea: '', bio: '' });

const save = async () => {
  saving.value = true;
  try {
    await saveMyTherapistProfile(form);
    ElMessage.success('已保存');
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  const p = await getMyTherapistProfile();
  Object.assign(form, {
    title: p.title || '',
    yearsExp: p.yearsExp || 0,
    skills: p.skills || [],
    equipment: p.equipment || [],
    serviceArea: p.serviceArea || '',
    bio: p.bio || '',
  });
});
</script>
