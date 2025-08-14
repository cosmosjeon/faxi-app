// Firebase 푸시 알림 설정 및 관리
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

// 개발 환경에서만 로그 출력
const devLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'production') console.log(...args);
};

// TWA 환경 감지 함수
const isTWA = () => {
  if (typeof window === 'undefined') return false;
  
  // TWA 환경 감지 로직들
  const userAgent = navigator.userAgent;
  const isWebView = /wv/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  const hasTWAPackage = /com\.cosmosjeon\.faxi/.test(userAgent);
  
  // URL 확인으로 TWA 감지
  const isTWAUrl = window.location.hostname === 'faxi-app.vercel.app' && 
                   document.referrer.includes('android-app://');
  
  return isAndroid && (isWebView || hasTWAPackage || isTWAUrl);
};

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
  
  devLog('Firebase 설정 검증:', {
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
  devLog('✅ Firebase 설정 검증 완료');
  return true;
}

// Firebase 앱 초기화 (안전한 버전)
let app = null;
try {
  if (validateFirebaseConfig()) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    devLog('✅ Firebase 앱 초기화 완료:', (app as any).name);
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

// FCM 토큰 발급 (TWA 환경 지원)
export const getFCMToken = async (): Promise<string | null> => {
  try {
    const twaEnv = isTWA();
    devLog('FCM 토큰 발급 시작:', {
      isTWA: twaEnv,
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
    
    devLog('Firebase Messaging 초기화 성공, 토큰 발급 시도...');
    
    // TWA 환경에서는 재시도 로직 추가
    let token = null;
    let retryCount = 0;
    const maxRetries = twaEnv ? 3 : 1;
    
    while (!token && retryCount < maxRetries) {
      try {
        token = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
        });
        
        if (!token && retryCount < maxRetries - 1) {
          devLog(`FCM 토큰 발급 재시도 ${retryCount + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        retryCount++;
      } catch (retryError) {
        devLog(`FCM 토큰 발급 시도 ${retryCount + 1} 실패:`, retryError);
        retryCount++;
        
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (token) {
      devLog('✅ FCM 토큰 발급 성공:', token.substring(0, 20) + '...', {
        환경: twaEnv ? 'TWA' : '웹',
        재시도횟수: retryCount
      });
      return token;
    } else {
      console.error('❌ FCM 토큰 발급 실패: 모든 재시도 실패');
      return null;
    }
  } catch (error) {
    console.error('❌ FCM 토큰 발급 중 오류:', error);
    const err = error as { name?: unknown; message?: unknown; code?: unknown };
    devLog('에러 상세:', {
      name: typeof err.name === 'string' ? err.name : 'unknown',
      message: typeof err.message === 'string' ? err.message : 'unknown',
      code: typeof err.code === 'string' ? err.code : 'unknown',
      isTWA: isTWA()
    });
    return null;
  }
};

// 알림 권한 요청 (TWA 환경 지원)
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    devLog('Notification API 미지원');
    return false;
  }
  
  const twaEnv = isTWA();
  devLog('알림 권한 요청:', { 
    isTWA: twaEnv, 
    currentPermission: Notification.permission 
  });
  
  // TWA 환경에서는 이미 Android 권한이 있는 경우
  if (twaEnv && Notification.permission === 'default') {
    devLog('TWA 환경: Android 권한 확인 중...');
    
    // TWA에서는 잠시 대기 후 다시 확인
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Android 권한이 있다면 자동으로 granted 상태가 됨
    if (Notification.permission !== 'default') {
      devLog('TWA 환경: 권한 상태 변경됨:', Notification.permission);
      return Notification.permission === 'granted';
    }
  }
  
  // 일반적인 권한 요청
  try {
    const permission = await Notification.requestPermission();
    devLog('알림 권한 결과:', permission);
    
    // TWA 환경에서 추가 대기시간
    if (twaEnv && permission === 'granted') {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return permission === 'granted';
  } catch (error) {
    console.error('알림 권한 요청 실패:', error);
    return false;
  }
};

// 포그라운드 메시지 수신 처리 (개선된 버전)
export const setupForegroundMessaging = (
  onMessageReceived: (payload: any) => void
) => {
  getFirebaseMessaging().then(messaging => {
    if (messaging) {
      onMessage(messaging, (payload) => {
        devLog('포그라운드 메시지 수신:', payload);
        
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

// Service Worker 등록 (TWA 환경 지원 + 보안 강화)
export const registerServiceWorker = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    devLog('Service Worker 미지원 환경');
    return false;
  }

  const twaEnv = isTWA();
  devLog('환경 감지:', { isTWA: twaEnv, userAgent: navigator.userAgent });

  try {
    devLog('Service Worker 등록 시도...');
    
    // TWA 환경에서는 절대 경로 사용
    const swPath = twaEnv 
      ? `${window.location.origin}/firebase-messaging-sw.js`
      : '/firebase-messaging-sw.js';
    
    devLog('Service Worker 경로:', swPath);
    
    const registration = await navigator.serviceWorker.register(swPath, {
      scope: '/',
      updateViaCache: 'none'
    });
    
    devLog('✅ Firebase Service Worker 등록 성공:', {
      scope: registration.scope,
      active: !!registration.active,
      waiting: !!registration.waiting,
      installing: !!registration.installing
    });
    
    // Service Worker가 준비되면 안전하게 Firebase 설정 전달
    if (registration.active) {
      await sendFirebaseConfigToSW(registration.active);
    } else {
      // Service Worker 활성화 대기
      await new Promise((resolve) => {
        if (registration.installing) {
          registration.installing.addEventListener('statechange', function() {
            if (this.state === 'activated') {
              sendFirebaseConfigToSW(registration.active!);
              resolve(undefined);
            }
          });
        } else {
          resolve(undefined);
        }
      });
    }
    
    // TWA 환경에서 Service Worker 활성화 대기
    if (twaEnv && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Service Worker 등록 실패:', error);
    devLog('Service Worker 등록 에러 상세:', {
      name: (error as Error).name,
      message: (error as Error).message,
      isTWA: twaEnv,
      origin: window.location.origin
    });
    return false;
  }
};

// Service Worker에 Firebase 설정을 안전하게 전달
const sendFirebaseConfigToSW = async (serviceWorker: ServiceWorker) => {
  try {
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
    };
    
    serviceWorker.postMessage({
      type: 'FIREBASE_CONFIG',
      config
    });
    
    devLog('✅ Firebase 설정을 Service Worker에 안전하게 전달');
  } catch (error) {
    console.error('❌ Firebase 설정 전달 실패:', error);
  }
};