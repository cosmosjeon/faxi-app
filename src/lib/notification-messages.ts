/**
 * 알림 이벤트 타입 정의
 */
export type NotificationEventType = 
  | 'NEW_PRINT' 
  | 'FRIEND_REQUEST' 
  | 'FRIEND_ACCEPT'
  | 'PRINTER_CONNECTED'
  | 'PRINTER_DISCONNECTED'
  | 'PRINT_COMPLETED'
  | 'PRINT_ERROR';

/**
 * 알림 페이로드 인터페이스
 */
export interface NotificationPayload {
  teaser?: string;
  senderName?: string;
  requesterName?: string;
  printerName?: string;
  errorMessage?: string;
  [key: string]: any;
}

/**
 * 생성된 알림 메시지 인터페이스
 */
export interface NotificationMessage {
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
}

/**
 * 메시지 길이 제한 상수
 */
const MESSAGE_LENGTH_LIMITS = {
  TITLE_MAX: 30,
  BODY_MAX: 100,
  TEASER_MAX: 10,
  NAME_MAX: 15
} as const;

/**
 * 텍스트를 지정된 길이로 자르는 함수
 */
function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

/**
 * 이름을 안전하게 처리하는 함수
 */
function sanitizeName(name?: string): string {
  if (!name || name.trim() === '') return '알 수 없는 사용자';
  return truncateText(name.trim(), MESSAGE_LENGTH_LIMITS.NAME_MAX);
}

/**
 * 티저 메시지를 안전하게 처리하는 함수
 */
function sanitizeTeaser(teaser?: string): string {
  if (!teaser || teaser.trim() === '') return '새 메시지';
  return truncateText(teaser.trim(), MESSAGE_LENGTH_LIMITS.TEASER_MAX);
}

/**
 * 알림 메시지를 생성하는 메인 함수
 */
export function createNotificationMessage(
  eventType: NotificationEventType,
  payload: NotificationPayload
): NotificationMessage {
  const baseData = {
    event_type: eventType,
    timestamp: new Date().toISOString()
  };

  switch (eventType) {
    case 'NEW_PRINT':
      return createNewPrintMessage(payload, baseData);
    
    case 'FRIEND_REQUEST':
      return createFriendRequestMessage(payload, baseData);
    
    case 'FRIEND_ACCEPT':
      return createFriendAcceptMessage(payload, baseData);
    
    case 'PRINTER_CONNECTED':
      return createPrinterConnectedMessage(payload, baseData);
    
    case 'PRINTER_DISCONNECTED':
      return createPrinterDisconnectedMessage(payload, baseData);
    
    case 'PRINT_COMPLETED':
      return createPrintCompletedMessage(payload, baseData);
    
    case 'PRINT_ERROR':
      return createPrintErrorMessage(payload, baseData);
    
    default:
      return createDefaultMessage(eventType, payload, baseData);
  }
}

/**
 * 새 프린트 메시지 생성
 */
function createNewPrintMessage(payload: NotificationPayload, baseData: Record<string, any>): NotificationMessage {
  const senderName = sanitizeName(payload.senderName);
  const teaser = sanitizeTeaser(payload.teaser);
  
  return {
    title: '새로운 프린트 도착!',
    body: `"${teaser}" from ${senderName}`,
    data: {
      ...baseData,
      sender_name: payload.senderName,
      teaser: payload.teaser
    },
    badge: 1,
    sound: 'default'
  };
}

/**
 * 친구 요청 메시지 생성
 */
function createFriendRequestMessage(payload: NotificationPayload, baseData: Record<string, any>): NotificationMessage {
  const requesterName = sanitizeName(payload.requesterName);
  
  return {
    title: '새로운 친구 요청',
    body: `${requesterName}님이 친구가 되고 싶어해요.`,
    data: {
      ...baseData,
      requester_name: payload.requesterName,
      requester_id: payload.requesterId
    },
    badge: 1,
    sound: 'default'
  };
}

/**
 * 친구 수락 메시지 생성
 */
function createFriendAcceptMessage(payload: NotificationPayload, baseData: Record<string, any>): NotificationMessage {
  const senderName = sanitizeName(payload.senderName);
  
  return {
    title: '친구 수락',
    body: `${senderName}님과 친구가 되었어요.`,
    data: {
      ...baseData,
      sender_name: payload.senderName,
      sender_id: payload.senderId
    },
    badge: 1,
    sound: 'default'
  };
}

/**
 * 프린터 연결 메시지 생성
 */
function createPrinterConnectedMessage(payload: NotificationPayload, baseData: Record<string, any>): NotificationMessage {
  const printerName = payload.printerName ? `"${payload.printerName}"` : '프린터';
  
  return {
    title: '프린터 연결됨',
    body: `${printerName}와 연결되었습니다.`,
    data: {
      ...baseData,
      printer_name: payload.printerName
    },
    badge: 0,
    sound: 'default'
  };
}

/**
 * 프린터 연결 해제 메시지 생성
 */
function createPrinterDisconnectedMessage(payload: NotificationPayload, baseData: Record<string, any>): NotificationMessage {
  return {
    title: '프린터 연결 끊김',
    body: '프린터 연결이 끊어졌습니다. 다시 연결해주세요.',
    data: {
      ...baseData,
      printer_name: payload.printerName
    },
    badge: 0,
    sound: 'default'
  };
}

/**
 * 프린트 완료 메시지 생성
 */
function createPrintCompletedMessage(payload: NotificationPayload, baseData: Record<string, any>): NotificationMessage {
  return {
    title: '프린트 완료',
    body: '메시지가 성공적으로 프린트되었습니다.',
    data: {
      ...baseData,
      print_id: payload.printId
    },
    badge: 0,
    sound: 'default'
  };
}

/**
 * 프린트 오류 메시지 생성
 */
function createPrintErrorMessage(payload: NotificationPayload, baseData: Record<string, any>): NotificationMessage {
  const errorMessage = payload.errorMessage || '알 수 없는 오류';
  
  return {
    title: '프린트 오류',
    body: `프린트 중 오류가 발생했습니다: ${errorMessage}`,
    data: {
      ...baseData,
      error_message: payload.errorMessage,
      print_id: payload.printId
    },
    badge: 0,
    sound: 'default'
  };
}

/**
 * 기본 메시지 생성 (알 수 없는 이벤트 타입)
 */
function createDefaultMessage(
  eventType: NotificationEventType, 
  payload: NotificationPayload, 
  baseData: Record<string, any>
): NotificationMessage {
  return {
    title: '새 알림',
    body: '새로운 알림이 도착했습니다.',
    data: {
      ...baseData,
      unknown_event_type: eventType
    },
    badge: 1,
    sound: 'default'
  };
}

/**
 * 메시지 길이를 검증하는 함수
 */
export function validateMessageLength(message: NotificationMessage): boolean {
  const titleValid = message.title.length <= MESSAGE_LENGTH_LIMITS.TITLE_MAX;
  const bodyValid = message.body.length <= MESSAGE_LENGTH_LIMITS.BODY_MAX;
  
  return titleValid && bodyValid;
}

/**
 * 메시지 길이를 자동으로 조정하는 함수
 */
export function adjustMessageLength(message: NotificationMessage): NotificationMessage {
  return {
    ...message,
    title: truncateText(message.title, MESSAGE_LENGTH_LIMITS.TITLE_MAX),
    body: truncateText(message.body, MESSAGE_LENGTH_LIMITS.BODY_MAX)
  };
} 