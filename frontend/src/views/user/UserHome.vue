<template>
  <div class="page">
    <div class="flex-between mb16">
      <div class="page-title">选择上门服务</div>
      <el-button type="primary" @click="$router.push('/book')">立即预约</el-button>
    </div>
    <el-tabs v-model="cat">
      <el-tab-pane label="全部" name="" />
      <el-tab-pane v-for="(label, key) in CATEGORY_LABELS" :key="key" :label="label" :name="key" />
    </el-tabs>
    <div class="card-grid">
      <el-card v-for="item in filtered" :key="item.id" shadow="hover" class="item-card">
        <div class="flex-between">
          <b>{{ item.name }}</b>
          <el-tag size="small" effect="plain">{{ CATEGORY_LABELS[item.category] }}</el-tag>
        </div>
        <div class="muted mt8" style="min-height: 40px">{{ item.description }}</div>
        <div class="mt8" style="font-size: 13px">
          <span class="muted">时长：</span>{{ item.durationMin }} 分钟
          <el-divider direction="vertical" />
          <span class="muted">风险：</span>
          <el-tag size="small" :type="['success', 'warning', 'danger'][item.baseRisk - 1]">
            {{ ['低', '中', '高'][item.baseRisk - 1] }}
          </el-tag>
        </div>
        <div class="mt8" style="font-size: 13px">
          <span class="muted">所需器械：</span>{{ (item.requiredEquipment || []).join('、') || '无' }}
        </div>
        <div class="mt8" style="font-size: 13px" v-if="item.contraindicationTags?.length">
          <span class="muted">禁忌：</span>
          <span style="color: #d97706">{{ item.contraindicationTags.join('、') }}</span>
        </div>
        <div class="flex-between mt16">
          <span style="color: #dc2626; font-size: 20px; font-weight: 700">¥{{ item.price }}</span>
          <el-button type="primary" plain @click="book(item)">预约</el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { listServiceItems } from '../../api';
import { CATEGORY_LABELS } from '../../utils';

const router = useRouter();
const items = ref([]);
const cat = ref('');

const filtered = computed(() =>
  cat.value ? items.value.filter((i) => i.category === cat.value) : items.value,
);

const book = (item) => router.push({ path: '/book', query: { itemId: item.id } });

onMounted(async () => {
  items.value = await listServiceItems();
});
</script>

<style scoped>
.item-card { border-top: 3px solid var(--brand); }
</style>
