"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth.store";
import {
  Settings,
  LogOut,
  User,
  Bell,
  Shield,
  HelpCircle,
  ExternalLink,
  Languages,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

export default function ProfilePage() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();
  const { t } = useTranslation();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/login");
      toast({
        title: t("common.logout"),
        description: t("profile.title"),
      });
    } catch (error) {
      console.error("로그아웃 실패:", error);
      toast({
        title: t("common.logout"),
        description: "",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* 헤더 */}
        <div className="bg-white rounded-lg px-4 py-3 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900 leading-tight">{t("profile.title")}</h1>
          <p className="text-gray-600 mt-0.5">{t("profile.subtitle")}</p>
        </div>

        {/* 프로필 정보 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback>
                  {profile?.display_name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900">
                  {profile?.display_name || t("profile.unknown_user")}
                </h2>
                <p className="text-gray-600">
                  @{profile?.username || t("profile.username")}
                </p>
              </div>
              <Button variant="outline" size="sm">
                <User size={16} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 설정 메뉴 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings size={20} />
              {t("profile.menu")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => router.push("/profile/notifications")}
            >
              <Bell size={16} />
              {t("profile.notifications")}
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => router.push("/profile/privacy")}
            >
              <Shield size={16} />
              {t("profile.privacy")}
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => router.push("/profile/language")}
            >
              <Languages size={16} />
              {t("language.title")}
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-between gap-3"
              onClick={() =>
                window.open(
                  "https://skku-spec.notion.site/240aeeb6b64880fda8d7f3fe671cf068?source=copy_link",
                  "_blank"
                )
              }
            >
              <div className="flex items-center gap-3">
                <HelpCircle size={16} />
                <div className="text-left">
                  <div>{t("profile.help")}</div>
                  <div className="text-xs text-gray-500">{t("profile.help_sub")}</div>
                </div>
              </div>
              <ExternalLink size={14} className="text-gray-400" />
            </Button>
          </CardContent>
        </Card>

        {/* 앱 정보 */}
        <Card>
          <CardHeader>
            <CardTitle>{t("profile.app_info")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t("common.version")}</span>
              <span>1.0.0 (MVP)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t("common.build")}</span>
              <span>2025.01.29</span>
            </div>
          </CardContent>
        </Card>

        {/* 로그아웃 */}
        <Button
          variant="outline"
          className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50"
          onClick={handleSignOut}
        >
          <LogOut size={16} />
          {t("common.logout")}
        </Button>
      </div>
    </div>
  );
}
