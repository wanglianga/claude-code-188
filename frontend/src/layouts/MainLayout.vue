<template>
  <el-container style="min-height: 100vh">
    <el-header class="topbar">
      <div class="brand" @click="$router.push('/')">
        <span class="logo">康</span>
        <span class="name">社区上门理疗平台</span>
      </div>
      <el-menu
        :default-active="$route.path"
        mode="horizontal"
        :ellipsis="false"
        router
        class="nav"
      >
        <template v-if="auth.role === 'USER'">
          <el-menu-item index="/home">服务预约</el-menu-item>
          <el-menu-item index="/records">我的服务记录</el-menu-item>
          <el-menu-item index="/profile">健康档案</el-menu-item>
        </template>
        <template v-else-if="auth.role === 'THERAPIST'">
          <el-menu-item index="/queue">待接订单</el-menu-item>
          <el-menu-item index="/orders">我的订单</el-menu-item>
          <el-menu-item index="/tprofile">技师档案</el-menu-item>
        </template>
        <template v-else-if="auth.role === 'ADMIN'">
          <el-menu-item index="/admin">运营看板</el-menu-item>
          <el-menu-item index="/admin/records">服务记录</el-menu-item>
          <el-menu-item index="/admin/exceptions">异常处理</el-menu-item>
          <el-menu-item index="/admin/settlements">结算退款</el-menu-item>
          <el-menu-item index="/admin/items">项目管理</el-menu-item>
          <el-menu-item index="/admin/users">账号管理</el-menu-item>
        </template>
      </el-menu>
      <div class="user-box">
        <el-tag size="small" effect="plain">{{ roleLabel }}</el-tag>
        <span class="uname">{{ auth.user?.name }}</span>
        <el-button link type="danger" @click="logout">退出</el-button>
      </div>
    </el-header>
    <el-main style="padding: 0">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const roleLabel = computed(
  () => ({ USER: '用户', THERAPIST: '技师', ADMIN: '管理员' }[auth.role] || ''),
);
const logout = () => {
  auth.logout();
  router.push('/login');
};
</script>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  gap: 24px;
  background: #fff;
  border-bottom: 1px solid #e5ecea;
  position: sticky;
  top: 0;
  z-index: 10;
}
.brand { display: flex; align-items: center; gap: 8px; cursor: pointer; white-space: nowrap; }
.logo {
  width: 30px; height: 30px; border-radius: 8px;
  background: var(--brand); color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 700;
}
.name { font-weight: 700; color: var(--brand-dark); }
.nav { flex: 1; border-bottom: none; }
.user-box { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.uname { font-size: 14px; }
</style>
