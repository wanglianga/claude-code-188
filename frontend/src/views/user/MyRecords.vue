<template>
  <div class="page">
    <div class="flex-between mb16">
      <div class="page-title">我的服务记录</div>
      <el-button type="primary" @click="$router.push('/book')">新预约</el-button>
    </div>

    <el-tabs v-model="tab">
      <el-tab-pane label="服务记录" name="records">
        <el-empty v-if="!records.length" description="暂无服务记录，去预约一次上门理疗吧" />
        <el-card v-for="r in records" :key="r.id" class="section-card" shadow="hover" @click="open(r)">
          <div class="flex-between">
            <div class="flex">
              <b>{{ r.recordNo }}</b>
              <el-tag :type="RECORD_STATUS[r.status].type" size="small">
                {{ RECORD_STATUS[r.status].label }}
              </el-tag>
              <el-tag v-if="r.totalSessions > 1" size="small" effect="plain">
                疗程 {{ r.sessionNo }}/{{ r.totalSessions }} 次
              </el-tag>
            </div>
            <span class="muted">{{ fmtTime(r.createdAt) }}</span>
          </div>
          <div class="mt8" style="font-size: 14px">
            <span class="muted">预约时间：</span>{{ fmtTime(r.appointmentAt) }}
            <el-divider direction="vertical" />
            <span class="muted">地址：</span>{{ r.address }}（{{ r.floor }}层{{ r.hasElevator ? '·有电梯' : '·无电梯' }}）
          </div>
          <div class="mt8" style="font-size: 14px">
            <span class="muted">疼痛部位：</span>{{ (r.painParts || []).join('、') || '—' }}
            <el-divider direction="vertical" />
            <span class="muted">初始疼痛评分：</span>{{ r.painScoreInitial }}/10
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="我的疗程" name="courses">
        <el-empty v-if="!courses.length" description="暂无疗程，预约时可选择新建疗程" />
        <el-card v-for="c in courses" :key="c.id" class="section-card">
          <div class="flex-between">
            <b>{{ c.name }}</b>
            <el-tag :type="c.status === 'ACTIVE' ? 'primary' : 'success'" size="small">
              {{ c.status === 'ACTIVE' ? '进行中' : '已完成' }}
            </el-tag>
          </div>
          <el-progress
            class="mt8"
            :percentage="Math.round((c.usedSessions / c.totalSessions) * 100)"
            :format="() => `${c.usedSessions}/${c.totalSessions} 次`"
          />
          <div class="muted mt8">
            理疗效果并非每次线性改善，平台会结合每次疼痛评分与异常记录评估是否继续疗程。
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { myCourses, myRecords } from '../../api';
import { fmtTime, RECORD_STATUS } from '../../utils';

const router = useRouter();
const tab = ref('records');
const records = ref([]);
const courses = ref([]);

const open = (r) => router.push(`/records/${r.id}`);

onMounted(async () => {
  [records.value, courses.value] = await Promise.all([myRecords(), myCourses()]);
});
</script>
