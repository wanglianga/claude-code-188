<template>
  <div class="auth-page">
    <el-card class="auth-card">
      <div class="auth-logo">
        <div class="name">社区上门理疗平台</div>
        <div class="sub">预约 · 评估 · 上门 · 疗程 · 结算 一站式健康服务记录</div>
      </div>
      <el-form :model="form" @submit.prevent="submit">
        <el-form-item>
          <el-input v-model="form.phone" placeholder="手机号" size="large" maxlength="11" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码" size="large" show-password />
        </el-form-item>
        <el-button type="primary" size="large" style="width: 100%" :loading="loading" @click="submit">
          登 录
        </el-button>
      </el-form>
      <div class="flex-between mt16">
        <el-button link type="primary" @click="$router.push('/register')">注册新账号</el-button>
        <el-popover width="320" trigger="click">
          <template #reference><el-button link>测试账号</el-button></template>
          <div style="font-size: 13px; line-height: 1.9">
            <b>管理员</b>：13800000001 / admin123<br />
            <b>技师</b>：13800000002~04 / 123456<br />
            <b>用户</b>：13800000010~12 / 123456
          </div>
        </el-popover>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { login } from '../api';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const loading = ref(false);
const form = reactive({ phone: '', password: '' });

const submit = async () => {
  if (!form.phone || !form.password) return ElMessage.warning('请输入手机号和密码');
  loading.value = true;
  try {
    const res = await login(form);
    auth.setAuth(res.token, res.user);
    ElMessage.success(`欢迎，${res.user.name}`);
    router.push(auth.homePath);
  } finally {
    loading.value = false;
  }
};
</script>
