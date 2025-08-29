import { useEffect } from "react";
import {
  usePrinterStore,
  type PrinterInfo,
  type PrintJob,
  type MockDevice,
} from "@/stores/printer.store";
import { toast } from "@/hooks/use-toast";
import { logger } from "@/features/utils";

// 프린터 설정 (안전 인쇄 모드)
const PRINTER_SAFE_WIDTH = (() => {
  const v = typeof process !== 'undefined' ? Number(process.env.NEXT_PUBLIC_PRINT_WIDTH_DOTS) : NaN;
  if (Number.isFinite(v) && v > 0) return Math.round(v);
  return 288;
})();
const THRESHOLD = 160; // 128 → 160으로 상향(검은 픽셀 비율 축소)
type DitherMode = "floyd" | "atkinson" | "bayer8" | "none";
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

  // 연결 상태 알림: 연결됨/해제됨은 간단한 토스트, 에러는 파괴적 토스트
  useEffect(() => {
    if (store.status === "connected" && store.connectedPrinter) {
      toast({ title: "프린터 연결됨", description: `${store.connectedPrinter.name}`, });
    } else if (store.status === "error" && store.error) {
      toast({ title: "프린터 연결 실패", description: store.error, variant: "destructive" });
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

    // 사진 + 텍스트 → 하나의 합성 이미지로 출력(인스타 피드 레이아웃)
    if (messageData.imageUrl && messageData.text) {
      const dataUrl = await composeFeedDataUrl(messageData.imageUrl, messageData.text);
      const invert = shouldInvertForPrinter(store.connectedPrinter?.name);
      debugPrinterConfig('printMessage(composite)', {
        deviceName: store.connectedPrinter?.name || '',
        invertMode: getEnvString('NEXT_PUBLIC_PRINTER_INVERT_MODE'),
        invertResolved: String(invert),
        xorInvert: String(getEnvBool('NEXT_PUBLIC_FORCE_XOR_INVERT', false)),
        escInvert: String(getEnvBool('NEXT_PUBLIC_PRINTER_INVERT_ESC', false)),
        bitOrder: getEnvString('NEXT_PUBLIC_BIT_ORDER') || 'msb',
        widthDots: String(PRINTER_SAFE_WIDTH),
        dither: getEnvString('NEXT_PUBLIC_DITHER_MODE') || 'floyd',
      });
      const imageBytes = await convertImageToEscPosRaster(dataUrl, invert);
      const buf = imageBytes.buffer.slice(imageBytes.byteOffset, imageBytes.byteOffset + imageBytes.byteLength);
      const jobId = store.addPrintJob("image", buf);
      toast({ title: "프린트 시작" });
      return jobId;
    }

    // 사진만 있는 경우 → 사진만 출력
    if (messageData.imageUrl && !messageData.text) {
      const invert = shouldInvertForPrinter(store.connectedPrinter?.name);
      debugPrinterConfig('printMessage(imageOnly)', {
        deviceName: store.connectedPrinter?.name || '',
        invertMode: getEnvString('NEXT_PUBLIC_PRINTER_INVERT_MODE'),
        invertResolved: String(invert),
        xorInvert: String(getEnvBool('NEXT_PUBLIC_FORCE_XOR_INVERT', false)),
        escInvert: String(getEnvBool('NEXT_PUBLIC_PRINTER_INVERT_ESC', false)),
        bitOrder: getEnvString('NEXT_PUBLIC_BIT_ORDER') || 'msb',
        widthDots: String(PRINTER_SAFE_WIDTH),
        dither: getEnvString('NEXT_PUBLIC_DITHER_MODE') || 'floyd',
      });
      const imageBytes = await convertImageToEscPosRaster(messageData.imageUrl, invert);
      const buf = imageBytes.buffer.slice(imageBytes.byteOffset, imageBytes.byteOffset + imageBytes.byteLength);
      const jobId = store.addPrintJob("image", buf);
      toast({ title: "프린트 시작" });
      return jobId;
    }

    // 텍스트만 있는 경우 → 한글/이모지 보장을 위해 이미지로 변환 후 출력
    if (messageData.text && !messageData.imageUrl) {
      const dataUrl = await renderTextToDataUrl(messageData.text);
      const invert = shouldInvertForPrinter(store.connectedPrinter?.name);
      debugPrinterConfig('printMessage(textOnly)', {
        deviceName: store.connectedPrinter?.name || '',
        invertMode: getEnvString('NEXT_PUBLIC_PRINTER_INVERT_MODE'),
        invertResolved: String(invert),
        xorInvert: String(getEnvBool('NEXT_PUBLIC_FORCE_XOR_INVERT', false)),
        escInvert: String(getEnvBool('NEXT_PUBLIC_PRINTER_INVERT_ESC', false)),
        bitOrder: getEnvString('NEXT_PUBLIC_BIT_ORDER') || 'msb',
        widthDots: String(PRINTER_SAFE_WIDTH),
        dither: getEnvString('NEXT_PUBLIC_DITHER_MODE') || 'floyd',
      });
      const imageBytes = await convertImageToEscPosRaster(dataUrl, invert);
      const buf = imageBytes.buffer.slice(imageBytes.byteOffset, imageBytes.byteOffset + imageBytes.byteLength);
      const jobId = store.addPrintJob("image", buf);
      toast({ title: "프린트 시작" });
      return jobId;
    }

    throw new Error("출력할 내용이 없습니다.");
  };

  const printText = async (text: string): Promise<string> => {
    if (store.status !== "connected") throw new Error("프린터가 연결되지 않았습니다.");

    // ASCII 이외 문자가 포함되면 래스터 이미지로 자동 폴백 (한글/이모지 호환)
    const hasNonAscii = /[^\x00-\x7F]/.test(text);
    if (hasNonAscii) {
      // 간단한 텍스트 캔버스 렌더 후 ESC/POS 래스터로 전송
      const dataUrl = await renderTextToDataUrl(text);
      const invert = shouldInvertForPrinter(store.connectedPrinter?.name);
      const imageBytes = await convertImageToEscPosRaster(dataUrl, invert);
      const buf = imageBytes.buffer.slice(imageBytes.byteOffset, imageBytes.byteOffset + imageBytes.byteLength);
      const jobId = store.addPrintJob("image", buf);
      toast({ title: "프린트 시작" });
      return jobId;
    }

    const jobId = store.addPrintJob("text", text);
    toast({ title: "프린트 시작" });
    return jobId;
  };

  // 이미지 프린트(ESC/POS 래스터, 안전 모드)
  const printImage = async (imageUrl: string): Promise<string> => {
    if (store.status !== "connected") throw new Error("프린터가 연결되지 않았습니다.");
    try {
      const invert = shouldInvertForPrinter(store.connectedPrinter?.name);
      debugPrinterConfig('printImage', {
        deviceName: store.connectedPrinter?.name || '',
        invertMode: getEnvString('NEXT_PUBLIC_PRINTER_INVERT_MODE'),
        invertResolved: String(invert),
        xorInvert: String(getEnvBool('NEXT_PUBLIC_FORCE_XOR_INVERT', false)),
        escInvert: String(getEnvBool('NEXT_PUBLIC_PRINTER_INVERT_ESC', false)),
        bitOrder: getEnvString('NEXT_PUBLIC_BIT_ORDER') || 'msb',
        widthDots: String(PRINTER_SAFE_WIDTH),
        dither: getEnvString('NEXT_PUBLIC_DITHER_MODE') || 'floyd',
      });
      const imageBytes = await convertImageToEscPosRaster(imageUrl, invert);
      const buf = imageBytes.buffer.slice(imageBytes.byteOffset, imageBytes.byteOffset + imageBytes.byteLength);
      const jobId = store.addPrintJob("image", buf);
      return jobId;
    } catch (error) {
      throw error;
    }
  };

  const connectWithFeedback = async (): Promise<void> => {
    try { await store.connectPrinter(); } catch (error) { logger.error("프린터 연결 실패:", error); }
  };
  const disconnectWithFeedback = async (): Promise<void> => {
    try { await store.disconnectPrinter(); } catch (error) { logger.error("프린터 연결 해제 실패:", error); }
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
    initFromRememberedDevices: store.initFromRememberedDevices,
    setAutoReconnectEnabled: store.setAutoReconnectEnabled,
  };
}

// 사진 + 텍스트를 하나의 캔버스에 합성하여 DataURL 반환 (인스타그램 피드형)
async function composeFeedDataUrl(photoUrl: string, text: string): Promise<string> {
  const width = Math.max(64, PRINTER_SAFE_WIDTH);
  const left = Math.max(0, getEnvNumber('NEXT_PUBLIC_LEFT_MARGIN_DOTS', 0));
  const contentWidth = Math.max(1, width - left);

  const img = await loadImage(photoUrl);
  const ratio = contentWidth / img.width;
  const imageHeight = Math.max(1, Math.round(img.height * ratio));
  const { fontSize, lineHeight, maxChars, fontWeight } = getTypographyFor(text);
  const gap = 14; // 사진과 텍스트 사이 여백
  const lines = wrapText(text, maxChars);
  const textHeight = Math.max(0, lines.length * lineHeight + 12);
  const height = Math.min(6000, imageHeight + (lines.length > 0 ? gap + textHeight : 0));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context 생성 실패');

  // 배경 흰색
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // 사진 렌더링(좌측 여백 적용)
  ctx.imageSmoothingEnabled = true as any;
  ctx.imageSmoothingQuality = 'high' as any;
  ctx.drawImage(img, 0, 0, img.width, img.height, left, 0, contentWidth, imageHeight);

  // 텍스트 렌더링
  if (lines.length > 0) {
    ctx.fillStyle = '#000000';
    ctx.font = `${fontWeight} ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif`;
    ctx.textBaseline = 'top';
    let y = imageHeight + gap;
    for (const line of lines) {
      ctx.fillText(line, left + 6, y);
      y += lineHeight;
      if (y > height - lineHeight) break;
    }
  }

  return canvas.toDataURL('image/png');
}

// ESC/POS 래스터 이미지(안전 모드)
async function convertImageToEscPosRaster(imageUrl: string, invertBits = false): Promise<Uint8Array> {
  const bitmap = await loadAndDitherImage(imageUrl, PRINTER_SAFE_WIDTH);
  const bitOrder: 'msb' | 'lsb' = (getEnvString('NEXT_PUBLIC_BIT_ORDER') === 'lsb') ? 'lsb' : 'msb';
  const raster = packMonochromeToRaster(bitmap.pixels, bitmap.width, bitmap.height, invertBits, bitOrder);

  // 추가 반전(XOR) 옵션
  const forceXor = getEnvBool('NEXT_PUBLIC_FORCE_XOR_INVERT', false);
  if (forceXor) {
    for (let i = 0; i < raster.data.length; i++) {
      raster.data[i] = raster.data[i] ^ 0xff;
    }
  }

  // ESC/POS: Reverse print mode (GS B n)
  const escInvert = getEnvBool('NEXT_PUBLIC_PRINTER_INVERT_ESC', false);

  // GS v 0: 1D 76 30 m xL xH yL yH data
  const m = 0;
  const xL = raster.widthBytes & 0xff;
  const xH = (raster.widthBytes >> 8) & 0xff;
  const yL = raster.height & 0xff;
  const yH = (raster.height >> 8) & 0xff;
  const escInit = new Uint8Array([0x1B,0x40]);
  const gsV0Header = new Uint8Array([0x1D,0x76,0x30, m, xL, xH, yL, yH]);
  const tail = new Uint8Array([0x0A,0x0A]);
  const escOn = new Uint8Array([0x1D,0x42,0x01]);
  const escOff = new Uint8Array([0x1D,0x42,0x00]);

  const totalLength = escInit.length + (escInvert ? escOn.length : 0) + gsV0Header.length + raster.data.length + tail.length + (escInvert ? escOff.length : 0);
  const out = new Uint8Array(totalLength);
  let offset = 0;
  out.set(escInit, offset); offset += escInit.length;
  if (escInvert) { out.set(escOn, offset); offset += escOn.length; }
  out.set(gsV0Header, offset); offset += gsV0Header.length;
  out.set(raster.data, offset); offset += raster.data.length;
  out.set(tail, offset); offset += tail.length;
  if (escInvert) { out.set(escOff, offset); offset += escOff.length; }
  return out;
}

async function loadAndDitherImage(src: string, maxWidth: number): Promise<{width:number;height:number;pixels:Uint8Array;}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        // 폭 기준 스케일링 + 좌우 여백 적용
        const leftMargin = getEnvNumber('NEXT_PUBLIC_LEFT_MARGIN_DOTS', 0);
        const contentWidth = Math.max(1, Math.round(maxWidth - Math.max(0, leftMargin)));
        const ratio = contentWidth / img.width;
        const w = Math.max(1, Math.round(maxWidth));
        const hContent = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = hContent;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context 생성 실패');
        (ctx as any).imageSmoothingEnabled = true;
        (ctx as any).imageSmoothingQuality = 'high';
        // 배경 흰색 + 왼쪽 여백 채우기
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, hContent);
        const offsetX = Math.max(0, Math.round(leftMargin));
        ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, 0, contentWidth, hContent);
        const { data } = ctx.getImageData(0, 0, w, hContent);
        // 전처리 파라미터 읽기
        const gamma = getEnvNumber('NEXT_PUBLIC_DITHER_GAMMA', 1.8);
        const contrast = getEnvNumber('NEXT_PUBLIC_DITHER_CONTRAST', 1.0);
        const brightness = getEnvNumber('NEXT_PUBLIC_DITHER_BRIGHTNESS', 0);
        const mode = getEnvDitherMode('NEXT_PUBLIC_DITHER_MODE', 'floyd');
        const negativeMode = (getEnvString('NEXT_PUBLIC_IMAGE_NEGATIVE_MODE') || 'off').toLowerCase();

        // RGBA -> grayscale(0..255), 감마/레벨 보정
        const gray = new Uint8ClampedArray(w * hContent);
        for (let y=0; y<hContent; y++) {
          for (let x=0; x<w; x++) {
            const i = (y*w + x) * 4;
            const g = data[i]*GRAYSCALE_WEIGHTS.R + data[i+1]*GRAYSCALE_WEIGHTS.G + data[i+2]*GRAYSCALE_WEIGHTS.B;
            let gv = applyGammaAndLevels(g, gamma, contrast, brightness);
            if (negativeMode === 'on') gv = 255 - gv;
            gray[y*w + x] = gv;
          }
        }

        // 디더링
        let pixels: Uint8Array;
        if (mode === 'floyd') pixels = ditherFloydSteinberg(gray, w, hContent, THRESHOLD);
        else if (mode === 'atkinson') pixels = ditherAtkinson(gray, w, hContent, THRESHOLD);
        else if (mode === 'bayer8') pixels = ditherBayer8(gray, w, hContent, THRESHOLD);
        else pixels = thresholdOnly(gray, w, hContent, THRESHOLD);
        resolve({ width: w, height: hContent, pixels });
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = src;
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = src;
  });
}

function packMonochromeToRaster(pixels: Uint8Array, width: number, height: number, invertBits = false, bitOrder: 'msb' | 'lsb' = 'msb'): { widthBytes: number; height: number; data: Uint8Array } {
  const widthBytes = Math.ceil(width / 8);
  const data = new Uint8Array(widthBytes * height);
  for (let y=0; y<height; y++) {
    for (let x=0; x<width; x++) {
      const isBlack = pixels[y*width + x] === 1; // 1=검정
      const bit = invertBits ? (isBlack ? 0 : 1) : (isBlack ? 1 : 0);
      const byteIndex = y*widthBytes + (x >> 3);
      const bitIndex = bitOrder === 'msb' ? (7 - (x & 7)) : (x & 7);
      if (bit) data[byteIndex] |= (1 << bitIndex);
    }
  }
  return { widthBytes, height, data };
}

function shouldInvertForPrinter(name?: string | null): boolean {
  // NEXT_PUBLIC_PRINTER_INVERT_MODE: 'on' | 'off' | 'auto'
  const mode = typeof process !== 'undefined' ? String(process.env.NEXT_PUBLIC_PRINTER_INVERT_MODE || '').toLowerCase() : '';
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  // legacy: NEXT_PUBLIC_PRINTER_INVERT=1 → on
  const legacy = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_PRINTER_INVERT === '1';
  if (legacy) return true;
  if (!name) return false;
  const upper = name.toUpperCase();
  return upper.includes('MTP-II') || upper.includes('MPT-II');
}

// ====== 이미지 품질 향상 도우미들 ======
function getEnvNumber(key: string, fallback: number): number {
  const v = typeof process !== 'undefined' ? Number(process.env[key]) : NaN;
  return Number.isFinite(v) ? v : fallback;
}

function getEnvDitherMode(key: string, fallback: DitherMode): DitherMode {
  const v = typeof process !== 'undefined' ? String(process.env[key] || '').toLowerCase() : '';
  if (v === 'floyd' || v === 'atkinson' || v === 'bayer8' || v === 'none') return v;
  return fallback;
}

function getEnvBool(key: string, fallback = false): boolean {
  const v = typeof process !== 'undefined' ? (process.env[key] ?? '') : '';
  if (v === '1' || String(v).toLowerCase() === 'true') return true;
  if (v === '0' || String(v).toLowerCase() === 'false') return false;
  return fallback;
}

function getEnvString(key: string): string {
  return typeof process !== 'undefined' ? String(process.env[key] ?? '') : '';
}

function debugPrinterConfig(tag: string, cfg: Record<string,string>) {
  const enabled = getEnvBool('NEXT_PUBLIC_DEBUG_PRINTER', false);
  if (!enabled) return;
  try { console.log(`[PrinterDebug] ${tag}`, cfg); } catch {}
}

// 영어 전용 타이포그래피 조정(한국어는 그대로 유지)
function isEnglishLike(s: string): boolean {
  return /[A-Za-z]/.test(s) && !/[가-힣]/.test(s);
}
function getTypographyFor(text: string): { fontSize: number; lineHeight: number; maxChars: number; fontWeight: 600 | 700 } {
  if (isEnglishLike(text)) {
    return { fontSize: 28, lineHeight: 42, maxChars: 18, fontWeight: 600 };
  }
  return { fontSize: 32, lineHeight: 48, maxChars: 12, fontWeight: 700 };
}

// 텍스트를 캔버스로 렌더링하여 Data URL 반환 (한글 지원)
async function renderTextToDataUrl(text: string): Promise<string> {
  const width = Math.max(64, PRINTER_SAFE_WIDTH);
  // 대략적 줄바꿈을 고려한 높이 추정 (최대 6줄 기준 확대)
  const { fontSize, lineHeight, maxChars, fontWeight } = getTypographyFor(text);
  const lines = wrapText(text, maxChars); // 영어는 더 많은 글자/줄 간격 축소
  const height = Math.max(64, Math.min(2000, lines.length * lineHeight + 24));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context 생성 실패');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  ctx.font = `${fontWeight} ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif`;
  ctx.textBaseline = 'top';

  let y = 12;
  const left = 6 + Math.max(0, getEnvNumber('NEXT_PUBLIC_LEFT_MARGIN_DOTS', 0));
  for (const line of lines) {
    ctx.fillText(line, left, y);
    y += lineHeight;
    if (y > height - lineHeight) break;
  }

  return canvas.toDataURL('image/png');
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = String(text).split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > maxCharsPerLine) {
      if (line) lines.push(line);
      if (w.length > maxCharsPerLine) {
        for (let i = 0; i < w.length; i += maxCharsPerLine) {
          lines.push(w.slice(i, i + maxCharsPerLine));
        }
        line = '';
      } else {
        line = w;
      }
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function applyGammaAndLevels(gray: number, gamma = 1.8, contrast = 1.0, brightness = 0): number {
  // gamma: >1로 밝은 영역 확장, contrast: 1.0=기본, brightness: -128..+128
  let x = Math.pow(Math.max(0, Math.min(255, gray)) / 255, 1 / Math.max(0.01, gamma)) * 255;
  x = (x - 128) * contrast + 128 + brightness;
  return Math.max(0, Math.min(255, Math.round(x)));
}

function thresholdOnly(gray: Uint8ClampedArray, w: number, h: number, threshold: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = gray[i] < threshold ? 1 : 0;
  return out;
}

function ditherFloydSteinberg(gray: Uint8ClampedArray, w: number, h: number, threshold: number): Uint8Array {
  const out = new Uint8Array(w * h);
  const buf = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) buf[i] = gray[i];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const oldPx = buf[i];
      const newPx = oldPx < threshold ? 0 : 255;
      out[i] = newPx < threshold ? 1 : 0;
      const err = oldPx - newPx;
      if (x + 1 < w) buf[i + 1] += err * 7 / 16;
      if (y + 1 < h) {
        if (x > 0) buf[i + w - 1] += err * 3 / 16;
        buf[i + w] += err * 5 / 16;
        if (x + 1 < w) buf[i + w + 1] += err * 1 / 16;
      }
    }
  }
  return out;
}

function ditherAtkinson(gray: Uint8ClampedArray, w: number, h: number, threshold: number): Uint8Array {
  const out = new Uint8Array(w * h);
  const buf = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) buf[i] = gray[i];
  const distribute = (i: number, x: number, y: number, err: number) => {
    // 1/8씩 6개 픽셀로 분배
    const share = err / 8;
    if (x + 1 < w) buf[i + 1] += share;
    if (x + 2 < w) buf[i + 2] += share;
    if (y + 1 < h) {
      if (x > 0) buf[i + w - 1] += share;
      buf[i + w] += share;
      if (x + 1 < w) buf[i + w + 1] += share;
    }
    if (y + 2 < h) buf[i + 2 * w] += share;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const oldPx = buf[i];
      const newPx = oldPx < threshold ? 0 : 255;
      out[i] = newPx < threshold ? 1 : 0;
      const err = oldPx - newPx;
      distribute(i, x, y, err);
    }
  }
  return out;
}

function ditherBayer8(gray: Uint8ClampedArray, w: number, h: number, threshold: number): Uint8Array {
  // 8x8 Bayer matrix (0..63)
  const bayer = [
    0, 32, 8, 40, 2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44, 4, 36, 14, 46, 6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37,
    63, 31, 55, 23, 61, 29, 53, 21,
  ];
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const t = (bayer[(y & 7) * 8 + (x & 7)] + 0.5) * (255 / 64);
      out[i] = gray[i] < Math.min(255, Math.max(0, threshold + t - 127)) ? 1 : 0;
    }
  }
  return out;
}
