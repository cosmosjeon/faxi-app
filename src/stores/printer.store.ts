import { create } from "zustand";
import { printerToasts } from "@/lib/toasts";
import { logger } from "@/features/utils";

// 프린터 연결 상태 타입
export type PrinterStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "printing"
  | "error";

// 프린터 정보 타입
export interface PrinterInfo {
  id: string;
  name: string;
  batteryLevel?: number;
  paperStatus?: "ok" | "low" | "empty";
}

// Mock 기기 목록 타입
export interface MockDevice {
  id: string;
  name: string;
  batteryLevel: number;
  paperStatus: "ok" | "low" | "empty";
}

// Mock 기기 목록 (개발용)
const MOCK_DEVICES: MockDevice[] = [
  {
    id: "mock-printer-001",
    name: "FAXI Printer #001",
    batteryLevel: 85,
    paperStatus: "ok",
  },
  {
    id: "mock-printer-002",
    name: "FAXI Printer #002",
    batteryLevel: 62,
    paperStatus: "low",
  },
];

// 프린트 작업 타입
export interface PrintJob {
  id: string;
  type: "text" | "image" | "message";
  data: string | ArrayBuffer;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: string;
  completedAt?: string;
  error?: string;
}

// 프린터 스토어 상태 타입
interface PrinterStore {
  // 상태
  status: PrinterStatus;
  connectedPrinter: PrinterInfo | null;
  isSupported: boolean;
  error: string | null;
  printQueue: PrintJob[];

  // Mock 모드 (개발용)
  isDevelopmentMode: boolean;
  showDeviceSelection: boolean;
  availableDevices: MockDevice[];

  // 액션
  checkBleSupport: () => void;
  connectPrinter: () => Promise<void>;
  selectMockDevice: (device: MockDevice) => void;
  cancelDeviceSelection: () => void;
  disconnectPrinter: () => Promise<void>;
  addPrintJob: (type: PrintJob["type"], data: string | ArrayBuffer) => string;
  processPrintQueue: () => Promise<void>;
  clearError: () => void;

  // Mock 액션 (개발용)
  simulatePrinterConnection: (printerInfo: PrinterInfo) => void;
  simulatePrintComplete: (jobId: string, success: boolean) => void;
}

export const usePrinterStore = create<PrinterStore>((set, get) => ({
  // 초기 상태
  status: "disconnected",
  connectedPrinter: null,
  isSupported: false,
  error: null,
  printQueue: [],
  isDevelopmentMode: process.env.NODE_ENV === "development",
  showDeviceSelection: false,
  availableDevices: MOCK_DEVICES,

  // BLE 지원 여부 확인
  checkBleSupport: () => {
    const isSupported =
      "bluetooth" in navigator &&
      "requestDevice" in (navigator as any).bluetooth;
    set({ isSupported });

    if (!isSupported) {
      set({
        error:
          "Web Bluetooth API가 지원되지 않습니다. Chrome 브라우저를 사용해주세요.",
        status: "error",
      });
    }
  },

  // 프린터 연결
  connectPrinter: async () => {
    const { isDevelopmentMode, isSupported } = get();

    if (isDevelopmentMode) {
      // 개발 모드: Mock 기기 선택 UI 표시
      set({
        showDeviceSelection: true,
        status: "connecting",
        error: null,
      });
      return;
    }

    if (!isSupported) {
      set({
        error: "Web Bluetooth API가 지원되지 않습니다.",
        status: "error",
      });
      return;
    }

    try {
      set({ status: "connecting", error: null });

      // 실제 BLE 프린터 연결 (하드웨어 준비되면 활성화)
      const device = await (navigator as any).bluetooth.requestDevice({
        // acceptAllDevices: true, // 개발용 - 모든 기기 표시
        filters: [
          { services: ["000018f0-0000-1000-8000-00805f9b34fb"] }, // 예시 UUID
          { namePrefix: "Pensieve" },
          { namePrefix: "Printer" },
        ],
        optionalServices: ["battery_service", "device_information"],
      });

      logger.info("🔍 BLE 기기 선택됨:", device.name);

      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error("GATT 서버 연결 실패");
      }

      const printerInfo: PrinterInfo = {
        id: device.id,
        name: device.name || "Unknown Printer",
      };

      set({
        status: "connected",
        connectedPrinter: printerInfo,
        error: null,
      });

      printerToasts.connectSuccess(printerInfo.name);
      logger.info("🖨️ 프린터 연결 완료:", printerInfo);
    } catch (error) {
      console.error("프린터 연결 실패:", error);
      printerToasts.connectError();
      set({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "프린터 연결에 실패했습니다.",
        connectedPrinter: null,
      });
    }
  },

  // Mock 기기 선택
  selectMockDevice: (device: MockDevice) => {
    const mockPrinter: PrinterInfo = {
      id: device.id,
      name: device.name,
      batteryLevel: device.batteryLevel,
      paperStatus: device.paperStatus,
    };

    set({
      status: "connected",
      connectedPrinter: mockPrinter,
      showDeviceSelection: false,
      error: null,
    });

    printerToasts.connectSuccess(mockPrinter.name);
    logger.info("🖨️ Mock 프린터 연결 완룼:", mockPrinter);
  },

  // 기기 선택 취소
  cancelDeviceSelection: () => {
    set({
      showDeviceSelection: false,
      status: "disconnected",
      error: null,
    });
  },

  // 프린터 연결 해제
  disconnectPrinter: async () => {
    const { isDevelopmentMode } = get();

    if (isDevelopmentMode) {
      // Mock 연결 해제
      set({
        status: "disconnected",
        connectedPrinter: null,
        error: null,
      });
      logger.info("🔌 Mock 프린터 연결 해제");
      return;
    }

    try {
      // 실제 BLE 연결 해제 로직
      set({
        status: "disconnected",
        connectedPrinter: null,
        error: null,
      });
    } catch (error) {
      console.error("프린터 연결 해제 실패:", error);
      set({
        error:
          error instanceof Error ? error.message : "연결 해제에 실패했습니다.",
      });
    }
  },

  // 프린트 작업 추가 (메모리 누수 방지)
  addPrintJob: (type: PrintJob["type"], data: string | ArrayBuffer) => {
    const jobId = `print-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const newJob: PrintJob = {
      id: jobId,
      type,
      data,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    const MAX_QUEUE_SIZE = 50;
    const MAX_COMPLETED_JOBS = 10;

    set((state) => {
      const newQueue = [...state.printQueue, newJob];
      
      // 완료된 작업은 최대 10개만 유지
      const completedJobs = newQueue.filter(job => job.status === 'completed');
      const otherJobs = newQueue.filter(job => job.status !== 'completed');
      
      const trimmedCompleted = completedJobs.slice(-MAX_COMPLETED_JOBS);
      const finalQueue = [...otherJobs, ...trimmedCompleted].slice(-MAX_QUEUE_SIZE);
      
      return { printQueue: finalQueue };
    });

    logger.info("📄 프린트 작업 추가:", newJob);

    // 자동으로 프린트 큐 처리 시작
    get().processPrintQueue();

    return jobId;
  },

  // 프린트 큐 처리
  processPrintQueue: async () => {
    const { status, printQueue, isDevelopmentMode } = get();

    if (status !== "connected") {
      console.warn("프린터가 연결되지 않아 프린트 작업을 처리할 수 없습니다.");
      return;
    }

    const pendingJobs = printQueue.filter((job) => job.status === "pending");
    if (pendingJobs.length === 0) return;

    const jobToProcess = pendingJobs[0];

    try {
      set({ status: "printing" });

      // 작업 상태를 processing으로 변경
      set((state) => ({
        printQueue: state.printQueue.map((job) =>
          job.id === jobToProcess.id
            ? { ...job, status: "processing" as const }
            : job
        ),
      }));

      logger.info("🖨️ 프린트 작업 처리 시작:", jobToProcess);

      if (isDevelopmentMode) {
        // Mock 프린트 처리 (3초 시뮬레이션)
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // 성공 시뮬레이션
        set((state) => ({
          printQueue: state.printQueue.map((job) =>
            job.id === jobToProcess.id
              ? {
                  ...job,
                  status: "completed" as const,
                  completedAt: new Date().toISOString(),
                }
              : job
          ),
        }));

        logger.info("✅ Mock 프린트 완료:", jobToProcess.id);
      } else {
        // 실제 프린트 처리 로직 (하드웨어 준비되면 구현)
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // TODO: 실제 BLE 프린트 명령 전송
        // await sendPrintCommand(jobToProcess.data);

        set((state) => ({
          printQueue: state.printQueue.map((job) =>
            job.id === jobToProcess.id
              ? {
                  ...job,
                  status: "completed" as const,
                  completedAt: new Date().toISOString(),
                }
              : job
          ),
        }));
      }

      set({ status: "connected" });

      // 다음 작업이 있으면 계속 처리
      const { printQueue: updatedQueue } = get();
      const remainingPendingJobs = updatedQueue.filter(
        (job) => job.status === "pending"
      );
      if (remainingPendingJobs.length > 0) {
        // 잠시 후 다음 작업 처리
        setTimeout(() => get().processPrintQueue(), 1000);
      }
    } catch (error) {
      console.error("프린트 작업 실패:", error);

      set((state) => ({
        status: "connected",
        printQueue: state.printQueue.map((job) =>
          job.id === jobToProcess.id
            ? {
                ...job,
                status: "failed" as const,
                error: error instanceof Error ? error.message : "프린트 실패",
              }
            : job
        ),
      }));
    }
  },

  // 에러 상태 초기화
  clearError: () => {
    set({ error: null });
    if (get().status === "error") {
      set({ status: "disconnected" });
    }
  },

  // Mock 액션들 (개발용)
  simulatePrinterConnection: (printerInfo: PrinterInfo) => {
    set({
      status: "connected",
      connectedPrinter: printerInfo,
      error: null,
    });
  },

  simulatePrintComplete: (jobId: string, success: boolean) => {
    set((state) => ({
      printQueue: state.printQueue.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: success ? ("completed" as const) : ("failed" as const),
              completedAt: success ? new Date().toISOString() : undefined,
              error: success ? undefined : "Mock 프린트 실패",
            }
          : job
      ),
    }));
  },
}));
