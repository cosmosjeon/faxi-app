# FAXI MVP - API 명세서

## 🎯 MVP 우선순위 안내
**중요**: 이 문서의 모든 API는 MVP 기준으로 작성되었습니다.
- ✅ **필수**: MVP에 반드시 필요한 핵심 API
- ⚡ **간소화**: 복잡도를 줄인 MVP 버전
- 🔄 **Mock**: 실제 구현 전 Mock 데이터 사용
- ❌ **제외**: MVP 이후 구현 예정

## 목차
1. [핵심 API 요약](#핵심-api-요약)
2. [인증 API](#인증-api)
3. [친구 관리 API](#친구-관리-api)
4. [메시지 API](#메시지-api)
5. [프린터 API](#프린터-api)
6. [실시간 구독 API](#실시간-구독-api)
7. [설정 API](#설정-api)
8. [에러 처리 가이드](#에러-처리-가이드)

---

## 핵심 API 요약

### MVP 필수 기능 (우선순위 순)
1. **로그인/로그아웃** - OAuth 인증
2. **메시지 전송/수신** - 텍스트, 이미지, LCD 티저
3. **친구 추가/목록** - 기본 친구 관계
4. **친한친구 관리** - 자동 프린트 설정
5. **프린터 연결** - Mock → 실제 BLE 전환
6. **실시간 알림** - 새 메시지, 친구 요청

### API 호출 흐름 예시
```
1. 로그인 → 2. 프로필 조회 → 3. 친구 목록 → 4. 메시지 전송
                           ↘ 5. 실시간 구독 시작
```

---

## 인증 API

### 1. ✅ OAuth 로그인 (필수)
```typescript
// 함수명: signInWithOAuth(provider)
// 위치: src/stores/auth.store.ts

// 사용 예시
await authStore.signInWithOAuth("google");  // 또는 "kakao"

// 응답
성공: 자동으로 /home으로 리다이렉트
실패: 에러 토스트 표시

// 주의사항
- Implicit 플로우 사용 (추가 서버 설정 불필요)
- 로그인 후 자동으로 프로필 조회 실행됨
```

### 2. ✅ 로그아웃 (필수)
```typescript
// 함수명: signOut()
// 위치: src/stores/auth.store.ts

// 사용 예시
await authStore.signOut();

// 동작
1. Supabase 세션 종료
2. 로컬 상태 초기화
3. /login으로 리다이렉트
```

### 3. ✅ 현재 사용자 확인 (필수)
```typescript
// Zustand store에서 직접 접근
const user = authStore.user;
const profile = authStore.profile;

// 인증 여부 확인
if (!user) {
  // 로그인 필요
}
```

---

## 친구 관리 API

### 1. ✅ 친구 검색 (필수)
```typescript
// 함수명: searchUserByUsername(username)
// 위치: src/features/friends/api.ts

// 사용 예시
const results = await searchUserByUsername("john");

// 응답 타입
SearchResult[] = [{
  id: string,
  username: string,
  display_name: string,
  avatar_url?: string
}]

// 제한사항
- 최대 10명 반환
- 비활성 사용자 제외
```

### 2. ✅ 친구 목록 조회 (필수)
```typescript
// 함수명: getFriendsList(userId)
// 위치: src/features/friends/api.ts

// 사용 예시
const friends = await getFriendsList(currentUser.id);

// 응답에 포함된 정보
- 친구 프로필 (이름, 아바타)
- 친구 상태 (pending, accepted)
- 친한친구 여부
- 맞팔 여부 (isMutual)
```

### 3. ✅ 친구 추가/수락/거절 (필수)
```typescript
// 친구 추가
await addFriend({ friend_id: "user-id" }, currentUserId);

// 친구 수락
await acceptFriendRequest(friendshipId);

// 친구 거절/삭제
await rejectFriendRequest(friendshipId);  // 또는 removeFriend()
```

### 4. ⚡ 친한친구 신청/수락 (간소화)
```typescript
// 친한친구 신청 (일반 친구만 가능)
await sendCloseFriendRequest(targetUserId, currentUserId);

// 친한친구 수락 (RPC 함수 사용 - 양방향 설정)
await acceptCloseFriendRequest(requestId);

// 친한친구 해제
await removeCloseFriend(currentUserId, friendId);
```

---

## 메시지 API

### 1. ✅ 메시지 전송 (필수)
```typescript
// 함수명: sendMessage(request, senderId)
// 위치: src/features/messages/api.ts

// 사용 예시
const message = await sendMessage({
  receiver_id: "friend-id",
  content: "안녕하세요!",           // 선택 (최대 200자)
  image_file: File,                // 선택 (최대 5MB)
  lcd_teaser: "안녕"               // 선택 (최대 10자)
}, currentUserId);

// 검증 규칙
- content 또는 image_file 중 하나는 필수
- 이미지: JPG/PNG만, 5MB 이하
- 친한친구면 자동으로 print_status = 'approved'
```

### 2. ✅ 메시지 목록 조회 (필수)
```typescript
// 함수명: getMessagesList(userId)
// 위치: src/features/messages/api.ts

// 사용 예시
const messages = await getMessagesList(currentUserId);

// 응답 구조
messages = [{
  ...메시지정보,
  sender_profile: { 이름, 아바타 },
  receiver_profile: { 이름, 아바타 },
  print_status: "pending" | "approved" | "queued" | "completed" | "failed"
}]
```

### 3. ✅ 프린트 승인/거절 (필수)
```typescript
// 승인
await updateMessagePrintStatus(messageId, "approved");

// 거절
await updateMessagePrintStatus(messageId, "failed");

// 상태 흐름
pending → approved → queued(프린터 미연결) → completed
                  ↘ failed (거절 또는 오류)
```

### 4. 🔄 이미지 업로드 (Mock 가능)
```typescript
// Storage 미설정 시 Mock URL 반환
const result = await uploadMessageImage(file, senderId);

// Mock 응답
{
  url: "https://via.placeholder.com/400",
  path: "mock-path"
}
```

---

## 프린터 API

### 1. 🔄 프린터 연결 (Mock → 실제)
```typescript
// 개발 단계별 접근
// 1단계: Mock 프린터 사용
const mockDevice = {
  name: "Mock Printer",
  id: "mock-001"
};
printerStore.selectMockDevice(mockDevice);

// 2단계: 실제 BLE 연결 (Chrome PWA에서만)
if (printerStore.bleSupported) {
  await printerStore.connectPrinter();
}
```

### 2. ✅ 메시지 프린트 (필수)
```typescript
// 함수명: printMessage(messageData)
// 위치: src/hooks/useBlePrinter.ts

// 사용 예시
const jobId = await printMessage({
  text: "안녕하세요!",
  imageUrl: "https://...",
  lcdTeaser: "안녕",
  senderName: "홍길동"
});

// Mock 프린터 동작
- 3초 후 자동 완료
- 콘솔에 프린트 내용 출력
```

### 3. ⚡ 프린트 큐 관리 (간소화)
```typescript
// 큐에 있는 메시지 자동 처리
const queuedMessages = await getQueuedMessages(userId);
for (const msg of queuedMessages) {
  await printMessage(msg);
}
```

---

## 실시간 구독 API

### 1. ✅ 통합 실시간 구독 (필수)
```typescript
// 함수명: useRealtime(userId)
// 위치: src/hooks/useRealtime.ts

// 한 번의 호출로 모든 구독 설정
useRealtime(userId);

// 자동으로 구독되는 항목:
1. 새 메시지 알림
2. 친구 요청 알림
3. 친한친구 신청 알림
4. 메시지 상태 변경
```

### 2. ⚡ 개별 이벤트 처리 (간소화)
```typescript
// RealtimeProvider에서 자동 처리
// 컴포넌트에서는 토스트 알림으로 확인

// 새 메시지
"새 메시지가 도착했습니다!"

// 친구 요청
"새로운 친구 요청이 있습니다!"

// 프린트 완료
"메시지가 프린트되었습니다!"
```

---

## 설정 API

### 1. ⚡ 핵심 설정만 관리 (간소화)
```typescript
// MVP에서 관리하는 설정
interface MVPSettings {
  auto_print_close_friends: boolean;  // 친한친구 자동 프린트
  message_notifications: boolean;      // 메시지 알림
}

// 사용 예시
await updateNotificationSettings({
  user_id: currentUserId,
  settings: {
    auto_print_close_friends: true
  }
});
```

### 2. ❌ MVP에서 제외된 설정
- 마케팅 알림
- 프로필 공개 범위
- 온라인 상태 표시
- FAQ 시스템
- 계정 비활성화

---

## 에러 처리 가이드

### 1. 공통 에러 패턴
```typescript
try {
  const result = await apiFunction();
  // 성공 처리
} catch (error) {
  // 사용자에게 보여줄 메시지만 표시
  toast.error("작업을 완료할 수 없습니다.");
  console.error(error);  // 개발자용 로그
}
```

### 2. MVP 에러 처리 원칙
```typescript
// ❌ 과도한 에러 처리
if (!data) throw new Error("Data is null");
if (!data.id) throw new Error("ID is missing");
if (!data.name) throw new Error("Name is missing");

// ✅ 간단한 에러 처리
if (!data?.id) {
  toast.error("잘못된 데이터입니다.");
  return;
}
```

### 3. 주요 에러 케이스
| 상황 | 사용자 메시지 | 개발자 액션 |
|------|--------------|------------|
| 네트워크 오류 | "연결할 수 없습니다" | 재시도 로직 |
| 인증 만료 | "다시 로그인해주세요" | /login 리다이렉트 |
| 중복 요청 | "이미 처리된 요청입니다" | 무시 |
| 서버 오류 | "잠시 후 다시 시도해주세요" | 로그 확인 |

---

## 🚀 다음 단계 체크리스트

### Phase 1: Mock 테스트 (현재)
- [x] Mock 프린터로 전체 플로우 테스트
- [x] 기본 기능 동작 확인
- [ ] PWA 설정 및 테스트

### Phase 2: 실제 프린터 연동
- [ ] Web Bluetooth API 구현
- [ ] 오픈 프로토콜 프린터 테스트
- [ ] 에러 복구 로직 추가

### Phase 3: 출시 준비
- [ ] Google Play TWA 래핑
- [ ] 성능 최적화 (필요시)
- [ ] 사용자 피드백 수집

---

## 📝 개발자 메모

### Supabase 무료 티어 제한
- Realtime 연결: 200개 (동시 사용자)
- Storage: 1GB (이미지 저장)
- Database: 500MB

### 주의사항
1. **오버 엔지니어링 금지**: 복잡한 패턴 사용 X
2. **Mock 우선**: 실제 구현 전 Mock으로 테스트
3. **에러 간소화**: 사용자 친화적 메시지만
4. **주석 필수**: 초보자도 이해 가능하게

---
