"use client";

import { create } from "zustand";
import {
  MessageRealtimePayload,
  FriendshipRealtimePayload,
  CloseFriendRequestPayload,
} from "@/lib/supabase/realtime";
import { logger } from "@/features/utils";

// 메모리 관리 상수
const MAX_EVENTS_HISTORY = 50;
const MAX_NEW_MESSAGES = 20;
const MAX_FRIEND_REQUESTS = 10;
const MAX_CLOSE_FRIEND_REQUESTS = 10;
const EVENT_TTL_HOURS = 24;

// TTL 기반 이벤트 정리 헬퍼
const cleanupExpiredEvents = (events: RealtimeEvent[]): RealtimeEvent[] => {
  const cutoffTime = new Date(Date.now() - EVENT_TTL_HOURS * 60 * 60 * 1000);
  return events.filter(event => event.timestamp > cutoffTime).slice(0, MAX_EVENTS_HISTORY);
};

// 실시간 이벤트 타입
export interface RealtimeEvent {
  id: string;
  type:
    | "new_message"
    | "friend_request"
    | "friend_accepted"
    | "close_friend_request"
    | "close_friend_accepted"
    | "message_status_update";
  data: any;
  timestamp: Date;
  read: boolean;
}

// 실시간 상태 인터페이스
interface RealtimeState {
  // 연결 상태
  isConnected: boolean;
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";

  // 새 이벤트들
  newMessages: MessageRealtimePayload[];
  newFriendRequests: FriendshipRealtimePayload[];
  newCloseFriendRequests: CloseFriendRequestPayload[];

  // 이벤트 히스토리 (알림용)
  realtimeEvents: RealtimeEvent[];

  // 카운터
  unreadMessagesCount: number;
  pendingFriendRequestsCount: number;
  pendingCloseFriendRequestsCount: number;

  // Actions
  setConnectionStatus: (
    status: "connecting" | "connected" | "disconnected" | "error"
  ) => void;

  // 메시지 관련
  addNewMessage: (message: MessageRealtimePayload) => void;
  clearNewMessages: () => void;
  markMessageAsRead: (messageId: string) => void;

  // 친구 요청 관련
  addNewFriendRequest: (request: FriendshipRealtimePayload) => void;
  updateFriendRequestStatus: (request: FriendshipRealtimePayload) => void;
  clearFriendRequests: () => void;

  // 친한친구 요청 관련
  addNewCloseFriendRequest: (request: CloseFriendRequestPayload) => void;
  updateCloseFriendRequestStatus: (request: CloseFriendRequestPayload) => void;
  clearCloseFriendRequests: () => void;

  // 이벤트 관리
  addRealtimeEvent: (event: Omit<RealtimeEvent, "id" | "timestamp">) => void;
  markEventAsRead: (eventId: string) => void;
  clearAllEvents: () => void;

  // 전체 초기화
  reset: () => void;
}

// 초기 상태
const initialState = {
  isConnected: false,
  connectionStatus: "disconnected" as const,
  newMessages: [],
  newFriendRequests: [],
  newCloseFriendRequests: [],
  realtimeEvents: [],
  unreadMessagesCount: 0,
  pendingFriendRequestsCount: 0,
  pendingCloseFriendRequestsCount: 0,
};

// Zustand Store 생성
export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  ...initialState,

  // 연결 상태 관리
  setConnectionStatus: (status) => {
    logger.info("🔗 실시간 연결 상태 변경:", status);
    set({
      connectionStatus: status,
      isConnected: status === "connected",
    });
  },

  // 새 메시지 추가 (메모리 누수 방지)
  addNewMessage: (message) => {
    const currentMessages = get().newMessages;

    // 중복 방지
    if (currentMessages.some((m) => m.new.id === message.new.id)) {
      return;
    }

    logger.info("📨 새 실시간 메시지:", message.new.id);

    set((state) => ({
      newMessages: [...state.newMessages, message].slice(-MAX_NEW_MESSAGES),
      unreadMessagesCount: state.unreadMessagesCount + 1,
    }));

    // 이벤트 히스토리에 추가
    get().addRealtimeEvent({
      type: "new_message",
      data: message,
      read: false,
    });
  },

  // 새 메시지 목록 초기화
  clearNewMessages: () => {
    set({ newMessages: [], unreadMessagesCount: 0 });
  },

  // 메시지 읽음 처리
  markMessageAsRead: (messageId) => {
    set((state) => ({
      newMessages: state.newMessages.filter((m) => m.new.id !== messageId),
      unreadMessagesCount: Math.max(0, state.unreadMessagesCount - 1),
    }));
  },

  // 새 친구 요청 추가 (메모리 누수 방지)
  addNewFriendRequest: (request) => {
    const currentRequests = get().newFriendRequests;

    // 중복 방지
    if (currentRequests.some((r) => r.new.id === request.new.id)) {
      return;
    }

    if (request.eventType === "INSERT" && request.new.status === "pending") {
      logger.info("👫 새 친구 요청:", request.new.id);
      
      set((state) => ({
        newFriendRequests: [...state.newFriendRequests, request].slice(-MAX_FRIEND_REQUESTS),
        pendingFriendRequestsCount: state.pendingFriendRequestsCount + 1,
      }));

      get().addRealtimeEvent({
        type: "friend_request",
        data: request,
        read: false,
      });
    }
  },

  // 친구 요청 상태 업데이트
  updateFriendRequestStatus: (request) => {
    if (request.eventType === "UPDATE" && request.new.status === "accepted") {
      logger.info("✅ 친구 요청 수락:", request.new.id);
      get().addRealtimeEvent({
        type: "friend_accepted",
        data: request,
        read: false,
      });
    }
  },

  // 친구 요청 목록 초기화
  clearFriendRequests: () => {
    set({ newFriendRequests: [], pendingFriendRequestsCount: 0 });
  },

  // 새 친한친구 요청 추가 (메모리 누수 방지)
  addNewCloseFriendRequest: (request) => {
    const currentRequests = get().newCloseFriendRequests;

    // 중복 방지
    if (currentRequests.some((r) => r.new.id === request.new.id)) {
      return;
    }

    if (request.eventType === "INSERT" && request.new.status === "pending") {
      logger.info("💝 새 친한친구 요청:", request.new.id);
      
      set((state) => ({
        newCloseFriendRequests: [...state.newCloseFriendRequests, request].slice(-MAX_CLOSE_FRIEND_REQUESTS),
        pendingCloseFriendRequestsCount:
          state.pendingCloseFriendRequestsCount + 1,
      }));

      get().addRealtimeEvent({
        type: "close_friend_request",
        data: request,
        read: false,
      });
    }
  },

  // 친한친구 요청 상태 업데이트
  updateCloseFriendRequestStatus: (request) => {
    if (request.eventType === "UPDATE" && request.new.status === "accepted") {
      logger.info("💝 친한친구 요청 수락:", request.new.id);
      get().addRealtimeEvent({
        type: "close_friend_accepted",
        data: request,
        read: false,
      });
    }
  },

  // 친한친구 요청 목록 초기화
  clearCloseFriendRequests: () => {
    set({ newCloseFriendRequests: [], pendingCloseFriendRequestsCount: 0 });
  },

  // 실시간 이벤트 추가 (TTL 기반 메모리 관리)
  addRealtimeEvent: (event) => {
    const newEvent: RealtimeEvent = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      ...event,
    };

    set((state) => ({
      realtimeEvents: cleanupExpiredEvents([newEvent, ...state.realtimeEvents]),
    }));
  },

  // 이벤트 읽음 처리
  markEventAsRead: (eventId) => {
    set((state) => ({
      realtimeEvents: state.realtimeEvents.map((event) =>
        event.id === eventId ? { ...event, read: true } : event
      ),
    }));
  },

  // 모든 이벤트 삭제
  clearAllEvents: () => {
    set({ realtimeEvents: [] });
  },

  // 전체 상태 초기화
  reset: () => {
    set(initialState);
  },
}));
