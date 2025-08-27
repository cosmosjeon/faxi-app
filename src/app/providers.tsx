"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/auth-provider";
import { RealtimeProvider } from "@/components/RealtimeProvider";
import { PushNotificationInitializer } from "@/components/PushNotificationInitializer";
import { useEffect, useState } from "react";

// QueryClient 기본 설정
const queryClientOptions = {
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1분
      gcTime: 5 * 60 * 1000, // 5분
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
};

export default function Providers({ children }: { children: React.ReactNode }) {
  // 클라이언트 사이드에서만 QueryClient 생성하여 SSR 이슈 방지
  const [queryClient] = useState(() => new QueryClient(queryClientOptions));

  // 프로덕션에서 개발용 콘솔 로그 무음 처리 (error는 유지)
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      const c = window.console as Console & { log: any; info: any; warn: any };
      c.log = () => {};
      c.info = () => {};
      c.warn = () => {};
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RealtimeProvider>
          {children}
        </RealtimeProvider>
        <Toaster />
        <PushNotificationInitializer />
      </AuthProvider>
    </QueryClientProvider>
  );
}
