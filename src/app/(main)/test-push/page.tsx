"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { getFCMToken, requestNotificationPermission } from '@/lib/firebase-config';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/hooks/use-toast';

export default function TestPushPage() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuthStore();
  const pushNotifications = usePushNotifications();

  // TWA 환경 감지
  const isTWA = () => {
    if (typeof window === 'undefined') return false;
    const userAgent = navigator.userAgent;
    const isWebView = /wv/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    const hasTWAPackage = /com\.cosmosjeon\.faxi/.test(userAgent);
    return isAndroid && (isWebView || hasTWAPackage);
  };

  const checkPushStatus = async () => {
    setIsLoading(true);
    try {
      const info: any = {
        환경: {
          isTWA: isTWA(),
          userAgent: navigator.userAgent,
          hostname: window.location.hostname,
          origin: window.location.origin,
        },
        브라우저지원: {
          hasNotification: 'Notification' in window,
          hasServiceWorker: 'serviceWorker' in navigator,
          notificationPermission: Notification.permission,
        },
        Firebase: {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '설정됨' : '없음',
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ? '설정됨' : '없음',
        },
        사용자: {
          isLoggedIn: !!user,
          userId: user?.id || '없음'
        }
      };

      // FCM 토큰 확인
      try {
        const token = await getFCMToken();
        info.FCM토큰 = {
          hasToken: !!token,
          tokenPreview: token ? `${token.substring(0, 20)}...` : '없음'
        };
      } catch (error) {
        info.FCM토큰 = {
          error: (error as Error).message
        };
      }

      // Service Worker 상태 확인
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        info.ServiceWorker = {
          registered: !!registration,
          scope: registration?.scope || '없음',
          active: !!registration?.active,
          waiting: !!registration?.waiting,
          installing: !!registration?.installing
        };
      }

      setDebugInfo(info);
    } catch (error) {
      toast({
        title: '상태 확인 실패',
        description: (error as Error).message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const requestPermission = async () => {
    setIsLoading(true);
    try {
      const granted = await requestNotificationPermission();
      toast({
        title: granted ? '권한 허용됨' : '권한 거부됨',
        description: granted ? '푸시 알림을 받을 수 있습니다.' : '알림 권한이 필요합니다.',
        variant: granted ? 'default' : 'destructive'
      });
      
      if (granted) {
        await checkPushStatus();
      }
    } catch (error) {
      toast({
        title: '권한 요청 실패',
        description: (error as Error).message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const setupPush = async () => {
    setIsLoading(true);
    try {
      const success = await pushNotifications.setupPushNotifications();
      if (success) {
        await checkPushStatus();
      }
    } catch (error) {
      toast({
        title: '푸시 알림 설정 실패',
        description: (error as Error).message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestNotification = () => {
    if ('serviceWorker' in navigator && 'Notification' in window) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification('FAXI 테스트 알림', {
          body: 'TWA 환경에서 알림이 정상적으로 작동하는지 확인합니다.',
          icon: '/icons/default-avatar.jpg',
          badge: '/icons/faxi-badge.png',
          tag: 'faxi-test',
          requireInteraction: true
        });
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">푸시 알림 테스트</h1>
          <p className="text-gray-600">TWA 환경에서의 푸시 알림 상태를 확인합니다</p>
        </div>
        <Badge variant={isTWA() ? 'default' : 'secondary'}>
          {isTWA() ? 'TWA 환경' : '웹 브라우저'}
        </Badge>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>빠른 액션</CardTitle>
            <CardDescription>푸시 알림 관련 작업을 수행합니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={checkPushStatus} 
                disabled={isLoading}
                variant="outline"
              >
                상태 확인
              </Button>
              <Button 
                onClick={requestPermission} 
                disabled={isLoading}
                variant="outline"
              >
                권한 요청
              </Button>
              <Button 
                onClick={setupPush} 
                disabled={isLoading || !user}
                variant="outline"
              >
                푸시 설정
              </Button>
              <Button 
                onClick={sendTestNotification} 
                disabled={isLoading}
                variant="outline"
              >
                테스트 알림
              </Button>
            </div>
          </CardContent>
        </Card>

        {debugInfo && (
          <Card>
            <CardHeader>
              <CardTitle>디버그 정보</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm bg-gray-50 p-4 rounded-lg overflow-auto">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}