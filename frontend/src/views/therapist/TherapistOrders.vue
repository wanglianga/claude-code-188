<template>
  <div class="page">
    <div class="page-title">我的订单</div>
    <el-empty v-if="!orders.length" description="暂无已接订单" />
    <el-card v-for="o in orders" :key="o.dispatch.id" class="section-card" shadow="hover">
      <div class="flex-between">
        <div class="flex">
          <b>{{ o.record.recordNo }}</b>
          <el-tag :type="RECORD_STATUS[o.record.status].type" size="small">
            {{ RECORD_STATUS[o.record.status].label }}
          </el-tag>
          <el-tag v-if="o.record.totalSessions > 1" size="small" effect="plain">
            疗程 {{ o.record.sessionNo }}/{{ o.record.totalSessions }} 次
          </el-tag>
        </div>
        <el-button type="primary" plain size="small" @click="$router.push(`/records/${o.record.id}`)">
          进入服务
        </el-button>
      </div>
      <div class="kv mt8">
        <div><span class="k">用户</span>{{ o.record.user?.name }}（{{ o.record.user?.phone }}）</div>
        <div><span class="k">预约时间</span>{{ fmtTime(o.record.appointmentAt) }}</div>
        <div><span class="k">地址</span>{{ o.record.address }}（{{ o.record.floor }}层{{ o.record.hasElevator ? '·有电梯' : '·无电梯' }}）</div>
        <div><span class="k">项目</span>{{ o.items.map((i) => i.name).join('、') }}</div>
        <div><span class="k">家属陪同</span>{{ o.record.familyAccompany ? '有' : '无' }}</div>
        <div><span class="k">接单时间</span>{{ fmtTime(o.dispatch.respondedAt) }}</div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { therapistOrders } from '../../api';
import { fmtTime, RECORD_STATUS } from '../../utils';

const orders = ref([]);
onMounted(async () => {
  orders.value = await therapistOrders();
});
</script>
