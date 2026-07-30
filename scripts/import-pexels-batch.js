#!/usr/bin/env node
// Pexels "좋아요" 갤러리 큐레이션 배치(917장)를 Firebase Storage에 업로드하고
// time/data/background-manifest.json에 개별 태그로 반영하는 스크립트.
//
// 사용법:
//   node scripts/import-pexels-batch.js --dir=/Users/ziririt/Downloads/pixel-20260712-resized
//
// --dir 생략 시 기본값은 위 경로(2026-07-13 세션에서 만든 리사이즈 폴더)다.
//
// 이 스크립트는 중단 후 재실행해도 안전하다 — 이미 manifest에 들어간 파일은
// storagePath 기준으로 건너뛰고, 25장마다 manifest를 중간 저장한다.

import admin from "firebase-admin";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { imageSize } from "image-size";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "time", "data", "background-manifest.json");
const batchDataPath = path.join(root, "scripts", "data", "pexels-import-batch.json");
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(root, "firebase-service-account.json");
const projectId = process.env.FIREBASE_PROJECT_ID || "ezlong-541a8";
const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;
const CHECKPOINT_EVERY = 25;

function optionValue(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function firebasePublicUrl(bucket, storagePath) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(storagePath)}?alt=media`;
}

function nowKST() {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).replace(" ", "T") + "+09:00";
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function ensureServiceAccount() {
  try {
    await fs.access(serviceAccountPath);
  } catch {
    throw new Error(
      `Firebase 서비스 계정 파일을 찾을 수 없습니다: ${serviceAccountPath}\n` +
      "firebase-service-account.json이 저장소 루트에 있는지 확인하세요."
    );
  }
}

async function initFirebase() {
  await ensureServiceAccount();
  const serviceAccount = JSON.parse(await fs.readFile(serviceAccountPath, "utf8"));

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
      storageBucket: bucketName,
    });
  }

  return admin.storage().bucket(bucketName);
}

async function saveManifest(manifest) {
  manifest.updatedAtKST = nowKST();
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

async function main() {
  const sourceDir = path.resolve(
    optionValue("dir", path.join(process.env.HOME || "", "Downloads", "pixel-20260712-resized"))
  );

  console.log(`소스 폴더: ${sourceDir}`);
  console.log(`배치 데이터: ${batchDataPath}`);
  console.log(`manifest: ${manifestPath}`);

  const batch = await readJson(batchDataPath, null);
  if (!batch) {
    throw new Error(`배치 데이터 파일을 읽을 수 없습니다: ${batchDataPath}`);
  }

  const bucket = await initFirebase();
  const manifest = await readJson(manifestPath, { updatedAtKST: "", season: "summer", images: [] });
  manifest.images = manifest.images || [];

  const existingFilenames = new Set(
    manifest.images
      .map((image) => image.storagePath)
      .filter(Boolean)
      .map((storagePath) => storagePath.split("/").pop())
  );

  let uploaded = 0;
  let skippedExisting = 0;
  let skippedMissingFile = 0;
  let failed = 0;

  for (const entry of batch) {
    if (existingFilenames.has(entry.resized_filename)) {
      skippedExisting += 1;
      continue;
    }

    const localPath = path.join(sourceDir, entry.resized_filename);
    try {
      await fs.access(localPath);
    } catch {
      console.warn(`  건너뜀(파일 없음): ${entry.resized_filename}`);
      skippedMissingFile += 1;
      continue;
    }

    const primaryBucket = entry.timeBuckets[0];
    const storagePath = `archive/time-backgrounds/summer/${primaryBucket}/${entry.resized_filename}`;

    try {
      await bucket.upload(localPath, {
        destination: storagePath,
        metadata: {
          cacheControl: "public, max-age=31536000, immutable",
          metadata: {
            app: "ezlong-invest-weather-clock",
            timeBuckets: entry.timeBuckets.join(","),
            weatherTags: entry.weatherTags.join(","),
            seasonTags: entry.seasonTags.join(","),
          },
        },
      });

      const stat = await fs.stat(localPath);
      let width = entry.width || null;
      let height = entry.height || null;
      try {
        const dimensions = imageSize(localPath);
        width = dimensions.width || width;
        height = dimensions.height || height;
      } catch {
        // 원본 catalog 수치를 그대로 사용
      }

      manifest.images.push({
        src: firebasePublicUrl(bucketName, storagePath),
        publicUrl: firebasePublicUrl(bucketName, storagePath),
        storagePath,
        timeBuckets: entry.timeBuckets,
        weatherTags: entry.weatherTags,
        seasonTags: entry.seasonTags,
        width,
        height,
        sizeKB: Math.round(stat.size / 102.4) / 10,
        source: "pexels",
        attribution: entry.attribution,
        license: entry.license,
        sourceUrl: entry.sourceUrl,
        collectedAtKST: nowKST(),
      });

      uploaded += 1;
      existingFilenames.add(entry.resized_filename);

      if (uploaded % CHECKPOINT_EVERY === 0) {
        await saveManifest(manifest);
        console.log(`  진행: ${uploaded}장 업로드 완료 (중간 저장함)`);
      }
    } catch (error) {
      failed += 1;
      console.error(`  실패: ${entry.resized_filename} — ${error.message || error}`);
    }
  }

  await saveManifest(manifest);

  console.log("");
  console.log("=== 완료 ===");
  console.log(`신규 업로드: ${uploaded}`);
  console.log(`이미 반영돼 있어 건너뜀: ${skippedExisting}`);
  console.log(`로컬 파일 없어 건너뜀: ${skippedMissingFile}`);
  console.log(`실패: ${failed}`);
  console.log(`manifest 총 이미지 수: ${manifest.images.length}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
