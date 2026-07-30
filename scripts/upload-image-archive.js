#!/usr/bin/env node
/**
 * ezlong.com 사진 이미지 아카이브 업로드 스크립트
 *
 * 목적: 로컬 원본(고해상도) 사진 폴더를 Firebase Storage의 archive/ 경로로 업로드하고,
 *       웹에서 바로 쓸 수 있는 공개 URL을 data/image-archive-manifest.json에 기록한다.
 *
 * 핵심 원칙:
 *   - 이미지 실물은 절대 git 저장소에 들어가지 않는다. Firebase Storage에만 존재한다.
 *   - git에는 manifest(파일명·URL·크기 정보)만 커밋된다. 가볍고, .git 용량과 무관하다.
 *   - 업로드는 서비스 계정(Admin SDK)으로만 수행 — storage.rules는 클라이언트 쓰기를 차단하지만
 *     Admin SDK는 규칙을 우회하므로 이 스크립트는 항상 정상 동작한다.
 *
 * 사전 준비 (최초 1회, 유저가 직접):
 *   1. Firebase 콘솔 → ezlong-541a8 프로젝트 → Storage → 시작하기 (Blaze 요금제 필요할 수 있음)
 *   2. 프로젝트 설정 → 서비스 계정 → "새 비공개 키 생성" → JSON 다운로드
 *   3. 다운로드한 파일을 프로젝트 루트에 firebase-service-account.json 이름으로 저장
 *      (.gitignore에 firebase-service-account*.json 패턴이 이미 등록되어 있어 git에 절대 안 올라감)
 *   4. npm install (firebase-admin, image-size 설치)
 *   5. storage.rules 최초 1회 배포: firebase deploy --only storage --project ezlong-541a8
 *
 * 사용법:
 *   node scripts/upload-image-archive.js <로컬원본폴더경로>
 *
 *   예) node scripts/upload-image-archive.js ~/Documents/ezlong-image-archive
 *
 *   원본 폴더 안에 카테고리별 하위 폴더를 만들어두면 그대로 archive/카테고리/파일명 으로 미러링된다.
 *   예시 구조:
 *     ~/Documents/ezlong-image-archive/
 *       hero/           (홈페이지 히어로 배경)
 *       book-covers/    (책 표지)
 *       backgrounds/    (섹션 배경)
 *       logos/          (로고 변형)
 *       blog/           (블로그·콘텐츠 삽입용)
 *       misc/           (분류 안 된 나머지)
 *
 *   하위 폴더 없이 파일을 최상위에 두면 category는 "misc"로 자동 분류된다.
 *   이미 업로드된 파일(같은 storagePath)은 건너뛴다 — 재실행해도 중복 업로드 안 됨.
 *
 * 파일명 규칙 (CLAUDE.md 12항 macOS Finder 중복 사고 교훈과 동일):
 *   - 공백·한글 파일명 금지, kebab-case 권장 (예: hero-desktop-v2.jpg)
 *   - 확장자: png, jpg, jpeg, webp 만 처리
 */

'use strict';

const fs = require('fs');
const path = require('path');

const VALID_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const REPO_ROOT = path.join(__dirname, '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'data', 'image-archive-manifest.json');
const SERVICE_ACCOUNT_PATH = path.join(REPO_ROOT, 'firebase-service-account.json');

function nowKST() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', ' ') + ' KST';
}

function collectFiles(rootDir) {
  const results = []; // { absPath, category, fileName }
  const topEntries = fs.readdirSync(rootDir, { withFileTypes: true });

  for (const entry of topEntries) {
    const abs = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      const category = entry.name;
      const inner = fs.readdirSync(abs, { withFileTypes: true });
      for (const f of inner) {
        if (f.isFile() && VALID_EXT.has(path.extname(f.name).toLowerCase())) {
          results.push({ absPath: path.join(abs, f.name), category, fileName: f.name });
        }
      }
    } else if (entry.isFile() && VALID_EXT.has(path.extname(entry.name).toLowerCase())) {
      results.push({ absPath: abs, category: 'misc', fileName: entry.name });
    }
  }
  return results;
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return { _schema: '', generatedBy: 'scripts/upload-image-archive.js', lastUpdatedKST: null, images: [] };
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function saveManifest(manifest) {
  manifest.lastUpdatedKST = nowKST();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

async function main() {
  const sourceDir = process.argv[2];
  if (!sourceDir) {
    console.error('사용법: node scripts/upload-image-archive.js <로컬원본폴더경로>');
    process.exit(1);
  }
  const resolvedSourceDir = sourceDir.replace(/^~/, process.env.HOME || '~');
  if (!fs.existsSync(resolvedSourceDir)) {
    console.error(`폴더를 찾을 수 없음: ${resolvedSourceDir}`);
    process.exit(1);
  }
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error(`서비스 계정 키가 없음: ${SERVICE_ACCOUNT_PATH}`);
    console.error('Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성 후 위 경로에 저장할 것.');
    process.exit(1);
  }

  const admin = require('firebase-admin');
  const sizeOf = require('image-size').imageSize;

  const serviceAccount = require(SERVICE_ACCOUNT_PATH);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // storageBucket 미지정 시 서비스 계정의 project_id 기준 기본 버킷 사용
  });
  const bucket = admin.storage().bucket();

  const files = collectFiles(resolvedSourceDir);
  if (files.length === 0) {
    console.log('업로드할 이미지가 없음 (png/jpg/jpeg/webp만 인식).');
    process.exit(0);
  }

  const manifest = loadManifest();
  const existingPaths = new Set(manifest.images.map((i) => i.storagePath));

  let uploaded = 0;
  let skipped = 0;

  for (const f of files) {
    const storagePath = `archive/${f.category}/${f.fileName}`;

    if (existingPaths.has(storagePath)) {
      skipped++;
      continue;
    }

    const stat = fs.statSync(f.absPath);
    let dims = null;
    try {
      dims = sizeOf(fs.readFileSync(f.absPath));
    } catch (e) {
      // 치수 판독 실패해도 업로드는 계속 진행
    }

    await bucket.upload(f.absPath, {
      destination: storagePath,
      metadata: {
        cacheControl: 'public, max-age=31536000, immutable',
        contentType: dims && dims.type ? `image/${dims.type === 'jpg' ? 'jpeg' : dims.type}` : undefined,
      },
    });

    const encodedPath = encodeURIComponent(storagePath);
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media`;

    manifest.images.push({
      fileName: f.fileName,
      category: f.category,
      storagePath,
      publicUrl,
      sizeKB: Math.round(stat.size / 1024),
      width: dims ? dims.width : null,
      height: dims ? dims.height : null,
      uploadedAtKST: nowKST(),
    });
    existingPaths.add(storagePath);
    uploaded++;
    console.log(`업로드 완료: ${storagePath}`);
  }

  saveManifest(manifest);
  console.log(`\n--- 완료 --- 신규 업로드 ${uploaded}건 / 이미 존재해 건너뜀 ${skipped}건`);
  console.log(`manifest 갱신: ${MANIFEST_PATH}`);
  console.log('이 manifest.json은 git에 커밋해서 팀/미래의 나 자신이 URL을 조회할 수 있게 한다.');
}

main().catch((err) => {
  console.error('업로드 중 오류:', err);
  process.exit(1);
});
