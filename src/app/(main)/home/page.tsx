"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  UserPlus,
  Send,
  Clock,
  Check,
  X,
  Image as ImageIcon,
  Printer,
  Bell,
  LogOut,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuthStore } from "@/stores/auth.store";
import {
  getMessagesList,
  updateMessagePrintStatus,
  getQueuedMessages,
} from "@/features/messages/api";
import { areCloseFriends } from "@/features/friends/api";
import type { MessageWithProfiles } from "@/features/messages/types";
import { supabase } from "@/lib/supabase/client";
import { useBlePrinter } from "@/hooks/useBlePrinter";
import { toast } from "@/hooks/use-toast";
import { CardLoading } from "@/components/ui/page-loading";
import { messageToasts } from "@/lib/toasts";
import { useRealtimeDataSync } from "@/hooks/useRealtimeDataSync";
import { MessageCard } from "@/components/domain/messages/MessageCard";
export default function HomePage() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();
  const printer = useBlePrinter();

  // 프린터 상태 실시간 모니터링 (디버깅용)
  useEffect(() => {
    console.log("🔄 프린터 상태 변화 감지:", {
      status: printer.status,
      isConnected: printer.isConnected,
      connectedPrinter: printer.connectedPrinter,
      timestamp: new Date().toLocaleTimeString(),
    });
  }, [printer.status, printer.isConnected, printer.connectedPrinter]);
  const [messages, setMessages] = useState<MessageWithProfiles[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingMessages, setProcessingMessages] = useState<Set<string>>(
    new Set()
  );

  // 무한 프린트 반복 방지를 위한 플래그
  const [hasHandledQueuedMessages, setHasHandledQueuedMessages] =
    useState(false);

  // 확인 팝업 관련 상태
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: MessageWithProfiles | null;
  }>({
    isOpen: false,
    message: null,
  });

  // 로그아웃 핸들러
  const handleLogout = async () => {
    try {
      await signOut();
      router.push("/login");
      toast({
        title: "로그아웃 완료",
        description: "성공적으로 로그아웃되었습니다.",
      });
    } catch (error) {
      console.error("로그아웃 실패:", error);
      toast({
        title: "로그아웃 실패",
        description: "로그아웃 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 메시지 목록 로드
  // 📡 실시간 메시지 동기화 (백그라운드에서 자동 새로고침)
  useRealtimeDataSync({
    onDataUpdate: async () => {
      if (!profile) return;
      console.log("🔄 실시간 메시지 동기화 트리거됨");

      try {
        const messagesList = await getMessagesList(profile.id);
        const pendingReceivedMessages = messagesList.filter(
          (msg) =>
            msg.receiver_id === profile.id &&
            (msg.print_status === "pending" || msg.print_status === "queued")
        );
        setMessages(pendingReceivedMessages);
      } catch (error) {
        console.error("실시간 메시지 동기화 실패:", error);
      }
    },
    syncTypes: ["messages"],
    enabled: !!profile,
  });

  const loadMessages = useCallback(async () => {
    if (!profile) return;

    setIsLoading(true);
    try {
      const messagesList = await getMessagesList(profile.id);

      console.log("📋 전체 메시지 목록 로드:", {
        total_count: messagesList.length,
        by_status: {
          pending: messagesList.filter((m) => m.print_status === "pending")
            .length,
          approved: messagesList.filter((m) => m.print_status === "approved")
            .length,
          queued: messagesList.filter((m) => m.print_status === "queued")
            .length,
          completed: messagesList.filter((m) => m.print_status === "completed")
            .length,
          failed: messagesList.filter((m) => m.print_status === "failed")
            .length,
        },
      });

      // 받은 메시지 상세 정보 (더 상세하게)
      const receivedMessages = messagesList.filter(
        (m) => m.receiver_id === profile.id
      );
      console.log("📨 받은 메시지 상세 정보:", {
        count: receivedMessages.length,
        messages: receivedMessages.map((m) => ({
          id: m.id,
          sender: m.sender_profile.display_name,
          print_status: m.print_status,
          created_at: m.created_at,
        })),
      });

      // 받은 메시지 중 대기중인 메시지만 필터링 (pending + queued)
      const pendingReceivedMessages = messagesList.filter(
        (msg) =>
          msg.receiver_id === profile.id &&
          (msg.print_status === "pending" || msg.print_status === "queued")
      );

      console.log("📋 UI에 표시할 메시지:", {
        count: pendingReceivedMessages.length,
        messages: pendingReceivedMessages.map((m) => ({
          id: m.id,
          sender: m.sender_profile.display_name,
          print_status: m.print_status,
        })),
      });

      setMessages(pendingReceivedMessages);

      // 프린터가 연결되지 않은 상태에서 approved 메시지들을 queued로 변경
      if (printer.status !== "connected") {
        const approvedMessages = receivedMessages.filter(
          (msg) => msg.print_status === "approved"
        );

        console.log("🔍 approved 메시지 검사:", {
          printer_status: printer.status,
          approved_count: approvedMessages.length,
          approved_messages: approvedMessages.map((m) => ({
            id: m.id,
            sender: m.sender_profile.display_name,
            print_status: m.print_status,
          })),
        });

        if (approvedMessages.length > 0) {
          console.log(
            `🔄 ${approvedMessages.length}개의 approved 메시지를 queued로 변경 시작`
          );

          // 모든 approved 메시지를 순차적으로 처리
          for (const msg of approvedMessages) {
            try {
              console.log(
                `🔄 처리 중: ${msg.id} (${msg.sender_profile.display_name})`
              );
              await updateMessagePrintStatus(msg.id, "queued");
              console.log(`✅ DB 업데이트 완료: ${msg.id} (approved → queued)`);

              // UI에서도 상태 업데이트
              setMessages((prev) => {
                const existingIndex = prev.findIndex((m) => m.id === msg.id);
                const updatedMsg = { ...msg, print_status: "queued" as const };

                if (existingIndex >= 0) {
                  const newMessages = [...prev];
                  newMessages[existingIndex] = updatedMsg;
                  return newMessages;
                } else {
                  return [...prev, updatedMsg];
                }
              });

              console.log(`✅ UI 업데이트 완료: ${msg.id}`);
            } catch (error) {
              console.error(`❌ 메시지 상태 변경 실패: ${msg.id}`, error);
            }
          }

          console.log("🎯 모든 approved → queued 변경 완료");
        } else {
          // approved 메시지가 없다면 pending 메시지 중 친한친구 메시지 확인
          console.log(
            "🤔 approved 메시지가 없음 - pending 메시지 중 친한친구 확인"
          );
          const pendingMessages = receivedMessages.filter(
            (msg) => msg.print_status === "pending"
          );

          console.log("📋 pending 메시지 확인:", {
            pending_count: pendingMessages.length,
            pending_messages: pendingMessages.map((m) => ({
              id: m.id,
              sender: m.sender_profile.display_name,
              print_status: m.print_status,
            })),
          });

          if (pendingMessages.length > 0) {
            console.log("🔍 pending 메시지들의 친한친구 관계 확인 시작");

            for (const msg of pendingMessages) {
              try {
                console.log(
                  `🔄 친한친구 관계 확인: ${msg.sender_profile.display_name} (${msg.id})`
                );
                const isCloseFriend = await areCloseFriends(
                  profile.id,
                  msg.sender_id
                );

                console.log(
                  `📊 친한친구 확인 결과: ${msg.sender_profile.display_name} = ${isCloseFriend}`
                );

                if (isCloseFriend) {
                  console.log(
                    `💖 친한친구 발견! ${msg.sender_profile.display_name} 메시지를 queued로 변경`
                  );

                  // 친한친구 메시지를 queued로 변경
                  await updateMessagePrintStatus(msg.id, "queued");
                  console.log(
                    `✅ DB 업데이트 완료: ${msg.id} (pending → queued)`
                  );

                  // UI 업데이트
                  setMessages((prev) => {
                    const existingIndex = prev.findIndex(
                      (m) => m.id === msg.id
                    );
                    const updatedMsg = {
                      ...msg,
                      print_status: "queued" as const,
                    };

                    if (existingIndex >= 0) {
                      const newMessages = [...prev];
                      newMessages[existingIndex] = updatedMsg;
                      return newMessages;
                    } else {
                      return [...prev, updatedMsg];
                    }
                  });

                  console.log(`✅ UI 업데이트 완료: ${msg.id}`);
                }
              } catch (error) {
                console.error(`❌ 친한친구 확인 실패: ${msg.id}`, error);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("메시지 목록 로드 실패:", error);
      toast({
        title: "로드 실패",
        description: "메시지 목록을 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [profile, printer.status]);

  // 친한친구 메시지 처리 함수
  const handleCloseFriendMessage = async (message: MessageWithProfiles) => {
    console.log("💖 친한친구 메시지 처리 시작:", {
      message_id: message.id,
      sender: message.sender_profile.display_name,
      printer_status: printer.status,
      current_print_status: message.print_status,
    });

    if (printer.status === "connected") {
      // 프린터 연결됨: 바로 프린트
      console.log("🖨️ 프린터 연결됨 - 즉시 프린트 실행");
      await handleMessageAction(message.id, "approve", true);
      toast({
        title: "친한 친구의 메시지",
        description: `${message.sender_profile.display_name}님의 메시지가 자동으로 프린트됩니다.`,
      });
    } else {
      // 프린터 연결 안됨: 대기 상태로 설정
      console.log("⏳ 프린터 미연결 - 메시지를 대기열에 추가");

      try {
        await updateMessagePrintStatus(message.id, "queued");
        console.log("✅ DB에 queued 상태 저장 완료:", message.id);

        // UI에서도 상태 업데이트
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === message.id
              ? { ...msg, print_status: "queued" as const }
              : msg
          )
        );
        console.log("✅ UI 상태 업데이트 완료:", message.id);

        toast({
          title: "친한 친구의 메시지 대기 중",
          description: `${message.sender_profile.display_name}님의 메시지가 프린터 연결을 기다립니다.`,
        });
      } catch (error) {
        console.error("❌ 메시지 queued 상태 저장 실패:", error);
      }
    }
  };

  // 새 메시지 처리 (자동 프린트 vs 확인 팝업)
  const handleNewMessage = async (newMessage: MessageWithProfiles) => {
    console.log("🔔 새 메시지 수신 - 상세 정보:", {
      id: newMessage.id,
      sender: newMessage.sender_profile.display_name,
      sender_id: newMessage.sender_id,
      receiver_id: newMessage.receiver_id,
      print_status: newMessage.print_status,
      printer_connected: printer.status === "connected",
      full_message: newMessage,
    });

    // 친한친구 관계 직접 확인 (DB 트리거 디버깅용)
    try {
      const isCloseFriend = await areCloseFriends(
        profile!.id,
        newMessage.sender_id
      );
      console.log("🔍 친한친구 관계 확인:", {
        receiver_id: profile!.id,
        sender_id: newMessage.sender_id,
        is_close_friend: isCloseFriend,
        message_print_status: newMessage.print_status,
      });
    } catch (error) {
      console.error("❌ 친한친구 관계 확인 실패:", error);
    }

    try {
      // 1차: DB 트리거에서 이미 친한친구 확인을 완료함
      // print_status가 'approved'면 친한친구 메시지임
      if (newMessage.print_status === "approved") {
        console.log("💖 친한 친구의 메시지 (DB 트리거에서 자동 승인됨)");
        await handleCloseFriendMessage(newMessage);
      } else {
        // 2차: DB 트리거가 작동하지 않은 경우 클라이언트에서 확인
        console.log("🔄 DB 트리거 미작동 - 클라이언트에서 친한친구 확인");
        const isCloseFriend = await areCloseFriends(
          profile!.id,
          newMessage.sender_id
        );

        if (isCloseFriend) {
          console.log("💖 친한 친구 확인됨 - 클라이언트에서 처리");
          // 메시지 상태를 approved로 업데이트
          await updateMessagePrintStatus(newMessage.id, "approved");

          // UI에서도 상태 업데이트
          const updatedMessage = {
            ...newMessage,
            print_status: "approved" as const,
          };
          setMessages((prev) =>
            prev.map((msg) => (msg.id === newMessage.id ? updatedMessage : msg))
          );

          await handleCloseFriendMessage(updatedMessage);
        } else {
          // 일반 친구: 확인 팝업 (print_status = 'pending')
          console.log("👥 일반 친구의 메시지 - 확인 팝업 표시");
          setConfirmDialog({
            isOpen: true,
            message: newMessage,
          });

          toast({
            title: "새 메시지 도착",
            description: `${newMessage.sender_profile.display_name}님이 메시지를 보냈습니다.`,
          });
        }
      }
    } catch (error) {
      console.error("❌ 새 메시지 처리 실패:", error);
      // 오류 발생 시 일반 친구로 처리
      setConfirmDialog({
        isOpen: true,
        message: newMessage,
      });
    }
  };

  // Supabase Realtime 구독
  useEffect(() => {
    if (!profile) return; // 개발 모드에서는 Realtime 구독 안 함

    console.log("🔄 Supabase Realtime 구독 시작");

    const channel = supabase
      .channel("public:messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${profile.id}`,
        },
        async (payload) => {
          console.log("📨 Realtime 새 메시지:", payload);

          // 새 메시지 처리
          try {
            // 메시지 목록 다시 로드
            await loadMessages();

            // payload에서 새 메시지 정보 추출하여 처리
            console.log("새 메시지 처리:", payload.new);
          } catch (error) {
            console.error("Realtime 메시지 처리 실패:", error);
          }
        }
      )
      .subscribe();

    return () => {
      console.log("🔄 Supabase Realtime 구독 해제");
      supabase.removeChannel(channel);
    };
  }, [profile]);

  // 메시지 승인/거절 핸들러
  const handleMessageAction = async (
    messageId: string,
    action: "approve" | "reject",
    isAutomatic: boolean = false
  ) => {
    // 중복 처리 방지 - 이미 처리 중인 메시지는 무시
    if (processingMessages.has(messageId)) {
      console.log("⚠️ 메시지 중복 처리 방지:", messageId);
      return;
    }

    // 처리할 메시지 찾기
    const messageToProcess = messages.find((msg) => msg.id === messageId);
    if (!messageToProcess) {
      console.log("⚠️ 처리할 메시지를 찾을 수 없음:", messageId);
      return;
    }

    // 이미 처리된 메시지는 다시 처리하지 않음
    if (
      messageToProcess.print_status !== "pending" &&
      messageToProcess.print_status !== "queued"
    ) {
      console.log("⚠️ 이미 처리된 메시지:", {
        messageId,
        currentStatus: messageToProcess.print_status,
      });
      return;
    }

    setProcessingMessages((prev) => new Set(prev).add(messageId));

    try {
      const status = action === "approve" ? "completed" : "failed";
      console.log(`🔄 메시지 처리 시작: ${messageId} (${action} → ${status})`);

      if (action === "approve") {
        // 프린터 연결 상태 확인
        if (printer.status !== "connected") {
          console.log("❌ 프린터가 연결되지 않음 - 프린트 불가:", {
            messageId,
            printerStatus: printer.status,
          });

          toast({
            title: "프린터 연결 필요",
            description: "프린터를 연결한 후 다시 시도해주세요.",
            variant: "destructive",
          });
          return;
        }
      }

      // DB 상태 업데이트
      await updateMessagePrintStatus(messageId, status);

      if (action === "approve") {
        // 프린트 승인 시 실제 프린터로 전송
        try {
          await printer.printMessage({
            text: messageToProcess.content || undefined,
            imageUrl: messageToProcess.image_url || undefined,
            lcdTeaser: messageToProcess.lcd_teaser || undefined,
            senderName: messageToProcess.sender_profile.display_name,
          });

          console.log("🖨️ 메시지 프린트 작업 완료:", messageId);

          // 프린트 성공 후 UI에서 메시지 제거
          setMessages((prev) => prev.filter((msg) => msg.id !== messageId));

          if (!isAutomatic) {
            toast({
              title: "프린트 시작",
              description: `${messageToProcess.sender_profile.display_name}님의 메시지를 출력합니다.`,
            });
          }
        } catch (printError) {
          console.error("프린트 작업 실패:", printError);

          // 프린트 실패 시 상태를 다시 pending으로 되돌리기
          try {
            await updateMessagePrintStatus(messageId, "pending");

            // 메시지를 다시 UI에 표시 (pending 상태로)
            setMessages((prev) => [
              { ...messageToProcess, print_status: "pending" },
              ...prev.filter((msg) => msg.id !== messageId),
            ]);
          } catch (revertError) {
            console.error("메시지 상태 되돌리기 실패:", revertError);
          }

          if (!isAutomatic) {
            toast({
              title: "프린트 실패",
              description: "프린트 중 오류가 발생했습니다. 다시 시도해주세요.",
              variant: "destructive",
            });
          }

          // 프린트 실패 시 함수 종료
          return;
        }
      } else {
        // 거절의 경우 UI에서 메시지 제거
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      }

      if (!isAutomatic) {
        toast({
          title: action === "approve" ? "메시지 승인됨" : "메시지 거절됨",
          description:
            action === "approve"
              ? "메시지가 프린트 대기열에 추가되었습니다."
              : "메시지가 삭제되었습니다.",
        });
      }
    } catch (error) {
      console.error("메시지 처리 실패:", error);
      toast({
        title: "처리 실패",
        description: "메시지 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setProcessingMessages((prev) => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
    }
  };

  // 확인 팝업 승인
  const handleConfirmPrint = async () => {
    if (confirmDialog.message) {
      await handleMessageAction(confirmDialog.message.id, "approve");
    }
    setConfirmDialog({ isOpen: false, message: null });
  };

  // 확인 팝업 거절
  const handleConfirmReject = async () => {
    if (confirmDialog.message) {
      await handleMessageAction(confirmDialog.message.id, "reject");
    }
    setConfirmDialog({ isOpen: false, message: null });
  };
  // 대기 중인 메시지 확인 함수 - 더 상세한 디버깅
  const checkQueuedMessages = useCallback(async () => {
    if (!profile) return;

    try {
      console.log("📋 대기 중인 메시지 확인 시작");

      // 1단계: 일반 메시지 목록 다시 조회해서 현재 상태 확인
      console.log("🔄 현재 DB 상태 재확인을 위해 메시지 목록 다시 조회");
      const currentMessages = await getMessagesList(profile.id);
      const currentReceivedMessages = currentMessages.filter(
        (m) => m.receiver_id === profile.id
      );

      console.log("📊 현재 DB 상태:", {
        total_messages: currentMessages.length,
        received_messages: currentReceivedMessages.length,
        by_status: {
          pending: currentReceivedMessages.filter(
            (m) => m.print_status === "pending"
          ).length,
          approved: currentReceivedMessages.filter(
            (m) => m.print_status === "approved"
          ).length,
          queued: currentReceivedMessages.filter(
            (m) => m.print_status === "queued"
          ).length,
          completed: currentReceivedMessages.filter(
            (m) => m.print_status === "completed"
          ).length,
          failed: currentReceivedMessages.filter(
            (m) => m.print_status === "failed"
          ).length,
        },
        detailed_messages: currentReceivedMessages.map((m) => ({
          id: m.id,
          sender: m.sender_profile.display_name,
          print_status: m.print_status,
          created_at: m.created_at,
        })),
      });

      // 2단계: getQueuedMessages RPC 함수 호출
      const queuedMessages = await getQueuedMessages(profile.id);

      console.log("📊 RPC로 조회한 대기 중인 메시지:", {
        count: queuedMessages.length,
        messages: queuedMessages.map((msg) => ({
          id: msg.id,
          sender: msg.sender_display_name,
          print_status: msg.print_status,
        })),
      });

      if (queuedMessages.length > 0) {
        console.log(
          `📨 ${queuedMessages.length}개의 대기 중인 친한친구 메시지 발견`
        );
        toast({
          title: "대기 중인 메시지",
          description: `${queuedMessages.length}개의 친한친구 메시지가 프린터 연결을 기다리고 있습니다.`,
        });
      } else {
        console.log("🤔 RPC에서 0개 반환 - DB 상태와 비교 분석 필요");
      }
    } catch (error) {
      console.error("❌ 대기 중인 메시지 조회 실패:", error);
    }
  }, [profile]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // 별도 useEffect로 대기 메시지 확인 (loadMessages 완료 후)
  useEffect(() => {
    if (profile) {
      // approved → queued 변경이 완료될 시간을 주기 위해 약간 지연
      const timer = setTimeout(() => {
        checkQueuedMessages();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [profile, checkQueuedMessages]);

  // 프린터 연결 상태 변화 감지하여 대기 중인 메시지 자동 처리
  const handlePrinterConnection = useCallback(async () => {
    console.log("🔄 프린터 연결 처리 함수 실행:", {
      profile: !!profile,
      profile_id: profile?.id,
      printer_status: printer.status,
      hasHandledQueuedMessages,
      timestamp: new Date().toLocaleTimeString(),
    });

    if (
      !profile ||
      printer.status !== "connected" ||
      hasHandledQueuedMessages
    ) {
      console.log("🔍 프린터 연결 확인 - 조건 불만족:", {
        profile: !!profile,
        printer_status: printer.status,
        hasHandledQueuedMessages,
      });
      return;
    }

    try {
      console.log("🖨️ 프린터 연결됨 - 대기 중인 메시지 확인");

      // 현재 메시지 목록에서 queued 상태 확인
      const currentQueuedMessages = messages.filter(
        (msg) => msg.print_status === "queued"
      );
      console.log("📋 현재 UI에서 queued 상태 메시지:", {
        count: currentQueuedMessages.length,
        messages: currentQueuedMessages.map((msg) => ({
          id: msg.id,
          sender: msg.sender_profile.display_name,
          print_status: msg.print_status,
        })),
      });

      const queuedMessages = await getQueuedMessages(profile.id);

      console.log("📊 DB에서 조회한 대기 중인 메시지:", {
        count: queuedMessages.length,
        messages: queuedMessages.map((msg) => ({
          id: msg.id,
          sender: msg.sender_display_name,
          print_status: msg.print_status,
        })),
      });

      if (queuedMessages.length > 0) {
        toast({
          title: "대기 중인 메시지 처리",
          description: `${queuedMessages.length}개의 친한친구 메시지를 자동으로 프린트합니다.`,
        });

        // 대기 중인 메시지들을 순차적으로 처리
        for (const queuedMessage of queuedMessages) {
          try {
            console.log(
              `🔄 대기 메시지 프린트 시작: ${queuedMessage.id} (${queuedMessage.sender_display_name})`
            );
            await handleMessageAction(queuedMessage.id, "approve", true);
            console.log(`✅ 대기 메시지 프린트 완료: ${queuedMessage.id}`);

            // UI에서 메시지 상태 업데이트
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === queuedMessage.id
                  ? { ...msg, print_status: "completed" as const }
                  : msg
              )
            );
          } catch (error) {
            console.error(
              `❌ 대기 메시지 프린트 실패: ${queuedMessage.id}`,
              error
            );
          }
        }
      } else {
        console.log("📝 대기 중인 메시지 없음");
      }

      // ✅ 중복 실행 방지를 위한 플래그 설정
      setHasHandledQueuedMessages(true);
      console.log("🔒 대기열 처리 완료 - 중복 실행 방지 플래그 설정됨");
    } catch (error) {
      console.error("대기 중인 메시지 처리 실패:", error);
    }
  }, [profile, printer.status, hasHandledQueuedMessages, messages]);

  useEffect(() => {
    // 프린터 상태가 "connected"로 변경될 때만 실행
    if (printer.status === "connected") {
      console.log("⚡ 프린터 연결됨 - useEffect 트리거");
      handlePrinterConnection();
    } else {
      // 프린터가 끊기면 플래그 초기화
      if (hasHandledQueuedMessages) {
        console.log("🔓 프린터 연결 해제 - 중복 실행 방지 플래그 초기화");
        setHasHandledQueuedMessages(false);
      }
    }
  }, [printer.status, handlePrinterConnection, hasHandledQueuedMessages]);

  // 메시지 시간 포맷
  const formatMessageTime = (createdAt: string) => {
    const now = new Date();
    const messageTime = new Date(createdAt);
    const diffInMinutes = Math.floor(
      (now.getTime() - messageTime.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return "방금 전";
    if (diffInMinutes < 60) return `${diffInMinutes}분 전`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}시간 전`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}일 전`;

    return messageTime.toLocaleDateString();
  };

  // 상태별 뱃지
  const getStatusBadge = (status: MessageWithProfiles["print_status"]) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock size={12} />
            대기중
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="default" className="gap-1">
            <Printer size={12} />
            프린트 준비
          </Badge>
        );
      case "queued":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-blue-200 text-blue-700 bg-blue-50"
          >
            <Clock size={12} />
            프린터 대기
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="gap-1">
            <Check size={12} />
            완료
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <X size={12} />
            거절됨
          </Badge>
        );
      default:
        return null;
    }
  };

  // 대기중인 메시지 개수 (pending + queued)
  const pendingCount = messages.filter(
    (msg) => msg.print_status === "pending" || msg.print_status === "queued"
  ).length;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* 헤더 */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                안녕하세요, {profile?.display_name || "사용자"}님! 👋
              </h1>
              <p className="text-gray-600 mt-1">
                {pendingCount > 0
                  ? `${pendingCount}개의 새로운 메시지가 있습니다`
                  : "새로운 메시지를 확인해보세요"}
              </p>
            </div>
            {profile && (
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="text-red-600 hover:text-red-700"
              >
                <LogOut size={18} />
                로그아웃
              </Button>
            )}
          </div>

          {/* 프린터 상태 표시 */}
          <div className="mt-3 flex items-center gap-2 text-sm">
            {printer.isConnected ? (
              <div className="flex items-center gap-1 text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>프린터 연결됨</span>
                {printer.connectedPrinter && (
                  <span className="text-gray-500">
                    ({printer.connectedPrinter.name})
                  </span>
                )}
              </div>
            ) : printer.isConnecting ? (
              <div className="flex items-center gap-1 text-blue-600">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span>프린터 연결 중...</span>
              </div>
            ) : printer.hasError ? (
              <div className="flex items-center gap-1 text-red-600">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>프린터 연결 오류</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-gray-500">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span>프린터 연결 안됨</span>
              </div>
            )}

            {printer.isPrinting && (
              <div className="flex items-center gap-1 text-blue-600 ml-2">
                <Printer size={12} className="animate-pulse" />
                <span>프린트 중</span>
              </div>
            )}
          </div>
        </div>

        {/* 받은 메시지 피드 */}
        <Card>
          <CardHeader>
            <CardTitle>받은 메시지</CardTitle>
            <CardDescription>
              친구들이 보낸 메시지들을 확인하고 출력해보세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <CardLoading message="메시지를 불러오는 중..." />
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-4">📨</div>
                <p>아직 받은 메시지가 없습니다</p>
                <p className="text-sm mt-2">
                  친구를 추가하고 메시지를 받아보세요!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <MessageCard
                    key={message.id}
                    message={message}
                    isProcessing={processingMessages.has(message.id)}
                    onAccept={(messageId) =>
                      handleMessageAction(messageId, "approve")
                    }
                    onReject={(messageId) =>
                      handleMessageAction(messageId, "reject")
                    }
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 퀵 액션 */}
        <div className="grid grid-cols-2 gap-4">
          <Link href="/friends/add">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <UserPlus size={24} className="mx-auto mb-2 text-blue-600" />
                <p className="font-medium">친구 추가</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/compose">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <Send size={24} className="mx-auto mb-2 text-green-600" />
                <p className="font-medium">메시지 보내기</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* 메시지 확인 팝업 (일반 친구용) */}
      <AlertDialog
        open={confirmDialog.isOpen}
        onOpenChange={(open) =>
          !open && setConfirmDialog({ isOpen: false, message: null })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Bell size={20} />새 메시지 도착
            </AlertDialogTitle>
          </AlertDialogHeader>

          {/* AlertDialogDescription 대신 div 사용 */}
          <div className="space-y-3 py-4">
            {confirmDialog.message && (
              <>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={
                        confirmDialog.message.sender_profile.avatar_url || ""
                      }
                      alt={confirmDialog.message.sender_profile.display_name}
                    />
                    <AvatarFallback className="text-xs">
                      {confirmDialog.message.sender_profile.display_name[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm">
                    {confirmDialog.message.sender_profile.display_name}님이
                    메시지를 보냈습니다.
                  </span>
                </div>

                {confirmDialog.message.lcd_teaser && (
                  <div className="bg-gray-900 text-green-400 font-mono text-sm p-2 rounded text-center">
                    "{confirmDialog.message.lcd_teaser}"
                  </div>
                )}

                <div className="text-sm text-gray-600">
                  이 메시지를 프린트하시겠습니까?
                </div>
              </>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleConfirmReject}>
              거절
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPrint}>
              프린트
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
