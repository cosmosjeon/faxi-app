"use client";

import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const router = useRouter();
  const { user, isInitialized, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isInitialized || isLoading) return;

    // 인증된 사용자는 홈으로, 미인증 사용자는 로그인 페이지로
    if (user) {
      router.push("/home");
    } else {
      router.push("/login");
    }
  }, [user, isInitialized, isLoading, router]);

  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <span className="text-gray-600">로딩 중...</span>
        </div>
      </div>
    );
  }

  return null; // 리디렉션 중
}
