<template>
  <div class="login-page">
    <div class="login-card">
      <div class="brand">
        <div class="logo">康</div>
        <div>
          <h1>社区上门理疗平台</h1>
          <p>评估 · 派单 · 上门 · 疗程 · 异常 · 随访 · 结算 · 复诊，一条健康服务记录贯穿</p>
        </div>
      </div>

      <el-tabs v-model="form.role" class="role-tabs" stretch>
        <el-tab-pane label="用户端" name="user" />
        <el-tab-pane label="技师端" name="therapist" />
        <el-tab-pane label="管理端" name="admin" />
      </el-tabs>

      <el-form :model="form" @keyup.enter="submit">
        <el-form-item>
          <el-input v-model="form.account" size="large" :placeholder="form.role === 'admin' ? '管理员用户名' : '手机号'" :prefix-icon="User" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" size="large" type="password" placeholder="密码" :prefix-icon="Lock" show-password />
        </el-form-item>
        <el-button type="primary" size="large" class="login-btn" :loading="loading" @click="submit">登 录</el-button>
      </el-form>

      <el-divider>演示账号（点击填充）</el-divider>
      <div class="demo-accounts">
        <el-tag v-for="a in demoAccounts" :key="a.account" class="demo-tag" :type="a.type" @click="fill(a)">
          {{ a.label }}
        </el-tag>
      </div>
      <p class="tip">原则提示：平台把<strong>健康风险放在商业疗程之前</strong>——高风险预约先风控复核，再决定是否派单。</p>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { User, Lock } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import api from '../api';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const loading = ref(false);
const form = reactive({ role: 'user', account: '13800000001', password: 'user123' });

const demoAccounts = [
  { role: 'user', account: '13800000001', password: 'user123', label: '用户·张桂芳(高龄高危)', type: 'success' },
  { role: 'user', account: '13800000004', password: 'user123', label: '用户·陈秀兰(冠心病高危)', type: 'warning' },
  { role: 'therapist', account: '13900000001', password: 'ther123', label: '技师·刘康复(资深)', type: 'primary' },
  { role: 'therapist', account: '13900000004', password: 'ther123', label: '技师·吴新手(高异常率)', type: 'info' },
  { role: 'admin', account: 'admin', password: 'admin123', label: '管理端·调度员', type: 'danger' },
];

function fill(a) {
  form.role = a.role;
  form.account = a.account;
  form.password = a.password;
}

async function submit() {
  if (!form.account || !form.password) return ElMessage.warning('请输入账号和密码');
  loading.value = true;
  try {
    const res = await api.post('/auth/login', form);
    auth.setSession(res.token, res.user);
    ElMessage.success(`欢迎，${res.user.name}`);
    router.push(`/${form.role}`);
  } catch { /* 拦截器已提示 */ } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e8f3ff 0%, #f0fbf4 100%);
  padding: 20px;
}
.login-card {
  width: 460px;
  background: #fff;
  border-radius: 14px;
  padding: 32px 36px;
  box-shadow: 0 10px 40px rgba(30, 80, 140, 0.12);
}
.brand { display: flex; gap: 14px; align-items: center; margin-bottom: 8px; }
.logo {
  width: 52px; height: 52px; border-radius: 12px; flex-shrink: 0;
  background: linear-gradient(135deg, #2c7be5, #27ae60);
  color: #fff; font-size: 26px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.brand h1 { font-size: 19px; margin: 0 0 4px; color: #1f2d3d; }
.brand p { font-size: 12px; color: #8492a6; margin: 0; line-height: 1.5; }
.login-btn { width: 100%; margin-top: 4px; }
.demo-accounts { display: flex; flex-wrap: wrap; gap: 8px; }
.demo-tag { cursor: pointer; }
.tip { font-size: 12px; color: #99a9bf; margin-top: 16px; line-height: 1.6; }
</style>
