import axios from 'axios';
import { useAuthStore } from '../../stores/authStore';

// Create base Axios instance
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to inject JWT token
apiClient.interceptors.request.use(
  (config) => {
    const { token } = useAuthStore.getState();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // An expired or revoked sign-in: back to the sign-in page, which says why and returns here.
    // A 401 from /auth/login itself is a wrong password, not an expired session.
    if (error.response?.status === 401 && !String(error.config?.url || '').includes('/auth/login')) {
      useAuthStore.getState().expireSession(window.location.pathname + window.location.search);
    }
    return Promise.reject(error);
  }
);
