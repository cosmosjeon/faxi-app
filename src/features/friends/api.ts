import { supabase } from "@/lib/supabase/client";
import { friendToasts } from "@/lib/toasts";
import type {
  UserProfile,
  Friendship,
  FriendWithProfile,
  SearchResult,
  AddFriendRequest,
  UpdateCloseFriendRequest,
} from "./types";

/**
 * 사용자명으로 사용자 검색
 */
export async function searchUserByUsername(
  username: string
): Promise<SearchResult[]> {
  if (!username.trim()) return [];

  // 실제 Supabase API 호출
  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .ilike("username", `%${username}%`)
      .eq("is_active", true)
      .limit(10);

    if (error) throw error;

    return (
      users?.map((user) => ({
        user,
        friendship_status: "none" as const,
        is_mutual: false,
      })) || []
    );
  } catch (error) {
    console.error("사용자 검색 실패:", error);
    throw new Error("사용자 검색에 실패했습니다.");
  }
}

/**
 * 현재 사용자의 친구 목록 조회
 */
export async function getFriendsList(
  userId: string
): Promise<FriendWithProfile[]> {
  // 실제 Supabase API 호출
  try {
    const { data: friendships, error } = await supabase
      .from("friendships")
      .select(
        `
                *,
                friend_profile:friend_id(*)
            `
      )
      .eq("user_id", userId)
      .in("status", ["accepted", "pending"]); // accepted와 pending 상태 모두 포함

    if (error) throw error;

    // 맞팔 여부 확인 (accepted 상태인 경우만)
    const friendsWithMutual = await Promise.all(
      (friendships || []).map(async (friendship) => {
        let isMutual = false;
        
        if (friendship.status === "accepted") {
          const { data: mutualCheck } = await supabase
            .from("friendships")
            .select("id")
            .eq("user_id", friendship.friend_id)
            .eq("friend_id", userId)
            .eq("status", "accepted")
            .single();
          
          isMutual = !!mutualCheck;
        }

        return {
          ...friendship,
          is_mutual: isMutual,
        };
      })
    );

    return friendsWithMutual;
  } catch (error) {
    console.error("친구 목록 조회 실패:", error);
    throw new Error("친구 목록을 불러오는데 실패했습니다.");
  }
}

/**
 * 친구 추가
 */
export async function addFriend(
  request: AddFriendRequest,
  currentUserId: string
): Promise<Friendship> {
  // 실제 Supabase API 호출
  try {
    const { data, error } = await supabase
      .from("friendships")
      .insert({
        user_id: currentUserId,
        friend_id: request.friend_id,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("친구 추가 실패:", error);
    throw new Error("친구 추가에 실패했습니다.");
  }
}

/**
 * 친한 친구 토글
 */
export async function updateCloseFriend(
  request: UpdateCloseFriendRequest
): Promise<void> {
  // 실제 Supabase API 호출
  try {
    const { error } = await supabase
      .from("friendships")
      .update({
        is_close_friend: request.is_close_friend,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.friendship_id);

    if (error) throw error;
  } catch (error) {
    console.error("친한 친구 설정 업데이트 실패:", error);
    throw new Error("친한 친구 설정을 변경하는데 실패했습니다.");
  }
}

/**
 * 친구 삭제
 */
export async function removeFriend(friendshipId: string): Promise<void> {
  // 실제 Supabase API 호출
  try {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", friendshipId);

    if (error) throw error;
  } catch (error) {
    console.error("친구 삭제 실패:", error);
    throw new Error("친구 삭제에 실패했습니다.");
  }
}

/**
 * 특정 사용자가 친한 친구인지 확인
 */
export async function isCloseFriend(
  userId: string,
  friendId: string
): Promise<boolean> {
  // 실제 Supabase API 호출
  try {
    const { data, error } = await supabase
      .from("friendships")
      .select("is_close_friend")
      .eq("user_id", userId)
      .eq("friend_id", friendId)
      .eq("status", "accepted")
      .single();

    if (error) {
      console.error("친한 친구 확인 실패:", error);
      return false;
    }

    return data?.is_close_friend || false;
  } catch (error) {
    console.error("친한 친구 확인 실패:", error);
    return false;
  }
}

/**
 * 두 사용자 간의 친구 관계 상태 확인
 */
export async function getFriendshipStatus(
  currentUserId: string,
  targetUserId: string
): Promise<"none" | "pending" | "accepted" | "blocked"> {
  try {
    const { data, error } = await supabase
      .from("friendships")
      .select("status")
      .eq("user_id", currentUserId)
      .eq("friend_id", targetUserId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("친구 관계 상태 확인 실패:", error);
      return "none";
    }

    return data?.status || "none";
  } catch (error) {
    console.error("친구 관계 상태 확인 실패:", error);
    return "none";
  }
}

/**
 * 친구 요청 수락
 */
export async function acceptFriendRequest(
  friendshipId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("friendships")
      .update({
        status: "accepted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", friendshipId);

    if (error) throw error;
  } catch (error) {
    console.error("친구 요청 수락 실패:", error);
    throw new Error("친구 요청을 수락하는데 실패했습니다.");
  }
}

/**
 * 친구 요청 거절
 */
export async function rejectFriendRequest(
  friendshipId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", friendshipId);

    if (error) throw error;
  } catch (error) {
    console.error("친구 요청 거절 실패:", error);
    throw new Error("친구 요청을 거절하는데 실패했습니다.");
  }
}
