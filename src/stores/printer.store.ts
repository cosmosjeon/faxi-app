import { create } from "zustand";
import { printerToasts } from "@/lib/toasts";
import { logger } from "@/features/utils";

// Web Bluetooth API 타입 확장
declare global {
  interface Navigator {
    bluetooth: {
      requestDevice(options: {
        filters?: Array<{
          namePrefix?: string;
          services?: string[];
        }>;
        optionalServices?: string[];
        acceptAllDevices?: boolean;
      }): Promise<BluetoothDevice>;
    };
  }
}

interface BluetoothDevice {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  addEventListener(type: string, listener: EventListener): void;
}

interface BluetoothRemoteGATTServer {
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTCharacteristic {
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  addEventListener(type: string, listener: EventListener): void;
}

// 16-bit → 128-bit Base UUID
const to128 = (short: string) => `0000${short.toLowerCase()}-0000-1000-8000-00805f9b34fb`;

// MPT-II 호환 가능 프로파일 우선순위 목록
const MPT_PROFILES: Array<{
  service: string;
  write: string[];
  notify?: string[];
}> = [
  // 표준/빈번한 ESC/POS BLE
  { service: to128('18f0'), write: [to128('2af1')], notify: [to128('2af0')] },
  { service: to128('ff00'), write: [to128('ff02')], notify: [to128('ff01'), to128('ff03')] },
  { service: to128('ff80'), write: [to128('ff82')], notify: [to128('ff81')] },
  { service: to128('fff0'), write: [to128('fff2')], notify: [to128('fff1')] },
  // UART 계열
  { service: '49535343-fe7d-4ae5-8fa9-9fafd205e455', write: [
      '49535343-6daa-4d02-abf6-19569aca69fe',
      '49535343-8841-43f4-a8d4-ecbe34729bb3',
    ], notify: ['49535343-1e4d-4bd9-ba61-23c647249616'] },
  // 기타 커스텀
  { service: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', write: [
      'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
    ] },
  { service: to128('fee7'), write: [to128('fec7')], notify: [to128('fec8')] },
];

function unique<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }

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
  data: string | ArrayBufferLike;
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

  // BLE 연결 상태 (런타임 리소스)
  device: BluetoothDevice | null;
  gattServer: BluetoothRemoteGATTServer | null;
  writeCharacteristic: BluetoothRemoteGATTCharacteristic | null;
  notifyCharacteristic: BluetoothRemoteGATTCharacteristic | null;

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
  addPrintJob: (type: PrintJob["type"], data: string | ArrayBufferLike) => string;
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
  device: null,
  gattServer: null,
  writeCharacteristic: null,
  notifyCharacteristic: null,
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

      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: unique([
          ...MPT_PROFILES.map(p => p.service),
          "battery_service",
          "device_information",
        ]),
      });

      logger.info("🔍 BLE 기기 선택됨:", device.name);

      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error("GATT 서버 연결 실패");
      }

      let writeChar: BluetoothRemoteGATTCharacteristic | null = null;
      let notifyChar: BluetoothRemoteGATTCharacteristic | null = null;
      for (const profile of MPT_PROFILES) {
        try {
          const svc = await server.getPrimaryService(profile.service);
          if (profile.notify) {
            for (const n of profile.notify) {
              try {
                const nChar = await svc.getCharacteristic(n);
                await nChar.startNotifications().catch(() => undefined);
                nChar.addEventListener("characteristicvaluechanged", (e: any) => {
                  const v = new Uint8Array(e.target.value.buffer);
                  logger.info("📩 notify:", profile.service, Array.from(v));
                });
                notifyChar = nChar;
                break;
              } catch {}
            }
          }
          for (const w of profile.write) {
            try {
              writeChar = await svc.getCharacteristic(w);
              break;
            } catch {}
          }
          if (writeChar) break;
        } catch {}
      }
      if (!writeChar) {
        throw new Error("지원되는 쓰기 채널을 찾지 못했습니다.");
      }

      device.addEventListener("gattserverdisconnected", () => {
        logger.warn("🔌 프린터 연결이 해제되었습니다.");
        set({
          status: "disconnected",
          connectedPrinter: null,
          device: null,
          gattServer: null,
          writeCharacteristic: null,
          notifyCharacteristic: null,
        });
      });

      const printerInfo: PrinterInfo = {
        id: device.id,
        name: device.name || "Unknown Printer",
      };

      set({
        status: "connected",
        connectedPrinter: printerInfo,
        error: null,
        device,
        gattServer: server,
        writeCharacteristic: writeChar,
        notifyCharacteristic: notifyChar,
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
    logger.info("🖨️ Mock 프린터 연결 완료:", mockPrinter);
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
    const { isDevelopmentMode, device } = get();

    if (isDevelopmentMode) {
      // Mock 연결 해제
      set({
        status: "disconnected",
        connectedPrinter: null,
        error: null,
        device: null,
        gattServer: null,
        writeCharacteristic: null,
        notifyCharacteristic: null,
      });
      logger.info("🔌 Mock 프린터 연결 해제");
      return;
    }

    try {
      // 실제 BLE 연결 해제
      try {
        device?.gatt?.disconnect();
      } catch (_) {}
      set({
        status: "disconnected",
        connectedPrinter: null,
        error: null,
        device: null,
        gattServer: null,
        writeCharacteristic: null,
        notifyCharacteristic: null,
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
  addPrintJob: (type: PrintJob["type"], data: string | ArrayBufferLike) => {
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
    const { status, printQueue, isDevelopmentMode, writeCharacteristic, notifyCharacteristic } = get();

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
        // 실제 프린트 처리
        if (!writeCharacteristic) {
          throw new Error("프린터 쓰기 채널을 찾을 수 없습니다.");
        }

        const payload = await buildPayload(jobToProcess);
        const isImage = jobToProcess.type === "image";
        await writeInChunks(writeCharacteristic, payload, 20, isImage ? 15 : 5);
        // ACK가 가능한 디바이스라면 알림을 기다렸다가 완료 처리
        await awaitAckOrDelay(notifyCharacteristic, isImage ? 1000 : 700);

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

// 텍스트 → ESC/POS 바이트 (ASCII 안전)
function composeEscPosTextBytes(text: string): Uint8Array {
  const ESC_INIT = [0x1b, 0x40];
  const LINE_FEED = [0x0a];
  const safe = text.replace(/[^\x00-\x7F]+/g, " ");
  const encoded = new TextEncoder().encode(safe);
  const tail = new Uint8Array([0x0a, 0x0a]);
  const bytes = new Uint8Array(ESC_INIT.length + encoded.length + LINE_FEED.length + tail.length);
  bytes.set(ESC_INIT, 0);
  bytes.set(encoded, ESC_INIT.length);
  bytes.set(LINE_FEED, ESC_INIT.length + encoded.length);
  bytes.set(tail, ESC_INIT.length + encoded.length + LINE_FEED.length);
  return bytes;
}

// ACK 대기(가능 시) 또는 짧은 지연
async function awaitAckOrDelay(
  notifyChar: BluetoothRemoteGATTCharacteristic | null,
  timeoutMs = 700
) {
  if (!notifyChar) {
    await new Promise(r => setTimeout(r, 150));
    return;
  }
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      resolve();
    }, timeoutMs);
    const handler = () => { clearTimeout(timer); resolve(); };
    const noop = handler as unknown as EventListener; // 동일 참조 유지용
    notifyChar.addEventListener('characteristicvaluechanged', noop);
  });
}

// 프린트 작업 → payload 구성
async function buildPayload(job: PrintJob): Promise<Uint8Array> {
  if (typeof job.data === "string") {
    return composeEscPosTextBytes(job.data);
  }
  return new Uint8Array(job.data);
}

// 청크 전송 (기본 20바이트, 안정성 우선)
async function writeInChunks(
  characteristic: BluetoothRemoteGATTCharacteristic,
  data: Uint8Array,
  chunkSize = 20,
  delayMs = 5
) {
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    await characteristic.writeValueWithoutResponse(chunk);
    // 약간의 딜레이로 안정성 확보
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, delayMs));
  }
}
