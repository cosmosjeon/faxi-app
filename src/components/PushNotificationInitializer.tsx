'use client';

import { useEffect } from 'react';
import { registerServiceWorker, setupForegroundMessaging } from '@/lib/firebase-config';
import { toast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuthStore } from '@/stores/auth.store';

// 앱 시작시 푸시 알림 초기화
export function PushNotificationInitializer() {
  const { user } = useAuthStore();
  const { setupPushNotifications } = usePushNotifications();

  useEffect(() => {
    const initializePushSystem = async () => {
      console.log('[PushInit] 푸시 알림 시스템 초기화 시작');
      
      // TWA 환경 감지
      const isTWA = () => {
        if (typeof window === 'undefined') return false;
        const userAgent = navigator.userAgent;
        const isWebView = /wv/.test(userAgent);
        const isAndroid = /Android/.test(userAgent);
        const hasTWAPackage = /com\.cosmosjeon\.faxi/.test(userAgent);
        return isAndroid && (isWebView || hasTWAPackage);
      };

      const twaEnv = isTWA();
      console.log('[PushInit] 환경:', twaEnv ? 'TWA' : 'Web');

      // 브라우저 지원 여부 확인
      const isSupported = 
        'Notification' in window && 
        'serviceWorker' in navigator;
      
      if (!isSupported) {
        console.warn('[PushInit] Push not supported environment');
        return;
      }

      try {
        // TWA 환경에서는 DOM 완전 로딩 대기
        if (twaEnv) {
          console.log('[PushInit] TWA: wait for DOM ready');
          await new Promise(resolve => {
            if (document.readyState === 'complete') {
              resolve(undefined);
            } else {
              window.addEventListener('load', () => resolve(undefined));
            }
          });
          
          // TWA 환경에서 추가 대기시간
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('[PushInit] Registering Service Worker');
        // Service Worker 등록
        const registered = await registerServiceWorker();
        
        if (registered) {
          console.log('[PushInit] Service Worker registered. Setting up foreground listener');
          
          // TWA 환경에서는 약간의 지연 후 포그라운드 메시지 설정
          if (twaEnv) {
            setTimeout(() => {
              setupForegroundMessaging((payload) => {
                handleForegroundMessage(payload);
              });
            }, 1500);
          } else {
            setupForegroundMessaging((payload) => {
              handleForegroundMessage(payload);
            });
          }
        } else {
          console.warn('[PushInit] Failed to register Service Worker');
        }
      } catch (error) {
        console.error('[PushInit] Push initialization error:', error);
      }
    };

    // 자동 토큰 등록 로직
    const attemptAutoTokenRegistration = async () => {
      // 로그인되지 않은 경우 스킵
      if (!user) {
        console.log('[PushInit] User not logged in. Skip auto token registration');
        return;
      }

      // 이미 시도한 경우 스킵 (최초 1회만)
      const hasAttempted = localStorage.getItem(`push-auto-setup-${user.id}`);
      if (hasAttempted) {
        console.log('[PushInit] Auto token registration already attempted. Skip');
        return;
      }

      // 브라우저 지원 확인
      const isSupported = 'Notification' in window && 'serviceWorker' in navigator;
      if (!isSupported) {
        console.log('[PushInit] Push not supported. Skip auto registration');
        return;
      }

      // 권한이 이미 거부된 경우 스킵
      if (Notification.permission === 'denied') {
        console.log('[PushInit] Notification permission denied. Skip auto registration');
        localStorage.setItem(`push-auto-setup-${user.id}`, 'denied');
        return;
      }

      try {
        console.log('[PushInit] Start auto token registration');
        
        // 자동 토큰 등록 시도
        const success = await setupPushNotifications();
        
        // 시도했음을 기록 (성공/실패 무관)
        localStorage.setItem(`push-auto-setup-${user.id}`, success ? 'success' : 'failed');
        
        if (success) {
          console.log('[PushInit] ✅ Auto token registration success');
        } else {
          console.log('[PushInit] ❌ Auto token registration failed');
        }
      } catch (error) {
        console.error('[PushInit] Auto token registration error:', error);
        localStorage.setItem(`push-auto-setup-${user.id}`, 'error');
      }
    };

    // TWA 환경에서는 약간의 지연 후 초기화
    const initDelay = typeof window !== 'undefined' && 
                     /Android/.test(navigator.userAgent) && 
                     /wv/.test(navigator.userAgent) ? 500 : 0;

    // Service Worker 초기화
    setTimeout(initializePushSystem, initDelay);
    
    // 자동 토큰 등록 (Service Worker 초기화 후)
    setTimeout(() => {
      attemptAutoTokenRegistration();
    }, initDelay + 2000);
  }, [user, setupPushNotifications]);

  // 포그라운드 메시지 처리
  const handleForegroundMessage = (payload: any) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Foreground message:', payload);
    }
    
    // 메시지 타입별 처리
    switch (payload.type) {
      case 'new_message':
        toast({
          title: payload.title,
          description: payload.body,
          duration: 5000
        });
        break;
        
      case 'close_friend_message':
        toast({
          title: 'Close friend message',
          description: payload.body,
          duration: 5000
        });
        break;
        
      case 'auto_print_notification':
        toast({
          title: 'Message printing',
          description: 'Will print immediately if friend device is connected.',
          duration: 7000
        });
        break;
        
      case 'friend_request':
        toast({
          title: 'Friend request',
          description: payload.body,
          duration: 7000
        });
        break;
        
      case 'close_friend_request':
        toast({
          title: 'Close friend request',
          description: payload.body,
          duration: 7000
        });
        break;
        
      default:
        toast({
          title: payload.title,
          description: payload.body,
          duration: 5000
        });
    }
  };

  // UI를 렌더링하지 않는 초기화 전용 컴포넌트
  return null;
}