import { supabase } from '@/lib/supabase/client';

export interface NotificationEvent {
  eventType: 'FRIEND_REQUEST' | 'FRIEND_ACCEPT' | 'NEW_MESSAGE' | 'PRINT_COMPLETED' | 'PRINT_ERROR';
  recipientUserId: string;
  senderUserId?: string;
  senderName?: string;
  messageId?: string;
  printId?: string;
  teaser?: string;
  errorMessage?: string;
  additionalData?: Record<string, any>;
}

/**
 * trigger-notification Edge Function을 호출하여 알림을 발송합니다
 */
export async function triggerNotification(event: NotificationEvent): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('trigger-notification', {
      body: { event }
    });

    if (error) {
      console.error('알림 발송 실패:', error);
      throw new Error('알림 발송에 실패했습니다');
    }

    console.log(`알림 발송 성공: ${event.eventType} to ${event.recipientUserId}`);
  } catch (error) {
    console.error('trigger-notification 호출 실패:', error);
    // 알림 발송 실패는 메인 로직에 영향을 주지 않도록 처리
  }
}

/**
 * 친구 요청 알림 발송
 */
export async function sendFriendRequestNotification(
  recipientUserId: string,
  senderUserId: string,
  senderName: string
): Promise<void> {
  await triggerNotification({
    eventType: 'FRIEND_REQUEST',
    recipientUserId,
    senderUserId,
    senderName
  });
}

/**
 * 친구 요청 수락 알림 발송
 */
export async function sendFriendAcceptNotification(
  recipientUserId: string,
  senderUserId: string,
  senderName: string
): Promise<void> {
  await triggerNotification({
    eventType: 'FRIEND_ACCEPT',
    recipientUserId,
    senderUserId,
    senderName
  });
}

/**
 * 새 메시지 알림 발송
 */
export async function sendNewMessageNotification(
  recipientUserId: string,
  senderUserId: string,
  senderName: string,
  messageId: string,
  teaser: string
): Promise<void> {
  await triggerNotification({
    eventType: 'NEW_MESSAGE',
    recipientUserId,
    senderUserId,
    senderName,
    messageId,
    teaser
  });
}

/**
 * 프린트 완료 알림 발송
 */
export async function sendPrintCompletedNotification(
  userId: string,
  printId: string
): Promise<void> {
  await triggerNotification({
    eventType: 'PRINT_COMPLETED',
    recipientUserId: userId,
    printId
  });
}

/**
 * 프린트 오류 알림 발송
 */
export async function sendPrintErrorNotification(
  userId: string,
  errorMessage: string,
  printId?: string
): Promise<void> {
  await triggerNotification({
    eventType: 'PRINT_ERROR',
    recipientUserId: userId,
    printId,
    errorMessage
  });
} 