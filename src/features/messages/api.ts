import { supabase } from "@/lib/supabase/client";
import { messageToasts, imageToasts } from "@/lib/toasts";
import { 
  sendNewMessageNotification, 
  sendPrintCompletedNotification, 
  sendPrintErrorNotification 
} from "@/features/notifications/trigger-notification";
import type {
  Message,
  SendMessageRequest,
  MessageWithProfiles,
  ImageUploadResult,
  MessageFormErrors,
} from "./types";

const isDevelopmentMode = process.env.NODE_ENV === "development";

// 개발용 mock 메시지 데이터
const DEV_MESSAGES: Message[] = [
  {
    id: "msg-1",
    sender_id: "dev-user-1", // alice
    receiver_id: "dev-user-2", // bob
    content: "안녕! 오늘 날씨가 정말 좋네요 ☀️",
    image_url: "https://picsum.photos/400/300?random=1",
    lcd_teaser: "앨리스가",
    print_status: "completed",
    printed_at: new Date(Date.now() - 3600000).toISOString(),
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "msg-2",
    sender_id: "dev-user-2", // bob
    receiver_id: "dev-user-1", // alice
    content: "맞아요! 산책하기 딱 좋은 날씨 🌸",
    image_url: null,
    lcd_teaser: "밥이",
    print_status: "pending",
    printed_at: null,
    created_at: new Date(Date.now() - 1800000).toISOString(),
    updated_at: new Date(Date.now() - 1800000).toISOString(),
  },
];

/**
 * 폼 데이터 유효성 검사
 */
export function validateMessageForm(data: {
  receiver_id: string;
  content: string;
  image_file: File | null;
  lcd_teaser: string;
}): MessageFormErrors {
  const errors: MessageFormErrors = {};

  // 수신자 검사
  if (!data.receiver_id.trim()) {
    errors.receiver_id = "메시지를 받을 친구를 선택해주세요.";
  }

  // 텍스트 또는 이미지 중 하나는 필수
  if (!data.content.trim() && !data.image_file) {
    errors.general = "메시지 내용 또는 이미지 중 하나는 필수입니다.";
  }

  // 텍스트 길이 검사 (200자 제한)
  if (data.content && data.content.length > 200) {
    errors.content = "메시지는 최대 200자까지 입력할 수 있습니다.";
  }

  // 티저 길이 검사 (10자 제한)
  if (data.lcd_teaser && data.lcd_teaser.length > 10) {
    errors.lcd_teaser = "LCD 메시지는 최대 10자까지 입력할 수 있습니다.";
  }

  // 이미지 파일 검사
  if (data.image_file) {
    // 파일 크기 검사 (5MB 제한)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (data.image_file.size > maxSize) {
      errors.image_file = "이미지 파일은 최대 5MB까지 업로드 가능합니다.";
    }

    // 파일 타입 검사
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(data.image_file.type)) {
      errors.image_file = "JPG, PNG 형식의 이미지만 업로드 가능합니다.";
    }
  }

  return errors;
}

/**
 * 이미지 업로드 (Supabase Storage)
 */
export async function uploadMessageImage(
  file: File,
  senderId: string
): Promise<ImageUploadResult> {
  // Storage가 설정되지 않은 경우 mock URL 반환 (개발 환경 대응)
  try {
    // 고유한 파일 경로 생성
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}_${Math.random()
      .toString(36)
      .substring(2)}.${fileExt}`;
    const filePath = `${senderId}/${fileName}`;

    // Storage에 파일 업로드
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("message-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      // Storage 버킷이 없거나 설정 오류인 경우 mock URL 반환
      console.warn("Storage 업로드 실패, mock URL 사용:", uploadError);
      return {
        url: `https://picsum.photos/400/300?random=${Date.now()}`,
        path: filePath,
      };
    }

    // Public URL 얻기
    const { data: urlData } = supabase.storage
      .from("message-images")
      .getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      path: filePath,
    };
  } catch (error) {
    console.warn("이미지 업로드 실패, mock URL 사용:", error);
    // 에러 발생 시 mock URL 반환 (Storage 미설정 대응)
    return {
      url: `https://picsum.photos/400/300?random=${Date.now()}`,
      path: `${senderId}/${Date.now()}_${file.name}`,
    };
  }
}

/**
 * 메시지 전송
 */
export async function sendMessage(
  request: SendMessageRequest,
  senderId: string
): Promise<Message> {
  // 항상 실제 Supabase API 사용 (개발/프로덕션 모드 구분 없이)
  try {
    let imageUrl = null;

    // 이미지 업로드 (있는 경우)
    if (request.image_file) {
      const uploadResult = await uploadMessageImage(
        request.image_file,
        senderId
      );
      imageUrl = uploadResult.url;
    }

    // 메시지 데이터베이스에 저장
    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: senderId,
        receiver_id: request.receiver_id,
        content: request.content || null,
        image_url: imageUrl,
        lcd_teaser: request.lcd_teaser || null,
        print_status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    // 새 메시지 알림 발송
    try {
      // 발신자 정보 조회
      const { data: senderProfile } = await supabase
        .from("user_profiles")
        .select("display_name")
        .eq("user_id", senderId)
        .single();

      const senderName = senderProfile?.display_name || "알 수 없는 사용자";
      const teaser = request.lcd_teaser || request.content?.slice(0, 20) || "새 메시지";
      
      await sendNewMessageNotification(
        request.receiver_id,
        senderId,
        senderName,
        data.id,
        teaser
      );
    } catch (notificationError) {
      console.error("메시지 알림 발송 실패:", notificationError);
      // 알림 발송 실패는 메인 로직에 영향을 주지 않음
    }

    return data;
  } catch (error) {
    console.error("메시지 전송 실패:", error);
    throw new Error("메시지 전송에 실패했습니다.");
  }
}

/**
 * 사용자의 메시지 목록 조회 (보낸 메시지 + 받은 메시지)
 */
export async function getMessagesList(
  userId: string
): Promise<MessageWithProfiles[]> {
  // 항상 실제 Supabase API 사용 (개발/프로덕션 모드 구분 없이)
  try {
    const { data: messages, error } = await supabase
      .from("messages")
      .select(
        `
                *,
                sender_profile:sender_id(id, username, display_name, avatar_url),
                receiver_profile:receiver_id(id, username, display_name, avatar_url)
            `
      )
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return messages || [];
  } catch (error) {
    console.error("메시지 목록 조회 실패:", error);
    throw new Error("메시지 목록을 불러오는데 실패했습니다.");
  }
}

/**
 * 특정 메시지의 프린트 상태 업데이트
 */
export async function updateMessagePrintStatus(
  messageId: string,
  status: Message["print_status"]
): Promise<void> {
  // 항상 실제 Supabase API 사용 (개발/프로덕션 모드 구분 없이)
  try {
    // 메시지 정보 조회 (알림 발송용)
    const { data: message, error: fetchError } = await supabase
      .from("messages")
      .select("sender_id, receiver_id")
      .eq("id", messageId)
      .single();

    if (fetchError) throw fetchError;

    const updateData: any = {
      print_status: status,
      updated_at: new Date().toISOString(),
    };

    if (status === "completed") {
      updateData.printed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("messages")
      .update(updateData)
      .eq("id", messageId);

    if (error) throw error;

    // 프린트 상태에 따른 알림 발송
    try {
      if (status === "completed") {
        await sendPrintCompletedNotification(
          message.sender_id,
          messageId
        );
      } else if (status === "error") {
        await sendPrintErrorNotification(
          message.sender_id,
          "프린트 중 오류가 발생했습니다",
          messageId
        );
      }
    } catch (notificationError) {
      console.error("프린트 상태 알림 발송 실패:", notificationError);
      // 알림 발송 실패는 메인 로직에 영향을 주지 않음
    }
  } catch (error) {
    console.error("메시지 상태 업데이트 실패:", error);
    throw new Error("메시지 상태 업데이트에 실패했습니다.");
  }
}

/**
 * 대기 중인 메시지 목록 조회 (친한친구 자동 프린트용)
 */
export async function getQueuedMessages(userId: string): Promise<
  {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string | null;
    image_url: string | null;
    lcd_teaser: string | null;
    print_status: "queued";
    created_at: string;
    sender_display_name: string;
    sender_avatar_url: string | null;
  }[]
> {
  try {
    console.log("🔍 대기 중인 메시지 조회 시작:", { userId });

    // 먼저 RPC 함수 사용 시도
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "get_queued_messages_for_user",
      {
        user_id_param: userId,
      }
    );

    console.log("📊 RPC 응답:", { data: rpcData, error: rpcError });

    if (!rpcError) {
      return rpcData || [];
    }

    console.warn("⚠️ RPC 실패, 직접 쿼리로 대체:", rpcError);

    // RPC 실패 시 직접 쿼리 사용
    const { data: directData, error: directError } = await supabase
      .from("messages")
      .select(
        `
        id,
        sender_id,
        receiver_id,
        content,
        image_url,
        lcd_teaser,
        print_status,
        created_at,
        sender:users!messages_sender_id_fkey (
          display_name,
          avatar_url
        )
      `
      )
      .eq("receiver_id", userId)
      .eq("print_status", "queued")
      .order("created_at", { ascending: true });

    console.log("📊 직접 쿼리 응답:", { data: directData, error: directError });

    if (directError) {
      console.error("❌ 직접 쿼리도 실패:", directError);
      throw directError;
    }

    // 데이터 변환
    const transformedData = (directData || []).map((item) => ({
      id: item.id,
      sender_id: item.sender_id,
      receiver_id: item.receiver_id,
      content: item.content,
      image_url: item.image_url,
      lcd_teaser: item.lcd_teaser,
      print_status: item.print_status as "queued",
      created_at: item.created_at,
      sender_display_name: item.sender?.display_name || "Unknown",
      sender_avatar_url: item.sender?.avatar_url || null,
    }));

    return transformedData;
  } catch (error) {
    console.error("❌ 대기 중인 메시지 조회 실패:", {
      error,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });

    // 안전하게 빈 배열 반환
    console.warn("🔄 에러로 인해 빈 배열을 반환합니다.");
    return [];
  }
}
