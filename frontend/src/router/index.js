import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  { path: '/login', component: () => import('../views/Login.vue'), meta: { public: true } },
  { path: '/register', component: () => import('../views/Register.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    children: [
      // 用户端
      { path: 'home', component: () => import('../views/user/UserHome.vue'), meta: { role: 'USER' } },
      { path: 'book', component: () => import('../views/user/BookingCreate.vue'), meta: { role: 'USER' } },
      { path: 'records', component: () => import('../views/user/MyRecords.vue'), meta: { role: 'USER' } },
      { path: 'profile', component: () => import('../views/user/MyProfile.vue'), meta: { role: 'USER' } },
      // 技师端
      { path: 'queue', component: () => import('../views/therapist/TherapistQueue.vue'), meta: { role: 'THERAPIST' } },
      { path: 'orders', component: () => import('../views/therapist/TherapistOrders.vue'), meta: { role: 'THERAPIST' } },
      { path: 'tprofile', component: () => import('../views/therapist/TherapistProfile.vue'), meta: { role: 'THERAPIST' } },
      // 管理端
      { path: 'admin', component: () => import('../views/admin/AdminDashboard.vue'), meta: { role: 'ADMIN' } },
      { path: 'admin/records', component: () => import('../views/admin/AdminRecords.vue'), meta: { role: 'ADMIN' } },
      { path: 'admin/exceptions', component: () => import('../views/admin/AdminExceptions.vue'), meta: { role: 'ADMIN' } },
      { path: 'admin/settlements', component: () => import('../views/admin/AdminSettlements.vue'), meta: { role: 'ADMIN' } },
      { path: 'admin/items', component: () => import('../views/admin/AdminItems.vue'), meta: { role: 'ADMIN' } },
      { path: 'admin/users', component: () => import('../views/admin/AdminUsers.vue'), meta: { role: 'ADMIN' } },
      // 共享：记录详情
      { path: 'records/:id', component: () => import('../views/shared/RecordDetail.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.public) {
    if (auth.isLoggedIn && (to.path === '/login' || to.path === '/register')) return auth.homePath;
    return true;
  }
  if (!auth.isLoggedIn) return '/login';
  if (to.path === '/') return auth.homePath;
  if (to.meta.role && auth.role !== to.meta.role) return auth.homePath;
  return true;
});

export default router;
