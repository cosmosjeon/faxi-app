import { supabase } from '@/lib/supabase/client';
import { 
  createNotificationMessage, 
  type NotificationEventType, 
  type NotificationPayload,
  type NotificationMessage 
} from '@/lib/notification-messages';

export interface DeviceToken {
  id: string;
  token: string;
  device_type: 'FCM' | 'APNs';
  device_info?: Record<string, any>;
  is_active: boolean;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}

export interface PushNotificationPayload {
  recipient_user_id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
}

/**
 * 디바이스 토큰을 등록합니다
 */
export async function registerDeviceToken(
  token: string,
  deviceType: 'FCM' | 'APNs',
  deviceInfo?: Record<string, any>
): Promise<DeviceToken> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('사용자가 로그인되지 않았습니다');
  }

  const { data, error } = await supabase
    .from('device_tokens')
    .upsert({
      user_id: user.id,
      token,
      device_type: deviceType,
      device_info: deviceInfo || {},
      is_active: true,
      last_used_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,token'
    })
    .select()
    .single();

  if (error) {
    console.error('디바이스 토큰 등록 실패:', error);
    throw new Error('디바이스 토큰 등록에 실패했습니다');
  }

  return data;
}

/**
 * 사용자의 활성 디바이스 토큰들을 조회합니다
 */
export async function getUserActiveTokens(userId: string): Promise<DeviceToken[]> {
  const { data, error } = await supabase
    .from('device_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('활성 토큰 조회 실패:', error);
    throw new Error('토큰 조회에 실패했습니다');
  }

  return data || [];
}

/**
 * 디바이스 토큰을 비활성화합니다
 */
export async function deactivateDeviceToken(tokenId: string): Promise<void> {
  const { error } = await supabase
    .from('device_tokens')
    .update({ 
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', tokenId);

  if (error) {
    console.error('토큰 비활성화 실패:', error);
    throw new Error('토큰 비활성화에 실패했습니다');
  }
}

/**
 * 푸시 알림을 발송합니다 (Edge Function 호출)
 */
export async function sendPushNotification(payload: PushNotificationPayload): Promise<void> {
  const { data, error } = await supabase.functions.invoke('send-push-notification', {
    body: payload
  });

  if (error) {
    console.error('푸시 알림 발송 실패:', error);
    throw new Error('푸시 알림 발송에 실패했습니다');
  }

  return data;
}

/**
 * 메시지 수신 알림을 발송합니다
 */
export async function sendMessageNotification(
  recipientUserId: string,
  senderName: string,
  messagePreview: string,
  messageId: string
): Promise<void> {
  const notificationMessage = createNotificationMessage('NEW_PRINT', {
    senderName,
    teaser: messagePreview
  });

  await sendPushNotification({
    recipient_user_id: recipientUserId,
    ...notificationMessage,
    data: {
      ...notificationMessage.data,
      message_id: messageId
    }
  });
}

/**
 * 친구 요청 알림을 발송합니다
 */
export async function sendFriendRequestNotification(
  recipientUserId: string,
  requesterName: string,
  requesterId: string
): Promise<void> {
  const notificationMessage = createNotificationMessage('FRIEND_REQUEST', {
    requesterName,
    requesterId
  });

  await sendPushNotification({
    recipient_user_id: recipientUserId,
    ...notificationMessage,
    data: {
      ...notificationMessage.data,
      requester_id: requesterId
    }
  });
}

/**
 * 프린터 연결 상태 알림을 발송합니다
 */
export async function sendPrinterConnectionNotification(
  userId: string,
  isConnected: boolean,
  printerName?: string
): Promise<void> {
  const eventType = isConnected ? 'PRINTER_CONNECTED' : 'PRINTER_DISCONNECTED';
  const notificationMessage = createNotificationMessage(eventType, {
    printerName
  });

  await sendPushNotification({
    recipient_user_id: userId,
    ...notificationMessage,
    data: {
      ...notificationMessage.data,
      is_connected: isConnected
    }
  });
}

/**
 * 친구 수락 알림을 발송합니다
 */
export async function sendFriendAcceptNotification(
  recipientUserId: string,
  senderName: string,
  senderId: string
): Promise<void> {
  const notificationMessage = createNotificationMessage('FRIEND_ACCEPT', {
    senderName,
    senderId
  });

  await sendPushNotification({
    recipient_user_id: recipientUserId,
    ...notificationMessage,
    data: {
      ...notificationMessage.data,
      sender_id: senderId
    }
  });
}

/**
 * 프린트 완료 알림을 발송합니다
 */
export async function sendPrintCompletedNotification(
  userId: string,
  printId: string
): Promise<void> {
  const notificationMessage = createNotificationMessage('PRINT_COMPLETED', {
    printId
  });

  await sendPushNotification({
    recipient_user_id: userId,
    ...notificationMessage
  });
}

/**
 * 프린트 오류 알림을 발송합니다
 */
export async function sendPrintErrorNotification(
  userId: string,
  errorMessage: string,
  printId?: string
): Promise<void> {
  const notificationMessage = createNotificationMessage('PRINT_ERROR', {
    errorMessage,
    printId
  });

  await sendPushNotification({
    recipient_user_id: userId,
    ...notificationMessage
  });
} 