<template>
  <div class="page" style="max-width: 760px">
    <div class="page-title">我的健康档案</div>
    <el-alert
      type="info"
      class="mb16"
      show-icon
      :closable="false"
      title="档案是风险评估与服务依据的基础"
      description="既往病史、用药、禁忌与影像报告将用于接单前的风险评估，请如实填写。"
    />
    <el-card>
      <el-form :model="form" label-width="110px">
        <el-form-item label="性别">
          <el-radio-group v-model="form.gender">
            <el-radio value="男">男</el-radio>
            <el-radio value="女">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="年龄">
          <el-input-number v-model="form.age" :min="0" :max="120" />
        </el-form-item>
        <el-form-item label="既往病史">
          <el-input v-model="form.medicalHistory" type="textarea" :rows="2" placeholder="如：高血压、糖尿病、手术史等" />
        </el-form-item>
        <el-form-item label="在服药物">
          <el-input v-model="form.medications" type="textarea" :rows="2" placeholder="如：苯磺酸氨氯地平 5mg qd" />
        </el-form-item>
        <el-form-item label="禁忌标签">
          <el-checkbox-group v-model="form.contraindicationTags">
            <el-checkbox v-for="t in CONTRAINDICATION_TAGS" :key="t" :value="t">{{ t }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="禁忌说明">
          <el-input v-model="form.contraindications" type="textarea" :rows="2" placeholder="其他禁忌情况说明" />
        </el-form-item>
        <el-form-item label="影像报告">
          <el-input v-model="form.imagingReports" type="textarea" :rows="2" placeholder="如：2024-03 膝关节X线：置换术后改变" />
        </el-form-item>
        <el-form-item label="过敏史">
          <el-input v-model="form.allergies" placeholder="如：胶布过敏" />
        </el-form-item>
        <el-divider>结算信息</el-divider>
        <el-form-item label="医保账号">
          <el-input v-model="form.insuranceNo" placeholder="填写后结算可走医保通道" style="width: 280px" />
        </el-form-item>
        <el-form-item label="社区补贴">
          <el-switch v-model="form.hasSubsidy" active-text="有社区补贴资格" inactive-text="无" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="save">保存档案</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getMyProfile, saveMyProfile } from '../../api';
import { CONTRAINDICATION_TAGS } from '../../utils';

const saving = ref(false);
const form = reactive({
  gender: null,
  age: null,
  medicalHistory: '',
  medications: '',
  contraindications: '',
  contraindicationTags: [],
  imagingReports: '',
  allergies: '',
  insuranceNo: '',
  hasSubsidy: false,
});

const save = async () => {
  saving.value = true;
  try {
    await saveMyProfile(form);
    ElMessage.success('档案已保存');
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  const p = await getMyProfile();
  Object.assign(form, {
    gender: p.gender,
    age: p.age,
    medicalHistory: p.medicalHistory || '',
    medications: p.medications || '',
    contraindications: p.contraindications || '',
    contraindicationTags: p.contraindicationTags || [],
    imagingReports: p.imagingReports || '',
    allergies: p.allergies || '',
    insuranceNo: p.insuranceNo || '',
    hasSubsidy: !!p.hasSubsidy,
  });
});
</script>
