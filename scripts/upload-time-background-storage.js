#!/usr/bin/env node

import admin from "firebase-admin";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { imageSize } from "image-size";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "time", "data", "background-manifest.json");
const publicManifestPath = manifestPath;
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(root, "firebase-service-account.json");
const projectId = process.env.FIREBASE_PROJECT_ID || "ezlong-541a8";
const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function optionValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function normalizeList(value, fallback) {
  const items = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

function firebasePublicUrl(bucket, storagePath) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(storagePath)}?alt=media`;
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function collectImages(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectImages(fullPath));
    } else if (allowedExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

async function ensureServiceAccount() {
  try {
    await fs.access(serviceAccountPath);
  } catch {
    throw new Error(
      `Firebase service account not found: ${serviceAccountPath}\n` +
      "Create Firebase Admin SDK private key JSON and save it as firebase-service-account.json, or set GOOGLE_APPLICATION_CREDENTIALS."
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
      storageBucket: bucketName
    });
  }

  return admin.storage().bucket(bucketName);
}

async function main() {
  const sourceDir = process.argv[2];
  if (!sourceDir || sourceDir.startsWith("--")) {
    throw new Error(
      "Usage: node scripts/upload-background-storage.js <local-image-folder> --time=morning --weather=light-rain --season=summer"
    );
  }

  const resolvedSourceDir = path.resolve(sourceDir);
  const timeBuckets = normalizeList(optionValue("time", process.env.TIME_BUCKETS), ["morning"]);
  const weatherTags = normalizeList(optionValue("weather", process.env.WEATHER_TAGS), ["clear"]);
  const seasonTags = normalizeList(optionValue("season", process.env.SEASON_TAGS), ["summer"]);
  const bucket = await initFirebase();
  const files = await collectImages(resolvedSourceDir);
  const manifest = await readJson(manifestPath, { updatedAtKST: "", season: seasonTags[0], images: [] });
  const existingStoragePaths = new Set((manifest.images || []).map((image) => image.storagePath).filter(Boolean));
  const added = [];

  for (const filePath of files) {
    const relativeName = path.relative(resolvedSourceDir, filePath).split(path.sep).join("/");
    const storagePath = `archive/time-backgrounds/${seasonTags[0]}/${timeBuckets[0]}/${relativeName}`;
    if (existingStoragePaths.has(storagePath)) continue;

    const dimensions = imageSize(filePath);
    await bucket.upload(filePath, {
      destination: storagePath,
      metadata: {
        cacheControl: "public, max-age=31536000, immutable",
        metadata: {
          app: "ezlong-invest-weather-clock",
          timeBuckets: timeBuckets.join(","),
          weatherTags: weatherTags.join(","),
          seasonTags: seasonTags.join(",")
        }
      }
    });

    const stat = await fs.stat(filePath);
    added.push({
      src: firebasePublicUrl(bucketName, storagePath),
      publicUrl: firebasePublicUrl(bucketName, storagePath),
      storagePath,
      timeBuckets,
      weatherTags,
      seasonTags,
      width: dimensions.width || null,
      height: dimensions.height || null,
      sizeKB: Math.round(stat.size / 102.4) / 10,
      source: "firebase-storage",
      collectedAtKST: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).replace(" ", "T") + "+09:00"
    });
  }

  manifest.updatedAtKST = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).replace(" ", "T") + "+09:00";
  manifest.season = seasonTags[0];
  manifest.images = [...(manifest.images || []), ...added];

  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  if (publicManifestPath !== manifestPath) {
    await fs.mkdir(path.dirname(publicManifestPath), { recursive: true });
    await fs.copyFile(manifestPath, publicManifestPath);
  }

  console.log(`bucket=${bucketName} scanned=${files.length} added=${added.length}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
