<template>
  <div class="auth-page">
    <el-card class="auth-card">
      <div class="auth-logo">
        <div class="name">注册账号</div>
        <div class="sub">注册后可预约上门理疗服务</div>
      </div>
      <el-form :model="form">
        <el-form-item>
          <el-input v-model="form.name" placeholder="姓名" size="large" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.phone" placeholder="手机号" size="large" maxlength="11" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码（6-32位）" size="large" show-password />
        </el-form-item>
        <el-form-item>
          <el-radio-group v-model="form.role">
            <el-radio value="USER">我是用户</el-radio>
            <el-radio value="THERAPIST">我是技师</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-button type="primary" size="large" style="width: 100%" :loading="loading" @click="submit">
          注 册
        </el-button>
      </el-form>
      <div class="mt16" style="text-align: right">
        <el-button link type="primary" @click="$router.push('/login')">已有账号？去登录</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { register } from '../api';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const loading = ref(false);
const form = reactive({ name: '', phone: '', password: '', role: 'USER' });

const submit = async () => {
  if (!form.name || !form.phone || !form.password) return ElMessage.warning('请填写完整信息');
  loading.value = true;
  try {
    const res = await register(form);
    auth.setAuth(res.token, res.user);
    ElMessage.success('注册成功');
    router.push(auth.homePath);
  } finally {
    loading.value = false;
  }
};
</script>
