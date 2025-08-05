// FAXI MVP - API 상수 정의
// 검색 및 제한값
export const SEARCH_RESULT_LIMIT = 10;
export const MAX_MESSAGE_LENGTH = 200;
export const MAX_TEASER_LENGTH = 10;
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

// 친구 관리
export const MIN_BATCH_FRIENDS_COUNT = 5; // 배치 처리 최소 친구 수

// 에러 메시지
export const ERROR_MESSAGES = {
  FRIEND_ADD_FAILED: "친구 추가에 실패했습니다.",
  FRIEND_REMOVE_FAILED: "친구 삭제에 실패했습니다.",
  FRIEND_SEARCH_FAILED: "사용자 검색에 실패했습니다.",
  FRIEND_LIST_FAILED: "친구 목록을 불러오는데 실패했습니다.",
  CLOSE_FRIEND_REQUEST_FAILED: "친한친구 신청에 실패했습니다.",
  CLOSE_FRIEND_ACCEPT_FAILED: "친한친구 신청 수락에 실패했습니다.",
  MESSAGE_SEND_FAILED: "메시지 전송에 실패했습니다.",
  MESSAGE_LIST_FAILED: "메시지 목록을 불러오는데 실패했습니다.",
  MESSAGE_STATUS_UPDATE_FAILED: "메시지 상태 업데이트에 실패했습니다.",
  SETTINGS_UPDATE_FAILED: "설정을 업데이트하는데 실패했습니다.",
  SETTINGS_LOAD_FAILED: "설정을 불러오는데 실패했습니다.",
} as const;