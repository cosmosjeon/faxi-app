import { supabase } from "@/lib/supabase/client";
import { messageToasts, imageToasts } from "@/lib/toasts";
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
  if (isDevelopmentMode) {
    // 개발 모드: mock 업로드 결과 반환
    const mockUrl = `https://picsum.photos/400/300?random=${Date.now()}`;
    const mockPath = `${senderId}/${Date.now()}_${file.name}`;

    await new Promise((resolve) => setTimeout(resolve, 1500)); // 업로드 딜레이 시뮬레이션
    return {
      url: mockUrl,
      path: mockPath,
    };
  }

  // 프로덕션 모드: 실제 Supabase Storage 업로드
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

    if (uploadError) throw uploadError;

    // Public URL 얻기
    const { data: urlData } = supabase.storage
      .from("message-images")
      .getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      path: filePath,
    };
  } catch (error) {
    console.error("이미지 업로드 실패:", error);
    throw new Error("이미지 업로드에 실패했습니다.");
  }
}

/**
 * 메시지 전송
 */
export async function sendMessage(
  request: SendMessageRequest,
  senderId: string
): Promise<Message> {
  if (isDevelopmentMode) {
    // 개발 모드: mock 메시지 생성
    let imageUrl = null;

    // 이미지가 있으면 mock 업로드
    if (request.image_file) {
      const uploadResult = await uploadMessageImage(
        request.image_file,
        senderId
      );
      imageUrl = uploadResult.url;
    }

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      sender_id: senderId,
      receiver_id: request.receiver_id,
      content: request.content || null,
      image_url: imageUrl,
      lcd_teaser: request.lcd_teaser || null,
      print_status: "pending",
      printed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // mock 데이터에 추가
    DEV_MESSAGES.push(newMessage);

    await new Promise((resolve) => setTimeout(resolve, 800)); // 전송 딜레이 시뮬레이션
    return newMessage;
  }

  // 프로덕션 모드: 실제 Supabase API 호출
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
  if (isDevelopmentMode) {
    // 개발 모드: mock 데이터 반환
    const DEV_USERS = [
      {
        id: "dev-user-1",
        username: "alice",
        display_name: "앨리스",
        avatar_url: "https://picsum.photos/100/100?random=1",
      },
      {
        id: "dev-user-2",
        username: "bob",
        display_name: "밥",
        avatar_url: "https://picsum.photos/100/100?random=2",
      },
      {
        id: "dev-user-3",
        username: "charlie",
        display_name: "찰리",
        avatar_url: "https://picsum.photos/100/100?random=3",
      },
    ];

    const userMessages = DEV_MESSAGES.filter(
      (msg) => msg.sender_id === userId || msg.receiver_id === userId
    );

    const messagesWithProfiles: MessageWithProfiles[] = userMessages.map(
      (message) => {
        const senderProfile = DEV_USERS.find(
          (u) => u.id === message.sender_id
        )!;
        const receiverProfile = DEV_USERS.find(
          (u) => u.id === message.receiver_id
        )!;

        return {
          ...message,
          sender_profile: senderProfile,
          receiver_profile: receiverProfile,
        };
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 300)); // 딜레이 시뮬레이션
    return messagesWithProfiles.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  // 프로덕션 모드: 실제 Supabase API 호출
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
  if (isDevelopmentMode) {
    // 개발 모드: mock 데이터 업데이트
    const messageIndex = DEV_MESSAGES.findIndex((m) => m.id === messageId);
    if (messageIndex !== -1) {
      DEV_MESSAGES[messageIndex].print_status = status;
      DEV_MESSAGES[messageIndex].updated_at = new Date().toISOString();
      if (status === "completed") {
        DEV_MESSAGES[messageIndex].printed_at = new Date().toISOString();
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 200)); // 딜레이 시뮬레이션
    return;
  }

  // 프로덕션 모드: 실제 Supabase API 호출
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
    console.error("메시지 상태 업데이트 실패:", error);
    throw new Error("메시지 상태 업데이트에 실패했습니다.");
  }
}
