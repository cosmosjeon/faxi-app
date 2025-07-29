# 📁 Faxi App 코드 구조 가이드

## 🏗️ 전체 프로젝트 구조

```
faxi-app/
├── 📁 src/                          # 소스 코드 메인 폴더
│   ├── 📁 app/                      # Next.js App Router (페이지들)
│   │   ├── 📁 (auth)/              # 인증 관련 페이지들 (그룹)
│   │   │   ├── layout.tsx          # 인증 페이지 레이아웃
│   │   │   └── login/              # 로그인 페이지
│   │   │       └── page.tsx
│   │   ├── 📁 (main)/              # 메인 앱 페이지들 (그룹)
│   │   │   ├── layout.tsx          # 메인 앱 레이아웃
│   │   │   ├── home/               # 홈 페이지
│   │   │   │   └── page.tsx
│   │   │   ├── friends/            # 친구 관리 페이지
│   │   │   │   ├── page.tsx
│   │   │   │   └── add/
│   │   │   │       └── page.tsx
│   │   │   ├── compose/            # 메시지 작성 페이지
│   │   │   │   └── page.tsx
│   │   │   ├── printer/            # 프린터 관리 페이지
│   │   │   │   ├── page.tsx
│   │   │   │   └── photo-edit/     # 사진 편집 페이지
│   │   │   │       └── page.tsx
│   │   │   └── profile/            # 프로필 페이지
│   │   │       └── page.tsx
│   │   ├── 📁 auth/                # 인증 API 라우트
│   │   │   └── callback/
│   │   │       └── route.ts
│   │   ├── layout.tsx              # 전체 앱 레이아웃
│   │   ├── page.tsx                # 홈페이지
│   │   ├── providers.tsx           # 전역 상태 관리자들
│   │   ├── globals.css             # 전역 CSS 스타일
│   │   └── loading.tsx             # 로딩 컴포넌트
│   │
│   ├── 📁 components/               # 재사용 가능한 컴포넌트들
│   │   ├── 📁 domain/              # 비즈니스 로직 컴포넌트
│   │   │   ├── 📁 image/           # 이미지 관련 컴포넌트
│   │   │   │   └── ImageEditor.tsx
│   │   │   └── 📁 navigation/      # 네비게이션 컴포넌트
│   │   │       └── BottomTabBar.tsx
│   │   ├── 📁 ui/                  # 기본 UI 컴포넌트들 (shadcn/ui)
│   │   │   ├── button.tsx          # 버튼 컴포넌트
│   │   │   ├── dialog.tsx          # 다이얼로그 컴포넌트
│   │   │   ├── input.tsx           # 입력 필드 컴포넌트
│   │   │   ├── toast.tsx           # 토스트 알림 컴포넌트
│   │   │   └── ...                 # 기타 UI 컴포넌트들
│   │   └── auth-provider.tsx       # 인증 상태 관리 Provider
│   │
│   ├── 📁 features/                 # 기능별 모듈
│   │   ├── 📁 friends/             # 친구 관련 기능
│   │   │   ├── api.ts              # 친구 API 함수들
│   │   │   └── types.ts            # 친구 관련 타입 정의
│   │   └── 📁 messages/            # 메시지 관련 기능
│   │       ├── api.ts              # 메시지 API 함수들
│   │       └── types.ts            # 메시지 관련 타입 정의
│   │
│   ├── 📁 hooks/                   # 커스텀 React 훅들
│   │   ├── useBlePrinter.ts        # BLE 프린터 훅
│   │   └── use-toast.ts            # 토스트 알림 훅
│   │
│   ├── 📁 lib/                     # 라이브러리 및 유틸리티
│   │   ├── 📁 supabase/            # Supabase 관련
│   │   │   ├── client.ts           # 클라이언트 사이드 Supabase
│   │   │   └── server.ts           # 서버 사이드 Supabase
│   │   ├── utils.ts                # 공통 유틸리티 함수들
│   │   └── toasts.ts               # 토스트 메시지 설정
│   │
│   └── 📁 stores/                  # 상태 관리 스토어들 (Zustand)
│       ├── auth.store.ts           # 인증 상태 관리
│       └── printer.store.ts        # 프린터 상태 관리
│
├── 📁 public/                      # 정적 파일들
│   └── easynext.png               # 이미지 파일
│
├── 📁 supabase/                    # Supabase 설정
│   └── migrations/                 # 데이터베이스 마이그레이션
│
├── package.json                    # 프로젝트 설정 및 의존성
├── next.config.ts                 # Next.js 설정
├── tailwind.config.ts             # Tailwind CSS 설정
├── tsconfig.json                  # TypeScript 설정
├── schema.sql                     # 데이터베이스 스키마
└── PROJECT_GUIDE.md               # 프로젝트 가이드
```

## 📋 주요 파일별 역할 설명

### 🎯 핵심 설정 파일들

#### `package.json`
- **역할**: 프로젝트 메타데이터, 의존성 관리, 스크립트 정의
- **주요 내용**: 
  - 프로젝트 정보 (이름, 버전)
  - npm 스크립트 (dev, build, start, lint)
  - 프로덕션 의존성 (React, Next.js, Supabase 등)
  - 개발 의존성 (TypeScript, ESLint, Tailwind CSS 등)

#### `next.config.ts`
- **역할**: Next.js 프레임워크 설정
- **주요 설정**:
  - ESLint 빌드 시 무시 설정
  - 이미지 도메인 허용 설정
  - 보안 헤더 설정 (CSP, X-Frame-Options 등)

#### `tailwind.config.ts`
- **역할**: Tailwind CSS 프레임워크 설정
- **주요 설정**:
  - 다크모드 설정
  - 커스텀 색상 팔레트
  - 애니메이션 키프레임
  - 플러그인 설정

#### `tsconfig.json`
- **역할**: TypeScript 컴파일러 설정
- **주요 설정**:
  - 타입 체크 규칙
  - 모듈 해석 방식
  - 경로 별칭 (@/ → src/)

### 🏠 앱 구조 파일들

#### `src/app/layout.tsx`
- **역할**: 전체 앱의 루트 레이아웃
- **주요 기능**:
  - HTML 문서 구조 정의
  - 폰트 설정 (Geist Sans, Geist Mono)
  - 메타데이터 설정 (SEO)
  - 전역 Provider 감싸기

#### `src/app/providers.tsx`
- **역할**: 전역 상태 관리자들을 감싸는 Provider
- **주요 Provider들**:
  - `ThemeProvider`: 다크모드/라이트모드 전환
  - `QueryClientProvider`: 서버 상태 관리 (TanStack Query)
  - `AuthProvider`: 인증 상태 관리
  - `Toaster`: 토스트 알림 표시

#### `src/app/globals.css`
- **역할**: 전역 CSS 스타일
- **주요 내용**:
  - Tailwind CSS 기본 스타일
  - CSS 변수 정의 (색상 팔레트)
  - 다크모드 색상 설정
  - 기본 스타일 리셋

### 🔐 인증 시스템

#### `src/components/auth-provider.tsx`
- **역할**: 인증 상태를 전역적으로 관리하는 Provider
- **주요 기능**:
  - 초기 인증 상태 확인
  - 인증 상태 변경 감지
  - 개발/프로덕션 모드 구분
  - 세션 관리

#### `src/stores/auth.store.ts`
- **역할**: Zustand를 사용한 인증 상태 관리
- **주요 기능**:
  - 사용자 정보, 세션, 프로필 상태 관리
  - OAuth 로그인 (Google, Kakao)
  - 개발용 로그인 (테스트용)
  - 로그아웃 처리
  - 프로필 정보 가져오기

#### `src/lib/supabase/client.ts`
- **역할**: Supabase 클라이언트 설정
- **주요 설정**:
  - 환경 변수에서 Supabase URL, API 키 가져오기
  - 인증 플로우 설정 (Implicit Flow)
  - 세션 감지 설정

### 🎨 UI 컴포넌트들

#### `src/components/domain/navigation/BottomTabBar.tsx`
- **역할**: 하단 탭바 네비게이션
- **주요 기능**:
  - 5개 탭 (홈, 친구, 전송, 프린터, 프로필)
  - 현재 페이지 활성 상태 표시
  - 아이콘과 라벨 표시
  - 클릭 시 페이지 이동

#### `src/components/ui/`
- **역할**: shadcn/ui 기반의 재사용 가능한 UI 컴포넌트들
- **주요 컴포넌트들**:
  - `button.tsx`: 버튼 컴포넌트
  - `dialog.tsx`: 모달 다이얼로그
  - `input.tsx`: 입력 필드
  - `toast.tsx`: 알림 메시지
  - `card.tsx`: 카드 컨테이너

### 🔧 기능별 모듈

#### `src/features/friends/`
- **역할**: 친구 관리 기능
- **파일들**:
  - `api.ts`: 친구 관련 API 호출 함수들
  - `types.ts`: 친구 관련 TypeScript 타입 정의

#### `src/features/messages/`
- **역할**: 메시지 관리 기능
- **파일들**:
  - `api.ts`: 메시지 관련 API 호출 함수들
  - `types.ts`: 메시지 관련 TypeScript 타입 정의

### 🎣 커스텀 훅들

#### `src/hooks/useBlePrinter.ts`
- **역할**: BLE 프린터 연결 및 제어
- **주요 기능**:
  - 프린터 연결/해제
  - 프린트 명령 전송
  - 연결 상태 관리
  - 오류 처리

#### `src/hooks/use-toast.ts`
- **역할**: 토스트 알림 사용을 위한 훅
- **주요 기능**:
  - 성공/오류/경고 메시지 표시
  - 자동 사라짐 설정
  - 커스텀 스타일링

### 🗄️ 상태 관리

#### `src/stores/`
- **역할**: Zustand를 사용한 전역 상태 관리
- **스토어들**:
  - `auth.store.ts`: 인증 상태 관리
  - `printer.store.ts`: 프린터 상태 관리

### 🛠️ 유틸리티

#### `src/lib/utils.ts`
- **역할**: 공통 유틸리티 함수들
- **주요 함수들**:
  - `cn()`: CSS 클래스 합성 함수
  - 기타 헬퍼 함수들

## 🚀 개발 워크플로우

### 1. 개발 서버 실행
```bash
npm run dev
```

### 2. 코드 품질 검사
```bash
npm run lint
```

### 3. 프로덕션 빌드
```bash
npm run build
```

### 4. 프로덕션 서버 실행
```bash
npm run start
```

## 🔧 환경 설정

### 필수 환경 변수
```bash
# .env.local 파일 생성
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📚 학습 포인트

### 1. Next.js App Router
- 파일 기반 라우팅
- 서버/클라이언트 컴포넌트 구분
- 레이아웃 중첩

### 2. TypeScript
- 타입 안전성
- 인터페이스 정의
- 제네릭 사용

### 3. 상태 관리
- Zustand (전역 상태)
- TanStack Query (서버 상태)
- React Hook Form (폼 상태)

### 4. UI/UX
- Tailwind CSS (스타일링)
- Radix UI (접근성)
- Framer Motion (애니메이션)

### 5. 백엔드 연동
- Supabase (BaaS)
- OAuth 인증
- 실시간 데이터

이 가이드를 통해 프로젝트의 전체적인 구조와 각 파일의 역할을 이해할 수 있습니다! 🎉 