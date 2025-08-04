'use client';

import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, BellOff, Settings, CheckCircle, XCircle } from 'lucide-react';
import { useDeviceToken } from '@/hooks/useDeviceToken';

interface NotificationPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
}

export function NotificationPermissionModal({
  isOpen,
  onClose,
  onPermissionGranted,
  onPermissionDenied
}: NotificationPermissionModalProps) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestResult, setRequestResult] = useState<'pending' | 'granted' | 'denied'>('pending');
  
  const { requestPermission, isSupported, permission } = useDeviceToken();

  const handleRequestPermission = useCallback(async () => {
    if (!isSupported) {
      setRequestResult('denied');
      onPermissionDenied?.();
      return;
    }

    setIsRequesting(true);
    setRequestResult('pending');

    try {
      const granted = await requestPermission();
      
      if (granted) {
        setRequestResult('granted');
        onPermissionGranted?.();
      } else {
        setRequestResult('denied');
        onPermissionDenied?.();
      }
    } catch (error) {
      console.error('알림 권한 요청 실패:', error);
      setRequestResult('denied');
      onPermissionDenied?.();
    } finally {
      setIsRequesting(false);
    }
  }, [isSupported, requestPermission, onPermissionGranted, onPermissionDenied]);

  const handleClose = useCallback(() => {
    if (requestResult === 'pending') {
      setRequestResult('denied');
      onPermissionDenied?.();
    }
    onClose();
  }, [requestResult, onClose, onPermissionDenied]);

  const handleSettingsClick = useCallback(() => {
    // 브라우저 설정 페이지로 이동 (브라우저별로 다름)
    if (navigator.userAgent.includes('Chrome')) {
      window.open('chrome://settings/content/notifications', '_blank');
    } else if (navigator.userAgent.includes('Firefox')) {
      window.open('about:preferences#privacy', '_blank');
    } else {
      // 일반적인 설정 페이지
      window.open('chrome://settings/content/notifications', '_blank');
    }
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-500" />
            알림 권한 요청
          </DialogTitle>
          <DialogDescription>
            친구의 메시지와 프린트 상태를 실시간으로 받아보세요
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {requestResult === 'pending' && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Bell className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div className="space-y-2">
                      <h4 className="font-medium">실시간 알림을 받아보세요</h4>
                      <p className="text-sm text-muted-foreground">
                        • 새로운 친구 요청 알림
                        • 받은 메시지 알림
                        • 프린트 완료/오류 알림
                        • 친구가 메시지를 수락했을 때 알림
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={handleRequestPermission}
                      disabled={isRequesting || !isSupported}
                      className="flex-1"
                    >
                      {isRequesting ? '요청 중...' : '알림 허용'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleClose}
                      disabled={isRequesting}
                    >
                      나중에
                    </Button>
                  </div>

                  {!isSupported && (
                    <p className="text-xs text-muted-foreground">
                      이 브라우저는 푸시 알림을 지원하지 않습니다
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {requestResult === 'granted' && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="space-y-2">
                    <h4 className="font-medium text-green-800">알림 권한이 허용되었습니다</h4>
                    <p className="text-sm text-green-700">
                      이제 친구의 메시지와 프린트 상태를 실시간으로 받아볼 수 있습니다
                    </p>
                  </div>
                </div>
                <Button onClick={handleClose} className="mt-4 w-full">
                  확인
                </Button>
              </CardContent>
            </Card>
          )}

          {requestResult === 'denied' && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div className="space-y-2">
                    <h4 className="font-medium text-orange-800">알림 권한이 거부되었습니다</h4>
                    <p className="text-sm text-orange-700">
                      브라우저 설정에서 알림 권한을 허용해주세요
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    onClick={handleSettingsClick}
                    className="flex-1"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    설정 열기
                  </Button>
                  <Button onClick={handleClose} className="flex-1">
                    나중에
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 