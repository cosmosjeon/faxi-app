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
        // 🔄 실제 Supabase 세션 확인 (개발/프로덕션 모두)
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("세션 조회 실패:", error);
          reset();
          return;
        }

        if (session) {
          console.log("세션 발견:", session.user.id);
          setSession(session);
          setUser(session.user);
          try {
            await fetchProfile();
          } catch (profileError) {
            console.error("프로필 조회 실패:", profileError);
            // 프로필이 없어도 세션은 유지
          }
        } else {
          console.log("세션 없음, 상태 초기화");
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
      console.log("Auth state changed:", event, session?.user?.id);
      
      // 무한 루프 방지: 이벤트가 SIGNED_IN이나 SIGNED_OUT일 때만 상태 업데이트
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          try {
            await fetchProfile();
          } catch (error) {
            console.error("프로필 조회 실패:", error);
            // 프로필이 없어도 세션은 유지
          }
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
