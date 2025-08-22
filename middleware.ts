import { createServerClient } from "@supabase/ssr";
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

  // 서버용 Supabase 클라이언트 생성
  // 로컬 프로덕션(http)에서는 secure 쿠키가 저장되지 않으므로, 프로토콜에 따라 secure 여부를 결정
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocolFromUrl = request.nextUrl.protocol; // e.g. "http:" | "https:"
  const isSecure = (forwardedProto ?? protocolFromUrl)?.includes("https");

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, secure: isSecure })
          );
        },
      },
      cookieOptions: {
        secure: isSecure,
      },
    }
  );

  let isAuthenticated = false;

  try {
    // Supabase의 표준 세션 관리 사용
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    isAuthenticated = !!session && !error;

    if (error) {
      console.error("세션 조회 실패:", error);
    }
  } catch (error) {
    console.error("인증 확인 실패:", error);
    isAuthenticated = false;
  }

  // 보호된 라우트 정의
  const protectedRoutes = [
    "/friends",
    "/messages",
    "/settings",
    "/profile",
    "/home",
  ];
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
