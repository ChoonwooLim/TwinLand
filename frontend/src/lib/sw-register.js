/* Service Worker 등록 + 강제 update 핸들러.
 *
 * 사용:
 *   import { registerSW } from './lib/sw-register.js';
 *   registerSW({ onUpdate: () => toast('새 버전이 있어요'), autoReloadDelayMs: 3000 });
 *
 * 동작:
 *   - 페이지 로드 시 /sw.js 등록
 *   - 60초마다 reg.update() 호출 → 새 빌드 자동 감지
 *   - 새 SW 가 installed/activated 시 onUpdate 콜백 + 자동 reload (옵션)
 */

const UPDATE_CHECK_INTERVAL_MS = 60_000;

export function registerSW({ onUpdate = null, autoReloadDelayMs = 0 } = {}) {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  // file:// 등 비 HTTPS 환경 (localhost 제외) 에선 SW 등록 안 됨 — 브라우저가 알아서 처리

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.info('[sw] registered:', reg.scope);

      // 주기적으로 새 빌드 확인
      setInterval(() => {
        reg.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL_MS);

      // 페이지가 다시 visible 될 때도 한번 더 확인
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });

      // 새 SW 가 installed 되면 알림
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // 첫 SW 가 아니라 NEW 버전이 대기 중
            handleUpdate(reg, onUpdate, autoReloadDelayMs);
          }
        });
      });
    } catch (e) {
      console.warn('[sw] register failed:', e);
    }
  });

  // 활성화된 SW 가 'NEW_VERSION' 메시지 보내면 자동 reload (안전망)
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type !== 'NEW_VERSION') return;
    console.info('[sw] NEW_VERSION received:', event.data.version);
    if (typeof onUpdate === 'function') {
      onUpdate({ version: event.data.version });
    }
    if (autoReloadDelayMs > 0) {
      setTimeout(() => window.location.reload(), autoReloadDelayMs);
    }
  });
}

function handleUpdate(reg, onUpdate, autoReloadDelayMs) {
  if (typeof onUpdate === 'function') onUpdate({ reg });
  const waitingWorker = reg.waiting;
  if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  if (autoReloadDelayMs > 0) {
    setTimeout(() => window.location.reload(), autoReloadDelayMs);
  }
}
