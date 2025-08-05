import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getFriendsList,
  searchUserByUsername,
  addFriend,
  acceptFriendRequest,
  rejectFriendRequest,
} from "@/features/friends/api";
import type {
  FriendWithProfile,
  SearchResult,
  AddFriendRequest,
} from "@/features/friends/types";
import { useAuthStore } from "@/stores/auth.store";

/**
 * 친구 목록 조회 쿼리
 */
export function useFriendsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: ["friends", userId],
    queryFn: () => getFriendsList(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5분 캐시 (자주 변하지 않음)
    gcTime: 10 * 60 * 1000, // 10분간 캐시 유지
    refetchOnWindowFocus: false,
    // 캐시된 데이터가 있으면 즉시 표시
    placeholderData: (previousData) => previousData,
  });
}

/**
 * 사용자 검색 쿼리
 */
export function useSearchUsersQuery(username: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ["searchUsers", username],
    queryFn: () => searchUserByUsername(username),
    enabled: enabled && username.trim().length > 0,
    staleTime: 2 * 60 * 1000, // 2분 캐시
    refetchOnWindowFocus: false,
  });
}

/**
 * 친구 추가 뮤테이션
 */
export function useAddFriendMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (data: AddFriendRequest) => {
      if (!user?.id) {
        throw new Error("사용자 인증이 필요합니다.");
      }
      return addFriend(data, user.id);
    },
    onSuccess: () => {
      // 친구 목록 갱신
      queryClient.invalidateQueries({
        queryKey: ["friends"],
      });
      // 검색 결과도 갱신 (친구 상태 변경)
      queryClient.invalidateQueries({
        queryKey: ["searchUsers"],
      });
    },
  });
}

/**
 * 친구 요청 수락 뮤테이션
 */
export function useAcceptFriendRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (friendshipId: string) => acceptFriendRequest(friendshipId),
    onSuccess: () => {
      // 친구 목록 갱신
      queryClient.invalidateQueries({
        queryKey: ["friends"],
      });
    },
  });
}

/**
 * 친구 요청 거절 뮤테이션
 */
export function useRejectFriendRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (friendshipId: string) => rejectFriendRequest(friendshipId),
    onSuccess: () => {
      // 친구 목록 갱신
      queryClient.invalidateQueries({
        queryKey: ["friends"],
      });
    },
  });
}


