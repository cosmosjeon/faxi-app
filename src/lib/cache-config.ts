// 캐시 설정 상수들
export const CACHE_TIMES = {
  // 사용자 프로필 - 자주 변경되지 않음
  USER_PROFILE: 10 * 60 * 1000, // 10분

  // 친구 목록 - 가끔 변경됨
  FRIENDS_LIST: 5 * 60 * 1000, // 5분

  // 메시지 목록 - 자주 변경됨
  MESSAGES_LIST: 30 * 1000, // 30초

  // 프린터 상태 - 실시간 업데이트 필요
  PRINTER_STATUS: 10 * 1000, // 10초

  // 설정 정보 - 거의 변경되지 않음
  SETTINGS: 30 * 60 * 1000, // 30분
} as const;

export const GC_TIMES = {
  // 가비지 컬렉션 시간 (메모리 정리)
  SHORT: 5 * 60 * 1000, // 5분
  MEDIUM: 10 * 60 * 1000, // 10분
  LONG: 30 * 60 * 1000, // 30분
} as const;

// 캐시 키 팩토리
export const cacheKeys = {
  users: {
    profile: (userId: string) => ["users", "profile", userId] as const,
    settings: (userId: string) => ["users", "settings", userId] as const,
  },
  friends: {
    list: (userId: string) => ["friends", "list", userId] as const,
    requests: (userId: string) => ["friends", "requests", userId] as const,
  },
  messages: {
    list: (userId: string) => ["messages", "list", userId] as const,
    sent: (userId: string) => ["messages", "sent", userId] as const,
  },
  printer: {
    status: () => ["printer", "status"] as const,
    queue: () => ["printer", "queue"] as const,
  },
} as const;
