// Zustand 라이브러리를 가져옵니다 (가벼운 상태 관리)
import { create } from "zustand";
// Supabase의 타입들을 가져옵니다
import { User, Session } from "@supabase/supabase-js";
// Supabase 클라이언트를 가져옵니다
import { supabase } from "@/lib/supabase/client";

// 사용자 프로필 정보의 타입 정의
interface UserProfile {
  id: string; // 사용자 고유 ID
  username: string; // 사용자명 (로그인용)
  display_name: string; // 표시 이름
  avatar_url?: string; // 프로필 이미지 URL (선택사항)
  is_active: boolean; // 계정 활성화 상태
  created_at: string; // 생성일
  updated_at: string; // 수정일
}

// 인증 상태의 타입 정의
interface AuthState {
  user: User | null; // Supabase 사용자 정보
  session: Session | null; // 인증 세션 정보
  profile: UserProfile | null; // 사용자 프로필 정보
  isLoading: boolean; // 로딩 상태
  isInitialized: boolean; // 초기화 완료 여부
}

// 인증 관련 액션들의 타입 정의
interface AuthActions {
  setUser: (user: User | null) => void; // 사용자 정보 설정
  setSession: (session: Session | null) => void; // 세션 정보 설정
  setProfile: (profile: UserProfile | null) => void; // 프로필 정보 설정
  setLoading: (loading: boolean) => void; // 로딩 상태 설정
  setInitialized: (initialized: boolean) => void; // 초기화 상태 설정
  signInWithOAuth: (provider: "google" | "kakao") => Promise<void>; // OAuth 로그인
  signOut: () => Promise<void>; // 로그아웃
  fetchProfile: () => Promise<void>; // 프로필 정보 가져오기
  reset: () => void; // 상태 초기화
  refreshSession: () => Promise<void>; // 세션 새로고침
}

// 초기 상태 정의
const initialState: AuthState = {
  user: null, // 사용자 정보 없음
  session: null, // 세션 정보 없음
  profile: null, // 프로필 정보 없음
  isLoading: true, // 초기 로딩 상태
  isInitialized: false, // 초기화 미완료
};

// Zustand 스토어 생성 (상태 + 액션)
export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  ...initialState, // 초기 상태 적용

  // 상태 설정 함수들
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  setInitialized: (isInitialized) => set({ isInitialized }),

  // 세션 새로고침 함수
  refreshSession: async () => {
    try {
      console.log("🔄 세션 새로고침 시작...");
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error("❌ 세션 새로고침 실패:", error);
        throw error;
      }

      if (data.session) {
        console.log("✅ 세션 새로고침 성공:", data.session.user.id);
        set({ 
          session: data.session, 
          user: data.session.user,
          isLoading: false 
        });
      } else {
        console.log("ℹ️ 세션 새로고침 결과: 세션 없음");
        set({ 
          session: null, 
          user: null,
          isLoading: false 
        });
      }
    } catch (error) {
      console.error("❌ 세션 새로고침 중 오류:", error);
      set({ 
        session: null, 
        user: null,
        isLoading: false 
      });
    }
  },

  // OAuth 로그인 함수 (Google, Kakao)
  signInWithOAuth: async (provider) => {
    set({ isLoading: true }); // 로딩 상태 시작
    try {
      // 리다이렉트 URL 설정 (인증 완료 후 돌아올 주소)
      const redirectUrl = `${window.location.origin}/auth/callback`;
      console.log("🔄 OAuth Debug:", {
        provider,
        redirectUrl,
        origin: window.location.origin,
        hostname: window.location.hostname,
      });

      // Supabase OAuth 로그인 실행 (Implicit 플로우)
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl, // 인증 완료 후 리다이렉트할 URL
          queryParams: {
            access_type: "offline", // 오프라인 액세스 토큰 요청
            prompt: "consent", // 항상 동의 화면 표시
          },
        },
      });

      console.log("🔄 OAuth Result:", data);

      if (error) {
        console.error("❌ OAuth Error:", error);
        throw error;
      }

      // Implicit 플로우에서는 리다이렉트가 자동으로 시작됨
      // 실제 인증 처리는 /auth/callback에서 이루어짐
    } catch (error) {
      console.error("❌ OAuth Exception:", error);
      throw error;
    } finally {
      set({ isLoading: false }); // 로딩 상태 종료
    }
  },

  // 로그아웃 함수
  signOut: async () => {
    set({ isLoading: true });
    try {
      console.log("🔄 로그아웃 시작...");
      
      // 실제 Supabase 로그아웃
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      console.log("✅ 로그아웃 성공");
      
      // 모든 인증 상태 초기화
      set({
        user: null,
        session: null,
        profile: null,
        isLoading: false,
      });
    } catch (error) {
      console.error("❌ 로그아웃 실패:", error);
      set({ isLoading: false });
      throw error;
    }
  },

  // 사용자 프로필 정보 가져오기
  fetchProfile: async () => {
    const { user } = get();
    if (!user) {
      console.log("ℹ️ 사용자 정보 없음, 프로필 조회 건너뜀");
      return;
    }

    try {
      console.log("🔄 프로필 조회 시작:", user.id);
      
      // Supabase에서 사용자 프로필 정보 조회
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("❌ 프로필 조회 실패:", error);
        throw error;
      }

      // 프로필이 있는 경우에만 설정
      if (data) {
        console.log("✅ 프로필 조회 성공:", data.display_name);
        set({ profile: data });
      } else {
        console.log("ℹ️ 프로필 없음 (온보딩 필요)");
        // 프로필이 없는 경우 null로 설정 (온보딩 페이지로 리디렉션됨)
        set({ profile: null });
      }
    } catch (error) {
      console.error("❌ 프로필 조회 실패:", error);
      set({ profile: null });
    }
  },

  // 상태 초기화 함수
  reset: () => {
    console.log("🔄 인증 상태 초기화");
    set(initialState);
  },
}));
