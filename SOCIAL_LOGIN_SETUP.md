# 🔐 소셜 로그인 설정 가이드

## 📋 개요

이 가이드는 Supabase를 사용하여 Google과 Kakao 소셜 로그인을 설정하는 방법을 설명합니다.

## 🚀 1단계: Supabase 프로젝트 설정

### 1.1 Supabase 프로젝트 생성
1. [Supabase](https://supabase.com)에 가입/로그인
2. 새 프로젝트 생성
3. 프로젝트 URL과 API 키 확인

### 1.2 환경 변수 설정
```bash
# .env.local 파일 생성
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🔧 2단계: Google OAuth 설정

### 2.1 Google Cloud Console 설정
1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. **API 및 서비스** > **사용자 인증 정보** 메뉴로 이동
4. **사용자 인증 정보 만들기** > **OAuth 2.0 클라이언트 ID** 선택

### 2.2 OAuth 클라이언트 생성
1. **애플리케이션 유형**: 웹 애플리케이션
2. **승인된 리디렉션 URI** 추가:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   http://localhost:3000/auth/callback (개발용)
   ```

### 2.3 Supabase에 Google Provider 추가
1. Supabase 대시보드 > **Authentication** > **Providers**
2. **Google** 활성화
3. **Client ID**와 **Client Secret** 입력:
   - Client ID: Google Cloud Console에서 생성한 OAuth 클라이언트 ID
   - Client Secret: Google Cloud Console에서 생성한 OAuth 클라이언트 시크릿

## 🟡 3단계: Kakao OAuth 설정

### 3.1 Kakao Developers 설정
1. [Kakao Developers](https://developers.kakao.com) 접속
2. 새 애플리케이션 생성
3. **플랫폼** > **Web** 플랫폼 추가
4. **사이트 도메인** 설정:
   ```
   http://localhost:3000 (개발용)
   https://your-domain.com (프로덕션)
   ```

### 3.2 Kakao OAuth 설정
1. **카카오 로그인** > **활성화**
2. **Redirect URI** 설정:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   http://localhost:3000/auth/callback (개발용)
   ```
3. **동의항목** 설정:
   - 필수: 닉네임, 이메일
   - 선택: 프로필 사진

### 3.3 Supabase에 Kakao Provider 추가
1. Supabase 대시보드 > **Authentication** > **Providers**
2. **Kakao** 활성화 (없다면 Custom Provider로 추가)
3. **Client ID**와 **Client Secret** 입력:
   - Client ID: Kakao Developers에서 생성한 REST API 키
   - Client Secret: Kakao Developers에서 생성한 Client Secret

## 🔧 4단계: Custom Provider 설정 (Kakao용)

Kakao가 Supabase 기본 제공자에 없다면 Custom Provider로 설정:

### 4.1 Supabase SQL Editor에서 설정
```sql
-- Kakao Custom Provider 설정
INSERT INTO auth.providers (id, name, enabled, config)
VALUES (
  'kakao',
  'kakao',
  true,
  '{
    "client_id": "your_kakao_client_id",
    "client_secret": "your_kakao_client_secret",
    "authorization_url": "https://kauth.kakao.com/oauth/authorize",
    "token_url": "https://kauth.kakao.com/oauth/token",
    "userinfo_url": "https://kapi.kakao.com/v2/user/me",
    "scope": "profile_nickname profile_image account_email"
  }'
);
```

## 🧪 5단계: 테스트

### 5.1 개발 서버 실행
```bash
npm run dev
```

### 5.2 로그인 테스트
1. `http://localhost:3000/login` 접속
2. Google 또는 Kakao 로그인 버튼 클릭
3. OAuth 플로우 확인
4. 콜백 처리 확인

### 5.3 개발용 로그인 (선택사항)
개발 모드에서는 테스트 사용자로 로그인 가능:
- 앨리스, 밥, 찰리 중 선택
- 실제 OAuth 없이 테스트 가능

## 🔍 6단계: 디버깅

### 6.1 콘솔 로그 확인
브라우저 개발자 도구에서 다음 로그 확인:
```
🔄 OAuth Debug: {provider, redirectUrl, origin, hostname}
🔄 OAuth Result: {data}
=== OAuth Callback Debug ===
```

### 6.2 일반적인 오류들

#### Google OAuth 오류
- **"redirect_uri_mismatch"**: 리디렉션 URI가 Google Console에 등록된 것과 다름
- **"invalid_client"**: Client ID 또는 Secret이 잘못됨

#### Kakao OAuth 오류
- **"invalid_request"**: 필수 파라미터 누락
- **"unauthorized_client"**: Client ID 또는 Secret이 잘못됨

### 6.3 Supabase 설정 확인
1. **Authentication** > **URL Configuration**
2. **Site URL** 설정: `http://localhost:3000` (개발용)
3. **Redirect URLs** 확인:
   ```
   http://localhost:3000/auth/callback
   https://your-domain.com/auth/callback (프로덕션)
   ```

## 🚀 7단계: 프로덕션 배포

### 7.1 환경 변수 설정
프로덕션 환경에서 환경 변수 설정:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
```

### 7.2 도메인 설정
1. Google Cloud Console에서 프로덕션 도메인 추가
2. Kakao Developers에서 프로덕션 도메인 추가
3. Supabase에서 프로덕션 리디렉션 URL 추가

## 📚 추가 리소스

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [Kakao Login Documentation](https://developers.kakao.com/docs/latest/ko/kakaologin/common)

## 🎯 완료 체크리스트

- [ ] Supabase 프로젝트 생성
- [ ] 환경 변수 설정
- [ ] Google OAuth 설정
- [ ] Kakao OAuth 설정
- [ ] 로그인 페이지 구현
- [ ] 콜백 처리 구현
- [ ] 오류 처리 구현
- [ ] 개발 환경 테스트
- [ ] 프로덕션 환경 설정

이제 소셜 로그인이 완전히 작동할 준비가 되었습니다! 🎉 