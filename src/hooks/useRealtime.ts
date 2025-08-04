"use client";

import { useEffect, useCallback, useRef } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import {
  subscribeToNewMessages,
  subscribeToFriendships,
  subscribeToMyFriendshipUpdates,
  subscribeToCloseFriendRequests,
  subscribeToMyCloseFriendRequests,
  subscribeToMessageStatusUpdates,
  MessageRealtimePayload,
  FriendshipRealtimePayload,
  CloseFriendRequestPayload,
} from "@/lib/supabase/realtime";
import { useRealtimeStore } from "@/stores/realtimeStore";

interface UseRealtimeProps {
  userId?: string;
  enabled?: boolean;
}

export const useRealtime = ({
  userId,
  enabled = true,
}: UseRealtimeProps = {}) => {
  const subscriptionsRef = useRef<RealtimeChannel[]>([]);

  const {
    setConnectionStatus,
    addNewMessage,
    addNewFriendRequest,
    updateFriendRequestStatus,
    addNewCloseFriendRequest,
    updateCloseFriendRequestStatus,
    addRealtimeEvent,
  } = useRealtimeStore();

  // 새 메시지 처리
  const handleNewMessage = useCallback(
    (payload: MessageRealtimePayload) => {
      console.log("📨 New message received:", payload);
      addNewMessage(payload);
    },
    [addNewMessage]
  );

  // 친구 요청 처리
  const handleFriendshipChange = useCallback(
    (payload: FriendshipRealtimePayload) => {
      console.log("👥 Friendship change:", payload);

      if (payload.eventType === "INSERT" && payload.new.status === "pending") {
        // 새 친구 요청
        addNewFriendRequest(payload);
      } else if (payload.eventType === "UPDATE") {
        // 친구 요청 상태 변경
        updateFriendRequestStatus(payload);
      }
    },
    [addNewFriendRequest, updateFriendRequestStatus]
  );

  // 내가 보낸 친구 요청 상태 변경 처리
  const handleMyFriendshipUpdate = useCallback(
    (payload: FriendshipRealtimePayload) => {
      console.log("✅ My friendship updated:", payload);
      updateFriendRequestStatus(payload);
    },
    [updateFriendRequestStatus]
  );

  // 친한친구 요청 처리
  const handleCloseFriendRequest = useCallback(
    (payload: CloseFriendRequestPayload) => {
      console.log("💖 Close friend request:", payload);

      if (payload.eventType === "INSERT" && payload.new.status === "pending") {
        // 새 친한친구 요청
        addNewCloseFriendRequest(payload);
      } else if (payload.eventType === "UPDATE") {
        // 친한친구 요청 상태 변경
        updateCloseFriendRequestStatus(payload);
      }
    },
    [addNewCloseFriendRequest, updateCloseFriendRequestStatus]
  );

  // 내가 보낸 친한친구 요청 상태 변경 처리
  const handleMyCloseFriendRequestUpdate = useCallback(
    (payload: CloseFriendRequestPayload) => {
      console.log("✅ My close friend request updated:", payload);
      updateCloseFriendRequestStatus(payload);
    },
    [updateCloseFriendRequestStatus]
  );

  // 메시지 상태 업데이트 처리
  const handleMessageStatusUpdate = useCallback(
    (payload: MessageRealtimePayload) => {
      console.log("📄 Message status updated:", payload);

      addRealtimeEvent({
        type: "message_status_update",
        data: payload,
        read: false,
      });
    },
    [addRealtimeEvent]
  );

  // 구독 설정
  const setupSubscriptions = useCallback(() => {
    if (!userId || !enabled) {
      return;
    }

    console.log("🔌 Setting up realtime subscriptions for user:", userId);
    setConnectionStatus("connecting");

    try {
      // 모든 구독 설정
      const subscriptions = [
        subscribeToNewMessages(userId, handleNewMessage),
        subscribeToFriendships(userId, handleFriendshipChange),
        subscribeToMyFriendshipUpdates(userId, handleMyFriendshipUpdate),
        subscribeToCloseFriendRequests(userId, handleCloseFriendRequest),
        subscribeToMyCloseFriendRequests(
          userId,
          handleMyCloseFriendRequestUpdate
        ),
        subscribeToMessageStatusUpdates(userId, handleMessageStatusUpdate),
      ];

      subscriptionsRef.current = subscriptions;
      setConnectionStatus("connected");

      console.log("✅ Realtime subscriptions established");
    } catch (error) {
      console.error("❌ Failed to setup realtime subscriptions:", error);
      setConnectionStatus("error");
    }
  }, [
    userId,
    enabled,
    setConnectionStatus,
    handleNewMessage,
    handleFriendshipChange,
    handleMyFriendshipUpdate,
    handleCloseFriendRequest,
    handleMyCloseFriendRequestUpdate,
    handleMessageStatusUpdate,
  ]);

  // 구독 해제
  const teardownSubscriptions = useCallback(() => {
    console.log("🔌 Tearing down realtime subscriptions");

    subscriptionsRef.current.forEach((subscription) => {
      try {
        subscription.unsubscribe();
      } catch (error) {
        console.warn("Warning: Failed to unsubscribe from channel:", error);
      }
    });

    subscriptionsRef.current = [];
    setConnectionStatus("disconnected");
  }, [setConnectionStatus]);

  // Effect: 구독 관리
  useEffect(() => {
    if (userId && enabled) {
      setupSubscriptions();
    } else {
      teardownSubscriptions();
    }

    // Cleanup
    return () => {
      teardownSubscriptions();
    };
  }, [userId, enabled, setupSubscriptions, teardownSubscriptions]);

  // 수동 재연결
  const reconnect = useCallback(() => {
    teardownSubscriptions();
    if (userId && enabled) {
      setTimeout(setupSubscriptions, 1000); // 1초 후 재연결
    }
  }, [userId, enabled, setupSubscriptions, teardownSubscriptions]);

  return {
    reconnect,
    isEnabled: enabled,
    activeSubscriptions: subscriptionsRef.current.length,
  };
};
