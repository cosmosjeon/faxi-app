"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Search, Users, Heart, Settings } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/stores/auth.store";
import {
  getFriendsList,
  updateCloseFriend,
  acceptFriendRequest,
  rejectFriendRequest,
} from "@/features/friends/api";
import type { FriendWithProfile } from "@/features/friends/types";
import { toast } from "@/hooks/use-toast";

export default function FriendsPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingFriendIds, setUpdatingFriendIds] = useState<Set<string>>(
    new Set()
  );

  // 친구 목록 로드
  const loadFriends = async () => {
    if (!profile) return;

    setIsLoading(true);
    try {
      const friendsList = await getFriendsList(profile.id);
      setFriends(friendsList);
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

  // 친한 친구 토글
  const handleCloseFriendToggle = async (
    friendshipId: string,
    isCloseFriend: boolean
  ) => {
    setUpdatingFriendIds((prev) => new Set(prev).add(friendshipId));

    try {
      await updateCloseFriend({
        friendship_id: friendshipId,
        is_close_friend: isCloseFriend,
      });

      // 로컬 상태 업데이트
      setFriends((prev) =>
        prev.map((friend) =>
          friend.id === friendshipId
            ? { ...friend, is_close_friend: isCloseFriend }
            : friend
        )
      );

      toast({
        title: "설정 변경됨",
        description: isCloseFriend
          ? "친한 친구로 설정되었습니다. 메시지가 자동으로 프린트됩니다."
          : "일반 친구로 설정되었습니다.",
      });
    } catch (error) {
      console.error("친한 친구 설정 실패:", error);
      toast({
        title: "설정 실패",
        description: "친한 친구 설정을 변경하는데 실패했습니다.",
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

  // 친구 요청 수락
  const handleAcceptRequest = async (friendshipId: string) => {
    setUpdatingFriendIds((prev) => new Set(prev).add(friendshipId));

    try {
      await acceptFriendRequest(friendshipId);

      // 친구 목록 다시 로드
      await loadFriends();

      toast({
        title: "친구 요청 수락",
        description: "친구 요청을 수락했습니다.",
      });
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

      // 친구 목록 다시 로드
      await loadFriends();

      toast({
        title: "친구 요청 거절",
        description: "친구 요청을 거절했습니다.",
      });
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

  // 상태별 카운트
  const acceptedCount = friends.filter((f) => f.status === "accepted").length;
  const receivedRequestsCount = friends.filter(
    (f) => f.status === "pending" && f.is_received_request
  ).length;
  const sentRequestsCount = friends.filter(
    (f) => f.status === "pending" && !f.is_received_request
  ).length;
  const closeFriendsCount = friends.filter(
    (f) => f.is_close_friend && f.status === "accepted"
  ).length;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* 헤더 */}
        <div className="bg-white rounded-lg p-4 shadow-sm flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">친구 목록</h1>
            <p className="text-gray-600 mt-1">
              총 {acceptedCount}명 · 친한 친구 {closeFriendsCount}명
              {receivedRequestsCount > 0 &&
                ` · 받은 요청 ${receivedRequestsCount}개`}
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
        {isLoading && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600">친구 목록을 불러오는 중...</p>
            </CardContent>
          </Card>
        )}

        {/* 친구 목록 */}
        {!isLoading &&
          (acceptedFriends.length > 0 ||
            receivedRequests.length > 0 ||
            sentRequests.length > 0) && (
            <div className="space-y-4">
              {/* 수락된 친구들 */}
              {acceptedFriends.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users size={20} />내 친구들
                      {searchQuery && (
                        <Badge variant="secondary">
                          {acceptedFriends.length}명 검색됨
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      친한 친구로 설정하면 메시지가 자동으로 프린트됩니다
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {acceptedFriends.map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors"
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
                            <h3 className="font-semibold text-gray-900 truncate">
                              {friend.friend_profile.display_name}
                            </h3>
                            {friend.is_mutual && (
                              <Badge variant="outline" className="text-xs">
                                맞팔
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            @{friend.friend_profile.username}
                          </p>
                        </div>

                        {/* 친한 친구 토글 */}
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                              <Heart size={12} />
                              친한 친구
                            </div>
                            <Switch
                              checked={friend.is_close_friend}
                              onCheckedChange={(checked) =>
                                handleCloseFriendToggle(friend.id, checked)
                              }
                              disabled={updatingFriendIds.has(friend.id)}
                              className="scale-75"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
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
                        className="flex items-center gap-3 p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors"
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
                            <h3 className="font-semibold text-gray-900 truncate">
                              {friend.friend_profile.display_name}
                            </h3>
                            <Badge variant="secondary" className="text-xs">
                              요청됨
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            @{friend.friend_profile.username}
                          </p>
                        </div>

                        {/* 친구 요청 수락/거절 버튼 */}
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleAcceptRequest(friend.id)}
                            disabled={updatingFriendIds.has(friend.id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            수락
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectRequest(friend.id)}
                            disabled={updatingFriendIds.has(friend.id)}
                            className="text-red-600 border-red-200 hover:bg-red-50"
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
                  "{searchQuery}"와 일치하는 친구가 없습니다
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
