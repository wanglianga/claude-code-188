<template>
  <div class="page" style="max-width: 860px">
    <div class="page-title">预约上门理疗</div>

    <el-alert
      v-if="!profileReady"
      type="warning"
      class="mb16"
      show-icon
      :closable="false"
      title="健康档案未完善"
      description="完善既往病史、用药、禁忌与影像报告后，平台才能给出准确的风险评估与服务依据。"
    >
      <el-button size="small" type="warning" plain @click="$router.push('/profile')">去完善</el-button>
    </el-alert>

    <el-card class="section-card">
      <template #header><b>1. 选择服务项目</b></template>
      <el-checkbox-group v-model="form.serviceItemIds">
        <div v-for="item in items" :key="item.id" class="svc-line">
          <el-checkbox :value="item.id">
            {{ item.name }}
            <span class="muted">（{{ CATEGORY_LABELS[item.category] }} · {{ item.durationMin }}分钟）</span>
            <b style="color: #dc2626"> ¥{{ item.price }}</b>
          </el-checkbox>
        </div>
      </el-checkbox-group>

      <el-divider />
      <div class="flex">
        <span style="font-size: 14px">疗程方式：</span>
        <el-radio-group v-model="courseMode">
          <el-radio value="single">单次服务</el-radio>
          <el-radio value="existing" :disabled="!activeCourses.length">使用已有疗程</el-radio>
          <el-radio value="new">新建疗程</el-radio>
        </el-radio-group>
      </div>
      <div v-if="courseMode === 'existing'" class="mt8">
        <el-select v-model="form.courseId" placeholder="选择疗程" style="width: 320px">
          <el-option
            v-for="c in activeCourses"
            :key="c.id"
            :value="c.id"
            :label="`${c.name}（已用 ${c.usedSessions}/${c.totalSessions} 次）`"
          />
        </el-select>
      </div>
      <div v-if="courseMode === 'new'" class="mt8 flex">
        <el-select v-model="form.newCourse.serviceItemId" placeholder="疗程项目（需已勾选）" style="width: 240px">
          <el-option
            v-for="i in selectedItems"
            :key="i.id"
            :value="i.id"
            :label="i.name"
          />
        </el-select>
        <el-input-number v-model="form.newCourse.totalSessions" :min="2" :max="60" />
        <span class="muted">次</span>
      </div>
    </el-card>

    <el-card class="section-card">
      <template #header><b>2. 症状与居家信息</b></template>
      <el-form label-width="110px">
        <el-form-item label="疼痛部位">
          <el-checkbox-group v-model="form.painParts">
            <el-checkbox v-for="p in PAIN_PARTS" :key="p" :value="p">{{ p }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="当前疼痛评分">
          <el-slider v-model="form.painScoreInitial" :min="0" :max="10" show-input style="width: 420px" />
          <span class="muted"> 0 无痛 · 10 剧痛</span>
        </el-form-item>
        <el-form-item label="服务地址" required>
          <el-input v-model="form.address" placeholder="小区 / 楼栋 / 门牌号" style="width: 420px" />
        </el-form-item>
        <el-form-item label="楼层与电梯">
          <el-input-number v-model="form.floor" :min="1" :max="99" />
          <span class="muted">层</span>
          <el-switch
            v-model="form.hasElevator"
            active-text="有电梯"
            inactive-text="无电梯"
            style="margin-left: 16px"
          />
        </el-form-item>
        <el-form-item label="预约时间" required>
          <el-date-picker
            v-model="form.appointmentAt"
            type="datetime"
            placeholder="选择上门时间"
            :disabled-date="(d) => d.getTime() < Date.now() - 86400000"
            style="width: 240px"
          />
        </el-form-item>
        <el-form-item label="可服务时间">
          <el-checkbox-group v-model="form.availableSlots">
            <el-checkbox v-for="s in TIME_SLOTS" :key="s" :value="s">{{ s }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="家属陪同">
          <el-switch v-model="form.familyAccompany" active-text="有家属陪同" inactive-text="无" />
          <el-input
            v-if="form.familyAccompany"
            v-model="form.familyNotes"
            placeholder="陪同人关系/联系方式等备注"
            class="mt8"
          />
        </el-form-item>
        <el-form-item label="补充说明">
          <el-input v-model="form.userNote" type="textarea" :rows="2" placeholder="其他想说明的情况" />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="section-card">
      <template #header><b>3. 费用预估</b></template>
      <div class="flex-between">
        <div>
          <div v-for="i in selectedItems" :key="i.id" style="font-size: 14px; line-height: 1.9">
            {{ i.name }} <span class="muted">¥{{ i.price }}</span>
          </div>
        </div>
        <div style="text-align: right">
          <div class="muted">合计（医保/补贴将在结算时抵扣）</div>
          <div style="font-size: 24px; font-weight: 700; color: #dc2626">¥{{ totalPrice }}</div>
        </div>
      </div>
    </el-card>

    <el-button type="primary" size="large" style="width: 100%" :loading="submitting" @click="submit">
      提交预约并生成风险评估
    </el-button>

    <el-dialog v-model="riskDialog" title="风险评估结果" width="560px">
      <template v-if="created?.riskAssessment">
        <div class="flex">
          <span>风险等级：</span>
          <el-tag :type="RISK_LEVELS[created.riskAssessment.riskLevel].type">
            {{ RISK_LEVELS[created.riskAssessment.riskLevel].label }}
          </el-tag>
          <el-tag v-if="!created.riskAssessment.homeVisitSuitable" type="danger" effect="dark">
            不建议上门
          </el-tag>
        </div>
        <div class="mt16">
          <div v-for="(f, i) in created.riskAssessment.riskFlags" :key="i" class="risk-flag" :class="f.level">
            <b>[{{ f.flag }}]</b> {{ f.detail }}
          </div>
        </div>
        <div class="basis-box mt16">{{ created.riskAssessment.suggestions }}</div>
      </template>
      <template #footer>
        <el-button @click="goRecords">查看我的服务记录</el-button>
        <el-button type="primary" @click="goRecords">知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { createRecord, getMyProfile, listServiceItems, myCourses } from '../../api';
import { CATEGORY_LABELS, PAIN_PARTS, RISK_LEVELS, TIME_SLOTS } from '../../utils';

const route = useRoute();
const router = useRouter();
const items = ref([]);
const courses = ref([]);
const profileReady = ref(true);
const submitting = ref(false);
const riskDialog = ref(false);
const created = ref(null);
const courseMode = ref('single');

const form = reactive({
  serviceItemIds: [],
  painParts: [],
  painScoreInitial: 3,
  address: '',
  floor: 1,
  hasElevator: true,
  availableSlots: [],
  familyAccompany: false,
  familyNotes: '',
  appointmentAt: null,
  userNote: '',
  courseId: null,
  newCourse: { serviceItemId: null, totalSessions: 10 },
});

const selectedItems = computed(() => items.value.filter((i) => form.serviceItemIds.includes(i.id)));
const totalPrice = computed(() => selectedItems.value.reduce((s, i) => s + Number(i.price), 0));
const activeCourses = computed(() => courses.value.filter((c) => c.status === 'ACTIVE'));

const submit = async () => {
  if (!form.serviceItemIds.length) return ElMessage.warning('请选择服务项目');
  if (!form.address) return ElMessage.warning('请填写服务地址');
  if (!form.appointmentAt) return ElMessage.warning('请选择预约上门时间');
  if (courseMode.value === 'existing' && !form.courseId) return ElMessage.warning('请选择疗程');
  if (courseMode.value === 'new' && !form.newCourse.serviceItemId) return ElMessage.warning('请选择疗程项目');

  const payload = {
    ...form,
    appointmentAt: new Date(form.appointmentAt).toISOString(),
    courseId: courseMode.value === 'existing' ? form.courseId : undefined,
    newCourse: courseMode.value === 'new' ? form.newCourse : undefined,
  };
  submitting.value = true;
  try {
    created.value = await createRecord(payload);
    riskDialog.value = true;
  } finally {
    submitting.value = false;
  }
};

const goRecords = () => {
  riskDialog.value = false;
  router.push('/records');
};

onMounted(async () => {
  items.value = await listServiceItems();
  const preselect = route.query.itemId;
  if (preselect) form.serviceItemIds = [preselect];
  try {
    const p = await getMyProfile();
    profileReady.value = !!(p.medicalHistory || p.contraindicationTags?.length || p.age);
  } catch {
    profileReady.value = false;
  }
  courses.value = await myCourses();
});
</script>

<style scoped>
.svc-line { padding: 4px 0; }
</style>
