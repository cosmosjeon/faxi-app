import { useEffect } from "react";
import {
  usePrinterStore,
  type PrinterInfo,
  type PrintJob,
  type MockDevice,
} from "@/stores/printer.store";
import { toast } from "@/hooks/use-toast";
import { printerToasts } from "@/lib/toasts";

/**
 * BLE 프린터 연동을 위한 커스텀 훅
 * 프린터 연결, 상태 관리, 프린트 작업 등을 쉽게 사용할 수 있습니다.
 */
export function useBlePrinter() {
  const store = usePrinterStore();

  // 컴포넌트 마운트 시 BLE 지원 여부 확인
  useEffect(() => {
    store.checkBleSupport();
  }, [store.checkBleSupport]);

  // 연결 상태 변화 감지 및 토스트 알림
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

  /**
   * 메시지 프린트 (텍스트 + 이미지)
   */
  const printMessage = async (messageData: {
    text?: string;
    imageUrl?: string;
    lcdTeaser?: string;
    senderName: string;
  }): Promise<string> => {
    if (store.status !== "connected") {
      throw new Error("프린터가 연결되지 않았습니다.");
    }

    // 메시지 데이터를 프린터 형식으로 변환
    const printData = formatMessageForPrint(messageData);

    // 프린트 작업 추가
    const jobId = store.addPrintJob("message", printData);

    toast({
      title: "프린트 시작",
      description: `${messageData.senderName}님의 메시지를 출력합니다.`,
    });

    return jobId;
  };

  /**
   * 텍스트만 프린트
   */
  const printText = async (text: string): Promise<string> => {
    if (store.status !== "connected") {
      throw new Error("프린터가 연결되지 않았습니다.");
    }

    const jobId = store.addPrintJob("text", text);

    toast({
      title: "텍스트 프린트",
      description: "텍스트를 출력합니다.",
    });

    return jobId;
  };

  /**
   * 이미지 프린트
   */
  const printImage = async (imageUrl: string): Promise<string> => {
    if (store.status !== "connected") {
      throw new Error("프린터가 연결되지 않았습니다.");
    }

    try {
      // 이미지를 프린터 형식으로 변환
      const imageBuffer = await convertImageForPrint(imageUrl);
      const jobId = store.addPrintJob("image", imageBuffer);

      printerToasts.printStarted();

      return jobId;
    } catch (error) {
      printerToasts.printError();
      throw error;
    }
  };

  /**
   * 프린터 연결 시도 (사용자 친화적 래퍼)
   */
  const connectWithFeedback = async (): Promise<void> => {
    try {
      await store.connectPrinter();
    } catch (error) {
      // 에러는 스토어에서 처리되므로 여기서는 다시 throw하지 않음
      console.error("프린터 연결 실패:", error);
    }
  };

  /**
   * 프린터 연결 해제 (사용자 친화적 래퍼)
   */
  const disconnectWithFeedback = async (): Promise<void> => {
    try {
      await store.disconnectPrinter();
      printerToasts.disconnectSuccess();
    } catch (error) {
      console.error("프린터 연결 해제 실패:", error);
    }
  };

  /**
   * 프린트 큐 상태 조회
   */
  const getQueueStatus = () => {
    const pending = store.printQueue.filter(
      (job) => job.status === "pending"
    ).length;
    const processing = store.printQueue.filter(
      (job) => job.status === "processing"
    ).length;
    const completed = store.printQueue.filter(
      (job) => job.status === "completed"
    ).length;
    const failed = store.printQueue.filter(
      (job) => job.status === "failed"
    ).length;

    return {
      pending,
      processing,
      completed,
      failed,
      total: store.printQueue.length,
    };
  };

  return {
    // 상태
    status: store.status,
    connectedPrinter: store.connectedPrinter,
    isSupported: store.isSupported,
    error: store.error,
    printQueue: store.printQueue,
    isDevelopmentMode: store.isDevelopmentMode,

    // Mock 기기 선택 관련
    showDeviceSelection: store.showDeviceSelection,
    availableDevices: store.availableDevices,

    // 액션
    connect: connectWithFeedback,
    disconnect: disconnectWithFeedback,
    selectMockDevice: store.selectMockDevice,
    cancelDeviceSelection: store.cancelDeviceSelection,
    printMessage,
    printText,
    printImage,
    addPrintJob: store.addPrintJob,
    clearError: store.clearError,

    // 유틸리티
    getQueueStatus,
    isConnected: store.status === "connected",
    isConnecting: store.status === "connecting",
    isPrinting: store.status === "printing",
    hasError: store.status === "error",

    // Mock 액션 (개발용)
    simulateConnection: store.simulatePrinterConnection,
    simulatePrintComplete: store.simulatePrintComplete,
  };
}

/**
 * 메시지를 프린터 형식으로 변환
 */
function formatMessageForPrint(messageData: {
  text?: string;
  imageUrl?: string;
  lcdTeaser?: string;
  senderName: string;
}): string {
  let printContent = "";

  // 헤더
  printContent += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  printContent += `         📨 PENSIEVE MESSAGE\n`;
  printContent += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // 발신자 정보
  printContent += `FROM: ${messageData.senderName}\n`;
  printContent += `TIME: ${new Date().toLocaleString("ko-KR")}\n\n`;

  // LCD 티저 (있는 경우)
  if (messageData.lcdTeaser) {
    printContent += `┌─ LCD TEASER ─────────────────┐\n`;
    printContent += `│ "${messageData.lcdTeaser}"${" ".repeat(
      Math.max(0, 28 - messageData.lcdTeaser.length - 2)
    )} │\n`;
    printContent += `└─────────────────────────────┘\n\n`;
  }

  // 이미지가 있는 경우 (이미지는 별도 처리됨)
  if (messageData.imageUrl) {
    printContent += `📷 [IMAGE ATTACHED]\n\n`;
  }

  // 텍스트 메시지 (이미지 아래에 표시되도록 수정)
  if (messageData.text) {
    printContent += `MESSAGE:\n`;
    printContent += `${messageData.text}\n\n`;
  }

  // 푸터
  printContent += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  printContent += `      🖨️ Studio Pensieve\n`;
  printContent += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  return printContent;
}

/**
 * 이미지를 프린터용 ArrayBuffer로 변환
 * (실제 구현은 하드웨어 명세에 따라 달라짐)
 */
async function convertImageForPrint(imageUrl: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        // Canvas로 이미지 처리
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("Canvas context를 생성할 수 없습니다.");
        }

        // 프린터 너비에 맞춰 리사이즈 (예: 384px)
        const maxWidth = 384;
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);

        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;

        // 이미지 그리기
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // 흑백 변환
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const gray =
            data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          data[i] = gray; // R
          data[i + 1] = gray; // G
          data[i + 2] = gray; // B
        }

        ctx.putImageData(imageData, 0, 0);

        // ArrayBuffer로 변환 (실제로는 프린터 형식에 맞게 변환 필요)
        canvas.toBlob((blob) => {
          if (blob) {
            blob.arrayBuffer().then(resolve).catch(reject);
          } else {
            reject(new Error("이미지 변환에 실패했습니다."));
          }
        }, "image/png");
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error("이미지를 로드할 수 없습니다."));
    };

    img.src = imageUrl;
  });
}
