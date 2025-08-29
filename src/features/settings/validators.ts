// FAXI MVP - 설정 검증 로직
import { logger } from "../utils";

/**
 * 알림 설정 유효성 검증
 */
export function validateNotificationSettings(settings: Record<string, any>): void {
  if (!settings || Object.keys(settings).length === 0) {
    throw new Error("업데이트할 설정이 없습니다.");
  }

  for (const [key, value] of Object.entries(settings)) {
    logger.info(`🔍 검증 중: ${key} = ${value} (${typeof value})`);

    // 알림 설정은 boolean이어야 함
    if (
      [
        "message_notifications",
        "marketing_notifications", 
        "auto_print_close_friends",
      ].includes(key)
    ) {
      if (typeof value !== "boolean") {
        throw new Error(
          `${key}는 boolean 값이어야 합니다. 받은 값: ${value} (${typeof value})`
        );
      }
    }
  }
}

/**
 * 개인정보 설정 유효성 검증
 */
export function validatePrivacySettings(settings: Record<string, any>): void {
  if (!settings || Object.keys(settings).length === 0) {
    throw new Error("업데이트할 설정이 없습니다.");
  }

  for (const [key, value] of Object.entries(settings)) {
    logger.info(`🔍 개인정보 설정 검증 중: ${key} = ${value} (${typeof value})`);

    // profile_visibility는 string이어야 함
    if (key === "profile_visibility" && typeof value !== "string") {
      throw new Error(
        `${key}는 문자열 값이어야 합니다. 받은 값: ${value} (${typeof value})`
      );
    }

    // show_online_status는 boolean이어야 함
    if (key === "show_online_status" && typeof value !== "boolean") {
      throw new Error(
        `${key}는 boolean 값이어야 합니다. 받은 값: ${value} (${typeof value})`
      );
    }
  }
}

/**
 * 안전한 필드 필터링 (DB 스키마 호환성)
 */
export function filterSafeFields(
  settings: Record<string, any>,
  fieldType: "notification" | "privacy"
): Record<string, any> {
  const notificationFields = [
    "auto_print_close_friends",
    "retro_effects_enabled", 
    "message_notifications",
    "marketing_notifications",
    "language",
  ];

  const privacyFields = [
    "auto_print_close_friends",
    "retro_effects_enabled",
    "profile_visibility",
    "show_online_status",
    "language",
  ];

  const safeFields = fieldType === "notification" ? notificationFields : privacyFields;

  const filteredSettings = Object.fromEntries(
    Object.entries(settings).filter(([key]) => safeFields.includes(key))
  );

  logger.info(`🛡️ ${fieldType} 안전한 필드만 필터링:`, {
    originalKeys: Object.keys(settings),
    safeFields,
    filteredKeys: Object.keys(filteredSettings),
    filteredSettings,
  });

  return filteredSettings;
}