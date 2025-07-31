import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">
            로딩 중...
          </h2>
          <p className="text-sm text-gray-600">
            인증 상태를 확인하고 있습니다
          </p>
        </div>
      </div>
    </div>
  );
} 