// Supabase 클라이언트 라이브러리를 가져옵니다
import { createClient } from "@supabase/supabase-js";

// 환경 변수에서 Supabase 설정을 가져옵니다
// NEXT_PUBLIC_ 접두사는 브라우저에서도 접근 가능한 환경 변수임을 의미합니다
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!; // Supabase 프로젝트 URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // 익명 사용자용 API 키

// Supabase 클라이언트 인스턴스를 생성합니다
// 이 인스턴스를 통해 데이터베이스, 인증, 파일 저장 등의 기능을 사용할 수 있습니다
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // OAuth 인증 설정
    flowType: "implicit", // Implicit 플로우 사용 (PKCE 대신)
    detectSessionInUrl: true, // URL에서 세션 정보를 자동으로 감지
    autoRefreshToken: true, // 토큰 자동 갱신
    persistSession: true, // 세션 정보를 로컬 스토리지에 저장
  },
});
