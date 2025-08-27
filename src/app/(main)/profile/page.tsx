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
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/login");
      toast({
        title: "로그아웃 완료",
        description: "성공적으로 로그아웃되었습니다.",
      });
    } catch (error) {
      console.error("로그아웃 실패:", error);
      toast({
        title: "로그아웃 실패",
        description: "로그아웃 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* 헤더 */}
        <div className="bg-white rounded-lg px-4 py-3 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900 leading-tight">프로필</h1>
          <p className="text-gray-600 mt-0.5">계정 정보와 설정을 관리하세요</p>
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
                  {profile?.display_name || "사용자"}
                </h2>
                <p className="text-gray-600">
                  @{profile?.username || "username"}
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
              설정
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => router.push("/profile/notifications")}
            >
              <Bell size={16} />
              알림 설정
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => router.push("/profile/privacy")}
            >
              <Shield size={16} />
              개인정보 설정
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
                  <div>도움말</div>
                  <div className="text-xs text-gray-500">
                    FAXI 홈페이지로 이동
                  </div>
                </div>
              </div>
              <ExternalLink size={14} className="text-gray-400" />
            </Button>
          </CardContent>
        </Card>

        {/* 앱 정보 */}
        <Card>
          <CardHeader>
            <CardTitle>앱 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">버전</span>
              <span>1.0.0 (MVP)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">빌드</span>
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
          로그아웃
        </Button>
      </div>
    </div>
  );
}
