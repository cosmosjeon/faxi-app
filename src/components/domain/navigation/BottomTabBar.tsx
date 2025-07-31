// 이 파일은 클라이언트 컴포넌트입니다 (브라우저에서 실행)
"use client";

// Next.js의 Link 컴포넌트를 가져옵니다 (클라이언트 사이드 라우팅)
import Link from "next/link";
// 현재 경로를 가져오는 훅
import { usePathname } from "next/navigation";
// Lucide React 아이콘들을 가져옵니다
import { Home, Users, PlusCircle, Printer, User } from "lucide-react";
// CSS 클래스 합성 유틸리티 함수
import { cn } from "@/lib/utils";
// 탭 최적화 훅
import { useTabOptimization } from "@/hooks/useTabOptimization";

// 하단 탭바의 탭 정보 배열
const tabs = [
  {
    href: "/home", // 홈 페이지 경로
    label: "홈", // 탭에 표시될 텍스트
    icon: Home, // 탭에 표시될 아이콘
  },
  {
    href: "/friends", // 친구 페이지 경로
    label: "친구",
    icon: Users, // 여러 사용자 아이콘
  },
  {
    href: "/compose", // 메시지 작성 페이지 경로
    label: "전송",
    icon: PlusCircle, // 플러스 원형 아이콘
  },
  {
    href: "/printer", // 프린터 관리 페이지 경로
    label: "프린터",
    icon: Printer, // 프린터 아이콘
  },
  {
    href: "/profile", // 프로필 페이지 경로
    label: "프로필",
    icon: User, // 사용자 아이콘
  },
];

// 하단 탭바 컴포넌트
export function BottomTabBar() {
  // 현재 페이지 경로를 가져옵니다
  const pathname = usePathname();
  // 탭 최적화 훅
  const { handleTabHover } = useTabOptimization();

  return (
    // 네비게이션 컨테이너 - 화면 하단에 고정
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
      {/* 탭들을 감싸는 컨테이너 - 중앙 정렬, 최대 너비 제한 */}
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* 각 탭을 순회하며 렌더링 */}
        {tabs.map((tab) => {
          // 현재 페이지가 이 탭의 경로와 일치하는지 확인
          const isActive = pathname === tab.href;
          // 아이콘 컴포넌트를 변수에 할당
          const Icon = tab.icon;

          return (
            // 각 탭을 Link 컴포넌트로 감싸서 클릭 시 페이지 이동
            <Link
              key={tab.href} // React key prop
              href={tab.href} // 이동할 경로
              prefetch={true} // 페이지 미리 로드 활성화
              onMouseEnter={() => handleTabHover(tab.href.replace("/", ""))} // 탭 호버 시 프리페칭
              className={cn(
                // 기본 스타일 클래스들
                "flex flex-col items-center space-y-1 px-3 py-2 rounded-lg transition-colors",
                // 활성 상태에 따른 조건부 스타일링
                isActive
                  ? "text-blue-600 bg-blue-50" // 활성: 파란색 텍스트, 연한 파란 배경
                  : "text-gray-500 hover:text-gray-700" // 비활성: 회색 텍스트, 호버 시 진한 회색
              )}
            >
              {/* 아이콘 렌더링 */}
              <Icon
                size={20} // 아이콘 크기
                className={cn(
                  // 아이콘 색상 조건부 적용
                  isActive ? "text-blue-600" : "text-gray-500"
                )}
              />
              {/* 탭 라벨 텍스트 */}
              <span
                className={cn(
                  // 텍스트 기본 스타일
                  "text-xs font-medium",
                  // 텍스트 색상 조건부 적용
                  isActive ? "text-blue-600" : "text-gray-500"
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
