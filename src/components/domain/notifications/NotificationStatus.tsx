'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Settings, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useDeviceToken } from '@/hooks/useDeviceToken';
import { NotificationPermissionModal } from './NotificationPermissionModal';

interface NotificationStatusProps {
  showDetails?: boolean;
  onPermissionRequest?: () => void;
}

export function NotificationStatus({ 
  showDetails = false, 
  onPermissionRequest 
}: NotificationStatusProps) {
  const [showModal, setShowModal] = useState(false);
  const { 
    isSupported, 
    permission, 
    token, 
    isLoading, 
    error,
    requestPermission 
  } = useDeviceToken();

  const handleRequestPermission = async () => {
    if (!isSupported) {
      setShowModal(true);
      return;
    }

    try {
      await requestPermission();
      onPermissionRequest?.();
    } catch (error) {
      console.error('알림 권한 요청 실패:', error);
    }
  };

  const getStatusInfo = () => {
    if (!isSupported) {
      return {
        icon: <XCircle className="h-4 w-4 text-red-500" />,
        text: '지원하지 않음',
        color: 'text-red-500',
        badge: 'bg-red-100 text-red-800'
      };
    }

    switch (permission) {
      case 'granted':
        return {
          icon: <CheckCircle className="h-4 w-4 text-green-500" />,
          text: token ? '알림 활성화' : '토큰 등록 중...',
          color: 'text-green-500',
          badge: 'bg-green-100 text-green-800'
        };
      case 'denied':
        return {
          icon: <XCircle className="h-4 w-4 text-red-500" />,
          text: '권한 거부됨',
          color: 'text-red-500',
          badge: 'bg-red-100 text-red-800'
        };
      default:
        return {
          icon: <AlertCircle className="h-4 w-4 text-yellow-500" />,
          text: '권한 요청 필요',
          color: 'text-yellow-500',
          badge: 'bg-yellow-100 text-yellow-800'
        };
    }
  };

  const statusInfo = getStatusInfo();

  if (!showDetails) {
    return (
      <div className="flex items-center gap-2">
        {statusInfo.icon}
        <span className={`text-sm ${statusInfo.color}`}>
          {statusInfo.text}
        </span>
        {permission === 'default' && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={handleRequestPermission}
            disabled={isLoading}
          >
            권한 요청
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-blue-500" />
                <h3 className="font-medium">알림 설정</h3>
              </div>
              <Badge className={statusInfo.badge}>
                {statusInfo.text}
              </Badge>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {statusInfo.icon}
                <span className="text-sm">
                  {permission === 'granted' 
                    ? '알림 권한이 허용되었습니다'
                    : permission === 'denied'
                    ? '알림 권한이 거부되었습니다'
                    : '알림 권한을 요청해주세요'
                  }
                </span>
              </div>

              {token && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600">
                    디바이스 토큰이 등록되었습니다
                  </span>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-600">
                    {error}
                  </span>
                </div>
              )}

              {!isSupported && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-600">
                    이 브라우저는 푸시 알림을 지원하지 않습니다
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {permission === 'default' && isSupported && (
                <Button 
                  onClick={handleRequestPermission}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? '요청 중...' : '알림 권한 요청'}
                </Button>
              )}

              {permission === 'denied' && (
                <Button 
                  variant="outline"
                  onClick={() => setShowModal(true)}
                  className="flex-1"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  설정 안내
                </Button>
              )}

              {permission === 'granted' && !token && (
                <Button 
                  variant="outline"
                  disabled={isLoading}
                  className="flex-1"
                >
                  토큰 등록 중...
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <NotificationPermissionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onPermissionGranted={() => {
          setShowModal(false);
          onPermissionRequest?.();
        }}
        onPermissionDenied={() => setShowModal(false)}
      />
    </>
  );
} 