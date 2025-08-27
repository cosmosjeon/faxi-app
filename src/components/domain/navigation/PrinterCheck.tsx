"use client";

import { useEffect } from "react";
import { useBlePrinter } from "@/hooks/useBlePrinter";

export default function PrinterCheck() {
  const printer = useBlePrinter();

  useEffect(() => {
    // 앱 진입 시 1회 자동 재연결 시도
    const enabled = typeof window !== 'undefined' ? localStorage.getItem('faxi:autoReconnect') !== 'false' : true;
    if (enabled && typeof (printer as any).initFromRememberedDevices === 'function') {
      (printer as any).initFromRememberedDevices();
    }
  }, []);

  return null;
}
