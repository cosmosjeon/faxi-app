# 알림 설정 오류 디버깅 가이드

## 문제 원인

데이터베이스에 새로운 알림 설정 필드들이 아직 추가되지 않았기 때문에 발생하는 오류입니다.

## 해결 방법

### 1단계: 데이터베이스 마이그레이션 실행

1. **Supabase 대시보드**에 접속하세요
2. **SQL Editor**로 이동하세요
3. `manual_migration.sql` 파일의 내용을 복사해서 실행하세요

### 2단계: 앱 새로고침

1. 브라우저에서 **F5** 또는 **Ctrl+R**로 새로고침
2. 개발자 도구 콘솔을 열어서 로그 확인

### 3단계: 테스트

1. 프로필 → 알림 설정으로 이동
2. 토글 스위치를 켜보세요
3. 콘솔에서 다음과 같은 로그들을 확인하세요:
   - "사용자 설정 조회 시작"
   - "사용자 설정 조회 결과"
   - "설정 변경 시작"
   - "업데이트 요청"
   - "업데이트 결과"

## 디버깅 정보

### 콘솔에서 확인할 로그들:

1. **설정 로드 시**:

   ```
   사용자 설정 조회 시작: [user_id]
   사용자 설정 조회 결과: {data: {...}, error: null}
   완성된 설정 데이터: {message_notifications: true, ...}
   ```

2. **설정 변경 시**:
   ```
   설정 변경 시작: {key: "message_notifications", value: true, userId: "..."}
   업데이트 요청: {user_id: "...", settings: {message_notifications: true}}
   알림 설정 업데이트 요청: {...}
   업데이트 데이터: {message_notifications: true, updated_at: "..."}
   업데이트 결과: {data: {...}, error: null}
   ```

### 만약 여전히 오류가 발생한다면:

1. **컬럼 오류 (42703)**:

   ```
   새 필드 오류 감지, 기존 필드만으로 재시도
   ```

   → 마이그레이션이 완전히 실행되지 않았습니다. SQL을 다시 실행하세요.

2. **권한 오류**:
   → Supabase RLS 정책을 확인하고, 사용자가 로그인되어 있는지 확인하세요.

3. **네트워크 오류**:
   → Supabase 연결 상태를 확인하세요.

## 현재 구현된 Fallback 로직

1. **설정 로드**: 새 필드가 없어도 기본값으로 채워집니다
2. **설정 저장**: 새 필드 오류 시 기존 필드만으로 재시도합니다
3. **자세한 로깅**: 모든 단계에서 상세한 로그를 출력합니다

## 마이그레이션 후 확인사항

Supabase 대시보드의 **Table Editor**에서 `user_settings` 테이블을 확인하여 다음 필드들이 추가되었는지 확인하세요:

**MVP 알림 설정 필드:**

- message_notifications (전체 알림)
- marketing_notifications (마케팅 알림)
- auto_print_close_friends (친한친구 자동출력)

**개인정보 설정 필드:**

- profile_visibility
- show_online_status
- show_last_seen
- message_from_strangers
- friend_suggestions
- find_by_username
- save_message_history
- auto_delete_old_messages
- auto_delete_days

모든 필드가 추가되면 알림 설정이 정상적으로 작동할 것입니다!
