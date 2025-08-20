"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/auth.store";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  getUserSettings,
  updateNotificationSettings,
} from "@/features/settings/api";
import type {
  NotificationSettings,
  UserSettings,
} from "@/features/settings/types";

export default function NotificationSettingsPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { toast } = useToast();
  const { 
    setupPushNotifications, 
    canSetup, 
    isSupported, 
    permission,
    isGranted,
    token
  } = usePushNotifications();

  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pushSetupStatus, setPushSetupStatus] = useState<string>('대기 중');
  const [firebaseStatus, setFirebaseStatus] = useState<{
    supported: boolean;
    permission: string;
    hasToken: boolean;
    configLoaded: boolean;
    error?: string;
  } | null>(null);

  // 설정 로드
  useEffect(() => {
    if (!profile?.id) return;

    const loadSettings = async () => {
      try {

        const userSettings = await getUserSettings(profile.id);

        // 개발 환경에서만 디버깅 정보 출력
        if (process.env.NODE_ENV !== 'production') {
          console.log("📋 가져온 사용자 설정:", {
            raw: userSettings,
            hasMessageNotifications:
              "message_notifications" in (userSettings || {}),
            hasMarketingNotifications:
              "marketing_notifications" in (userSettings || {}),
            hasAutoprint: "auto_print_close_friends" in (userSettings || {}),
          });
        }

        if (userSettings) {
          // DB에서 가져온 실제 값 사용, 없으면 기본값 적용
          const notificationSettings: NotificationSettings = {
            message_notifications: userSettings.message_notifications ?? true,
            marketing_notifications:
              userSettings.marketing_notifications ?? false,
            auto_print_close_friends:
              userSettings.auto_print_close_friends ?? false,
          };

          console.log("✅ 로드된 알림 설정:", notificationSettings);
          setSettings(notificationSettings);
        } else {
          if (process.env.NODE_ENV !== 'production') {
            console.warn("⚠️ 사용자 설정이 없음, 기본값 사용");
          }

          // 사용자 설정이 아예 없는 경우 기본값
          const defaultSettings: NotificationSettings = {
            message_notifications: true,
            marketing_notifications: false,
            auto_print_close_friends: false,
          };

          setSettings(defaultSettings);
        }
      } catch (error) {
        console.error("❌ 설정 로드 실패:", error);
        toast({
          title: "설정 로드 실패",
          description: "알림 설정을 불러오는데 실패했습니다.",
          variant: "destructive",
        });

        // 오류 발생 시에도 기본값으로 설정하여 앱이 동작하도록 함
        const fallbackSettings: NotificationSettings = {
          message_notifications: true,
          marketing_notifications: false,
          auto_print_close_friends: false,
        };

        setSettings(fallbackSettings);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [profile?.id, toast]);

  // Firebase 상태 모니터링
  useEffect(() => {
    const checkFirebaseStatus = () => {
      const status: {
        supported: boolean;
        permission: string;
        hasToken: boolean;
        configLoaded: boolean;
        error?: string;
      } = {
        supported: isSupported,
        permission: permission,
        hasToken: !!token,
        configLoaded: !!(
          process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
          process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
        )
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

      if (!status.configLoaded) {
        status.error = 'Firebase 설정이 누락되었습니다';
      } else if (!status.supported) {
        status.error = isTWA() ? 'TWA 환경에서 초기화 실패' : '브라우저가 푸시 알림을 지원하지 않습니다';
      } else if (status.permission === 'denied') {
        status.error = '알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요';
      }

      setFirebaseStatus(status);
    };

    checkFirebaseStatus();
  }, [isSupported, permission, token]);

  // 설정 업데이트
  const handleSettingChange = async (
    key: keyof NotificationSettings,
    value: boolean | string
  ) => {
    if (!profile?.id || !settings) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn("⚠️ 필수 데이터 누락:", {
          profileId: profile?.id,
          settings: !!settings,
        });
      }
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log("🔄 설정 변경 시작:", {
        key,
        value,
        userId: profile.id,
        originalValue: settings[key],
      });
    }

    // 클라이언트 사이드 검증
    if (typeof value !== "boolean") {
      console.error("❌ 잘못된 값 타입:", {
        key,
        value,
        expectedType: "boolean",
        actualType: typeof value,
      });
      toast({
        title: "설정 오류",
        description: "올바르지 않은 설정 값입니다.",
        variant: "destructive",
      });
      return;
    }

    // 값 변경이 없으면 스킵
    if (settings[key] === value) {
      if (process.env.NODE_ENV !== 'production') {
        console.log("⏭️ 동일한 값으로 변경 시도, 스킵");
      }
      return;
    }

    // 기존 설정 백업 (rollback용)
    const originalSettings = { ...settings };

    // UI 상태 즉시 업데이트 (낙관적 업데이트)
    const optimisticSettings = { ...settings, [key]: value };
    setSettings(optimisticSettings);

    setIsSaving(true);

    try {
      const updateRequest = {
        user_id: profile.id,
        settings: { [key]: value } as Partial<NotificationSettings>,
      };

      if (process.env.NODE_ENV !== 'production') {
        console.log("📤 서버 업데이트 요청:", updateRequest);
      }

      // 네트워크 연결 상태 확인 (가능한 경우)
      if (
        typeof navigator !== "undefined" &&
        "onLine" in navigator &&
        !navigator.onLine
      ) {
        throw new Error("인터넷 연결을 확인해주세요.");
      }

      const result = await updateNotificationSettings(updateRequest);

      if (process.env.NODE_ENV !== 'production') {
        console.log("📥 서버 응답:", result);
      }

      if (!result.success) {
        throw new Error(result.error || "알 수 없는 오류가 발생했습니다.");
      }

      // 성공 시 최신 설정을 다시 불러와서 동기화 보장
      if (process.env.NODE_ENV !== 'production') {
        console.log("✅ 업데이트 성공, 최신 설정 재로드");
      }

      const refreshedSettings = await getUserSettings(profile.id);
      if (refreshedSettings) {
        const syncedSettings: NotificationSettings = {
          message_notifications:
            refreshedSettings.message_notifications ?? true,
          marketing_notifications: refreshedSettings.marketing_notifications,
          auto_print_close_friends:
            refreshedSettings.auto_print_close_friends ?? false,
        };

        setSettings(syncedSettings);
        if (process.env.NODE_ENV !== 'production') {
          console.log("🔄 설정 동기화 완료:", syncedSettings);
        }
      }

      toast({
        title: "설정 저장됨",
        description: `${
          key === "message_notifications"
            ? "전체 알림"
            : key === "marketing_notifications"
            ? "마케팅 알림"
            : "친한친구 자동출력"
        } 설정이 업데이트되었습니다.`,
      });
    } catch (error) {
      console.error("❌ 설정 저장 실패:", {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        key,
        attemptedValue: value,
        originalValue: originalSettings[key],
        userId: profile.id,
      });

      // 실패 시 원래 설정으로 롤백
      setSettings(originalSettings);
      if (process.env.NODE_ENV !== 'production') {
        console.log("🔄 설정 롤백 완료:", originalSettings);
      }

      // 사용자 친화적 에러 메시지 생성
      let userFriendlyMessage = "설정을 저장하는데 실패했습니다.";

      if (error instanceof Error) {
        const message = error.message.toLowerCase();

        if (
          message.includes("network") ||
          message.includes("인터넷") ||
          message.includes("연결")
        ) {
          userFriendlyMessage = "인터넷 연결을 확인하고 다시 시도해주세요.";
        } else if (
          message.includes("permission") ||
          message.includes("권한") ||
          message.includes("denied")
        ) {
          userFriendlyMessage = "권한이 없습니다. 다시 로그인해주세요.";
        } else if (
          message.includes("마이그레이션") ||
          message.includes("migration") ||
          message.includes("column")
        ) {
          userFriendlyMessage =
            "시스템 업데이트가 필요합니다. 잠시 후 다시 시도해주세요.";
        } else if (message.includes("timeout")) {
          userFriendlyMessage =
            "요청 시간이 초과되었습니다. 다시 시도해주세요.";
        } else {
          userFriendlyMessage = error.message;
        }
      }

      toast({
        title: "저장 실패",
        description: userFriendlyMessage,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 향상된 푸시 알림 설정
  const handlePushSetup = async () => {
    setPushSetupStatus('권한 요청 중...');
    
    toast({
      title: '푸시 알림 설정',
      description: '권한을 요청하고 있습니다...',
    });

    try {
      setPushSetupStatus('Firebase 초기화 중...');
      
      // Firebase 설정 상태 확인
      if (!firebaseStatus?.configLoaded) {
        throw new Error('Firebase 설정이 완료되지 않았습니다');
      }

      if (!firebaseStatus?.supported) {
        throw new Error('이 환경에서는 푸시 알림을 지원하지 않습니다');
      }

      setPushSetupStatus('FCM 토큰 발급 중...');
      toast({
        title: '푸시 알림 설정',
        description: 'FCM 토큰을 발급하고 있습니다...',
      });

      const success = await setupPushNotifications();

      if (success) {
        setPushSetupStatus('설정 완료');
        toast({
          title: '✅ 설정 완료!',
          description: '푸시 알림을 받을 수 있습니다.',
        });
      } else {
        setPushSetupStatus('설정 실패');
        throw new Error('푸시 알림 설정에 실패했습니다');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      setPushSetupStatus(`실패: ${errorMessage}`);
      
      toast({
        title: '❌ 설정 실패',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-600">설정을 불러올 수 없습니다.</p>
              <Button onClick={() => router.back()} className="mt-4">
                돌아가기
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* 헤더 */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="p-2"
            >
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">알림 설정</h1>
              <p className="text-sm text-gray-600">
                알림 수신 방식을 설정하세요
              </p>
            </div>
          </div>
        </div>

        {/* 알림 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell size={20} />
              알림 설정
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">전체 알림</Label>
                <p className="text-xs text-gray-600">
                  메시지, 친구 요청, 프린터 등 모든 알림 수신
                </p>
              </div>
              <Switch
                checked={settings.message_notifications}
                onCheckedChange={(checked) =>
                  handleSettingChange("message_notifications", checked)
                }
                disabled={isSaving}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">푸시 알림</Label>
                <p className="text-xs text-gray-600">
                  앱이 백그라운드일 때 시스템 알림 표시
                </p>
              </div>
              <div className="space-y-2">
                {isGranted ? (
                  <div className="text-xs text-green-600">✅ 설정 완료</div>
                ) : canSetup ? (
                  <div className="space-y-2">
                    <Button
                      size="sm"
                      onClick={handlePushSetup}
                      disabled={!isSupported}
                    >
                      {!isSupported ? "지원 안됨" : "설정하기"}
                    </Button>
                    <div className="text-xs text-blue-600">{pushSetupStatus}</div>
                  </div>
                ) : permission === 'denied' ? (
                  <div className="text-xs text-red-600">❌ 권한 거부됨</div>
                ) : (
                  <div className="text-xs text-gray-500">로딩 중...</div>
                )}
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">친한친구 자동출력</Label>
                <p className="text-xs text-gray-600">
                  친한친구 메시지를 승인 없이 자동으로 출력
                </p>
              </div>
              <Switch
                checked={settings.auto_print_close_friends}
                onCheckedChange={(checked) =>
                  handleSettingChange("auto_print_close_friends", checked)
                }
                disabled={isSaving}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">마케팅 알림</Label>
                <p className="text-xs text-gray-600">이벤트 및 프로모션 정보</p>
              </div>
              <Switch
                checked={settings.marketing_notifications}
                onCheckedChange={(checked) =>
                  handleSettingChange("marketing_notifications", checked)
                }
                disabled={isSaving}
              />
            </div>

            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>알림 소리, 진동</strong>은 기기의 시스템 설정에서 조정할
                수 있습니다.
              </p>
            </div>

            {/* Firebase 상태 표시 (APK 디버깅용) */}
            {firebaseStatus && (
              <div className="bg-gray-50 p-3 rounded-lg border">
                <p className="text-xs font-medium text-gray-700 mb-2">📱 시스템 상태</p>
                <div className="space-y-1 text-xs text-gray-600">
                  <div>브라우저 지원: {firebaseStatus.supported ? '✅' : '❌'}</div>
                  <div>알림 권한: {
                    firebaseStatus.permission === 'granted' ? '✅ 허용됨' : 
                    firebaseStatus.permission === 'denied' ? '❌ 거부됨' : 
                    '⏳ 대기 중'
                  }</div>
                  <div>FCM 토큰: {firebaseStatus.hasToken ? '✅ 발급됨' : '❌ 없음'}</div>
                  <div>Firebase 설정: {firebaseStatus.configLoaded ? '✅ 로드됨' : '❌ 누락'}</div>
                  {firebaseStatus.error && (
                    <div className="text-red-600 mt-2">⚠️ {firebaseStatus.error}</div>
                  )}
                </div>
              </div>
            )}

            {/* 개발 정보 (개발 중에만 표시) */}
            {process.env.NODE_ENV !== 'production' && (
              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <p className="text-xs text-green-800">
                  <strong>✅ 개발 안내:</strong> 설정 변경은 DB에 저장되며 새로고침 후에도 유지됩니다.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
