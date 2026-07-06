#!/usr/bin/env node
/**
 * Pre/post deploy checks for ezlong.com/time.
 *
 * Local:
 *   npm run verify:time
 *
 * Local + production:
 *   npm run verify:time -- --remote=https://ezlong.com/time
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const timeRoot = path.join(root, "time");
const remoteArg = process.argv.slice(2).find((arg) => arg.startsWith("--remote="));
const remoteBase = remoteArg ? remoteArg.replace("--remote=", "").replace(/\/$/, "") : "";
let failures = 0;

function pass(label) {
  console.log(`  OK ${label}`);
}

function fail(label, detail = "") {
  failures += 1;
  console.log(`  FAIL ${label}${detail ? ` - ${detail}` : ""}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function checkSyntax() {
  console.log("1) JavaScript syntax");
  for (const rel of ["time/app.js", "time/investment-quotes.js", "scripts/merge-time-quotes.js"]) {
    const fullPath = path.join(root, rel);
    if (!fs.existsSync(fullPath)) {
      fail(rel, "missing");
      continue;
    }
    try {
      execFileSync(process.execPath, ["--check", fullPath], { stdio: "pipe" });
      pass(rel);
    } catch (error) {
      fail(rel, error.stderr?.toString().split("\n")[0] || error.message);
    }
  }
}

function checkBackgroundManifest() {
  console.log("2) Background manifest");
  const manifestPath = path.join(timeRoot, "data", "background-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    fail("background-manifest.json", "missing");
    return;
  }

  const manifest = readJson(manifestPath);
  const images = Array.isArray(manifest.images) ? manifest.images : [];
  let broken = 0;
  let missingTags = 0;

  for (const image of images) {
    if (!image.src && !image.publicUrl) broken += 1;
    if (!image.seasonTags?.length || !image.weatherTags?.length || !image.timeBuckets?.length) missingTags += 1;

    const isRemote = String(image.src || image.publicUrl || "").startsWith("http");
    if (!isRemote && image.src && !fs.existsSync(path.join(timeRoot, image.src))) {
      broken += 1;
    }
  }

  const cloudy = images.filter((image) => (image.src || "").includes("/cloudy/"));
  const drizzle = images.filter((image) => (image.src || "").includes("/drizzling/"));
  const cloudyRain = cloudy.filter((image) => image.weatherTags?.some((tag) => ["light-rain", "rain", "heavy-rain"].includes(tag)));
  const drizzleCloudy = drizzle.filter((image) => image.weatherTags?.some((tag) => ["cloudy", "partly-cloudy"].includes(tag)));

  if (broken === 0) pass(`${images.length} images resolve locally or remotely`);
  else fail("broken background references", String(broken));

  if (missingTags === 0) pass("all images have season/weather/time tags");
  else fail("images missing required tags", String(missingTags));

  if (cloudyRain.length === 0 && drizzleCloudy.length === 0) pass(`cloudy/drizzling separation OK (${cloudy.length}/${drizzle.length})`);
  else fail("cloudy/drizzling tag contamination", `cloudyRain=${cloudyRain.length}, drizzleCloudy=${drizzleCloudy.length}`);
}

function checkQuoteArchive() {
  console.log("3) Quote archive");
  const manifestPath = path.join(timeRoot, "data", "quote-archive-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    fail("quote-archive-manifest.json", "missing");
    return;
  }

  const manifest = readJson(manifestPath);
  const quotes = Array.isArray(manifest.quotes) ? manifest.quotes : [];
  const seen = new Set();
  let dupes = 0;
  let invalid = 0;
  for (const quote of quotes) {
    if (!quote.text || !quote.title || !quote.author) invalid += 1;
    const key = `${quote.title}|${quote.author}|${quote.text}`.trim().toLowerCase();
    if (seen.has(key)) dupes += 1;
    seen.add(key);
  }

  if (quotes.length > 0) pass(`${quotes.length} quotes`);
  else fail("quote archive empty");
  if (dupes === 0) pass("no duplicate quotes");
  else fail("duplicate quotes", String(dupes));
  if (invalid === 0) pass("all quotes have text/title/author");
  else fail("invalid quotes", String(invalid));
}

async function checkRemote() {
  console.log("4) Remote");
  if (!remoteBase) {
    console.log("  skip remote checks (--remote=https://ezlong.com/time)");
    return;
  }

  for (const target of ["/", "/data/background-manifest.json", "/data/quote-archive-manifest.json"]) {
    try {
      const response = await fetch(`${remoteBase}${target}`, { method: "HEAD", cache: "no-store" });
      if (response.ok) pass(`${target} HTTP ${response.status}`);
      else fail(target, `HTTP ${response.status}`);
    } catch (error) {
      fail(target, error.message);
    }
  }
}

async function main() {
  checkSyntax();
  checkBackgroundManifest();
  checkQuoteArchive();
  await checkRemote();

  if (failures > 0) {
    console.log(`\n${failures} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("\nAll checks passed.");
  }
}

main();
