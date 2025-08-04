// Message 테이블 타입 (database.mdc 기준)
export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  image_url: string | null;
  lcd_teaser: string | null;
  print_status: "pending" | "approved" | "completed" | "failed" | "queued";
  printed_at: string | null;
  created_at: string;
  updated_at: string;
}

// 메시지 전송 요청 타입
export interface SendMessageRequest {
  receiver_id: string;
  content?: string;
  image_file?: File;
  lcd_teaser?: string;
}

// 메시지 작성 폼 데이터 타입
export interface MessageFormData {
  receiver_id: string;
  content: string;
  image_file: File | null;
  lcd_teaser: string;
}

// 메시지 목록용 조합 타입 (친구 정보 포함)
export interface MessageWithProfiles {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  image_url: string | null;
  lcd_teaser: string | null;
  print_status: "pending" | "approved" | "completed" | "failed" | "queued";
  printed_at: string | null;
  created_at: string;
  updated_at: string;
  sender_profile: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  receiver_profile: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

// 이미지 업로드 결과 타입
export interface ImageUploadResult {
  url: string;
  path: string;
}

// 폼 유효성 검사 오류 타입
export interface MessageFormErrors {
  receiver_id?: string;
  content?: string;
  image_file?: string;
  lcd_teaser?: string;
  general?: string;
}
