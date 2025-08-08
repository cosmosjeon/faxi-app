'use client';

import { FCMTestComponent } from '@/components/test/FCMTestComponent';

export default function TestPage() {
  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6 text-center">
        🔔 FAXI 푸시 알림 테스트
      </h1>
      
      <div className="space-y-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h2 className="font-semibold text-blue-800 mb-2">테스트 순서</h2>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
            <li>아래 버튼으로 푸시 알림 설정</li>
            <li>FCM 토큰 발급 확인</li>
            <li>토큰 복사 후 Firebase Console에서 테스트 메시지 전송</li>
          </ol>
        </div>
      </div>

      <FCMTestComponent />
      
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">📝 참고사항</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
          <li>알림 권한을 허용해야 토큰이 발급됩니다</li>
          <li>HTTPS 환경에서만 동작합니다 (localhost 제외)</li>
          <li>Service Worker가 등록되어야 합니다</li>
        </ul>
      </div>
    </div>
  );
}