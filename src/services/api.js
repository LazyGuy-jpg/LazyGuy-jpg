import axios from 'axios';

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.flowvoip.dev';

const api = axios.create({
  baseURL: `${apiBaseUrl}/v2`,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 20000
});

// Attach API key automatically if stored in localStorage
api.interceptors.request.use(config => {
  const apikey = localStorage.getItem('apikey');
  if (apikey) {
    config.headers['x-api-key'] = apikey;
  }
  return config;
});

export default api;