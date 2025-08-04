# Supabase Secrets 설정 가이드

## 푸시 알림 인프라 구축을 위한 환경 변수 설정

### 1. FCM (Firebase Cloud Messaging) 설정

#### 1.1 Firebase 프로젝트 설정
1. [Firebase Console](https://console.firebase.google.com/)에 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. 프로젝트 설정 > 클라우드 메시징 탭으로 이동
4. 서버 키 복사 (FCM_SERVER_KEY)

#### 1.2 Supabase Secrets에 FCM 설정 추가
```bash
# Supabase CLI를 사용하여 secrets 설정
supabase secrets set FCM_SERVER_KEY=your_fcm_server_key_here
```

### 2. APNs (Apple Push Notification service) 설정

#### 2.1 Apple Developer 계정 설정
1. [Apple Developer](https://developer.apple.com/) 계정에 로그인
2. Certificates, Identifiers & Profiles > Keys로 이동
3. 새 키 생성 (APNs 키)
4. 키 ID, 팀 ID, 번들 ID 확인

#### 2.2 APNs 인증 키 파일 준비
1. 생성한 APNs 키를 다운로드 (.p8 파일)
2. 키 파일 내용을 Base64로 인코딩

#### 2.3 Supabase Secrets에 APNs 설정 추가
```bash
# APNs 설정을 Supabase Secrets에 추가
supabase secrets set APNS_KEY_ID=your_apns_key_id
supabase secrets set APNS_TEAM_ID=your_team_id
supabase secrets set APNS_BUNDLE_ID=com.yourcompany.faxi
supabase secrets set APNS_PRIVATE_KEY=your_base64_encoded_private_key
```

### 3. 환경 변수 목록

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `FCM_SERVER_KEY` | Firebase 서버 키 | `AAAA...` |
| `APNS_KEY_ID` | APNs 키 ID | `ABC123DEF4` |
| `APNS_TEAM_ID` | Apple 팀 ID | `TEAM123456` |
| `APNS_BUNDLE_ID` | 앱 번들 ID | `com.yourcompany.faxi` |
| `APNS_PRIVATE_KEY` | APNs 개인키 (Base64) | `MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...` |

### 4. 설정 확인

#### 4.1 Supabase Dashboard에서 확인
1. Supabase 프로젝트 대시보드 접속
2. Settings > API > Environment Variables
3. 설정된 환경 변수들이 표시되는지 확인

#### 4.2 Edge Function 배포
```bash
# Edge Function 배포
supabase functions deploy send-push-notification
```

### 5. 테스트

#### 5.1 로컬 테스트
```bash
# 로컬에서 Edge Function 테스트
supabase functions serve send-push-notification --env-file .env.local
```

#### 5.2 테스트 요청 예시
```bash
curl -X POST http://localhost:54321/functions/v1/send-push-notification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_anon_key" \
  -d '{
    "recipient_user_id": "user-uuid",
    "title": "테스트 알림",
    "body": "푸시 알림이 정상적으로 작동합니다",
    "data": {
      "type": "test",
      "message_id": "test-123"
    }
  }'
```

### 6. 문제 해결

#### 6.1 FCM 오류
- 서버 키가 올바른지 확인
- Firebase 프로젝트 설정 확인
- 클라이언트 토큰이 유효한지 확인

#### 6.2 APNs 오류
- 키 ID, 팀 ID, 번들 ID가 정확한지 확인
- 개인키가 올바르게 인코딩되었는지 확인
- APNs 인증서가 유효한지 확인

#### 6.3 일반적인 문제
- 환경 변수가 올바르게 설정되었는지 확인
- Edge Function이 성공적으로 배포되었는지 확인
- Supabase 로그에서 오류 메시지 확인

### 7. 보안 고려사항

1. **환경 변수 보호**: 프로덕션 환경에서는 환경 변수를 안전하게 관리
2. **키 순환**: 정기적으로 FCM/APNs 키를 갱신
3. **접근 제어**: Edge Function에 적절한 인증/인가 적용
4. **로깅**: 민감한 정보가 로그에 노출되지 않도록 주의

### 8. 모니터링

#### 8.1 Supabase 로그 확인
```bash
# Edge Function 로그 확인
supabase functions logs send-push-notification
```

#### 8.2 성공률 모니터링
- 발송 성공/실패 비율 추적
- 토큰 만료율 모니터링
- 응답 시간 측정

### 9. 다음 단계

1. 클라이언트에서 토큰 등록 구현
2. 알림 권한 요청 UI 구현
3. 알림 설정 페이지 구현
4. 실시간 알림 테스트 