// 이 파일은 클라이언트 컴포넌트입니다 (브라우저에서 실행)
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { supabase } from "@/lib/supabase/client";

// 인증 컨텍스트 생성
interface AuthContextType {
  isInitialized: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  isInitialized: false,
  isLoading: true,
});

// 인증 컨텍스트 사용 훅
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// 인증 프로바이더 컴포넌트
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const {
    user,
    session,
    setUser,
    setSession,
    setLoading,
    setInitialized,
    fetchProfile,
    reset,
  } = useAuthStore();

  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // 🔄 세션 확인 - 페이지 새로고침 시에도 안정적으로 세션 복원
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("세션 조회 실패:", error);
          reset();
          return;
        }

        if (session && session.user) {
          console.log("✅ 세션 복원 성공:", session.user.id);
          setSession(session);
          setUser(session.user);

          // 프로필 조회는 백그라운드에서 실행 (세션 복원과 분리)
          fetchProfile().catch((profileError) => {
            console.warn("프로필 조회 실패 (세션은 유지):", profileError);
          });
        } else {
          console.log("세션 없음, 초기 상태 설정");
          reset();
        }
      } catch (error) {
        console.error("인증 초기화 실패:", error);
        reset();
      } finally {
        setLoading(false);
        setInitialized(true);
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    // 인증 상태 변경을 감지하는 리스너 설정
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("🔄 Auth state changed:", event, session?.user?.id);

      // 주요 이벤트에만 반응하여 불필요한 처리 방지
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED"
      ) {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // 프로필 조회는 백그라운드에서 처리
          fetchProfile().catch((error) => {
            console.warn("프로필 조회 실패 (세션은 유지):", error);
          });
        } else {
          reset();
        }

        setLoading(false);
        setIsLoading(false);
      }
    });

    initializeAuth();

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setSession, setLoading, setInitialized, fetchProfile, reset]);

  return (
    <AuthContext.Provider value={{ isInitialized, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
