import { supabase } from './supabase/client'

export type PushNotificationType = 'new_message' | 'friend_request' | 'close_friend_request' | 'auto_print_status'

interface PushNotificationData {
  user_ids: string[]
  title: string
  body: string
  type: PushNotificationType
  data?: {
    messageId?: string
    senderId?: string
    senderProfileImage?: string
    requestId?: string
    [key: string]: any
  }
}

export const sendPushNotification = async (payload: PushNotificationData) => {
  try {
    if (process.env.NODE_ENV !== 'production') console.log('푸시 알림 요청:', payload)
    
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: payload
    })
    
    if (process.env.NODE_ENV !== 'production') console.log('Edge Function 응답:', { data, error })
    
    if (error) {
      console.error('푸시 알림 전송 실패:', error)
      return { success: false, error }
    }
    
    if (process.env.NODE_ENV !== 'production') console.log('푸시 알림 전송 성공:', data)
    return { success: true, data }
  } catch (error) {
    console.error('푸시 알림 서비스 오류:', error)
    return { success: false, error }
  }
}

export const sendNewMessageNotification = async (
  receiverId: string,
  senderId: string,
  senderName: string,
  messagePreview: string,
  messageId: string,
  senderProfileImage?: string
) => {
  return sendPushNotification({
    user_ids: [receiverId],
    title: `${senderName}님이 메시지를 보냈습니다`,
    body: messagePreview,
    type: 'new_message',
    data: {
      messageId,
      senderId,
      senderProfileImage
    }
  })
}

export const sendFriendRequestNotification = async (
  targetId: string,
  requesterId: string,
  requesterName: string,
  requestId: string,
  requesterProfileImage?: string
) => {
  return sendPushNotification({
    user_ids: [targetId],
    title: '새로운 친구 요청',
    body: `${requesterName}님이 친구 요청을 보냈습니다`,
    type: 'friend_request',
    data: {
      requestId,
      senderId: requesterId,
      senderProfileImage: requesterProfileImage
    }
  })
}

export const sendCloseFriendRequestNotification = async (
  targetId: string,
  requesterId: string,
  requesterName: string,
  requestId: string,
  requesterProfileImage?: string
) => {
  return sendPushNotification({
    user_ids: [targetId],
    title: '새로운 친한친구 요청',
    body: `${requesterName}님이 친한친구 요청을 보냈습니다`,
    type: 'close_friend_request',
    data: {
      requestId,
      senderId: requesterId,
      senderProfileImage: requesterProfileImage
    }
  })
}

export const sendAutoPrintStatusNotification = async (
  receiverId: string,
  senderId: string,
  senderName: string,
  statusMessage: string,
  messageId: string
) => {
  return sendPushNotification({
    user_ids: [receiverId],
    title: 'FAXI',
    body: statusMessage,
    type: 'auto_print_status',
    data: {
      messageId,
      senderId
    }
  })
}