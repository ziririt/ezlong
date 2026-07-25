/**
 * scripts/validate-photo-classifier.mjs
 *
 * photo-tag-classifier.mjs 정확도 검증 하네스 — 2026-07-25 신설
 *
 * ── 목적 ───────────────────────────────────────────────────────────────────
 * 분류기를 실제 수집 파이프라인에 붙이기 "전에" 정확도를 먼저 실측한다.
 * CLAUDE.md 18항(실측 없이 가설만으로 연쇄 수정 금지) 원칙 적용.
 *
 * ── 정답지의 출처 ──────────────────────────────────────────────────────────
 * background-manifest.json 인덱스 2514~2533 (봇이 자동 수집한 20장 전부).
 * 2026-07-25 세션에서 Claude가 20장을 한 장씩 전부 열어 육안으로 판정했다.
 * 이 20장은 유저가 손대지 않은 순수 봇 수집분이라 검증셋으로 적합하다.
 *
 * 참고 — 같은 20장에 대한 기존(봇) 태그의 정확도:
 *   시간대 그룹 45% (9/20), 날씨 그룹 20% (4/20)
 *   비 계열 태그 12장 중 실제 비 오는 사진 0장
 * 새 분류기는 최소한 이 수치를 크게 넘어야 도입 가치가 있다.
 *
 * ── 채점 방식 ──────────────────────────────────────────────────────────────
 * 유저 확정 정책이 "겸용 태깅"이므로, 정답을 단일값이 아니라 "허용 집합"으로 둔다.
 * 모델이 낸 그룹 중 하나라도 허용 집합에 들어가면 정답으로 친다.
 * 예: 2516은 역광이라 일출/일몰 구별이 어렵다 → T4도 T1도 정답 처리.
 * 다만 "허용 집합에 없는 그룹을 함께 붙인 경우"는 overreach로 따로 집계한다
 * (겸용이 지나쳐 한낮 사진이 밤에 뜨는 사고를 잡기 위함).
 *
 * ── 실행 방법 ──────────────────────────────────────────────────────────────
 *   cd ~/Documents/Claude/Projects/미국주식투자자를\ 위한\ ezlong.com
 *   GEMINI_API_KEY=... node scripts/validate-photo-classifier.mjs
 *
 * 결과는 화면 출력 + scripts/validate-photo-classifier-result.json 에 저장된다.
 * 그 JSON 파일을 Claude에게 보여주면 오답 패턴을 분석해 프롬프트를 고칠 수 있다.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyPhoto, MODEL, resolveApiKey, KEY_FILE } from "./photo-tag-classifier.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TIME_DIR = path.join(ROOT, "time");
const MANIFEST = path.join(TIME_DIR, "data", "background-manifest.json");
const OUT = path.join(__dirname, "validate-photo-classifier-result.json");

// 장당 판정 횟수(자기일관성 다수결). 정확도 우선이라 기본 3회.
// PASSES=1 로 두면 단발 판정이 되어 1차 검증과 같은 조건이 된다.
const PASSES = Number(process.env.CLASSIFY_PASSES || 3);

// ── 정답지 (2026-07-25 Claude 육안 판정) ───────────────────────────────────
// time    : 허용 시간 그룹 집합
// weather : 허용 날씨 그룹 집합
// season  : 허용 계절 조합 (배열의 배열). 기본값 = spring+summer+autumn
// note    : 왜 그렇게 판정했는지 (프롬프트 튜닝 시 참고용)
const DEFAULT_SEASON = ["spring", "summer", "autumn"];
const TRUTH = {
  2514: { time: ["T3"], weather: ["W2", "W3"], season: [DEFAULT_SEASON],
    note: "도시 원경, 먹구름 아래 밝은 초록 숲, 지평선 연무. 대낮." },
  2515: { time: ["T3"], weather: ["W2", "W1"], season: [DEFAULT_SEASON],
    note: "극적인 먹구름 + 햇살 받는 초록 들판. 대낮." },
  2516: { time: ["T4", "T1", "T2"], weather: ["W1"], season: [DEFAULT_SEASON],
    note: "자작나무 숲 사이 낮은 태양 역광, 호수. 일출/일몰 구별 불가." },
  2517: { time: ["T3", "T2"], weather: ["W1"], season: [DEFAULT_SEASON],
    note: "진한 파란 하늘 + 흰 구름, 호수 반영. 밝은 낮." },
  2518: { time: ["T1", "T2"], weather: ["W3"], season: [DEFAULT_SEASON],
    note: "안개 깔린 계곡, 왼쪽에 낮은 태양. 전형적 일출." },
  2519: { time: ["T4"], weather: ["W1"], season: [DEFAULT_SEASON],
    note: "밀밭 지평선 노을, 위쪽은 파란 하늘. 확실한 일몰." },
  2520: { time: ["T4", "T1", "T2"], weather: ["W1"], season: [DEFAULT_SEASON],
    note: "나무 사이 태양 별빛, 노란 집과 잔디. 낮은 태양 역광." },
  2521: { time: ["T3"], weather: ["W1"], season: [DEFAULT_SEASON],
    note: "고산 야생화 초원 + 파란 하늘 뭉게구름. 그림자 짧음, 한낮." },
  2522: { time: ["T4", "T2"], weather: ["W1"], season: [["summer"]],
    note: "강가 백사장에서 사람들 물놀이. 계절은 summer 단독이어야 함." },
  2523: { time: ["T3"], weather: ["W3", "W2"], season: [DEFAULT_SEASON],
    note: "안개 낀 호수 + 짙은 초록 숲, 산에 구름. 확산광이라 시간 판별 어려움." },
  2524: { time: ["T3"], weather: ["W2"], season: [DEFAULT_SEASON],
    note: "먹구름 아래 바위산 + 초록 들판, 양 한 마리. 흐린 낮." },
  2525: { time: ["T1", "T2", "T3"], weather: ["W3"], season: [DEFAULT_SEASON],
    note: "옅은 청회색 호수 + 안개 낀 산, 오리. 저채도 연무." },
  2526: { time: ["T4"], weather: ["W1"], season: [DEFAULT_SEASON],
    note: "밀밭 노을 (2519와 동일 장소). 확실한 일몰." },
  2527: { time: ["T1", "T2"], weather: ["W1"], season: [DEFAULT_SEASON],
    note: "침엽수림 + 산, 하늘에 달. 부드러운 빛, 이른 아침." },
  2528: { time: ["T4"], weather: ["W1"], season: [DEFAULT_SEASON],
    note: "강렬한 주황 노을 + 나무 실루엣. 확실한 일몰." },
  2529: { time: ["T5", "T4"], weather: ["W2"], season: [DEFAULT_SEASON],
    note: "장노출 구름 + 어두운 호수, 지평선에 옅은 붉은 기. 박명." },
  2530: { time: ["T4", "T1", "T2"], weather: ["W1"],
    season: [DEFAULT_SEASON, ["winter"], ["spring"]],
    note: "파란 하늘 + 새털구름, 앙상한 나무 실루엣 사이 태양. 겨울/초봄 힌트." },
  2531: { time: ["T3"], weather: ["W1"], season: [DEFAULT_SEASON],
    note: "호수 위 높은 태양의 강한 반짝임. 맑은 한낮." },
  2532: { time: ["T3"], weather: ["W1"], season: [DEFAULT_SEASON],
    note: "설산 + 초록 계곡 + 야생화, 파란 하늘 뭉게구름. 한낮." },
  2533: { time: ["T4", "T5"], weather: ["W1"], season: [DEFAULT_SEASON],
    note: "짙은 파랑 하늘 + 분홍 노을 + 산 실루엣. 일몰 직후 박명." },
};

// 참고용 — 기존 봇이 붙였던 태그 (개선폭 비교)
const OLD_BOT = {
  2514: "evening / heavy-rain", 2515: "evening / heavy-rain",
  2516: "midnight / light-rain", 2517: "pre-dawn / light-rain",
  2518: "midnight / clear", 2519: "evening / light-rain",
  2520: "pre-dawn / heavy-rain", 2521: "morning / rain",
  2522: "morning / light-rain", 2523: "afternoon / cloudy",
  2524: "afternoon / cloudy", 2525: "early-morning / light-rain",
  2526: "evening / light-rain", 2527: "morning / rain",
  2528: "evening / light-rain", 2529: "midnight / light-rain",
  2530: "morning / partly-cloudy", 2531: "late-afternoon / light-rain",
  2532: "late-afternoon / clear", 2533: "late-afternoon / clear",
};

function sameSeason(got, allowedList) {
  const norm = (a) => [...a].sort().join(",");
  const g = norm(got);
  return allowedList.some((allowed) => norm(allowed) === g);
}

async function main() {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    console.error("Gemini API 키를 찾을 수 없습니다.");
    console.error(`아래 파일에 키만 한 줄 넣어두면 됩니다: ${KEY_FILE}`);
    console.error("  mkdir -p ~/.config/ezlong");
    console.error("  printf '%s' '여기에키' > ~/.config/ezlong/gemini-key");
    console.error("  chmod 600 ~/.config/ezlong/gemini-key");
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const images = manifest.images || [];
  const indices = Object.keys(TRUTH).map(Number).sort((a, b) => a - b);

  console.log(`모델: ${process.env.CLASSIFY_MODEL || MODEL}`);
  console.log(`판정 횟수: 장당 ${PASSES}회 (다수결) — 총 ${indices.length * PASSES}회 호출`);
  console.log(`검증셋: ${indices.length}장 (매니페스트 인덱스 ${indices[0]}~${indices[indices.length - 1]})`);
  console.log(`기존 봇 정확도 — 시간 45%(9/20), 날씨 20%(4/20)\n`);

  const rows = [];
  let timeOK = 0, weatherOK = 0, seasonOK = 0, overreach = 0, failed = 0;
  let encodedVia = null;

  for (const idx of indices) {
    const entry = images[idx];
    if (!entry) {
      console.log(`${idx}: 매니페스트에 없음 — 건너뜀`);
      continue;
    }
    const imagePath = path.join(TIME_DIR, entry.src);
    const truth = TRUTH[idx];

    const result = await classifyPhoto(imagePath, {
      apiKey,
      passes: PASSES,
      model: process.env.CLASSIFY_MODEL || undefined,
    });

    if (!result.ok) {
      failed += 1;
      console.log(`${idx}  분류 실패: ${result.error}`);
      rows.push({ idx, src: entry.src, ok: false, error: result.error });
      continue;
    }

    if (!encodedVia && result.encodedVia) {
      encodedVia = result.encodedVia;
      const label = { pillow: "python3+Pillow", sips: "macOS sips", raw: "원본 그대로(축소 없음)" };
      console.log(`이미지 인코딩 경로: ${label[encodedVia] || encodedVia}\n`);
    }

    const tGot = result.timeGroups;
    const wGot = result.weatherGroups;
    const tHit = tGot.some((g) => truth.time.includes(g));
    const wHit = wGot.some((g) => truth.weather.includes(g));
    const sHit = sameSeason(result.seasonTags, truth.season);
    // 허용 집합 밖의 그룹을 함께 붙였는가 (겸용이 지나친 경우)
    const tOver = tGot.filter((g) => !truth.time.includes(g));

    if (tHit) timeOK += 1;
    if (wHit) weatherOK += 1;
    if (sHit) seasonOK += 1;
    if (tOver.length > 0) overreach += 1;

    const mark = (b) => (b ? "O" : "X");
    console.log(
      `${idx}  시간 ${mark(tHit)} [${tGot.join("+") || "-"}] (정답 ${truth.time.join("|")})` +
      `  날씨 ${mark(wHit)} [${wGot.join("+") || "-"}] (정답 ${truth.weather.join("|")})` +
      `  계절 ${mark(sHit)} [${result.seasonTags.join("+")}]` +
      `  일치도 ${result.agreement}` +
      (tOver.length ? `  ※초과:${tOver.join("+")}` : "") +
      (result.needsReview ? `  ※검토필요: ${result.reviewReasons.join("; ")}` : "")
    );

    rows.push({
      idx, src: entry.src,
      ok: true,
      truth: { time: truth.time, weather: truth.weather, season: truth.season, note: truth.note },
      oldBotTag: OLD_BOT[idx] || null,
      got: {
        timeGroups: tGot, weatherGroups: wGot, seasonTags: result.seasonTags,
        timeBuckets: result.timeBuckets, weatherTags: result.weatherTags,
        timeConfidence: result.timeConfidence,
        agreement: result.agreement, needsReview: result.needsReview,
        reviewReasons: result.reviewReasons, votes: result.votes,
        unusable: result.unusable, unusableReason: result.unusableReason,
        observations: result.observations, seasonReason: result.seasonReason,
        perPass: result.perPass,
      },
      score: { timeHit: tHit, weatherHit: wHit, seasonHit: sHit, timeOverreach: tOver },
    });
  }

  const n = rows.filter((r) => r.ok).length;
  const pct = (x) => (n ? ((x / n) * 100).toFixed(0) : "0");

  console.log("\n" + "=".repeat(70));
  console.log(`판정 성공 ${n}장 / 호출 실패 ${failed}장`);
  console.log(`시간대 그룹 정확도 : ${timeOK}/${n} (${pct(timeOK)}%)   ← 기존 봇 45%`);
  console.log(`날씨   그룹 정확도 : ${weatherOK}/${n} (${pct(weatherOK)}%)   ← 기존 봇 20%`);
  console.log(`계절        정확도 : ${seasonOK}/${n} (${pct(seasonOK)}%)`);
  console.log(`시간 겸용 초과(허용집합 밖 그룹 동반) : ${overreach}/${n}`);
  const review = rows.filter((r) => r.ok && r.got.needsReview);
  console.log(`검토 필요로 올라온 사진 : ${review.length}/${n}${review.length ? " → " + review.map((r) => r.idx).join(", ") : ""}`);
  console.log("=".repeat(70));

  // 직전 실행 결과를 -prev.json으로 남겨 두 번의 실행을 비교할 수 있게 한다
  // (프롬프트를 고친 뒤 정확도가 실제로 올랐는지 확인하려면 이전 값이 필요하다).
  if (fs.existsSync(OUT)) {
    fs.copyFileSync(OUT, OUT.replace(/\.json$/, "-prev.json"));
  }

  fs.writeFileSync(OUT, JSON.stringify({
    ranAtKST: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).replace(" ", "T") + "+09:00",
    model: MODEL,
    encodedVia,
    summary: {
      total: n, failed,
      timeAccuracy: timeOK, weatherAccuracy: weatherOK, seasonAccuracy: seasonOK,
      timeOverreach: overreach,
      baselineBot: { timeAccuracy: 9, weatherAccuracy: 4, total: 20 },
    },
    rows,
  }, null, 2) + "\n");
  console.log(`\n상세 결과 저장: ${OUT}`);
  console.log("이 파일을 Claude에게 보여주면 오답 패턴을 분석해 프롬프트를 고칠 수 있습니다.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
