import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  // 🔧 임시: Implicit Flow 테스트용 - 바로 홈으로 리디렉션
  return NextResponse.redirect(new URL("/", request.url));

  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error_param = searchParams.get("error");
  const error_description = searchParams.get("error_description");
  let next = searchParams.get("next") ?? "/";

  console.log("=== OAuth Callback Debug ===");
  console.log("Full URL:", request.url);
  console.log("Code exists:", !!code);
  console.log("Error param:", error_param);
  console.log("Error description:", error_description);

  // next가 상대 URL이 아니면 기본값 사용
  if (!next.startsWith("/")) {
    next = "/";
  }

  // OAuth 공급자에서 오류가 발생한 경우
  if (error_param) {
    console.error("OAuth Provider Error:", error_param, error_description);
    return NextResponse.redirect(
      new URL(`/login?error=oauth_error&details=${error_param}`, origin)
    );
  }

  if (code) {
    const supabase = await createClient(); // ✅ 서버 클라이언트 사용

    try {
      console.log("Attempting to exchange code for session...");
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      console.log("Exchange result - Error:", error);

      if (!error) {
        console.log("✅ Session exchange successful, redirecting to:", next);

        // 환경별 리디렉션 처리 (공식 가이드 방식)
        const forwardedHost = request.headers.get("x-forwarded-host"); // 로드 밸런서 앞의 원본 호스트
        const isLocalEnv = process.env.NODE_ENV === "development";

        if (isLocalEnv) {
          // 로컬 환경에서는 로드 밸런서가 없으므로 origin 사용
          return NextResponse.redirect(`${origin}${next}`);
        } else if (forwardedHost) {
          // 프로덕션에서 x-forwarded-host가 있으면 사용
          return NextResponse.redirect(`https://${forwardedHost}${next}`);
        } else {
          // 기본적으로 origin 사용
          return NextResponse.redirect(`${origin}${next}`);
        }
      } else {
        console.error("❌ Session exchange failed:", error);
        return NextResponse.redirect(
          new URL(
            `/login?error=session_exchange_failed&details=${
              error?.message || "unknown"
            }`,
            origin
          )
        );
      }
    } catch (error) {
      console.error("❌ Exception during session exchange:", error);
      return NextResponse.redirect(
        new URL(`/login?error=exchange_exception&details=${error}`, origin)
      );
    }
  }

  // 코드가 없는 경우
  console.error("❌ No authorization code received");
  return NextResponse.redirect(new URL("/login?error=no_code", origin));
}
