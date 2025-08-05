// FAXI MVP - 설정 업데이트 서비스 로직
import { supabase } from "@/lib/supabase/client";
import { logger, parseSupabaseError } from "../utils";
import { filterSafeFields } from "./validators";
import type { SettingsUpdateResult } from "./types";

/**
 * 설정 업데이트 시도 (1차)
 */
export async function attemptSettingsUpdate(
  userId: string,
  settings: Record<string, any>
): Promise<SettingsUpdateResult> {
  const updateData = {
    ...settings,
    updated_at: new Date().toISOString(),
  };

  logger.info("📝 업데이트 데이터 준비:", {
    updateData,
    keys: Object.keys(updateData),
    values: Object.values(updateData),
  });

  const { data, error } = await supabase
    .from("user_settings")
    .update(updateData)
    .eq("user_id", userId)
    .select()
    .single();

  logger.info("💾 1차 업데이트 결과:", {
    success: !error,
    updatedFields: Object.keys(settings),
    error: error?.message,
    errorCode: error?.code,
  });

  if (!error && data) {
    return {
      success: true,
      updated_fields: Object.keys(settings),
    };
  }

  if (error) throw error;
  
  return {
    success: true,
    updated_fields: Object.keys(settings),
  };
}

/**
 * 안전한 필드로 재시도 (2차)
 */
export async function retryWithSafeFields(
  userId: string,
  settings: Record<string, any>,
  fieldType: "notification" | "privacy"
): Promise<SettingsUpdateResult> {
  const filteredSettings = filterSafeFields(settings, fieldType);

  if (Object.keys(filteredSettings).length === 0) {
    logger.warn(`⚠️ ${fieldType} 업데이트할 안전한 필드가 없음 - 마이그레이션 필요`);
    return {
      success: true,
      updated_fields: Object.keys(settings),
      error: "일부 설정은 시스템 업데이트 후 적용됩니다.",
    };
  }

  const updateData = {
    ...filteredSettings,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("user_settings")
    .update(updateData)
    .eq("user_id", userId)
    .select()
    .single();

  logger.info(`🔄 ${fieldType} 2차 시도 결과:`, {
    success: !error,
    data,
    error,
  });

  if (!error) {
    return {
      success: true,
      updated_fields: Object.keys(filteredSettings),
    };
  }

  throw error;
}

/**
 * 사용자 설정 존재 여부 확인 및 기본 설정 생성
 */
export async function ensureUserSettings(userId: string): Promise<void> {
  const { data: userExists } = await supabase
    .from("user_settings")
    .select("user_id")
    .eq("user_id", userId)
    .single();

  if (!userExists) {
    logger.info("🆕 사용자 설정이 없음, 기본 설정 생성");
    // createDefaultSettings는 기존 api.ts에서 import
    const { createDefaultSettings } = await import("./api");
    await createDefaultSettings(userId);
  }
}

/**
 * 설정 업데이트 에러 처리
 */
export function handleSettingsUpdateError(
  error: unknown,
  operation: string
): SettingsUpdateResult {
  const userMessage = parseSupabaseError(error as any);
  
  logger.error(`❌ ${operation} 실패:`, {
    error,
    errorMessage: error instanceof Error ? error.message : String(error),
    errorCode: (error as any)?.code,
  });

  return {
    success: false,
    updated_fields: [],
    error: userMessage,
  };
}