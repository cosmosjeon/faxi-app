"use client";

import { useEffect } from "react";
import { useBlePrinter } from "@/hooks/useBlePrinter";

export default function PrinterCheck() {
  const printer = useBlePrinter();

  useEffect(() => {
    // 프린터 연결 상태 확인 (백그라운드에서)
    printer.isConnected();
  }, [printer]);

  return null;
}
