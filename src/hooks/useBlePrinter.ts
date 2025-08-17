import { useEffect } from "react";
import {
  usePrinterStore,
  type PrinterInfo,
  type PrintJob,
  type MockDevice,
} from "@/stores/printer.store";
import { toast } from "@/hooks/use-toast";
import { printerToasts } from "@/lib/toasts";
import { logger } from "@/features/utils";

// 프린터 설정 (안전 인쇄 모드)
const PRINTER_SAFE_WIDTH = 288; // 384 → 288로 축소
const THRESHOLD = 160; // 128 → 160으로 상향(검은 픽셀 비율 축소)
const GRAYSCALE_WEIGHTS = {
  R: 0.299,
  G: 0.587,
  B: 0.114,
} as const;

/**
 * BLE 프린터 연동 훅
 */
export function useBlePrinter() {
  const store = usePrinterStore();

  // BLE 지원 여부 확인
  useEffect(() => {
    store.checkBleSupport();
  }, [store.checkBleSupport]);

  // 연결 상태 알림
  useEffect(() => {
    if (store.status === "connected" && store.connectedPrinter) {
      toast({
        title: "프린터 연결됨",
        description: `${store.connectedPrinter.name}이(가) 연결되었습니다.`,
      });
    } else if (store.status === "error" && store.error) {
      toast({
        title: "프린터 연결 실패",
        description: store.error,
        variant: "destructive",
      });
    }
  }, [store.status, store.connectedPrinter, store.error]);

  const printMessage = async (messageData: {
    text?: string;
    imageUrl?: string;
    lcdTeaser?: string;
    senderName: string;
  }): Promise<string> => {
    if (store.status !== "connected") {
      throw new Error("프린터가 연결되지 않았습니다.");
    }

    const printData = formatMessageForPrint(messageData);
    const jobId = store.addPrintJob("message", printData);
    toast({ title: "프린트 시작", description: `${messageData.senderName}님의 메시지를 출력합니다.` });
    return jobId;
  };

  const printText = async (text: string): Promise<string> => {
    if (store.status !== "connected") throw new Error("프린터가 연결되지 않았습니다.");
    const jobId = store.addPrintJob("text", text);
    toast({ title: "텍스트 프린트", description: "텍스트를 출력합니다." });
    return jobId;
  };

  // 이미지 프린트(ESC/POS 래스터, 안전 모드)
  const printImage = async (imageUrl: string): Promise<string> => {
    if (store.status !== "connected") throw new Error("프린터가 연결되지 않았습니다.");
    try {
      const imageBytes = await convertImageToEscPosRaster(imageUrl);
      const buf = imageBytes.buffer.slice(imageBytes.byteOffset, imageBytes.byteOffset + imageBytes.byteLength);
      const jobId = store.addPrintJob("image", buf);
      printerToasts.printStarted();
      return jobId;
    } catch (error) {
      printerToasts.printError();
      throw error;
    }
  };

  const connectWithFeedback = async (): Promise<void> => {
    try { await store.connectPrinter(); } catch (error) { logger.error("프린터 연결 실패:", error); }
  };
  const disconnectWithFeedback = async (): Promise<void> => {
    try { await store.disconnectPrinter(); printerToasts.disconnectSuccess(); } catch (error) { logger.error("프린터 연결 해제 실패:", error); }
  };

  const getQueueStatus = () => {
    const pending = store.printQueue.filter((job) => job.status === "pending").length;
    const processing = store.printQueue.filter((job) => job.status === "processing").length;
    const completed = store.printQueue.filter((job) => job.status === "completed").length;
    const failed = store.printQueue.filter((job) => job.status === "failed").length;
    return { pending, processing, completed, failed, total: store.printQueue.length };
  };

  return {
    status: store.status,
    connectedPrinter: store.connectedPrinter,
    isSupported: store.isSupported,
    error: store.error,
    printQueue: store.printQueue,
    isDevelopmentMode: store.isDevelopmentMode,
    showDeviceSelection: store.showDeviceSelection,
    availableDevices: store.availableDevices,
    connect: connectWithFeedback,
    disconnect: disconnectWithFeedback,
    selectMockDevice: store.selectMockDevice,
    cancelDeviceSelection: store.cancelDeviceSelection,
    printMessage,
    printText,
    printImage,
    addPrintJob: store.addPrintJob,
    clearError: store.clearError,
    getQueueStatus,
    isConnected: store.status === "connected",
    isConnecting: store.status === "connecting",
    isPrinting: store.status === "printing",
    hasError: store.status === "error",
    simulateConnection: store.simulatePrinterConnection,
    simulatePrintComplete: store.simulatePrintComplete,
  };
}

function formatMessageForPrint(messageData: { text?: string; imageUrl?: string; lcdTeaser?: string; senderName: string; }): string {
  let printContent = "";
  printContent += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  printContent += `         📨 PENSIEVE MESSAGE\n`;
  printContent += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  printContent += `FROM: ${messageData.senderName}\n`;
  printContent += `TIME: ${new Date().toLocaleString("ko-KR")}\n\n`;
  if (messageData.imageUrl) printContent += `📷 [IMAGE ATTACHED]\n\n`;
  if (messageData.text) { printContent += `MESSAGE:\n`; printContent += `${messageData.text}\n\n`; }
  printContent += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  printContent += `      🖨️ Studio Pensieve\n`;
  printContent += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  return printContent;
}

// ESC/POS 래스터 이미지(안전 모드)
async function convertImageToEscPosRaster(imageUrl: string): Promise<Uint8Array> {
  const bitmap = await loadAndDitherImage(imageUrl, PRINTER_SAFE_WIDTH);
  const raster = packMonochromeToRaster(bitmap.pixels, bitmap.width, bitmap.height);
  // GS v 0: 1D 76 30 m xL xH yL yH data
  const m = 0;
  const xL = raster.widthBytes & 0xff;
  const xH = (raster.widthBytes >> 8) & 0xff;
  const yL = raster.height & 0xff;
  const yH = (raster.height >> 8) & 0xff;
  const header = new Uint8Array([0x1B,0x40, 0x1D,0x76,0x30, m, xL, xH, yL, yH]);
  const tail = new Uint8Array([0x0A,0x0A]);
  const out = new Uint8Array(header.length + raster.data.length + tail.length);
  out.set(header, 0);
  out.set(raster.data, header.length);
  out.set(tail, header.length + raster.data.length);
  return out;
}

async function loadAndDitherImage(src: string, maxWidth: number): Promise<{width:number;height:number;pixels:Uint8Array;}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context 생성 실패');
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        const pixels = new Uint8Array(w * h);
        for (let y=0; y<h; y++) {
          for (let x=0; x<w; x++) {
            const i = (y*w + x) * 4;
            const gray = data[i]*GRAYSCALE_WEIGHTS.R + data[i+1]*GRAYSCALE_WEIGHTS.G + data[i+2]*GRAYSCALE_WEIGHTS.B;
            pixels[y*w + x] = gray < THRESHOLD ? 1 : 0; // 1=검은점(임계값 상향)
          }
        }
        resolve({ width: w, height: h, pixels });
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = src;
  });
}

function packMonochromeToRaster(pixels: Uint8Array, width: number, height: number): { widthBytes: number; height: number; data: Uint8Array } {
  const widthBytes = Math.ceil(width / 8);
  const data = new Uint8Array(widthBytes * height);
  for (let y=0; y<height; y++) {
    for (let x=0; x<width; x++) {
      const bit = pixels[y*width + x]; // 1=검정
      const byteIndex = y*widthBytes + (x >> 3);
      const bitIndex = 7 - (x & 7);
      if (bit) data[byteIndex] |= (1 << bitIndex);
    }
  }
  return { widthBytes, height, data };
}
