#!/usr/bin/env node
/**
 * scripts/import-photos-r2.js
 *
 * 수동 큐레이션 사진 등록 파이프라인 — 2026-07-25 신설
 *
 * 로컬 폴더에 모아둔 사진을 자동 분류 → Cloudflare R2 업로드 → 매니페스트 등록까지
 * 한 번에 처리한다. 유저가 직접 고른 사진용이며, 봇 자동수집분
 * (collect-time-background-photos.js)과는 별개 경로다.
 *
 * ── 왜 로컬 폴더 기준인가 ──────────────────────────────────────────────────
 * wrangler 4.92.0에는 `r2 object list`가 없다(`r2 bucket list`만 존재).
 * 즉 "R2에 올라가 있는데 매니페스트엔 없는 객체"를 CLI로 찾아낼 방법이 없고,
 * 그러려면 R2 S3 API 액세스 키를 따로 발급해야 한다. 반면 로컬 폴더 기준이면
 * 추가 자격증명 없이 기존 upload-*-r2.js와 같은 방식으로 동작하고,
 * 무엇보다 분류기에 먹일 원본이 이미 로컬에 있어 R2에서 되받아올 필요가 없다.
 *
 * ── 태그 ───────────────────────────────────────────────────────────────────
 * 예전 배치 스크립트(upload-pixel-20260712-r2.js 등)는 Pexels 메타데이터의
 * season/time_of_day/weather를 수동 매핑했다. 이 스크립트는 사진 자체를 보고
 * 판정한다 — 메타데이터가 없는 아무 사진이나 넣어도 된다.
 * 상세 설계 근거는 photo-tag-classifier.mjs 헤더 참조.
 *
 * ── 사용법 ─────────────────────────────────────────────────────────────────
 *   export GEMINI_API_KEY=...
 *   node scripts/import-photos-r2.js --dir=~/Downloads/새사진폴더
 *
 * 자주 쓰는 옵션:
 *   --dir=<경로>      사진 폴더 (필수)
 *   --prefix=<이름>   R2 저장 경로 접두어. 기본값은 오늘 날짜(manual-2026-07-25)
 *   --dry-run         분류만 하고 업로드·매니페스트 기록은 하지 않는다.
 *                     새 폴더를 처음 넣을 때 결과를 먼저 눈으로 보는 용도.
 *   --passes=<n>      장당 판정 횟수(기본 3). 정확도 우선이면 5까지 올려도 된다.
 *   --limit=<n>       앞에서 n장만 처리(테스트용)
 *   --max-edge=<n>    긴 변 상한 픽셀(기본 2400). 기존 R2 배치와 같은 규격이다.
 *   --quality=<n>     WEBP 품질(기본 80)
 *   --no-resize       리사이즈·WEBP 변환 없이 원본을 그대로 올린다(권장하지 않음)
 *
 * ── 리사이즈를 기본으로 켜둔 이유 ─────────────────────────────────────────
 * 이 앱의 배경사진은 휴대폰 화면에 깔리는 용도다. Pexels 원본은 장당 2~15MB에
 * 5000px가 넘어가는 경우가 많아 그대로 올리면 R2 용량과 앱 로딩이 둘 다 나빠진다.
 * 기존 R2 배치(upload-pixel-20260712-r2.js)도 같은 이유로 "긴 변 2400px 캡,
 * 크롭 없이 비율 유지, WEBP quality 80"으로 통일했고, 실제 매니페스트상
 * 1365장의 중앙값이 1600x2400 / 446KB다. 새로 들어오는 사진도 같은 규격으로
 * 맞춘다. 크롭은 하지 않는다 — 과거에 세로 1920 고정 + 가로 강제 맞춤(크롭형)
 * 리사이즈가 화면 잘림 문제의 원인이었던 전력이 있다.
 *
 * 중단 후 재실행해도 안전하다 — storagePath 기준으로 이미 등록된 건 건너뛰고,
 * 10장마다 매니페스트를 중간 저장한다.
 *
 * ── 주의 ───────────────────────────────────────────────────────────────────
 * - wrangler 로그인이 되어 있어야 한다(`npx wrangler whoami`). wrangler는 이
 *   저장소가 아니라 "투자서 날씨 앱 2" 저장소의 devDependency다 — WORK_ROOT 참조.
 * - git 쓰기 명령은 이 스크립트가 실행하지 않는다(CLAUDE.md 규칙). 매니페스트가
 *   바뀌면 유저가 직접 커밋·푸시한다.
 */

import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { classifyPhoto, resolveApiKey, KEY_FILE } from "./photo-tag-classifier.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(repoRoot, "time", "data", "background-manifest.json");

// R2 설정 — upload-pixel-20260712-r2.js와 동일한 버킷을 쓴다.
const R2_BUCKET = "flipzenweather-photos";
const R2_PUBLIC_BASE = "https://pub-58d325a6a0ac4228bd2784eed797d328.r2.dev";

// wrangler는 "투자서 날씨 앱 2" 저장소에 devDependency로 설치돼 있다.
const WORK_ROOT = path.resolve(os.homedir(), "Documents", "투자서 날씨 앱 2");

const CHECKPOINT_EVERY = 10;
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function optionValue(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}
function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}
function expandHome(p) {
  return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p;
}
function nowKST() {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).replace(" ", "T") + "+09:00";
}
function todayKST() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

async function readManifest() {
  const text = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(text);
}
async function saveManifest(manifest) {
  manifest.updatedAtKST = nowKST();
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

/**
 * 긴 변 maxEdge 이하로 비율 유지 축소 + WEBP 변환. 크롭하지 않는다.
 * 원본이 이미 작으면 확대하지 않고 그대로 두되 WEBP로만 바꾼다.
 * 결과 파일 경로를 반환한다. Pillow가 없으면 null(호출측이 원본 사용).
 */
function resizeToWebp(srcPath, outPath, maxEdge, quality) {
  const snippet = `
from PIL import Image
im = Image.open(${JSON.stringify(srcPath)})
im = im.convert("RGB")
w, h = im.size
m = ${maxEdge}
if max(w, h) > m:
    if w >= h:
        im = im.resize((m, max(1, round(h * m / w))), Image.LANCZOS)
    else:
        im = im.resize((max(1, round(w * m / h)), m), Image.LANCZOS)
im.save(${JSON.stringify(outPath)}, "WEBP", quality=${quality}, method=6)
print(im.size[0], im.size[1])
`;
  try {
    const out = execFileSync("python3", ["-c", snippet], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    }).trim().split(/\s+/);
    return { width: Number(out[0]) || null, height: Number(out[1]) || null };
  } catch (error) {
    return null;
  }
}

/** 이미지 픽셀 크기 — python3+Pillow 또는 sips. 실패해도 등록은 진행한다. */
function imageDimensions(filePath) {
  try {
    const out = execFileSync("python3", ["-c",
      `from PIL import Image;im=Image.open(${JSON.stringify(filePath)});print(im.size[0],im.size[1])`,
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split(/\s+/);
    return { width: Number(out[0]) || null, height: Number(out[1]) || null };
  } catch {}
  try {
    const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", filePath],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const w = /pixelWidth:\s*(\d+)/.exec(out);
    const h = /pixelHeight:\s*(\d+)/.exec(out);
    return { width: w ? Number(w[1]) : null, height: h ? Number(h[1]) : null };
  } catch {}
  return { width: null, height: null };
}

function uploadToR2(localPath, storagePath) {
  // --remote 필수: 이 플래그가 없으면 로컬 시뮬레이션 스토리지에만 써지고
  // 실제 R2에는 아무것도 올라가지 않는다(upload-pixel-20260712-r2.js 교훈).
  execFileSync("npx", ["wrangler", "r2", "object", "put",
    `${R2_BUCKET}/${storagePath}`, "--file", localPath, "--remote"],
    { cwd: WORK_ROOT, stdio: ["ignore", "pipe", "pipe"] });
}

async function main() {
  const dirArg = optionValue("dir", "");
  if (!dirArg) {
    console.error("--dir=<사진 폴더> 가 필요합니다.");
    console.error("예: node scripts/import-photos-r2.js --dir=~/Downloads/새사진");
    process.exit(1);
  }
  const dir = expandHome(dirArg);
  if (!fsSync.existsSync(dir)) {
    console.error(`폴더를 찾을 수 없습니다: ${dir}`);
    process.exit(1);
  }
  const apiKey = resolveApiKey();
  if (!apiKey) {
    console.error("Gemini API 키를 찾을 수 없습니다.");
    console.error(`아래 파일에 키만 한 줄 넣어두면 됩니다: ${KEY_FILE}`);
    console.error("  mkdir -p ~/.config/ezlong");
    console.error("  printf '%s' '여기에키' > ~/.config/ezlong/gemini-key");
    console.error("  chmod 600 ~/.config/ezlong/gemini-key");
    process.exit(1);
  }

  const dryRun = hasFlag("dry-run");
  const passes = Number(optionValue("passes", "3"));
  const limit = Number(optionValue("limit", "0"));
  const prefix = optionValue("prefix", `manual-${todayKST()}`);
  // 컬렉션 이름. 매니페스트의 collection 필드에 들어가 관리툴에서 묶어 보는 용도다.
  // 주의: app.js가 collection === "cool-summer" 인 사진만 따로 풀을 만들어
  // 더운 날 우선 노출하는 특수 로직을 갖고 있다(app.js 1243행). 그 이름만
  // 특별하고 나머지 값은 일반 풀로 들어가므로, 새 컬렉션 이름은 자유롭게 써도 된다.
  const collection = optionValue("collection", "");
  const doResize = !hasFlag("no-resize");
  const maxEdge = Number(optionValue("max-edge", "2400"));
  const quality = Number(optionValue("quality", "80"));
  // 리사이즈 결과물은 원본 폴더를 더럽히지 않게 .resized 하위에 만든다.
  const resizeDir = path.join(dir, ".resized");
  if (doResize) await fs.mkdir(resizeDir, { recursive: true });

  if (!dryRun && !fsSync.existsSync(WORK_ROOT)) {
    console.error(`wrangler가 설치된 폴더를 찾을 수 없습니다: ${WORK_ROOT}`);
    console.error("--dry-run 으로는 분류만 해볼 수 있습니다.");
    process.exit(1);
  }

  let files = (await fs.readdir(dir))
    .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
    .filter((f) => !f.startsWith("."))
    .sort();
  if (limit > 0) files = files.slice(0, limit);

  if (files.length === 0) {
    console.log("처리할 이미지가 없습니다.");
    return;
  }

  const manifest = await readManifest();
  manifest.images = manifest.images || [];
  const existingStoragePaths = new Set(
    manifest.images.map((i) => i.storagePath).filter(Boolean)
  );

  console.log(`폴더      : ${dir}`);
  console.log(`대상      : ${files.length}장`);
  console.log(`R2 경로   : ${R2_BUCKET}/${prefix}/`);
  console.log(`판정 횟수 : 장당 ${passes}회 (다수결)`);
  console.log(`리사이즈  : ${doResize ? `긴 변 ${maxEdge}px 캡, WEBP q${quality}, 크롭 없음` : "안 함 (원본 그대로)"}`);
  console.log(`모드      : ${dryRun ? "DRY RUN — 분류만, 업로드·기록 없음" : "실제 업로드 + 매니페스트 기록"}`);
  console.log("");

  let added = 0, skipped = 0, failed = 0, review = 0, unusable = 0;
  const reviewList = [];

  for (const [index, fileName] of files.entries()) {
    const originalPath = path.join(dir, fileName);
    const base = fileName.replace(/\.[^.]+$/, "");
    const outName = doResize ? `${base}.webp` : fileName;
    const storagePath = `${prefix}/${outName}`;
    const label = `[${index + 1}/${files.length}] ${fileName}`;

    if (existingStoragePaths.has(storagePath)) {
      console.log(`${label} — 이미 등록됨, 건너뜀`);
      skipped += 1;
      continue;
    }

    // 업로드 대상 파일을 먼저 만든다. 분류도 이 파일로 한다 —
    // 매니페스트에 기록될 치수·용량이 실제 R2에 올라가는 것과 일치해야 한다.
    let uploadPath = originalPath;
    let dims = null;
    if (doResize) {
      const outPath = path.join(resizeDir, outName);
      dims = resizeToWebp(originalPath, outPath, maxEdge, quality);
      if (dims) {
        uploadPath = outPath;
      } else {
        console.log(`${label} — 리사이즈 실패(Pillow 없음?), 원본으로 진행`);
      }
    }

    const classified = await classifyPhoto(uploadPath, { apiKey, passes });

    if (!classified.ok) {
      console.log(`${label} — 분류 실패: ${classified.error}`);
      failed += 1;
      continue;
    }

    if (classified.unusable) {
      console.log(`${label} — 배경화면 부적합 판정, 건너뜀: ${classified.unusableReason}`);
      unusable += 1;
      continue;
    }

    console.log(
      `${label}\n` +
      `   time=[${classified.timeBuckets.join(",")}]\n` +
      `   weather=[${classified.weatherTags.join(",")}]  season=[${classified.seasonTags.join(",")}]\n` +
      `   일치도=${classified.agreement}${classified.needsReview ? "  ※검토필요: " + classified.reviewReasons.join("; ") : ""}`
    );

    if (classified.needsReview) {
      review += 1;
      reviewList.push(fileName);
    }

    if (dryRun) {
      added += 1;
      continue;
    }

    try {
      uploadToR2(uploadPath, storagePath);
    } catch (error) {
      console.log(`   업로드 실패: ${String(error.message || error).slice(0, 200)}`);
      failed += 1;
      continue;
    }

    const { width, height } = dims || imageDimensions(uploadPath);
    const stat = await fs.stat(uploadPath);

    manifest.images.push({
      src: `${R2_PUBLIC_BASE}/${storagePath}`,
      publicUrl: `${R2_PUBLIC_BASE}/${storagePath}`,
      storagePath,
      timeBuckets: classified.timeBuckets,
      weatherTags: classified.weatherTags,
      seasonTags: classified.seasonTags,
      width,
      height,
      sizeKB: Math.round(stat.size / 102.4) / 10,
      source: "manual-curated",
      ...(collection ? { collection } : {}),
      collectedAtKST: nowKST(),
      tagSource: "vision-classifier",
      tagAgreement: classified.agreement,
      // 유저 확정(2026-07-25): 검토 필요 사진도 일단 등록하고 표시만 남긴다.
      // 갤러리 관리툴에서 needsReview로 필터링해 나중에 확인하면 된다.
      needsReview: classified.needsReview,
      ...(classified.needsReview ? { reviewReasons: classified.reviewReasons } : {}),
    });
    existingStoragePaths.add(storagePath);
    added += 1;

    if (added % CHECKPOINT_EVERY === 0) {
      await saveManifest(manifest);
      console.log(`   (중간 저장 — ${added}장)`);
    }
  }

  if (!dryRun && added > 0) await saveManifest(manifest);

  console.log("\n" + "=".repeat(66));
  console.log(`등록 ${added}장 / 중복 건너뜀 ${skipped}장 / 부적합 ${unusable}장 / 실패 ${failed}장`);
  console.log(`검토 필요로 표시된 사진: ${review}장${reviewList.length ? "\n  " + reviewList.join("\n  ") : ""}`);
  console.log("=".repeat(66));

  if (dryRun) {
    console.log("\nDRY RUN이라 업로드·매니페스트 기록은 하지 않았습니다.");
    console.log("결과가 괜찮으면 --dry-run 을 빼고 다시 실행하세요.");
  } else if (added > 0) {
    console.log("\n매니페스트가 수정됐습니다. 아래로 커밋·푸시하세요:");
    console.log("  git add time/data/background-manifest.json");
    console.log(`  git commit -m "data: 수동 큐레이션 사진 ${added}장 추가 (자동 태그 분류)"`);
    console.log("  git pull --no-rebase --no-edit && git push");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
