"use client";

import React, { useMemo } from "react";
import { UserCheck, UserPlus, Heart, Clock, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type { FriendWithProfile } from "@/features/friends/types";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

interface FriendCardProps {
  friend: FriendWithProfile;
  isUpdating: boolean;
  onCloseFriendToggle: (friendshipId: string, isCloseFriend: boolean) => void;
  onAcceptRequest?: (friendshipId: string) => void;
  onRejectRequest?: (friendshipId: string) => void;
}

/**
 * 최적화된 친구 카드 컴포넌트
 */
export const FriendCard = React.memo(function FriendCard({
  friend,
  isUpdating,
  onCloseFriendToggle,
  onAcceptRequest,
  onRejectRequest,
}: FriendCardProps) {
  const { t } = useTranslation();
  // 친구 이름 메모이제이션
  const friendName = useMemo(() => {
    return (
      friend.friend_profile?.display_name ||
      friend.friend_profile?.username ||
      t("profile.unknown_user")
    );
  }, [friend.friend_profile]);

  // 아바타 이미지 URL 메모이제이션
  const avatarUrl = useMemo(() => {
    return friend.friend_profile?.avatar_url || "";
  }, [friend.friend_profile?.avatar_url]);

  // 상태 배지 메모이제이션
  const statusBadge = useMemo(() => {
    switch (friend.status) {
      case "accepted":
        return (
          <Badge
            variant="default"
            className="text-xs bg-green-100 text-green-800"
          >
            <UserCheck size={12} className="mr-1" />
            {t("friends.mutual")}
          </Badge>
        );
      case "pending":
        return (
          <Badge
            variant="secondary"
            className="text-xs bg-yellow-100 text-yellow-800"
          >
            <Clock size={12} className="mr-1" />
            {t("friends.pendingCount", { count: 1 }).replace(/\D/g, "") ? t("friends.pendingCount", { count: 1 }) : t("common.pending")}
          </Badge>
        );
      default:
        return null;
    }
  }, [friend.status]);

  // 친한 친구 토글 핸들러
  const handleCloseFriendToggle = (checked: boolean) => {
    onCloseFriendToggle(friend.id, checked);
  };

  return (
    <Card className="w-full transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          {/* 왼쪽: 프로필 정보 */}
          <div className="flex items-center space-x-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={avatarUrl} alt={friendName} />
              <AvatarFallback className="bg-blue-100 text-blue-600">
                {friendName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-medium text-gray-900">{friendName}</h3>
                {friend.is_close_friend && (
                  <Badge
                    variant="secondary"
                    className="text-xs bg-pink-100 text-pink-800"
                  >
                    <Heart size={12} className="mr-1" />
                    {t("friends.closeFriendBadge")}
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-2 mt-1">
                {statusBadge}
                <span className="text-sm text-gray-500">
                  @{friend.friend_profile?.username}
                </span>
              </div>
            </div>
          </div>

          {/* 오른쪽: 액션 */}
          <div className="flex items-center space-x-2">
            {friend.status === "accepted" && (
              <>
                {/* 친한 친구 토글 */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">{t("friends.closeFriendBadge")}</span>
                  <Switch
                    checked={friend.is_close_friend}
                    onCheckedChange={handleCloseFriendToggle}
                    disabled={isUpdating}
                    className="data-[state=checked]:bg-pink-500"
                  />
                </div>
              </>
            )}

            {friend.status === "pending" && friend.is_received_request && (
              <>
                {/* 친구 요청 수락/거절 버튼 */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRejectRequest?.(friend.id)}
                  disabled={isUpdating}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X size={16} />
                </Button>
                <Button
                  size="sm"
                  onClick={() => onAcceptRequest?.(friend.id)}
                  disabled={isUpdating}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Check size={16} />
                </Button>
              </>
            )}

            {friend.status === "pending" && !friend.is_received_request && (
              <Badge variant="outline" className="text-xs">
                {t("friends.sentRequests")}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

FriendCard.displayName = "FriendCard";
