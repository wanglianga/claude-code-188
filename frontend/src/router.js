import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  { path: '/login', component: () => import('./views/Login.vue') },
  {
    path: '/user',
    component: () => import('./views/user/Layout.vue'),
    meta: { role: 'user' },
    children: [
      { path: '', redirect: '/user/records' },
      { path: 'booking', component: () => import('./views/user/Booking.vue') },
      { path: 'records', component: () => import('./views/user/MyRecords.vue') },
      { path: 'records/:id', component: () => import('./components/RecordDetail.vue') },
    ],
  },
  {
    path: '/therapist',
    component: () => import('./views/therapist/Layout.vue'),
    meta: { role: 'therapist' },
    children: [
      { path: '', redirect: '/therapist/pending' },
      { path: 'pending', component: () => import('./views/therapist/PendingOrders.vue') },
      { path: 'mine', component: () => import('./views/therapist/MyOrders.vue') },
      { path: 'records/:id', component: () => import('./components/RecordDetail.vue') },
    ],
  },
  {
    path: '/admin',
    component: () => import('./views/admin/Layout.vue'),
    meta: { role: 'admin' },
    children: [
      { path: '', redirect: '/admin/dashboard' },
      { path: 'dashboard', component: () => import('./views/admin/Dashboard.vue') },
      { path: 'dispatch', component: () => import('./views/admin/Dispatch.vue') },
      { path: 'incidents', component: () => import('./views/admin/Incidents.vue') },
      { path: 'settlements', component: () => import('./views/admin/Settlements.vue') },
      { path: 'refunds', component: () => import('./views/admin/Refunds.vue') },
      { path: 'records/:id', component: () => import('./components/RecordDetail.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/login' },
];

const router = createRouter({ history: createWebHashHistory(), routes });

router.beforeEach((to) => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (to.path === '/login') return true;
  if (!token) return '/login';
  const roleRoot = `/${user.role}`;
  if (!to.path.startsWith(roleRoot)) return roleRoot;
  return true;
});

export default router;
