import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { UserProfile } from "@/features/friends/types";

/**
 * 사용자 프로필 조회 쿼리
 */
export function useUserProfileQuery(userId: string | undefined) {
  return useQuery({
    queryKey: ["userProfile", userId],
    queryFn: async (): Promise<UserProfile> => {
      if (!userId) throw new Error("사용자 ID가 필요합니다");

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      if (!data) throw new Error("사용자를 찾을 수 없습니다");

      return data;
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10분 캐시 (거의 변하지 않음)
    refetchOnWindowFocus: false,
  });
}

/**
 * 현재 로그인된 사용자 프로필 조회 쿼리
 */
export function useCurrentUserProfileQuery() {
  return useQuery({
    queryKey: ["currentUserProfile"],
    queryFn: async (): Promise<UserProfile | null> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000, // 10분 캐시
    refetchOnWindowFocus: false,
  });
}

/**
 * 사용자 프로필 업데이트 뮤테이션
 */
export function useUpdateUserProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<UserProfile> & { id: string }) => {
      const { data, error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", updates.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (updatedProfile) => {
      // 사용자 프로필 캐시 업데이트
      queryClient.setQueryData(
        ["userProfile", updatedProfile.id],
        updatedProfile
      );

      // 현재 사용자 프로필 캐시도 업데이트
      queryClient.setQueryData(["currentUserProfile"], updatedProfile);

      // 친구 목록에서도 프로필 정보 업데이트
      queryClient.invalidateQueries({
        queryKey: ["friends"],
      });
    },
  });
}
