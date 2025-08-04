"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRealtimeStore } from "@/stores/realtimeStore";
import { toast } from "@/hooks/use-toast";

interface UseRealtimeNotificationsProps {
  enabled?: boolean;
  soundEnabled?: boolean;
}

export const useRealtimeNotifications = ({
  enabled = true,
  soundEnabled = false,
}: UseRealtimeNotificationsProps = {}) => {
  const { realtimeEvents } = useRealtimeStore();
  const processedEventIds = useRef<Set<string>>(new Set());

  // 알림 표시 함수
  const showNotification = useCallback(
    (type: string, title: string, description?: string) => {
      if (!enabled) return;

      // 토스트 알림 표시
      toast({
        title,
        description,
        duration: 4000,
      });

      // 사운드 재생 (옵션)
      if (soundEnabled) {
        try {
          const audio = new Audio("/sounds/notification.mp3");
          audio.volume = 0.5;
          audio.play().catch(console.warn);
        } catch (error) {
          console.warn("Failed to play notification sound:", error);
        }
      }

      console.log(`🔔 Notification shown: ${title}`);
    },
    [enabled, soundEnabled]
  );

  // 사용자 이름 가져오기 (실제 구현에서는 사용자 데이터에서 가져옴)
  const getUserName = useCallback((userId: string) => {
    // TODO: 실제 사용자 데이터에서 이름 가져오기
    return "친구"; // 임시로 '친구'로 표시
  }, []);

  // 이벤트 처리
  const processRealtimeEvent = useCallback(
    (event: any) => {
      const { type, data } = event;

      switch (type) {
        case "new_message":
          const senderName = getUserName(data.new.sender_id);
          const messagePreview = data.new.content
            ? data.new.content.substring(0, 30) +
              (data.new.content.length > 30 ? "..." : "")
            : "사진 메시지";

          showNotification(
            "new_message",
            `📨 새 메시지`,
            `${senderName}님이 메시지를 보냈습니다: ${messagePreview}`
          );
          break;

        case "friend_request":
          const requesterName = getUserName(data.new.user_id);
          showNotification(
            "friend_request",
            `👥 새 친구 요청`,
            `${requesterName}님이 친구 요청을 보냈습니다`
          );
          break;

        case "friend_accepted":
          const accepterName = getUserName(data.new.friend_id);
          showNotification(
            "friend_accepted",
            `✅ 친구 요청 수락`,
            `${accepterName}님이 친구 요청을 수락했습니다`
          );
          break;

        case "close_friend_request":
          const closeFriendRequesterName = getUserName(data.new.requester_id);
          showNotification(
            "close_friend_request",
            `💖 친한친구 요청`,
            `${closeFriendRequesterName}님이 친한친구 요청을 보냈습니다`
          );
          break;

        case "close_friend_accepted":
          const closeFriendAccepterName = getUserName(data.new.target_id);
          showNotification(
            "close_friend_accepted",
            `💖 친한친구 수락`,
            `${closeFriendAccepterName}님이 친한친구 요청을 수락했습니다`
          );
          break;

        case "message_status_update":
          if (data.new.print_status === "completed") {
            showNotification(
              "message_printed",
              `📄 메시지 프린트 완료`,
              `메시지가 성공적으로 프린트되었습니다`
            );
          } else if (data.new.print_status === "failed") {
            showNotification(
              "message_print_failed",
              `❌ 프린트 실패`,
              `메시지 프린트에 실패했습니다`
            );
          }
          break;

        default:
          console.log("Unknown realtime event type:", type);
      }
    },
    [showNotification, getUserName]
  );

  // 새 이벤트 감지 및 처리
  useEffect(() => {
    if (!enabled || !realtimeEvents) return;

    // 아직 처리되지 않은 새 이벤트들 찾기
    const newEvents = realtimeEvents.filter(
      (event) => !processedEventIds.current.has(event.id) && !event.read
    );

    if (newEvents.length === 0) return;

    // 새 이벤트들 처리
    newEvents.forEach((event) => {
      processRealtimeEvent(event);
      processedEventIds.current.add(event.id);
    });

    // 메모리 관리: 너무 많은 ID가 쌓이지 않도록 주기적 정리
    if (processedEventIds.current.size > 1000) {
      const recentEventIds = new Set(
        realtimeEvents.slice(0, 500).map((event) => event.id)
      );
      processedEventIds.current = recentEventIds;
    }
  }, [realtimeEvents, enabled, processRealtimeEvent]);

  // 수동 알림 표시 (필요시 사용)
  const showCustomNotification = useCallback(
    (title: string, description?: string) => {
      showNotification("custom", title, description);
    },
    [showNotification]
  );

  return {
    showCustomNotification,
    isEnabled: enabled,
  };
};
