# 📚 Faxi App 프로젝트 가이드

## 🏗️ 프로젝트 구조 설명

```
faxi-app/
├── 📁 src/                    # 소스 코드 메인 폴더
│   ├── 📁 app/                # Next.js App Router (페이지들)
│   │   ├── 📁 (auth)/         # 인증 관련 페이지들
│   │   ├── 📁 (main)/         # 메인 앱 페이지들
│   │   ├── 📁 auth/           # 인증 API 라우트
│   │   ├── layout.tsx         # 전체 앱 레이아웃
│   │   ├── page.tsx           # 홈페이지
│   │   └── providers.tsx      # 전역 상태 관리자들
│   ├── 📁 components/         # 재사용 가능한 컴포넌트들
│   │   ├── 📁 domain/         # 비즈니스 로직 컴포넌트
│   │   └── 📁 ui/             # 기본 UI 컴포넌트들
│   ├── 📁 features/           # 기능별 모듈
│   ├── 📁 hooks/              # 커스텀 React 훅들
│   ├── 📁 lib/                # 유틸리티 함수들
│   └── 📁 stores/             # 상태 관리 스토어들
├── 📁 public/                 # 정적 파일들 (이미지, 폰트 등)
├── 📁 supabase/               # Supabase 설정
├── package.json               # 프로젝트 설정 및 의존성
├── next.config.ts            # Next.js 설정
├── tailwind.config.ts        # Tailwind CSS 설정
└── tsconfig.json             # TypeScript 설정
```

## 📦 라이브러리 설명

### 🎯 핵심 프레임워크
- **Next.js 15.1.0**: React 기반 풀스택 프레임워크
- **React 19.0.0**: 사용자 인터페이스 라이브러리
- **TypeScript 5**: 타입 안전성을 제공하는 JavaScript 확장

### 🎨 UI & 스타일링
- **Tailwind CSS**: 유틸리티 우선 CSS 프레임워크
- **Radix UI**: 접근성이 좋은 UI 컴포넌트 라이브러리
- **Framer Motion**: 애니메이션 라이브러리
- **Lucide React**: 아이콘 라이브러리

### 🔧 상태 관리 & 데이터
- **Zustand**: 가벼운 상태 관리 라이브러리
- **TanStack Query**: 서버 상태 관리 (API 데이터 캐싱)
- **React Hook Form**: 폼 상태 관리
- **Zod**: 데이터 검증 라이브러리

### 🌐 백엔드 & API
- **Supabase**: 백엔드 서비스 (데이터베이스, 인증, 파일 저장)
- **Axios**: HTTP 클라이언트 (API 요청)

### 🛠️ 개발 도구
- **ESLint**: 코드 품질 검사
- **PostCSS**: CSS 후처리기
- **Autoprefixer**: CSS 자동 접두사 추가

## 🚀 주요 기능별 구조

### 1. 인증 시스템
```
src/
├── components/auth-provider.tsx    # 인증 상태 관리
├── app/(auth)/                    # 로그인/회원가입 페이지
└── lib/supabase/                  # Supabase 클라이언트
```

### 2. 메시지 시스템
```
src/
├── features/messages/              # 메시지 관련 로직
├── app/(main)/compose/            # 메시지 작성 페이지
└── components/domain/              # 메시지 관련 컴포넌트
```

### 3. 친구 관리
```
src/
├── features/friends/               # 친구 관련 로직
├── app/(main)/friends/            # 친구 목록/추가 페이지
└── components/domain/              # 친구 관련 컴포넌트
```

### 4. 프린터 연동
```
src/
├── hooks/useBlePrinter.ts         # BLE 프린터 훅
├── app/(main)/printer/            # 프린터 관리 페이지
└── stores/printer.store.ts        # 프린터 상태 관리
```

## 📋 라이브러리 상세 설명

### UI 컴포넌트 (Radix UI)
- **@radix-ui/react-dialog**: 모달 다이얼로그
- **@radix-ui/react-toast**: 알림 메시지
- **@radix-ui/react-avatar**: 사용자 프로필 이미지
- **@radix-ui/react-switch**: 토글 스위치
- **@radix-ui/react-select**: 선택 박스
- **@radix-ui/react-dropdown-menu**: 드롭다운 메뉴

### 상태 관리
- **Zustand**: 전역 상태 관리 (사용자 정보, 프린터 상태 등)
- **TanStack Query**: 서버 데이터 캐싱 (친구 목록, 메시지 등)
- **React Hook Form**: 폼 상태 관리 (로그인, 메시지 작성 등)

### 유틸리티
- **date-fns**: 날짜/시간 처리
- **clsx**: CSS 클래스 조건부 적용
- **ts-pattern**: 패턴 매칭 (조건문 대신 사용)
- **es-toolkit**: 유틸리티 함수 모음

### 개발 도구
- **ESLint**: 코드 품질 검사
- **TypeScript**: 타입 안전성
- **Tailwind CSS**: 스타일링
- **PostCSS**: CSS 후처리

## 🎯 프로젝트 특징

### 1. 모던 React 패턴
- App Router 사용 (Next.js 13+)
- Server Components 활용
- TypeScript로 타입 안전성 확보

### 2. 접근성 중심
- Radix UI로 접근성 좋은 컴포넌트
- 키보드 네비게이션 지원
- 스크린 리더 호환

### 3. 성능 최적화
- TanStack Query로 서버 상태 캐싱
- Next.js의 자동 코드 분할
- Tailwind CSS로 최적화된 CSS

### 4. 개발자 경험
- TypeScript로 타입 안전성
- ESLint로 코드 품질 관리
- Hot Reload로 빠른 개발

## 🚀 실행 방법

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 코드 품질 검사
npm run lint
```

## 🔧 환경 설정

프로젝트 실행을 위해서는 다음 환경 변수가 필요합니다:

```bash
# .env.local 파일 생성
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

이 가이드를 통해 프로젝트의 전체적인 구조와 각 라이브러리의 역할을 이해할 수 있습니다! 🎉 