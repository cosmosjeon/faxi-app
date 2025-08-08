'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Copy, Loader2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from '@/hooks/use-toast';

export function FCMTestComponent() {
  const {
    permission,
    token,
    isSupported,
    isLoading,
    setupPushNotifications,
    canSetup,
    isGranted
  } = usePushNotifications();

  const [testingSetup, setTestingSetup] = useState(false);

  // FCM 토큰 복사 기능
  const handleCopyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      toast({
        title: '토큰 복사됨',
        description: 'FCM 토큰이 클립보드에 복사되었습니다.'
      });
    }
  };

  // 푸시 알림 설정 테스트
  const handleTestSetup = async () => {
    setTestingSetup(true);
    try {
      await setupPushNotifications();
    } finally {
      setTestingSetup(false);
    }
  };

  // 권한 상태 배지 색상
  const getPermissionBadgeVariant = () => {
    switch (permission) {
      case 'granted': return 'default';
      case 'denied': return 'destructive';
      default: return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          푸시 알림 지원 여부 확인 중...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isSupported ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-500" />
          )}
          FCM 푸시 알림 테스트
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 지원 여부 */}
        <div className="flex justify-between items-center">
          <span className="font-medium">브라우저 지원:</span>
          <Badge variant={isSupported ? 'default' : 'destructive'}>
            {isSupported ? '지원됨' : '미지원'}
          </Badge>
        </div>

        {/* 권한 상태 */}
        <div className="flex justify-between items-center">
          <span className="font-medium">알림 권한:</span>
          <Badge variant={getPermissionBadgeVariant()}>
            {permission === 'granted' ? '허용됨' : 
             permission === 'denied' ? '거부됨' : '요청 필요'}
          </Badge>
        </div>

        {/* FCM 토큰 */}
        {token && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">FCM 토큰:</span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyToken}
                className="h-6"
              >
                <Copy className="h-3 w-3 mr-1" />
                복사
              </Button>
            </div>
            <div className="p-2 bg-gray-100 rounded text-xs font-mono break-all">
              {token.substring(0, 50)}...
            </div>
          </div>
        )}

        {/* 설정 버튼 */}
        {isSupported && canSetup && (
          <Button 
            onClick={handleTestSetup}
            disabled={testingSetup}
            className="w-full"
          >
            {testingSetup ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                설정 중...
              </>
            ) : (
              '푸시 알림 설정 테스트'
            )}
          </Button>
        )}

        {/* 성공 메시지 */}
        {isGranted && token && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">설정 완료!</span>
            </div>
            <p className="text-sm text-green-600 mt-1">
              푸시 알림이 정상적으로 설정되었습니다.
            </p>
          </div>
        )}

        {/* 에러 상태 */}
        {!isSupported && (
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">브라우저 미지원</span>
            </div>
            <p className="text-sm text-red-600 mt-1">
              이 브라우저는 푸시 알림을 지원하지 않습니다. 
              Chrome, Firefox 등 최신 브라우저를 사용해주세요.
            </p>
          </div>
        )}

        {/* 개발자 정보 */}
        <div className="pt-4 border-t text-xs text-gray-500">
          <p className="font-medium mb-1">Phase 1 테스트 정보:</p>
          <ul className="space-y-1 text-gray-400">
            <li>• Firebase 프로젝트 설정이 완료되면 토큰이 표시됩니다</li>
            <li>• 환경 변수(.env.local)가 설정되어야 합니다</li>
            <li>• 실제 푸시 알림은 Phase 2에서 구현됩니다</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}