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

const devLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'production') console.log(...args);
};

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
    devLog('포그라운드 메시지 처리:', payload);
    
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

  // TWA 환경 감지
  const isTWA = () => {
    if (typeof window === 'undefined') return false;
    const userAgent = navigator.userAgent;
    const isWebView = /wv/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    const hasTWAPackage = /com\.cosmosjeon\.faxi/.test(userAgent);
    return isAndroid && (isWebView || hasTWAPackage);
  };

  // 푸시 알림 설정 (권한 요청 + 토큰 발급 + 저장) - TWA 환경 강화
  const setupPushNotifications = async (): Promise<boolean> => {
    if (!state.isSupported) {
      const errorMsg = isTWA() ? 
        'APK 환경에서 푸시 알림을 초기화할 수 없습니다. 다시 시도해주세요.' :
        '이 브라우저는 푸시 알림을 지원하지 않습니다.';
      
      toast({
        title: '푸시 알림 미지원',
        description: errorMsg,
        variant: 'destructive'
      });
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // TWA 환경에서는 추가 대기 시간
      if (isTWA()) {
        devLog('TWA 환경 감지, 초기화 대기 중...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 1. 알림 권한 요청
      devLog('1단계: 알림 권한 요청');
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) {
        const permissionError = isTWA() ? 
          'APK에서 알림 권한을 허용해주세요. 설정 > 앱 > FAXI > 알림에서 확인할 수 있습니다.' :
          '푸시 알림을 받으려면 알림 권한을 허용해주세요.';
        
        toast({
          title: '권한이 필요합니다',
          description: permissionError,
          variant: 'destructive'
        });
        setState(prev => ({ ...prev, permission: 'denied', isLoading: false }));
        return false;
      }

      devLog('2단계: FCM 토큰 발급 시작');
      
      // 2. FCM 토큰 발급 (TWA 환경에서는 재시도)
      let token = null;
      let retryCount = 0;
      const maxRetries = isTWA() ? 3 : 1;

      while (!token && retryCount < maxRetries) {
        try {
          devLog(`FCM 토큰 발급 시도 ${retryCount + 1}/${maxRetries}`);
          token = await getFCMToken();
          
          if (!token && retryCount < maxRetries - 1) {
            devLog(`토큰 발급 실패, ${2000}ms 후 재시도`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (tokenError) {
          devLog('FCM 토큰 발급 에러:', tokenError);
          if (retryCount < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        retryCount++;
      }

      if (!token) {
        const tokenError = isTWA() ?
          'APK 환경에서 FCM 토큰 발급에 실패했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.' :
          'FCM 토큰 발급에 실패했습니다.';
        
        throw new Error(tokenError);
      }

      devLog('3단계: 토큰 데이터베이스 저장');

      // 3. 토큰을 데이터베이스에 저장
      if (user) {
        await savePushToken(token);
        devLog('토큰 저장 완료');
      } else {
        throw new Error('사용자 정보가 없습니다. 다시 로그인해주세요.');
      }

      setState(prev => ({
        ...prev,
        permission: 'granted',
        token,
        isLoading: false
      }));

      toast({
        title: '✅ 푸시 알림 설정 완료',
        description: '새 메시지 알림을 받을 수 있습니다.'
      });

      return true;
    } catch (error) {
      console.error('푸시 알림 설정 실패:', error);
      
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      const userFriendlyMessage = isTWA() ?
        `APK 설정 실패: ${errorMessage}` :
        `설정 실패: ${errorMessage}`;
      
      toast({
        title: '❌ 설정 실패',
        description: userFriendlyMessage,
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
      
      devLog('✅ 푸시 토큰 저장 완료:', token.substring(0, 20) + '...');
    } catch (error) {
      console.error('❌ 푸시 토큰 저장 실패:', error);
      throw error;
    }
  };

  // 디버깅용 로그 추가
  devLog('usePushNotifications 상태:', {
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