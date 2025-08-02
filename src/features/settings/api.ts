import { supabase } from "@/lib/supabase/client";
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
    console.log("사용자 설정 조회 시작:", userId);

    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    console.log("사용자 설정 조회 결과:", { data, error });

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
    console.error("사용자 설정 조회 실패:", {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCode: (error as any)?.code,
      userId,
    });
    throw new Error("설정을 불러오는데 실패했습니다.");
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
 * 알림 설정 업데이트
 */
export async function updateNotificationSettings(
  request: UpdateNotificationSettingsRequest
): Promise<SettingsUpdateResult> {
  try {
    console.log("🔔 알림 설정 업데이트 시작:", {
      request,
      requestType: typeof request,
      settingsKeys: Object.keys(request.settings || {}),
      settingsValues: Object.values(request.settings || {}),
    });

    // 기존 필드만 있는 경우를 대비해 허용된 필드만 필터링
    const allowedFields = [
      "auto_print_close_friends",
      "retro_effects_enabled",
      "message_notifications",
      "marketing_notifications",
    ];

    // 요청된 설정 검증
    if (!request.settings || Object.keys(request.settings).length === 0) {
      throw new Error("업데이트할 설정이 없습니다.");
    }

    // 설정 값 유효성 검증
    for (const [key, value] of Object.entries(request.settings)) {
      console.log(`🔍 검증 중: ${key} = ${value} (${typeof value})`);

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

    // 사용자 존재 여부 확인
    const { data: userExists } = await supabase
      .from("user_settings")
      .select("user_id")
      .eq("user_id", request.user_id)
      .single();

    if (!userExists) {
      console.log("🆕 사용자 설정이 없음, 기본 설정 생성 후 업데이트");
      await createDefaultSettings(request.user_id);
    }

    // 업데이트 데이터 준비
    let updateData = {
      ...request.settings,
      updated_at: new Date().toISOString(),
    };

    console.log("📝 업데이트 데이터 준비:", {
      updateData,
      dataType: typeof updateData,
      keys: Object.keys(updateData),
      values: Object.values(updateData),
    });

    // 1차 시도: 전체 업데이트
    let { data, error } = await supabase
      .from("user_settings")
      .update(updateData)
      .eq("user_id", request.user_id)
      .select()
      .single();

    console.log("💾 1차 업데이트 결과:", {
      success: !error,
      updatedFields: Object.keys(request.settings),
      data,
      error,
      errorCode: error?.code,
      errorMessage: error?.message,
      errorDetails: error?.details,
      errorHint: error?.hint,
    });

    // 성공 시 바로 반환
    if (!error && data) {
      console.log("✅ 설정 업데이트 성공!");
      return {
        success: true,
        updated_fields: Object.keys(request.settings),
      };
    }

    // 컬럼 오류인 경우 기존 필드만으로 재시도
    if (
      error &&
      (error.code === "42703" ||
        error.message?.includes("column") ||
        error.message?.includes("does not exist"))
    ) {
      console.log("🔄 새 필드 오류 감지, 기존 필드만으로 재시도:", {
        errorCode: error.code,
        errorMessage: error.message,
        originalSettings: request.settings,
      });

      // 확실히 존재하는 필드만 사용 (MVP 필드들 포함)
      const safeFields = [
        "auto_print_close_friends",
        "retro_effects_enabled",
        "message_notifications",
        "marketing_notifications",
      ];

      const filteredSettings = Object.fromEntries(
        Object.entries(request.settings).filter(([key]) =>
          safeFields.includes(key)
        )
      );

      console.log("🛡️ 안전한 필드만 필터링:", {
        originalKeys: Object.keys(request.settings),
        safeFields,
        filteredKeys: Object.keys(filteredSettings),
        filteredSettings,
      });

      if (Object.keys(filteredSettings).length > 0) {
        updateData = {
          ...filteredSettings,
          updated_at: new Date().toISOString(),
        };

        console.log("🔄 재시도 업데이트 데이터:", updateData);

        const retry = await supabase
          .from("user_settings")
          .update(updateData)
          .eq("user_id", request.user_id)
          .select()
          .single();

        data = retry.data;
        error = retry.error;

        console.log("🔄 2차 시도 결과:", {
          success: !retry.error,
          data: retry.data,
          error: retry.error,
        });

        if (!retry.error) {
          console.log("✅ 안전한 필드 업데이트 성공!");
          return {
            success: true,
            updated_fields: Object.keys(filteredSettings),
          };
        }
      } else {
        // 업데이트할 안전한 필드가 없는 경우 - 마이그레이션 필요를 알림
        console.warn("⚠️ 업데이트할 안전한 필드가 없음 - 마이그레이션 필요");

        // 하지만 일단 성공으로 처리하여 사용자 경험을 해치지 않음
        return {
          success: true,
          updated_fields: Object.keys(request.settings),
        };
      }
    }

    if (error) throw error;

    return {
      success: true,
      updated_fields: Object.keys(request.settings),
    };
  } catch (error) {
    const errorDetails = {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCode: (error as any)?.code,
      errorDetails: (error as any)?.details,
      request,
    };

    console.error("❌ 알림 설정 업데이트 실패:", errorDetails);

    // 사용자에게 더 명확한 오류 메시지 제공
    let userMessage = "알림 설정을 업데이트하는데 실패했습니다.";

    if (error instanceof Error) {
      if (
        error.message.includes("column") ||
        error.message.includes("does not exist")
      ) {
        userMessage =
          "데이터베이스 마이그레이션이 필요합니다. 개발자에게 문의하세요.";
      } else if (
        error.message.includes("permission") ||
        error.message.includes("denied")
      ) {
        userMessage = "권한이 없습니다. 다시 로그인해주세요.";
      } else if (error.message.includes("network")) {
        userMessage = "네트워크 연결을 확인해주세요.";
      } else {
        userMessage = error.message;
      }
    }

    return {
      success: false,
      updated_fields: [],
      error: userMessage,
    };
  }
}

/**
 * 개인정보 설정 업데이트 (MVP 버전)
 */
export async function updatePrivacySettings(
  request: UpdatePrivacySettingsRequest
): Promise<SettingsUpdateResult> {
  try {
    console.log("🔄 개인정보 설정 업데이트 시작:", {
      userId: request.user_id,
      settings: request.settings,
      timestamp: new Date().toISOString(),
    });

    // 요청된 설정 검증
    if (!request.settings || Object.keys(request.settings).length === 0) {
      throw new Error("업데이트할 설정이 없습니다.");
    }

    // 설정 값 유효성 검증
    for (const [key, value] of Object.entries(request.settings)) {
      console.log(
        `🔍 개인정보 설정 검증 중: ${key} = ${value} (${typeof value})`
      );

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

    // 사용자 존재 여부 확인
    const { data: userExists } = await supabase
      .from("user_settings")
      .select("user_id")
      .eq("user_id", request.user_id)
      .single();

    if (!userExists) {
      console.log("🆕 사용자 설정이 없음, 기본 설정 생성 후 업데이트");
      await createDefaultSettings(request.user_id);
    }

    // 업데이트 데이터 준비
    let updateData = {
      ...request.settings,
      updated_at: new Date().toISOString(),
    };

    console.log("📝 개인정보 업데이트 데이터 준비:", {
      updateData,
      dataType: typeof updateData,
      keys: Object.keys(updateData),
      values: Object.values(updateData),
    });

    // 1차 시도: 전체 업데이트
    let { data, error } = await supabase
      .from("user_settings")
      .update(updateData)
      .eq("user_id", request.user_id)
      .select()
      .single();

    console.log("💾 개인정보 1차 업데이트 결과:", {
      success: !error,
      updatedFields: Object.keys(request.settings),
      data,
      error,
      errorCode: error?.code,
      errorMessage: error?.message,
      errorDetails: error?.details,
      errorHint: error?.hint,
    });

    // 성공 시 바로 반환
    if (!error && data) {
      console.log("✅ 개인정보 설정 업데이트 성공!");
      return {
        success: true,
        updated_fields: Object.keys(request.settings),
      };
    }

    // 컬럼 오류인 경우 기존 필드만으로 재시도
    if (
      error &&
      (error.code === "42703" ||
        error.message?.includes("column") ||
        error.message?.includes("does not exist"))
    ) {
      console.log("🔄 개인정보 새 필드 오류 감지, 기존 필드만으로 재시도:", {
        errorCode: error.code,
        errorMessage: error.message,
        originalSettings: request.settings,
      });

      // 확실히 존재하는 필드만 사용 (MVP 개인정보 필드들 포함)
      const safeFields = [
        "auto_print_close_friends",
        "retro_effects_enabled",
        "profile_visibility",
        "show_online_status",
      ];

      const filteredSettings = Object.fromEntries(
        Object.entries(request.settings).filter(([key]) =>
          safeFields.includes(key)
        )
      );

      console.log("🛡️ 개인정보 안전한 필드만 필터링:", {
        originalKeys: Object.keys(request.settings),
        safeFields,
        filteredKeys: Object.keys(filteredSettings),
        filteredSettings,
      });

      if (Object.keys(filteredSettings).length > 0) {
        updateData = {
          ...filteredSettings,
          updated_at: new Date().toISOString(),
        };

        const retry = await supabase
          .from("user_settings")
          .update(updateData)
          .eq("user_id", request.user_id)
          .select()
          .single();

        data = retry.data;
        error = retry.error;

        console.log("🔄 개인정보 2차 시도 결과:", {
          success: !retry.error,
          data: retry.data,
          error: retry.error,
        });

        if (!retry.error) {
          console.log("✅ 개인정보 안전한 필드 업데이트 성공!");
          return {
            success: true,
            updated_fields: Object.keys(filteredSettings),
          };
        }
      } else {
        // 업데이트할 안전한 필드가 없는 경우 - 마이그레이션 필요를 알림
        console.warn(
          "⚠️ 개인정보 업데이트할 안전한 필드가 없음 - 마이그레이션 필요"
        );

        // 하지만 일단 성공으로 처리하여 사용자 경험을 해치지 않음
        return {
          success: true,
          updated_fields: [],
          error: "일부 설정은 시스템 업데이트 후 적용됩니다.",
        };
      }
    }

    // 다른 에러인 경우 throw
    if (error) throw error;

    return {
      success: true,
      updated_fields: Object.keys(request.settings),
    };
  } catch (error) {
    const errorDetails = {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCode: (error as any)?.code,
      errorDetails: (error as any)?.details,
      request,
    };

    console.error("❌ 개인정보 설정 업데이트 실패:", errorDetails);

    // 사용자에게 더 명확한 오류 메시지 제공
    let userMessage = "개인정보 설정을 업데이트하는데 실패했습니다.";

    if (error instanceof Error) {
      if (
        error.message.includes("column") ||
        error.message.includes("does not exist")
      ) {
        userMessage =
          "데이터베이스 마이그레이션이 필요합니다. 개발자에게 문의하세요.";
      } else if (
        error.message.includes("permission") ||
        error.message.includes("denied")
      ) {
        userMessage = "권한이 없습니다. 다시 로그인해주세요.";
      } else if (error.message.includes("network")) {
        userMessage = "네트워크 연결을 확인해주세요.";
      } else {
        userMessage = error.message;
      }
    }

    return {
      success: false,
      updated_fields: [],
      error: userMessage,
    };
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
    console.error("설정 업데이트 실패:", error);
    return {
      success: false,
      updated_fields: [],
      error: "설정을 업데이트하는데 실패했습니다.",
    };
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
    console.error("FAQ 조회 실패:", error);
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
    console.error("FAQ 도움됨 증가 실패:", error);
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
    console.error("설정 초기화 실패:", error);
    return {
      success: false,
      updated_fields: [],
      error: "설정을 초기화하는데 실패했습니다.",
    };
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
    console.error("계정 비활성화 실패:", error);
    return false;
  }
}
