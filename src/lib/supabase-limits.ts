// Supabase 무료 티어 제한사항 관리
import { logger } from "@/features/utils";

// Supabase 무료 티어 제한
export const SUPABASE_LIMITS = {
  REALTIME_CONNECTIONS: 200,    // 동시 연결 수
  DATABASE_SIZE: 500 * 1024 * 1024,  // 500MB
  STORAGE_SIZE: 1024 * 1024 * 1024,  // 1GB  
  MAX_IMAGE_SIZE: 5 * 1024 * 1024,   // 5MB per image
  MAX_MONTHLY_BANDWIDTH: 5 * 1024 * 1024 * 1024, // 5GB
} as const;

// 연결 수 추적
let activeConnections = 0;
const connectionLimit = SUPABASE_LIMITS.REALTIME_CONNECTIONS * 0.8; // 80% 제한

/**
 * Realtime 연결 수 관리
 */
export const connectionManager = {
  increment: () => {
    activeConnections++;
    logger.info(`📊 Realtime 연결: ${activeConnections}/${connectionLimit}`);
    
    if (activeConnections >= connectionLimit) {
      logger.warn("⚠️ Realtime 연결 수가 임계값에 도달했습니다.");
    }
  },
  
  decrement: () => {
    activeConnections = Math.max(0, activeConnections - 1);
    logger.info(`📊 Realtime 연결: ${activeConnections}/${connectionLimit}`);
  },
  
  canConnect: () => activeConnections < connectionLimit,
  
  getStatus: () => ({
    active: activeConnections,
    limit: connectionLimit,
    percentage: Math.round((activeConnections / connectionLimit) * 100),
  })
};

/**
 * 이미지 크기 검증
 */
export const validateImageSize = (file: File): boolean => {
  if (file.size > SUPABASE_LIMITS.MAX_IMAGE_SIZE) {
    const sizeMB = Math.round(file.size / 1024 / 1024 * 100) / 100;
    const limitMB = Math.round(SUPABASE_LIMITS.MAX_IMAGE_SIZE / 1024 / 1024);
    throw new Error(`이미지 크기가 너무 큽니다. (${sizeMB}MB / 최대 ${limitMB}MB)`);
  }
  return true;
};

/**
 * 메시지 정리 (오래된 메시지 자동 삭제)
 */
export const cleanupOldMessages = async (userId: string, daysToKeep: number = 30) => {
  try {
    const { supabase } = await import("@/lib/supabase/client");
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const { error } = await supabase
      .from("messages")
      .delete()
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .lt("created_at", cutoffDate.toISOString());
    
    if (error) {
      logger.error("메시지 정리 실패:", error);
    } else {
      logger.info(`✅ ${daysToKeep}일 이전 메시지 정리 완료`);
    }
  } catch (error) {
    logger.error("메시지 정리 중 오류:", error);
  }
};

/**
 * 사용량 모니터링
 */
export const usageMonitor = {
  logImageUpload: (size: number) => {
    const sizeMB = Math.round(size / 1024 / 1024 * 100) / 100;
    logger.info(`📸 이미지 업로드: ${sizeMB}MB`);
  },
  
  logRealtimeEvent: (event: string) => {
    logger.info(`🔄 Realtime 이벤트: ${event}`);
  },
  
  logDatabaseQuery: (table: string, operation: string) => {
    logger.info(`🗄️ DB 쿼리: ${operation} on ${table}`);
  }
};