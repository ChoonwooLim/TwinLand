#!/usr/bin/env node
/**
 * postbuild — Service Worker 의 __BUILD_VERSION__ 을 timestamp 로 치환.
 * Vite 는 public/ 파일을 그대로 dist/ 로 복사하므로 SW 변수 주입은 빌드 후 작업.
 */
const fs = require('fs');
const path = require('path');

const dist = path.resolve(__dirname, '..', 'dist');
const swPath = path.join(dist, 'sw.js');

if (!fs.existsSync(swPath)) {
  console.warn('[postbuild] dist/sw.js 없음 — 스킵');
  process.exit(0);
}

const version = Date.now().toString();
let content = fs.readFileSync(swPath, 'utf-8');
if (!content.includes('__BUILD_VERSION__')) {
  console.warn('[postbuild] sw.js 에 __BUILD_VERSION__ 플레이스홀더 없음 — 스킵');
  process.exit(0);
}
content = content.replace(/__BUILD_VERSION__/g, version);
fs.writeFileSync(swPath, content);
console.log(`[postbuild] SW version stamped: ${version}`);
