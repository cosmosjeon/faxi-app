"use client";

import { useEffect, useCallback } from "react";
import { useRealtimeStore } from "@/stores/realtimeStore";

interface UseRealtimeDataSyncProps {
  /**
   * 데이터 다시 로드하는 함수
   */
  onDataUpdate?: () => void | Promise<void>;

  /**
   * 동기화할 데이터 타입들
   */
  syncTypes?: ("messages" | "friendships" | "close_friends")[];

  /**
   * 동기화 활성화 여부
   */
  enabled?: boolean;
}

/**
 * 실시간 이벤트를 감지하여 페이지 데이터를 자동 갱신하는 Hook
 * 기존 UI나 기능을 변경하지 않고 백그라운드에서만 데이터를 동기화
 */
export const useRealtimeDataSync = ({
  onDataUpdate,
  syncTypes = ["messages", "friendships", "close_friends"],
  enabled = true,
}: UseRealtimeDataSyncProps = {}) => {
  const { realtimeEvents } = useRealtimeStore();

  // 데이터 업데이트 처리
  const handleDataUpdate = useCallback(async () => {
    if (!onDataUpdate || !enabled) return;

    try {
      await onDataUpdate();
      console.log("🔄 Realtime data sync completed");
    } catch (error) {
      console.error("❌ Failed to sync data:", error);
    }
  }, [onDataUpdate, enabled]);

  // 실시간 이벤트 감지 및 데이터 동기화
  useEffect(() => {
    if (!enabled || !realtimeEvents || realtimeEvents.length === 0) {
      return;
    }

    // 마지막 이벤트 확인 (최근 5초 이내의 이벤트만 처리)
    const recentEvents = realtimeEvents.filter((event) => {
      const eventTime = new Date(event.timestamp).getTime();
      const now = Date.now();
      return now - eventTime < 5000; // 5초 이내
    });

    if (recentEvents.length === 0) return;

    // 동기화가 필요한 이벤트 확인
    const needsSync = recentEvents.some((event) => {
      switch (event.type) {
        case "new_message":
          return syncTypes.includes("messages");

        case "friend_request":
        case "friend_accepted":
          return syncTypes.includes("friendships");

        case "close_friend_request":
        case "close_friend_accepted":
          return syncTypes.includes("close_friends");

        default:
          return false;
      }
    });

    if (needsSync) {
      console.log(
        "🔄 Triggering data sync due to realtime events:",
        recentEvents.map((e) => e.type)
      );
      handleDataUpdate();
    }
  }, [realtimeEvents, syncTypes, enabled, handleDataUpdate]);

  return {
    syncData: handleDataUpdate,
    isEnabled: enabled,
  };
};
