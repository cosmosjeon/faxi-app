"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// 이미지 에디터 동적 로딩
const ImageEditor = dynamic(
  () => import("@/components/domain/image/ImageEditor"),
  {
    loading: () => (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    ),
    ssr: false,
  }
);

export default ImageEditor;
