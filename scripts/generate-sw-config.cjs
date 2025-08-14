'use strict';

const fs = require('fs');
const path = require('path');

const requiredEnvKeys = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];

function parseEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    const result = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

// Merge env from process.env and .env.local (process.env wins)
const projectRoot = path.join(__dirname, '..');
const dotEnvLocal = path.join(projectRoot, '.env.local');
const fileEnv = parseEnvFile(dotEnvLocal);
const env = { ...fileEnv, ...process.env };

function getEnv(key) {
  return env[key] || '';
}

const config = {
  apiKey: getEnv('NEXT_PUBLIC_FIREBASE_API_KEY'),
  authDomain: getEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('NEXT_PUBLIC_FIREBASE_APP_ID'),
};

const outDir = path.join(__dirname, '..', 'public');
const outFile = path.join(outDir, 'firebase-config.js');

fs.mkdirSync(outDir, { recursive: true });

// 개발 환경에서만 firebase-config.js 생성 (보안 강화)
const isProduction = process.env.NODE_ENV === 'production';
const shouldGenerateConfig = !isProduction || process.env.GENERATE_SW_CONFIG === 'true';

if (shouldGenerateConfig) {
  const banner = '/* This file is generated from environment variables. Do not commit. */\n';
  const content = banner + 'self.FAXI_FIREBASE_CONFIG = ' + JSON.stringify(config, null, 2) + ';\n';

  try {
    fs.writeFileSync(outFile, content, 'utf8');
    console.log('[generate-sw-config] Generated public/firebase-config.js (apiKey: ' + (config.apiKey ? config.apiKey.slice(0, 6) + '...' : 'unset') + ')');
  } catch (err) {
    console.error('[generate-sw-config] Failed to write', outFile, err);
    process.exit(0);
  }
} else {
  console.log('[generate-sw-config] Skipped firebase-config.js generation in production mode');
  
  // 프로덕션에서는 파일이 있다면 삭제
  try {
    if (fs.existsSync(outFile)) {
      fs.unlinkSync(outFile);
      console.log('[generate-sw-config] Removed firebase-config.js for production');
    }
  } catch (err) {
    console.warn('[generate-sw-config] Could not remove firebase-config.js:', err.message);
  }
}

const missing = requiredEnvKeys.filter((k) => !env[k]);
if (missing.length > 0) {
  console.warn('[generate-sw-config] Missing env keys:', missing.join(', '));
}

process.exit(0);

