<template>
  <el-container class="layout">
    <el-header class="header">
      <div class="h-left"><div class="logo-mini">康</div><span class="title">社区上门理疗 · 技师端</span></div>
      <div class="h-right"><span>{{ auth.user?.name }}</span><el-button link type="primary" @click="logout">退出</el-button></div>
    </el-header>
    <el-container>
      <el-aside width="190px" class="aside">
        <el-menu :default-active="route.path" router>
          <el-menu-item index="/therapist/pending"><el-icon><bell /></el-icon><span>待接单（风险与器械）</span></el-menu-item>
          <el-menu-item index="/therapist/mine"><el-icon><first-aid-kit /></el-icon><span>我的工单（上门服务）</span></el-menu-item>
        </el-menu>
      </el-aside>
      <el-main><router-view /></el-main>
    </el-container>
  </el-container>
</template>
<script setup>
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
const route = useRoute(); const router = useRouter(); const auth = useAuthStore();
function logout() { auth.logout(); router.push('/login'); }
</script>
<style scoped>
.layout { height: 100vh; }
.header { background: #fff; border-bottom: 1px solid #e5e9f2; display: flex; align-items: center; justify-content: space-between; }
.h-left { display: flex; align-items: center; gap: 10px; }
.logo-mini { width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg,#2c7be5,#27ae60); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; }
.title { font-weight: 700; color: #1f2d3d; }
.h-right { display: flex; align-items: center; gap: 12px; color: #5e6d82; }
.aside { background: #fff; border-right: 1px solid #e5e9f2; }
.el-main { background: #f5f7fa; }
</style>
