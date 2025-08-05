// FAXI MVP - API 공통 유틸리티
import { ERROR_MESSAGES } from "./constants";

/**
 * API 에러 처리 유틸리티
 * AI 코딩으로 생성된 중복 에러 처리 로직을 통합
 */
export const handleApiError = (
  operation: keyof typeof ERROR_MESSAGES,
  error: unknown,
  customMessage?: string
): never => {
  // 개발 환경에서만 상세 로그
  if (process.env.NODE_ENV === 'development') {
    console.error(`${operation} 실패:`, error);
  }
  
  const message = customMessage || ERROR_MESSAGES[operation];
  throw new Error(message);
};

/**
 * 조건부 로깅 유틸리티
 * 운영 환경에서 console.log 성능 저하 방지
 */
export const logger = {
  info: process.env.NODE_ENV === 'development' ? console.log : () => {},
  warn: console.warn,
  error: console.error,
};

/**
 * Supabase 에러 메시지 파싱
 */
export const parseSupabaseError = (error: any): string => {
  if (error?.message?.includes("column") || error?.message?.includes("does not exist")) {
    return "데이터베이스 마이그레이션이 필요합니다. 개발자에게 문의하세요.";
  }
  
  if (error?.message?.includes("permission") || error?.message?.includes("denied")) {
    return "권한이 없습니다. 다시 로그인해주세요.";
  }
  
  if (error?.message?.includes("network")) {
    return "네트워크 연결을 확인해주세요.";
  }
  
  return error?.message || "알 수 없는 오류가 발생했습니다.";
};