import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const pathname = request.nextUrl.pathname;

  // 정적 파일과 API 라우트는 건너뛰기
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth/callback") ||
    pathname.includes(".")
  ) {
    return response;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 쿠키에서 세션 정보 가져오기 (여러 가능한 쿠키 이름 확인)
  const accessToken = 
    request.cookies.get("sb-access-token")?.value ||
    request.cookies.get("sb-tkzfnkuwflexqcurngrr-auth-token")?.value ||
    request.cookies.get("sb-refresh-token")?.value;

  let isAuthenticated = false;
  let user = null;

  if (accessToken) {
    try {
      // 세션 정보 가져오기
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("세션 조회 실패:", sessionError);
      } else if (session?.user) {
        // 사용자 정보 가져오기
        const {
          data: { user: userData },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error("사용자 정보 조회 실패:", userError);
        } else if (userData) {
          isAuthenticated = true;
          user = userData;
          console.log("✅ 미들웨어 인증 확인:", userData.id);
        }
      }
    } catch (error) {
      console.error("토큰 검증 실패:", error);
      isAuthenticated = false;
    }
  }

  // 보호된 라우트 정의
  const protectedRoutes = [
    "/friends", 
    "/messages", 
    "/settings", 
    "/profile", 
    "/home",
    "/compose",
    "/printer"
  ];
  const authRoutes = ["/login", "/onboarding"];

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // 인증되지 않은 사용자가 보호된 라우트에 접근하려는 경우
  if (isProtectedRoute && !isAuthenticated) {
    console.log("🚫 인증되지 않은 사용자 접근 차단:", pathname);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 인증된 사용자가 로그인 페이지에 접근하려는 경우
  if (isAuthRoute && isAuthenticated) {
    console.log("✅ 인증된 사용자 로그인 페이지 접근, 홈으로 리다이렉트");
    const nextParam = request.nextUrl.searchParams.get("next");
    const redirectUrl = nextParam
      ? new URL(nextParam, request.url)
      : new URL("/home", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
