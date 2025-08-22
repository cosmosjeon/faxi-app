"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export default function CallbackCompletePage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const n = url.searchParams.get("next");
      const next = n && n.startsWith("/") ? n : "/";

      if (!code) {
        router.replace(`/login?error=no_code`);
        return;
      }

      // Supabase SDK가 내부 저장된 code_verifier와 함께 처리하도록 유도
      // detectSessionInUrl=false이므로 명시적으로 호출
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) {
            router.replace(
              `/login?error=session_exchange_failed&details=${encodeURIComponent(error.message)}`
            );
            return;
          }
          router.replace(next);
        })
        .catch((e: any) => {
          router.replace(
            `/login?error=exchange_exception&details=${encodeURIComponent(e?.message ?? "unknown")}`
          );
        });
    } catch (e: any) {
      router.replace(
        `/login?error=exchange_exception&details=${encodeURIComponent(e?.message ?? "unknown")}`
      );
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-600">로그인 처리 중...</div>
    </div>
  );
}


