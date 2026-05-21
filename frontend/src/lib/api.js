import axios from 'axios';

// Vite 프록시가 /api 를 백엔드로 전달하므로 baseURL 은 상대 경로
export const api = axios.create({
  baseURL: '',
  withCredentials: true,
  headers: {
    'X-Requested-With': 'twinland',
  },
});

let isRefreshing = false;
let pendingQueue = [];

function runQueue(err) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (err) reject(err);
    else resolve();
  });
  pendingQueue = [];
}

function onAuthFailure() {
  // 전역 이벤트 트리거 — AuthContext 가 듣고 로그아웃 처리
  window.dispatchEvent(new CustomEvent('twinland:auth-failure'));
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (!original || !error.response) throw error;

    const url = original.url || '';
    // refresh 자체가 실패했거나 auth 엔드포인트면 재시도 금지
    if (url.includes('/api/auth/refresh') || url.includes('/api/auth/login')) {
      if (error.response.status === 401) onAuthFailure();
      throw error;
    }

    if (error.response.status !== 401 || original._retried) throw error;
    original._retried = true;

    if (isRefreshing) {
      await new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      });
      return api(original);
    }

    isRefreshing = true;
    try {
      await api.post('/api/auth/refresh');
      runQueue(null);
      return api(original);
    } catch (e) {
      runQueue(e);
      onAuthFailure();
      throw e;
    } finally {
      isRefreshing = false;
    }
  },
);
