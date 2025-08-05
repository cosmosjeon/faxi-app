import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMessagesList,
  sendMessage,
  updateMessagePrintStatus,
} from "@/features/messages/api";
import type {
  MessageWithProfiles,
  SendMessageRequest,
  MessagePrintStatus,
} from "@/features/messages/types";
import { useAuthStore } from "@/stores/auth.store";

/**
 * 메시지 목록 조회 쿼리
 */
export function useMessagesQuery(userId: string | undefined) {
  return useQuery({
    queryKey: ["messages", userId],
    queryFn: () => getMessagesList(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5분으로 증가 (탭 전환 시 즉시 표시)
    gcTime: 10 * 60 * 1000, // 10분간 캐시 유지
    refetchOnWindowFocus: false,
    refetchInterval: 60 * 1000, // 1분마다 자동 갱신
    // 캐시된 데이터가 있으면 즉시 표시
    placeholderData: (previousData) => previousData,
  });
}

/**
 * 메시지 전송 뮤테이션
 */
export function useSendMessageMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (data: SendMessageRequest) => {
      if (!user?.id) {
        throw new Error("사용자 인증이 필요합니다.");
      }
      return sendMessage(data, user.id);
    },
    onSuccess: (newMessage, variables) => {
      // 낙관적 업데이트: 즉시 UI에 반영
      queryClient.setQueryData(
        ["messages", variables.receiver_id],
        (oldData: MessageWithProfiles[] | undefined) => {
          if (!oldData) return [newMessage];
          return [newMessage, ...oldData];
        }
      );

      // 관련 쿼리들 무효화하여 최신 데이터로 갱신
      queryClient.invalidateQueries({
        queryKey: ["messages"],
      });
    },
    onError: (error) => {
      console.error("메시지 전송 실패:", error);
    },
  });
}

/**
 * 메시지 프린트 상태 업데이트 뮤테이션
 */
export function useUpdateMessagePrintStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      messageId,
      status,
    }: {
      messageId: string;
      status: MessagePrintStatus;
    }) => updateMessagePrintStatus(messageId, status),
    onSuccess: (_, variables) => {
      // 메시지 목록에서 해당 메시지 상태 업데이트
      queryClient.setQueriesData(
        { queryKey: ["messages"] },
        (oldData: MessageWithProfiles[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.map((message) =>
            message.id === variables.messageId
              ? { ...message, print_status: variables.status }
              : message
          );
        }
      );
    },
  });
}
