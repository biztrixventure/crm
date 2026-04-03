import axios from 'axios';
import { useAuthStore } from '../store/auth';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore.getState();
      // Don't logout if it's a TOTP-related response
      if (!error.response?.data?.totp_required) {
        authStore.logout();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
