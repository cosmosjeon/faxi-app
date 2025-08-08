# 🔧 Service Worker 설정 가이드

## 필수 설정 작업

### 1. Service Worker 파일 수정
`/public/firebase-messaging-sw.js` 파일에서 다음 부분을 실제 Firebase 프로젝트 정보로 교체:

```javascript
// 현재 placeholder 값들을 실제 값으로 변경
const firebaseConfig = {
  apiKey: "실제_API_KEY",
  authDomain: "실제_PROJECT_ID.firebaseapp.com", 
  projectId: "실제_PROJECT_ID",
  storageBucket: "실제_PROJECT_ID.appspot.com",
  messagingSenderId: "실제_MESSAGING_SENDER_ID",
  appId: "실제_APP_ID"
};
```

### 2. 아이콘 파일 준비 (사용자 상호작용 최적화)
다음 아이콘 파일들을 `/public/icons/` 폴더에 추가:
- `faxi-badge.png` (FAXI 앱 로고 - 알림 배지용, 72x72px 권장)
- `default-avatar.png` (기본 프로필 사진 - 192x192px 권장)

**중요 개선사항**: 
- ✅ 알림 아이콘: 보낸 사람의 프로필 사진을 동적으로 사용
- ✅ 알림 배지: FAXI 앱 로고 고정 사용  
- ✅ 프로필 사진이 없는 경우 `default-avatar.png` 폴백
- ✅ 메시지 타입별 액션 버튼 (수락/거절, 답장/보기)
- ✅ 메시지에 이미지가 있는 경우 알림에 이미지 표시

### 3. Firebase Console 추가 설정
1. **Cloud Messaging** 탭에서 **Web Push certificates** 생성
2. **VAPID Key** 복사하여 `.env.local`에 `NEXT_PUBLIC_FIREBASE_VAPID_KEY` 설정

### 4. 테스트 방법
1. 개발 서버 실행: `npm run dev`
2. Chrome DevTools → Application → Service Workers 확인
3. FCM 테스트 컴포넌트에서 토큰 발급 테스트
4. Firebase Console에서 테스트 메시지 전송

## ✅ 확인사항
- [ ] Service Worker 등록 성공
- [ ] FCM 토큰 발급 성공 
- [ ] 브라우저 알림 권한 허용
- [ ] 포그라운드/백그라운드 메시지 수신 테스트

## 다음 단계
설정 완료 후 Phase 3 (Supabase 백엔드 통합)으로 진행 가능합니다.