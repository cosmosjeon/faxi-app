"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// FAXI 홈페이지 URL
const FAXI_WEBSITE_URL =
  "https://skku-spec.notion.site/240aeeb6b64880fda8d7f3fe671cf068?source=copy_link";

export default function HelpPage() {
  const router = useRouter();

  // 페이지 로드 시 즉시 외부 링크로 리다이렉트
  useEffect(() => {
    window.open(FAXI_WEBSITE_URL, "_blank");
    router.back();
  }, [router]);

  // 이 페이지는 즉시 리다이렉트되므로 UI가 표시되지 않습니다
  return null;
}
