"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";

/**
 * 탭 전환 성능 최적화를 위한 훅
 */
export function useTabOptimization() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

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
          staleTime: 5 * 60 * 1000,
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
          staleTime: 5 * 60 * 1000,
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
          staleTime: 5 * 60 * 1000,
        });
        break;
    }
  };

  // 탭 호버 시 프리페칭 (디바운싱 적용)
  let prefetchTimer: NodeJS.Timeout;
  const handleTabHover = (tab: string) => {
    clearTimeout(prefetchTimer);
    prefetchTimer = setTimeout(() => {
      prefetchTabData(tab);
    }, 100); // 100ms 딜레이
  };

  return { handleTabHover, prefetchTabData };
}
