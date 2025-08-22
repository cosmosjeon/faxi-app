"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Printer, Download } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBlePrinter } from "@/hooks/useBlePrinter";
import { toast } from "@/hooks/use-toast";

export default function PhotoPreviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const printer = useBlePrinter();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(true);
  const [editData, setEditData] = useState<any>(null);

  // 세션 스토리지에서 편집 데이터 복원
  useEffect(() => {
    const savedEditData = sessionStorage.getItem("photoEditData");
    if (savedEditData) {
      try {
        const data = JSON.parse(savedEditData);
        if (process.env.NODE_ENV !== 'production') {
          console.log("편집 데이터 로드:", data);
        }

        // 필수 데이터 검증
        if (!data.imageBase64) {
          console.error("이미지 데이터가 없습니다");
          router.push("/printer/photo-edit");
          return;
        }

        setEditData(data);
        generatePreviewImage(data);
      } catch (error) {
        console.error("편집 데이터 파싱 실패:", error);
        router.push("/printer/photo-edit");
      }
    } else {
      // 편집 데이터가 없으면 편집 페이지로 돌아가기
      if (process.env.NODE_ENV !== 'production') {
        console.log("저장된 편집 데이터가 없습니다");
      }
      router.push("/printer/photo-edit");
    }
  }, [router]);

  // 미리보기 이미지 생성
  const generatePreviewImage = async (data: any) => {
    if (!data || !canvasRef.current) return;

    setIsGenerating(true);
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");

      // 이미지 로드
      const img = new window.Image();
      img.onload = () => {
        // 프린터 출력 크기 설정 (환경변수로 오버라이드 가능)
        const printWidth = (() => {
          const v = typeof process !== 'undefined' ? Number(process.env.NEXT_PUBLIC_PRINT_WIDTH_DOTS) : NaN;
          return Number.isFinite(v) && v > 0 ? Math.round(v) : 288;
        })();
        const cropAspectRatio = data.crop.width / data.crop.height;
        const imageHeight = Math.round(printWidth / cropAspectRatio);

        // 문구가 있을 경우 추가 공간 계산
        const textHeight = data.text.trim() ? 100 : 0;
        const padding = data.text.trim() ? 25 : 0;

        const totalHeight = imageHeight + textHeight + padding;

        canvas.width = printWidth;
        canvas.height = totalHeight;

        // 배경 흰색으로 초기화
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 회전 적용하여 이미지 그리기
        ctx.save();
        ctx.translate(printWidth / 2, imageHeight / 2);
        ctx.rotate((data.rotation * Math.PI) / 180);

        // 크롭된 이미지 그리기
        ctx.drawImage(
          img,
          data.crop.x,
          data.crop.y,
          data.crop.width,
          data.crop.height,
          -printWidth / 2,
          -imageHeight / 2,
          printWidth,
          imageHeight
        );
        ctx.restore();

        // 텍스트를 이미지 아래에 별도로 추가
        if (data.text.trim()) {
          ctx.fillStyle = "black";
          ctx.font = "22px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";

          const textStartY = imageHeight + padding;
          const maxWidth = printWidth - 40;
          const words = data.text.split(" ");
          const lines: string[] = [];
          let currentLine = "";

          words.forEach((word) => {
            const testLine = currentLine + (currentLine ? " " : "") + word;
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && currentLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          });

          if (currentLine) {
            lines.push(currentLine);
          }

          // 각 줄을 그리기
          const lineHeight = 30;
          lines.forEach((line, index) => {
            const y = textStartY + index * lineHeight + 15;
            ctx.fillText(line, canvas.width / 2, y);
          });
        }

        // Canvas를 이미지 URL로 변환하여 미리보기 표시
        const dataUrl = canvas.toDataURL("image/png");
        setPreviewImageUrl(dataUrl);
        setIsGenerating(false);
      };

      img.onerror = (error) => {
        console.error("이미지 로드 실패:", error);
        if (process.env.NODE_ENV !== 'production') {
          console.error("이미지 URL 길이:", data.imageBase64?.length);
          console.error("이미지 URL 시작:", data.imageBase64?.substring(0, 50));
        }
        setIsGenerating(false);
      };

      if (process.env.NODE_ENV !== 'production') {
        console.log(
          "이미지 로드 시작:",
          data.imageBase64?.substring(0, 50) + "..."
        );
      }
      img.src = data.imageBase64;
    } catch (error) {
      console.error("미리보기 생성 실패:", error);
      setIsGenerating(false);
    }
  };

  // 프린트 실행
  const handlePrint = async () => {
    if (!editData || !canvasRef.current) {
      toast({
        title: "오류",
        description: "프린트할 데이터가 없습니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Canvas를 DataURL로 변환하여 ESC/POS 래스터 인쇄 경로 사용
      const dataUrl = canvasRef.current.toDataURL("image/png");
      await printer.printImage(dataUrl);

      toast({
        title: "프린트 시작",
        description: "편집된 이미지가 프린트 대기열에 추가되었습니다.",
      });

      // 편집 데이터 정리 후 프린터 페이지로 이동
      sessionStorage.removeItem("photoEditData");
      router.push("/printer");
    } catch (error) {
      console.error("프린트 실패:", error);
      toast({
        title: "프린트 실패",
        description: "이미지를 프린트할 수 없습니다.",
        variant: "destructive",
      });
    }
  };

  // 편집 페이지로 돌아가기
  const handleBackToEdit = () => {
    router.push("/printer/photo-edit");
  };

  // 프린터 페이지로 돌아가기 (편집 취소)
  const handleCancel = () => {
    sessionStorage.removeItem("photoEditData");
    router.push("/printer");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* 헤더 */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToEdit}
            className="p-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">프린트 미리보기</h1>
            <p className="text-sm text-gray-600">최종 출력물을 확인하세요</p>
          </div>
        </div>

        {/* 미리보기 카드 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer size={20} />
              출력 미리보기
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isGenerating ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">미리보기 생성 중...</div>
              </div>
            ) : previewImageUrl ? (
              <div className="space-y-4">
                {/* 미리보기 이미지 */}
                <div className="flex justify-center">
                  <div className="border-2 border-dashed border-gray-300 p-4 rounded-lg bg-white">
                    <Image
                      src={previewImageUrl}
                      alt="프린트 미리보기"
                      width={400}
                      height={400}
                      className="max-w-full h-auto"
                      style={{ maxHeight: "400px" }}
                    />
                  </div>
                </div>

                {/* 안내 텍스트 */}
                <div className="text-center text-sm text-gray-600 bg-gray-100 p-3 rounded-lg">
                  <p className="font-medium">📏 실제 크기: 58mm 폭</p>
                  <p>위 이미지는 실제 프린트될 모습입니다</p>
                </div>

                {/* 편집 정보 요약 */}
                {editData && (
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>• 회전: {editData.rotation}°</p>
                    {editData.text && <p>• 문구: &quot;{editData.text}&quot;</p>}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-red-500">미리보기 생성 실패</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 액션 버튼 */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCancel} className="flex-1">
            취소
          </Button>
          <Button
            variant="outline"
            onClick={handleBackToEdit}
            className="flex-1"
          >
            수정하기
          </Button>
          <Button
            onClick={handlePrint}
            disabled={!printer.isConnected || isGenerating}
            className="flex-1"
          >
            <Printer size={16} className="mr-1" />
            출력하기
          </Button>
        </div>

        {/* 숨겨진 Canvas (미리보기 생성용) */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
