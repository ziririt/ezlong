#!/usr/bin/env node
/**
 * mobile/time-app/scripts/sync-web.mjs
 *
 * "투자서 날씨 앱 2" (ezlong.com/time 웹앱) 루트의 최신 정적 파일을
 * Capacitor 프로젝트의 www/ 로 복사한다.
 *
 * 오프라인 가치 확보를 위해 assets/backgrounds/ (약 7MB, 씬당 12장 로컬 시드 사진)만
 * 함께 번들링하고, 계속 늘어나는 assets/background-archive/ (수십 MB, Firebase Storage
 * publicUrl로 서빙되는 실시간 아카이브)는 앱 번들에 넣지 않는다. 앱은 온라인일 때
 * background-manifest.json의 publicUrl로 최신 사진을 계속 받아온다.
 *
 * 사용법: npm run sync:web  (mobile/time-app 안에서)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");
const WEB_ROOT = path.resolve(APP_ROOT, "..", "..", "time");
const WWW_DIR = path.join(APP_ROOT, "www");
const NATIVE_SCRIPT = "native-app.js";

const FILES_TO_COPY = ["index.html", "app.js", "styles.css", "investment-quotes.js"];

const DATA_FILES_TO_COPY = ["data/background-manifest.json", "data/quote-archive-manifest.json"];

const DIRS_TO_COPY = [
  // 오프라인 시드용 소형 배경 세트만 번들에 포함한다.
  "assets/backgrounds"
];

function copyFileIfExists(relPath) {
  const src = path.join(WEB_ROOT, relPath);
  if (!fs.existsSync(src)) {
    console.warn(`  건너뜀 (없음): ${relPath}`);
    return;
  }
  const dest = path.join(WWW_DIR, relPath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`  복사됨: ${relPath}`);
}

function injectNativeScript() {
  const indexPath = path.join(WWW_DIR, "index.html");
  if (!fs.existsSync(indexPath)) return;
  let html = fs.readFileSync(indexPath, "utf8");
  html = html
    .replace("<title>ezlong.com</title>", "<title>ezlong time</title>")
    .replace(
      '<script src="app.js"></script>',
      `<script src="app.js"></script>\n  <script type="module" src="${NATIVE_SCRIPT}"></script>`
    );
  fs.writeFileSync(indexPath, html);
}

function copyDirRecursive(relDir) {
  const srcDir = path.join(WEB_ROOT, relDir);
  if (!fs.existsSync(srcDir)) {
    console.warn(`  건너뜀 (없음): ${relDir}`);
    return;
  }
  const destDir = path.join(WWW_DIR, relDir);
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(path.relative(WEB_ROOT, srcPath));
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
  console.log(`  복사됨(디렉터리): ${relDir}`);
}

function copyNativeScript() {
  const src = path.join(APP_ROOT, NATIVE_SCRIPT);
  const dest = path.join(WWW_DIR, NATIVE_SCRIPT);
  if (!fs.existsSync(src)) {
    console.warn(`  건너뜀 (없음): ${NATIVE_SCRIPT}`);
    return;
  }
  fs.copyFileSync(src, dest);
  console.log(`  복사됨: ${NATIVE_SCRIPT}`);
}

function main() {
  console.log(`웹 소스: ${WEB_ROOT}`);
  console.log(`대상 www: ${WWW_DIR}`);
  fs.mkdirSync(WWW_DIR, { recursive: true });

  console.log("\n1) 앱 셸 파일");
  FILES_TO_COPY.forEach(copyFileIfExists);

  console.log("\n2) 데이터 manifest");
  DATA_FILES_TO_COPY.forEach(copyFileIfExists);

  console.log("\n3) 오프라인 시드 배경 사진");
  DIRS_TO_COPY.forEach(copyDirRecursive);

  console.log("\n4) 네이티브 브리지");
  copyNativeScript();
  injectNativeScript();

  console.log("\n동기화 완료.");
}

main();
