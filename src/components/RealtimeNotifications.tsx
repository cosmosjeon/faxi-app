"use client";

import { useEffect, useRef } from "react";
import { useRealtimeStore } from "@/stores/realtimeStore";
import { useAuthStore } from "@/stores/auth.store";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";

/**
 * 백그라운드에서 실시간 알림을 처리하는 컴포넌트
 * UI가 없으며, 실시간 이벤트를 감지하여 토스트 알림만 표시
 */
export const RealtimeNotifications = () => {
  const { user } = useAuthStore();
  const { realtimeEvents } = useRealtimeStore();
  const processedEventIds = useRef<Set<string>>(new Set());
  const userCache = useRef<Map<string, string>>(new Map());

  // 사용자 이름을 가져오는 함수 (캐싱 포함)
  const getUserName = async (userId: string): Promise<string> => {
    // 캐시에서 먼저 확인
    if (userCache.current.has(userId)) {
      return userCache.current.get(userId)!;
    }

    try {
      // Supabase에서 직접 사용자 프로필 조회
      const { data: profile, error } = await supabase
        .from("users")
        .select("display_name, username")
        .eq("id", userId)
        .single();

      if (error) throw error;

      const name = profile?.display_name || profile?.username || "사용자";
      userCache.current.set(userId, name);
      return name;
    } catch (error) {
      console.warn("Failed to get user profile:", error);
      return "사용자";
    }
  };

  // 알림 표시 함수
  const showNotification = (
    title: string,
    description?: string,
    duration = 4000
  ) => {
    toast({
      title,
      description,
      duration,
    });
  };

  // 실시간 이벤트 처리
  useEffect(() => {
    if (!user?.id || !realtimeEvents || realtimeEvents.length === 0) {
      return;
    }

    // 아직 처리되지 않은 새 이벤트들 찾기
    const newEvents = realtimeEvents.filter(
      (event) =>
        !processedEventIds.current.has(event.id) &&
        !event.read &&
        // 최근 30초 이내의 이벤트만 처리 (페이지 새로고침 등으로 인한 과거 이벤트 제외)
        new Date().getTime() - new Date(event.timestamp).getTime() < 30000
    );

    if (newEvents.length === 0) return;

    // 새 이벤트들을 순차적으로 처리
    newEvents.forEach(async (event) => {
      processedEventIds.current.add(event.id);

      try {
        switch (event.type) {
          case "new_message": {
            const senderName = await getUserName(event.data.new.sender_id);
            const messagePreview = event.data.new.content
              ? event.data.new.content.substring(0, 30) +
                (event.data.new.content.length > 30 ? "..." : "")
              : "사진 메시지";

            showNotification(
              `📨 새 메시지`,
              `${senderName}님이 메시지를 보냈습니다: ${messagePreview}`
            );
            break;
          }

          case "friend_request": {
            const requesterName = await getUserName(event.data.new.user_id);
            showNotification(
              `👥 새 친구 요청`,
              `${requesterName}님이 친구 요청을 보냈습니다`
            );
            break;
          }

          case "friend_accepted": {
            // 현재 MVP에서는 친구 요청 수락 알림을 비활성화
            // (친한친구 해제 등으로 인한 잘못된 이벤트와 구분이 어려움)
            console.log("친구 요청 수락 이벤트 감지 (알림 생략):", event);
            break;
          }

          case "close_friend_request": {
            const requesterName = await getUserName(
              event.data.new.requester_id
            );
            showNotification(
              `💖 친한친구 요청`,
              `${requesterName}님이 친한친구 요청을 보냈습니다`
            );
            break;
          }

          case "close_friend_accepted": {
            const accepterName = await getUserName(event.data.new.target_id);
            showNotification(
              `💖 친한친구 수락`,
              `${accepterName}님이 친한친구 요청을 수락했습니다`
            );
            break;
          }

          case "message_status_update": {
            if (event.data.new.print_status === "completed") {
              showNotification(
                `📄 프린트 완료`,
                `메시지가 성공적으로 프린트되었습니다`
              );
            } else if (event.data.new.print_status === "failed") {
              showNotification(
                `❌ 프린트 실패`,
                `메시지 프린트에 실패했습니다`
              );
            }
            break;
          }

          default:
            console.log("Unknown realtime event type:", event.type);
        }
      } catch (error) {
        console.error("Failed to process realtime event:", event, error);
      }
    });

    // 메모리 관리: 너무 많은 ID가 쌓이지 않도록 주기적 정리
    if (processedEventIds.current.size > 1000) {
      const recentEventIds = new Set(
        realtimeEvents.slice(0, 500).map((event) => event.id)
      );
      processedEventIds.current = recentEventIds;
    }
  }, [realtimeEvents, user?.id]);

  // 이 컴포넌트는 UI를 렌더링하지 않음
  return null;
};
