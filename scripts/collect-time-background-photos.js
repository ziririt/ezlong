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
 * 2026-07-22 컬러 기준 보강: 유저 피드백 — "사진 전체가 회색빛·백색톤으로
 * 불투명하게 흐릿한 사진 말고, 초록 나무·파란 하늘·빨간 포인트처럼 채도 높은
 * 컬러 포인트가 반드시 있어야 한다. 단, 비 오는 날은 비 오는 매력이 느껴지면
 * 통과. 불투명한 느낌이거나 보고 나서 기분이 안 좋아지는 사진은 제외."
 * 기존엔 이미지 전체 평균 컬러풀니스(cf) 한 지표만 봐서 "전체는 흐릿한데
 * 평균만 어쩌다 넘긴" 사진이나 "전체 채도는 낮지만 실제로 칙칙한" 사진을
 * 걸러내지 못했다. photoColorMetrics()로 3개 지표를 함께 계산한다:
 *   - cf: 기존 Hasler-Süsstrunk 평균 컬러풀니스 (전체적인 컬러감)
 *   - peakSat: 채도 상위 5% 지점 값 (사진 안에 확실한 컬러 포인트가
 *     있는지 — 평균이 낮아도 이게 높으면 "포인트 컬러가 있는 사진")
 *   - contrast: 명도(V) 표준편차 (낮으면 안개·헤이즈처럼 뿌옇고
 *     불투명한 사진 — 원인 문제였던 부분)
 * 비 오는 날(rain/light-rain/heavy-rain 태그)은 하늘이 원래 흐려 평균이
 * 낮게 나오는 게 정상이라 cf·peakSat 기준을 낮춰주되, contrast 하한은
 * 여전히 둬서 "완전히 뿌연 무채색" 사진은 비 오는 날에도 계속 걸러낸다.
 * "기분이 안 좋아지는 사진"은 수치로 재기 어려워 isUsableNatureImage()의
 * 부정 키워드 목록에 재난·황폐·음울 계열 단어를 추가하는 방식으로 보강했다.
 *
 * 2026-07-25 소재·지역 배제 확대: 유저가 갤러리 관리툴(localhost:8787)에서
 * 실제 수집된 사진 중 "별로인 사진"을 체크로 직접 골라 보여줬다 — 공통점은
 * 황야·불모지·황무지처럼 초록초록하지 않은 느낌, 비비드하지 않은 컬러,
 * 배경화면으로 쓰기엔 조잡하고 번잡한 피사체(북적이는 항공뷰 도심, 사람이
 * 있는 강가, 어수선한 갈대숲 클로즈업 등). 반대로 "좋아하는 예시"로는 색이
 * 곱고 선명하며 초록초록한 자연, 벚꽃길·이끼 낀 계곡·잔잔한 호수처럼
 * 낭만적인 느낌의 사진을 보여줬다. 유저가 명시적으로 아프리카·중동·
 * 서남아시아·사바나 지역도 지양해달라고 요청 — isUsableNatureImage()
 * 부정 키워드에 사바나/황무지/사막·건조지대 계열 단어와 해당 권역 국가명을
 * 추가하고, 번잡한 도심 항공뷰를 유발하던 "cityscape"/"skyline"을 통과
 * 키워드에서 제외했다. 이 필터는 Wikimedia Commons 메타데이터(카테고리·
 * 설명) 텍스트 매칭이라 완벽하지 않다 — 이미지 내용 자체의 "초록/낭만적
 * 느낌"은 컬러 수치(cf/peakSat/contrast)만으로는 판정 불가능한 영역이라,
 * 검색어(moodQuery) 쪽에도 "lush green romantic dreamy" 를 추가해 애초에
 * 그런 사진이 더 많이 검색되도록 보강했다. 실제 수집 결과를 갤러리에서
 * 계속 확인하며 기준을 더 조정할 것.
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

// 2026-07-22: 1회 실행당 최소 수집 목표. 자정~새벽4시 예외(1장) 폐지 후
// 전 시간대 공통 적용. 워크플로 실행 주기도 1시간→30분(하루 24회→48회)으로
// 함께 조정해, 컬러 기준이 깐깐해져도 하루 누적량이 급감하지 않게 했다.
const MIN_PHOTOS_PER_RUN = 5;

// 2026-07-22: 단일 COLORFULNESS_PASS(20)를 3지표 기준으로 교체.
//   cfMin       — 전체 평균 컬러풀니스 하한 (Hasler-Süsstrunk)
//   peakSatMin  — 채도 상위 5% 지점 하한 (컬러 포인트 존재 여부, 0~255)
//   contrastMin — 명도(V) 표준편차 하한 (뿌옇고 불투명한 사진 차단, 0~255)
// 비 오는 날은 하늘·전체 톤이 원래 어둡고 채도가 낮아지므로 cf·peakSat만
// 완화하고, "불투명함" 방지선인 contrastMin은 거의 그대로 유지한다.
// 2026-07-22 합성 이미지 7종(안개회색/화창한초록+파랑+빨강점/비오는날+젖은초록/
// 완전백색톤/비오는날+무채색/무채색배경+작은포인트7%/2%)으로 실측 검증한 값.
// contrastMin은 명도(V) 표준편차 — 실제 안개·백색톤 사진은 0.6~1.7 수준으로
// 바닥을 기는 반면, "배경은 밋밋해도 포인트 컬러가 있는" 정상 사진도 8~9는
// 나오므로 28처럼 높게 잡으면 후자까지 오탈락한다. 6(base)/5(rain)이면 진짜
// 안개·백색 사진과는 4배 이상 여유를 두면서 정상 사진은 통과시킨다.
// (참고: satStd(채도 자체의 표준편차)는 검토했으나 "전체가 고르게 컬러풀한"
// 사진에서 오히려 낮게 나와 — 예: 하늘+잔디 2톤 사진이 satStd=10.9로 낮음 —
// 기준으로 쓰기에 부적합해 채택하지 않았다.)
// 2026-07-22 2차 조정: 유저가 "컬러감 검수는 깐깐하게" 요청 — 1차 값 대비
// 20~40% 상향(hazy/white/flat 케이스 대비 여전히 4배 이상 여유 유지 확인,
// 다만 "배경은 밋밋해도 작은 컬러 포인트만 있는" 경계 사례는 이제 탈락시킴
// — 더 엄격하게 걸러달라는 요청과 일치).
const COLOR_CRITERIA = {
  base: { cfMin: 30, peakSatMin: 110, contrastMin: 10 },
  rain: { cfMin: 20, peakSatMin: 85, contrastMin: 8 },
};
const RAIN_WEATHER_TAGS = ["rain", "light-rain", "heavy-rain"];
// 명도(V)가 이 값을 넘도록 하얗게 날아간 사진은, 컬러 포인트(peakSat)가
// 기준보다도 한참 더 높지 않으면 "온통 백색톤" 사진으로 간주해 추가 차단.
const OVEREXPOSED_V = 238;
const OVEREXPOSED_PEAK_SAT_MARGIN = 20;

// SKILL.md 2단계와 동일한 동률 우선순위(앞쪽이 우선).
const TIME_BUCKET_PRIORITY = [
  "night", "pre-dawn", "midnight", "dawn", "early-morning", "morning",
  "evening", "late-afternoon", "sunset", "late-morning", "midday", "afternoon",
];

// 2026-07-08: "힐링/젠" 컨셉 앱이라 흐리거나 비가 오는 날씨에도 사진 자체는
// 컬러감 있고 생기있어야 한다는 유저 피드백 반영 — 검색어 단계에서부터
// vibrant/colorful 계열 키워드를 넣어 무채색·톤다운 사진이 애초에 덜 걸리게 한다.
// 2026-07-25: "lush green romantic dreamy" 추가 — 유저가 좋아하는 예시(색이
// 곱고 선명한, 초록초록한, 낭만적인 느낌)에 맞춰 검색 단계부터 편향시킨다.
const moodQuery = "beautiful atmospheric vibrant colorful lush green romantic dreamy wallpaper sky field trees park cafe window view no people";

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

// 2026-07-24 유저 확정 — 새 사진의 seasonTags 부여 규칙(수집 "날짜" 기준 +
// 내용 분석 예외). 위 seasonFromKst()는 "무엇을 검색할지"(검색어의 계절감)에
// 계속 쓰이고, 이 함수는 "어느 계절에 보여줄지"(seasonTags)만 담당한다 —
// 앱은 seasonTags로 현재 계절 사진을 고르므로(app.js seasonMatches) 이 값이
// 실사용 데이터다.
//   1) 내용상 계절감이 확실하면 그 계절만: 수영장/바캉스류 → summer 단독,
//      눈/설경 → winter, 단풍 → autumn, 벚꽃 → spring.
//   2) 그 외에는 수집 날짜로: 5/1~8/31 → 봄·여름·가을 겸용(초록 풍경은
//      세 계절 다 어울린다는 유저 판단), 9/1~11/30 → 가을, 12/1~2/15 → 겨울,
//      2/16~4/30 → 봄.
// (유저 원문은 "8월 30일까지"였으나 9/1과의 사이에 8/31 하루가 비어
// 8/31까지로 붙였다 — 하루 공백으로 태그 없는 사진이 생기는 것 방지.)
function seasonTagsForNewPhoto({ info, filename, weatherTag, date = kstNow() }) {
  const text = [
    filename || "",
    info?.canonicaltitle || "",
    info?.descriptionurl || "",
  ].join(" ");
  if (/pool|swimming|bikini|surf|tropical|palm|vacation|vacanc|waterpark|snorkel|barbecue|beach volleyball/i.test(text)) {
    return ["summer"];
  }
  if (weatherTag === "snow" || /snow|winter|frost|icicle|blizzard/i.test(text)) {
    return ["winter"];
  }
  if (/autumn|foliage|maple|fall color|fall foliage|red leaves/i.test(text)) {
    return ["autumn"];
  }
  if (/cherry blossom|sakura|blossom|spring flower/i.test(text)) {
    return ["spring"];
  }
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (month >= 5 && month <= 8) return ["autumn", "spring", "summer"];
  if (month >= 9 && month <= 11) return ["autumn"];
  if (month === 12 || month === 1 || (month === 2 && day <= 15)) return ["winter"];
  return ["spring"]; // 2/16 ~ 4/30
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
    // 2026-07-22 추가 — 채도가 높아도 보고 나서 기분이 안 좋아질 수 있는 소재
    // (수치 검사로는 못 걸러내는 "무드" 차단, 텍스트 메타데이터 기반).
    "disaster", "wildfire", "forest fire", "smoke haze", "drought", "barren",
    "flood damage", "storm damage", "hurricane damage", "pollution haze",
    "smog", "bleak", "gloomy", "abandoned building", "decay", "decayed",
    "dead tree", "dying", "toxic", "landfill", "garbage dump", "accident",
    // 2026-07-25 추가 — 황야/불모지/황무지/사막·건조지대 계열(초록초록하지
    // 않고 배경화면으로 쓰기엔 삭막한 소재).
    "wasteland", "desolate", "desolation", "arid", "aridity", "outback",
    "scrubland", "shrubland", "steppe", "savanna", "savannah", "sand dune",
    "dune", "dust bowl", "badlands", "rocky plain", "gravel plain",
    // 2026-07-25 추가 — 아프리카·중동·서남아시아·사바나 권역(유저 명시 요청).
    "africa", "african", "sahara", "kalahari", "serengeti", "sahel", "sub-saharan",
    "kenya", "tanzania", "ethiopia", "sudan", "somalia", "nigeria", "namibia",
    "botswana", "zimbabwe", "morocco", "algeria", "tunisia", "libya", "egypt",
    "middle east", "arabia", "arabian peninsula", "gulf state",
    "saudi arabia", "united arab emirates", "dubai", "abu dhabi", "qatar",
    "bahrain", "kuwait", "oman", "yemen", "iran", "iraq", "jordan", "syria",
    "afghanistan", "southwest asia", "south-west asia",
  ];
  if (negative.some((word) => text.includes(word))) return false;

  const positive = [
    "forest", "rainforest", "tree", "trees", "plant", "plants", "flower", "flowers",
    "woods", "landscape", "mountain", "valley", "field", "meadow", "grass",
    "countryside", "rural", "village", "park", "garden", "sky", "cloud", "overcast", "rain", "raindrop",
    "mist", "fog", "river", "lake", "waterfall", "sea", "coast", "aerial",
    "cafe", "coffee", "coffee shop", "reading", "bookshelf", "book",
    "library", "window", "view", "cozy", "peaceful", "atmospheric", "healing", "quiet",
    // 2026-07-25: "cityscape"/"skyline"은 번잡한 항공뷰 도심 사진(유저가
    // 조잡하다고 지적한 예시)을 통과시키는 원인이라 통과 키워드에서 제거.
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

// SKILL.md 4단계 포팅 — python3 + Pillow 서브프로세스.
// 2026-07-22: 기존엔 cf(전체 평균 컬러풀니스) 하나만 계산했는데, 3개 지표로
// 확장했다 — cf(전체 컬러감), peakSat(채도 상위 10% = 컬러 포인트 존재
// 여부), contrast(명도 표준편차 = 뿌옇고 불투명한 사진 여부).
function photoColorMetrics(imagePath) {
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

hsv_px = list(im.convert("HSV").getdata())
sat_vals = sorted(s for (h, s, v) in hsv_px)
val_vals = [v for (h, s, v) in hsv_px]
n = len(sat_vals)
peak_sat = sat_vals[int(n * 0.95)]  # 상위 5% 지점 = "포인트 컬러" 민감도 확보
avg_v = sum(val_vals) / len(val_vals)
contrast = (sum((v - avg_v) ** 2 for v in val_vals) / len(val_vals)) ** 0.5

print(f"{round(cf,2)},{peak_sat},{round(contrast,2)},{round(avg_v,2)}")
`;
  const output = execFileSync("python3", ["-c", snippet], { encoding: "utf8" });
  const [cf, peakSat, contrast, avgV] = output.trim().split(",").map(Number);
  return { cf, peakSat, contrast, avgV };
}

// 2026-07-22 신설 — 3지표 + 비 오는 날 완화 기준으로 통과 여부를 판정한다.
function passesColorCriteria(metrics, weatherTag) {
  const rule = RAIN_WEATHER_TAGS.includes(weatherTag) ? COLOR_CRITERIA.rain : COLOR_CRITERIA.base;

  if (metrics.contrast < rule.contrastMin) {
    return { pass: false, reason: `contrast=${metrics.contrast}<${rule.contrastMin}(뿌옇고 불투명함)` };
  }
  if (metrics.peakSat < rule.peakSatMin) {
    return { pass: false, reason: `peakSat=${metrics.peakSat}<${rule.peakSatMin}(선명한 컬러 포인트 없음)` };
  }
  if (metrics.cf < rule.cfMin) {
    return { pass: false, reason: `cf=${metrics.cf}<${rule.cfMin}(전체 컬러감 부족)` };
  }
  if (metrics.avgV > OVEREXPOSED_V && metrics.peakSat < rule.peakSatMin + OVEREXPOSED_PEAK_SAT_MARGIN) {
    return { pass: false, reason: `avgV=${metrics.avgV}(하얗게 날아간 백색톤)` };
  }
  return { pass: true, reason: "" };
}

async function main() {
  const weatherHint = await fetchWeatherHint();
  const weatherTag = weatherTagFromText(weatherHint);
  const season = seasonFromKst();

  const manifest = await readManifest();
  const targetBucket = pickTargetBucket(manifest);
  const plan = targetBucket ? timePlans.find((p) => p.bucket === targetBucket) : getTargetPlan(0);
  // 2026-07-22: 자정~새벽4시(midnight/pre-dawn)만 1장으로 줄이던 예외를
  // 유저 요청으로 제거 — 전 시간대 동일하게 MIN_PHOTOS_PER_RUN을 목표로 한다.
  const count = MIN_PHOTOS_PER_RUN;

  console.log(
    `weather="${weatherHint || "(조회 실패)"}" weatherTag=${weatherTag} season=${season} ` +
    `targetBucket=${targetBucket || "(취약버킷 없음, 현재시각 기준)"} plan=${plan.bucket} count=${count}`
  );

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const outputDir = path.join(archiveRoot, today, plan.bucket);
  await fs.mkdir(outputDir, { recursive: true });

  const existing = new Set((manifest.images || []).map((image) => image.src));
  const existingSourceUrls = new Set((manifest.images || []).map((image) => image.sourceUrl).filter(Boolean));
  // 2026-07-22: 컬러 기준이 깐깐해져 통과율이 떨어질 걸 감안해 후보군을
  // 넉넉히 확보(3배·+6 → 8배·+20). count=5 기준 후보 최대 40장까지 탐색.
  const candidateLimit = Math.max(count * 8, count + 20);
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

    let metrics;
    try {
      metrics = photoColorMetrics(outputPath);
    } catch (error) {
      console.warn(`skip(컬러감 검수 실패) ${filename}: ${error.message}`);
      await fs.unlink(outputPath).catch(() => {});
      continue;
    }
    const verdict = passesColorCriteria(metrics, weatherTag);
    if (!verdict.pass) {
      console.log(`reject(${verdict.reason}) ${filename}`);
      await fs.unlink(outputPath).catch(() => {});
      continue;
    }

    added.push({
      src: relativePath,
      timeBuckets: [plan.bucket],
      weatherTags: [weatherTag],
      seasonTags: seasonTagsForNewPhoto({ info, filename, weatherTag }),
      source: "wikimedia-commons",
      attribution: commonsAttribution(info),
      license: commonsLicense(info),
      sourceUrl: info.descriptionurl || info.url || "",
      collectedAtKST: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).replace(" ", "T") + "+09:00",
      colorfulness: metrics.cf,
      peakSaturation: metrics.peakSat,
      contrast: metrics.contrast,
    });
    console.log(`accept(cf=${metrics.cf}, peakSat=${metrics.peakSat}, contrast=${metrics.contrast}) ${filename}`);
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
