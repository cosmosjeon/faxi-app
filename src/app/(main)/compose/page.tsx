"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, Send, Users, X, ArrowLeft, Check } from "lucide-react";
import Image from "next/image";
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
import { validateMessageForm, sendMessage } from "@/features/messages/api";
import { getFriendsList } from "@/features/friends/api";
import type { FriendWithProfile } from "@/features/friends/types";
import type {
  MessageFormData,
  MessageFormErrors,
} from "@/features/messages/types";
import { toast } from "@/hooks/use-toast";
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
  // 다중 수신자 선택 상태
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [recipientSearch, setRecipientSearch] = useState<string>("");


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

  // 이미지 파일 유효성 검사
  const validateImageFile = (file: File) => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    
    if (!allowedTypes.includes(file.type)) {
      return { isValid: false, error: 'JPG, PNG 형식의 이미지만 업로드 가능합니다.' };
    }
    
    if (file.size > maxSize) {
      return { isValid: false, error: '이미지 파일은 최대 5MB까지 업로드 가능합니다.' };
    }
    
    return { isValid: true };
  };

  // 친구 목록 로딩
  useEffect(() => {
    const loadFriends = async () => {
      if (!profile) return;
      
      setIsLoadingFriends(true);
      try {
        const friendsList = await getFriendsList(profile.id);
        // 수락된 친구만 필터링
        const acceptedFriends = friendsList.filter(f => f.status === 'accepted');
        setFriends(acceptedFriends);
      } catch (error) {
        console.error('친구 목록 로딩 실패:', error);
        toast({
          title: "친구 목록 로딩 실패",
          description: "친구 목록을 불러오는데 실패했습니다.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingFriends(false);
      }
    };

    loadFriends();
  }, [profile]);

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

  // 수신자 추가/제거 핸들러
  const addRecipient = (friendId: string) => {
    setSelectedRecipientIds((prev) => {
      if (prev.includes(friendId)) return prev;
      const next = [...prev, friendId];
      if (errors.receiver_id) {
        setErrors((e) => ({ ...e, receiver_id: undefined }));
      }
      return next;
    });
  };

  const removeRecipient = (friendId: string) => {
    setSelectedRecipientIds((prev) => prev.filter((id) => id !== friendId));
  };

  const clearRecipients = () => {
    setSelectedRecipientIds([]);
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
      toast({
        title: "이미지 업로드 실패",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    try {
      // 원본 파일 저장하고 편집 모드로 전환
      setOriginalImageFile(file);
      setEditMode("imageEdit");

      if (errors.image_file) {
        setErrors((prev) => ({ ...prev, image_file: undefined }));
      }
    } catch (error) {
      console.error("이미지 처리 실패:", error);
      toast({
        title: "이미지 처리 실패",
        description: "이미지를 처리하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
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

    // 유효성 검사 (내용/이미지 중심) + 다중 수신자 확인
    const validationErrors = validateMessageForm({
      ...formData,
      // 최소 1명 선택 필요. 선택된 첫 번째 아이디로 기본 검증 통과 처리
      receiver_id: selectedRecipientIds[0] || "",
    });

    const mergedErrors = { ...validationErrors } as MessageFormErrors;
    if (selectedRecipientIds.length === 0) {
      mergedErrors.receiver_id = "받는 사람을 한 명 이상 선택해주세요.";
    }

    if (Object.keys(mergedErrors).length > 0) {
      setErrors(mergedErrors);
      return;
    }

    setIsSending(true);
    try {
      // 선택된 모든 수신자에게 병렬 전송
      const tasks = selectedRecipientIds.map((receiverId) =>
        sendMessage(
          {
            receiver_id: receiverId,
            content: formData.content || undefined,
            image_file: formData.image_file || undefined,
            lcd_teaser: formData.lcd_teaser || undefined,
          },
          profile.id
        )
      );

      const results = await Promise.allSettled(tasks);
      const successCount = results.filter((r) => r.status === "fulfilled").length;
      const failCount = results.length - successCount;

      if (successCount > 0) {
        toast({
          title: "메시지 전송 완료",
          description: `${successCount}명에게 전송되었습니다${failCount > 0 ? ` (${failCount}명 실패)` : ""}.`,
        });
      }
      if (failCount > 0 && successCount === 0) {
        toast({
          title: "메시지 전송 실패",
          description: "모든 수신자에게 전송하지 못했습니다. 잠시 후 다시 시도해주세요.",
          variant: "destructive",
        });
      }

      // 폼 초기화
      setFormData({
        receiver_id: "", // 다중 전송에서는 사용하지 않지만 타입 유지
        content: "",
        image_file: null,
        lcd_teaser: "",
      });
      setImagePreview(null);
      clearRecipients();
      setRecipientSearch("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // 홈으로 이동
      router.push("/home");
    } catch (error) {
      console.error("메시지 전송 실패:", error);
      toast({
        title: "메시지 전송 실패",
        description: "메시지 전송 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  // 수신자 검색/필터링 파생값
  const selectedRecipients = friends.filter((f) =>
    selectedRecipientIds.includes(f.friend_id)
  );
  const availableFriends = friends.filter(
    (f) => !selectedRecipientIds.includes(f.friend_id)
  );
  const filteredFriends = (recipientSearch.trim()
    ? availableFriends.filter((f) =>
        f.friend_profile.display_name
          .toLowerCase()
          .includes(recipientSearch.toLowerCase())
      )
    : availableFriends
  ).slice(0, 20);

  // 전송 가능 여부
  const canSend =
    selectedRecipientIds.length > 0 &&
    (formData.content.trim() || formData.image_file) &&
    !isSending;

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
                ? "사진을 크롭하고 저장하세요"
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
            {/* 받는 사람 선택 (다중) */}
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
                  <div className="space-y-3">
                    {/* 선택된 수신자 칩 */}
                    {selectedRecipients.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedRecipients.map((f) => (
                          <div
                            key={f.friend_id}
                            className="inline-flex items-center gap-2 bg-gray-100 rounded-full pl-1 pr-2 py-1"
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarImage
                                src={f.friend_profile.avatar_url || ""}
                                alt={f.friend_profile.display_name}
                              />
                              <AvatarFallback className="text-xs">
                                {f.friend_profile.display_name[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{f.friend_profile.display_name}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeRecipient(f.friend_id)}
                              aria-label="수신자 제거"
                            >
                              <X size={14} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 선택 요약 + 모두 지우기 */}
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        총 {selectedRecipientIds.length}명 선택됨
                      </p>
                      {selectedRecipientIds.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={clearRecipients}>
                          모두 지우기
                        </Button>
                      )}
                    </div>

                    {/* 검색 인풋 */}
                    <Input
                      placeholder="이름으로 검색..."
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                    />

                    {/* 검색 결과 리스트 */}
                    <div className="border rounded-md divide-y max-h-56 overflow-auto">
                      {filteredFriends.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500">검색 결과가 없습니다</div>
                      ) : (
                        filteredFriends.map((friend) => (
                          <button
                            type="button"
                            key={friend.friend_id}
                            className="w-full text-left p-2 hover:bg-gray-50 flex items-center gap-2"
                            onClick={() => addRecipient(friend.friend_id)}
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarImage
                                src={friend.friend_profile.avatar_url || ""}
                                alt={friend.friend_profile.display_name}
                              />
                              <AvatarFallback className="text-xs">
                                {friend.friend_profile.display_name[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{friend.friend_profile.display_name}</span>
                            {friend.is_close_friend && (
                              <span className="ml-auto text-xs bg-red-100 text-red-600 px-1 rounded">
                                친한친구
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
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
                  <Label htmlFor="teaser">LCD 티저</Label>
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
                  <ImageIcon size={20} />
                  이미지 첨부 (선택)
                </CardTitle>
                {errors.image_file && (
                  <p className="text-sm text-red-500">{errors.image_file}</p>
                )}
              </CardHeader>
              <CardContent>
                {imagePreview ? (
                  <div className="relative">
                    <Image
                      src={imagePreview}
                      alt="이미지 미리보기"
                      width={400}
                      height={192}
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
                      {((formData.image_file?.size || 0) / 1024 / 1024).toFixed(
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
                    <ImageIcon size={48} className="mx-auto text-gray-400 mb-4" />
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
          </>
        )}
      </div>
    </div>
  );
}
