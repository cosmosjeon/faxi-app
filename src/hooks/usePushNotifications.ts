'use client';

import { useState, useEffect } from 'react';
import { getFCMToken, requestNotificationPermission, registerServiceWorker, setupForegroundMessaging } from '@/lib/firebase-config';
import { useAuthStore } from '@/stores/auth.store';
import { supabase } from '@/lib/supabase/client';
import { toast } from '@/hooks/use-toast';

// 푸시 알림 상태 타입
interface PushNotificationState {
  permission: NotificationPermission;
  token: string | null;
  isSupported: boolean;
  isLoading: boolean;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    permission: 'default',
    token: null,
    isSupported: false,
    isLoading: true
  });
  
  const { user } = useAuthStore();

  // 푸시 알림 지원 여부 및 권한 상태 확인, Service Worker 등록
  useEffect(() => {
    const initializePushNotifications = async () => {
      const isSupported = 
        'Notification' in window && 
        'serviceWorker' in navigator;
      
      setState(prev => ({
        ...prev,
        isSupported,
        permission: Notification.permission,
        isLoading: false
      }));

      // Service Worker 등록 (지원하는 경우에만)
      if (isSupported) {
        await registerServiceWorker();
        
        // 포그라운드 메시지 리스너 설정
        setupForegroundMessaging((payload) => {
          handleForegroundMessage(payload);
        });
      }
    };
    
    initializePushNotifications();
  }, []);

  // 포그라운드 메시지 처리
  const handleForegroundMessage = (payload: any) => {
    console.log('포그라운드 메시지 처리:', payload);
    
    // 메시지 타입별 처리
    switch (payload.type) {
      case 'new_message':
        toast({
          title: payload.title,
          description: payload.body,
          duration: 5000
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

  // 푸시 알림 설정 (권한 요청 + 토큰 발급 + 저장)
  const setupPushNotifications = async (): Promise<boolean> => {
    if (!state.isSupported) {
      toast({
        title: '푸시 알림 미지원',
        description: '이 브라우저는 푸시 알림을 지원하지 않습니다.',
        variant: 'destructive'
      });
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // 1. 알림 권한 요청
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) {
        toast({
          title: '권한이 필요합니다',
          description: '푸시 알림을 받으려면 알림 권한을 허용해주세요.',
          variant: 'destructive'
        });
        setState(prev => ({ ...prev, permission: 'denied', isLoading: false }));
        return false;
      }

      // 2. FCM 토큰 발급
      const token = await getFCMToken();
      if (!token) {
        throw new Error('FCM 토큰 발급 실패');
      }

      // 3. 토큰을 데이터베이스에 저장
      if (user) {
        await savePushToken(token);
      }

      setState(prev => ({
        ...prev,
        permission: 'granted',
        token,
        isLoading: false
      }));

      toast({
        title: '푸시 알림 설정 완료',
        description: '새 메시지 알림을 받을 수 있습니다.'
      });

      return true;
    } catch (error) {
      console.error('푸시 알림 설정 실패:', error);
      toast({
        title: '설정 실패',
        description: '푸시 알림 설정 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  // 푸시 토큰을 데이터베이스에 저장
  const savePushToken = async (token: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('push_tokens')
        .upsert({
          user_id: user.id,
          fcm_token: token,
          device_info: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            timestamp: Date.now()
          },
          is_active: true
        }, {
          onConflict: 'user_id,fcm_token'
        });
      
      if (error) throw error;
      
      console.log('✅ 푸시 토큰 저장 완료:', token.substring(0, 20) + '...');
    } catch (error) {
      console.error('❌ 푸시 토큰 저장 실패:', error);
      throw error;
    }
  };

  // 디버깅용 로그 추가
  console.log('usePushNotifications 상태:', {
    isSupported: state.isSupported,
    permission: state.permission,
    isLoading: state.isLoading,
    canSetup: state.isSupported && state.permission !== 'granted',
    hasToken: !!state.token
  });

  return {
    ...state,
    setupPushNotifications,
    canSetup: state.isSupported && (state.permission !== 'granted' || !state.token),
    isGranted: state.permission === 'granted' && !!state.token
  };
}