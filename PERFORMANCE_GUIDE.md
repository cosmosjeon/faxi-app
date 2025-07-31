# 🚀 성능 최적화 가이드

이 프로젝트의 성능 최적화 가이드라인입니다. 새로운 기능을 개발할 때 반드시 따라주세요.

## 📋 성능 최적화 체크리스트

### 1. 컴포넌트 개발

- [ ] **Server Component 우선 사용**: 상태나 이벤트 핸들러가 필요하지 않으면 Server Component로 작성
- [ ] **Client Component 최소화**: `"use client"`는 꼭 필요한 경우에만 사용
- [ ] **동적 import 활용**: 무거운 컴포넌트는 `dynamic()`으로 지연 로딩
- [ ] **React.memo 사용**: 리렌더링이 빈번한 컴포넌트에 적용

### 2. 이미지 최적화

- [ ] **Next.js Image 컴포넌트 사용**: `<img>` 태그 대신 `<Image>` 또는 `<OptimizedImage>` 사용
- [ ] **적절한 크기 설정**: `width`, `height`, `sizes` 속성 명시
- [ ] **lazy loading 활성화**: `priority={false}` (기본값)
- [ ] **WebP 형식 사용**: 가능한 경우 WebP 이미지 사용

### 3. 데이터 페칭

- [ ] **React Query 사용**: 서버 상태 관리에 React Query 활용
- [ ] **적절한 캐시 시간 설정**: `cache-config.ts`의 상수 사용
- [ ] **불필요한 요청 방지**: `enabled` 옵션으로 조건부 쿼리 실행
- [ ] **배치 요청**: 가능한 경우 여러 요청을 하나로 합치기

### 4. 번들 최적화

- [ ] **Tree Shaking**: 사용하지 않는 코드 import 금지
- [ ] **코드 분할**: 페이지별, 기능별로 코드 분할
- [ ] **라이브러리 선택적 import**: 전체 라이브러리 대신 필요한 부분만 import

## 🛠 개발 도구

### 번들 분석

```bash
# 번들 크기 분석
npm run analyze
```

### 성능 측정

```bash
# Lighthouse 성능 측정 (Chrome DevTools)
# 개발자 도구 > Lighthouse 탭 사용
```

### 빌드 최적화

```bash
# 프로덕션 빌드
npm run build

# 로컬에서 프로덕션 버전 실행
npm run start
```

## 📊 성능 목표

### 로딩 시간

- **초기 로딩**: 3초 이하
- **페이지 전환**: 1초 이하
- **컴파일 시간**: 2초 이하

### Bundle Size

- **JS Bundle**: 500KB 이하 (gzipped)
- **CSS Bundle**: 50KB 이하 (gzipped)
- **이미지**: WebP 형식, 적절한 해상도

### Core Web Vitals

- **LCP (Largest Contentful Paint)**: 2.5초 이하
- **FID (First Input Delay)**: 100ms 이하
- **CLS (Cumulative Layout Shift)**: 0.1 이하

## 🔧 최적화 기법

### 1. 컴포넌트 패턴

```tsx
// ✅ 좋은 예: 동적 import 사용
const HeavyComponent = dynamic(() => import("./HeavyComponent"), {
  loading: () => <Skeleton />,
  ssr: false,
});

// ❌ 나쁜 예: 직접 import
import HeavyComponent from "./HeavyComponent";
```

### 2. 이미지 최적화

```tsx
// ✅ 좋은 예: OptimizedImage 사용
<OptimizedImage
  src="/image.jpg"
  alt="설명"
  width={300}
  height={200}
  sizes="(max-width: 768px) 100vw, 50vw"
/>

// ❌ 나쁜 예: 일반 img 태그
<img src="/image.jpg" alt="설명" />
```

### 3. 캐시 설정

```tsx
// ✅ 좋은 예: 적절한 캐시 시간
const { data } = useQuery({
  queryKey: cacheKeys.friends.list(userId),
  queryFn: () => getFriendsList(userId),
  staleTime: CACHE_TIMES.FRIENDS_LIST,
  gcTime: GC_TIMES.MEDIUM,
});

// ❌ 나쁜 예: 캐시 없음
const { data } = useQuery({
  queryKey: ["friends", userId],
  queryFn: () => getFriendsList(userId),
  staleTime: 0,
});
```

## 🚨 주의사항

1. **Server Component에서 Client Component import 금지**
2. **중첩된 use client 선언 최소화**
3. **무거운 라이브러리 동적 로딩**
4. **이미지 크기 최적화 필수**
5. **불필요한 리렌더링 방지**

## 📈 성능 모니터링

정기적으로 다음을 확인하세요:

- Chrome DevTools > Performance 탭
- Chrome DevTools > Lighthouse 탭
- `npm run analyze`로 번들 크기 확인
- Network 탭에서 로딩 시간 확인

성능 이슈 발견 시 즉시 최적화를 적용하세요.
