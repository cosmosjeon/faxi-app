"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/auth-provider";
import { RealtimeProvider } from "@/components/RealtimeProvider";
import { PushNotificationInitializer } from "@/components/PushNotificationInitializer";
import { useState } from "react";

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
