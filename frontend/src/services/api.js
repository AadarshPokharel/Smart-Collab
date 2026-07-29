import axios from 'axios';

const normalizeApiUrl = (value = '') => value.trim().replace(/\/+$/, '');

const resolveApiUrl = () => {
  const configuredUrl = normalizeApiUrl(process.env.REACT_APP_API_URL || '');

  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000/api';
    }

    return `${origin}/api`;
  }

  return 'http://localhost:5000/api';
};

export const API_URL = resolveApiUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || '';
    const isAuthRequest =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/google') ||
      requestUrl.includes('/auth/firebase') ||
      requestUrl.includes('/auth/forgot-password') ||
      requestUrl.includes('/auth/reset-password');

    if (error.response?.status === 401 && !isAuthRequest) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
