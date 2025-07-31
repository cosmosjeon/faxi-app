// 성능 최적화 유틸리티 함수들

/**
 * 디바운스된 함수 생성
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * 스로틀된 함수 생성
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Intersection Observer를 사용한 lazy loading 헬퍼
 */
export function useLazyLoad(
  callback: () => void,
  options?: IntersectionObserverInit
) {
  if (typeof window === "undefined") return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        callback();
        observer.disconnect();
      }
    });
  }, options);

  return observer;
}

/**
 * 성능 측정 유틸리티
 */
export class PerformanceTracker {
  private static marks: Map<string, number> = new Map();

  static start(markName: string) {
    this.marks.set(markName, performance.now());
  }

  static end(markName: string): number {
    const startTime = this.marks.get(markName);
    if (!startTime) {
      console.warn(`Performance mark "${markName}" not found`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`⏱️ ${markName}: ${duration.toFixed(2)}ms`);
    this.marks.delete(markName);

    return duration;
  }

  static measure(markName: string, fn: () => void): number {
    this.start(markName);
    fn();
    return this.end(markName);
  }
}

/**
 * 메모리 사용량 체크
 */
export function checkMemoryUsage() {
  if ("memory" in performance) {
    const memory = (performance as any).memory;
    console.log("Memory Usage:", {
      used: `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`,
      total: `${Math.round(memory.totalJSHeapSize / 1024 / 1024)}MB`,
      limit: `${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)}MB`,
    });
  }
}

/**
 * 이미지 preload 유틸리티
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * 청크 로딩 최적화
 */
export function prefetchRoute(href: string) {
  if (typeof window !== "undefined") {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = href;
    document.head.appendChild(link);
  }
}
