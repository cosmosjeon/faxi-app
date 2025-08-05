import { supabase } from "@/lib/supabase/client";
import { handleApiError, logger } from "../utils";
import { validateNotificationSettings, validatePrivacySettings } from "./validators";
import { attemptSettingsUpdate, retryWithSafeFields, ensureUserSettings, handleSettingsUpdateError } from "./services";
import type {
  UserSettings,
  NotificationSettings,
  PrivacySettings,
  UpdateNotificationSettingsRequest,
  UpdatePrivacySettingsRequest,
  SettingsResponse,
  SettingsUpdateResult,
  FAQItem,
  FAQResponse,
  FAQCategory,
} from "./types";

/**
 * 사용자 설정 조회
 */
export async function getUserSettings(
  userId: string
): Promise<UserSettings | null> {
  try {
    logger.info("사용자 설정 조회 시작:", userId);

    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    logger.info("사용자 설정 조회 결과:", { data, error });

    if (error) {
      if (error.code === "PGRST116") {
        // 설정이 없으면 기본 설정 생성
        console.log("설정이 없어서 기본 설정 생성 중...");
        return await createDefaultSettings(userId);
      }
      throw error;
    }

    // 기존 설정이 있지만 새 필드가 없는 경우 처리
    if (data) {
      const expectedFields = {
        // MVP 알림 설정 (필수)
        message_notifications: true,
        marketing_notifications: false,
        auto_print_close_friends: false,

        // 기존 필드
        retro_effects_enabled: true,

        // MVP 개인정보 설정 (필수)
        profile_visibility: "public" as const,
        show_online_status: true,
      };

      // 누락된 필드 찾기
      const missingFields: Record<string, any> = {};
      for (const [key, defaultValue] of Object.entries(expectedFields)) {
        if (!(key in data) || data[key] === null || data[key] === undefined) {
          missingFields[key] = defaultValue;
        }
      }

      console.log("📋 필드 분석:", {
        existingFields: Object.keys(data),
        expectedFields: Object.keys(expectedFields),
        missingFields: Object.keys(missingFields),
        missingFieldsData: missingFields,
      });

      // 누락된 필드가 있으면 DB에 업데이트
      if (Object.keys(missingFields).length > 0) {
        console.log("🔄 누락된 필드를 DB에 업데이트 중...");
        try {
          const { data: updatedData, error: updateError } = await supabase
            .from("user_settings")
            .update({
              ...missingFields,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
            .select()
            .single();

          if (!updateError && updatedData) {
            console.log("✅ 누락된 필드 업데이트 성공:", updatedData);
            return updatedData;
          } else {
            console.warn(
              "⚠️ 필드 업데이트 실패, 메모리상 기본값 사용:",
              updateError
            );
          }
        } catch (updateError) {
          console.warn(
            "⚠️ 필드 업데이트 중 오류, 메모리상 기본값 사용:",
            updateError
          );
        }
      }

      // DB 업데이트가 실패했거나 누락된 필드가 없는 경우 메모리상에서 병합
      const completedData = { ...expectedFields, ...data };
      console.log("📦 최종 설정 데이터:", completedData);
      return completedData;
    }

    return data;
  } catch (error) {
    handleApiError("SETTINGS_LOAD_FAILED", error);
  }
}

/**
 * 기본 설정 생성
 */
export async function createDefaultSettings(
  userId: string
): Promise<UserSettings> {
  try {
    console.log("기본 설정 생성 시작:", userId);

    // 먼저 기존 필드만 추가해서 테스트
    const baseSettings = {
      user_id: userId,
      auto_print_close_friends: false,
      retro_effects_enabled: true,
    };

    // MVP 설정으로 단순화 + 필드 순서 정리
    const extendedSettings = {
      ...baseSettings,
      // MVP 알림 설정 (우선순위)
      message_notifications: true,
      marketing_notifications: false,

      // MVP 개인정보 설정
      profile_visibility: "public" as const,
      show_online_status: true,
    };

    console.log("🏗️ 생성할 설정 구조:", {
      baseFields: Object.keys(baseSettings),
      extendedFields: Object.keys(extendedSettings),
      totalFields: Object.keys(extendedSettings).length,
    });

    // 먼저 기본 설정으로 시도, 실패하면 최소한의 필드만 사용
    let defaultSettings = extendedSettings;

    console.log("기본 설정 데이터:", defaultSettings);

    let { data, error } = await supabase
      .from("user_settings")
      .insert(defaultSettings)
      .select()
      .single();

    console.log("기본 설정 생성 결과:", { data, error });

    // 만약 새로운 필드로 인해 에러가 발생하면 기본 필드만으로 재시도
    if (
      error &&
      (error.code === "42703" ||
        error.message?.includes("column") ||
        error.message?.includes("does not exist"))
    ) {
      console.log("🔄 새 필드 오류 감지, 기본 필드만으로 재시도");
      defaultSettings = {
        ...baseSettings,
        message_notifications: true,
        marketing_notifications: false,
        profile_visibility: "public" as const,
        show_online_status: true,
      };

      console.log("🛡️ 안전한 기본 설정으로 재시도:", defaultSettings);

      const retry = await supabase
        .from("user_settings")
        .insert(defaultSettings)
        .select()
        .single();

      data = retry.data;
      error = retry.error;

      console.log("🔄 기본 필드 재시도 결과:", {
        success: !retry.error,
        data: retry.data,
        error: retry.error,
      });

      // 기본 필드 생성이 성공하면 누락된 필드들을 추가로 업데이트 시도
      if (!retry.error && retry.data) {
        console.log("🆕 기본 설정 생성 성공, 추가 필드 업데이트 시도");

        const additionalFields = {
          message_notifications: true,
          marketing_notifications: false,
          profile_visibility: "public" as const,
          show_online_status: true,
        };

        try {
          const { data: updatedData } = await supabase
            .from("user_settings")
            .update({
              ...additionalFields,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
            .select()
            .single();

          if (updatedData) {
            console.log("✅ 추가 필드 업데이트 성공:", updatedData);
            return updatedData;
          }
        } catch (updateError) {
          console.warn(
            "⚠️ 추가 필드 업데이트 실패, 기본 설정만 반환:",
            updateError
          );
        }
      }
    }

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("기본 설정 생성 실패:", {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCode: (error as any)?.code,
      errorDetails: (error as any)?.details,
      userId,
    });
    throw new Error("기본 설정을 생성하는데 실패했습니다.");
  }
}

/**
 * 알림 설정 업데이트 (리팩토링 버전)
 */
export async function updateNotificationSettings(
  request: UpdateNotificationSettingsRequest
): Promise<SettingsUpdateResult> {
  try {
    logger.info("🔔 알림 설정 업데이트 시작:", {
      userId: request.user_id,
      settingsKeys: Object.keys(request.settings || {}),
    });

    // 1. 검증
    validateNotificationSettings(request.settings);

    // 2. 사용자 설정 존재 확인
    await ensureUserSettings(request.user_id);

    // 3. 1차 업데이트 시도
    try {
      return await attemptSettingsUpdate(request.user_id, request.settings);
    } catch (error) {
      // 4. 스키마 오류 시 안전한 필드로 재시도
      if (
        (error as any)?.code === "42703" ||
        (error as any)?.message?.includes("column") ||
        (error as any)?.message?.includes("does not exist")
      ) {
        logger.info("🔄 스키마 오류 감지, 안전한 필드로 재시도");
        return await retryWithSafeFields(request.user_id, request.settings, "notification");
      }
      throw error;
    }
  } catch (error) {
    return handleSettingsUpdateError(error, "알림 설정 업데이트");
  }
}

/**
 * 개인정보 설정 업데이트 (리팩토링 버전)
 */
export async function updatePrivacySettings(
  request: UpdatePrivacySettingsRequest
): Promise<SettingsUpdateResult> {
  try {
    logger.info("🔄 개인정보 설정 업데이트 시작:", {
      userId: request.user_id,
      settingsKeys: Object.keys(request.settings || {}),
    });

    // 1. 검증
    validatePrivacySettings(request.settings);

    // 2. 사용자 설정 존재 확인
    await ensureUserSettings(request.user_id);

    // 3. 1차 업데이트 시도
    try {
      return await attemptSettingsUpdate(request.user_id, request.settings);
    } catch (error) {
      // 4. 스키마 오류 시 안전한 필드로 재시도
      if (
        (error as any)?.code === "42703" ||
        (error as any)?.message?.includes("column") ||
        (error as any)?.message?.includes("does not exist")
      ) {
        logger.info("🔄 개인정보 스키마 오류 감지, 안전한 필드로 재시도");
        return await retryWithSafeFields(request.user_id, request.settings, "privacy");
      }
      throw error;
    }
  } catch (error) {
    return handleSettingsUpdateError(error, "개인정보 설정 업데이트");
  }
}

/**
 * 전체 설정 업데이트
 */
export async function updateUserSettings(
  userId: string,
  settings: Partial<UserSettings>
): Promise<SettingsUpdateResult> {
  try {
    // user_id, created_at, updated_at 필드 제외
    const { user_id, created_at, updated_at, ...updateData } = settings;

    const { data, error } = await supabase
      .from("user_settings")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      updated_fields: Object.keys(updateData),
    };
  } catch (error) {
    return handleSettingsUpdateError(error, "전체 설정 업데이트");
  }
}

/**
 * FAQ 목록 조회
 */
export async function getFAQItems(category?: FAQCategory): Promise<FAQItem[]> {
  try {
    let query = supabase
      .from("faq_items")
      .select("*")
      .eq("is_active", true)
      .order("order_index", { ascending: true });

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.error("FAQ 조회 실패:", error);
    throw new Error("도움말을 불러오는데 실패했습니다.");
  }
}

/**
 * FAQ 도움이 됨 카운트 증가
 */
export async function incrementFAQHelpful(faqId: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc("increment_faq_helpful", {
      faq_id: faqId,
    });

    if (error) throw error;
    return true;
  } catch (error) {
    logger.error("FAQ 도움됨 증가 실패:", error);
    return false;
  }
}

/**
 * 설정 초기화 (기본값으로 복원)
 */
export async function resetUserSettings(
  userId: string
): Promise<SettingsUpdateResult> {
  try {
    // 기존 설정 삭제 후 기본 설정 생성
    await supabase.from("user_settings").delete().eq("user_id", userId);

    await createDefaultSettings(userId);

    return {
      success: true,
      updated_fields: ["all"],
    };
  } catch (error) {
    return handleSettingsUpdateError(error, "설정 초기화");
  }
}

/**
 * 계정 비활성화
 */
export async function deactivateAccount(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("users")
      .update({ is_active: false })
      .eq("id", userId);

    if (error) throw error;
    return true;
  } catch (error) {
    logger.error("계정 비활성화 실패:", error);
    return false;
  }
}
