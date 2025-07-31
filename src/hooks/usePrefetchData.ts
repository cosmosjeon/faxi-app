import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getFriendsList } from "@/features/friends/api";
import { getMessagesList } from "@/features/messages/api";
import { useAuthStore } from "@/stores/auth.store";

/**
 * 다른 페이지의 데이터를 미리 로드하는 훅
 */
export function usePrefetchData() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  useEffect(() => {
    if (!profile?.id) return;

    // 친구 목록 미리 로드 (홈에서 친구 페이지로 이동할 때 빠른 로딩)
    queryClient.prefetchQuery({
      queryKey: ["friends", profile.id],
      queryFn: () => getFriendsList(profile.id),
      staleTime: 5 * 60 * 1000, // 5분
    });

    // 메시지 목록 미리 로드 (친구 페이지에서 홈으로 이동할 때 빠른 로딩)
    queryClient.prefetchQuery({
      queryKey: ["messages", profile.id],
      queryFn: () => getMessagesList(profile.id),
      staleTime: 30 * 1000, // 30초
    });
  }, [profile?.id, queryClient]);
}

/**
 * 특정 사용자의 데이터를 미리 로드하는 훅
 */
export function usePrefetchUserData(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    // 사용자 프로필 미리 로드
    queryClient.prefetchQuery({
      queryKey: ["userProfile", userId],
      queryFn: async () => {
        const { supabase } = await import("@/lib/supabase/client");
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) throw error;
        return data;
      },
      staleTime: 10 * 60 * 1000, // 10분
    });
  }, [userId, queryClient]);
}
