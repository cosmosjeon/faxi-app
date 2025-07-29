"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageLoadingProps {
  className?: string;
  message?: string;
  size?: "sm" | "md" | "lg";
}

export function PageLoading({
  className,
  message = "로딩 중...",
  size = "md",
}: PageLoadingProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div
      className={cn("flex flex-col items-center justify-center p-8", className)}
    >
      <Loader2
        className={cn("animate-spin text-gray-500", sizeClasses[size])}
      />
      {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}
    </div>
  );
}

export function FullPageLoading({
  message = "페이지를 로딩하는 중...",
}: {
  message?: string;
}) {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <PageLoading message={message} size="lg" />
    </div>
  );
}

export function CardLoading({
  message = "데이터를 불러오는 중...",
}: {
  message?: string;
}) {
  return (
    <div className="flex h-32 w-full items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
      <PageLoading message={message} size="md" />
    </div>
  );
}
