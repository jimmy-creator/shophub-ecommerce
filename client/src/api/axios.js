import axios from 'axios';
import { STAFF_BASE } from '../lib/staffBase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

// No Bearer token — authentication is via httpOnly cookie only
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect to login if user was logged in and session expired
    // Don't redirect for initial profile checks or public pages
    // Staff/POS screens have their own cashier session and their own login
    // route. If a storefront login ever happened on this machine, localStorage
    // .user is set and this handler would fling a cashier whose shift expired
    // onto the customer /login page. Leave those paths to the POS handler.
    if (window.location.pathname.startsWith(STAFF_BASE)) return Promise.reject(error);

    if (error.response?.status === 401 && error.config?.url !== '/auth/profile') {
      const hadUser = localStorage.getItem('user');
      if (hadUser) {
        localStorage.removeItem('user');
        if (!['/login', '/register', '/forgot-password', '/', '/products'].includes(window.location.pathname) &&
            !window.location.pathname.startsWith('/product/')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
