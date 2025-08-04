'use client';

import { useState, useEffect, useCallback } from 'react';
import { registerDeviceToken, deactivateDeviceToken } from '@/features/notifications/api';

interface UseDeviceTokenOptions {
  autoRegister?: boolean;
  deviceInfo?: Record<string, any>;
}

/**
 * 디바이스 토큰 관리를 위한 훅
 */
export function useDeviceToken(options: UseDeviceTokenOptions = {}) {
  const { autoRegister = true, deviceInfo } = options;
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 브라우저 지원 여부 확인
  useEffect(() => {
    const checkSupport = () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window;
      setIsSupported(supported);
      
      if (supported) {
        setPermission(Notification.permission);
      }
    };

    checkSupport();
  }, []);

  // 알림 권한 요청
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('이 브라우저는 푸시 알림을 지원하지 않습니다');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        return true;
      } else {
        setError('알림 권한이 거부되었습니다');
        return false;
      }
    } catch (err) {
      setError('알림 권한 요청 중 오류가 발생했습니다');
      return false;
    }
  }, [isSupported]);

  // FCM 토큰 가져오기 (Firebase 사용 시)
  const getFCMToken = useCallback(async (): Promise<string | null> => {
    try {
      // Service Worker 등록 확인
      if (!('serviceWorker' in navigator)) {
        console.warn('Service Worker가 지원되지 않습니다');
        return null;
      }

      const registration = await navigator.serviceWorker.ready;
      
      // 기존 구독 확인
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('기존 푸시 구독이 있습니다');
        return btoa(String.fromCharCode.apply(null, 
          new Uint8Array(existingSubscription.getKey('p256dh')!)
        ));
      }

      // VAPID 공개 키 확인
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.warn('VAPID 공개 키가 설정되지 않았습니다');
        return null;
      }

      // 새로운 구독 생성
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey
      });

      console.log('새로운 푸시 구독이 생성되었습니다');
      return btoa(String.fromCharCode.apply(null, 
        new Uint8Array(subscription.getKey('p256dh')!)
      ));
    } catch (err) {
      console.error('FCM 토큰 가져오기 실패:', err);
      return null;
    }
  }, []);

  // 디바이스 타입 감지
  const detectDeviceType = useCallback((): 'FCM' | 'APNs' => {
    // 실제 구현에서는 더 정확한 감지 로직 필요
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (/iphone|ipad|ipod/.test(userAgent)) {
      return 'APNs';
    } else {
      return 'FCM';
    }
  }, []);

  // 토큰 등록
  const registerToken = useCallback(async (tokenValue: string): Promise<boolean> => {
    if (!tokenValue) {
      setError('토큰이 없습니다');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const deviceType = detectDeviceType();
      const deviceInfoWithUserAgent = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        ...deviceInfo
      };

      await registerDeviceToken(tokenValue, deviceType, deviceInfoWithUserAgent);
      setToken(tokenValue);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '토큰 등록에 실패했습니다';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [deviceInfo, detectDeviceType]);

  // 토큰 비활성화
  const unregisterToken = useCallback(async (tokenId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      await deactivateDeviceToken(tokenId);
      setToken(null);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '토큰 비활성화에 실패했습니다';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 자동 토큰 등록
  useEffect(() => {
    if (!autoRegister || !isSupported || permission !== 'granted') {
      return;
    }

    const initializeToken = async () => {
      // FCM 토큰 가져오기 시도
      const fcmToken = await getFCMToken();
      
      if (fcmToken) {
        await registerToken(fcmToken);
      } else {
        // FCM 토큰을 가져올 수 없는 경우 (예: 개발 환경)
        // 실제 구현에서는 적절한 대체 방법 사용
        console.warn('FCM 토큰을 가져올 수 없습니다');
      }
    };

    initializeToken();
  }, [autoRegister, isSupported, permission, getFCMToken, registerToken]);

  return {
    // 상태
    isSupported,
    permission,
    token,
    isLoading,
    error,
    
    // 메서드
    requestPermission,
    registerToken,
    unregisterToken,
    getFCMToken,
  };
} 