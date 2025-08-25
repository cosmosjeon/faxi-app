'use strict';

try {
  console.log('[SW] Service Worker 초기화 시작');

  importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

  let firebaseConfig = null;
  let messaging = null;
  let messagingInitialized = false;

  self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'FIREBASE_CONFIG') {
      firebaseConfig = event.data.config;
      console.log('[SW] Firebase 설정 수신 완료');
      if (firebaseConfig && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('[SW] Firebase 앱 초기화 완료 (동적)');
        initializeMessaging();
      }
    }
  });

  function initializeMessaging() {
    if (messagingInitialized) return;
    try {
      if (firebase.apps.length) {
        messaging = firebase.messaging();
        messagingInitialized = true;
        console.log('[SW] Firebase Messaging 초기화 완료');
        attachBackgroundMessageHandler();
      }
    } catch (e) {
      console.error('[SW] Firebase Messaging 초기화 실패:', e);
    }
  }

  if (firebase.apps && firebase.apps.length) {
    initializeMessaging();
  } else {
    console.log('[SW] Firebase 설정 대기중...');
  }

  function getNotificationActions(messageType) {
    switch (messageType) {
      case 'friend_request':
      case 'close_friend_request':
        return [
          { action: 'accept', title: '수락' },
          { action: 'decline', title: '거절' }
        ];
      case 'new_message':
        return [
          { action: 'print', title: '프린트' },
          { action: 'reject', title: '거절' }
        ];
      case 'auto_print_status':
        return [];
      case 'close_friend_message':
      case 'auto_print_notification':
        return [
          { action: 'view', title: '확인' },
          { action: 'close', title: '닫기' }
        ];
      default:
        return [
          { action: 'open', title: '확인하기' },
          { action: 'close', title: '닫기' }
        ];
    }
  }

  function attachBackgroundMessageHandler() {
    if (!messaging) return;
    messaging.onBackgroundMessage((payload) => {
      const receiveTime = new Date().toLocaleTimeString();
      console.log(`[${receiveTime}] 백그라운드 메시지 수신:`, payload);

      const { notification, data } = payload;
      const senderProfileImage = data?.senderProfileImage || '/icons/default-avatar.jpg';

      const notificationOptions = {
        body: notification?.body || '새 메시지가 도착했습니다',
        icon: senderProfileImage,
        badge: '/icons/faxi-badge.png',
        tag: `faxi-${data?.type || 'message'}-${data?.senderId || 'unknown'}`,
        renotify: true,
        requireInteraction: data?.type === 'new_message',
        image: data?.messageImage,
        data: {
          ...data,
          url: data?.url || '/',
          timestamp: Date.now(),
          senderId: data?.senderId,
          messageId: data?.messageId
        },
        actions: getNotificationActions(data?.type)
      };

      const title = notification?.title || 'FAXI';
      console.log('알림 표시 시도:', title, notificationOptions);

      self.registration.showNotification(title, notificationOptions)
        .then(() => console.log('✅ 알림 표시 성공:', title))
        .catch((error) => console.error('❌ 알림 표시 실패:', error));
    });
  }

  self.addEventListener('notificationclick', (event) => {
    const { action, notification } = event;
    const data = notification.data || {};
    event.notification.close();
    if (action === 'close') return;
    const urlMap = {
      accept: `/friends/requests?action=accept&requestId=${data.requestId || ''}`,
      decline: `/friends/requests?action=decline&requestId=${data.requestId || ''}`,
      print: `/home?action=approve&messageId=${data.messageId || ''}`,
      reject: `/home?action=reject&messageId=${data.messageId || ''}`,
      view: `/home?messageId=${data.messageId || ''}`
    };
    let urlToOpen = urlMap[action];
    if (!urlToOpen) {
      const typeMap = {
        friend_request: '/friends/requests',
        close_friend_request: '/friends/requests',
        new_message: `/home?messageId=${data.messageId || ''}`,
        close_friend_message: `/home?messageId=${data.messageId || ''}`,
        auto_print_notification: `/home?messageId=${data.messageId || ''}`,
        auto_print_status: `/home?messageId=${data.messageId || ''}`
      };
      urlToOpen = typeMap[data.type] || data.url || '/';
    }
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            if (client.url.includes(self.location.origin)) {
              client.focus();
              if ('navigate' in client) client.navigate(urlToOpen);
              return;
            }
          }
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
    );
  });

  self.addEventListener('message', (event) => {
    console.log('[SW] 메시지 수신:', event.data);
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  });

  self.addEventListener('install', () => {
    console.log('[SW] FAXI Service Worker 설치됨');
    self.skipWaiting();
  });
  self.addEventListener('activate', (event) => {
    console.log('[SW] FAXI Service Worker 활성화됨');
    event.waitUntil(self.clients.claim());
  });

  self.addEventListener('notificationclose', (event) => {
    console.log('알림 닫힘:', event.notification.tag);
  });

  self.addEventListener('push', (event) => {
    if (!event.data) return;
    try {
      const payload = event.data.json();
      console.log('푸시 이벤트 수신:', payload);
      if (!payload.notification) {
        const notificationOptions = {
          body: payload.body || '새 알림이 있습니다',
          icon: payload.data?.senderProfileImage || '/icons/default-avatar.jpg',
          badge: '/icons/faxi-badge.png',
          tag: `faxi-push-${payload.data?.senderId || 'unknown'}`,
          data: payload.data
        };
        event.waitUntil(
          self.registration.showNotification(
            payload.title || 'FAXI',
            notificationOptions
          )
        );
      }
    } catch (error) {
      console.error('푸시 데이터 파싱 오류:', error);
    }
  });

} catch (error) {
  console.error('Firebase Service Worker 초기화 오류:', error);
}

// Firebase 푸시 알림용 Service Worker
// TWA 환경 지원 버전

try {
  console.log('[SW] Service Worker 초기화 시작');
  
  // Firebase SDK 임포트 (안정적인 v10 버전 사용)
  importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');
  
  // TWA 환경 감지
  const isTWAEnvironment = () => {
    return self.location.hostname === 'faxi-app.vercel.app';
  };
  
  // Firebase 설정을 메인 앱에서 동적으로 받아오기
  let firebaseConfig = null;
  let messaging = null;
  let messagingInitialized = false;
  
  // Service Worker 메시지로 Firebase 설정 받기
  self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'FIREBASE_CONFIG') {
      firebaseConfig = event.data.config;
      console.log('[SW] Firebase 설정 수신 완료');
      
      // Firebase 초기화
      if (firebaseConfig && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('[SW] Firebase 앱 초기화 완료 (동적)');
        initializeMessaging();
      }
    }
  });
  
  function initializeMessaging() {
    if (messagingInitialized) return;
    try {
      if (firebase.apps.length) {
        messaging = firebase.messaging();
        messagingInitialized = true;
        console.log('[SW] Firebase Messaging 초기화 완료');
        attachBackgroundMessageHandler();
      }
    } catch (e) {
      console.error('[SW] Firebase Messaging 초기화 실패:', e);
    }
  }

  // 앱이 설정을 보내기 전에 로드되는 경우가 있어, 이미 초기화되었는지 한 번 더 시도
  if (firebase.apps && firebase.apps.length) {
    initializeMessaging();
  } else {
    console.log('[SW] Firebase 설정 대기중...');
  }

  // 백그라운드 메시지 처리
  function attachBackgroundMessageHandler() {
    if (!messaging) return;
    messaging.onBackgroundMessage((payload) => {
      const receiveTime = new Date().toLocaleTimeString();
      console.log(`[${receiveTime}] 백그라운드 메시지 수신:`, payload);

      const { notification, data } = payload;
      const senderProfileImage = data?.senderProfileImage || '/icons/default-avatar.jpg';
      
      const notificationOptions = {
        body: notification?.body || '새 메시지가 도착했습니다',
        icon: senderProfileImage,
        badge: '/icons/faxi-badge.png',
        tag: `faxi-${data?.type || 'message'}-${data?.senderId || 'unknown'}`,
        renotify: true,
        requireInteraction: data?.type === 'new_message',
        image: data?.messageImage,
        data: {
          ...data,
          url: data?.url || '/',
          timestamp: Date.now(),
          senderId: data?.senderId,
          messageId: data?.messageId
        },
        actions: getNotificationActions(data?.type)
      };

      const title = notification?.title || 'FAXI';
      console.log('알림 표시 시도:', title, notificationOptions);
      
      self.registration.showNotification(title, notificationOptions)
        .then(() => {
          console.log('✅ 알림 표시 성공:', title);
        })
        .catch((error) => {
          console.error('❌ 알림 표시 실패:', error);
        });
    });
  }

} catch (error) {
  console.error('Firebase Service Worker 초기화 오류:', error);
}

// 메시지 타입별 액션 버튼 (함수 호이스팅 활용)
function getNotificationActions(messageType) {
  switch (messageType) {
    case 'friend_request':
    case 'close_friend_request':
      return [
        { action: 'accept', title: '수락' },
        { action: 'decline', title: '거절' }
      ];
    
    case 'new_message':
      return [
        { action: 'print', title: '프린트' },
        { action: 'reject', title: '거절' }
      ];
    
    case 'auto_print_status':
      // 자동 출력 상태 알림은 버튼 없음
      return [];
    
    case 'close_friend_message':
    case 'auto_print_notification':
      return [
        { action: 'view', title: '확인' },
        { action: 'close', title: '닫기' }
      ];
    
    default:
      return [
        { action: 'open', title: '확인하기' },
        { action: 'close', title: '닫기' }
      ];
  }
}

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  const { action, notification } = event;
  const data = notification.data || {};

  event.notification.close();

  if (action === 'close') return;

  // 액션별 URL 매핑
  const urlMap = {
    accept: `/friends/requests?action=accept&requestId=${data.requestId || ''}`,
    decline: `/friends/requests?action=decline&requestId=${data.requestId || ''}`,
    print: `/home?action=approve&messageId=${data.messageId || ''}`,
    reject: `/home?action=reject&messageId=${data.messageId || ''}`,
    view: `/home?messageId=${data.messageId || ''}`
  };

  let urlToOpen = urlMap[action];
  
  if (!urlToOpen) {
    // 기본 동작
    const typeMap = {
      friend_request: '/friends/requests',
      close_friend_request: '/friends/requests',
      new_message: `/home?messageId=${data.messageId || ''}`,
      close_friend_message: `/home?messageId=${data.messageId || ''}`,
      auto_print_notification: `/home?messageId=${data.messageId || ''}`,
      auto_print_status: `/home?messageId=${data.messageId || ''}`
    };
    
    urlToOpen = typeMap[data.type] || data.url || '/';
  }

  // 앱 열기 또는 포커스
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 기존 탭 찾기 및 포커스
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            if ('navigate' in client) {
              client.navigate(urlToOpen);
            }
            return;
          }
        }
        
        // 새 탭 열기
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Service Worker 메시지 처리 (TWA 지원)
self.addEventListener('message', (event) => {
  console.log('[SW] 메시지 수신:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING 실행');
    self.skipWaiting();
  }
});

// Service Worker 생명주기
self.addEventListener('install', (event) => {
  console.log('[SW] FAXI Service Worker 설치됨');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] FAXI Service Worker 활성화됨');
  event.waitUntil(self.clients.claim());
});

// 알림 닫기 처리
self.addEventListener('notificationclose', (event) => {
  console.log('알림 닫힘:', event.notification.tag);
});

// 추가 푸시 이벤트 처리 (백업)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const payload = event.data.json();
    console.log('푸시 이벤트 수신:', payload);
    
    // Firebase messaging이 처리하지 못한 경우
    if (!payload.notification) {
      const notificationOptions = {
        body: payload.body || '새 알림이 있습니다',
        icon: payload.data?.senderProfileImage || '/icons/default-avatar.jpg',
        badge: '/icons/faxi-badge.png',
        tag: `faxi-push-${payload.data?.senderId || 'unknown'}`,
        data: payload.data
      };
      
      event.waitUntil(
        self.registration.showNotification(
          payload.title || 'FAXI',
          notificationOptions
        )
      );
    }
  } catch (error) {
    console.error('푸시 데이터 파싱 오류:', error);
  }
});