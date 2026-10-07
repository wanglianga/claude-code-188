<template>
  <div>
    <el-radio-group v-model="statusFilter" @change="load" class="scope">
      <el-radio-button label="all">全部</el-radio-button>
      <el-radio-button label="reported">待处理</el-radio-button>
      <el-radio-button label="resolved">已处理待关闭</el-radio-button>
      <el-radio-button label="closed">已关闭</el-radio-button>
    </el-radio-group>

    <el-card shadow="never" v-loading="loading">
      <el-empty v-if="!list.length" description="暂无异常" />
      <el-card v-for="i in list" :key="i.id" shadow="hover" class="inc-card" :class="{ high: i.severity === 'high' }">
        <div class="ic-head">
          <div>
            <el-tag :type="i.severity === 'high' ? 'danger' : i.severity === 'medium' ? 'warning' : 'info'" size="small">
              {{ { high: '高', medium: '中', low: '低' }[i.severity] }}严重度
            </el-tag>
            <strong class="ic-type">{{ i.type }}</strong>
            <el-tag size="small" :type="i.quality_related === true ? 'danger' : i.quality_related === false ? 'success' : 'info'">
              {{ i.quality_related === true ? '与服务质量有关' : i.quality_related === false ? '与服务质量无关' : '质量关联待判定' }}
            </el-tag>
            <el-tag size="small">{{ { reported: '待处理', processing: '处理中', resolved: '已处理', closed: '已关闭' }[i.status] }}</el-tag>
          </div>
          <div class="sub">{{ dt(i.created_at) }}</div>
        </div>
        <div class="ic-meta">{{ i.record_no }} · {{ i.service_name }} · 用户 {{ i.user_name }} · 技师 {{ i.therapist_name || '—' }}</div>
        <div class="ic-desc">{{ i.description }}</div>
        <div v-if="i.resolution" class="ic-resolution">已有结论：{{ i.resolution }}</div>
        <div class="ic-foot">
          <el-button size="small" @click="$router.push(`/admin/records/${i.record_id}`)">查看统一记录</el-button>
          <el-button v-if="i.status !== 'closed'" type="primary" size="small" @click="openHandle(i)">登记处理结论与质量判定</el-button>
        </div>
      </el-card>
    </el-card>

    <el-dialog v-model="dlg" title="处理异常" width="560px">
      <el-form label-width="120px">
        <el-form-item label="处理结论"><el-input v-model="form.resolution" type="textarea" :rows="3" placeholder="事实核查、与技师/用户沟通结果、补偿或改进措施" /></el-form-item>
        <el-form-item label="是否与服务质量有关">
          <el-radio-group v-model="form.quality_related">
            <el-radio-button :value="true">有关（计入技师异常率，影响派单）</el-radio-button>
            <el-radio-button :value="false">无关（疾病非线性/用户/渠道等客观原因）</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="处理后直接关闭"><el-switch v-model="form.close" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dlg = false">取消</el-button><el-button type="primary" @click="submit">提交</el-button></template>
    </el-dialog>
  </div>
</template>
<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../../api';
import { dt } from '../../constants';
const statusFilter = ref('reported');
const list = ref([]);
const loading = ref(false);
async function load() {
  loading.value = true;
  list.value = await api.get(`/admin/incidents?status=${statusFilter.value}`);
  loading.value = false;
}
onMounted(load);
const dlg = ref(false);
const form = reactive({ resolution: '', quality_related: false, close: true });
let current = null;
function openHandle(i) {
  current = i;
  form.resolution = i.resolution || '';
  form.quality_related = i.quality_related ?? false;
  form.close = i.status === 'resolved';
  dlg.value = true;
}
async function submit() {
  if (!form.resolution) return ElMessage.warning('请填写处理结论');
  await api.post(`/admin/incidents/${current.id}/handle`, { ...form });
  ElMessage.success('已提交处理结论');
  dlg.value = false;
  load();
}
</script>
<style scoped>
.scope { margin-bottom: 12px; }
.inc-card { margin-bottom: 10px; border-left: 3px solid #dcdfe6; }
.inc-card.high { border-left-color: #e74c3c; }
.ic-head { display: flex; justify-content: space-between; align-items: center; }
.ic-type { font-size: 15px; margin: 0 8px; }
.ic-meta { font-size: 12px; color: #99a9bf; margin: 6px 0; }
.ic-desc { font-size: 13px; color: #1f2d3d; line-height: 1.6; }
.ic-resolution { font-size: 12px; color: #27ae60; background: #f0f9eb; padding: 6px 8px; border-radius: 4px; margin-top: 6px; }
.ic-foot { margin-top: 8px; text-align: right; }
.sub { font-size: 12px; color: #99a9bf; }
</style>
