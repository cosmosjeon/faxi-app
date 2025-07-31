"use client";

import { useState, useEffect } from "react";
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
import { updateMessagePrintStatus } from "@/features/messages/api";
import { isCloseFriend } from "@/features/friends/api";
import type { MessageWithProfiles } from "@/features/messages/types";
import { supabase } from "@/lib/supabase/client";
import { useBlePrinter } from "@/hooks/useBlePrinter";
import { toast } from "@/hooks/use-toast";
import { CardLoading } from "@/components/ui/page-loading";
import { messageToasts } from "@/lib/toasts";
import {
  useMessagesQuery,
  useUpdateMessagePrintStatusMutation,
} from "@/hooks/queries/useMessagesQuery";
import { usePrefetchData } from "@/hooks/usePrefetchData";
import { MessageListSkeleton } from "@/components/ui/message-skeleton";
import { MessageCard } from "@/components/domain/messages/MessageCard";
import { useQueryClient } from "@tanstack/react-query";

export default function HomePage() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();
  const printer = useBlePrinter();
  const queryClient = useQueryClient();

  // React Query를 사용한 메시지 데이터 관리
  const {
    data: allMessages = [],
    isLoading,
    error: messagesError,
    refetch: refetchMessages,
  } = useMessagesQuery(profile?.id);

  // 캐시된 데이터가 있으면 로딩 상태를 숨김 (즉시 표시)
  const showLoading = isLoading && allMessages.length === 0;

  // 받은 메시지 중 대기중인 메시지만 필터링
  const messages = allMessages.filter(
    (msg) => msg.receiver_id === profile?.id && msg.print_status === "pending"
  );

  const updateMessagePrintStatusMutation =
    useUpdateMessagePrintStatusMutation();

  // 다른 페이지 데이터 미리 로드
  usePrefetchData();

  const [processingMessages, setProcessingMessages] = useState<Set<string>>(
    new Set()
  );

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
    console.log("로그아웃 버튼 클릭됨");
    try {
      console.log("signOut 함수 호출 시작");

      // React Query 캐시 모두 클리어
      queryClient.clear();
      console.log("React Query 캐시 클리어 완료");

      await signOut();
      console.log("signOut 함수 호출 완료");
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

  // 에러 처리
  if (messagesError) {
    toast({
      title: "로드 실패",
      description: "메시지 목록을 불러오는데 실패했습니다.",
      variant: "destructive",
    });
  }

  // 새 메시지 처리 (자동 프린트 vs 확인 팝업)
  const handleNewMessage = async (newMessage: MessageWithProfiles) => {
    console.log("🔔 새 메시지 수신:", newMessage);

    // React Query로 메시지 목록 갱신
    refetchMessages();

    try {
      // 친한 친구인지 확인
      const isCloseFriendStatus = await isCloseFriend(
        profile!.id,
        newMessage.sender_id
      );

      if (isCloseFriendStatus) {
        // 친한 친구: 자동 프린트
        console.log("💖 친한 친구의 메시지 - 자동 프린트 실행");
        await handleMessageAction(newMessage.id, "approve", true);

        toast({
          title: "친한 친구의 메시지",
          description: `${newMessage.sender_profile.display_name}님의 메시지가 자동으로 프린트됩니다.`,
        });
      } else {
        // 일반 친구: 확인 팝업
        console.log("👥 일반 친구의 메시지 - 확인 팝업 표시");
        setConfirmDialog({
          isOpen: true,
          message: newMessage,
        });

        // 알림음 또는 진동 (추후 구현)
        toast({
          title: "새 메시지 도착",
          description: `${newMessage.sender_profile.display_name}님이 메시지를 보냈습니다.`,
        });
      }
    } catch (error) {
      console.error("새 메시지 처리 실패:", error);
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

          // React Query 캐시 갱신으로 새 메시지 처리
          try {
            // 메시지 목록 즉시 갱신
            await refetchMessages();

            // 새 메시지 처리 로직 실행
            const newMessage = allMessages.find(
              (msg) => msg.id === payload.new.id
            );

            if (newMessage) {
              await handleNewMessage(newMessage);
            }
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
    setProcessingMessages((prev) => new Set(prev).add(messageId));

    try {
      const status = action === "approve" ? "approved" : "failed";
      await updateMessagePrintStatus(messageId, status);

      // 로컬 상태에서 해당 메시지 제거 (처리 완료된 메시지는 더 이상 표시하지 않음)
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));

      if (action === "approve") {
        // 프린트 승인 시 실제 프린터로 전송
        const message = messages.find((msg) => msg.id === messageId);
        if (message) {
          try {
            await printer.printMessage({
              text: message.content || undefined,
              imageUrl: message.image_url || undefined,
              lcdTeaser: message.lcd_teaser || undefined,
              senderName: message.sender_profile.display_name,
            });

            console.log("🖨️ 메시지 프린트 작업 추가:", messageId);

            if (!isAutomatic) {
              toast({
                title: "프린트 시작",
                description: `${message.sender_profile.display_name}님의 메시지를 출력합니다.`,
              });
            }
          } catch (printError) {
            console.error("프린트 작업 추가 실패:", printError);

            // 프린터 연결 실패 시 상태를 다시 pending으로 되돌리기
            try {
              await updateMessagePrintStatus(messageId, "pending");

              // 해당 메시지를 다시 목록에 추가 (pending 상태로)
              const failedMessage = messages.find(
                (msg) => msg.id === messageId
              );
              if (failedMessage) {
                setMessages((prev) => [
                  { ...failedMessage, print_status: "pending" },
                  ...prev,
                ]);
              }
            } catch (statusError) {
              console.error("메시지 상태 되돌리기 실패:", statusError);
            }

            // 프린터 연결이 안 된 경우에도 UI 피드백 제공
            if (!isAutomatic) {
              toast({
                title: "프린터 확인 필요",
                description: "프린터를 연결한 후 다시 시도해주세요.",
                variant: "destructive",
              });
            }
          }
        }
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

  // React Query가 자동으로 데이터를 로드하므로 useEffect 제거

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

  // 대기중인 메시지 개수
  const pendingCount = messages.filter(
    (msg) => msg.print_status === "pending"
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
            {showLoading ? (
              <MessageListSkeleton />
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
                      handleMessageAction(messageId, "accept")
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
