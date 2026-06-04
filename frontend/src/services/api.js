import axios from 'axios';
const API_BASE_URL = "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Helper to show a beautiful global rate limit toast notification
const showRateLimitToast = (message) => {
  let container = document.getElementById('rate-limit-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'rate-limit-toast-container';
    container.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.cssText = `
    min-width: 320px;
    max-width: 400px;
    background: rgba(15, 23, 42, 0.95);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(239, 68, 68, 0.35);
    border-left: 4px solid #ef4444;
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5), 0 0 15px rgba(239, 68, 68, 0.15);
    color: #f1f5f9;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    pointer-events: auto;
    transform: translateX(120%);
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
    opacity: 0;
  `;

  toast.innerHTML = `
    <div style="font-size: 20px; line-height: 1;">⚠️</div>
    <div style="flex: 1; min-width: 0;">
      <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #fecaca;">Rate Limit Exceeded</div>
      <div style="font-size: 12px; line-height: 1.5; color: #cbd5e1;">${message || 'You have sent too many requests. Please slow down and try again later.'}</div>
    </div>
    <button style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0; font-size: 14px; outline: none;" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(toast);

  // Trigger reflow to start transition
  toast.offsetHeight;

  // Slide in
  toast.style.transform = 'translateX(0)';
  toast.style.opacity = '1';

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.transform = 'translateX(120%)';
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 400);
    }
  }, 5000);
};

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = sessionStorage.getItem('refresh_token');
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, null, {
          params: { token: refreshToken }
        });
        const newAccessToken = response.data.access_token;
        sessionStorage.setItem('access_token', newAccessToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        sessionStorage.removeItem('access_token');
        sessionStorage.removeItem('refresh_token');
        sessionStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    // Global handling for 429 rate limit exceeded
    if (error.response?.status === 429) {
      const message = error.response.data?.detail || error.response.data?.error || 'Too many requests. Please try again later.';
      showRateLimitToast(message);
    }
    
    return Promise.reject(error);
  }
);

export default api;