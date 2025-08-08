// 간단한 Service Worker 테스트
console.log('Service Worker 테스트 시작');

// Firebase 없이 기본 테스트
self.addEventListener('install', (event) => {
  console.log('Service Worker 설치됨');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker 활성화됨');
  event.waitUntil(self.clients.claim());
});

console.log('Service Worker 테스트 완료');