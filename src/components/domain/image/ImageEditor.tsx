"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { RotateCw, Type, Eye } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";

interface ImageEditorProps {
  image: File;
  mode?: "printer" | "message";
  onEditComplete?: (editedImageBlob: Blob) => void;
  onCancel: () => void;
}

interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EditState {
  rotation: number; // 0, 90, 180, 270
  crop: CropData;
  text: string;
}

export function ImageEditor({
  image,
  mode = "printer",
  onEditComplete,
  onCancel,
}: ImageEditorProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({
    rotation: 0,
    crop: { x: 0, y: 0, width: 100, height: 100 },
    text: "",
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragType, setDragType] = useState<"move" | "resize" | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  // 이미지 URL 생성
  useEffect(() => {
    const url = URL.createObjectURL(image);
    setImageUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setImageUrl(null);
    };
  }, [image]);

  // 편집 상태가 변할 때마다 미리보기 업데이트
  useEffect(() => {
    if (isLoaded) {
      generatePreview();
    }
  }, [editState, isLoaded]);

  // 실시간 미리보기 생성
  const generatePreview = useCallback(async () => {
    if (!previewCanvasRef.current || !imageRef.current) return;

    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = imageRef.current;
    if (!ctx) return;

    try {
      // 미리보기 크기 설정 (실제 출력 크기의 50%)
      const previewScale = 0.5;
      const printWidth = 384 * previewScale;
      const cropAspectRatio = editState.crop.width / editState.crop.height;
      const imageHeight = Math.round(printWidth / cropAspectRatio);

      // 문구가 있을 경우 추가 공간 계산
      const textHeight = editState.text.trim() ? 60 * previewScale : 0;
      const padding = editState.text.trim() ? 15 * previewScale : 0;

      const totalHeight = imageHeight + textHeight + padding;

      canvas.width = printWidth;
      canvas.height = totalHeight;

      // 배경 흰색으로 초기화
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 회전 적용하여 이미지 그리기
      ctx.save();
      ctx.translate(printWidth / 2, imageHeight / 2);
      ctx.rotate((editState.rotation * Math.PI) / 180);

      // 크롭된 이미지 그리기
      ctx.drawImage(
        img,
        editState.crop.x,
        editState.crop.y,
        editState.crop.width,
        editState.crop.height,
        -printWidth / 2,
        -imageHeight / 2,
        printWidth,
        imageHeight
      );
      ctx.restore();

      // 텍스트를 이미지 아래에 별도로 추가
      if (editState.text.trim()) {
        ctx.fillStyle = "black";
        ctx.font = `${14 * previewScale}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        const textStartY = imageHeight + padding;
        const maxWidth = printWidth - 20 * previewScale;
        const words = editState.text.split(" ");
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
        const lineHeight = 18 * previewScale;
        lines.forEach((line, index) => {
          const y = textStartY + index * lineHeight + 6 * previewScale;
          ctx.fillText(line, canvas.width / 2, y);
        });
      }

      // Canvas를 Data URL로 변환
      const dataUrl = canvas.toDataURL("image/png");
      setPreviewUrl(dataUrl);
    } catch (error) {
      console.error("미리보기 생성 실패:", error);
    }
  }, [editState]);

  // 이미지 로드 완료 시 초기 크롭 영역 설정
  const handleImageLoad = () => {
    setIsLoaded(true);
    if (imageRef.current) {
      const { naturalWidth, naturalHeight } = imageRef.current;
      // 초기 크롭은 이미지 중앙 80% 영역
      const margin = 0.1;
      setEditState((prev) => ({
        ...prev,
        crop: {
          x: naturalWidth * margin,
          y: naturalHeight * margin,
          width: naturalWidth * (1 - margin * 2),
          height: naturalHeight * (1 - margin * 2),
        },
      }));
    }
  };

  // 회전 기능
  const handleRotate = () => {
    setEditState((prev) => ({
      ...prev,
      rotation: (prev.rotation + 90) % 360,
    }));
  };

  // 문구 변경
  const handleTextChange = (value: string) => {
    setEditState((prev) => ({
      ...prev,
      text: value,
    }));
  };

  // 크롭 영역 드래그 시작
  const handleCropMouseDown = (
    e: React.MouseEvent,
    type: "move" | "resize"
  ) => {
    e.preventDefault();
    setIsDragging(true);
    setDragType(type);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // 크롭 영역 드래그
  const handleCropMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !imageRef.current || !cropContainerRef.current) return;

      const container = cropContainerRef.current;
      const rect = container.getBoundingClientRect();
      const img = imageRef.current;

      // 이미지의 실제 크기와 화면상 크기 비율 계산
      const scaleX = img.naturalWidth / img.offsetWidth;
      const scaleY = img.naturalHeight / img.offsetHeight;

      const deltaX = (e.clientX - dragStart.x) * scaleX;
      const deltaY = (e.clientY - dragStart.y) * scaleY;

      setEditState((prev) => {
        const newCrop = { ...prev.crop };

        if (dragType === "move") {
          // 크롭 영역 이동
          newCrop.x = Math.max(
            0,
            Math.min(prev.crop.x + deltaX, img.naturalWidth - prev.crop.width)
          );
          newCrop.y = Math.max(
            0,
            Math.min(prev.crop.y + deltaY, img.naturalHeight - prev.crop.height)
          );
        } else if (dragType === "resize") {
          // 크롭 영역 크기 조정
          const newWidth = Math.max(
            50,
            Math.min(prev.crop.width + deltaX, img.naturalWidth - prev.crop.x)
          );
          const newHeight = Math.max(
            50,
            Math.min(prev.crop.height + deltaY, img.naturalHeight - prev.crop.y)
          );
          newCrop.width = newWidth;
          newCrop.height = newHeight;
        }

        return { ...prev, crop: newCrop };
      });

      setDragStart({ x: e.clientX, y: e.clientY });
    },
    [isDragging, dragStart, dragType]
  );

  // 크롭 영역 드래그 종료
  const handleCropMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragType(null);
  }, []);

  // 마우스 이벤트 리스너 등록
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleCropMouseMove);
      document.addEventListener("mouseup", handleCropMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleCropMouseMove);
      document.removeEventListener("mouseup", handleCropMouseUp);
    };
  }, [isDragging, handleCropMouseMove, handleCropMouseUp]);

  // 편집 완료 처리
  const handleEditComplete = async () => {
    if (!imageUrl || !imageRef.current) return;

    try {
      if (mode === "message" && onEditComplete) {
        // 메시지 모드: 편집된 이미지를 Blob으로 생성하여 콜백 호출
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context not available");

        const img = imageRef.current;

        // 실제 출력 크기로 canvas 설정
        const printWidth = 384;
        const cropAspectRatio = editState.crop.width / editState.crop.height;
        const imageHeight = Math.round(printWidth / cropAspectRatio);
        const textHeight = editState.text.trim() ? 100 : 0;
        const padding = editState.text.trim() ? 25 : 0;
        const totalHeight = imageHeight + textHeight + padding;

        canvas.width = printWidth;
        canvas.height = totalHeight;

        // 배경 흰색으로 초기화
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 회전 적용하여 이미지 그리기
        ctx.save();
        ctx.translate(printWidth / 2, imageHeight / 2);
        ctx.rotate((editState.rotation * Math.PI) / 180);

        // 크롭된 이미지 그리기
        ctx.drawImage(
          img,
          editState.crop.x,
          editState.crop.y,
          editState.crop.width,
          editState.crop.height,
          -printWidth / 2,
          -imageHeight / 2,
          printWidth,
          imageHeight
        );
        ctx.restore();

        // 텍스트 추가
        if (editState.text.trim()) {
          ctx.fillStyle = "black";
          ctx.font = "14px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";

          const textStartY = imageHeight + padding;
          const maxWidth = printWidth - 20;
          const words = editState.text.split(" ");
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
          const lineHeight = 18;
          lines.forEach((line, index) => {
            const y = textStartY + index * lineHeight + 6;
            ctx.fillText(line, canvas.width / 2, y);
          });
        }

        // Canvas를 Blob으로 변환
        canvas.toBlob((blob) => {
          if (blob) {
            onEditComplete(blob);
          }
        }, "image/png");
      } else {
        // 프린터 모드: 기존 로직 (세션 스토리지 저장 후 페이지 이동)
        const base64Image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(image);
        });

        const editData = {
          imageBase64: base64Image,
          rotation: editState.rotation,
          crop: editState.crop,
          text: editState.text,
        };

        sessionStorage.setItem("photoEditData", JSON.stringify(editData));
        router.push("/printer/photo-edit/preview");
      }
    } catch (error) {
      console.error("이미지 처리 실패:", error);
    }
  };

  // 크롭 영역을 화면 좌표로 변환
  const getCropDisplayStyle = () => {
    if (!imageRef.current || !isLoaded) return {};

    const img = imageRef.current;
    const scaleX = img.offsetWidth / img.naturalWidth;
    const scaleY = img.offsetHeight / img.naturalHeight;

    return {
      left: `${editState.crop.x * scaleX}px`,
      top: `${editState.crop.y * scaleY}px`,
      width: `${editState.crop.width * scaleX}px`,
      height: `${editState.crop.height * scaleY}px`,
    };
  };

  return (
    <div className="space-y-4">
      {/* 이미지 편집 영역 */}
      <div
        ref={cropContainerRef}
        className="relative border rounded-lg overflow-hidden bg-gray-100"
      >
        {imageUrl && (
          <Image
            ref={imageRef}
            src={imageUrl}
            alt="편집할 이미지"
            width={400}
            height={256}
            className="w-full h-auto max-h-64 object-contain"
            style={{
              transform: `rotate(${editState.rotation}deg)`,
            }}
            onLoad={handleImageLoad}
            draggable={false}
          />
        )}

        {/* 드래그 가능한 크롭 영역 */}
        {isLoaded && imageRef.current && (
          <div
            className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-10 cursor-move"
            style={getCropDisplayStyle()}
            onMouseDown={(e) => handleCropMouseDown(e, "move")}
          >
            {/* 크기 조정 핸들 */}
            <div
              className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-se-resize"
              onMouseDown={(e) => {
                e.stopPropagation();
                handleCropMouseDown(e, "resize");
              }}
            />

            {/* 크롭 영역 안내 텍스트 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-blue-600 font-medium text-sm bg-white bg-opacity-80 px-2 py-1 rounded">
                드래그하여 이동
              </span>
            </div>
          </div>
        )}

        {/* 이미지 로딩 중 표시 */}
        {!imageUrl && (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">이미지 로딩 중...</div>
          </div>
        )}
      </div>

      {/* 실시간 미리보기 */}
      {previewUrl && (
        <div className="border rounded-lg p-3 bg-white">
          <Label className="text-sm font-medium flex items-center gap-1 mb-2">
            <Eye size={14} />
            출력 미리보기
          </Label>
          <div className="flex justify-center">
            <div className="border border-gray-300 p-2 rounded bg-gray-50">
              <Image
                src={previewUrl}
                alt="출력 미리보기"
                width={300}
                height={200}
                className="max-w-full h-auto"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 text-center mt-2">
            실제 출력될 모습입니다 (58mm 폭)
          </p>
        </div>
      )}

      {/* 편집 컨트롤 */}
      <div className="space-y-4">
        {/* 회전 */}
        <div>
          <Label className="text-sm font-medium">회전</Label>
          <div className="flex gap-2 mt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRotate}
              className="flex items-center gap-1"
            >
              <RotateCw size={14} />
              90° 회전
            </Button>
            <span className="text-sm text-gray-500 flex items-center">
              현재: {editState.rotation}°
            </span>
          </div>
        </div>

        <Separator />

        {/* 문구 입력 */}
        <div>
          <Label
            htmlFor="text-input"
            className="text-sm font-medium flex items-center gap-1"
          >
            <Type size={14} />
            문구 추가 (사진 아래 표시)
          </Label>
          <Input
            id="text-input"
            value={editState.text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="사진 아래에 추가할 문구를 입력하세요"
            className="mt-1"
            maxLength={100}
          />
          <p className="text-xs text-gray-500 mt-1">
            {editState.text.length}/100자 (사진과 겹치지 않고 아래에 표시됩니다)
          </p>
        </div>
      </div>

      {/* 숨겨진 Canvas들 */}
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={previewCanvasRef} className="hidden" />

      {/* 액션 버튼 */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          취소
        </Button>
        <Button
          onClick={handleEditComplete}
          className="flex-1"
          disabled={!isLoaded}
        >
          <Eye size={16} className="mr-1" />
          {mode === "message" ? "편집 완료" : "미리보기"}
        </Button>
      </div>
    </div>
  );
}
