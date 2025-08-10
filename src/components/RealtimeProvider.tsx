"use client";

import { ReactNode, useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useRealtime } from "@/hooks/useRealtime";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { useRealtimeStore } from "@/stores/realtimeStore";
import { RealtimeNotifications } from "./RealtimeNotifications";

interface RealtimeProviderProps {
  children: ReactNode;
  enableNotifications?: boolean;
  enableSound?: boolean;
}

export const RealtimeProvider = ({
  children,
  enableNotifications = true,
  enableSound = false,
}: RealtimeProviderProps) => {
  const { user, isLoading } = useAuthStore();
  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState(false);
  const { reset: resetRealtimeStore } = useRealtimeStore();

  // 사용자 상태 변화에 따른 실시간 기능 활성화/비활성화
  useEffect(() => {
    if (isLoading) {
      // 로딩 중에는 실시간 기능 비활성화
      setIsRealtimeEnabled(false);
      return;
    }

    if (user?.id) {
      // 사용자가 로그인되어 있으면 실시간 기능 활성화
      console.log("🟢 Enabling realtime features for user:", user.id);
      setIsRealtimeEnabled(true);
    } else {
      // 사용자가 로그아웃되면 실시간 기능 비활성화 및 상태 초기화
      console.log("🔴 Disabling realtime features - user logged out");
      setIsRealtimeEnabled(false);
      resetRealtimeStore();
    }
  }, [user?.id, isLoading, resetRealtimeStore]);

  // 실시간 데이터 구독 (백그라운드에서 자동 실행)
  useRealtime({
    userId: user?.id,
    enabled: isRealtimeEnabled,
  });


  // 실시간 알림 관리 (백그라운드에서 자동 실행)
  useRealtimeNotifications({
    enabled: isRealtimeEnabled && enableNotifications,
    soundEnabled: enableSound,
  });

  // 디버그 정보 (개발 환경에서만)
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("RealtimeProvider State:", {
        userId: user?.id,
        isLoading,
        isRealtimeEnabled,
        enableNotifications,
        enableSound,
      });
    }
  }, [
    user?.id,
    isLoading,
    isRealtimeEnabled,
    enableNotifications,
    enableSound,
  ]);

  // UI는 그대로 렌더링하고, 백그라운드에서만 실시간 기능 동작
  return (
    <>
      {children}
      {/* 백그라운드 알림 처리 (UI 없음) */}
      {isRealtimeEnabled && enableNotifications && <RealtimeNotifications />}
    </>
  );
};
