"use client";

import { useAuthStore } from "@/stores/auth.store";
import { useAuth } from "@/components/auth-provider";
import { BottomTabBar } from "@/components/domain/navigation/BottomTabBar";
import { Loader2 } from "lucide-react";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { isInitialized, isLoading } = useAuth();
  const { profile } = useAuthStore();

  // 인증 초기화가 완료되지 않았거나 로딩 중인 경우
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-900">
              로딩 중...
            </h2>
            <p className="text-sm text-gray-600">
              인증 상태를 확인하고 있습니다
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 프로필이 없는 경우 (온보딩 필요)
  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-900">
              프로필 설정 중...
            </h2>
            <p className="text-sm text-gray-600">
              온보딩 페이지로 이동합니다
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 메인 컨텐츠 영역 */}
      <main className="flex-1 pb-16">{children}</main>

      {/* 하단 고정 탭바 */}
      <BottomTabBar />
    </div>
  );
}
