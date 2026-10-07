<template>
  <div class="page">
    <div class="page-title">待接订单</div>
    <el-alert
      type="info"
      class="mb16"
      show-icon
      :closable="false"
      title="接单前请核对风险评估与所需器械，确认适合上门后再接单"
    />
    <el-empty v-if="!queue.length" description="暂无待接订单" />

    <el-card v-for="q in queue" :key="q.dispatch.id" class="section-card">
      <div class="flex-between">
        <div class="flex">
          <b>{{ q.record.recordNo }}</b>
          <el-tag :type="RISK_LEVELS[q.record.riskAssessment?.riskLevel]?.type || 'info'">
            {{ RISK_LEVELS[q.record.riskAssessment?.riskLevel]?.label || '未评估' }}
          </el-tag>
          <el-tag v-if="q.record.riskAssessment && !q.record.riskAssessment.homeVisitSuitable" type="danger" effect="dark">
            不建议上门
          </el-tag>
        </div>
        <span class="muted">派单时间：{{ fmtTime(q.dispatch.assignedAt) }}</span>
      </div>

      <div class="kv mt8">
        <div><span class="k">用户</span>{{ q.record.user?.name }}（{{ q.record.user?.phone }}）</div>
        <div><span class="k">预约时间</span>{{ fmtTime(q.record.appointmentAt) }}</div>
        <div><span class="k">地址</span>{{ q.record.address }}</div>
        <div><span class="k">楼层</span>{{ q.record.floor }} 层 · {{ q.record.hasElevator ? '有电梯' : '无电梯' }}</div>
        <div><span class="k">疼痛部位</span>{{ (q.record.painParts || []).join('、') || '—' }}</div>
        <div><span class="k">初始疼痛评分</span>{{ q.record.painScoreInitial }}/10</div>
        <div><span class="k">家属陪同</span>{{ q.record.familyAccompany ? '有' : '无' }}</div>
        <div><span class="k">项目</span>{{ q.record.items?.map((i) => i.name).join('、') }}</div>
      </div>

      <template v-if="q.record.riskAssessment">
        <el-divider content-position="left"><b>风险边界</b></el-divider>
        <div class="kv">
          <div><span class="k">手法强度上限</span><b style="color: #dc2626">{{ q.record.riskAssessment.maxIntensity }}</b></div>
          <div><span class="k">所需器械</span>{{ (q.record.riskAssessment.requiredEquipment || []).join('、') || '无' }}</div>
        </div>
        <div class="mt8">
          <div
            v-for="(f, i) in q.record.riskAssessment.riskFlags"
            :key="i"
            class="risk-flag"
            :class="f.level"
          >
            <b>[{{ f.flag }}]</b> {{ f.detail }}
          </div>
        </div>
        <div class="basis-box mt8">{{ q.record.riskAssessment.suggestions }}</div>
        <div class="mt8" v-if="q.record.healthProfile">
          <span class="muted">健康档案：</span>
          年龄 {{ q.record.healthProfile.age ?? '—' }} ·
          病史 {{ q.record.healthProfile.medicalHistory || '—' }} ·
          用药 {{ q.record.healthProfile.medications || '—' }} ·
          影像 {{ q.record.healthProfile.imagingReports || '—' }}
        </div>
      </template>

      <div class="flex mt16" style="justify-content: flex-end">
        <el-button type="danger" plain @click="reject(q)">拒单</el-button>
        <el-button
          type="primary"
          :disabled="q.record.riskAssessment && !q.record.riskAssessment.homeVisitSuitable"
          @click="accept(q)"
        >
          确认适合上门，接单
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { respondDispatch, therapistQueue } from '../../api';
import { fmtTime, RISK_LEVELS } from '../../utils';

const queue = ref([]);

const load = async () => {
  queue.value = await therapistQueue();
};

const accept = async (q) => {
  await ElMessageBox.confirm(
    `确认已阅读风险评估，器械齐全且适合上门？（手法强度上限：${q.record.riskAssessment?.maxIntensity}）`,
    '接单确认',
    { type: 'warning' },
  );
  await respondDispatch(q.record.id, { accept: true });
  ElMessage.success('已接单');
  load();
};

const reject = async (q) => {
  const { value } = await ElMessageBox.prompt('请填写拒单原因（如禁忌冲突、器械不足、时间冲突）', '拒单', {
    inputValidator: (v) => !!v || '请填写原因',
  });
  await respondDispatch(q.record.id, { accept: false, reason: value });
  ElMessage.success('已拒单，订单将退回平台重新派单');
  load();
};

onMounted(load);
</script>
