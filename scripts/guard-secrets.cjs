'use strict';

// 간단한 시크릿 패턴 가드: 빌드 산출물/퍼블릭 영역에서 Google API Key 패턴이 보이면 실패
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

// Google API Key 정규식 (AIza... 39자)
const GOOGLE_API_KEY_REGEX = /AIza[0-9A-Za-z\-_]{35}/g;

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // node_modules와 .next는 스킵
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      yield* walk(full);
    } else {
      // 텍스트 파일만 검사 (js, ts, json, map 등)
      if (/\.(js|mjs|cjs|ts|tsx|json|map|txt)$/i.test(entry.name)) {
        yield full;
      }
    }
  }
}

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasGoogleKey = GOOGLE_API_KEY_REGEX.test(content);
    if (hasGoogleKey) {
      console.error('[guard-secrets] 공개 노출 위험 패턴 발견:', filePath);
      return true;
    }
  } catch {}
  return false;
}

let found = false;

// public 디렉토리 우선 검사
if (fs.existsSync(PUBLIC_DIR)) {
  for (const file of walk(PUBLIC_DIR)) {
    if (scanFile(file)) found = true;
  }
}

if (found) {
  console.error('[guard-secrets] 민감 정보 패턴이 발견되어 빌드를 중단합니다.');
  process.exit(1);
}

console.log('[guard-secrets] 공개 파일 시크릿 검사 통과');

