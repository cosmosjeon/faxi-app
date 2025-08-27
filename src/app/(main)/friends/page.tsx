"use client";

import { useState, useEffect } from "react";
import {
  UserPlus,
  Search,
  Heart,
  Clock,
  Mail,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth.store";
import {
  getFriendsList,
  acceptFriendRequest,
  rejectFriendRequest,
  sendCloseFriendRequest,
  acceptCloseFriendRequest,
  rejectCloseFriendRequest,
  removeCloseFriend,
  deleteFriend,
  areCloseFriends,
  getReceivedCloseFriendRequests,
  getSentCloseFriendRequests,
  cancelCloseFriendRequest,
  debugCloseFriendStatus,
  checkFriendshipStatus,
} from "@/features/friends/api";
import type { FriendWithProfile } from "@/features/friends/types";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import { useRealtimeDataSync } from "@/hooks/useRealtimeDataSync";
import { FriendListSkeleton } from "@/components/ui/friend-skeleton";
 

export default function FriendsPage() {
  const { profile } = useAuthStore();
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [closeFriendRequests, setCloseFriendRequests] = useState<any[]>([]);
  const [sentCloseFriendRequests, setSentCloseFriendRequests] = useState<any[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingFriendIds, setUpdatingFriendIds] = useState<Set<string>>(
    new Set()
  );
  const [friendsCloseFriendStatus, setFriendsCloseFriendStatus] = useState<
    Record<string, boolean>
  >({});
  

  // 친한친구 상태 구분 헬퍼 함수
  const getCloseFriendStatus = (friendId: string) => {
    // 이미 서로 친한친구인지 확인
    const isCloseFriend = friendsCloseFriendStatus[friendId];

    // 내가 보낸 친한친구 신청이 있는지 확인
    const sentRequest = sentCloseFriendRequests.find(
      (req) => req.target_profile?.id === friendId
    );

    // 받은 친한친구 신청이 있는지 확인
    // ⚠️ 중복 방지: "받은 친한친구 신청들" 섹션에서 이미 표시된 경우 제외
    const receivedRequest = closeFriendRequests.find(
      (req) => req.requester_profile?.id === friendId
    );

    if (process.env.NODE_ENV !== 'production') console.log(`🔍 친구 상태 확인 [${friendId}]:`, {
      isCloseFriend,
      hasSentRequest: !!sentRequest,
      hasReceivedRequest: !!receivedRequest,
      friendsCloseFriendStatus: friendsCloseFriendStatus[friendId],
      note: receivedRequest
        ? "⚠️ 받은 신청이 있지만 별도 섹션에서 처리됨"
        : "정상",
    });

    if (isCloseFriend) {
      if (process.env.NODE_ENV !== 'production') console.log(`💖 [${friendId}] = 친한친구`);
      return "close_friend"; // 💖 친한친구
    }

    if (sentRequest) {
      if (process.env.NODE_ENV !== 'production') console.log(`📤 [${friendId}] = 신청함`);
      return "sent_request"; // 📤 신청함
    }

    // ✅ 받은 친한친구 신청은 "받은 친한친구 신청들" 섹션에서만 표시
    // "내 친구들" 섹션에서는 일반친구로 처리하여 중복 방지
    if (receivedRequest) {
      if (process.env.NODE_ENV !== 'production') console.log(
        `📥 [${friendId}] = 신청받음 (별도 섹션에서 처리, 여기서는 일반친구로 표시)`
      );
      return "regular_friend"; // 💙 일반친구 (중복 방지)
    }

    if (process.env.NODE_ENV !== 'production') console.log(`💙 [${friendId}] = 일반친구`);
    return "regular_friend"; // 💙 일반친구
  };

  // 친구 목록 및 친한친구 상태 로드
  const loadFriends = async () => {
    if (!profile) return;

    setIsLoading(true);
    try {
      // 병렬로 데이터 로드
      const [friendsList, receivedRequests, sentRequests] = await Promise.all([
        getFriendsList(profile.id),
        getReceivedCloseFriendRequests(profile.id),
        getSentCloseFriendRequests(profile.id),
      ]);

      setFriends(friendsList);
      setCloseFriendRequests(receivedRequests);
      setSentCloseFriendRequests(sentRequests);

      // 각 친구의 친한친구 상태 확인
      const closeFriendStatusMap: Record<string, boolean> = {};
      const acceptedFriends = friendsList.filter(
        (f) => f.status === "accepted"
      );

      if (process.env.NODE_ENV !== 'production') {
        console.log(
          "🔍 친한친구 상태 확인 시작, 친구 수:",
          acceptedFriends.length
        );
      }

      for (const friend of acceptedFriends) {
        const isCloseFriend = await areCloseFriends(
          profile.id,
          friend.friend_id
        );
        closeFriendStatusMap[friend.friend_id] = isCloseFriend;
        if (process.env.NODE_ENV !== 'production') {
          console.log(
            `👥 ${friend.friend_profile.display_name}: ${
              isCloseFriend ? "💖 친한친구" : "💙 일반친구"
            }`
          );
        }

        // 디버깅: 친한친구가 아닌데 왜 그런지 상세 분석 (개발 환경에서만)
        if (!isCloseFriend && process.env.NODE_ENV === "development") {
          console.log(
            `🔍 ${friend.friend_profile.display_name} 상세 분석 시작...`
          );
          await debugCloseFriendStatus(profile.id, friend.friend_id);
        }
      }

      setFriendsCloseFriendStatus(closeFriendStatusMap);
      if (process.env.NODE_ENV !== 'production') console.log("✅ 친한친구 상태 맵 업데이트 완료:", closeFriendStatusMap);
    } catch (error) {
      console.error("친구 목록 로드 실패:", error);
      toast({
        title: "로드 실패",
        description: "친구 목록을 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFriends();
  }, [profile]);

  // 실시간 친구 상태 업데이트 구독
  useEffect(() => {
    if (!profile) return;

    if (process.env.NODE_ENV !== 'production') console.log("🔄 친구 상태 실시간 구독 시작");

    // friendships 테이블 변경 사항 구독
    const friendshipsSubscription = supabase
      .channel("friendships_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `friend_id=eq.${profile.id}`, // 내가 받은 요청들
        },
        (payload) => {
          if (process.env.NODE_ENV !== 'production') console.log("📢 친구 요청 상태 변경:", payload);
          // 친구 목록 다시 로드
          loadFriends();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `user_id=eq.${profile.id}`, // 내가 보낸 요청들
        },
        (payload) => {
          if (process.env.NODE_ENV !== 'production') console.log("📢 내 친구 요청 상태 변경:", payload);
          // 친구 목록 다시 로드
          loadFriends();
        }
      )
      .subscribe();

    return () => {
      if (process.env.NODE_ENV !== 'production') console.log("🔄 친구 상태 실시간 구독 해제");
      friendshipsSubscription.unsubscribe();
    };
  }, [profile]);

  // 친한친구 신청 보내기 (방어적 프로그래밍)
  const handleSendCloseFriendRequest = async (friendId: string) => {
    if (!profile) return;

    // 중복 클릭 방지
    if (updatingFriendIds.has(friendId)) {
      if (process.env.NODE_ENV !== 'production') console.log("⚠️ 이미 처리 중인 요청입니다.");
      return;
    }

    setUpdatingFriendIds((prev) => new Set(prev).add(friendId));

    try {
      if (process.env.NODE_ENV !== 'production') console.log(`🔄 친한친구 신청 시작: ${profile.id} → ${friendId}`);

      // 신청 전 마지막 상태 확인
      const preCheckResult = await debugCloseFriendStatus(profile.id, friendId);
      if (process.env.NODE_ENV !== 'production') console.log("📋 신청 전 상태:", preCheckResult.summary);

      if (preCheckResult.areCloseFriendsResult) {
        toast({
          title: "이미 친한친구",
          description: "이미 친한친구입니다! 새로고침 중...",
          variant: "default",
        });
        await loadFriends();
        return;
      }

      await sendCloseFriendRequest(friendId, profile.id);

      toast({
        title: "친한친구 신청",
        description: "친한친구 신청을 보냈습니다.",
      });

      await loadFriends(); // 상태 갱신
    } catch (error) {
      console.error("친한친구 신청 실패:", error);

      // 에러 메시지 개선
      const errorMessage =
        error instanceof Error
          ? error.message
          : "친한친구 신청에 실패했습니다.";

      toast({
        title: "신청 실패",
        description: errorMessage,
        variant: "destructive",
      });

      // 에러 발생 시에도 상태 새로고침 (동기화 보장)
      await loadFriends();
    } finally {
      setUpdatingFriendIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(friendId);
        return newSet;
      });
    }
  };

  // 친한친구 신청 수락
  const handleAcceptCloseFriendRequest = async (requestId: string) => {
    try {
      if (process.env.NODE_ENV !== 'production') console.log("🔄 친한친구 신청 수락 시작:", requestId);

      // 1. 먼저 해당 요청의 정보 찾기
      const request = closeFriendRequests.find((req) => req.id === requestId);
      if (!request) {
        console.error("❌ 해당 요청을 찾을 수 없음:", requestId);
        return;
      }

      const friendId = request.requester_profile?.id;
      if (process.env.NODE_ENV !== 'production') console.log("👤 친한친구가 될 사용자:", friendId);

      // 2. 친구 관계 상태 미리 확인
      if (profile && friendId) {
        if (process.env.NODE_ENV !== 'production') console.log("🔍 친구 관계 상태 미리 확인...");
        const friendshipStatus = await checkFriendshipStatus(
          profile.id,
          friendId
        );
        if (process.env.NODE_ENV !== 'production') console.log("📊 친구 관계 확인 결과:", friendshipStatus);
      }

      // 3. API 호출
      await acceptCloseFriendRequest(requestId);

      // 3. 즉시 로컬 상태 업데이트 (UI 반응성 향상)
      if (friendId) {
        setFriendsCloseFriendStatus((prev) => ({
          ...prev,
          [friendId]: true,
        }));
        if (process.env.NODE_ENV !== 'production') console.log("✅ 로컬 친한친구 상태 업데이트됨:", friendId);
      }

      // 4. 1초 대기 후 전체 데이터 새로고침 (DB 동기화 시간 확보)
      if (process.env.NODE_ENV !== 'production') console.log("⏳ 1초 대기 후 데이터 새로고침...");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await loadFriends();

      // 5. 수락 후 상태 재확인 (디버깅)
      if (friendId && profile) {
        if (process.env.NODE_ENV !== 'production') console.log("🔍 수락 후 상태 재확인...");
        const recheckResult = await debugCloseFriendStatus(
          profile.id,
          friendId
        );

        if (!recheckResult.areCloseFriendsResult) {
          console.warn(
            "⚠️ 수락했지만 아직 친한친구로 확인되지 않음. 추가 새로고침 시도..."
          );
          // 추가 대기 후 한 번 더 시도
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await loadFriends();
        }
      }

      toast({
        title: "친한친구 수락",
        description: "친한친구가 되었습니다!",
      });

      if (process.env.NODE_ENV !== 'production') console.log("🎉 친한친구 신청 수락 완료");
    } catch (error) {
      console.error("친한친구 신청 수락 실패:", error);
      toast({
        title: "수락 실패",
        description: "친한친구 신청 수락에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 친한친구 신청 거절
  const handleRejectCloseFriendRequest = async (requestId: string) => {
    try {
      await rejectCloseFriendRequest(requestId);
      toast({
        title: "친한친구 거절",
        description: "친한친구 신청을 거절했습니다.",
      });
      await loadFriends(); // 상태 갱신
    } catch (error) {
      console.error("친한친구 신청 거절 실패:", error);
      toast({
        title: "거절 실패",
        description: "친한친구 신청 거절에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 친한친구 신청 취소
  const handleCancelCloseFriendRequest = async (friendId: string) => {
    if (!profile) return;

    const sentRequest = sentCloseFriendRequests.find(
      (req) => req.target_profile?.id === friendId
    );
    if (!sentRequest) return;

    setUpdatingFriendIds((prev) => new Set(prev).add(friendId));
    try {
      await cancelCloseFriendRequest(sentRequest.id);
      toast({
        title: "신청 취소",
        description: "친한친구 신청을 취소했습니다.",
      });
      await loadFriends(); // 상태 갱신
    } catch (error) {
      console.error("친한친구 신청 취소 실패:", error);
      toast({
        title: "취소 실패",
        description: "친한친구 신청 취소에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setUpdatingFriendIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(friendId);
        return newSet;
      });
    }
  };

  // 친한친구 끊기
  const handleRemoveCloseFriend = async (friendId: string) => {
    if (!profile) return;

    setUpdatingFriendIds((prev) => new Set(prev).add(friendId));
    try {
      await removeCloseFriend(profile.id, friendId);

      // 로컬 상태 업데이트
      setFriendsCloseFriendStatus((prev) => ({
        ...prev,
        [friendId]: false,
      }));

      toast({
        title: "친한친구 해제",
        description: "친한친구가 해제되었습니다.",
      });
    } catch (error) {
      console.error("친한친구 해제 실패:", error);
      toast({
        title: "해제 실패",
        description: "친한친구 해제에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setUpdatingFriendIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(friendId);
        return newSet;
      });
    }
  };

  // 친구 삭제
  const handleDeleteFriend = async (friendId: string) => {
    if (!profile) return;

    setUpdatingFriendIds((prev) => new Set(prev).add(friendId));
    try {
      await deleteFriend(profile.id, friendId);
      toast({
        title: "친구 삭제",
        description: "친구가 삭제되었습니다.",
      });
      await loadFriends(); // 목록 새로고침
    } catch (error) {
      console.error("친구 삭제 실패:", error);
      toast({
        title: "삭제 실패",
        description: "친구 삭제에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setUpdatingFriendIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(friendId);
        return newSet;
      });
    }
  };

  // 친구 요청 수락
  const handleAcceptRequest = async (friendshipId: string) => {
    setUpdatingFriendIds((prev) => new Set(prev).add(friendshipId));

    try {
      await acceptFriendRequest(friendshipId);

      toast({
        title: "친구 요청 수락",
        description: "친구 요청을 수락했습니다.",
      });
      
      await loadFriends(); // 목록 새로고침
    } catch (error) {
      console.error("친구 요청 수락 실패:", error);
      toast({
        title: "수락 실패",
        description: "친구 요청을 수락하는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setUpdatingFriendIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(friendshipId);
        return newSet;
      });
    }
  };

  // 친구 요청 거절
  const handleRejectRequest = async (friendshipId: string) => {
    setUpdatingFriendIds((prev) => new Set(prev).add(friendshipId));

    try {
      await rejectFriendRequest(friendshipId);

      toast({
        title: "친구 요청 거절",
        description: "친구 요청을 거절했습니다.",
      });
      
      await loadFriends(); // 목록 새로고침
    } catch (error) {
      console.error("친구 요청 거절 실패:", error);
      toast({
        title: "거절 실패",
        description: "친구 요청을 거절하는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setUpdatingFriendIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(friendshipId);
        return newSet;
      });
    }
  };

  

  // 노션 스타일 친한친구 카드 컴포넌트
  const CloseFriendCard = ({ friend }: { friend: FriendWithProfile }) => {
    const status = getCloseFriendStatus(friend.friend_id);
    const isUpdating = updatingFriendIds.has(friend.friend_id);
    

    const getStatusConfig = () => {
      switch (status) {
        case "close_friend":
          return {
            borderColor: "border-red-200",
            bgColor: "bg-red-50",
            icon: <Heart size={12} className="text-red-500 fill-current" />,
            statusText: "서로 친한친구예요",
            statusColor: "text-red-600",
          };
        case "sent_request":
          return {
            borderColor: "border-orange-200",
            bgColor: "bg-orange-50",
            icon: <Clock size={12} className="text-orange-500" />,
            statusText: "친한친구 신청 대기중",
            statusColor: "text-orange-600",
          };

        default:
          return {
            borderColor: "border-gray-200",
            bgColor: "bg-white",
            icon: null,
            statusText: null,
            statusColor: "",
          };
      }
    };

    const config = getStatusConfig();

    const renderActionButtons = () => {
      switch (status) {
        case "close_friend":
          return (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRemoveCloseFriend(friend.friend_id)}
                disabled={isUpdating}
                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors duration-200"
              >
                해제
              </button>
              <button
                onClick={() => handleDeleteFriend(friend.friend_id)}
                disabled={isUpdating}
                className="px-2 py-1 text-xs text-red-600 hover:bg-red-100 rounded transition-colors duration-200"
              >
                삭제
              </button>
            </div>
          );
        case "sent_request":
          return (
            <button
              onClick={() => handleCancelCloseFriendRequest(friend.friend_id)}
              disabled={isUpdating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-orange-700 hover:bg-orange-100 rounded-md transition-colors duration-200 whitespace-nowrap"
            >
              <X size={14} />
              신청 취소
            </button>
          );

        default:
          return (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSendCloseFriendRequest(friend.friend_id)}
                disabled={isUpdating}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors duration-200 border whitespace-nowrap ${
                  isUpdating
                    ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "border-gray-200 text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Heart
                  size={14}
                  className={isUpdating ? "text-gray-300" : "text-gray-400"}
                />
                {isUpdating ? "처리 중..." : "친한친구 되기"}
              </button>
              <button
                onClick={() => handleDeleteFriend(friend.friend_id)}
                disabled={isUpdating}
                className={`px-2 py-1 text-xs rounded transition-colors duration-200 ${
                  isUpdating
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-red-600 hover:bg-red-100"
                }`}
              >
                삭제
              </button>
            </div>
          );
      }
    };

    return (
      <div
        className={`flex items-center justify-between p-3 gap-3 rounded-lg border ${config.borderColor} ${config.bgColor} hover:shadow-sm transition-shadow duration-200`}
      >
        <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-12 w-12">
            <AvatarImage
              src={friend.friend_profile?.avatar_url || ""}
              alt={friend.friend_profile?.display_name || ""}
            />
            <AvatarFallback>
              {friend.friend_profile?.display_name?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <h3 className="font-medium text-gray-900 truncate">
              {friend.friend_profile.display_name}
            </h3>
            <p className="text-sm text-gray-600 truncate">@{friend.friend_profile.username}</p>
            {config.statusText && (
              <div className="flex items-center gap-1 mt-1">
                {config.icon}
                <span className={`text-xs ${config.statusColor} whitespace-nowrap`}>
                  {config.statusText}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">{renderActionButtons()}</div>
      </div>
    );
  };

  // 검색 필터링
  const filteredFriends = friends.filter(
    (friend) =>
      friend.friend_profile.display_name
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      friend.friend_profile.username
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  // 상태별로 친구 분류
  const acceptedFriends = filteredFriends.filter(
    (f) => f.status === "accepted"
  );
  const pendingFriends = filteredFriends.filter((f) => f.status === "pending");

  // 받은 요청과 보낸 요청 분리
  const receivedRequests = pendingFriends.filter((f) => f.is_received_request);
  const sentRequests = pendingFriends.filter((f) => !f.is_received_request);

  // 친구 목록에서 직접 통계 계산
  const acceptedCount = friends.filter((f) => f.status === "accepted").length;
  const receivedRequestsCount = friends.filter(
    (f) => f.status === "pending" && f.is_received_request
  ).length;
  const sentRequestsCount = friends.filter(
    (f) => f.status === "pending" && !f.is_received_request
  ).length;
  const closeFriendsCount = Object.values(friendsCloseFriendStatus).filter(
    Boolean
  ).length;
  const closeFriendRequestsCount = closeFriendRequests.length;
  const sentCloseFriendRequestsCount = sentCloseFriendRequests.length;

  // 📡 실시간 데이터 동기화 (백그라운드에서 자동 새로고침)
  useRealtimeDataSync({
    onDataUpdate: loadFriends,
    syncTypes: ["friendships", "close_friends"],
    enabled: !!profile,
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* 헤더 */}
        <div className="bg-white rounded-lg px-4 py-3 shadow-sm flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 leading-tight">친구 목록</h1>
            <p className="text-gray-600 mt-0.5">
              총 {acceptedCount}명 · 친한친구 {closeFriendsCount}명
              {closeFriendRequestsCount > 0 &&
                ` · 친한친구 신청 ${closeFriendRequestsCount}개`}
              {sentCloseFriendRequestsCount > 0 &&
                ` · 친한친구 대기 ${sentCloseFriendRequestsCount}개`}
              {receivedRequestsCount > 0 &&
                ` · 친구 요청 ${receivedRequestsCount}개`}
              {sentRequestsCount > 0 && ` · 보낸 요청 ${sentRequestsCount}개`}
            </p>
          </div>
          <Link href="/friends/add">
            <Button size="sm" className="gap-2">
              <UserPlus size={16} />
              추가
            </Button>
          </Link>
        </div>

        {/* 검색 바 */}
        {friends.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg">
                <Search size={20} className="text-gray-500" />
                <input
                  type="text"
                  placeholder="친구 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent flex-1 outline-none text-gray-700"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* 로딩 상태 */}
        {isLoading && <FriendListSkeleton />}

        {/* 친구 목록 */}
        {!isLoading &&
          (acceptedFriends.length > 0 ||
            receivedRequests.length > 0 ||
            sentRequests.length > 0) && (
            <div className="space-y-4">
              {/* 받은 친한친구 신청들 - 노션 스타일 (우선순위 최고) */}
              {closeFriendRequests.length > 0 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      친한친구 신청
                    </h3>
                    <p className="text-sm text-gray-600">
                      새로운 친한친구 신청이 있어요 (
                      {closeFriendRequests.length}개)
                    </p>
                    <div className="h-px bg-gray-200 mt-3"></div>
                  </div>

                  <div className="space-y-3">
                    {closeFriendRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-blue-200 bg-blue-50 hover:shadow-sm transition-shadow duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage
                              src={request.requester_profile?.avatar_url || ""}
                              alt={
                                request.requester_profile?.display_name || ""
                              }
                            />
                            <AvatarFallback>
                              {request.requester_profile?.display_name?.[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          <div>
                            <h3 className="font-medium text-gray-900">
                              {request.requester_profile?.display_name}
                            </h3>
                            <p className="text-sm text-gray-600">
                              @{request.requester_profile?.username}
                            </p>
                            <div className="flex items-center gap-1 mt-1">
                              <Mail size={12} className="text-blue-500" />
                              <span className="text-xs text-blue-600">
                                친한친구 신청을 보냈어요
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              handleAcceptCloseFriendRequest(request.id)
                            }
                            className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
                          >
                            수락
                          </button>
                          <button
                            onClick={() =>
                              handleRejectCloseFriendRequest(request.id)
                            }
                            className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                          >
                            거절
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 내 친구들 - 노션 스타일 */}
              {acceptedFriends.length > 0 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      내 친구들
                    </h3>
                    <p className="text-sm text-gray-600">
                      {searchQuery
                        ? `${acceptedFriends.length}명 검색됨`
                        : `총 ${acceptedCount}명 · 친한친구 ${closeFriendsCount}명`}
                    </p>
                    <div className="h-px bg-gray-200 mt-3"></div>
                  </div>

                  <div className="space-y-3">
                    {acceptedFriends.map((friend) => (
                      <CloseFriendCard key={friend.id} friend={friend} />
                    ))}
                  </div>
                </div>
              )}

              {/* 받은 친구 요청들 */}
              {receivedRequests.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus size={20} />
                      받은 친구 요청
                      <Badge variant="secondary">
                        {receivedRequests.length}개
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      친구 요청을 수락하거나 거절할 수 있습니다
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {receivedRequests.map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-blue-200 bg-blue-50 hover:shadow-sm transition-shadow duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage
                              src={friend.friend_profile?.avatar_url || ""}
                              alt={friend.friend_profile?.display_name || ""}
                            />
                            <AvatarFallback>
                              {friend.friend_profile?.display_name?.[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          <div>
                            <h3 className="font-medium text-gray-900">
                              {friend.friend_profile.display_name}
                            </h3>
                            <p className="text-sm text-gray-600">
                              @{friend.friend_profile.username}
                            </p>
                            <div className="flex items-center gap-1 mt-1">
                              <UserPlus size={12} className="text-blue-500" />
                              <span className="text-xs text-blue-600">
                                친구 요청을 보냈어요
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleAcceptRequest(friend.id)}
                            disabled={updatingFriendIds.has(friend.id)}
                            className="bg-gray-900 text-white hover:bg-gray-800"
                          >
                            수락
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRejectRequest(friend.id)}
                            disabled={updatingFriendIds.has(friend.id)}
                            className="text-gray-700 hover:bg-gray-100"
                          >
                            거절
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* 보낸 친구 요청들 */}
              {sentRequests.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus size={20} />
                      보낸 친구 요청
                      <Badge variant="outline">
                        {sentRequests.length}개 대기중
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      상대방의 응답을 기다리고 있습니다
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {sentRequests.map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-gray-50 transition-colors"
                      >
                        <Avatar className="h-12 w-12">
                          <AvatarImage
                            src={friend.friend_profile.avatar_url || ""}
                            alt={friend.friend_profile.display_name}
                          />
                          <AvatarFallback>
                            {friend.friend_profile.display_name[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-700 truncate">
                              {friend.friend_profile.display_name}
                            </h3>
                            <Badge variant="outline" className="text-xs">
                              대기중
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500">
                            @{friend.friend_profile.username}
                          </p>
                        </div>

                        {/* 취소 버튼 (선택사항) */}
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRejectRequest(friend.id)}
                            disabled={updatingFriendIds.has(friend.id)}
                            className="text-gray-500 hover:text-red-600"
                          >
                            취소
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

        {/* 검색 결과 없음 */}
        {!isLoading &&
          searchQuery &&
          filteredFriends.length === 0 &&
          friends.length > 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-4xl mb-4">🔍</div>
                <p className="text-gray-600 mb-2">검색 결과가 없습니다</p>
                <p className="text-sm text-gray-500">
                  &quot;{searchQuery}&quot;와 일치하는 친구가 없습니다
                </p>
              </CardContent>
            </Card>
          )}

        {/* 친구 없음 */}
        {!isLoading && friends.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>내 친구들</CardTitle>
              <CardDescription>총 0명의 친구가 있습니다</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-4">👥</div>
                <p>아직 친구가 없습니다</p>
                <p className="text-sm mt-2">ID 검색으로 친구를 추가해보세요!</p>
                <Link href="/friends/add">
                  <Button className="mt-4 gap-2">
                    <UserPlus size={16} />첫 번째 친구 추가하기
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
