// TwinLand Service Worker — 최소 구성 (오프라인 캐싱 X, 강제 update 만)
//
// 동작:
//   1) install: skipWaiting → 대기 상태 건너뛰고 즉시 활성화
//   2) activate: 모든 클라이언트 점유 + 'NEW_VERSION' 메시지 broadcast
//   3) fetch: HTML 요청은 항상 네트워크 우선 (캐시 무시) → 모바일 fresh 보장
//
// 빌드 시 postbuild 스크립트가 BUILD_VERSION 문자열을 timestamp 로 치환.
const BUILD_VERSION = '__BUILD_VERSION__';

self.addEventListener('install', (event) => {
  // 새 SW 가 설치되면 즉시 활성화 (기존 SW 대기 안 함)
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 1) 기존 페이지 즉시 점유
    await self.clients.claim();
    // 2) 모든 페이지에 "새 버전" 알림 → 페이지가 toast 띄우거나 reload
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((c) => c.postMessage({ type: 'NEW_VERSION', version: BUILD_VERSION }));
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // navigation (HTML) 요청은 항상 네트워크 우선 — 캐시 무시
  if (req.mode === 'navigate' || (req.method === 'GET' && req.destination === 'document')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() => caches.match(req))
    );
  }
  // 그 외 (해시 자산·API·이미지) 는 SW 가 개입 안 함 → 기본 브라우저 캐시 정책
});

// 페이지에서 'SKIP_WAITING' 메시지 보내면 새 SW 활성화 (사용자 클릭 후 즉시 reload 용)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
