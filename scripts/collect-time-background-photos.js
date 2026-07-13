#!/usr/bin/env node
/**
 * scripts/collect-time-background-photos.js
 *
 * FlipZen Weather(ezlong.com/time) 배경사진 자동 수집 — GitHub Actions 전용판.
 *
 * 2026-07-13 신설 배경: Cowork 예약 스케줄(flipzen-hourly-photo-quote-collect)이
 * 위키미디어 커먼즈에서 이미지를 다운로드하려 했지만, Cowork 샌드박스의 WebFetch
 * 도구가 HTML 페이지만 파싱할 뿐 JSON API 응답·바이너리 이미지는 빈 값을
 * 돌려준다는 게 실측으로 확인됐다(Open-Meteo JSON도 동일 증상). bash 안에서
 * 직접 curl로 나가는 것도 샌드박스 network egress 정책상 막혀 있다. 즉 Cowork
 * 스케줄 세션 안에서는 이 기능이 구조적으로 불가능 — GitHub Actions 러너(제약
 * 없는 일반 네트워크)로 이 부분만 이전한다.
 *
 * WORK의 scripts/collect-background-photos.js 로직을 최대한 그대로 옮기되:
 *   - 이 저장소(ezlong.git) 자체가 곧 LIVE라 WORK/LIVE 구분이 없다 — public/
 *     미러 단계(mirrorForSites)는 대상 폴더가 없어 제거했다.
 *   - 원래 SKILL.md 1~2단계(날씨 조회, 취약 시간대 판단)는 Cowork 에이전트가
 *     프롬프트를 해석해서 수행했다 — 무인 스크립트에는 그 역할이 없으므로
 *     fetchWeatherHint()/pickTargetBucket()으로 흡수했다.
 *   - 원래 SKILL.md 4단계 컬러감 검수(사람이 5~20점 애매 구간을 육안 판단)도
 *     흡수했다 — 무인 환경이라 사람 판단을 흉내낼 수 없어, 보수적으로
 *     "20점 이상만 통과"로 기준을 단순화했다(원래: <5 무조건 폐기, 5~20 사람이
 *     보고 판단, 20↑ 통과). 앱이 "힐링/젠, 컬러감 있고 활기찬" 사진을 원한다는
 *     기존 방침에 맞춰 더 엄격한 쪽으로 통일한 것 — 이후 갤러리 도구에서 실제
 *     결과물을 보고 기준을 조정할 수 있다(colorfulness 필드를 매니페스트에
 *     같이 남겨둔다).
 *
 * 투자 명언 큐레이션은 이 스크립트의 대상이 아니다 — 인터넷 조회가 필요 없어
 * Cowork 스케줄 작업에서 계속 정상 동작하므로 역할을 그대로 남겨둔다.
 *
 * 실행: node scripts/collect-time-background-photos.js
 * (저장소 루트에서 실행. Node 18+ 내장 fetch만 쓰고 외부 npm 의존성 없음.
 *  컬러감 검수만 python3 + Pillow가 PATH에 있어야 한다.)
 */

import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const root = path.join(repoRoot, "time"); // ezlong.com/time 배포 대상
const manifestPath = path.join(root, "data", "background-manifest.json");
const archiveRoot = path.join(root, "assets", "background-archive");

const WEAK_THRESHOLD = 30;
const COLORFULNESS_PASS = 20;

// SKILL.md 2단계와 동일한 동률 우선순위(앞쪽이 우선).
const TIME_BUCKET_PRIORITY = [
  "night", "pre-dawn", "midnight", "dawn", "early-morning", "morning",
  "evening", "late-afternoon", "sunset", "late-morning", "midday", "afternoon",
];

// 2026-07-08: "힐링/젠" 컨셉 앱이라 흐리거나 비가 오는 날씨에도 사진 자체는
// 컬러감 있고 생기있어야 한다는 유저 피드백 반영 — 검색어 단계에서부터
// vibrant/colorful 계열 키워드를 넣어 무채색·톤다운 사진이 애초에 덜 걸리게 한다.
const moodQuery = "beautiful atmospheric vibrant colorful wallpaper sky field trees park cafe window view no people";

const timePlans = [
  { bucket: "dawn", hours: [5], query: "dawn nature landscape" },
  { bucket: "early-morning", hours: [6, 7], query: "early morning nature landscape" },
  { bucket: "morning", hours: [8, 9], query: "morning nature landscape" },
  { bucket: "late-morning", hours: [10, 11], query: "late morning nature landscape" },
  { bucket: "midday", hours: [12, 13], query: "midday blue sky nature landscape" },
  { bucket: "afternoon", hours: [14, 15], query: "afternoon nature landscape" },
  { bucket: "late-afternoon", hours: [16, 17], query: "late afternoon nature landscape" },
  { bucket: "sunset", hours: [18, 19], query: "sunset nature landscape" },
  { bucket: "evening", hours: [20, 21], query: "evening nature landscape" },
  { bucket: "night", hours: [22, 23], query: "night nature landscape" },
  { bucket: "midnight", hours: [0, 1, 2], query: "midnight nature landscape" },
  { bucket: "pre-dawn", hours: [3, 4], query: "predawn nature landscape" },
];

function kstNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

function getTargetPlan(offsetHours = 0) {
  const now = kstNow();
  const targetHour = (now.getHours() + offsetHours) % 24;
  return timePlans.find((plan) => plan.hours.includes(targetHour)) || timePlans[2];
}

function seasonFromKst(date = kstNow()) {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

function seasonQuery(season) {
  return {
    spring: "spring fresh green flowers",
    summer: "summer lush green July",
    autumn: "autumn foliage clear air",
    winter: "winter calm landscape",
  }[season] || "summer lush green";
}

function weatherTagFromText(text = "") {
  if (/heavy rain|storm|downpour|강한 비|많은 비|폭우/i.test(text)) return "heavy-rain";
  if (/light rain|drizzle|약한 비|이슬비|가랑비|보슬비/i.test(text)) return "light-rain";
  if (/rain|비|shower/i.test(text)) return "rain";
  if (/snow|눈/i.test(text)) return "snow";
  if (/mist|fog|안개/i.test(text)) return "mist";
  if (/overcast|많이 흐림|흐림/i.test(text)) return "cloudy";
  if (/cloud|구름|조금 흐림/i.test(text)) return "partly-cloudy";
  return "clear";
}

function weatherQueryForTag(tag) {
  const queries = {
    "light-rain": "gentle light rain sky trees park cafe window view",
    rain: "rainy sky field trees park landscape",
    "heavy-rain": "heavy rain trees park window view landscape",
    cloudy: "overcast sky field trees park landscape",
    "partly-cloudy": "partly cloudy sky field trees park landscape",
    mist: "misty morning trees field park landscape",
    snow: "snow nature landscape",
    clear: "clear sky field trees park landscape",
  };
  return queries[tag] || queries.clear;
}

function fallbackQueriesForTag(tag) {
  const fallbacks = {
    "light-rain": [
      "gentle rain trees park",
      "rainy cafe window view reading",
      "rainy summer forest wallpaper",
      "rain drops leaves landscape",
    ],
    rain: ["rainy sky trees field", "rainy forest wallpaper", "summer rain park landscape"],
    "heavy-rain": ["heavy rain forest wallpaper", "rain storm sky landscape", "tropical rain trees"],
    cloudy: ["overcast sky field trees", "cozy reading cafe overcast window view", "cloudy summer park landscape"],
    "partly-cloudy": ["partly cloudy sky field trees", "summer clouds park landscape"],
    clear: ["blue sky field trees wallpaper", "summer park trees clear sky", "cafe window sunny view reading"],
  };
  return fallbacks[tag] || [];
}

function buildBroadFallbackQueries(plan, weatherTag, season) {
  const seasonWord = season || "summer";
  const bucketWords = plan.bucket.replace(/-/g, " ");
  const weatherWords = {
    "light-rain": "gentle rain",
    rain: "rainy",
    "heavy-rain": "heavy rain",
    cloudy: "overcast",
    "partly-cloudy": "cloudy",
    mist: "misty",
    snow: "snow",
    clear: "blue sky",
  }[weatherTag] || "blue sky";

  return [
    `${seasonWord} ${weatherWords} landscape`,
    `${weatherWords} landscape`,
    `${seasonWord} ${bucketWords} nature`,
    `${seasonWord} trees sky`,
    `${seasonWord} park landscape`,
    `${bucketWords} landscape`,
  ];
}

function buildSearchQueries(plan, weatherTag, season) {
  const seasonPart = seasonQuery(season);
  const primary = `${seasonPart} ${plan.query} ${weatherQueryForTag(weatherTag)} ${moodQuery}`;
  const fallback = fallbackQueriesForTag(weatherTag).map((query) => `${seasonPart} ${plan.query} ${query} ${moodQuery}`);
  const broadFallback = buildBroadFallbackQueries(plan, weatherTag, season);
  return [...new Set([primary, ...fallback, ...broadFallback])];
}

async function readManifest() {
  try {
    return JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch {
    return { updatedAtKST: "", season: "summer", images: [] };
  }
}

async function searchCommons(query, limit) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrsearch", `${query} filetype:bitmap`);
  url.searchParams.set("gsrlimit", String(Math.min(50, Math.max(24, limit * 12))));
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime|size|extmetadata");
  url.searchParams.set("iiurlwidth", "1800");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Commons search failed: ${response.status}`);
  const data = await response.json();
  const pages = Object.values(data.query?.pages || {});

  return pages
    .map((page) => page.imageinfo?.[0])
    .filter((info) => info?.thumburl && /^image\/(jpeg|png|webp)$/.test(info.mime || ""))
    .filter(isWallpaperFormat)
    .filter(isUsableNatureImage)
    .slice(0, limit);
}

function isWallpaperFormat(info) {
  const width = Number(info.thumbwidth || info.width || 0);
  const height = Number(info.thumbheight || info.height || 0);
  return width >= 1200 && height >= 700 && width >= height * 1.15;
}

function plainMetadata(info) {
  const metadata = info.extmetadata || {};
  return [
    info.descriptionurl,
    info.url,
    metadata.ObjectName?.value,
    metadata.ImageDescription?.value,
    metadata.Categories?.value,
    metadata.Artist?.value,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase();
}

function cleanMetadataValue(value = "") {
  return String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function commonsAttribution(info) {
  const metadata = info.extmetadata || {};
  return cleanMetadataValue(metadata.Artist?.value || metadata.Credit?.value || metadata.AttributionRequired?.value || "");
}

function commonsLicense(info) {
  const metadata = info.extmetadata || {};
  return cleanMetadataValue(metadata.LicenseShortName?.value || metadata.License?.value || "");
}

function isUsableNatureImage(info) {
  const text = plainMetadata(info);
  const negative = [
    "portrait", "person", "people", "human", "woman", "man", "girl", "boy", "child", "children",
    "selfie", "crowd", "festival", "old woman", "elderly", "poor", "poverty",
    "painting", "drawing", "illustration", "engraving", "artwork", "museum", "page",
    "story", "verse", "camera", "scan", "archive", "poster", "statue", "sculpture",
    "pepper", "vegetable", "fruit", "food", "bridge", "footbridge",
    "trail bridge", "road", "car", "railway", "train", "weapon", "war", "ruin",
    "black and white", "black-and-white", "monochrome", "monochromatic",
    "grayscale", "greyscale", "b&w photography", "sepia", "desaturated",
  ];
  if (negative.some((word) => text.includes(word))) return false;

  const positive = [
    "forest", "rainforest", "tree", "trees", "plant", "plants", "flower", "flowers",
    "woods", "landscape", "mountain", "valley", "field", "meadow", "grass",
    "countryside", "rural", "village", "park", "garden", "sky", "cloud", "overcast", "rain", "raindrop",
    "mist", "fog", "river", "lake", "waterfall", "sea", "coast", "aerial", "skyline",
    "cityscape", "cafe", "coffee", "coffee shop", "reading", "bookshelf", "book",
    "library", "window", "view", "cozy", "peaceful", "atmospheric", "healing", "quiet",
  ];
  return positive.some((word) => text.includes(word));
}

async function downloadImage(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Image download failed: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outputPath, buffer);
  return buffer.length;
}

// SKILL.md 1단계 포팅 — Open-Meteo(키 불필요), 실패해도 빈 문자열로 조용히 폴백.
async function fetchWeatherHint() {
  const codeMap = {
    0: "clear sky", 1: "partly cloudy", 2: "partly cloudy", 3: "overcast",
    45: "foggy mist", 48: "foggy mist",
    51: "light rain drizzle", 53: "light rain drizzle", 55: "light rain drizzle",
    56: "light rain drizzle", 57: "light rain drizzle",
    61: "rain", 63: "rain", 66: "rain", 67: "rain",
    65: "heavy rain", 80: "heavy rain", 81: "heavy rain", 82: "heavy rain",
    71: "snow", 73: "snow", 75: "snow", 77: "snow", 85: "snow", 86: "snow",
    95: "thunderstorm heavy rain", 96: "thunderstorm heavy rain", 99: "thunderstorm heavy rain",
  };
  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=weather_code,temperature_2m&timezone=Asia%2FSeoul";
    const response = await fetch(url);
    if (!response.ok) return "";
    const data = await response.json();
    return codeMap[data.current?.weather_code] || "";
  } catch (error) {
    console.warn(`weather fetch failed(무시하고 진행): ${error.message}`);
    return "";
  }
}

// SKILL.md 2단계 포팅 — 취약 시간대(30장 미만) 중 가장 적은 버킷을 겨냥.
// 전부 30장 이상이면 null(=현재 시각 기준 버킷 사용).
function pickTargetBucket(manifest) {
  const counts = Object.fromEntries(timePlans.map((p) => [p.bucket, 0]));
  for (const img of manifest.images || []) {
    for (const bucket of img.timeBuckets || []) {
      if (counts[bucket] !== undefined) counts[bucket] += 1;
    }
  }
  const weak = TIME_BUCKET_PRIORITY
    .map((bucket) => ({ bucket, count: counts[bucket] }))
    .filter((entry) => entry.count < WEAK_THRESHOLD);
  if (weak.length === 0) return null;
  weak.sort((a, b) => a.count - b.count);
  return weak[0].bucket;
}

// SKILL.md 4단계 포팅 — python3 + Pillow 서브프로세스로 원래 스니펫 그대로 계산.
function colorfulnessScore(imagePath) {
  const snippet = `
import math
from PIL import Image
im = Image.open(${JSON.stringify(imagePath)}).convert("RGB").resize((120,120))
px = list(im.getdata())
rg = [r-g for (r,g,b) in px]
yb = [0.5*(r+g)-b for (r,g,b) in px]
def stats(vals):
    n=len(vals); m=sum(vals)/n; v=sum((x-m)**2 for x in vals)/n
    return m, v**0.5
rgm, rgs = stats(rg); ybm, ybs = stats(yb)
cf = math.sqrt(rgs**2+ybs**2) + 0.3*math.sqrt(rgm**2+ybm**2)
print(round(cf, 2))
`;
  const output = execFileSync("python3", ["-c", snippet], { encoding: "utf8" });
  return Number(output.trim());
}

async function main() {
  const weatherHint = await fetchWeatherHint();
  const weatherTag = weatherTagFromText(weatherHint);
  const season = seasonFromKst();

  const manifest = await readManifest();
  const targetBucket = pickTargetBucket(manifest);
  const plan = targetBucket ? timePlans.find((p) => p.bucket === targetBucket) : getTargetPlan(0);
  const quietNight = ["midnight", "pre-dawn"].includes(plan.bucket);
  const count = quietNight ? 1 : 3;

  console.log(
    `weather="${weatherHint || "(조회 실패)"}" weatherTag=${weatherTag} season=${season} ` +
    `targetBucket=${targetBucket || "(취약버킷 없음, 현재시각 기준)"} plan=${plan.bucket} count=${count}`
  );

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const outputDir = path.join(archiveRoot, today, plan.bucket);
  await fs.mkdir(outputDir, { recursive: true });

  const existing = new Set((manifest.images || []).map((image) => image.src));
  const existingSourceUrls = new Set((manifest.images || []).map((image) => image.sourceUrl).filter(Boolean));
  const candidateLimit = Math.max(count * 3, count + 6);
  let results = [];
  for (const query of buildSearchQueries(plan, weatherTag, season)) {
    if (results.length >= candidateLimit) break;
    let moreResults;
    try {
      moreResults = await searchCommons(query, candidateLimit - results.length);
    } catch (error) {
      console.warn(`search failed for "${query}": ${error.message}`);
      continue;
    }
    const knownUrls = new Set(results.map((item) => item.thumburl));
    results = [
      ...results,
      ...moreResults.filter((item) => {
        const sourceUrl = item.descriptionurl || item.url || "";
        return !knownUrls.has(item.thumburl) && !existingSourceUrls.has(sourceUrl);
      }),
    ];
  }

  const added = [];
  for (const [index, info] of results.entries()) {
    if (added.length >= count) break;
    const extension = info.mime === "image/png" ? "png" : info.mime === "image/webp" ? "webp" : "jpg";
    const filename = `${plan.bucket}-${Date.now()}-${index + 1}.${extension}`;
    const relativePath = path.posix.join("assets", "background-archive", today, plan.bucket, filename);
    if (existing.has(relativePath)) continue;
    const outputPath = path.join(outputDir, filename);

    try {
      await downloadImage(info.thumburl, outputPath);
    } catch (error) {
      console.warn(`skip(download 실패) ${info.thumburl}: ${error.message}`);
      continue;
    }

    let cf;
    try {
      cf = colorfulnessScore(outputPath);
    } catch (error) {
      console.warn(`skip(컬러감 검수 실패) ${filename}: ${error.message}`);
      await fs.unlink(outputPath).catch(() => {});
      continue;
    }
    if (cf < COLORFULNESS_PASS) {
      console.log(`reject(colorfulness=${cf}, 기준 ${COLORFULNESS_PASS} 미만) ${filename}`);
      await fs.unlink(outputPath).catch(() => {});
      continue;
    }

    added.push({
      src: relativePath,
      timeBuckets: [plan.bucket],
      weatherTags: [weatherTag],
      seasonTags: [season],
      source: "wikimedia-commons",
      attribution: commonsAttribution(info),
      license: commonsLicense(info),
      sourceUrl: info.descriptionurl || info.url || "",
      collectedAtKST: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).replace(" ", "T") + "+09:00",
      colorfulness: cf,
    });
    console.log(`accept(colorfulness=${cf}) ${filename}`);
  }

  if (added.length > 0) {
    manifest.updatedAtKST = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).replace(" ", "T") + "+09:00";
    manifest.season = season;
    manifest.images = [...(manifest.images || []), ...added];
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  }

  console.log(`bucket=${plan.bucket} weather=${weatherTag} candidates=${results.length} added=${added.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
