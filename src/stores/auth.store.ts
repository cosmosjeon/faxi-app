import { create } from "zustand";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isInitialized: boolean;
  isDevelopmentMode: boolean; // 개발 모드 플래그
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  signInWithOAuth: (provider: "google" | "kakao") => Promise<void>;
  signInAsDev: (devUserId: string) => Promise<void>; // 개발용 로그인
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  reset: () => void;
}

// 개발용 테스트 사용자
const DEV_USERS = [
  {
    id: "dev-user-1",
    username: "alice",
    display_name: "앨리스",
    avatar_url: "https://picsum.photos/100/100?random=1",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "dev-user-2",
    username: "bob",
    display_name: "밥",
    avatar_url: "https://picsum.photos/100/100?random=2",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "dev-user-3",
    username: "charlie",
    display_name: "찰리",
    avatar_url: "https://picsum.photos/100/100?random=3",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const initialState: AuthState = {
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isInitialized: false,
  isDevelopmentMode: process.env.NODE_ENV === "development",
};

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  ...initialState,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  setInitialized: (isInitialized) => set({ isInitialized }),

  signInWithOAuth: async (provider) => {
    set({ isLoading: true });
    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;
      console.log("🔄 OAuth Debug:", {
        provider,
        redirectUrl,
        origin: window.location.origin,
        hostname: window.location.hostname,
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          // 🔧 임시: Implicit Flow 테스트용 - redirectTo 제거
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      console.log("🔄 OAuth Result:", data);

      if (error) {
        console.error("❌ OAuth Error:", error);
        throw error;
      }
    } catch (error) {
      console.error("❌ OAuth Exception:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // ✅ 새로 추가: 개발용 로그인
  signInAsDev: async (devUserId: string) => {
    set({ isLoading: true });
    try {
      console.log("🧪 Development Login:", devUserId);

      // 개발용 사용자 찾기
      const devUser = DEV_USERS.find((user) => user.id === devUserId);
      if (!devUser) {
        throw new Error("개발용 사용자를 찾을 수 없습니다");
      }

      // 가짜 User 객체 생성 (Supabase User 형태 모방)
      const mockUser: User = {
        id: devUser.id,
        email: `${devUser.username}@dev.local`,
        email_confirmed_at: new Date().toISOString(),
        created_at: devUser.created_at,
        updated_at: devUser.updated_at,
        user_metadata: {
          full_name: devUser.display_name,
          avatar_url: devUser.avatar_url,
        },
        app_metadata: {},
        aud: "authenticated",
        role: "authenticated",
      };

      // 가짜 Session 객체 생성
      const mockSession: Session = {
        access_token: `dev-token-${devUserId}`,
        refresh_token: `dev-refresh-${devUserId}`,
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "bearer",
        user: mockUser,
      };

      // 상태 업데이트
      set({
        user: mockUser,
        session: mockSession,
        profile: devUser,
      });

      console.log("✅ Development login successful:", devUser.display_name);
    } catch (error) {
      console.error("❌ Development login failed:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      const { isDevelopmentMode } = get();

      if (isDevelopmentMode) {
        // 개발 모드에서는 단순히 상태만 리셋
        console.log("🧪 Development logout");
      } else {
        // 프로덕션에서는 실제 Supabase 로그아웃
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }

      set({
        user: null,
        session: null,
        profile: null,
        isLoading: false,
      });
    } catch (error) {
      console.error("로그아웃 실패:", error);
      set({ isLoading: false });
      throw error;
    }
  },

  fetchProfile: async () => {
    const { user, isDevelopmentMode } = get();
    if (!user) return;

    // 개발 모드에서는 이미 profile이 설정되어 있음
    if (isDevelopmentMode) {
      console.log("🧪 Development mode: profile already set");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      // 프로필이 없는 경우 (신규 사용자)
      if (!data) {
        const newProfile = await createUserProfile(user);
        set({ profile: newProfile });
      } else {
        set({ profile: data });
      }
    } catch (error) {
      console.error("프로필 조회 실패:", error);
      throw error;
    }
  },

  reset: () => set(initialState),
}));

// 신규 사용자 프로필 생성 함수
async function createUserProfile(user: User): Promise<UserProfile> {
  const username = user.email?.split("@")[0] || `user_${user.id.slice(0, 8)}`;
  const displayName = user.user_metadata?.full_name || user.email || username;

  const profileData = {
    id: user.id,
    username,
    display_name: displayName,
    avatar_url: user.user_metadata?.avatar_url || null,
    is_active: true,
  };

  const { data, error } = await supabase
    .from("users")
    .insert(profileData)
    .select()
    .single();

  if (error) {
    console.error("프로필 생성 실패:", error);
    throw error;
  }

  // user_settings 기본값 생성
  await supabase.from("user_settings").insert({
    user_id: user.id,
    auto_print_close_friends: false,
    retro_effects_enabled: true,
  });

  return data;
}

// 개발용 사용자 목록 export
export { DEV_USERS };
