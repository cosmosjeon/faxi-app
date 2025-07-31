"use client";

import dynamic from "next/dynamic";
import { MessageCardSkeleton } from "@/components/ui/message-skeleton";
import type { MessageWithProfiles } from "@/features/messages/types";

// MessageCard props 타입 정의
interface MessageCardProps {
  message: MessageWithProfiles;
  isProcessing: boolean;
  onAccept: (messageId: string) => void;
  onReject: (messageId: string) => void;
}

// MessageCard 동적 로딩
const MessageCard = dynamic(
  () =>
    import("@/components/domain/messages/MessageCard").then((mod) => ({
      default: mod.MessageCard,
    })),
  {
    loading: () => <MessageCardSkeleton />,
    ssr: false,
  }
) as React.ComponentType<MessageCardProps>;

export default MessageCard;
