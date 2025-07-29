"use client";

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
import { Settings, LogOut, User, Bell, Shield, HelpCircle } from "lucide-react";

export default function ProfilePage() {
  const { profile, signOut, isDevelopmentMode } = useAuthStore();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("로그아웃 실패:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* 헤더 */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">프로필</h1>
          <p className="text-gray-600 mt-1">계정 정보와 설정을 관리하세요</p>
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
                {isDevelopmentMode && (
                  <Badge variant="secondary" className="mt-1">
                    🧪 개발 모드
                  </Badge>
                )}
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
            <Button variant="ghost" className="w-full justify-start gap-3">
              <Bell size={16} />
              알림 설정
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3">
              <Shield size={16} />
              개인정보 설정
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3">
              <HelpCircle size={16} />
              도움말
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
          {isDevelopmentMode ? "개발용 로그아웃" : "로그아웃"}
        </Button>
      </div>
    </div>
  );
}
