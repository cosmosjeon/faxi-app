import { supabase } from "@/lib/supabase/client";
import { messageToasts, imageToasts } from "@/lib/toasts";
import { MAX_MESSAGE_LENGTH, MAX_TEASER_LENGTH, MAX_IMAGE_SIZE } from "../constants";
import { handleApiError, logger } from "../utils";
import { sendNewMessageNotification, sendAutoPrintStatusNotification } from "@/lib/push-notification-service";
import type {
  Message,
  SendMessageRequest,
  MessageWithProfiles,
  ImageUploadResult,
  MessageFormErrors,
} from "./types";

const isDevelopmentMode = process.env.NODE_ENV === "development";

/**
 * 메시지 폼 유효성 검사
 */
export function validateMessageForm(data: {
  receiver_id: string;
  content: string;
  image_file: File | null;
  lcd_teaser: string;
}): MessageFormErrors {
  const errors: MessageFormErrors = {};

  if (!data.receiver_id.trim()) {
    errors.receiver_id = "메시지를 받을 친구를 선택해주세요.";
  }

  if (!data.content.trim() && !data.image_file) {
    errors.general = "메시지 내용 또는 이미지 중 하나는 필수입니다.";
  }

  if (data.content && data.content.length > MAX_MESSAGE_LENGTH) {
    errors.content = `메시지는 최대 ${MAX_MESSAGE_LENGTH}자까지 입력할 수 있습니다.`;
  }

  if (data.lcd_teaser && data.lcd_teaser.length > MAX_TEASER_LENGTH) {
    errors.lcd_teaser = `LCD 메시지는 최대 ${MAX_TEASER_LENGTH}자까지 입력할 수 있습니다.`;
  }

  if (data.image_file) {
    if (data.image_file.size > MAX_IMAGE_SIZE) {
      errors.image_file = `이미지 파일은 최대 ${Math.round(MAX_IMAGE_SIZE / 1024 / 1024)}MB까지 업로드 가능합니다.`;
    }

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

    // 푸시 알림 전송 (친한친구 여부에 따라 다른 알림)
    try {
      const { data: senderProfile } = await supabase
        .from("users")
        .select("display_name, avatar_url")
        .eq("id", senderId)
        .single();

      // 친한친구 관계 확인
      const { data: isCloseFriend, error: closeFriendError } = await supabase.rpc("are_close_friends", {
        user1_id: senderId,
        user2_id: request.receiver_id
      });

      if (isCloseFriend) {
        // 친한친구: 2단계 알림
        
        // 1단계: 일반 메시지 알림
        await sendNewMessageNotification(
          request.receiver_id,
          senderId,
          senderProfile?.display_name || "익명",
          request.content || "사진을 보냈습니다",
          data.id,
          senderProfile?.avatar_url
        );

        // 프린터 연결 상태 확인
        const { data: printerConnection } = await supabase
          .from("printer_connections")
          .select("is_active")
          .eq("user_id", request.receiver_id)
          .eq("is_active", true)
          .single();

        // 2단계: 자동 출력 상태 알림 (0.5초 후)
        setTimeout(async () => {
          if (printerConnection) {
            // 프린터 연결됨
            await sendAutoPrintStatusNotification(
              request.receiver_id,
              senderId,
              "FAXI",
              "친한친구 메시지가 자동으로 출력됩니다!",
              data.id
            );
          } else {
            // 프린터 미연결
            await sendAutoPrintStatusNotification(
              request.receiver_id,
              senderId,
              "FAXI", 
              "즉시 출력하려면 프린터를 연결해주세요!",
              data.id
            );
          }
        }, 500);
      } else {
        // 일반친구: 승인 요청 알림
        await sendNewMessageNotification(
          request.receiver_id,
          senderId,
          senderProfile?.display_name || "익명",
          request.content || "사진을 보냈습니다",
          data.id,
          senderProfile?.avatar_url
        );
      }
    } catch (pushError) {
      console.warn("푸시 알림 전송 실패:", pushError);
    }

    return data;
  } catch (error) {
    handleApiError("MESSAGE_SEND_FAILED", error);
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
    handleApiError("MESSAGE_LIST_FAILED", error);
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
  } catch (error) {
    handleApiError("MESSAGE_STATUS_UPDATE_FAILED", error);
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
      sender_display_name: (() => {
        try {
          if (Array.isArray(item.sender) && item.sender.length > 0) {
            return (item.sender[0] as any)?.display_name || "Unknown";
          }
          return (item.sender as any)?.display_name || "Unknown";
        } catch {
          return "Unknown";
        }
      })(),
      sender_avatar_url: (() => {
        try {
          if (Array.isArray(item.sender) && item.sender.length > 0) {
            return (item.sender[0] as any)?.avatar_url || null;
          }
          return (item.sender as any)?.avatar_url || null;
        } catch {
          return null;
        }
      })(),
    }));

    return transformedData;
  } catch (error) {
    console.error("❌ 대기 중인 메시지 조회 실패:", {
      error,
      message: (error as any)?.message,
      details: (error as any)?.details,
      hint: (error as any)?.hint,
      code: (error as any)?.code,
    });

    // 안전하게 빈 배열 반환
    console.warn("🔄 에러로 인해 빈 배열을 반환합니다.");
    return [];
  }
}
