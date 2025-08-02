"use client";

import { supabase } from "./client";
import { RealtimeChannel } from "@supabase/supabase-js";

// 실시간 데이터 타입 정의
export interface MessageRealtimePayload {
  new: {
    id: string;
    sender_id: string;
    receiver_id: string;
    content?: string;
    image_url?: string;
    lcd_teaser?: string;
    print_status?: string;
    created_at: string;
  };
  old?: any;
  eventType: "INSERT" | "UPDATE" | "DELETE";
}

export interface FriendshipRealtimePayload {
  new: {
    id: string;
    user_id: string;
    friend_id: string;
    status: "pending" | "accepted" | "blocked";
    is_close_friend: boolean;
    created_at: string;
  };
  old?: any;
  eventType: "INSERT" | "UPDATE" | "DELETE";
}

export interface CloseFriendRequestPayload {
  new: {
    id: string;
    requester_id: string;
    target_id: string;
    status: "pending" | "accepted" | "rejected";
    created_at: string;
  };
  old?: any;
  eventType: "INSERT" | "UPDATE" | "DELETE";
}

// 새 메시지 실시간 구독
export const subscribeToNewMessages = (
  userId: string,
  callback: (payload: MessageRealtimePayload) => void
): RealtimeChannel => {
  return supabase
    .channel(`messages:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `receiver_id=eq.${userId}`,
      },
      (payload) => callback(payload as unknown as MessageRealtimePayload)
    )
    .subscribe();
};

// 친구 요청 실시간 구독 (새 요청 + 상태 변경)
export const subscribeToFriendships = (
  userId: string,
  callback: (payload: FriendshipRealtimePayload) => void
): RealtimeChannel => {
  return supabase
    .channel(`friendships:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*", // INSERT, UPDATE 모두
        schema: "public",
        table: "friendships",
        filter: `friend_id=eq.${userId}`,
      },
      (payload) => callback(payload as unknown as FriendshipRealtimePayload)
    )
    .subscribe();
};

// 내가 보낸 친구 요청 상태 변경 구독
export const subscribeToMyFriendshipUpdates = (
  userId: string,
  callback: (payload: FriendshipRealtimePayload) => void
): RealtimeChannel => {
  return supabase
    .channel(`my_friendships:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "friendships",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => callback(payload as unknown as FriendshipRealtimePayload)
    )
    .subscribe();
};

// 친한친구 요청 실시간 구독
export const subscribeToCloseFriendRequests = (
  userId: string,
  callback: (payload: CloseFriendRequestPayload) => void
): RealtimeChannel => {
  return supabase
    .channel(`close_friend_requests:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*", // INSERT, UPDATE 모두
        schema: "public",
        table: "close_friend_requests",
        filter: `target_id=eq.${userId}`,
      },
      (payload) => callback(payload as unknown as CloseFriendRequestPayload)
    )
    .subscribe();
};

// 내가 보낸 친한친구 요청 상태 변경 구독
export const subscribeToMyCloseFriendRequests = (
  userId: string,
  callback: (payload: CloseFriendRequestPayload) => void
): RealtimeChannel => {
  return supabase
    .channel(`my_close_friend_requests:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "close_friend_requests",
        filter: `requester_id=eq.${userId}`,
      },
      (payload) => callback(payload as unknown as CloseFriendRequestPayload)
    )
    .subscribe();
};

// 메시지 상태 업데이트 구독 (프린트 상태 등)
export const subscribeToMessageStatusUpdates = (
  userId: string,
  callback: (payload: MessageRealtimePayload) => void
): RealtimeChannel => {
  return supabase
    .channel(`message_status:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter: `sender_id=eq.${userId}`,
      },
      (payload) => callback(payload as unknown as MessageRealtimePayload)
    )
    .subscribe();
};

// 연결 상태 확인 유틸리티
export const getRealtimeStatus = () => {
  const channels = supabase.getChannels();
  return {
    isConnected: channels.length > 0,
    activeChannels: channels.length,
    channels: channels.map((ch) => ch.topic),
  };
};

// 모든 구독 해제
export const unsubscribeAll = () => {
  supabase.removeAllChannels();
};
