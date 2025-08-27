"use client";

import { BottomTabBar } from "@/components/domain/navigation/BottomTabBar";
import PrinterCheck from "@/components/domain/navigation/PrinterCheck";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PrinterCheck />
      {/* 메인 컨텐츠 영역 */}
      <main className="flex-1 pb-16">{children}</main>

      {/* 하단 고정 탭바 */}
      <BottomTabBar />
    </div>
  );
}
