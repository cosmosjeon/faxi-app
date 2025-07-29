// User profile 타입 (database.mdc 기준)
export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Friendship 관계 타입
export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  is_close_friend: boolean;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
  updated_at: string;
}

// 친구 목록용 조합 타입 (JOIN 결과)
export interface FriendWithProfile {
  id: string; // friendship id
  user_id: string;
  friend_id: string;
  is_close_friend: boolean;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
  updated_at: string;
  friend_profile: UserProfile;
  is_mutual: boolean; // 맞팔 여부
  is_received_request: boolean; // 받은 요청인지 여부
}

// 친구 검색 결과 타입
export interface SearchResult {
  user: UserProfile;
  friendship_status: "none" | "pending" | "accepted" | "blocked";
  is_mutual: boolean;
}

// API 요청/응답 타입들
export interface AddFriendRequest {
  friend_id: string;
}

export interface UpdateCloseFriendRequest {
  friendship_id: string;
  is_close_friend: boolean;
}
