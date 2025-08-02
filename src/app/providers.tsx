// 이 파일은 클라이언트 컴포넌트입니다 (브라우저에서 실행)
"use client";

// TanStack Query의 클라이언트 사이드 렌더링 관련 유틸리티
import {
  isServer, // 서버에서 실행 중인지 확인하는 함수
  QueryClient, // 서버 상태 관리 클라이언트
  QueryClientProvider, // React 컴포넌트를 QueryClient로 감싸는 Provider
} from "@tanstack/react-query";
// 다크모드/라이트모드 전환을 위한 Provider
import { ThemeProvider } from "next-themes";
// 토스트 알림 컴포넌트
import { Toaster } from "@/components/ui/toaster";
// 인증 상태 관리 Provider
import { AuthProvider } from "@/components/auth-provider";
// 실시간 기능 Provider
import { RealtimeProvider } from "@/components/RealtimeProvider";

// QueryClient 인스턴스를 생성하는 함수
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // SSR에서 클라이언트로 즉시 재요청하는 것을 방지하기 위한 설정
        staleTime: 60 * 1000, // 60초 동안 데이터를 "신선"하다고 간주
      },
    },
  });
}

// 브라우저에서만 사용할 QueryClient 인스턴스
let browserQueryClient: QueryClient | undefined = undefined;

// 서버/클라이언트 환경에 따라 적절한 QueryClient를 반환하는 함수
function getQueryClient() {
  if (isServer) {
    // 서버: 항상 새로운 QueryClient 생성 (매 요청마다 새로운 인스턴스)
    return makeQueryClient();
  } else {
    // 브라우저: 이미 있으면 재사용, 없으면 새로 생성
    // 이는 React가 초기 렌더링 중에 일시 중단될 때 새로운 클라이언트를 만들지 않기 위함
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

// 모든 전역 상태 관리자들을 감싸는 최상위 Provider 컴포넌트
export default function Providers({ children }: { children: React.ReactNode }) {
  // QueryClient 인스턴스 가져오기
  const queryClient = getQueryClient();

  return (
    // 다크모드/라이트모드 전환 Provider
    <ThemeProvider
      attribute="class" // HTML 요소의 class 속성으로 테마 전환
      defaultTheme="system" // 기본값: 시스템 설정 따름
      enableSystem // 시스템 테마 감지 활성화
      disableTransitionOnChange // 테마 변경 시 애니메이션 비활성화
    >
      {/* 서버 상태 관리 Provider (API 데이터 캐싱, 동기화) */}
      <QueryClientProvider client={queryClient}>
        {/* 인증 상태 관리 Provider */}
        <AuthProvider>
          {/* 실시간 기능 Provider (백그라운드에서 실시간 동기화) */}
          <RealtimeProvider>
            {/* 실제 페이지 내용 */}
            {children}
          </RealtimeProvider>
          {/* 토스트 알림 표시 영역 */}
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
