# 🔧 FAXI 푸시 알림 Service Worker 최종 설정 가이드

## 📱 FAXI 프로젝트 이해
**FAXI**는 BLE 감열 프린터와 연동되는 독특한 메시지 시스템입니다:
- **친한친구 메시지**: 자동으로 프린터 출력 (푸시 알림 불필요)
- **일반친구 메시지**: 수신자가 **프린트/거절** 선택 후 출력
- **친구 요청**: **수락/거절** 선택

## 🔧 수동 설정 작업 (중요!)

### 1. Service Worker 설정 검증
`/public/firebase-messaging-sw.js` 파일이 이미 올바르게 수정되었습니다:

```javascript
// 이미 적용된 올바른 액션 버튼
case 'new_message':
  return [
    { action: 'print', title: '프린트' },    // BLE 프린터로 출력
    { action: 'reject', title: '거절' }     // 메시지 거절
  ];
```

### 2. ⚠️ Firebase 설정값 확인 필요
**현재 Service Worker에 실제 Firebase 설정이 입력되어 있지만**, `.env.local` 파일과 일치하는지 확인:

**Service Worker에 입력된 값:**
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyA67t-32F3Ye6Z3CwZnTbG0cBVr7Auwk70",
  authDomain: "faxi-project-af213.firebaseapp.com",
  projectId: "faxi-project-af213",
  storageBucket: "faxi-project-af213.firebasestorage.app",
  messagingSenderId: "114890569305",
  appId: "1:114890569305:web:376bd1addd38e75ba36348"
};
```

**`.env.local`에 다음 값들이 동일하게 설정되어야 함:**
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyA67t-32F3Ye6Z3CwZnTbG0cBVr7Auwk70
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=faxi-project-af213.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=faxi-project-af213
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=faxi-project-af213.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=114890569305
NEXT_PUBLIC_FIREBASE_APP_ID=1:114890569305:web:376bd1addd38e75ba36348
NEXT_PUBLIC_FIREBASE_VAPID_KEY=[Firebase Console에서 생성 필요]
```

### 3. 아이콘 파일 추가
다음 파일들을 `/public/icons/` 폴더에 추가:
```
/public/icons/
├── faxi-badge.png          # FAXI 앱 로고 (72x72px)
└── default-avatar.png      # 기본 프로필 사진 (192x192px)
```

### 4. Firebase Console 추가 설정
1. **Cloud Messaging** → **Web Push certificates**에서 VAPID Key 생성
2. 생성된 VAPID Key를 `.env.local`에 `NEXT_PUBLIC_FIREBASE_VAPID_KEY`로 추가

## 🧪 테스트 방법

### Phase 1 & 2 완료 확인
```bash
# 1. 개발 서버 실행
npm run dev

# 2. 브라우저에서 확인
- Chrome DevTools → Application → Service Workers
- "firebase-messaging-sw.js" 등록 확인
- FCM 테스트 컴포넌트에서 토큰 발급 테스트
```

### FCM 테스트 컴포넌트 사용법
Phase 1에서 생성한 `FCMTestComponent`를 페이지에 추가하여 테스트:

```typescript
// 예: src/app/test/page.tsx
import { FCMTestComponent } from '@/components/test/FCMTestComponent';

export default function TestPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">푸시 알림 테스트</h1>
      <FCMTestComponent />
    </div>
  );
}
```

### Firebase Console에서 테스트 메시지 전송
1. Firebase Console → Cloud Messaging → "첫 번째 캠페인 보내기"
2. **알림 제목**: "친구에게서 메시지 도착!"
3. **알림 텍스트**: "새 메시지를 확인하고 프린트할까요?"
4. **추가 옵션** → **맞춤 데이터**:
   ```
   type: new_message
   senderId: test_user_123
   messageId: msg_456
   senderProfileImage: https://example.com/profile.jpg
   ```

## ✅ 확인 체크리스트

### Firebase & Service Worker
- [ ] `.env.local`에 모든 Firebase 환경 변수 설정
- [ ] Service Worker 등록 성공 (DevTools 확인)
- [ ] FCM 토큰 발급 성공
- [ ] 브라우저 알림 권한 허용

### 아이콘 & 리소스
- [ ] `/public/icons/faxi-badge.png` 추가
- [ ] `/public/icons/default-avatar.png` 추가
- [ ] Firebase Console VAPID Key 생성 및 설정

### 알림 동작 테스트
- [ ] 포그라운드에서 메시지 수신 테스트 (토스트 알림)
- [ ] 백그라운드에서 푸시 알림 수신 테스트
- [ ] 알림 클릭시 올바른 페이지 이동 확인
- [ ] 메시지 타입별 액션 버튼 표시 확인

## 🎯 FAXI 메시지 플로우 이해

### 일반친구 메시지 플로우
```
1. 메시지 전송 (sender)
   ↓
2. 'pending' 상태로 DB 저장
   ↓  
3. 수신자에게 푸시 알림 ("프린트/거절")
   ↓
4-A. "프린트" 클릭 → 승인 → BLE 프린터 출력
4-B. "거절" 클릭 → 거절 처리
```

### 친한친구 메시지 플로우  
```
1. 메시지 전송 (sender)
   ↓
2. DB 트리거로 'approved' 자동 설정
   ↓
3. 수신자 프린터에 즉시 자동 출력 (푸시 알림 불필요)
```

## 🚨 중요 주의사항

1. **Firebase 프로젝트 설정**: 실제 프로덕션 환경에서는 보안을 위해 도메인 제한 설정 필요

2. **Service Worker 캐싱**: 브라우저가 Service Worker를 캐시하므로, 수정 후에는 하드 리프레시 필요

3. **HTTPS 필수**: 푸시 알림은 HTTPS 환경에서만 동작 (localhost 제외)

4. **iOS Safari 제한**: Web Bluetooth API 미지원으로 iOS에서는 프린터 연결 불가

## 📞 문제 해결

### FCM 토큰이 발급되지 않는 경우
- VAPID Key 설정 확인
- 브라우저 알림 권한 허용 확인
- Firebase 프로젝트 설정 확인

### Service Worker가 등록되지 않는 경우
- 파일 경로 확인: `/public/firebase-messaging-sw.js`
- HTTPS 환경 확인
- 브라우저 콘솔 에러 메시지 확인

### 푸시 알림이 수신되지 않는 경우
- FCM 토큰 유효성 확인
- Firebase Console에서 메시지 전송 로그 확인
- Service Worker가 활성 상태인지 확인

---

**Phase 2 완료 후 Phase 3 (Supabase 백엔드 통합)으로 진행 가능합니다.**

위 설정을 완료하시면 FAXI의 푸시 알림 시스템이 정상 작동할 것입니다! 🎉