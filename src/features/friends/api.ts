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

// 개발용 테스트 사용자 (auth.store.ts와 동일)
const DEV_USERS = [
  {
    id: "dev-user-1",
    username: "alice",
    display_name: "앨리스",
    avatar_url: "https://picsum.photos/100/100?random=1",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "dev-user-2",
    username: "bob",
    display_name: "밥",
    avatar_url: "https://picsum.photos/100/100?random=2",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "dev-user-3",
    username: "charlie",
    display_name: "찰리",
    avatar_url: "https://picsum.photos/100/100?random=3",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // 테스트 시뮬레이션용 사용자들
  {
    id: "test_general_user",
    username: "general_friend",
    display_name: "일반 친구",
    avatar_url: "https://picsum.photos/100/100?random=10",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "test_close_friend",
    username: "close_friend",
    display_name: "친한 친구",
    avatar_url: "https://picsum.photos/100/100?random=11",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// 개발용 mock 친구 관계 데이터
const DEV_FRIENDSHIPS: Friendship[] = [
  {
    id: "friendship-1",
    user_id: "dev-user-1", // alice
    friend_id: "dev-user-2", // bob
    is_close_friend: true,
    status: "accepted",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "friendship-2",
    user_id: "dev-user-2", // bob
    friend_id: "dev-user-1", // alice (맞팔)
    is_close_friend: false,
    status: "accepted",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "friendship-3",
    user_id: "dev-user-1", // alice
    friend_id: "dev-user-3", // charlie
    is_close_friend: false,
    status: "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // 테스트 시뮬레이션용 친구 관계 (모든 개발 사용자와 연결)
  {
    id: "test-friendship-general-1",
    user_id: "dev-user-1", // alice
    friend_id: "test_general_user",
    is_close_friend: false, // 일반 친구
    status: "accepted",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "test-friendship-general-2",
    user_id: "dev-user-2", // bob
    friend_id: "test_general_user",
    is_close_friend: false,
    status: "accepted",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "test-friendship-general-3",
    user_id: "dev-user-3", // charlie
    friend_id: "test_general_user",
    is_close_friend: false,
    status: "accepted",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "test-friendship-close-1",
    user_id: "dev-user-1", // alice
    friend_id: "test_close_friend",
    is_close_friend: true, // 친한 친구
    status: "accepted",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "test-friendship-close-2",
    user_id: "dev-user-2", // bob
    friend_id: "test_close_friend",
    is_close_friend: true, // 친한 친구
    status: "accepted",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "test-friendship-close-3",
    user_id: "dev-user-3", // charlie
    friend_id: "test_close_friend",
    is_close_friend: true, // 친한 친구
    status: "accepted",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const isDevelopmentMode = process.env.NODE_ENV === "development";

/**
 * 사용자명으로 사용자 검색
 */
export async function searchUserByUsername(
  username: string
): Promise<SearchResult[]> {
  if (!username.trim()) return [];

  if (isDevelopmentMode) {
    // 개발 모드: mock 데이터 사용
    const results = DEV_USERS.filter(
      (user) =>
        user.username.toLowerCase().includes(username.toLowerCase()) ||
        user.display_name.includes(username)
    ).map((user) => ({
      user,
      friendship_status: "none" as const,
      is_mutual: false,
    }));

    // 검색 딜레이 시뮬레이션
    await new Promise((resolve) => setTimeout(resolve, 300));
    return results;
  }

  // 프로덕션 모드: 실제 Supabase API 호출
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
  if (isDevelopmentMode) {
    // 개발 모드: mock 데이터 사용
    const userFriendships = DEV_FRIENDSHIPS.filter((f) => f.user_id === userId);

    const friendsWithProfiles: FriendWithProfile[] = userFriendships.map(
      (friendship) => {
        const friendProfile = DEV_USERS.find(
          (u) => u.id === friendship.friend_id
        );
        if (!friendProfile) throw new Error("Friend profile not found");

        // 맞팔 여부 확인
        const isMutual = DEV_FRIENDSHIPS.some(
          (f) =>
            f.user_id === friendship.friend_id &&
            f.friend_id === userId &&
            f.status === "accepted"
        );

        return {
          ...friendship,
          friend_profile: friendProfile,
          is_mutual: isMutual,
        };
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 200)); // 딜레이 시뮬레이션
    return friendsWithProfiles;
  }

  // 프로덕션 모드: 실제 Supabase API 호출
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
      .eq("status", "accepted");

    if (error) throw error;

    // 맞팔 여부 확인
    const friendsWithMutual = await Promise.all(
      (friendships || []).map(async (friendship) => {
        const { data: mutualCheck } = await supabase
          .from("friendships")
          .select("id")
          .eq("user_id", friendship.friend_id)
          .eq("friend_id", userId)
          .eq("status", "accepted")
          .single();

        return {
          ...friendship,
          is_mutual: !!mutualCheck,
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
  if (isDevelopmentMode) {
    // 개발 모드: mock 데이터 추가
    const newFriendship: Friendship = {
      id: `friendship-${Date.now()}`,
      user_id: currentUserId,
      friend_id: request.friend_id,
      is_close_friend: false,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    DEV_FRIENDSHIPS.push(newFriendship);
    await new Promise((resolve) => setTimeout(resolve, 500)); // 딜레이 시뮬레이션
    return newFriendship;
  }

  // 프로덕션 모드: 실제 Supabase API 호출
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
  if (isDevelopmentMode) {
    // 개발 모드: mock 데이터 업데이트
    const friendshipIndex = DEV_FRIENDSHIPS.findIndex(
      (f) => f.id === request.friendship_id
    );
    if (friendshipIndex !== -1) {
      DEV_FRIENDSHIPS[friendshipIndex].is_close_friend =
        request.is_close_friend;
      DEV_FRIENDSHIPS[friendshipIndex].updated_at = new Date().toISOString();
    }

    await new Promise((resolve) => setTimeout(resolve, 300)); // 딜레이 시뮬레이션
    return;
  }

  // 프로덕션 모드: 실제 Supabase API 호출
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
  if (isDevelopmentMode) {
    // 개발 모드: mock 데이터에서 제거
    const index = DEV_FRIENDSHIPS.findIndex((f) => f.id === friendshipId);
    if (index !== -1) {
      DEV_FRIENDSHIPS.splice(index, 1);
    }

    await new Promise((resolve) => setTimeout(resolve, 300)); // 딜레이 시뮬레이션
    return;
  }

  // 프로덕션 모드: 실제 Supabase API 호출
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
  if (isDevelopmentMode) {
    // 개발 모드: mock 데이터에서 확인
    const friendship = DEV_FRIENDSHIPS.find(
      (f) =>
        f.user_id === userId &&
        f.friend_id === friendId &&
        f.status === "accepted"
    );

    await new Promise((resolve) => setTimeout(resolve, 100)); // 딜레이 시뮬레이션
    return friendship?.is_close_friend || false;
  }

  // 프로덕션 모드: 실제 Supabase API 호출
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
