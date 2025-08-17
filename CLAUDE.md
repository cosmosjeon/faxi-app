# FAXI 프로젝트 - Claude Code 설정

## 📋 프로젝트 개요

**FAXI**는 디지털 메시지를 물리적 감열 프린터로 출력하는 혁신적인 오프라인 SNS 플랫폼입니다.

- **기술 스택**: Next.js 15 + Supabase + Web Bluetooth API
- **현재 상태**: MVP 85% 완료 (2025-08-06 기준)
- **타겟 플랫폼**: PWA (Android, Desktop), iOS는 Phase 2에서 지원 예정
- **핵심 기능**: 1:1 메시지 전송, BLE 프린터 연동, 실시간 알림

## 🏗️ 프로젝트 구조

```
faxi-app/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # 인증 관련 페이지 ✅
│   │   ├── (main)/            # 메인 서비스 페이지 ✅
│   │   └── auth/callback/     # OAuth 콜백 ✅
│   ├── components/
│   │   ├── ui/                # shadcn/ui 기반 UI 컴포넌트 ✅
│   │   └── domain/            # 도메인 특화 컴포넌트 ✅
│   ├── features/              # 기능별 API/타입 정의 ✅
│   ├── hooks/                 # 커스텀 훅 ✅
│   ├── lib/                   # 유틸리티 및 설정 ✅
│   └── stores/                # Zustand 상태 관리 ✅
├── supabase/
│   ├── functions/             # Edge Functions ⚠️
│   └── migrations/            # DB 마이그레이션 ✅
└── docs/                      # 프로젝트 문서
    ├── PRD.md                 # 제품 요구사항 ✅
    ├── TRD.md                 # 기술 요구사항 ✅
    └── api명세서.md           # API 문서 ✅
```

## 🎯 현재 상태별 기능

### ✅ 완전 구현된 기능
- **인증**: Google/Kakao 소셜 로그인
- **사용자 관리**: 프로필, 온보딩
- **친구 시스템**: 친구 추가/삭제, 친한친구 관리
- **메시징**: 리치 메시지 작성/전송 (텍스트 + 이미지)
- **실시간 통신**: Supabase Realtime 기반
- **BLE 프린터**: Web Bluetooth API 연동
- **이미지 처리**: Canvas 기반 편집, 감열 프린터 최적화

### 🟡 부분 구현/수정 필요
- **Settings 페이지**: UI는 있으나 로직 미완성
  - `/profile/notifications` - 알림 설정 기능 필요
  - `/profile/privacy` - 개인정보 설정 기능 필요
  - 프로필 편집 기능 완성 필요

### ❌ 미구현 기능  
- **Photo Editor**: `/printer/photo-edit` 라우트만 존재, 실제 페이지 구현 필요
- **푸시 알림**: FCM/Web Push 시스템 전체 구현 필요

## 🔧 개발 환경 및 스크립트

### 주요 명령어
```bash
# 개발 서버 실행 (Turbopack 사용)
npm run dev

# 프로덕션 빌드
npm run build

# 린트 검사
npm run lint

# Supabase 관련
npx supabase start      # 로컬 Supabase 시작
npx supabase db reset   # DB 리셋 및 마이그레이션
```

### 환경 변수
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 📝 코딩 스타일 및 컨벤션

### TypeScript 컨벤션
- 모든 파일에 타입 정의 필수
- API 응답은 `features/*/types.ts`에 인터페이스 정의
- Zod 스키마를 통한 런타임 검증 활용

### 컴포넌트 구조
```typescript
// UI 컴포넌트: shadcn/ui 기반, Radix UI 사용
import { Button } from "@/components/ui/button"

// 도메인 컴포넌트: 비즈니스 로직 포함
import { MessageCard } from "@/components/domain/messages/MessageCard"

// 훅: use- 접두사, 단일 책임 원칙
const useBlePrinter = () => { /* ... */ }
```

### 상태 관리
- **로컬 상태**: React useState/useReducer
- **서버 상태**: TanStack Query (React Query)
- **전역 상태**: Zustand (auth, printer, realtime)

### API 구조
```typescript
// features/{domain}/api.ts 패턴
export const sendMessage = async (data: SendMessageRequest): Promise<Message>
export const getFriendsWithProfiles = (): Promise<FriendWithProfile[]>
```

## 🔍 주요 디렉토리별 역할

### `/src/app` - Next.js App Router
- `(auth)`: 로그인, 온보딩 페이지
- `(main)`: 인증된 사용자용 메인 서비스 페이지
- 레이아웃과 미들웨어를 통한 라우트 보호 구현

### `/src/features` - 도메인별 비즈니스 로직
- `friends/`: 친구 관리 API 및 타입
- `messages/`: 메시지 송수신 API 및 타입  
- `settings/`: 사용자 설정 관리 (부분 구현)

### `/src/hooks` - 재사용 가능한 로직
- `useBlePrinter.ts`: BLE 프린터 통신 핵심 로직
- `useRealtime*.ts`: Supabase Realtime 관련 훅들
- `queries/`: TanStack Query 훅들

### `/src/stores` - 전역 상태 관리
- `auth.store.ts`: 인증 상태 (사용자, 프로필)
- `printer.store.ts`: 프린터 연결 상태
- `realtimeStore.ts`: 실시간 이벤트 관리

## 🚀 MVP 완성을 위한 작업 가이드

### 우선순위 1: Settings 페이지 완성
```typescript
// 구현 필요: /profile/notifications
interface NotificationSettings {
  push_messages: boolean
  push_friend_requests: boolean  
  push_print_status: boolean
}

// 구현 필요: /profile/privacy  
interface PrivacySettings {
  profile_visibility: 'public' | 'friends_only'
  allow_friend_requests: boolean
  show_online_status: boolean
}
```

### 우선순위 2: Photo Editor 완성
- `/printer/photo-edit` 페이지 실제 구현
- 감열 프린터용 이미지 최적화 UI
- 프린트 미리보기 기능

## 🧪 테스트 및 QA

### 테스트 우선순위
1. **BLE 연결**: Chrome/Edge에서 실제 프린터 테스트
2. **실시간 메시징**: 다중 브라우저 탭에서 동기화 확인  
3. **이미지 처리**: 다양한 크기/형식 이미지 업로드 테스트
4. **모바일 PWA**: Android 브라우저에서 설치/동작 확인

### 지원 브라우저
- ✅ Chrome 120+ (Android/Desktop) - 완전 지원
- ✅ Edge 120+ (Desktop) - 완전 지원  
- ⚠️ Firefox 120+ (Desktop) - BLE 제한적
- ❌ Safari (iOS) - Web Bluetooth 미지원

## 📊 성능 고려사항

### 현재 최적화 상태
- React Query 캐싱 활성화 (30초 stale, 5분 cache)
- Next.js Image 컴포넌트로 이미지 최적화
- Dynamic import를 통한 컴포넌트 지연 로딩

### 추가 필요 최적화
- 메시지 목록 가상화 (사용자 증가시)
- Service Worker 기반 오프라인 지원
- 이미지 CDN 캐싱 전략

## ⚠️ 알려진 제약사항

### 기술적 제약
- **iOS Safari**: Web Bluetooth API 미지원으로 프린터 연결 불가
- **PWA 제한**: 네이티브 앱 대비 제한적인 기기 접근 권한
- **BLE 안정성**: 일부 Android 기기에서 연결 불안정 가능

### 대응 방안
- iOS 지원: Phase 2에서 Native App 또는 대안 기술 검토
- 연결 안정성: 재시도 로직 및 상세한 에러 메시지 제공

## 🔗 관련 문서

- **PRD.md**: 제품 요구사항 및 비즈니스 로직
- **TRD.md**: 상세한 기술 아키텍처 및 구현 상태
- **api명세서.md**: API 엔드포인트 상세 문서
- **ai코드리뷰_가이드.md**: 코드 리뷰 가이드라인

## 🎯 다음 마일스톤

### MVP 완성 (2주 내)
1. Settings 페이지 로직 구현
2. Photo Editor 완전 구현  
3. 실제 BLE 프린터 테스트
4. 프로덕션 배포 준비

### Post-MVP (1-3개월)
1. 푸시 알림 시스템 구현
2. iOS 네이티브 앱 개발 검토
3. 성능 최적화 및 스케일링

---

**중요**: 이 프로젝트는 Web Bluetooth API를 핵심으로 하는 혁신적인 오프라인 SNS입니다. BLE 프린터 연동이 핵심 기능이므로, 모든 개발과 테스트에서 실제 하드웨어 연동을 고려해주세요.