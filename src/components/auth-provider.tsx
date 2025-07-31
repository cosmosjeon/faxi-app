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
    let isMounted = true; // 컴포넌트 마운트 상태 추적

    const initializeAuth = async () => {
      try {
        console.log("🔄 인증 초기화 시작...");
        
        // 🔄 Supabase 세션 확인 (LocalStorage/Cookie에서 자동 복원)
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!isMounted) return; // 컴포넌트가 언마운트된 경우 중단

        if (error) {
          console.error("❌ 세션 조회 실패:", error);
          reset();
          return;
        }

        if (session) {
          console.log("✅ 세션 발견:", session.user.id);
          setSession(session);
          setUser(session.user);
          
          // 프로필 정보 비동기 로드 (블로킹하지 않음)
          fetchProfile().catch((profileError) => {
            console.error("프로필 조회 실패:", profileError);
            // 프로필이 없어도 세션은 유지
          });
        } else {
          console.log("ℹ️ 세션 없음, 상태 초기화");
          reset();
        }
      } catch (error) {
        console.error("❌ 인증 초기화 실패:", error);
        reset();
      } finally {
        if (isMounted) {
          console.log("✅ 인증 초기화 완료");
          setLoading(false);
          setInitialized(true);
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    };

    // 인증 상태 변경을 감지하는 리스너 설정
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return; // 컴포넌트가 언마운트된 경우 중단
      
      console.log("🔄 Auth state changed:", event, session?.user?.id);
      
      // 무한 루프 방지: 이벤트가 SIGNED_IN이나 SIGNED_OUT일 때만 상태 업데이트
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // 프로필 정보 비동기 로드 (블로킹하지 않음)
          fetchProfile().catch((error) => {
            console.error("프로필 조회 실패:", error);
            // 프로필이 없어도 세션은 유지
          });
        } else {
          reset();
        }
        
        setLoading(false);
        setIsLoading(false);
      }
    });

    // 초기화 시작
    initializeAuth();

    return () => {
      isMounted = false; // 컴포넌트 언마운트 시 플래그 설정
      subscription.unsubscribe();
    };
  }, [
    setUser,
    setSession,
    setLoading,
    setInitialized,
    fetchProfile,
    reset,
  ]);

  return (
    <AuthContext.Provider value={{ isInitialized, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
