'use client';

import { useEffect } from 'react';
import { registerServiceWorker, setupForegroundMessaging } from '@/lib/firebase-config';
import { toast } from '@/hooks/use-toast';

// 앱 시작시 푸시 알림 초기화
export function PushNotificationInitializer() {
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
      console.log('[PushInit] 환경:', twaEnv ? 'TWA' : '웹브라우저');

      // 브라우저 지원 여부 확인
      const isSupported = 
        'Notification' in window && 
        'serviceWorker' in navigator;
      
      if (!isSupported) {
        console.warn('[PushInit] 푸시 알림 미지원 환경');
        return;
      }

      try {
        // TWA 환경에서는 DOM 완전 로딩 대기
        if (twaEnv) {
          console.log('[PushInit] TWA 환경: DOM 로딩 대기');
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

        console.log('[PushInit] Service Worker 등록 시작');
        // Service Worker 등록
        const registered = await registerServiceWorker();
        
        if (registered) {
          console.log('[PushInit] Service Worker 등록 성공, 포그라운드 리스너 설정');
          
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
          console.warn('[PushInit] Service Worker 등록 실패');
        }
      } catch (error) {
        console.error('[PushInit] 푸시 알림 초기화 오류:', error);
      }
    };

    // TWA 환경에서는 약간의 지연 후 초기화
    const initDelay = typeof window !== 'undefined' && 
                     /Android/.test(navigator.userAgent) && 
                     /wv/.test(navigator.userAgent) ? 500 : 0;

    setTimeout(initializePushSystem, initDelay);
  }, []);

  // 포그라운드 메시지 처리
  const handleForegroundMessage = (payload: any) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('포그라운드 메시지 수신:', payload);
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
          title: '친한친구 메시지',
          description: payload.body,
          duration: 5000
        });
        break;
        
      case 'auto_print_notification':
        toast({
          title: '메시지 출력',
          description: '친구의 프린터와 앱이 연결되어 있다면 즉시 출력합니다!',
          duration: 7000
        });
        break;
        
      case 'friend_request':
        toast({
          title: '친구 요청',
          description: payload.body,
          duration: 7000
        });
        break;
        
      case 'close_friend_request':
        toast({
          title: '친한친구 요청',
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