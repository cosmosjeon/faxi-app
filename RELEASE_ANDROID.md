# FAXI Android 출시 가이드 (Play Store)

본 문서는 Vercel 배포 및 APK 테스트 완료 상태를 기준으로 Google Play 출시 절차를 빠르게 진행하기 위한 체크리스트와 역할 분담을 제공합니다.

## 0) 사전 체크
- [x] 프로덕션 호스트: `https://faxi-app.vercel.app`
- [x] PWA 매니페스트: `src/app/manifest.ts` 제공(`/manifest.webmanifest`)
- [x] 서비스워커: `public/firebase-messaging-sw.js` 존재
- [x] TWA 프로젝트: `faxi-twa/` 구성 완료

## 1) 도메인-앱 소유권(Digital Asset Links)
- 파일: `public/.well-known/assetlinks.json`
- 배포 URL: `https://faxi-app.vercel.app/.well-known/assetlinks.json`
- 검사 API:
  - `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://faxi-app.vercel.app&relation=delegate_permission/common.handle_all_urls&target.androidApp.package_name=com.cosmosjeon.faxi&target.androidApp.certificate.sha256_fingerprint=AA:BB:...:ZZ`
- 주의: Play App Signing 사용 시 "App signing certificate"의 SHA-256 지문을 사용해야 함(업로드 키 지문 아님).

## 2) 버전 증분 규칙(필수)
업로드 전 두 곳을 동일하게 증가:
1) `faxi-twa/twa-manifest.json`: `appVersionCode`, `appVersionName`
2) `faxi-twa/app/build.gradle`: `defaultConfig.versionCode`, `defaultConfig.versionName`

## 3) 서명키 / App Signing
- 권장: Play App Signing 활성화 → App signing certificate SHA-256 확보 → `assetlinks.json` 반영
- 업로드 키 생성(참고):
```
keytool -genkey -v -keystore /ABS/PATH/android.keystore -alias android -keyalg RSA -keysize 2048 -validity 10000 -storetype JKS
```
- 키 지문 확인:
```
keytool -list -v -keystore /ABS/PATH/android.keystore -alias android | grep 'SHA-256'
```
- `twa-manifest.json`의 `signingKey.path`는 로컬 절대경로로 설정(macOS 기준)

## 4) 빌드(AAB) 절차
작업 디렉토리: `faxi-app/faxi-twa`
```
# Android 프로젝트 동기화
npx @bubblewrap/cli update

# AAB 빌드
npx @bubblewrap/cli build

# 산출물(예)
app/build/outputs/bundle/release/app-release.aab
```
문제 해결 팁:
- 저장소 오류(jcenter) → `mavenCentral()` 전환 고려
- SDK/빌드도구 불일치 → Android Studio에서 Gradle Sync
- 서명 오류 → `signingKey.path`/암호 확인

## 5) Play Console 등록/검수
1) 스토어 정보
- 앱명, 간단/자세한 설명, 카테고리, 연락처
2) 그래픽
- 아이콘 512×512 PNG, 피처 1024×500 PNG, 스크린샷(1080×1920 권장) ≥ 3장
3) 정책/데이터 안전성
- 개인정보처리방침 URL, Data safety 양식(권장 예)
  - 수집: 푸시 토큰(기기/기타 ID), 선택적 사용자 ID
  - 목적: 앱 기능(푸시/메시지)
  - 공유: 없음, 암호화: 예, 삭제 요청 경로: 예
4) 앱 액세스
- 로그인 필요 시 테스트 계정 제공 또는 데모 안내
5) 테스트 트랙
- 내부 → 폐쇄 → 오픈/프로덕션. Pre-launch report 확인 후 단계적 배포(10%→50%→100%)

## 6) QA 체크리스트
- [ ] TWA 전체화면(주소창 없음) 실행
- [ ] 첫 실행 알림 권한(안드로이드 13+) 정상
- [ ] 푸시 수신/알림 클릭 시 라우팅(`/home` 등) 정상
- [ ] BLE 연결 및 테스트 프린트 정상
- [ ] 오프라인/재시도 예외 처리 확인

## 7) 역할 분담
### Assistant(자동/문서)
- [x] `public/.well-known/assetlinks.json` 추가
- [x] 본 가이드 작성(본 문서)
- [ ] 필요 시 Gradle 저장소 전환 제안(jcenter→mavenCentral)
- [ ] 버전/빌드 명령 가이드 유지

### User(수동/콘솔)
- [ ] Play App Signing 활성화 후 App signing SHA-256 지문 제공
- [ ] 제공 지문으로 `assetlinks.json` 업데이트(또는 수정·배포 승인)
- [ ] Play Console 스토어 정보/정책/데이터 안전성/그래픽 업로드
- [ ] 테스트 트랙 테스터 등록 및 설치 확인
- [ ] 단계적 배포 승인 및 모니터링
