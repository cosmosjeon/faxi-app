import { supabase } from "@/lib/supabase/client";
import { friendToasts } from "@/lib/toasts";
import { SEARCH_RESULT_LIMIT, MIN_BATCH_FRIENDS_COUNT } from "../constants";
import { handleApiError, logger } from "../utils";
import type {
  UserProfile,
  Friendship,
  FriendWithProfile,
  SearchResult,
  AddFriendRequest,
  CloseFriendRequest,
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
      .limit(SEARCH_RESULT_LIMIT);

    if (error) throw error;

    return (
      users?.map((user) => ({
        user,
        friendship_status: "none" as const,
        is_mutual: false,
      })) || []
    );
  } catch (error) {
    handleApiError("FRIEND_SEARCH_FAILED", error);
  }
}

/**
 * 현재 사용자의 친구 목록 조회
 */
export async function getFriendsList(
  userId: string
): Promise<FriendWithProfile[]> {
  try {
    // 내가 보낸 친구 요청들
    const { data: sentRequests, error: sentError } = await supabase
      .from("friendships")
      .select(`*, friend_profile:friend_id(*)`)
      .eq("user_id", userId)
      .in("status", ["accepted", "pending"]);

    if (sentError) throw sentError;

    // 내가 받은 친구 요청들
    const { data: receivedRequests, error: receivedError } = await supabase
      .from("friendships")
      .select(`*, friend_profile:user_id(*)`)
      .eq("friend_id", userId)
      .in("status", ["accepted", "pending"]);

    if (receivedError) throw receivedError;

    // 받은 요청 데이터 정규화
    const normalizedReceived = (receivedRequests || []).map((req) => ({
      ...req,
      friend_profile: req.friend_profile,
      friend_id: req.user_id,
      user_id: req.friend_id,
      is_received_request: true,
    }));

    const normalizedSent = (sentRequests || []).map((req) => ({
      ...req,
      is_received_request: false,
    }));

    const allFriendships = [...normalizedSent, ...normalizedReceived];

    // 맞팔 여부 확인 (수락된 친구만)
    const acceptedFriendIds = allFriendships
      .filter((f) => f.status === "accepted")
      .map((f) => f.friend_id);

    let mutualFriends = new Set<string>();
    
    if (acceptedFriendIds.length > 0) {
      const { data: mutualData } = await supabase
        .from("friendships")
        .select("user_id")
        .eq("friend_id", userId)
        .in("user_id", acceptedFriendIds)
        .eq("status", "accepted");

      mutualFriends = new Set((mutualData || []).map((f) => f.user_id));
    }

    // 최종 데이터 구성
    return allFriendships.map((friendship) => ({
      ...friendship,
      is_mutual:
        friendship.status === "accepted" &&
        mutualFriends.has(friendship.friend_id),
    }));
  } catch (error) {
    handleApiError("FRIEND_LIST_FAILED", error);
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
    handleApiError("FRIEND_ADD_FAILED", error);
  }
}

// ❌ updateCloseFriend 함수 제거됨 (토글 방식 대신 신청-수락 방식 사용)

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
    handleApiError("FRIEND_REMOVE_FAILED", error);
  }
}

/**
 * 특정 사용자가 친한 친구인지 확인
 */
export async function isCloseFriend(
  userId: string,
  friendId: string
): Promise<boolean> {
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
 * 두 사용자 간의 친구 관계 상태 확인 (양방향)
 */
export async function getFriendshipStatus(
  currentUserId: string,
  targetUserId: string
): Promise<"none" | "pending" | "accepted" | "blocked"> {
  try {
    // 양방향으로 친구 관계 확인
    const { data, error } = await supabase
      .from("friendships")
      .select("status, user_id, friend_id")
      .or(
        `and(user_id.eq.${currentUserId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${currentUserId})`
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("친구 관계 상태 확인 실패:", error);
      return "none";
    }

    if (!data || data.length === 0) {
      return "none";
    }

    // 양방향 중 하나라도 accepted면 친구 관계
    const acceptedRelation = data.find(
      (relation) => relation.status === "accepted"
    );
    if (acceptedRelation) {
      return "accepted";
    }

    // pending 상태가 있으면 pending 반환
    const pendingRelation = data.find(
      (relation) => relation.status === "pending"
    );
    if (pendingRelation) {
      return "pending";
    }

    // blocked 상태가 있으면 blocked 반환
    const blockedRelation = data.find(
      (relation) => relation.status === "blocked"
    );
    if (blockedRelation) {
      return "blocked";
    }

    return "none";
  } catch (error) {
    console.error("친구 관계 상태 확인 실패:", error);
    return "none";
  }
}

/**
 * 친구 요청 수락
 */
export async function acceptFriendRequest(friendshipId: string): Promise<void> {
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
export async function rejectFriendRequest(friendshipId: string): Promise<void> {
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

/**
 * 친한친구 신청 보내기 (중복 방지 강화)
 */
export async function sendCloseFriendRequest(
  targetUserId: string,
  currentUserId: string
): Promise<void> {
  try {
    console.log(`🔄 친한친구 신청 시작: ${currentUserId} → ${targetUserId}`);

    // 1. 이미 친구인지 확인
    const friendshipStatus = await getFriendshipStatus(
      currentUserId,
      targetUserId
    );
    console.log(`👥 친구 관계 상태:`, friendshipStatus);

    if (friendshipStatus !== "accepted") {
      throw new Error("친한친구 신청은 이미 친구인 상태에서만 가능합니다.");
    }

    // 2. 이미 친한친구인지 확인
    const isAlreadyCloseFriend = await areCloseFriends(
      currentUserId,
      targetUserId
    );
    console.log(`💖 이미 친한친구 여부:`, isAlreadyCloseFriend);

    if (isAlreadyCloseFriend) {
      throw new Error("이미 친한친구입니다.");
    }

    // 3. 기존 친한친구 신청이 있는지 확인
    const { data: existingRequests, error: checkError } = await supabase
      .from("close_friend_requests")
      .select("*")
      .or(
        `and(requester_id.eq.${currentUserId},target_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},target_id.eq.${currentUserId})`
      )
      .eq("status", "pending");

    if (checkError) throw checkError;

    if (existingRequests && existingRequests.length > 0) {
      const existingRequest = existingRequests[0];
      if (existingRequest.requester_id === currentUserId) {
        throw new Error("이미 친한친구 신청을 보냈습니다.");
      } else {
        throw new Error(
          "상대방이 이미 친한친구 신청을 보냈습니다. 받은 신청을 확인해주세요."
        );
      }
    }

    console.log(`✅ 모든 검증 통과, 친한친구 신청 진행`);

    // 4. 친한친구 신청 생성
    const { error } = await supabase.from("close_friend_requests").insert({
      requester_id: currentUserId,
      target_id: targetUserId,
      status: "pending",
    });

    if (error) throw error;

    console.log(`🎉 친한친구 신청 완료: ${currentUserId} → ${targetUserId}`);
  } catch (error) {
    console.error("친한친구 신청 실패:", error);

    // 사용자 친화적 에러 메시지
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("이미 친한친구")) {
      throw new Error("이미 친한친구입니다! 새로고침 후 다시 확인해주세요.");
    } else if (errorMessage.includes("이미 친한친구 신청")) {
      throw new Error("이미 친한친구 신청을 보냈습니다.");
    } else if (errorMessage.includes("상대방이 이미")) {
      throw new Error(
        "상대방이 먼저 친한친구 신청을 보냈습니다. 받은 신청을 확인해주세요."
      );
    } else {
      throw new Error(
        "친한친구 신청에 실패했습니다. 잠시 후 다시 시도해주세요."
      );
    }
  }
}

/**
 * 친한친구 신청 수락 (강화된 로깅 및 검증)
 */
export async function acceptCloseFriendRequest(
  requestId: string
): Promise<void> {
  try {
    console.log(`🔄 acceptCloseFriendRequest API 호출:`, { requestId });

    const { data, error } = await supabase.rpc("accept_close_friend_request", {
      request_id: requestId,
    });

    console.log(`📊 acceptCloseFriendRequest API 응답:`, { data, error });

    if (error) {
      console.error(`❌ RPC 에러:`, error);
      throw error;
    }

    if (!data) {
      console.error(`❌ RPC 응답 데이터 없음`);
      throw new Error("친한친구 신청을 찾을 수 없습니다.");
    }

    // RPC 응답 검증
    if (typeof data === "object" && data.success === false) {
      console.error(`❌ RPC 비즈니스 로직 에러:`, data.error);

      // 친구 관계 확인 실패 시 디버깅 정보 출력
      if (data.debug_info) {
        console.error(`🔍 친구 관계 디버깅 정보:`, data.debug_info);
      }

      throw new Error(data.error || "친한친구 신청 처리에 실패했습니다.");
    }

    console.log(`✅ 친한친구 신청 수락 완료:`, {
      requestId,
      rpcResponse: data,
    });

    // 수락 후 즉시 관계 상태 재확인 (검증용)
    if (typeof data === "object" && data.requester_id && data.target_id) {
      console.log(`🔍 수락 후 즉시 관계 상태 재확인...`);
      const verificationResult = await areCloseFriends(
        data.requester_id,
        data.target_id
      );
      console.log(`📋 수락 후 친한친구 상태:`, verificationResult);
    }
  } catch (error) {
    console.error("친한친구 신청 수락 실패:", error);

    // 구체적인 에러 메시지 제공
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (
      errorMessage.includes("function") &&
      errorMessage.includes("does not exist")
    ) {
      throw new Error(
        "데이터베이스 설정이 완료되지 않았습니다. 관리자에게 문의해주세요."
      );
    }

    throw new Error(errorMessage || "친한친구 신청 수락에 실패했습니다.");
  }
}

/**
 * 친한친구 신청 거절
 */
export async function rejectCloseFriendRequest(
  requestId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("close_friend_requests")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", requestId);

    if (error) throw error;
  } catch (error) {
    console.error("친한친구 신청 거절 실패:", error);
    throw new Error("친한친구 신청 거절에 실패했습니다.");
  }
}

/**
 * 친한친구 신청 취소 (보낸 신청 취소)
 */
export async function cancelCloseFriendRequest(
  requestId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("close_friend_requests")
      .delete()
      .eq("id", requestId);

    if (error) throw error;
  } catch (error) {
    console.error("친한친구 신청 취소 실패:", error);
    throw new Error("친한친구 신청 취소에 실패했습니다.");
  }
}

/**
 * 받은 친한친구 신청 목록 조회
 */
export async function getReceivedCloseFriendRequests(
  userId: string
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("close_friend_requests")
      .select(
        `
        *,
        requester_profile:requester_id(
          id,
          username,
          display_name,
          avatar_url,
          is_active
        )
      `
      )
      .eq("target_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("받은 친한친구 신청 목록 조회 실패:", error);
    throw new Error("받은 친한친구 신청 목록을 불러오는데 실패했습니다.");
  }
}

/**
 * 보낸 친한친구 신청 목록 조회
 */
export async function getSentCloseFriendRequests(
  userId: string
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("close_friend_requests")
      .select(
        `
        *,
        target_profile:target_id(
          id,
          username,
          display_name,
          avatar_url,
          is_active
        )
      `
      )
      .eq("requester_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("보낸 친한친구 신청 목록 조회 실패:", error);
    throw new Error("보낸 친한친구 신청 목록을 불러오는데 실패했습니다.");
  }
}

/**
 * 두 사용자 간의 친한친구 신청 상태 확인
 */
export async function getCloseFriendRequestStatus(
  currentUserId: string,
  targetUserId: string
): Promise<{
  status: "none" | "pending" | "accepted" | "rejected";
  direction?: "sent" | "received";
  requestId?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("close_friend_requests")
      .select("id, status, requester_id, target_id")
      .or(
        `and(requester_id.eq.${currentUserId},target_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},target_id.eq.${currentUserId})`
      )
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      return { status: "none" };
    }

    const request = data[0];
    const direction =
      request.requester_id === currentUserId ? "sent" : "received";

    return {
      status: request.status as "pending" | "accepted" | "rejected",
      direction,
      requestId: request.id,
    };
  } catch (error) {
    console.error("친한친구 신청 상태 확인 실패:", error);
    return { status: "none" };
  }
}

/**
 * 친구 통계 조회 (클라이언트 계산 방식)
 */
export async function getFriendStats(userId: string) {
  try {
    // 친구 목록을 가져와서 클라이언트에서 통계 계산
    const friendsList = await getFriendsList(userId);

    const stats = {
      total_friends: friendsList.filter((f) => f.status === "accepted").length,
      close_friends: friendsList.filter(
        (f) => f.status === "accepted" && f.is_close_friend
      ).length,
      pending_sent: friendsList.filter(
        (f) => f.status === "pending" && !f.is_received_request
      ).length,
      pending_received: friendsList.filter(
        (f) => f.status === "pending" && f.is_received_request
      ).length,
    };

    return stats;
  } catch (error) {
    console.error("친구 통계 조회 실패:", error);
    return {
      total_friends: 0,
      close_friends: 0,
      pending_sent: 0,
      pending_received: 0,
    };
  }
}

/**
 * 양방향 친한친구 상태 확인 (신청-수락 방식)
 */
export async function areCloseFriends(
  userId: string,
  friendId: string
): Promise<boolean> {
  try {
    console.log(`🔍 areCloseFriends API 호출:`, { userId, friendId });

    const { data, error } = await supabase.rpc("are_close_friends", {
      user1_id: userId,
      user2_id: friendId,
    });

    console.log(`📊 areCloseFriends API 응답:`, { data, error });

    if (error) {
      console.error("친한친구 상태 확인 실패:", error);
      return false;
    }

    const result = data || false;
    console.log(`✅ areCloseFriends 결과 [${userId} ↔ ${friendId}]:`, result);
    return result;
  } catch (error) {
    console.error("친한친구 상태 확인 실패:", error);
    return false;
  }
}

/**
 * 친구 관계 완전 삭제
 */
export async function deleteFriend(
  currentUserId: string,
  friendId: string
): Promise<void> {
  try {
    // 1. 양방향 친구 관계 삭제
    const { error: friendshipError } = await supabase
      .from("friendships")
      .delete()
      .or(
        `and(user_id.eq.${currentUserId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${currentUserId})`
      );

    if (friendshipError) throw friendshipError;

    // 2. 관련 친한친구 신청도 모두 삭제
    const { error: requestError } = await supabase
      .from("close_friend_requests")
      .delete()
      .or(
        `and(requester_id.eq.${currentUserId},target_id.eq.${friendId}),and(requester_id.eq.${friendId},target_id.eq.${currentUserId})`
      );

    if (requestError) throw requestError;
  } catch (error) {
    console.error("친구 삭제 실패:", error);
    throw new Error("친구 삭제에 실패했습니다.");
  }
}

/**
 * 친한친구 관계만 해제 (일반 친구로 변경)
 */
export async function removeCloseFriend(
  currentUserId: string,
  friendId: string
): Promise<void> {
  try {
    const { data, error } = await supabase.rpc("remove_close_friendship", {
      user1_id: currentUserId,
      user2_id: friendId,
    });

    if (error) throw error;
  } catch (error) {
    console.error("친한친구 해제 실패:", error);
    throw new Error("친한친구 해제에 실패했습니다.");
  }
}

/**
 * 친구 관계 상태 확인 (RPC 함수 활용)
 */
export async function checkFriendshipStatus(
  userId: string,
  friendId: string
): Promise<any> {
  try {
    console.log(`🔍 친구 관계 상태 확인: ${userId} ↔ ${friendId}`);

    const { data, error } = await supabase.rpc("check_friendship_status", {
      user1_id: userId,
      user2_id: friendId,
    });

    if (error) {
      console.error("친구 관계 확인 실패:", error);
      return null;
    }

    console.log(`📊 친구 관계 상태:`, data);
    return data;
  } catch (error) {
    console.error("친구 관계 확인 실패:", error);
    return null;
  }
}

/**
 * 디버깅용: 친한친구 상태 완전 분석
 */
export async function debugCloseFriendStatus(
  userId: string,
  friendId: string
): Promise<{
  areCloseFriendsResult: boolean;
  friendshipsTable: any[];
  closeFriendRequestsTable: any[];
  summary: string;
}> {
  try {
    console.log(`🔍 친한친구 상태 완전 분석 시작: ${userId} ↔ ${friendId}`);

    // 1. are_close_friends RPC 함수 결과
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "are_close_friends",
      {
        user1_id: userId,
        user2_id: friendId,
      }
    );

    // 2. friendships 테이블 직접 조회
    const { data: friendshipsData, error: friendshipsError } = await supabase
      .from("friendships")
      .select("*")
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`
      );

    // 3. close_friend_requests 테이블 직접 조회
    const { data: requestsData, error: requestsError } = await supabase
      .from("close_friend_requests")
      .select("*")
      .or(
        `and(requester_id.eq.${userId},target_id.eq.${friendId}),and(requester_id.eq.${friendId},target_id.eq.${userId})`
      );

    console.log(`📊 RPC 결과:`, { rpcResult, rpcError });
    console.log(`📊 Friendships 테이블:`, {
      friendshipsData,
      friendshipsError,
    });
    console.log(`📊 Close Friend Requests 테이블:`, {
      requestsData,
      requestsError,
    });

    // 분석 결과 요약
    let summary = "";
    const friendships = friendshipsData || [];
    const requests = requestsData || [];

    if (friendships.length === 0) {
      summary = "❌ 친구 관계가 존재하지 않음";
    } else if (friendships.length === 1) {
      summary = "⚠️ 일방향 친구 관계만 존재";
    } else if (friendships.length === 2) {
      const bothCloseFriend = friendships.every(
        (f) => f.is_close_friend === true
      );
      if (bothCloseFriend) {
        summary = "💖 양방향 친한친구 관계 확인됨";
      } else {
        summary = "💙 양방향 일반친구 관계";
      }
    }

    const pendingRequests = requests.filter((r) => r.status === "pending");
    if (pendingRequests.length > 0) {
      summary += ` (대기 중인 친한친구 신청 ${pendingRequests.length}개)`;
    }

    console.log(`📋 분석 요약: ${summary}`);

    return {
      areCloseFriendsResult: rpcResult || false,
      friendshipsTable: friendships,
      closeFriendRequestsTable: requests,
      summary,
    };
  } catch (error) {
    console.error("친한친구 상태 분석 실패:", error);
    return {
      areCloseFriendsResult: false,
      friendshipsTable: [],
      closeFriendRequestsTable: [],
      summary: "❌ 분석 실패",
    };
  }
}
