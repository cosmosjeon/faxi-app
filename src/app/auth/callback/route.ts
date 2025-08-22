import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const error_param = searchParams.get("error");
  const error_description = searchParams.get("error_description");
  let next = searchParams.get("next") ?? "/";
  const code = searchParams.get("code");

  if (process.env.NODE_ENV !== 'production') {
    console.log("=== OAuth Callback Debug ===");
    console.log("Full URL:", request.url);
    console.log("Error param:", error_param);
    console.log("Error description:", error_description);
  }

  if (!next.startsWith("/")) {
    next = "/";
  }

  if (error_param) {
    console.error("OAuth Provider Error:", error_param, error_description);
    return NextResponse.redirect(
      new URL(`/login?error=oauth_error&details=${error_param}`, origin)
    );
  }

  // PKCE 플로우: 서버 교환을 시도하되, code_verifier 미존재 등으로 실패하면 클라이언트 교환 페이지로 폴백
  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        const fallback = new URL(`/auth/callback/complete?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`, origin);
        return NextResponse.redirect(fallback);
      }
    } catch {
      const fallback = new URL(`/auth/callback/complete?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`, origin);
      return NextResponse.redirect(fallback);
    }
  }

  // 환경별 리디렉션 처리
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isHttps = (forwardedProto ?? request.nextUrl.protocol).includes("https");
  const scheme = isHttps ? "https" : "http";

  if (forwardedHost) {
    return NextResponse.redirect(`${scheme}://${forwardedHost}${next}`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
