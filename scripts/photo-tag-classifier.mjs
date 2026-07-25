/**
 * scripts/photo-tag-classifier.mjs
 *
 * 배경사진 자동 태그 분류기 (Gemini 비전 기반) — 2026-07-25 신설
 *
 * ── 왜 만들었나 ────────────────────────────────────────────────────────────
 * 기존 collect-time-background-photos.js는 사진을 "보지 않고" 태그를 붙였다:
 *   timeBuckets: [plan.bucket]  → 우리가 채우려던 시간대(검색 의도)를 그대로 라벨링
 *   weatherTags: [weatherTag]   → Open-Meteo로 조회한 "수집 시점 서울 날씨"
 * 그 결과 서울에 비가 오는 동안 수집된 사진은 내용과 무관하게 전부 rain이 됐다.
 *
 * 2026-07-25 실측(봇이 수집한 20장 전수 육안 대조):
 *   - 시간대 그룹 정확도 45% (9/20)
 *   - 날씨 그룹 정확도 20% (4/20)
 *   - 비 계열로 태그된 12장 중 실제로 비 오는 사진 0장
 *
 * ── 왜 픽셀 휴리스틱이 아니라 비전 모델인가 ─────────────────────────────────
 * 같은 20장으로 픽셀 지표 12종(하늘 밝기·채도, 색상 히스토그램, 수직 색온도
 * 그래디언트, 태양 위치, 원경/근경 선명도 차, 대비)을 계산해 분리력을 측정했고,
 * 아래와 같이 그룹 분리에 실패함이 확인됐다:
 *   - 하늘 밝기: 야간 사진(장노출) 138 > 골든아워 123, 87   ← 밝기로 밤낮 구별 불가
 *   - 하늘 채도: 노을 사진 3 < 한낮 108                      ← 완전 역전
 *   - 노을 색온도 그래디언트: 골든아워 -25.3 < 한낮 +60.8    ← 부호까지 역전
 * 원인은 구조적이다. 사진은 카메라가 노출·화이트밸런스를 보정한 결과물이라
 * 실제 광량을 담지 않는다. 게다가 비 vs 흐림, 물놀이 vs 그냥 물가는 애초에
 * 픽셀 문제가 아니라 의미 문제다(빗줄기는 거의 안 찍히고, 사람은 젖은 노면·
 * 우산·수면 파문 같은 맥락으로 비를 인식한다).
 *
 * ── 설계 원칙 3가지 ────────────────────────────────────────────────────────
 * 1. 세부 버킷(12지)을 맞히려 하지 않고 "그룹"만 판정한다.
 *    유저 확정: 그룹 내 구별은 무가치하고 그룹 간 오류만 치명적이다.
 *    판정 대상을 5그룹으로 좁히면 정확도가 훨씬 안정적이다.
 *    그룹→세부버킷 확장은 코드가 배열로 처리한다(TIME_GROUPS/WEATHER_GROUPS).
 * 2. 애매하면 겸용 태깅(유저 확정 2026-07-25).
 *    특히 일출/일몰은 사진만으로 원리적 구별이 불가능한 경우가 많다.
 *    기존 데이터에도 dawn+sunset 겸용이 146장 있다.
 * 3. 판정 근거(observations)를 먼저 쓰게 하고 결론을 뒤에 받는다.
 *    thinkingBudget:0(CLAUDE.md Gemini 규칙)이라 모델이 별도 사고를 못 하므로,
 *    출력 자체에 관찰 서술을 강제해 같은 역할을 시킨다. 이 필드를 제거하면
 *    정확도가 떨어진다 — 비용 아끼려고 지우지 말 것.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

// ── 그룹 → 세부 버킷 확장표 ─────────────────────────────────────────────────
// 유저 확정(2026-07-25): 그룹 내부 구별은 중요하지 않다.
// 중요한 건 T3(한낮) / T4(오후·노을) / T5(밤) 세 그룹의 구별이다.
export const TIME_GROUPS = {
  T1: ["dawn", "early-morning"],                    // 새벽·일출
  T2: ["morning"],                                  // 아침
  T3: ["late-morning", "midday", "afternoon"],      // 한낮
  T4: ["late-afternoon", "sunset", "evening"],      // 오후·노을
  T5: ["night", "midnight", "pre-dawn"],            // 밤
};

// W4(비)는 rainIntensity에 따라 갈라지므로 여기선 기본값만 둔다.
export const WEATHER_GROUPS = {
  W1: ["clear", "partly-cloudy"],                   // 화창 (구름 좀 있어도 화창)
  W2: ["cloudy"],                                   // 흐림만
  W3: ["mist"],                                     // 안개만
  W4: ["light-rain", "rain"],                       // 비 (강도 차 크면 아래에서 분리)
  W5: ["heavy-rain", "thunderstorm"],               // 폭우·뇌우
  W6: ["snow"],                                     // 눈
};

// 계절 기본값 — 유저 확정: 대부분은 봄·여름·가을 공용으로 돌려 쓴다.
// 해변/물놀이/바캉스처럼 "여름이어야만 하는" 사진만 summer 단독.
export const DEFAULT_SEASONS = ["spring", "summer", "autumn"];

const VALID_TIME_BUCKETS = new Set(Object.values(TIME_GROUPS).flat());
const VALID_WEATHER_TAGS = new Set(Object.values(WEATHER_GROUPS).flat());
const VALID_SEASONS = new Set(["spring", "summer", "autumn", "winter"]);

// CLAUDE.md Gemini 규칙 준수: flash-lite, thinkingBudget 0, maxOutputTokens 8192,
// 폴백 모델 없음(v1beta에서 1.5 계열 전부 404), 재시도 4회 백오프.
const MODEL = "gemini-2.5-flash-lite";
const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const MAX_RETRIES = 4;

const PROMPT = `너는 풍경 사진 한 장을 보고 "촬영 시간대 / 날씨 / 계절"을 판정하는 분류기다.
반드시 사진 자체에 보이는 것만 근거로 삼아라. 파일명, 촬영지, 외부 정보는 주어지지 않으며 추측하지 마라.

# 1단계 — 먼저 관찰을 서술하라 (observations 필드)
결론을 내기 전에 아래 항목을 실제로 보이는 대로 한국어로 적어라. 보이지 않으면 "없음"이라고 적어라.
- 하늘: 밝기, 색, 위에서 아래로 색이 어떻게 변하는지(그라데이션 방향)
- 태양: 화면에 보이는가? 보인다면 지평선 대비 높이(수평선 근처 / 중간 / 높음)
- 그림자: 있는가? 길이는 긴가 짧은가? 방향은?
- 빛의 색온도: 푸른빛 / 중성 / 황금빛 / 붉은빛
- 인공조명: 가로등, 건물 창문 불빛, 자동차 헤드라이트가 켜져 있는가?
- 별이나 달이 보이는가?
- 젖은 흔적: 젖은 노면, 우산, 빗방울, 수면에 떨어지는 파문, 빗줄기
- 원경이 뿌옇게 흐려져 있는가? 가까운 곳과 먼 곳의 선명도 차이는?
- 초목 상태: 연둣빛 신록 / 짙은 초록 / 단풍 / 낙엽 / 잎 없는 앙상한 가지
- 눈이나 얼음이 있는가?
- 사람: 있는가? 옷차림은? 물놀이·수영·해수욕을 하고 있는가?

# 2단계 — 흔한 오판을 피하라
- "사진이 어둡다"는 밤의 근거가 아니다. 역광, 먹구름, 짙은 숲 그늘도 어둡게 찍힌다.
  반대로 야경은 장노출로 밝게 찍힌다. 밤 판정의 가장 강한 단서는 "인공조명 점등"과
  "별·달"이지 전체 밝기가 아니다.
- "따뜻한 주황색 하늘"만으로 일몰이라 확정하지 마라. 일출도 똑같이 생겼다.
  구별할 단서(인공조명이 꺼지는 중인지, 안개가 깔렸는지 등)가 없으면 T1과 T4를 둘 다 답하라.
- 하늘이 하얗고 채도가 없다고 흐림이라 단정하지 마라. 강한 역광이나 연무일 수 있다.
- 회색 하늘 = 비가 아니다. 실제로 젖은 흔적이나 빗줄기가 보일 때만 비로 판정하라.
  물기 증거가 없으면 흐림(W2)이다. 이 구별이 이 분류기에서 가장 중요하다.

# 3단계 — 그룹을 고르라
시간대 그룹 (그룹 안의 세부 구분은 신경 쓰지 마라):
- T1 = 새벽·일출 (해 뜨는 전후, 낮은 태양, 밝아지는 중)
- T2 = 아침 (해가 떴고 아직 낮게, 빛이 부드럽고 그림자가 길다)
- T3 = 한낮 (태양이 높고 그림자가 짧다. 하늘이 밝은 파랑이거나 균일하게 흐리다)
- T4 = 오후·노을 (태양이 낮고 빛이 황금빛~붉은빛, 그림자가 길다, 노을)
- T5 = 밤 (어둡고 인공조명이 켜졌거나 별·달이 보인다)

날씨 그룹:
- W1 = 화창 (맑거나, 구름이 좀 있어도 파란 하늘과 햇빛이 지배적)
- W2 = 흐림 (구름이 하늘을 덮어 햇빛이 약하다. 비 흔적은 없다)
- W3 = 안개 (안개나 연무로 원경이 뿌옇다. W2와 겸용 가능)
- W4 = 비 (빗줄기, 젖은 표면, 우산, 수면 파문 등 물기 증거가 실제로 보인다)
- W5 = 폭우·뇌우 (거센 비, 번개, 폭풍우)
- W6 = 눈 (눈이 내리거나 쌓여 있다)

# 4단계 — 계절
기본값은 ["spring","summer","autumn"] 이다(대부분의 초록 풍경은 세 계절에 두루 쓴다).
아래에 해당할 때만 바꿔라:
- 해변, 해수욕, 물놀이, 수영장, 바캉스, 한여름 휴양지 → ["summer"]
- 단풍이 든 풍경 → ["autumn"]
- 벚꽃, 봄꽃이 만개한 풍경 → ["spring"]
- 눈, 얼음, 잎이 다 떨어진 앙상한 겨울나무 → ["winter"]

# 5단계 — 관찰을 결론으로 옮기는 규칙 (가장 중요)
관찰은 정확히 하고도 결론에서 틀리는 경우가 가장 많다. 아래를 기계적으로 적용하라.
"~일 수도 있다"며 주저하지 말고 규칙대로 답하라.

[태양 고도]
- 화면 속 태양의 픽셀 위치를 태양 고도의 근거로 쓰지 마라. 카메라가 위를 향하거나
  나무 사이로 태양이 보이면, 실제 고도가 낮아도 태양이 화면 위쪽에 찍힌다.
- 태양 고도는 오직 두 가지로 판정하라: (1) 그림자의 길이 (2) 빛의 색온도
- 그림자가 길다  → 태양이 낮다 → T1 또는 T4다. T3이 아니다.
- 빛이 황금빛·주황빛이다 → 태양이 낮다 → T1 또는 T4다. T3이 아니다.
- 그림자가 짧고 빛이 중성·푸른빛이다 → T3이다.
- 위 단서가 서로 충돌하면(예: 그림자는 긴데 색은 중성) 두 그룹을 모두 답하라.

[안개]
- 원경이 뿌옇게 흐려지거나, 먼 산이 희미해지거나, 가까운 곳과 먼 곳의 선명도 차이가
  뚜렷하면 weatherGroups에 W3을 반드시 포함하라.
- "맑은데 조금 흐릿한 정도"라는 판단은 하지 마라. 원경이 흐리면 그게 연무다.
- 하늘이 파랗고 맑아 보여도 원경이 뿌옇다면 W1과 W3을 함께 답하라.

[밤]
- 사진 전체가 어둡고 태양이 보이지 않으며 하늘이 짙은 남색~검정이면 T5를 포함하라.
- 지평선에만 옅은 빛이 남은 박명이면 T4와 T5를 함께 답하라(일출 쪽 정황이면 T1과 T5).
- 하늘에 달이 뚜렷하게 보이면 T3 단독으로 답하지 말고 T2를 함께 고려하라.
- 구름이 길게 흘러 번진 것처럼 찍혔거나 수면이 비단처럼 매끈하면 장노출 야간
  촬영이다. 이 경우 하늘이 제법 밝게 찍혀도 실제로는 밤이므로 T5를 포함하라.
  "밝으니까 낮"이라고 판단하면 안 되는 대표적인 경우다.

[계절]
- 사람이 물놀이·수영·해수욕을 하고 있거나 해변·수영장이 보이면 무조건 ["summer"]다.
  "다른 계절일 수도 있다"고 주저하지 마라. 이 규칙에 예외는 없다.
- 역광이나 노을 때문에 나무가 검은 실루엣으로만 보이면 잎의 유무를 판단하지 마라.
  실루엣에서는 잎이 무성해도 앙상해 보인다. 이 경우 계절은 기본값을 유지하라.
- 단풍·눈·벚꽃은 색이 분명하게 보일 때만 인정하라. 추측으로 계절을 좁히지 마라.

# 출력 형식
아래 JSON만 출력하라. 다른 텍스트를 붙이지 마라.
{
  "observations": "1단계 관찰 서술 (한국어, 3~6문장)",
  "timeGroups": ["T3"],
  "timeConfidence": "high",
  "weatherGroups": ["W1"],
  "rainIntensity": null,
  "seasonTags": ["spring","summer","autumn"],
  "seasonReason": "계절 판정 근거 한 문장",
  "unusable": false,
  "unusableReason": ""
}

규칙:
- timeGroups: 확신하면 1개. 일출/일몰처럼 구별이 불가능하면 2개를 넣어라(예: ["T1","T4"]).
  서로 인접하지 않은 그룹을 함께 넣지 마라(예: ["T3","T5"]는 금지).
- timeConfidence: "high" | "medium" | "low"
- weatherGroups: 보통 1개. 안개 낀 흐린 날처럼 겹치면 ["W2","W3"]처럼 2개 가능.
- rainIntensity: weatherGroups에 W4가 있을 때만 "light" | "moderate" | "both" 중 하나.
  이슬비 수준이면 "light", 확실한 비면 "moderate", 애매하면 "both". W4가 없으면 null.
- unusable: 풍경 배경화면으로 부적합할 때만 true (사람 얼굴 클로즈업, 실내 인물사진,
  문서·도표·로고, 심하게 흐리거나 손상된 사진 등). 이유를 unusableReason에 적어라.`;

/**
 * 이미지를 긴 변 768px로 축소하고 base64로 반환.
 * Gemini는 768px 이하를 타일 1장(≈258토큰)으로 처리하므로 비용이 최소가 된다.
 *
 * 2026-07-25: 처음엔 python3+Pillow만 썼는데(collect-time-background-photos.js의
 * photoColorMetrics와 같은 방식), 유저 맥에 Pillow가 없어 즉시 실패했다.
 * 축소는 "비용 최적화"일 뿐 기능의 필수 조건이 아니므로, 하드 의존성을 없애고
 * 3단계로 폴백한다. 어느 경로를 타든 판정 결과는 같다.
 *   1) python3 + Pillow  — GitHub Actions 러너(ubuntu)에 이미 설치돼 있음
 *   2) sips              — macOS 기본 내장. 별도 설치 불필요
 *   3) 원본 그대로 전송   — 어디서든 동작. 타일이 늘어 토큰만 몇 배 더 쓴다
 *
 * 새 폴백을 지우지 말 것 — 지우면 Pillow 없는 환경에서 분류기가 통째로 죽는다.
 */
const MIME_BY_EXT = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".webp": "image/webp",
};

// API 키를 둘 수 있는 파일 경로.
// GitHub Actions에서는 secrets가 환경변수로 들어오지만, 맥에서 수동 실행할 때는
// 매번 키를 명령줄에 붙여넣는 게 번거롭고 셸 히스토리에도 남는다(2026-07-25에
// 실제로 키가 채팅에 노출되는 사고가 있었다). 아래 파일에 키만 한 줄 넣어두면
// 환경변수 없이도 동작한다. 파일 권한은 600으로 둘 것.
const KEY_FILE = path.join(os.homedir(), ".config", "ezlong", "gemini-key");

/** 키 조회 순서: 명시 인자 → 환경변수 → 키 파일 */
export function resolveApiKey(explicit) {
  if (explicit) return explicit;
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const fromFile = fs.readFileSync(KEY_FILE, "utf8").trim();
    if (fromFile) return fromFile;
  } catch {
    // 파일 없음 — 호출측이 안내 메시지를 낸다
  }
  return "";
}

function encodeImage(imagePath, maxEdge = 768) {
  // 1) python3 + Pillow
  try {
    const snippet = `
import base64, io, sys
from PIL import Image
im = Image.open(${JSON.stringify(imagePath)})
im = im.convert("RGB")
w, h = im.size
m = ${maxEdge}
if max(w, h) > m:
    if w >= h:
        im = im.resize((m, max(1, round(h * m / w))))
    else:
        im = im.resize((max(1, round(w * m / h)), m))
buf = io.BytesIO()
im.save(buf, format="JPEG", quality=85)
sys.stdout.write(base64.b64encode(buf.getvalue()).decode("ascii"))
`;
    const data = execFileSync("python3", ["-c", snippet], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (data && data.length > 0) return { data, mimeType: "image/jpeg", via: "pillow" };
  } catch {
    // Pillow 없음 → 다음 경로
  }

  // 2) sips (macOS 기본 내장)
  try {
    const tmp = path.join(
      os.tmpdir(),
      `ezlong-classify-${process.pid}-${Date.now()}.jpg`
    );
    execFileSync(
      "sips",
      ["-Z", String(maxEdge), "--setProperty", "format", "jpeg", imagePath, "--out", tmp],
      { stdio: "ignore" }
    );
    const data = fs.readFileSync(tmp).toString("base64");
    fs.unlinkSync(tmp);
    if (data && data.length > 0) return { data, mimeType: "image/jpeg", via: "sips" };
  } catch {
    // sips 없음(비 macOS) 또는 실패 → 다음 경로
  }

  // 3) 원본 그대로
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = MIME_BY_EXT[ext] || "image/jpeg";
  return { data: fs.readFileSync(imagePath).toString("base64"), mimeType, via: "raw" };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJson(text) {
  if (!text) return null;
  // responseMimeType을 json으로 줘도 방어적으로 한 번 더 파싱한다.
  const direct = text.trim();
  try {
    return JSON.parse(direct);
  } catch {
    // 코드펜스나 앞뒤 잡텍스트가 붙은 경우
  }
  const start = direct.indexOf("{");
  const end = direct.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(direct.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function callGemini({ apiKey, base64Image, mimeType, model, temperature }) {
  const body = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: base64Image } },
          { text: PROMPT },
        ],
      },
    ],
    generationConfig: {
      // CLAUDE.md Gemini 규칙: thinking 토큰($3.50/1M) 차단.
      // 대신 프롬프트가 observations 서술을 강제해 같은 역할을 하게 했다.
      thinkingConfig: { thinkingBudget: 0 },
      maxOutputTokens: 8192,
      // 다회 판정(self-consistency) 시에는 호출측이 0.4~0.5를 넘겨준다.
      // 0에 가까우면 매번 같은 답이 나와 다수결이 무의미해진다.
      temperature: temperature != null ? temperature : 0.1,
      responseMimeType: "application/json",
    },
  };

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(`${ENDPOINT(model)}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status} ${detail.slice(0, 300)}`);
      }
      const data = await response.json();
      // thinkingBudget:0이 무시될 경우를 대비해 parts를 전부 순회한다(CLAUDE.md 방어 규칙).
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const text = parts.map((p) => p.text || "").join("").trim();
      const parsed = extractJson(text);
      if (!parsed) throw new Error(`JSON 파싱 실패: ${text.slice(0, 300)}`);
      return parsed;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) await sleep(1000 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

/**
 * 모델 응답(그룹 코드) → 실제 매니페스트 태그 배열로 확장.
 * 알 수 없는 값은 조용히 버리고, 전부 버려지면 안전한 기본값으로 폴백한다.
 */
export function expandGroups(result) {
  const timeGroups = Array.isArray(result.timeGroups) ? result.timeGroups : [];
  const weatherGroups = Array.isArray(result.weatherGroups) ? result.weatherGroups : [];

  const timeBuckets = [];
  for (const g of timeGroups) {
    for (const b of TIME_GROUPS[g] || []) {
      if (VALID_TIME_BUCKETS.has(b) && !timeBuckets.includes(b)) timeBuckets.push(b);
    }
  }

  const weatherTags = [];
  for (const g of weatherGroups) {
    if (g === "W4") {
      // 유저 확정: light-rain과 rain은 차이가 크면 구별하고, 아니면 둘 다 붙인다.
      const intensity = result.rainIntensity;
      const picked =
        intensity === "light" ? ["light-rain"]
        : intensity === "moderate" ? ["rain"]
        : ["light-rain", "rain"];
      for (const t of picked) if (!weatherTags.includes(t)) weatherTags.push(t);
      continue;
    }
    for (const t of WEATHER_GROUPS[g] || []) {
      if (VALID_WEATHER_TAGS.has(t) && !weatherTags.includes(t)) weatherTags.push(t);
    }
  }

  let seasonTags = (Array.isArray(result.seasonTags) ? result.seasonTags : [])
    .filter((s) => VALID_SEASONS.has(s));
  if (seasonTags.length === 0) seasonTags = [...DEFAULT_SEASONS];

  return { timeBuckets, weatherTags, seasonTags };
}

// 시간 그룹의 인접 관계 (하루는 원형이므로 T5-T1이 이어진다).
// 인접 그룹끼리의 불일치는 "경계 사진"이라 겸용 태깅으로 흡수하고,
// 비인접 불일치(예: T3 vs T5)는 모델이 헷갈린 것이므로 사람 검토 대상으로 올린다.
const TIME_ORDER = ["T1", "T2", "T3", "T4", "T5"];
function timeAdjacent(a, b) {
  const i = TIME_ORDER.indexOf(a);
  const j = TIME_ORDER.indexOf(b);
  if (i < 0 || j < 0) return false;
  const d = Math.abs(i - j);
  return d === 1 || d === TIME_ORDER.length - 1;
}

/**
 * 겸용 태깅으로 흡수해도 되는 조합인가.
 * 인접 그룹은 당연히 허용하고, T1(새벽·일출)과 T4(오후·노을)는 하루 순서상
 * 멀지만 사진만으로는 원리적 구별이 불가능한 쌍이라 예외로 허용한다
 * (유저 확정 정책 — 기존 데이터에도 dawn+sunset 겸용이 146장 있다).
 * 이 예외를 빼면 일출/일몰 사진마다 "검토 필요"가 뜨는 오탐이 생긴다.
 */
function timeCompatible(a, b) {
  if (timeAdjacent(a, b)) return true;
  return (a === "T1" && b === "T4") || (a === "T4" && b === "T1");
}

/** 사진 한 장을 1회 판정한다(내부용). */
async function classifyOnce(imagePath, { apiKey, model, encoded, temperature }) {
  let raw;
  try {
    raw = await callGemini({
      apiKey,
      base64Image: encoded.data,
      mimeType: encoded.mimeType,
      model,
      temperature,
    });
  } catch (error) {
    return { ok: false, error: `Gemini 호출 실패: ${error.message}` };
  }

  const expanded = expandGroups(raw);

  // 확장 결과가 비면(모델이 알 수 없는 그룹 코드를 냈다는 뜻) 실패로 처리한다.
  // 빈 배열을 그대로 매니페스트에 넣으면 그 사진은 어느 시간대에도 안 뜨는
  // 유령 사진이 되므로, 차라리 폴백을 타게 하는 편이 안전하다.
  if (expanded.timeBuckets.length === 0 || expanded.weatherTags.length === 0) {
    return {
      ok: false,
      error: `그룹 확장 실패 (time=${JSON.stringify(raw.timeGroups)}, weather=${JSON.stringify(raw.weatherGroups)})`,
      raw,
    };
  }

  return {
    ok: true,
    timeGroups: (raw.timeGroups || []).filter((g) => TIME_GROUPS[g]),
    weatherGroups: (raw.weatherGroups || []).filter((g) => WEATHER_GROUPS[g]),
    seasonTags: expanded.seasonTags,
    rainIntensity: raw.rainIntensity || null,
    timeConfidence: raw.timeConfidence || "unknown",
    unusable: raw.unusable === true,
    unusableReason: raw.unusableReason || "",
    observations: raw.observations || "",
    seasonReason: raw.seasonReason || "",
    raw,
  };
}

/** 여러 판정 결과를 그룹별 득표로 집계한다. */
function tally(passResults, key) {
  const votes = new Map();
  for (const p of passResults) {
    for (const g of new Set(p[key] || [])) {
      votes.set(g, (votes.get(g) || 0) + 1);
    }
  }
  return votes;
}

/**
 * 사진 한 장을 분류한다.
 *
 * 정확도 우선 설계(2026-07-25 유저 확정 — "속도보다 정확도"):
 * 같은 사진을 여러 번(기본 3회) 독립 판정하고 다수결로 합친다(self-consistency).
 * 단발 판정은 한 번의 착각이 그대로 최종 태그가 되지만, 3회 중 2회 이상
 * 합의된 것만 채택하면 우발적 오판이 걸러진다.
 *
 * 중요 — temperature: 다회 판정을 할 때는 temperature를 올려야 한다.
 * temperature가 0에 가까우면 같은 입력에 같은 출력이 나와서 3번을 돌려도
 * 사실상 1번과 같고 다수결이 무의미해진다. 그래서 passes>1이면 기본 0.45를 쓴다.
 * 이 값을 0에 가깝게 되돌리면 다회 판정의 의미가 사라지므로 주의할 것.
 *
 * 집계 규칙:
 *   - 과반 득표 그룹을 채택한다. 과반이 없으면 최다 득표를 채택한다.
 *   - 채택되지 못했지만 1표 이상 받았고 채택 그룹과 "인접"한 시간 그룹은
 *     함께 붙인다(겸용 태깅 정책 — 경계 사진을 넓게 커버).
 *   - 비인접 불일치가 있으면 needsReview=true로 올린다(사람이 봐야 할 사진).
 *
 * @returns {Promise<object>} ok:false면 호출측이 폴백해야 한다.
 */
export async function classifyPhoto(imagePath, options = {}) {
  const apiKey = resolveApiKey(options.apiKey);
  const model = options.model || MODEL;
  const passes = Math.max(1, options.passes || 1);
  const temperature =
    options.temperature != null ? options.temperature : passes > 1 ? 0.45 : 0.1;

  if (!apiKey) {
    return {
      ok: false,
      error: `API 키 없음 (환경변수 GEMINI_API_KEY 또는 ${KEY_FILE} 파일 필요)`,
    };
  }
  if (!fs.existsSync(imagePath)) return { ok: false, error: `파일 없음: ${imagePath}` };

  let encoded;
  try {
    encoded = encodeImage(imagePath, options.maxEdge || 768);
  } catch (error) {
    return { ok: false, error: `이미지 인코딩 실패: ${error.message}` };
  }

  const results = [];
  const errors = [];
  for (let i = 0; i < passes; i += 1) {
    const r = await classifyOnce(imagePath, { apiKey, model, encoded, temperature });
    if (r.ok) results.push(r);
    else errors.push(r.error);
  }
  if (results.length === 0) {
    return { ok: false, error: `전 판정 실패: ${errors.join(" | ")}`, encodedVia: encoded.via };
  }

  const n = results.length;
  const majority = Math.floor(n / 2) + 1;

  // ── 시간 그룹 집계 ────────────────────────────────────────────────────────
  const timeVotes = tally(results, "timeGroups");
  let timeGroups = [...timeVotes.entries()]
    .filter(([, v]) => v >= majority)
    .map(([g]) => g);
  if (timeGroups.length === 0) {
    const top = Math.max(...timeVotes.values());
    timeGroups = [...timeVotes.entries()].filter(([, v]) => v === top).map(([g]) => g);
  }
  // 소수 의견이지만 인접한 그룹은 겸용으로 흡수한다. 단 최소 2표를 요구한다.
  //
  // 2026-07-25 2차 검증에서 확인된 문제: 1표짜리까지 흡수했더니 20장 중 6장에서
  // 태그가 번졌다(역광 골든아워 사진에 T3 한낮이 1표로 붙는 식). 정답 그룹은
  // 항상 포함되니 정확도 수치는 100%였지만, 실제 앱에서는 그 사진이 엉뚱한
  // 시간대에도 노출된다. 겸용 정책의 취지는 "원리적으로 구별 불가능한 경우"를
  // 넓게 커버하는 것이지 "모델이 한 번 헷갈린 것"까지 받는 게 아니다.
  // 1표는 후자이므로 버린다. 이 기준을 1로 되돌리면 태그 번짐이 재발한다.
  const MIN_MINORITY_VOTES = 2;
  let needsReview = false;
  const reviewReasons = [];
  for (const [g, v] of timeVotes.entries()) {
    if (timeGroups.includes(g)) continue;
    if (!timeCompatible(timeGroups[0], g) && !timeGroups.some((c) => timeCompatible(c, g))) {
      needsReview = true;
      reviewReasons.push(`시간 비인접 불일치: ${timeGroups.join("+")} vs ${g}(${v}/${n}표)`);
      continue;
    }
    if (v >= MIN_MINORITY_VOTES) timeGroups.push(g);
  }

  // 표가 3개 이상 그룹으로 갈렸다면 모델이 확신하지 못한 사진이다.
  // 과반 그룹이 나왔더라도(예: 2표/3회) 사람이 한 번 보는 게 맞다.
  if (timeVotes.size >= 3) {
    needsReview = true;
    reviewReasons.push(
      `시간 판정 분산: ${[...timeVotes.entries()].map(([g, v]) => `${g}(${v})`).join(", ")}`
    );
  }

  // ── 날씨 그룹 집계 ────────────────────────────────────────────────────────
  const weatherVotes = tally(results, "weatherGroups");
  let weatherGroups = [...weatherVotes.entries()]
    .filter(([, v]) => v >= majority)
    .map(([g]) => g);
  if (weatherGroups.length === 0) {
    const top = Math.max(...weatherVotes.values());
    weatherGroups = [...weatherVotes.entries()].filter(([, v]) => v === top).map(([g]) => g);
    needsReview = true;
    reviewReasons.push(`날씨 과반 합의 실패: ${[...weatherVotes.entries()].map(([g, v]) => `${g}(${v})`).join(", ")}`);
  }

  // ── 계절 집계 (조합 전체를 하나의 후보로 본다) ────────────────────────────
  const seasonVotes = new Map();
  for (const p of results) {
    const key = [...p.seasonTags].sort().join(",");
    seasonVotes.set(key, (seasonVotes.get(key) || 0) + 1);
  }
  const seasonTop = Math.max(...seasonVotes.values());
  const seasonKey = [...seasonVotes.entries()].find(([, v]) => v === seasonTop)[0];
  const seasonTags = seasonKey.split(",");
  if (seasonTop < majority) {
    needsReview = true;
    reviewReasons.push(`계절 과반 합의 실패: ${[...seasonVotes.keys()].join(" / ")}`);
  }

  // ── 비 강도는 과반 판정에 W4가 있을 때만 의미가 있다 ──────────────────────
  const rainVotes = results.map((r) => r.rainIntensity).filter(Boolean);
  const rainIntensity = rainVotes.length
    ? rainVotes.sort(
        (a, b) =>
          rainVotes.filter((x) => x === b).length - rainVotes.filter((x) => x === a).length
      )[0]
    : null;

  const expanded = expandGroups({ timeGroups, weatherGroups, seasonTags, rainIntensity });
  if (expanded.timeBuckets.length === 0 || expanded.weatherTags.length === 0) {
    return { ok: false, error: "집계 후 그룹 확장 실패", encodedVia: encoded.via };
  }

  // 판정이 흔들리지 않은 정도 — 1.0이면 전 판정이 완전 일치.
  const agreement =
    timeGroups.reduce((acc, g) => acc + (timeVotes.get(g) || 0), 0) / (n * timeGroups.length);

  // 한 번이라도 "배경화면 부적합" 판정이 나오면 사람이 보는 게 안전하다.
  const unusableVotes = results.filter((r) => r.unusable).length;
  if (unusableVotes > 0) {
    needsReview = true;
    reviewReasons.push(
      `부적합 의견 ${unusableVotes}/${n}: ${results.find((r) => r.unusable)?.unusableReason || ""}`
    );
  }

  return {
    ok: true,
    ...expanded,
    timeGroups,
    weatherGroups,
    rainIntensity,
    passes: n,
    agreement: Math.round(agreement * 100) / 100,
    needsReview,
    reviewReasons,
    unusable: unusableVotes >= majority,
    unusableReason: results.find((r) => r.unusable)?.unusableReason || "",
    timeConfidence: results[0].timeConfidence,
    observations: results[0].observations,
    seasonReason: results[0].seasonReason,
    votes: {
      time: Object.fromEntries(timeVotes),
      weather: Object.fromEntries(weatherVotes),
      season: Object.fromEntries(seasonVotes),
    },
    perPass: results.map((r) => ({
      timeGroups: r.timeGroups,
      weatherGroups: r.weatherGroups,
      seasonTags: r.seasonTags,
      timeConfidence: r.timeConfidence,
      observations: r.observations,
    })),
    encodedVia: encoded.via,
    failedPasses: errors,
  };
}

export { MODEL, PROMPT, encodeImage, timeAdjacent, timeCompatible, KEY_FILE };
