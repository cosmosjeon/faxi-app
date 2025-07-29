"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, setProfile, isLoading } = useAuthStore();
  const [formData, setFormData] = useState({
    username: "",
    display_name: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 로그인되지 않은 사용자는 로그인 페이지로 리디렉션
  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    // 이미 프로필이 있는 사용자는 홈으로 리디렉션
    if (profile) {
      router.push("/");
      return;
    }

    // 기본값 설정
    if (user.email) {
      const defaultUsername = user.email.split("@")[0];
      const defaultDisplayName = user.user_metadata?.full_name || defaultUsername;
      
      setFormData({
        username: defaultUsername,
        display_name: defaultDisplayName,
      });
    }
  }, [user, profile, router]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "오류",
        description: "사용자 정보를 찾을 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    // 입력값 검증
    if (!formData.username.trim() || !formData.display_name.trim()) {
      toast({
        title: "입력 오류",
        description: "모든 필드를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    // 사용자명 형식 검증 (영문, 숫자, 언더스코어만 허용)
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(formData.username)) {
      toast({
        title: "사용자명 오류",
        description: "사용자명은 영문, 숫자, 언더스코어(_)만 사용 가능합니다.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // 현재 세션 확인
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("세션 확인 실패:", sessionError);
        throw new Error("인증 세션을 확인할 수 없습니다.");
      }

      if (!session) {
        throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
      }

      console.log("현재 세션:", session.user.id);

      // 사용자명 중복 확인
      const { data: existingUser, error: checkError } = await supabase
        .from("users")
        .select("username")
        .eq("username", formData.username)
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        console.error("사용자명 중복 확인 실패:", checkError);
        throw checkError;
      }

      if (existingUser) {
        toast({
          title: "사용자명 중복",
          description: "이미 사용 중인 사용자명입니다. 다른 사용자명을 선택해주세요.",
          variant: "destructive",
        });
        return;
      }

      // 프로필 정보 생성
      const profileData = {
        id: session.user.id,
        username: formData.username.trim(),
        display_name: formData.display_name.trim(),
        avatar_url: session.user.user_metadata?.avatar_url || null,
        is_active: true,
      };

      console.log("프로필 데이터:", profileData);

      // Supabase에 프로필 저장
      const { data: newProfile, error } = await supabase
        .from("users")
        .insert(profileData)
        .select()
        .single();

      if (error) {
        console.error("프로필 생성 실패:", error);
        console.error("프로필 데이터:", profileData);
        throw error;
      }

      // 사용자 설정 기본값 생성
      const { error: settingsError } = await supabase.from("user_settings").insert({
        user_id: session.user.id,
        auto_print_close_friends: false,
        retro_effects_enabled: true,
      });

      if (settingsError) {
        console.error("사용자 설정 생성 실패:", settingsError);
        // 설정 생성 실패해도 프로필은 생성되었으므로 계속 진행
      }

      // 스토어에 프로필 정보 업데이트
      setProfile(newProfile);

      toast({
        title: "환영합니다!",
        description: "Studio Pensieve에 오신 것을 환영합니다.",
      });

      // 홈 페이지로 리디렉션
      router.push("/");
    } catch (error) {
      console.error("온보딩 실패:", error);
      toast({
        title: "오류",
        description: error instanceof Error ? error.message : "프로필 생성 중 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 로딩 중이거나 사용자 정보가 없으면 로딩 표시
  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            프로필 설정
          </CardTitle>
          <CardDescription className="text-gray-600">
            Studio Pensieve에서 사용할 정보를 입력해주세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">사용자명</Label>
              <Input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => handleInputChange("username", e.target.value)}
                placeholder="사용자명을 입력하세요"
                className="w-full"
                maxLength={20}
              />
              <p className="text-xs text-gray-500">
                영문, 숫자, 언더스코어(_)만 사용 가능합니다
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_name">표시 이름</Label>
              <Input
                id="display_name"
                type="text"
                value={formData.display_name}
                onChange={(e) => handleInputChange("display_name", e.target.value)}
                placeholder="표시할 이름을 입력하세요"
                className="w-full"
                maxLength={30}
              />
              <p className="text-xs text-gray-500">
                친구들에게 표시될 이름입니다
              </p>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>처리 중...</span>
                </div>
              ) : (
                "프로필 완성하기"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>
              Studio Pensieve의{" "}
              <a href="#" className="text-blue-600 hover:underline">
                서비스 약관
              </a>{" "}
              및{" "}
              <a href="#" className="text-blue-600 hover:underline">
                개인정보처리방침
              </a>
              에 동의합니다.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 