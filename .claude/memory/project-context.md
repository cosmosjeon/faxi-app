# FAXI 프로젝트 메모리

## 프로젝트 현황
- **완성도**: MVP 85% (2025-08-06 기준)
- **핵심 기능**: BLE 프린터 연동 오프라인 SNS
- **기술 스택**: Next.js 15 + Supabase + Web Bluetooth API

## 주요 완성 기능
- ✅ 소셜 로그인 (Google/Kakao)
- ✅ 친구 관리 시스템
- ✅ 실시간 메시징
- ✅ BLE 프린터 연동
- ✅ 이미지 편집 및 처리

## 미완성/수정 필요 기능
- 🟡 Settings 페이지 (UI는 있으나 로직 부족)
- ❌ Photo Editor (/printer/photo-edit 라우트만 존재)
- ❌ 푸시 알림 시스템

## 아키텍처 정보
- **상태 관리**: Zustand (전역), TanStack Query (서버), React useState (로컬)
- **UI**: shadcn/ui + Radix UI + Tailwind CSS
- **데이터베이스**: PostgreSQL (Supabase 관리)
- **실시간**: Supabase Realtime (WebSocket)
- **배포**: Vercel (Frontend), Supabase (Backend)

## 중요 제약사항
- Web Bluetooth API로 인한 iOS Safari 미지원
- BLE 프린터 하드웨어 의존성
- PWA 기능 제한

## 우선순위 작업
1. Settings 페이지 완성
2. Photo Editor 구현
3. 실제 BLE 프린터 테스트