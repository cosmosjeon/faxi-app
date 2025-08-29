"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Shield, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/auth.store";
import { useToast } from "@/hooks/use-toast";
import {
  getUserSettings,
  updatePrivacySettings,
} from "@/features/settings/api";
import type { PrivacySettings, UserSettings } from "@/features/settings/types";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

export default function PrivacySettingsPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 설정 로드
  useEffect(() => {
    if (!profile?.id) return;

    const loadSettings = async () => {
      try {

        const userSettings = await getUserSettings(profile.id);

        if (process.env.NODE_ENV !== 'production') {
          console.log("📋 가져온 사용자 설정:", {
            raw: userSettings,
            hasProfileVisibility: "profile_visibility" in (userSettings || {}),
            hasOnlineStatus: "show_online_status" in (userSettings || {}),
          });
        }

        if (userSettings) {
          // MVP 개인정보 설정만 추출
          const privacySettings: PrivacySettings = {
            profile_visibility: userSettings.profile_visibility ?? "public",
            show_online_status: userSettings.show_online_status ?? true,
          };

          if (process.env.NODE_ENV !== 'production') {
            console.log("✅ 로드된 개인정보 설정:", privacySettings);
          }
          setSettings(privacySettings);
        } else {
          if (process.env.NODE_ENV !== 'production') {
            console.warn("⚠️ 사용자 설정이 없음, 기본값 사용");
          }

          // 기본값 설정
          const defaultSettings: PrivacySettings = {
            profile_visibility: "public",
            show_online_status: true,
          };

          setSettings(defaultSettings);
        }
      } catch (error) {
        console.error("❌ 개인정보 설정 로드 실패:", error);
        toast({
          title: t("privacy.load_failed"),
          description: t("privacy.subtitle"),
          variant: "destructive",
        });

        // 오류 발생 시에도 기본값으로 설정
        const fallbackSettings: PrivacySettings = {
          profile_visibility: "public",
          show_online_status: true,
        };

        setSettings(fallbackSettings);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [profile?.id, toast]);

  // 설정 업데이트
  const handleSettingChange = async (
    key: keyof PrivacySettings,
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
      console.log("🔄 개인정보 설정 변경 시작:", {
        key,
        value,
        userId: profile.id,
        originalValue: settings[key],
      });
    }

    // 클라이언트 사이드 검증
    if (key === "profile_visibility" && typeof value !== "string") {
      console.error("❌ 잘못된 값 타입:", {
        key,
        value,
        expectedType: "string",
        actualType: typeof value,
      });
      toast({
        title: "설정 오류",
        description: "올바르지 않은 설정 값입니다.",
        variant: "destructive",
      });
      return;
    }

    if (key === "show_online_status" && typeof value !== "boolean") {
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
        settings: { [key]: value } as Partial<PrivacySettings>,
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

      const result = await updatePrivacySettings(updateRequest);

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
        const syncedSettings: PrivacySettings = {
          profile_visibility: refreshedSettings.profile_visibility ?? "public",
          show_online_status: refreshedSettings.show_online_status ?? true,
        };

        setSettings(syncedSettings);
        if (process.env.NODE_ENV !== 'production') {
          console.log("🔄 설정 동기화 완료:", syncedSettings);
        }
      }

      toast({
        title: "설정 저장됨",
        description: `${
          key === "profile_visibility" ? "프로필 공개 범위" : "온라인 상태 표시"
        } 설정이 업데이트되었습니다.`,
      });
    } catch (error) {
      console.error("❌ 개인정보 설정 저장 실패:", {
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
              <p className="text-gray-600">{t("privacy.load_failed")}</p>
              <Button onClick={() => router.back()} className="mt-4">
                {t("notifications.go_back")}
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
        <div className="bg-white rounded-lg px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="p-2"
            >
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 leading-tight">{t("privacy.title")}</h1>
              <p className="text-sm text-gray-600 mt-0.5">{t("privacy.subtitle")}</p>
            </div>
          </div>
        </div>

        {/* MVP 개인정보 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield size={20} />
              {t("privacy.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("privacy.profile_visibility")}</Label>
              <Select
                value={settings.profile_visibility}
                onValueChange={(value: "public" | "friends_only" | "private") =>
                  handleSettingChange("profile_visibility", value)
                }
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">{t("privacy.visibility_public")}</SelectItem>
                  <SelectItem value="friends_only">{t("privacy.visibility_friends")}</SelectItem>
                  <SelectItem value="private">{t("privacy.visibility_private")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-600">
                {settings.profile_visibility === "public" && t("privacy.visibility_desc_public")}
                {settings.profile_visibility === "friends_only" && t("privacy.visibility_desc_friends")}
                {settings.profile_visibility === "private" && t("privacy.visibility_desc_private")}
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">{t("privacy.online_status")}</Label>
                <p className="text-xs text-gray-600">{t("privacy.online_status_desc")}</p>
              </div>
              <Switch
                checked={settings.show_online_status}
                onCheckedChange={(checked) =>
                  handleSettingChange("show_online_status", checked)
                }
                disabled={isSaving}
              />
            </div>

            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-xs text-blue-700">{t("privacy.online_status_tip")}</p>
            </div>

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
