import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const error_param = searchParams.get("error");
  const error_description = searchParams.get("error_description");
  let next = searchParams.get("next") ?? "/";

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

  // Implicit 플로우에서는 코드 교환이 필요 없음
  // Supabase가 자동으로 URL에서 세션을 감지하고 처리함
  if (process.env.NODE_ENV !== 'production') {
    console.log("✅ Implicit flow - redirecting to:", next);
  }

  // 환경별 리디렉션 처리
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";

  if (isLocalEnv) {
    // 로컬 환경에서는 origin 사용
    return NextResponse.redirect(`${origin}${next}`);
  } else if (forwardedHost) {
    // 프로덕션에서 x-forwarded-host가 있으면 사용
    return NextResponse.redirect(`https://${forwardedHost}${next}`);
  } else {
    // 기본적으로 origin 사용
    return NextResponse.redirect(`${origin}${next}`);
  }
}
