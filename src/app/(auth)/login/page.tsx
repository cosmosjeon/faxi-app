"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth.store";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithOAuth, isLoading, user } = useAuthStore();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isKakaoLoading, setIsKakaoLoading] = useState(false);

  // 이미 로그인된 사용자는 홈으로 리디렉션
  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  // URL 파라미터에서 오류 메시지 확인
  useEffect(() => {
    const error = searchParams.get("error");
    const details = searchParams.get("details");

    if (error) {
      let errorMessage = "로그인 중 오류가 발생했습니다.";
      
      switch (error) {
        case "oauth_error":
          errorMessage = "소셜 로그인 중 오류가 발생했습니다.";
          break;
        case "session_exchange_failed":
          errorMessage = "인증 세션 처리 중 오류가 발생했습니다.";
          break;
        case "exchange_exception":
          errorMessage = "인증 처리 중 예외가 발생했습니다.";
          break;
        case "no_code":
          errorMessage = "인증 코드를 받지 못했습니다.";
          break;
        default:
          errorMessage = `로그인 오류: ${error}`;
      }

      if (details) {
        errorMessage += ` (${details})`;
      }

      toast({
        title: "로그인 실패",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [searchParams]);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      await signInWithOAuth("google");
    } catch (error) {
      console.error("구글 로그인 실패:", error);
      toast({
        title: "로그인 실패",
        description: "구글 로그인 중 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleKakaoLogin = async () => {
    setIsKakaoLoading(true);
    try {
      await signInWithOAuth("kakao");
    } catch (error) {
      console.error("카카오 로그인 실패:", error);
      toast({
        title: "로그인 실패",
        description: "카카오 로그인 중 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsKakaoLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            Studio Pensieve
          </CardTitle>
          <CardDescription className="text-gray-600">
            친구와 함께하는 아날로그 SNS
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleGoogleLogin}
            disabled={isLoading || isGoogleLoading}
            className="w-full h-12 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-medium"
            variant="outline"
          >
            {isGoogleLoading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                <span>로그인 중...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Google로 로그인</span>
              </div>
            )}
          </Button>

          <Button
            onClick={handleKakaoLogin}
            disabled={isLoading || isKakaoLoading}
            className="w-full h-12 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium"
          >
            {isKakaoLoading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                <span>로그인 중...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11L7.408 21l.11-2.124C4.734 17.747 1.5 14.992 1.5 11.185 1.5 6.664 6.201 3 12 3Z"
                  />
                </svg>
                <span>카카오로 로그인</span>
              </div>
            )}
          </Button>

          <div className="text-center text-sm text-gray-500 mt-6">
            로그인하면 Studio Pensieve의{" "}
            <a href="#" className="text-blue-600 hover:underline">
              서비스 약관
            </a>{" "}
            및{" "}
            <a href="#" className="text-blue-600 hover:underline">
              개인정보처리방침
            </a>
            에 동의하는 것으로 간주됩니다.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
