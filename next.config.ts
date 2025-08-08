// Next.js 설정 타입을 가져옵니다
import type { NextConfig } from "next";

// Next.js 설정 객체
const nextConfig: NextConfig = {
  /* config options here */
  
  // ESLint 설정 - 빌드 중 ESLint 검사를 무시합니다 (개발 속도 향상)
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // 이미지 설정 - 외부 이미지 도메인 허용
  images: {
    remotePatterns: [
      {
        hostname: "**", // 모든 도메인 허용 (개발용, 프로덕션에서는 제한 필요)
      },
    ],
  },
  
  // HTTP 헤더 설정 - 보안 및 기능 관련 헤더 추가
  async headers() {
    return [
      {
        source: "/(.*)", // 모든 경로에 적용
        headers: [
          {
            // Content Security Policy - XSS 공격 방지
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'", // 기본적으로 같은 출처만 허용
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com https://tkzfnkuwflexqcurngrr.supabase.co https://www.gstatic.com", // 스크립트 허용 도메인 (Firebase CDN 추가)
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // 스타일 허용 도메인
              "font-src 'self' https://fonts.gstatic.com", // 폰트 허용 도메인
              "img-src 'self' data: https: blob:", // 이미지 허용 도메인
              "connect-src 'self' https://tkzfnkuwflexqcurngrr.supabase.co https://accounts.google.com https://apis.google.com wss://tkzfnkuwflexqcurngrr.supabase.co https://fcmregistrations.googleapis.com https://firebase.googleapis.com https://firebaseinstallations.googleapis.com", // API 연결 허용 도메인 (Firebase Installation API 추가)
              "frame-src 'self' https://accounts.google.com https://content.googleapis.com", // iframe 허용 도메인
            ].join("; "), // 세미콜론으로 구분된 문자열로 결합
          },
          {
            // X-Frame-Options - 클릭재킹 공격 방지
            key: "X-Frame-Options",
            value: "SAMEORIGIN", // 같은 출처의 프레임만 허용
          },
          {
            // X-Content-Type-Options - MIME 타입 스니핑 방지
            key: "X-Content-Type-Options",
            value: "nosniff", // 브라우저가 MIME 타입을 추측하지 않도록 함
          },
        ],
      },
    ];
  },
};

// 설정 객체를 내보냅니다
export default nextConfig;
