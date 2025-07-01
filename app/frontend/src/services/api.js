import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE_URL = import.meta.env.PROD ? 'https://ilyost.com' : '';
const WEBAPI_BASE_URL = import.meta.env.PROD ? 'https://webapi.ilyost.com' : '';

// Create axios instance for main API
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create axios instance for web API (v2 endpoints)
const webApi = axios.create({
  baseURL: WEBAPI_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add any auth headers if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      window.location.href = '/login';
    } else if (error.response?.status === 403) {
      toast.error('Access forbidden');
    } else if (error.response?.status === 500) {
      toast.error('Server error. Please try again later.');
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (apikey) => api.post('/api/login', { apikey }),
  register: (data) => api.post('/api/register', data),
  logout: () => api.get('/api/logout'),
  checkRegistrationStatus: () => api.get('/api/admin/settings/registration-status'),
  adminLogin: (secret) => api.post('/api/admin', { secret }),
  adminLogout: () => api.post('/api/admin/logout'),
};

// User API
export const userAPI = {
  getUserData: () => api.get('/api/user/data'),
  updateSettings: (data) => api.post('/api/user/update-settings', data),
  getCallLogs: (params) => api.get('/api/call-logs', { params }),
  getCountryPrices: () => api.get('/api/user/country-prices'),
  getAnnouncements: () => api.get('/api/user/announcements'),
  getDocumentation: () => api.get('/api/user/documentation'),
  getBonusRules: () => api.get('/api/user/bonus-rules'),
};

// Payment API
export const paymentAPI = {
  getPaymentCurrencies: () => api.get('/api/payment-currencies'),
  createPayment: (data) => api.post('/api/create-payment', data),
};

// Admin API
export const adminAPI = {
  // Stats & Analytics
  getStats: () => api.get('/api/admin/stats'),
  getAnalytics: (range) => api.get('/api/admin/analytics', { params: { range } }),
  getCallStats: () => api.get('/api/admin/call-stats'),
  
  // User Management
  getApiKeys: () => api.get('/api/admin/api-keys'),
  createApiKey: () => api.post('/api/admin/create-apikey'),
  updateApiKey: (apikey, field, value) => 
    api.put(`/api/admin/api-keys/${apikey}/${field}`, { [field]: value }),
  banUser: (apikey) => api.put(`/api/admin/api-keys/${apikey}/ban`),
  disableUser: (apikey) => api.put(`/api/admin/api-keys/${apikey}/disable`),
  enableUser: (apikey) => api.put(`/api/admin/api-keys/${apikey}/enable`),
  deleteUser: (apikey) => api.delete(`/api/admin/api-keys/${apikey}`),
  
  // Registration Management
  getRegistrations: (params) => api.get('/api/admin/registrations', { params }),
  getRegistrationStats: () => api.get('/api/admin/registration-stats'),
  
  // Settings
  getSettings: () => api.get('/api/admin/settings'),
  updateSettings: (settings) => api.put('/api/admin/settings', settings),
  
  // Documentation
  getDocumentation: () => api.get('/api/admin/documentation'),
  createDocumentation: (data) => api.post('/api/admin/documentation', data),
  updateDocumentation: (id, content) => api.put(`/api/admin/documentation/${id}`, { content }),
  updateDocumentationVisibility: (id, isPublic) => 
    api.put(`/api/admin/documentation/${id}/visibility`, { isPublic }),
  deleteDocumentation: (id) => api.delete(`/api/admin/documentation/${id}`),
  
  // Country Prices
  getCountryPrices: () => api.get('/api/admin/country-prices'),
  createCountryPrice: (data) => api.post('/api/admin/country-prices', data),
  
  // Bonus Rules
  getBonusRules: () => api.get('/api/admin/bonus-rules'),
  createBonusRule: (data) => api.post('/api/admin/bonus-rules', data),
  updateBonusRule: (id, data) => api.put(`/api/admin/bonus-rules/${id}`, data),
  deleteBonusRule: (id) => api.delete(`/api/admin/bonus-rules/${id}`),
  
  // Call Logs
  getCallLogs: (params) => api.get('/api/admin/call-logs', { params }),
};

// Voice API (v2 endpoints)
export const voiceAPI = {
  createCall: (data) => webApi.post('/v2/create-call', data),
  playText: (data) => webApi.post('/v2/play-text', data),
  gatherText: (data) => webApi.post('/v2/gather-text', data),
  playAudio: (data) => webApi.post('/v2/play-audio', data),
  gatherAudio: (data) => webApi.post('/v2/gather-audio', data),
  gatherAlpha: (data) => webApi.post('/v2/gather-alpha', data),
  transfer: (data) => webApi.post('/v2/transfer', data),
  dtmf: (data) => webApi.post('/v2/dtmf', data),
  hangup: (data) => webApi.post('/v2/hangup', data),
  hold: (data) => webApi.post('/v2/hold', data),
  unhold: (data) => webApi.post('/v2/unhold', data),
  getBalance: (apikey) => webApi.post('/v2/balance', { apikey }),
  health: () => webApi.get('/v2/health'),
};

export default api;