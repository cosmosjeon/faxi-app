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

  // 쿠키에서 세션 정보 가져오기
  const token =
    request.cookies.get("sb-access-token")?.value ||
    request.cookies.get("sb-tkzfnkuwflexqcurngrr-auth-token")?.value;

  let isAuthenticated = false;

  if (token) {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      isAuthenticated = !!user && !error;
    } catch (error) {
      console.error("토큰 검증 실패:", error);
      isAuthenticated = false;
    }
  }

  // 보호된 라우트 정의
  const protectedRoutes = ["/friends", "/messages", "/settings", "/profile"];
  const authRoutes = ["/login"];

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // 인증되지 않은 사용자가 보호된 라우트에 접근하려는 경우
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 인증된 사용자가 로그인 페이지에 접근하려는 경우
  if (isAuthRoute && isAuthenticated) {
    const nextParam = request.nextUrl.searchParams.get("next");
    const redirectUrl = nextParam
      ? new URL(nextParam, request.url)
      : new URL("/", request.url);
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
