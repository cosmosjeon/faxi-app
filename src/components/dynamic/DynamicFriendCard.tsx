"use client";

import dynamic from "next/dynamic";
import { FriendCardSkeleton } from "@/components/ui/friend-skeleton";
import type { FriendWithProfile } from "@/features/friends/types";

// FriendCard props 타입 정의
interface FriendCardProps {
  friend: FriendWithProfile;
  isUpdating: boolean;
  onCloseFriendToggle: (
    friendshipId: string,
    isCloseFriend: boolean
  ) => Promise<void>;
  onAcceptRequest?: (friendshipId: string) => Promise<void>;
  onRejectRequest?: (friendshipId: string) => Promise<void>;
}

// FriendCard 동적 로딩
const FriendCard = dynamic(
  () =>
    import("@/components/domain/friends/FriendCard").then((mod) => ({
      default: mod.FriendCard,
    })),
  {
    loading: () => <FriendCardSkeleton />,
    ssr: false,
  }
) as React.ComponentType<FriendCardProps>;

export default FriendCard;
