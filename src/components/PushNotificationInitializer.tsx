'use client';

import { useEffect } from 'react';
import { registerServiceWorker, setupForegroundMessaging } from '@/lib/firebase-config';
import { toast } from '@/hooks/use-toast';

// 앱 시작시 푸시 알림 초기화
export function PushNotificationInitializer() {
  useEffect(() => {
    const initializePushSystem = async () => {
      // 브라우저 지원 여부 확인
      const isSupported = 
        'Notification' in window && 
        'serviceWorker' in navigator;
      
      if (!isSupported) {
        console.log('푸시 알림 미지원 브라우저');
        return;
      }

      try {
        // Service Worker 등록
        const registered = await registerServiceWorker();
        
        if (registered) {
          console.log('✅ FAXI Service Worker 등록 완료');
          
          // 포그라운드 메시지 리스너 설정
          setupForegroundMessaging((payload) => {
            handleForegroundMessage(payload);
          });
        } else {
          console.log('❌ Service Worker 등록 실패');
        }
      } catch (error) {
        console.error('푸시 알림 초기화 오류:', error);
      }
    };

    initializePushSystem();
  }, []);

  // 포그라운드 메시지 처리
  const handleForegroundMessage = (payload: any) => {
    console.log('포그라운드 메시지 수신:', payload);
    
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