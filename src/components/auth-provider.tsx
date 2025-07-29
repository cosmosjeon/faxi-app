"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { supabase } from "@/lib/supabase/client";

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const {
    setUser,
    setSession,
    setLoading,
    setInitialized,
    fetchProfile,
    reset,
    isDevelopmentMode,
  } = useAuthStore();

  useEffect(() => {
    // 초기 세션 확인
    const initializeAuth = async () => {
      try {
        if (isDevelopmentMode) {
          // 🧪 개발 모드: 로컬 스토리지에서 상태 확인 (선택사항)
          console.log("🧪 Development mode: Skip Supabase session check");
          // 개발 모드에서는 Zustand 스토어의 현재 상태를 그대로 사용
        } else {
          // 🔄 프로덕션 모드: 실제 Supabase 세션 확인
          const {
            data: { session },
            error,
          } = await supabase.auth.getSession();

          if (error) {
            console.error("세션 조회 실패:", error);
            return;
          }

          if (session) {
            setSession(session);
            setUser(session.user);

            // 프로필 정보 조회
            try {
              await fetchProfile();
            } catch (profileError) {
              console.error("프로필 조회 실패:", profileError);
            }
          } else {
            reset();
          }
        }
      } catch (error) {
        console.error("인증 초기화 실패:", error);
        reset();
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    // Auth state change listener 설정 (프로덕션에서만)
    let subscription: any = null;

    if (!isDevelopmentMode) {
      const {
        data: { subscription: sub },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("Auth state changed:", event, session?.user?.id);

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          try {
            await fetchProfile();
          } catch (error) {
            console.error("프로필 조회 실패:", error);
          }
        } else {
          reset();
        }

        // 로그인/로그아웃 후 로딩 상태 해제
        if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
          setLoading(false);
        }
      });

      subscription = sub;
    } else {
      console.log("🧪 Development mode: Skip auth state listener");
    }

    initializeAuth();

    // Cleanup subscription
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [
    setUser,
    setSession,
    setLoading,
    setInitialized,
    fetchProfile,
    reset,
    isDevelopmentMode,
  ]);

  return <>{children}</>;
}
