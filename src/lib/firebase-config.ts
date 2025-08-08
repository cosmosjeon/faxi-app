// Firebase 푸시 알림 설정 및 관리
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

// Firebase 설정 검증
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Firebase 설정 유효성 검사
function validateFirebaseConfig() {
  const required = ['apiKey', 'authDomain', 'projectId', 'messagingSenderId', 'appId'];
  const missing = required.filter(key => !firebaseConfig[key]);
  
  console.log('Firebase 설정 검증:', {
    apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : '없음',
    authDomain: firebaseConfig.authDomain || '없음',
    projectId: firebaseConfig.projectId || '없음',
    messagingSenderId: firebaseConfig.messagingSenderId || '없음',
    appId: firebaseConfig.appId ? `${firebaseConfig.appId.substring(0, 20)}...` : '없음'
  });
  
  if (missing.length > 0) {
    console.error('❌ Firebase 설정 누락:', missing);
    return false;
  }
  console.log('✅ Firebase 설정 검증 완료');
  return true;
}

// Firebase 앱 초기화 (안전한 버전)
let app = null;
try {
  if (validateFirebaseConfig()) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    console.log('✅ Firebase 앱 초기화 완료:', app.name);
  } else {
    console.error('❌ Firebase 설정이 유효하지 않음');
  }
} catch (error) {
  console.error('❌ Firebase 앱 초기화 실패:', error);
}

// 브라우저 환경에서만 메시징 초기화
export const getFirebaseMessaging = async () => {
  if (typeof window !== 'undefined' && await isSupported() && app) {
    return getMessaging(app);
  }
  console.error('Firebase Messaging 초기화 불가:', {
    isWindow: typeof window !== 'undefined',
    isSupported: await isSupported(),
    hasApp: !!app
  });
  return null;
};

// FCM 토큰 발급 (디버깅 강화 버전)
export const getFCMToken = async (): Promise<string | null> => {
  try {
    console.log('Firebase 설정 확인:', {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '설정됨' : '없음',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ? '설정됨' : '없음'
    });

    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      console.error('Firebase Messaging 초기화 실패');
      return null;
    }
    
    console.log('Firebase Messaging 초기화 성공, 토큰 발급 시도...');
    
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
    });
    
    if (token) {
      console.log('✅ FCM 토큰 발급 성공:', token.substring(0, 20) + '...');
      return token;
    } else {
      console.error('❌ FCM 토큰 발급 실패: 토큰이 null');
      return null;
    }
  } catch (error) {
    console.error('❌ FCM 토큰 발급 중 오류:', error);
    console.error('에러 상세:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
    return null;
  }
};

// 알림 권한 요청 (간단 버전)
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) return false;
  
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

// 포그라운드 메시지 수신 처리 (개선된 버전)
export const setupForegroundMessaging = (
  onMessageReceived: (payload: any) => void
) => {
  getFirebaseMessaging().then(messaging => {
    if (messaging) {
      onMessage(messaging, (payload) => {
        console.log('포그라운드 메시지 수신:', payload);
        
        // 메시지 타입별 처리
        const { notification, data } = payload;
        
        // 커스텀 핸들러 호출
        onMessageReceived({
          title: notification?.title || 'FAXI',
          body: notification?.body || '새 메시지가 도착했습니다',
          type: data?.type || 'message',
          messageId: data?.messageId,
          senderId: data?.senderId,
          timestamp: Date.now(),
          ...data
        });
      });
    }
  });
};

// Service Worker 등록 (Next.js PWA용)
export const registerServiceWorker = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    // 먼저 간단한 테스트 Service Worker 등록
    console.log('Service Worker 등록 시도...');
    const registration = await navigator.serviceWorker.register(
      '/test-sw.js',
      { scope: '/' }
    );
    
    console.log('✅ 테스트 Service Worker 등록 성공:', registration);
    
    // 테스트 성공 후 실제 Firebase Service Worker 등록
    await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ Firebase Service Worker 등록 성공');
    return true;
  } catch (error) {
    console.error('❌ Service Worker 등록 실패:', error);
    return false;
  }
};