"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageEditor } from "@/components/domain/image/ImageEditor";
import { useBlePrinter } from "@/hooks/useBlePrinter";
import { toast } from "@/hooks/use-toast";

export default function PhotoEditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const printer = useBlePrinter();
  const { t } = useTranslation();

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // URL에서 이미지 파일 정보 복원 (실제로는 세션 스토리지나 다른 방법 사용)
  useEffect(() => {
    // 실제 구현에서는 이미지 파일을 전달하는 다른 방법이 필요
    // 임시로 파일 입력을 통해 이미지 선택하도록 함
    setIsLoading(false);
  }, []);

  // 이미지 파일 선택
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 이미지 파일 검증
      if (!file.type.startsWith("image/")) {
        toast({
          title: "파일 형식 오류",
          description: "이미지 파일만 업로드할 수 있습니다.",
          variant: "destructive",
        });
        return;
      }

      // 파일 크기 검증 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "파일 크기 오류",
          description: "5MB 이하의 이미지만 업로드할 수 있습니다.",
          variant: "destructive",
        });
        return;
      }

      setSelectedImage(file);
    }
  };

  // 편집 완료 후 프린트
  const handleEditComplete = async (editedImageBlob: Blob) => {
    try {
      // Blob → DataURL 변환 후, ESC/POS 래스터 변환 경로로 인쇄
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(editedImageBlob);
      });
      await printer.printImage(dataUrl);

      toast({
        title: "편집 완료",
        description: "편집된 이미지가 프린트 대기열에 추가되었습니다.",
      });

      // 프린터 페이지로 돌아가기
      router.push("/printer");
    } catch (error) {
      console.error("편집된 이미지 프린트 실패:", error);
      toast({
        title: "프린트 실패",
        description: "편집된 이미지를 프린트할 수 없습니다.",
        variant: "destructive",
      });
    }
  };

  // 편집 취소
  const handleEditCancel = () => {
    router.push("/printer");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* 헤더 */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/printer")}
            className="p-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 leading-tight">{t("photo.editTitle")}</h1>
            <p className="text-sm text-gray-600 mt-0.5">{t("photo.editSubtitle")}</p>
          </div>
        </div>

        {/* 이미지 선택 또는 편집 */}
        {!selectedImage ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("photo.pickTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-2xl">📷</span>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-900">{t("photo.pickPrompt")}</p>
                    <p className="text-sm text-gray-500 mt-1">{t("photo.pickHint")}</p>
                  </div>
                </label>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              <ImageEditor
                image={selectedImage}
                onEditComplete={handleEditComplete}
                onCancel={handleEditCancel}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
