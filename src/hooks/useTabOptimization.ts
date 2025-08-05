"use client";

import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";

// 캐시 및 디바운싱 상수
const CACHE_STALE_TIME = 5 * 60 * 1000; // 5분
const PREFETCH_DEBOUNCE_DELAY = 100; // 100ms

/**
 * 탭 전환 성능 최적화를 위한 훅
 */
export function useTabOptimization() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const prefetchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 탭별 데이터 프리페칭
  const prefetchTabData = async (tab: string) => {
    if (!user?.id) return;

    switch (tab) {
      case "home":
        // 메시지 목록 프리페칭
        await queryClient.prefetchQuery({
          queryKey: ["messages", user.id],
          queryFn: async () => {
            const { getMessagesList } = await import("@/features/messages/api");
            return getMessagesList(user.id);
          },
          staleTime: CACHE_STALE_TIME,
        });
        break;

      case "friends":
        // 친구 목록 프리페칭
        await queryClient.prefetchQuery({
          queryKey: ["friends", user.id],
          queryFn: async () => {
            const { getFriendsList } = await import("@/features/friends/api");
            return getFriendsList(user.id);
          },
          staleTime: CACHE_STALE_TIME,
        });
        break;

      case "compose":
        // 작성 페이지를 위한 친구 목록 프리페칭
        await queryClient.prefetchQuery({
          queryKey: ["friends", user.id],
          queryFn: async () => {
            const { getFriendsList } = await import("@/features/friends/api");
            return getFriendsList(user.id);
          },
          staleTime: CACHE_STALE_TIME,
        });
        break;
    }
  };

  // 탭 호버 시 프리페칭 (디바운싱 적용, 메모리 누수 방지)
  const handleTabHover = (tab: string) => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
    }
    prefetchTimerRef.current = setTimeout(() => {
      prefetchTabData(tab);
    }, PREFETCH_DEBOUNCE_DELAY);
  };

  // 정리 함수
  const cleanup = () => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
  };

  return { handleTabHover, prefetchTabData, cleanup };
}
