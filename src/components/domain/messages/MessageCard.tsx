"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Check, X, Image as ImageIcon } from "lucide-react";
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
import type { MessageWithProfiles, MessagePreview } from "@/features/messages/types";

type MessageCardProps =
  | {
      variant: "preview";
      message: MessagePreview;
      isProcessing: boolean;
      onAccept: (messageId: string) => void;
      onReject: (messageId: string) => void;
    }
  | {
      variant?: "full";
      message: MessageWithProfiles;
      isProcessing: boolean;
      onAccept: (messageId: string) => void;
      onReject: (messageId: string) => void;
    };

/**
 * 최적화된 메시지 카드 컴포넌트
 */
export const MessageCard = React.memo(function MessageCard(
  props: MessageCardProps
) {
  const variant = props.variant ?? "full";
  // 시간 포맷팅 메모이제이션
  const formattedTime = useMemo(() => {
    const message = props.message as any;
    const now = new Date();
    const messageTime = new Date(message.created_at);
    const diffInHours =
      (now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return formatDistanceToNow(messageTime, {
        addSuffix: true,
        locale: ko,
      });
    } else {
      return messageTime.toLocaleString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }, [props.message]);

  // 발신자 이름 메모이제이션
  const senderName = useMemo(() => {
    const profile = (props.message as any)?.sender_profile;
    return profile?.display_name || "알 수 없는 사용자";
  }, [props.message]);

  // 아바타 이미지 URL 메모이제이션
  const avatarUrl = useMemo(() => {
    const profile = (props.message as any)?.sender_profile;
    return profile?.avatar_url || "";
  }, [props.message]);

  // preview 모드: LCD 티저만 노출, 본문/이미지 완전 비노출
  if (variant === "preview") {
    const { message, isProcessing, onAccept, onReject } = props;
    const senderNamePreview =
      (message as any)?.sender_profile?.display_name || "알 수 없는 사용자";
    const avatarUrlPreview = (message as any)?.sender_profile?.avatar_url || "";
    return (
      <Card className="w-full transition-shadow hover:shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={avatarUrlPreview} alt={senderNamePreview} />
                <AvatarFallback className="bg-blue-100 text-blue-600">
                  {senderNamePreview.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-sm font-medium text-gray-900">
                  {senderNamePreview}
                </CardTitle>
                <CardDescription className="text-xs text-gray-500" aria-label="메시지 미리보기">
                  LCD 티저 미리보기
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">
              {message.lcd_teaser || "새 메시지"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-gray-900 text-green-400 font-mono text-sm p-2 rounded text-center">
            &quot;{message.lcd_teaser || "새 메시지"}&quot;
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReject(message.id)}
              disabled={isProcessing}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X size={16} className="mr-1" />
              거절
            </Button>
            <Button
              size="sm"
              onClick={() => onAccept(message.id)}
              disabled={isProcessing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Check size={16} className="mr-1" />
              프린트
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { message, isProcessing, onAccept, onReject } = props as Extract<
    MessageCardProps,
    { variant?: "full"; message: MessageWithProfiles }
  >;
  return (
    <Card className="w-full transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={avatarUrl} alt={senderName} />
              <AvatarFallback className="bg-blue-100 text-blue-600">
                {senderName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-sm font-medium text-gray-900">
                {senderName}
              </CardTitle>
              <CardDescription className="text-xs text-gray-500">
                {formattedTime}
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            {message.lcd_teaser || "새 메시지"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* 메시지 내용 */}
        {message.content && (
          <p className="text-gray-800 leading-relaxed break-words">
            {message.content}
          </p>
        )}

        {/* 이미지 */}
        {message.image_url && (
          <div className="relative overflow-hidden rounded-lg bg-gray-100">
            <Image
              src={message.image_url}
              alt="메시지 이미지"
              width={400}
              height={300}
              className="w-full max-h-64 object-cover"
              priority={false}
              placeholder="blur"
              blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAhEQACAQQCAwEAAAAAAAAAAAABAgMABAUGITGRobHR/9oADAMBAAIRAxEAPwCdwLjU7y2CXDiXbXg=="
            />
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="text-xs">
                <ImageIcon size={12} className="mr-1" />
                이미지
              </Badge>
            </div>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex justify-end space-x-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onReject(message.id)}
            disabled={isProcessing}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <X size={16} className="mr-1" />
            거절
          </Button>
          <Button
            size="sm"
            onClick={() => onAccept(message.id)}
            disabled={isProcessing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Check size={16} className="mr-1" />
            프린트
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

MessageCard.displayName = "MessageCard";
