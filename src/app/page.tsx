"use client";

import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const router = useRouter();
  const { user, profile, isInitialized, isLoading } = useAuthStore();

  useEffect(() => {
    // 초기화가 완료되지 않았거나 로딩 중이면 대기
    if (!isInitialized || isLoading) {
      return;
    }

    // 로그인되지 않은 사용자는 로그인 페이지로
    if (!user) {
      router.push("/login");
      return;
    }

    // 프로필이 없는 사용자는 온보딩 페이지로
    if (!profile) {
      router.push("/onboarding");
      return;
    }

    // 프로필이 있는 사용자는 홈 페이지로
    router.push("/home");
  }, [user, profile, isInitialized, isLoading, router]);

  // 로딩 중이거나 초기화 중이면 로딩 화면 표시
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 리디렉션 중이면 빈 화면 표시
  return null;
}
