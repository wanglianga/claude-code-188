import axios from 'axios';
import { ElMessage } from 'element-plus';
import router from './router';

const api = axios.create({ baseURL: '/api', timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg = err.response?.data?.message || err.message || '网络错误';
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (router.currentRoute.value.path !== '/login') {
        ElMessage.error('登录已失效，请重新登录');
        router.push('/login');
      }
    } else {
      ElMessage.error(Array.isArray(msg) ? msg.join('；') : msg);
    }
    return Promise.reject(err);
  },
);

// ---- 认证 ----
export const login = (data) => api.post('/auth/login', data);
export const register = (data) => api.post('/auth/register', data);

// ---- 档案 ----
export const getMyProfile = () => api.get('/health-profiles/me');
export const saveMyProfile = (data) => api.put('/health-profiles/me', data);
export const getMyTherapistProfile = () => api.get('/therapist-profiles/me');
export const saveMyTherapistProfile = (data) => api.put('/therapist-profiles/me', data);

// ---- 目录 ----
export const listServiceItems = (params) => api.get('/service-items', { params });
export const createServiceItem = (data) => api.post('/service-items', data);
export const updateServiceItem = (id, data) => api.put(`/service-items/${id}`, data);

// ---- 记录 ----
export const createRecord = (data) => api.post('/records', data);
export const myRecords = () => api.get('/records/my');
export const myCourses = () => api.get('/records/my-courses');
export const recordDetail = (id) => api.get(`/records/${id}`);
export const cancelRecord = (id) => api.post(`/records/${id}/cancel`);
export const adminRecords = (params) => api.get('/records', { params });
export const dispatchRecord = (id, data) => api.post(`/records/${id}/dispatch`, data);
export const therapistQueue = () => api.get('/records/queue');
export const therapistOrders = () => api.get('/records/my-orders');
export const respondDispatch = (id, data) => api.post(`/records/${id}/respond`, data);
export const checkin = (id, data) => api.post(`/records/${id}/checkin`, data);
export const updateVisit = (id, data) => api.put(`/records/${id}/visit`, data);
export const addItems = (id, data) => api.post(`/records/${id}/items`, data);
export const completeVisit = (id) => api.post(`/records/${id}/complete-visit`);
export const addFollowUp = (id, data) => api.post(`/records/${id}/follow-ups`, data);
export const addReferral = (id, data) => api.post(`/records/${id}/referrals`, data);

// ---- 异常 ----
export const reportException = (recordId, data) => api.post(`/records/${recordId}/exceptions`, data);
export const listExceptions = (params) => api.get('/exceptions', { params });
export const handleException = (id, data) => api.post(`/exceptions/${id}/handle`, data);

// ---- 结算 ----
export const paySettlement = (recordId, data) => api.post(`/records/${recordId}/settlement/pay`, data);
export const requestRefund = (recordId, data) => api.post(`/records/${recordId}/settlement/refund-request`, data);
export const listSettlements = (params) => api.get('/settlements', { params });
export const handleRefund = (id, data) => api.post(`/settlements/${id}/refund`, data);

// ---- 统计 / 系统 ----
export const statsOverview = () => api.get('/stats/overview');
export const statsByTherapist = () => api.get('/stats/by-therapist');
export const statsByServiceType = () => api.get('/stats/by-service-type');
export const statsExceptionsByType = () => api.get('/stats/exceptions-by-type');
export const listUsers = (params) => api.get('/users', { params });
export const listTherapists = () => api.get('/therapists');
export const setUserActive = (id, active) => api.patch(`/users/${id}/active`, { active });

export default api;
