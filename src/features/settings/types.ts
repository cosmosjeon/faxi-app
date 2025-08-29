// 알림 설정 타입 (MVP 버전)
export interface NotificationSettings {
  // 전체 알림 (메시지, 친구 요청, 프린터 등 모든 알림)
  message_notifications: boolean;

  // 마케팅 알림
  marketing_notifications: boolean;

  // 친한친구 자동출력
  auto_print_close_friends: boolean;
}

// 개인정보 설정 타입 (MVP 버전)
export interface PrivacySettings {
  // 프로필 공개 설정
  profile_visibility: "public" | "friends_only" | "private";

  // 온라인 상태 표시 (최근 접속 시간도 이에 종속됨)
  show_online_status: boolean;
}

// 전체 사용자 설정 타입
export interface UserSettings extends NotificationSettings, PrivacySettings {
  user_id: string;
  retro_effects_enabled: boolean; // 기존 필드
  language: "ko" | "en"; // 앱 언어
  created_at: string;
  updated_at: string;
}

// FAQ 타입
export interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  order_index: number;
  is_active: boolean;
  helpful_count: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// FAQ 카테고리 타입
export type FAQCategory =
  | "getting_started"
  | "messaging"
  | "printer_setup"
  | "friends"
  | "troubleshooting";

// 설정 업데이트 요청 타입
export interface UpdateNotificationSettingsRequest {
  user_id: string;
  settings: Partial<NotificationSettings>;
}

export interface UpdatePrivacySettingsRequest {
  user_id: string;
  settings: Partial<PrivacySettings>;
}

// API 응답 타입
export interface SettingsResponse {
  success: boolean;
  data?: UserSettings;
  error?: string;
}

export interface FAQResponse {
  success: boolean;
  data?: FAQItem[];
  error?: string;
}

// 설정 업데이트 결과 타입
export interface SettingsUpdateResult {
  success: boolean;
  updated_fields: string[];
  error?: string;
}
