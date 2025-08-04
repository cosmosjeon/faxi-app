"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Image, Send, Users, X, ArrowLeft, Check } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/stores/auth.store";
import { validateMessageForm } from "@/features/messages/api";
import type { FriendWithProfile } from "@/features/friends/types";
import type {
  MessageFormData,
  MessageFormErrors,
} from "@/features/messages/types";
import { toast } from "@/hooks/use-toast";
import { messageToasts, imageToasts } from "@/lib/toasts";
import { ImageEditor } from "@/components/domain/image/ImageEditor";

export default function ComposePage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);


  // 상태 관리
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [editMode, setEditMode] = useState<"compose" | "imageEdit">("compose");
  const [originalImageFile, setOriginalImageFile] = useState<File | null>(null);


  // 폼 데이터
  const [formData, setFormData] = useState<MessageFormData>({
    receiver_id: "",
    content: "",
    image_file: null,
    lcd_teaser: "",
  });

  // 에러 상태
  const [errors, setErrors] = useState<MessageFormErrors>({});

  // 이미지 미리보기
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // React Query가 자동으로 친구 목록을 로드하므로 useEffect 제거

  // 텍스트 입력 핸들러
  const handleContentChange = (value: string) => {
    setFormData((prev) => ({ ...prev, content: value }));
    if (errors.content) {
      setErrors((prev) => ({ ...prev, content: undefined }));
    }
  };

  // 티저 입력 핸들러
  const handleTeaserChange = (value: string) => {
    if (value.length <= 10) {
      setFormData((prev) => ({ ...prev, lcd_teaser: value }));
      if (errors.lcd_teaser) {
        setErrors((prev) => ({ ...prev, lcd_teaser: undefined }));
      }
    }
  };

  // 친구 선택 핸들러
  const handleReceiverChange = (receiverId: string) => {
    setFormData((prev) => ({ ...prev, receiver_id: receiverId }));
    if (errors.receiver_id) {
      setErrors((prev) => ({ ...prev, receiver_id: undefined }));
    }
  };

  // 이미지 선택 핸들러
  const handleImageSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 파일 유효성 검사
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      imageToasts.uploadError();
      toast({
        title: "이미지 업로드 실패",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    try {
      // 이미지 압축
      const compressedFile = await compressImage(file, {
        maxWidth: 800,
        maxHeight: 600,
        quality: 0.8,
        format: "jpeg",
      });


    // 원본 파일 저장하고 편집 모드로 전환
    setOriginalImageFile(file);
    setEditMode("imageEdit");

    if (errors.image_file) {
      setErrors((prev) => ({ ...prev, image_file: undefined }));
    }
  };

  // Blob을 File로 변환하는 헬퍼 함수
  const blobToFile = (blob: Blob, fileName: string): File => {
    return new File([blob], fileName, { type: blob.type });
  };

  // 이미지 편집 완료 핸들러
  const handleImageEditComplete = (editedImageBlob: Blob) => {
    // Blob을 File로 변환
    const editedImageFile = blobToFile(
      editedImageBlob,
      originalImageFile?.name || "edited-image.png"
    );

    // 폼 데이터에 편집된 이미지 설정
    setFormData((prev) => ({ ...prev, image_file: editedImageFile }));

    // 미리보기 생성
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(editedImageFile);

    // compose 모드로 복귀
    setEditMode("compose");
  };

  // 이미지 편집 취소 핸들러
  const handleImageEditCancel = () => {
    // 편집 모드를 나가고 원본 이미지 파일 초기화
    setEditMode("compose");
    setOriginalImageFile(null);

    // 파일 입력 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 이미지 제거 핸들러
  const handleImageRemove = () => {
    setFormData((prev) => ({ ...prev, image_file: null }));
    setImagePreview(null);
    setOriginalImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 메시지 전송 핸들러
  const handleSend = async () => {
    if (!profile) return;

    // 유효성 검사
    const validationErrors = validateMessageForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      await sendMessageMutation.mutateAsync({
        receiver_id: formData.receiver_id,
        content: formData.content || undefined,
        image_file: formData.image_file || undefined,
        lcd_teaser: formData.lcd_teaser || undefined,
        sender_id: profile.id,
      });

      messageToasts.sendSuccess();

      // 폼 초기화
      setFormData({
        receiver_id: "",
        content: "",
        image_file: null,
        lcd_teaser: "",
      });
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // 홈으로 이동
      router.push("/home");
    } catch (error) {
      console.error("메시지 전송 실패:", error);
      messageToasts.sendError();
    }
  };

  // 선택된 친구 정보
  const selectedFriend = friends.find(
    (f) => f.friend_id === formData.receiver_id
  );

  // 전송 가능 여부
  const canSend =
    formData.receiver_id &&
    (formData.content.trim() || formData.image_file) &&
    !sendMessageMutation.isPending &&
    Object.keys(errors).length === 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* 헤더 */}
        <div className="bg-white rounded-lg p-4 shadow-sm flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              editMode === "imageEdit" ? handleImageEditCancel() : router.back()
            }
            className="p-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {editMode === "imageEdit" ? "이미지 편집" : "메시지 전송"}
            </h1>
            <p className="text-gray-600 mt-1">
              {editMode === "imageEdit"
                ? "사진을 크롭하고 문구를 추가해보세요"
                : "친구에게 특별한 메시지를 보내보세요"}
            </p>
          </div>
        </div>


        {/* 이미지 편집 모드 */}
        {editMode === "imageEdit" && originalImageFile && (
          <Card>

            <CardContent className="p-4">
              <ImageEditor
                image={originalImageFile}
                mode="message"
                onEditComplete={handleImageEditComplete}
                onCancel={handleImageEditCancel}
              />
            </CardContent>
          </Card>
        )}

        {/* 메시지 작성 모드 */}
        {editMode === "compose" && (
          <>
            {/* 받는 사람 선택 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users size={20} />
                  받는 사람
                </CardTitle>
                {errors.receiver_id && (
                  <p className="text-sm text-red-500">{errors.receiver_id}</p>
                )}
              </CardHeader>
              <CardContent>
                {isLoadingFriends ? (
                  <div className="flex items-center justify-center p-4">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="ml-2 text-gray-600">
                      친구 목록 불러오는 중...
                    </span>
                  </div>
                ) : friends.length === 0 ? (
                  <div className="text-center p-4 text-gray-500">
                    <p>아직 친구가 없습니다</p>
                    <Button
                      variant="link"
                      onClick={() => router.push("/friends/add")}
                      className="mt-2"
                    >
                      친구 추가하기
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={formData.receiver_id}
                    onValueChange={handleReceiverChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="친구 선택하기...">
                        {selectedFriend && (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage
                                src={
                                  selectedFriend.friend_profile.avatar_url || ""
                                }
                                alt={selectedFriend.friend_profile.display_name}
                              />
                              <AvatarFallback className="text-xs">
                                {selectedFriend.friend_profile.display_name[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>
                              {selectedFriend.friend_profile.display_name}
                            </span>
                            {selectedFriend.is_close_friend && (
                              <span className="text-xs bg-red-100 text-red-600 px-1 rounded">
                                친한친구
                              </span>
                            )}
                          </div>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {friends.map((friend) => (
                        <SelectItem
                          key={friend.friend_id}
                          value={friend.friend_id}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage
                                src={friend.friend_profile.avatar_url || ""}
                                alt={friend.friend_profile.display_name}
                              />
                              <AvatarFallback className="text-xs">
                                {friend.friend_profile.display_name[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{friend.friend_profile.display_name}</span>
                            {friend.is_close_friend && (
                              <span className="text-xs bg-red-100 text-red-600 px-1 rounded">
                                친한친구
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>

            {/* 메시지 내용 */}
            <Card>
              <CardHeader>
                <CardTitle>메시지 내용</CardTitle>
                <CardDescription>
                  최대 200자까지 입력할 수 있습니다
                </CardDescription>
                {errors.content && (
                  <p className="text-sm text-red-500">{errors.content}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="message">메시지</Label>
                  <Textarea
                    id="message"
                    placeholder="따뜻한 메시지를 작성해보세요..."
                    className="mt-1"
                    rows={4}
                    value={formData.content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    maxLength={200}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.content.length}/200자
                  </p>
                </div>

                <div>
                  <Label htmlFor="teaser">LCD 티저 (선택)</Label>
                  <Input
                    id="teaser"
                    placeholder="10자 이내 짧은 미리보기"
                    className="mt-1"
                    value={formData.lcd_teaser}
                    onChange={(e) => handleTeaserChange(e.target.value)}
                    maxLength={10}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.lcd_teaser.length}/10자
                  </p>
                  {errors.lcd_teaser && (
                    <p className="text-sm text-red-500">{errors.lcd_teaser}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 이미지 첨부 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image size={20} />
                  이미지 첨부 (선택)
                </CardTitle>
                {errors.image_file && (
                  <p className="text-sm text-red-500">{errors.image_file}</p>
                )}
              </CardHeader>
              <CardContent>
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="이미지 미리보기"
                      className="w-full rounded-lg max-h-48 object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleImageRemove}
                      className="absolute top-2 right-2 p-1 h-8 w-8"
                    >
                      <X size={14} />
                    </Button>
                    <div className="mt-2 text-sm text-gray-600">
                      {formData.image_file?.name} (
                      {(formData.image_file?.size || 0 / 1024 / 1024).toFixed(
                        1
                      )}
                      MB)
                    </div>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Image size={48} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">이미지를 선택하세요</p>
                    <p className="text-xs text-gray-400 mt-1">
                      JPG, PNG 최대 5MB
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </CardContent>
            </Card>

            {/* 일반 오류 메시지 */}
            {errors.general && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4">
                  <p className="text-sm text-red-600">{errors.general}</p>
                </CardContent>
              </Card>
            )}

            {/* 전송 버튼 */}
            <LoadingButton
              size="lg"
              className="w-full gap-2"
              disabled={!canSend}
              loading={isSending}
              loadingText="전송 중..."
              onClick={handleSend}
            >
              <Send size={20} />
              메시지 전송
            </LoadingButton>

            {/* 안내 메시지 */}
            {selectedFriend?.is_close_friend && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-green-700">
                    <Check size={16} />
                    <p className="text-sm">
                      친한 친구에게 보내는 메시지는 자동으로 프린트됩니다.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
