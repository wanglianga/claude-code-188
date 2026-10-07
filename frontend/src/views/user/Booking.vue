<template>
  <div>
    <el-card shadow="never">
      <template #header><strong>预约上门理疗 · 上门前健康评估</strong>
        <span class="sub">健康风险在商业疗程之前：系统先做风险评估，高风险预约将由平台风控复核后再派单</span>
      </template>

      <el-steps :active="step" finish-status="success" align-center class="steps">
        <el-step title="选择服务与疗程" />
        <el-step title="健康与上门信息" />
        <el-step title="风险确认并提交" />
      </el-steps>

      <!-- 步骤1 -->
      <div v-show="step === 0" class="step-body">
        <h4>服务类型</h4>
        <el-radio-group v-model="form.service_type_id" class="type-grid">
          <el-radio-button v-for="t in types" :key="t.id" :value="t.id" class="type-btn" border>
            <div class="type-card">
              <div class="tc-name">{{ t.name }}</div>
              <div class="tc-cat">{{ t.category }}</div>
              <div class="tc-desc">{{ t.description }}</div>
              <div class="tc-meta">基础价 {{ money(t.base_price) }} · {{ t.duration_min }} 分钟</div>
              <div class="tc-equip">常规器械：
                <el-tag v-for="e in t.equipment_status" :key="e.name" size="small"
                  :type="e.status === 'available' ? 'success' : e.status === 'defect' ? 'danger' : 'info'" class="etag">
                  {{ e.name }}{{ e.status === 'defect' ? '(故障)' : e.status === 'repairing' ? '(维修中)' : '' }}
                </el-tag>
              </div>
            </div>
          </el-radio-button>
        </el-radio-group>

        <h4 v-if="courses.length">我的疗程包（可选）</h4>
        <el-radio-group v-if="courses.length" v-model="form.course_id" class="course-list">
          <el-radio :value="null" border>不使用疗程包（单次付费）</el-radio>
          <el-radio v-for="c in courses" :key="c.id" :value="c.id" border>
            {{ c.service_type_name }} · 已用 {{ c.used_sessions }}/{{ c.total_sessions }} 次 · 单次折算 {{ money(c.per_session_price) }}
            <span v-if="c.insurance_no"> · 有医保</span><span v-if="Number(c.subsidy_rate)>0"> · 补贴 {{ (c.subsidy_rate*100).toFixed(0) }}%</span>
          </el-radio>
        </el-radio-group>

        <div class="step-foot"><el-button type="primary" @click="step = 1" :disabled="!form.service_type_id">下一步</el-button></div>
      </div>

      <!-- 步骤2 -->
      <div v-show="step === 1" class="step-body">
        <el-form :model="form" label-width="110px" class="form-grid">
          <el-form-item label="疼痛部位"><el-select v-model="form.pain_sites" multiple filterable allow-create default-first-option placeholder="如：颈部、腰部、右膝">
            <el-option v-for="p in ['颈部','肩部','腰部','下腰部','左膝','右膝','双膝关节','双髋','下腹部','腰骶部']" :key="p" :label="p" :value="p" />
          </el-select></el-form-item>
          <el-form-item label="疼痛评分"><el-slider v-model="form.pain_level" show-stops :marks="{0:'无痛',3:'轻度',6:'中重',8:'剧烈',10:'最痛'}" /></el-form-item>
          <el-form-item label="起病情况"><el-input v-model="form.onset" placeholder="疼痛/不适开始时间、诱因、加重方式" /></el-form-item>
          <el-form-item label="既往病史"><el-input v-model="form.history" type="textarea" :rows="2" placeholder="如：高血压、冠心病（支架术后）、糖尿病、骨质疏松、椎间盘突出、骨折史、产后" /></el-form-item>
          <el-form-item label="影像报告"><el-input v-model="form.imaging_report" type="textarea" :rows="2" placeholder="如 X 光 / CT / MRI 的时间与结论" /></el-form-item>
          <el-form-item label="当前用药"><el-input v-model="form.medications" placeholder="多种药物请用顿号分隔，用于多重用药风险判断" /></el-form-item>
          <el-form-item label="禁忌（红线）"><el-input v-model="form.contraindications" type="textarea" :rows="2" placeholder="如：禁暴力掰动；血压未控制时禁训；马尾征象禁牵引" /></el-form-item>
          <el-form-item label="过敏史"><el-input v-model="form.allergies" /></el-form-item>
          <el-form-item label="详细地址"><el-input v-model="form.address" /></el-form-item>
          <el-form-item label="楼层"><el-input-number v-model="form.floor_no" :min="1" :max="60" /></el-form-item>
          <el-form-item label="是否有电梯"><el-switch v-model="form.has_elevator" active-text="有电梯" inactive-text="无电梯" /></el-form-item>
          <el-form-item label="家属陪同"><el-switch v-model="form.family_present" active-text="有陪同" inactive-text="无陪同" /></el-form-item>
          <el-form-item label="家属联系方式"><el-input v-model="form.family_contact" placeholder="关系、姓名、电话" /></el-form-item>
          <el-form-item label="可服务时间"><el-input v-model="form.available_times" placeholder="如：工作日 19 点后 / 周二周四上午" /></el-form-item>
          <el-form-item label="预约开始时间"><el-date-picker v-model="form.appointment_start" type="datetime" placeholder="选择上门时间" value-format="YYYY-MM-DDTHH:mm:ss" style="width:100%" /></el-form-item>
          <el-form-item label="备注"><el-input v-model="form.notes" /></el-form-item>
        </el-form>
        <div class="step-foot"><el-button @click="step = 0">上一步</el-button><el-button type="primary" @click="preview">风险评估并下一步</el-button></div>
      </div>

      <!-- 步骤3 -->
      <div v-show="step === 2" class="step-body" v-loading="submitting">
        <el-result v-if="previewRisk" :icon="previewRisk.level === 'high' ? 'warning' : previewRisk.level === 'medium' ? 'info' : 'success'"
          :title="`风险评分 ${previewRisk.score} 分 · ${riskLabel(previewRisk.level)}`"
          :sub-title="previewRisk.blocked ? '高风险：记录不会直接派单，将进入平台风控复核；复核通过（高风险非禁忌）后由管理端指派适配技师。' : '风险可控，提交后进入待接单，技师接单前需确认风险边界。'">
        </el-result>
        <el-alert v-if="previewRisk" :title="previewRisk.advice" :type="previewRisk.level === 'high' ? 'error' : previewRisk.level === 'medium' ? 'warning' : 'success'" :closable="false" show-icon class="risk-alert" />
        <div class="tags" v-if="previewRisk">
          <el-tag v-for="t in previewRisk.tags" :key="t" type="danger" effect="plain" class="rtag">{{ t }}</el-tag>
        </div>
        <el-alert title="平台提示：理疗效果并非每次都能线性改善，禁忌、疼痛变化、家属期待和技师能力都会影响是否继续服务。" type="info" :closable="false" class="risk-alert" />
        <div class="step-foot">
          <el-button @click="step = 1">返回修改</el-button>
          <el-button type="primary" :loading="submitting" @click="submit">确认提交预约</el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../../api';
import { money } from '../../constants';

const router = useRouter();
const types = ref([]);
const courses = ref([]);
const step = ref(0);
const submitting = ref(false);
const previewRisk = ref(null);

const form = reactive({
  service_type_id: null, course_id: null,
  pain_sites: [], pain_level: 4, onset: '', history: '', imaging_report: '', medications: '',
  contraindications: '', allergies: '', address: '', floor_no: null, has_elevator: true,
  family_present: false, family_contact: '', available_times: '',
  appointment_start: '', notes: '',
});

onMounted(async () => {
  types.value = await api.get('/catalog/service-types');
  try { courses.value = await api.get('/catalog/courses'); } catch { courses.value = []; }
});

const riskLabel = (l) => ({ low: '低风险', medium: '中风险', high: '高风险' }[l]);

async function preview() {
  if (!form.address) return ElMessage.warning('请填写详细地址');
  if (!form.appointment_start) return ElMessage.warning('请选择预约时间');
  step.value = 2;
  previewRisk.value = await api.post('/risk-preview', { ...form });
}

async function submit() {
  submitting.value = true;
  try {
    const res = await api.post('/records', { ...form, appointment_end: form.appointment_start });
    if (res.status === 'risk_blocked') {
      ElMessageBox.confirm(`风险评分 ${res.risk.score} 分（高风险）。健康风险在商业疗程之前，已暂阻断派单并提交平台风控复核。是否查看该记录？`, '高风险已登记', { confirmButtonText: '查看记录', cancelButtonText: '再约一单', type: 'warning' })
        .then(() => router.push(`/user/records/${res.id}`)).catch(() => router.push('/user/records'));
    } else {
      ElMessage.success('预约成功，等待技师接单');
      router.push(`/user/records/${res.id}`);
    }
  } finally { submitting.value = false; }
}
</script>

<style scoped>
.sub { font-size: 12px; color: #99a9bf; margin-left: 12px; font-weight: normal; }
.steps { max-width: 720px; margin: 18px auto 26px; }
.step-body { max-width: 860px; margin: 0 auto; }
h4 { margin: 18px 0 10px; color: #1f2d3d; }
.type-grid { display: flex; flex-direction: column; gap: 10px; width: 100%; }
.type-btn { height: auto; padding: 0; width: 100%; margin: 0 !important; }
.type-card { padding: 12px 16px; text-align: left; }
.tc-name { font-weight: 700; font-size: 15px; }
.tc-cat { font-size: 12px; color: #2c7be5; margin: 2px 0; }
.tc-desc { font-size: 12px; color: #8492a6; }
.tc-meta { font-size: 12px; color: #5e6d82; margin-top: 4px; }
.tc-equip { font-size: 12px; margin-top: 4px; }
.etag { margin: 2px 6px 2px 0; }
.course-list { display: flex; flex-direction: column; gap: 8px; }
.form-grid { max-width: 760px; }
.step-foot { text-align: center; margin: 24px 0 10px; }
.risk-alert { max-width: 760px; margin: 10px auto; }
.tags { text-align: center; margin: 10px 0; }
.rtag { margin: 3px; }
</style>
