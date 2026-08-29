// ─────────────────────────────────────────────────────────────────────
// 2026-07-28 글로벌화(i18n) 부트스트랩
// ─────────────────────────────────────────────────────────────────────
// index.html 이 app.js 보다 먼저 i18n/*.js 를 로드한다(전역 5개).
// 여기서는 로케일을 확정만 하고 **아무 동작도 바꾸지 않는다** — 배선은
// 이후 단계에서 한 곳씩, 매번 npm run verify:i18n 을 통과시키며 진행한다.
//
// ★ 절대 규칙 (scripts/golden/rule-code-map.json 의 GLOBAL-locale-default) ★
// 로케일 판정에 실패하거나 i18n 스크립트가 아예 로드되지 않았어도
// 앱은 **지금까지와 똑같이** 동작해야 한다. 그래서 전역이 없을 때 쓰는
// 무해한 스텁을 둔다 — i18n 때문에 앱이 죽는 일은 없어야 한다.
const FZ_I18N = (typeof window !== "undefined" && window.FlipZenI18n) || {
  init: () => "ko",
  getLocale: () => "ko",
  isKorean: () => true,
  t: (key) => key,
  has: () => false,
};
const FZ_SEASON = (typeof window !== "undefined" && window.FlipZenSeason) || null;
const FZ_REGION = (typeof window !== "undefined" && window.FlipZenRegion) || null;
const FZ_CODES = (typeof window !== "undefined" && window.FlipZenWeatherCodes) || null;
const FZ_QUOTE_SRC = (typeof window !== "undefined" && window.FlipZenQuoteSource) || null;
const FZ_BOOK_TITLES = (typeof window !== "undefined" && window.FlipZenBookTitles) || null;

/**
 * 날씨 상태 코드 계층 접근자 (2026-07-28 글로벌화 W2)
 *
 * ─────────────────────────────────────────────────────────────
 * 왜 필요한가
 * ─────────────────────────────────────────────────────────────
 * 이 앱은 지금까지 날씨를 **한국어 문자열로 판정**해 왔다:
 *     if (ko === "안개") return "mist";
 *     conditionsKo === "비" ? "흐림" : conditionsKo
 * 영어 모드에서 백엔드는 "Fog"/"Rain" 을 주므로 이 비교가 전부 false 가
 * 되어, 에러 하나 없이 아이콘이 조용히 전부 맑음으로 떨어진다.
 * 그래서 판정은 언어와 무관한 코드(CLEAR/RAIN/…)로 하고,
 * 사람이 읽는 문자열은 그 코드에서 만들어낸다.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 표를 여기에 다시 적지 않는다 ★
 * ─────────────────────────────────────────────────────────────
 * 이모지 표를 app.js 에도 복사해두고 싶은 유혹이 있지만, 오늘 이미
 * 그 대가를 치렀다 — i18n/weather-codes.js 초안이 app.js 와 세 군데
 * (구름 많음·알 수 없음·밤 경계) 달랐는데 자체 테스트는 전부 통과했다.
 * 표가 두 벌이면 반드시 갈라지고, 갈라진 걸 알아채는 건 유저다.
 * 그래서 표는 한 곳(i18n/weather-codes.js)에만 두고 여기서는 부른다.
 *
 * 로드 실패 시엔 아이콘이 중립값(🌤️)으로 떨어지되 앱은 죽지 않는다.
 * 그 상황 자체를 막는 건 scripts/test-wiring.mjs(3곳 md5 대조 + 로드
 * 순서 검사)와 scripts/sync-web.mjs 의 몫이다.
 */
const WX = FZ_CODES || {
  CONDITION: { UNKNOWN: "UNKNOWN" },
  conditionCodeOf: () => "UNKNOWN",
  conditionEmoji: () => "🌤️",
  applyRainDowngrade: (code) => code,
  isRainLikeCondition: () => false,
  isNightHour: () => false,
  hourOf: () => null,
};
if (!FZ_CODES && typeof console !== "undefined" && console.error) {
  // 조용히 넘어가면 "아이콘이 왜 다 이렇지"로만 보인다 — 원인을 남긴다.
  console.error(
    "[FlipZen] i18n/weather-codes.js 가 로드되지 않았습니다. " +
    "날씨 아이콘이 기본값으로 표시됩니다. index.html 의 script 순서와 " +
    "i18n/ 폴더 배포 여부를 확인하십시오."
  );
}

/** 응답 객체(현재/시간별/주간 공용)에서 언어 무관 상태 코드를 얻는다. */
function conditionCodeOf(src) {
  return WX.conditionCodeOf(src);
}

/**
 * 온도 단위 — "C" 또는 "F". (2026-07-28 글로벌화 W6)
 *
 * ─────────────────────────────────────────────────────────────
 * 왜 필요한가
 * ─────────────────────────────────────────────────────────────
 * 백엔드는 항상 섭씨를 내려준다. 미국은 일상에서 화씨를 쓰므로,
 * 섭씨 그대로 보여주면 미국 사용자에게는 숫자가 아무 의미가 없다 —
 * "28°"를 보고 덥다고 느끼지 못한다. 출시 직후 낮은 평점으로 돌아오는
 * 종류의 문제라, 화면에 나가기 전 마지막 지점에서 한 번 변환한다.
 *
 * ★ 한국어는 무조건 섭씨다 ★
 * temperatureUnit("ko", ...) 은 지역과 무관하게 항상 "C" 를 돌려준다
 * (i18n/season.js). 미국에 사는 한국어 사용자도 섭씨를 본다 — 언어를
 * 한국어로 두었다는 것 자체가 한국식 감각을 원한다는 신호이기 때문이다.
 *
 * 좌표를 모르면 섭씨다(세계 대부분이 섭씨). 미국 안이라는 게 확인될
 * 때만 화씨로 바꾼다 — 확신이 없을 때 다수 쪽으로 떨어지는 편이 안전하다.
 */
function temperatureUnit() {
  if (!FZ_SEASON || !FZ_SEASON.temperatureUnit) return "C";

  // ★ 1순위: 기기가 스스로 밝힌 지역 ("en-CA" → CA) ★
  // 좌표만 쓰다가 토론토가 미국 사각형에 들어가는 걸 발견했다 — 온타리오
  // 남부는 미시간과 뉴욕 사이로 내려와 있어 사각형으로 못 가른다.
  // 기기 로케일은 사용자가 직접 설정한 값이라 추측이 아니다.
  // navigator 를 **명시적으로 넘긴다** — deviceRegion() 이 전역을 직접 보게
  // 두면 브라우저에서는 되지만 테스트 샌드박스에서는 조용히 null 이 되어,
  // "테스트는 통과하는데 실제로는 안 도는" 상태를 못 잡는다.
  const nav = typeof navigator !== "undefined" ? navigator : null;
  let region = FZ_REGION && FZ_REGION.deviceRegion ? FZ_REGION.deviceRegion(nav) : null;

  // 2순위: 좌표. 로케일에 지역이 없는 경우("en" 처럼)의 폴백.
  if (!region && FZ_REGION && FZ_REGION.regionFromCoordinate) {
    const lat = userCoords && typeof userCoords.lat === "number" ? userCoords.lat : null;
    const lng = userCoords && typeof userCoords.lng === "number" ? userCoords.lng : null;
    region = FZ_REGION.regionFromCoordinate(lat, lng);
  }
  return FZ_SEASON.temperatureUnit(FZ_LOCALE, region);
}

/**
 * 섭씨 숫자 → 화면에 쓸 온도 문자열.
 *
 * ★ 온도가 화면에 나가는 곳은 전부 이 함수를 거친다 ★
 * 예전엔 `${Math.round(t)}°` 가 아홉 군데에 흩어져 있었다. 그 상태로
 * 화씨를 넣으면 반드시 한두 곳을 빠뜨리고, 빠뜨린 자리는 "28°"와 "82°"가
 * 한 화면에 같이 보이는 형태로 드러난다 — 그때는 이미 유저가 먼저 본다.
 * 새로 온도를 표시할 곳이 생기면 반드시 이 함수를 쓸 것.
 *
 * ★ 한국어에서는 예전 표현과 글자 단위로 같다 ★
 * ko → 단위 "C" → celsiusTo 가 값을 그대로 돌려줌 → `${Math.round(t)}°`.
 * scripts/test-temperature.mjs 가 -60~60도 전 구간에서 이를 확인한다.
 */
function formatTemp(celsius) {
  if (typeof celsius !== "number" || !isFinite(celsius)) return "--°";
  const unit = temperatureUnit();
  const value = FZ_SEASON && FZ_SEASON.celsiusTo
    ? FZ_SEASON.celsiusTo(unit, celsius)
    : celsius;
  return `${Math.round(value)}°`;
}

/** 상태 코드 → 사람이 읽는 라벨. 한국어에서는 기존 conditionsKo 와 같은 값이다. */
function conditionLabel(code, fallbackKo) {
  return t("weather.conditions." + code, null, fallbackKo !== undefined ? fallbackKo : "");
}

/**
 * 강수 등급 → 사람이 읽는 라벨.
 *
 * 2026-07-29 시뮬레이터 실측으로 잡은 결함. 예전 코드는 백엔드가 내려주는
 * rainIntensity.label 을 그대로 화면에 썼고, 그 옆 주석은 "백엔드가 로케일에
 * 맞춰 내려준다"고 적혀 있었다 — **사실이 아니었다.**
 * /api/weather/current 는 detail 만 로컬라이즈하고 rainIntensity 는
 * classifyRainIntensity() 결과(한국어 고정)를 그대로 통과시킨다.
 * 그래서 영어 기기 메인 화면에 "약한 비 75°" 처럼 한국어가 섞여 나왔다.
 * 단위 테스트는 이 경로를 못 잡았다 — 백엔드 응답을 화면까지 끌고 가는
 * 경로라서, 시뮬레이터에서 눈으로 봐야만 드러났다.
 *
 * grade 는 언어중립 코드("NONE"/"DRIZZLE"/"RAIN"/"HEAVY"/"VERY_HEAVY")로
 * 이미 내려오고 있으므로, 라벨은 프론트 카탈로그에서 뽑는다 — 백엔드
 * 재배포 없이 6개 언어가 한 번에 해결된다.
 *
 * ★ 한국어는 예전과 글자 단위로 같다 ★ — 카탈로그의 ko 값이 백엔드
 * 문자열과 동일하고, 등급이 없으면 백엔드 라벨을 그대로 돌려준다.
 */
function rainGradeLabel(rainIntensity) {
  const backendLabel = (rainIntensity && rainIntensity.label) || "";
  // ★ 한국어는 백엔드 문자열을 그대로 통과시킨다 ★
  // 카탈로그 ko 값이 백엔드와 같은 문자열이라 어느 쪽을 써도 같지만,
  // 통과 방식이면 "예전과 같다"가 카탈로그 내용과 무관하게 성립한다 —
  // 나중에 누가 카탈로그 ko 값을 손대도 한국어 화면은 흔들리지 않는다.
  if (isKoreanLocale()) return backendLabel;
  const grade = rainIntensity && rainIntensity.grade;
  if (!grade) return backendLabel;
  return t("weather.rainGrades." + grade, null, backendLabel);
}

/**
 * "이 문구가 강수를 말하고 있는가"를 판정할 때 쓰는, 현재 로케일의
 * 강수 계열 라벨 집합. 날씨상세 히어로(summaryIndicatesPrecip)가 쓴다.
 * 한국어 경로는 이 함수를 타기 전에 기존 정규식에서 이미 걸러지므로,
 * 여기 값이 한국어 화면 결과를 바꾸는 일은 없다.
 */
function precipSummaryLabels() {
  return [
    t("weather.rainGrades.DRIZZLE", null, "약한 비"),
    t("weather.rainGrades.RAIN", null, "비"),
    t("weather.rainGrades.HEAVY", null, "강한 비"),
    t("weather.rainGrades.VERY_HEAVY", null, "매우 강한 비"),
    conditionLabel(WX.CONDITION.SNOW, "눈"),
    conditionLabel(WX.CONDITION.RAIN, "비"),
    t("weather.thunderShower", null, "뇌우"),
  ];
}

// 네이티브 래퍼(iOS/Android)가 OS 언어를 주입해두면 그 값이 우선한다.
// 주입 전이면 navigator.language 로 판정하고, 그것도 실패하면 한국어다.
const FZ_LOCALE = FZ_I18N.init ? FZ_I18N.init({}) : "ko";

/** 이 화면이 한국어인가 — 로케일 분기가 필요한 모든 곳의 단일 판정처 */
function isKoreanLocale() {
  return FZ_LOCALE === "ko";
}

// ─────────────────────────────────────────────────────────────
// ezlong.com 진입 URL — 로케일별 (2026-07-28 신설)
// ─────────────────────────────────────────────────────────────
// ezlong.com 은 한국어 원본 외에 /en /ja /es /pt /zh 다섯 벌의 번역
// 페이지를 이미 라이브로 갖고 있다(허브 + 도구 소개 + 블로그, 언어당
// 19~21개). 그런데 이 앱의 웹뷰는 오랫동안 루트("https://ezlong.com")를
// 하드코딩으로 물고 있어서, 영어 화면을 쓰는 사람도 한국어 사이트를 봤다.
//
// ★ 지원 언어가 앱(ko/en)보다 사이트(ko/en/ja/es/pt/zh)가 더 넓다 ★
//   그래서 여기서는 FZ_LOCALE(앱이 실제로 그리는 언어)이 아니라 **기기
//   언어**를 다시 본다. 일본어 아이폰은 앱 UI는 영어로 뜨더라도(일본어
//   카탈로그가 아직 없으니) ezlong 사이트만큼은 일본어로 보여주는 것이
//   분명한 이득이다. 앱 카탈로그에 ja 가 생기는 날 이 코드는 그대로 두고
//   i18n/index.js 의 SUPPORTED 만 늘리면 된다.
//
// 매핑에 없는 언어(독일어·프랑스어 등)는 전부 /en/ 로 보낸다 — 운영자
// 확정(2026-07-28): "이 외의 비한국 앱스토어는 영어 페이지로."
const EZLONG_SITE_LOCALES = ["en", "ja", "es", "pt", "zh"];

// ── 웹뷰 식별 신호 (2026-07-28 추가) ───────────────────────────
// ezlong.com 의 번역 페이지들은 "Tool UI is in Korean — Chrome/Edge/Safari
// auto-translate automatically" 라고 안내하고 한국어 원본으로 링크한다.
// 그런데 **WKWebView·Android WebView 에는 브라우저 자동번역 UI 자체가 없다** —
// 주소창·번역 팝업 같은 브라우저 크롬 없이 렌더링 엔진만 빌려 쓰는 컴포넌트라
// 그렇다. 그래서 앱 안에서 그 버튼을 누르면 약속과 달리 한국어 도구가 그냥 뜬다.
//
// ezlong 쪽에서 이 경우에만 CTA 를 translate.goog(서버측 번역, 웹뷰에서도
// 정상 동작) 로 바꾸려면 "지금 앱 웹뷰 안이다"를 알아야 하는데, 앱이 신호를
// 주지 않으면 일반 모바일 브라우저 방문자와 구분할 방법이 없다. 그 신호다.
//
// ★ 외부 브라우저로 여는 경우엔 붙이지 않는다 ★ — 사파리·크롬에서는 진짜
//   자동번역이 동작하므로, 굳이 번역 프록시로 우회시키면 오히려 품질이 떨어진다.
//
// 한계: 이 쿼리는 **첫 로드에만** 붙는다. 사용자가 iframe 안에서 허브(/ja/)→
// 도구(/ja/xxx.html)로 이동하면 파라미터가 사라진다. 그래서 ezlong 쪽은 첫
// 진입 때 이 값을 sessionStorage 에 넣어두고 이후 페이지에서 그걸 읽어야 한다
// (앱 웹뷰는 ezlong.com/time/ 을 로드하고 iframe 도 ezlong.com 이라 동일
//  오리진 — 서드파티 파티셔닝 걱정 없이 sessionStorage 가 그대로 유지된다).
// 더 튼튼한 방법은 네이티브에서 User-Agent 에 접미사를 붙이는 것인데, 그건
// 새 빌드가 필요해 다음 네이티브 빌드로 미뤘다.
const EZLONG_EMBED_PARAM = "embed=app";

function ezlongSiteUrl(opts) {
  const embed = !!(opts && opts.embed);
  const withEmbed = (url) => {
    if (!embed) return url;
    return url + (url.indexOf("?") >= 0 ? "&" : "?") + EZLONG_EMBED_PARAM;
  };

  // 앱이 한국어로 그려지는 중이면 한국어 원본. (한국 사용자 보호가 우선)
  // 한국어는 번역이 필요 없지만 embed 신호는 그대로 붙인다 — ezlong 쪽이
  // "앱에서 열렸다"를 알면 번역 외의 용도(분석 등)로도 쓸 수 있다.
  if (isKoreanLocale()) return withEmbed("https://ezlong.com");

  // 기기 언어를 다시 읽어 사이트 쪽 번역본이 있는지 본다.
  let tag = "";
  try {
    tag = (typeof window !== "undefined" && window.__FLIPZEN_OS_LOCALE__) ||
          (navigator.languages && navigator.languages.length ? navigator.languages[0] : navigator.language) || "";
  } catch (error) {
    tag = "";
  }
  const base = String(tag).toLowerCase().split(/[-_]/)[0];
  if (base === "ko") return withEmbed("https://ezlong.com");   // 방어 — 여기 올 일은 없다
  if (EZLONG_SITE_LOCALES.indexOf(base) >= 0) return withEmbed("https://ezlong.com/" + base + "/");
  return withEmbed("https://ezlong.com/en/");
}

/** 번역 조회. i18n 로드 실패 시 fallback(현행 한국어 문자열)을 그대로 쓴다. */
function t(key, params, fallback) {
  if (!FZ_I18N.has || !FZ_I18N.has(key)) return fallback !== undefined ? fallback : key;
  return FZ_I18N.t(key, params);
}

/**
 * index.html 의 data-i18n / data-i18n-aria / data-i18n-title 속성을 읽어
 * 현재 로케일 문자열로 덮어쓴다.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 한국어에서는 아무것도 바뀌지 않는다 ★
 * ─────────────────────────────────────────────────────────────
 * HTML 에는 한국어 원문이 그대로 남아 있고(scripts/apply-i18n-attrs.mjs 가
 * 텍스트를 지우지 않는다), 카탈로그의 ko 값은 그 원문을 실측해 만든 것이라
 * 같은 값을 같은 자리에 덮는다. 즉 한국어 사용자에게 이 함수는 무동작이다.
 *
 * 이 구조를 택한 이유:
 *   1. i18n 스크립트가 로드 실패해도 화면에 한국어가 이미 있다(빈 화면 방지)
 *   2. 첫 페인트가 즉시 한국어 — 번역을 기다리는 깜빡임이 없다
 *   3. audit-strings.mjs 가 계속 HTML 실측 대조를 할 수 있다
 *
 * 속성이 가리키는 키가 카탈로그에 없으면 **건드리지 않는다** — t() 가
 * fallback 으로 현재 화면 텍스트를 그대로 돌려주기 때문에,
 * 잘못된 키가 달려 있어도 최악의 결과는 "번역이 안 됨"이지 "빈칸"이 아니다.
 */
function applyStaticTranslations(root) {
  const scope = root || (typeof document !== "undefined" ? document : null);
  if (!scope || !scope.querySelectorAll) return 0;

  let applied = 0;
  const put = (sel, attr, setter) => {
    scope.querySelectorAll(sel).forEach((el) => {
      const key = el.getAttribute(attr);
      if (!key) return;
      const current = setter.get(el);
      const next = t(key, null, current);
      if (next !== current) { setter.set(el, next); applied++; }
    });
  };

  put("[data-i18n]", "data-i18n", {
    get: (el) => el.textContent,
    set: (el, v) => { el.textContent = v; },
  });
  put("[data-i18n-aria]", "data-i18n-aria", {
    get: (el) => el.getAttribute("aria-label"),
    set: (el, v) => el.setAttribute("aria-label", v),
  });
  put("[data-i18n-title]", "data-i18n-title", {
    get: (el) => el.getAttribute("title"),
    set: (el, v) => el.setAttribute("title", v),
  });
  put("[data-i18n-placeholder]", "data-i18n-placeholder", {
    get: (el) => el.getAttribute("placeholder"),
    set: (el, v) => el.setAttribute("placeholder", v),
  });

  // 2026-08-25 SEO — <meta name="description"> 같은 content 속성 번역.
  // <title> 은 textContent 라 위의 [data-i18n] 갈래가 이미 처리한다.
  put("[data-i18n-content]", "data-i18n-content", {
    get: (el) => el.getAttribute("content"),
    set: (el, v) => el.setAttribute("content", v),
  });

  // 문서 언어 표시 — 스크린리더 발음과 CSS :lang() 선택자에 쓰인다
  try {
    if (scope.documentElement) scope.documentElement.setAttribute("lang", FZ_LOCALE);
  } catch (e) { /* 무시 */ }

  return applied;
}

// 부팅 시 1회 적용. DOM 이 이미 준비됐으면 즉시, 아니면 준비 후.
// ★ try 로 감싼다 ★ 번역 적용이 실패해도 앱 나머지는 살아야 한다.
(function bootstrapStaticTranslations() {
  const run = () => { try { applyStaticTranslations(); } catch (e) { /* 무시 */ } };
  if (typeof document === "undefined") return;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
  else run();
})();

/* ─────────────────────────────────────────────────────────────
 * 문장 번역 (i18n/quote-translations.js)
 * ─────────────────────────────────────────────────────────────
 * 한국어에서는 이 경로가 통째로 죽어 있다 — load("ko") 는 네트워크도
 * 안 타고, lookup 은 항상 null 이다. 한국어 화면의 동작에 이 기능이
 * 끼어들 여지를 아예 없애기 위한 것이다.
 */
const FZ_QUOTE_I18N =
  (typeof window !== "undefined" && window.FlipZenQuoteTranslations) || null;

function lookupQuoteTranslation(english) {
  try {
    if (!FZ_QUOTE_I18N || !english) return null;
    return FZ_QUOTE_I18N.lookup(english);
  } catch (e) {
    return null;
  }
}

// 번역 파일은 비동기로 온다. 도착하기 전에 이미 문장이 그려졌을 수 있으므로,
// 도착하면 지금 떠 있는 문장을 조용히 다시 그린다(페이드 없이 즉시).
// 실패하면 아무 일도 일어나지 않는다 — 영어 원문이 그대로 남는다.
(function bootstrapQuoteTranslations() {
  if (!FZ_QUOTE_I18N || typeof FZ_QUOTE_I18N.load !== "function") return;
  try {
    const locale =
      (typeof window !== "undefined" && window.FlipZenI18n &&
       window.FlipZenI18n.getLocale && window.FlipZenI18n.getLocale()) || "ko";
    FZ_QUOTE_I18N.load(locale).then((ready) => {
      if (!ready) return;
      if (typeof lastRenderedQuote !== "undefined" && lastRenderedQuote) {
        try { renderQuote(lastRenderedQuote, true); } catch (e) { /* 무시 */ }
      }
    });
  } catch (e) { /* 무시 */ }
})();

const scenes = {
  morning: {
    location: "Seoul",
    temp: "21°",
    summary: "상쾌함",
    icon: "sun-icon"
  },
  midday: {
    location: "Seoul",
    temp: "28°",
    summary: "맑음",
    icon: "sun-icon"
  },
  "golden-hour": {
    location: "Seoul",
    temp: "26°",
    summary: "맑음",
    icon: "sun-icon"
  },
  night: {
    location: "Seoul",
    temp: "22°",
    summary: "별빛 맑음",
    icon: "moon-icon"
  }
};

// 2026-07-09 버그 수정: 각 장면(scene)의 로컬 폴백 사진 목록 끝에 다른
// 장면의 사진이 몇 장씩 섞여 들어가 있었다(예: night 목록 끝에
// golden-hour/morning 사진, golden-hour 목록 끝에 night/morning/midday
// 사진). 실제 아카이브에 야간·새벽 사진이 워낙 적어서(수집 자동화가
// 05~23시에만 도는 구조라 그 시간대 사진이 거의 안 쌓임) night 장면은
// 이 로컬 폴백 목록을 쓰는 비중이 매우 높은데, 그 목록 자체에 golden-hour
// 사진이 섞여 있어 "밤인데 노을/낮 사진이 나온다"는 증상으로 이어졌다.
// 각 장면 목록을 그 장면 고유 사진만 남도록 정리한다.
const scenePhotos = {
  morning: [
    "assets/bg-morning.jpg",
    "assets/backgrounds/morning/01.jpg",
    "assets/backgrounds/morning/03.jpg",
    "assets/backgrounds/morning/04.jpg",
    "assets/backgrounds/morning/05.jpg",
    "assets/backgrounds/morning/07.jpg",
    "assets/backgrounds/morning/08.jpg",
    "assets/backgrounds/morning/09.jpg",
    "assets/backgrounds/morning/10.jpg",
    "assets/backgrounds/morning/11.jpg",
    "assets/backgrounds/morning/12.jpg"
  ],
  midday: [
    "assets/bg-midday.jpg",
    "assets/backgrounds/midday/01.jpg",
    "assets/backgrounds/midday/02.jpg",
    "assets/backgrounds/midday/03.jpg",
    "assets/backgrounds/midday/04.jpg",
    "assets/backgrounds/midday/05.jpg",
    "assets/backgrounds/midday/06.jpg",
    "assets/backgrounds/midday/07.jpg",
    "assets/backgrounds/midday/08.jpg",
    "assets/backgrounds/midday/11.jpg"
  ],
  "golden-hour": [
    "assets/bg-golden-hour.jpg",
    "assets/backgrounds/golden-hour/02.jpg",
    "assets/backgrounds/golden-hour/03.jpg",
    "assets/backgrounds/golden-hour/04.jpg",
    "assets/backgrounds/golden-hour/08.jpg",
    "assets/backgrounds/golden-hour/09.jpg",
    "assets/backgrounds/golden-hour/10.jpg"
  ],
  night: [
    "assets/bg-night.jpg",
    "assets/backgrounds/night/02.jpg",
    "assets/backgrounds/night/03.jpg",
    "assets/backgrounds/night/05.jpg",
    "assets/backgrounds/night/06.jpg",
    "assets/backgrounds/night/07.jpg",
    "assets/backgrounds/night/08.jpg",
    "assets/backgrounds/night/10.jpg",
    "assets/backgrounds/night/12.jpg"
  ]
};

let backgroundArchive = [];

const baseQuotes = window.investmentQuotes || [
  {
    text: "시장은 매일 흔들리지만, 장기투자자의 기준까지 매일 흔들릴 필요는 없습니다. 오늘의 가격보다 오래 살아남을 계획을 먼저 확인하세요.",
    title: "장기투자자의 하루",
    author: "ezlong.com",
    category: "mindset"
  },
  {
    text: "복리는 조급한 사람에게는 느려 보이고, 계속하는 사람에게는 어느 날 갑자기 커 보입니다. 중요한 것은 속도가 아니라 중간에 멈추지 않는 구조입니다.",
    title: "복리의 시간",
    author: "ezlong.com",
    category: "compound"
  },
  {
    text: "변동성은 장기투자가 내는 입장료에 가깝습니다. 하락을 예외로 두지 않고 계획 안에 넣어두면, 흔들림은 공포가 아니라 점검 신호가 됩니다.",
    title: "변동성 사용법",
    author: "ezlong.com",
    category: "volatility"
  },
  {
    text: "인내는 아무것도 하지 않는 태도가 아닙니다. 해야 할 일을 정해두고, 하지 말아야 할 일을 오늘도 참아내는 적극적인 실행입니다.",
    title: "기다림의 기술",
    author: "ezlong.com",
    category: "patience"
  },
  {
    text: "투자 성과의 많은 부분은 무엇을 더 아느냐보다, 불안할 때 무엇을 하지 않느냐에서 갈립니다. 감정은 신호로 듣고, 결정은 규칙으로 하세요.",
    title: "행동경제학 메모",
    author: "ezlong.com",
    category: "behavior"
  },
  {
    text: "은퇴 준비는 먼 미래의 숙제가 아니라 오늘의 선택을 편하게 만드는 기준입니다. 필요한 숫자를 알면 불필요한 비교와 불안이 줄어듭니다.",
    title: "은퇴 계산의 마음",
    author: "ezlong.com",
    category: "retirement"
  },
  {
    text: "뉴스가 커질수록 매매 버튼은 멀리 두는 편이 좋습니다. 좋은 투자자는 정보를 많이 보는 사람보다 행동을 잘 제한하는 사람에 가깝습니다.",
    title: "소음 줄이기",
    author: "ezlong.com",
    category: "behavior"
  },
  {
    text: "오늘의 적립은 작아 보여도 시간은 작은 돈을 크게 대합니다. 무리한 금액보다 계속 가능한 금액이 장기투자에서는 더 강합니다.",
    title: "자동 적립 노트",
    author: "ezlong.com",
    category: "compound"
  },
  {
    text: "하락장은 내 자산만 시험하지 않습니다. 내가 세운 기준이 실제로 버틸 수 있는 기준인지 확인하게 해주는 날이기도 합니다.",
    title: "하락장 일기",
    author: "ezlong.com",
    category: "volatility"
  },
  {
    text: "남의 속도가 빨라 보이는 날일수록 내 계획의 생존성을 보세요. 오래 가는 투자는 비교를 줄이는 데서부터 단단해집니다.",
    title: "비교하지 않는 투자",
    author: "ezlong.com",
    category: "mindset"
  }
];

const categoryLabels = {
  mindset: "투자 멘탈",
  compound: "복리/시간",
  volatility: "변동성",
  patience: "인내",
  behavior: "행동경제학",
  retirement: "은퇴 준비"
};

function getQuoteGenre(quote) {
  return quote.genre === "literature" ? "literature" : "investment";
}

const quotes = baseQuotes.map((quote) => {
  const genre = getQuoteGenre(quote);
  return {
    ...quote,
    genre,
    // category는 투자서 문장에만 의미 있는 하위 분류다. 문학 문장까지 "mindset"
    // 같은 투자 카테고리로 강제 분류하면 카테고리 필터를 켰을 때 엉뚱하게
    // 섞여 나오므로, 문학 문장은 category를 건드리지 않는다.
    category: genre === "investment" ? getQuoteCategory(quote) : quote.category
  };
});

// 2026-07-22 유저 요청 — "문장의 분야" 설정을 투자서/문학·교양서 1depth +
// 각자의 하위 분야 2단 구조에서, 완전히 평평한 단일 목록으로 재편한다.
// 투자서는 더 이상 하위 분류(mindset/compound/volatility/patience/behavior/
// retirement)를 UI에 노출하지 않고 "투자" 하나로 통째로 묶는다(quote.category
// 데이터 자체는 안 건드림 — getQuoteFlatGenreKey가 investment면 그 값을
// 무시하고 항상 "investment" 키 하나로 합친다). 문학 쪽 8개는 investment-quotes.js에
// 이미 태깅된 quote.category 값(가족관계/경제자기계발/과학/문학/시/에세이/
// 인문역사/철학동양고전)을 그대로 재사용(데이터 변경 없음, 표시 라벨만 매핑),
// "철학·동양고전"이었던 표시 라벨만 유저 요청대로 "철학·고전"으로 축약.
// 2026-07-28 W9-2 — 키(왼쪽)는 investment-quotes.js 의 quote.category 값이라
// 절대 건드리면 안 되는 **데이터 식별자**다. 오른쪽 표시 라벨만 카탈로그를
// 태운다. 이 둘을 헷갈려 키까지 영어로 바꾸면 문장 필터가 통째로 죽는다.
const flatGenreCatalogKeys = {
  investment: "settings.quotes.topics.investment",
  "문학": "settings.quotes.topics.literature",
  "시": "settings.quotes.topics.poetry",
  "에세이": "settings.quotes.topics.essay",
  "가족관계": "settings.quotes.topics.family",
  "경제자기계발": "settings.quotes.topics.selfhelp",
  "과학": "settings.quotes.topics.science",
  "인문역사": "settings.quotes.topics.history",
  "철학동양고전": "settings.quotes.topics.philosophy"
};
// 한국어 폴백은 예전 값 그대로 — i18n 이 통째로 실패해도 화면이 안 바뀐다.
const flatGenreKoLabels = {
  investment: "투자",
  "문학": "문학",
  "시": "시",
  "에세이": "에세이",
  "가족관계": "가족·관계",
  "경제자기계발": "경제·자기계발",
  "과학": "과학",
  "인문역사": "인문·역사",
  "철학동양고전": "철학·고전"
};
function flatGenreLabel(key) {
  return t(flatGenreCatalogKeys[key], null, flatGenreKoLabels[key] || key);
}

function getQuoteFlatGenreKey(quote) {
  return quote.genre === "investment" ? "investment" : quote.category;
}

const app = document.querySelector(".clock-app");
const pageTrack = document.getElementById("pageTrack"); // 2026-07-17 8차: 페이지 1/2 전환용 transform 트랙
const dots = document.querySelectorAll("[data-scene-button]");
const skyRoom = document.querySelector(".sky-room");
const photoCredit = document.getElementById("photoCredit");
const quotePanel = document.querySelector(".quote-panel");
const quoteProgress = document.getElementById("quoteProgress");
// 2026-07-16: 알라딘 도서 링크 — window.aladinLinks(aladin-links.js)에 매칭된
// 책만 아이콘이 보인다. quoteAladinLink.dataset.url에 현재 문장 책의 알라딘
// 링크를 저장해뒀다가 클릭 시 모달을 연다.
const quoteAladinLink = document.getElementById("quoteAladinLink");
const aladinModalPanel = document.getElementById("aladinModalPanel");
const aladinModalFrame = document.getElementById("aladinModalFrame");
const aladinModalExternalOpenEl = document.getElementById("aladinModalExternalOpen");
const settingsPanel = document.getElementById("quoteSettings");
const settingsOpen = document.getElementById("settingsOpen");
const settingsSave = document.getElementById("settingsSave");
// 2026-07-23 신설 — "광고 없이 이용" 프리미엄 카드의 업그레이드 버튼.
const premiumUpgradeButton = document.getElementById("premiumUpgradeButton");
// 2026-07-21 유저 요청 — 날짜 탭 → 이번달 달력 아코디언.
const dateLabelEl = document.getElementById("dateLabel");
const calendarPanelEl = document.getElementById("calendarPanel");
const calendarMonthLabelEl = document.getElementById("calendarMonthLabel");
const calendarGridEl = document.getElementById("calendarGrid");
// 2026-07-21 8차 피드백 — 달력을 눌러야 열린다는 걸 모르는 사용자를 위한
// 온보딩 힌트(자동 시연 + 반짝임)에 쓰는 sparkle 오버레이.
const dateChipSparkleEl = document.getElementById("dateChipSparkle");
// 2026-07-22: 투자서/문학·교양서 1depth + 각자의 세부 카테고리(2단 구조)를
// 없애고 평평한 단일 그리드 하나로 재편 — allCategories/categoryOptions/
// allLitCategories/litCategoryOptions/genreOptions/genreMinWarning 6개
// 엘리먼트 참조를 아래 2개로 대체한다.
const allFlatGenresEl = document.getElementById("allFlatGenres");
const flatGenreOptionsEl = document.getElementById("flatGenreOptions");
const ezlongSection = document.querySelector(".ezlong-webview");
const appBrand = document.querySelector(".app-brand");
// 2026-07-20 유저 요청: 하단 우측 "ezlong.com" 링크 — appBrand와는 별개
// 진입점이지만 goToPage(1)만 곧장 호출해 회전 없이 "위로 슬라이드"만
// 되게 한다(아래 sceneEzlongLink 클릭 핸들러 참조).
const sceneEzlongLink = document.getElementById("sceneEzlongLink");
const musicSettingsOpen = document.getElementById("musicSettingsOpen");
const musicToggle = document.getElementById("musicToggle");
const musicSkip = document.getElementById("musicSkip");
const musicInfoPanel = document.getElementById("musicInfoPanel");
const musicVizWrap = document.getElementById("musicVizWrap");
// 2026-07-22 유저 요청 — 설정 페이지 안에서 바로 결과를 볼 수 있는 실시간
// 미리보기용 두 번째 비주얼라이저 wrap(같은 .music-viz-wrap/.viz-bar 클래스를
// 재사용해 색상/모양 CSS가 자동으로 동일하게 적용된다).
const musicVizPreviewWrap = document.getElementById("musicVizPreviewWrap");
const musicProgressBar = document.getElementById("musicProgressBar");
const musicProgressFill = document.getElementById("musicProgressFill");
const musicTrackTitle = document.getElementById("musicTrackTitle");
const musicLikeButton = document.getElementById("musicLikeButton");
const musicDislikeButton = document.getElementById("musicDislikeButton");
const musicShuffleButton = document.getElementById("musicShuffleButton");
const musicGearOpen = document.getElementById("musicGearOpen");
const musicVizOptionsEl = document.getElementById("musicVizOptions");
const musicToast = document.getElementById("musicToast");
const musicLeaveWorkEl = document.getElementById("musicLeaveWork");
const musicPlaylistOptionsEl = document.getElementById("musicPlaylistOptions");
const musicSpecialOptionsEl = document.getElementById("musicSpecialOptions");
const musicFilterNoticeEl = document.getElementById("musicFilterNotice");
const musicHistoryList = document.getElementById("musicHistoryList");
const musicHistoryBody = document.getElementById("musicHistoryBody");
const musicHistoryViewAll = document.getElementById("musicHistoryViewAll");
// 2026-07-25 재설계 — "Vocal 제외"/"연주곡 제외" 2개짜리 이분법에서 4개
// 플레이리스트(어쿠스틱/클래식/보컬/ROCK) 각각을 독립적으로 켜고 끄는
// 방식으로 전환했다. 배경: "클래식" 폴더 안에 보컬이 섞인 곡이 있어도
// 이분법 방식(카테고리명에 "vocal"이라는 단어가 있는지만 봄)으로는 걸러낼
// 방법이 없었다 — 상세 설계는 아래 MUSIC_EXCLUDABLE_CATEGORIES 주석 참조.
// element 참조는 이제 그 배열을 순회하며 id로 직접 찾으므로(아래
// syncMusicExcludeFilterUi/이벤트 리스너 등록부 참조), 여기서 개별 const로
// 미리 선언해두지 않는다.
// 2026-07-25 신설 — 설정 화면 "배경 사진" 섹션의 계절/날씨/시간대 매칭
// 기준 토글. bgFilterSeasonEl은 항상 checked+disabled라 change 리스너를
// 달지 않는다(값 읽기도 하지 않음 — matchingArchivePhotos에서 계절은
// 항상 매칭시킨다).
const bgFilterWeatherEl = document.getElementById("bgFilterWeather");
const bgFilterTimeEl = document.getElementById("bgFilterTimeOfDay");
const bgFilterStatusEl = document.getElementById("bgFilterStatus");
const bgAudio = document.getElementById("bgAudio");
const bgAudioB = document.getElementById("bgAudioB");

// 2026-07-14: 날씨 상세 화면 (flipgen_weather_detail_screen_handoff.md 연동)
const weatherChipOpen = document.getElementById("weatherChipOpen");
const weatherDetailPanel = document.getElementById("weatherDetailPanel");
const wdCurrentTemp = document.getElementById("wdCurrentTemp");
// 2026-07-20 8차 피드백(유저 요청): 체감기온 DOM 제거 — wdCurrentFeels const 삭제.
const wdCurrentHumidity = document.getElementById("wdCurrentHumidity");
const wdCurrentSub = document.getElementById("wdCurrentSub");
// 2026-07-20 유저 피드백: "가끔 상세페이지에서 날씨 정보가 안 나온다" —
// /api/weather/current 호출이 일시적으로 실패하면(콜드스타트·네트워크 순단
// 등) 상세 화면이 "날씨 데이터를 불러올 수 없어요" 문구만 보여주고 멈춰
//있었다. 사실 실패는 캐시되지 않아 패널을 껐다 켜면 자동 재시도되지만,
// 유저가 그걸 알 방법이 없었다 — 바로 그 자리에서 누를 수 있는 재시도
// 버튼을 추가한다. renderWeatherCurrent()의 실패 분기에서만 보이게 한다.
const wdCurrentRetryBtn = document.getElementById("wdCurrentRetryBtn");
// 2026-07-26 유저 피드백: 안드로이드에서 앱을 막 열었을 때 위치 조회가
// 실패하면(GPS/네트워크 위치 공급자가 아직 준비 안 된 콜드스타트 등) 메인
// 화면의 날씨 칩이 "위치 권한 필요"에 멈춘 채 보였다. 아래 renderWeather()가
// 이 버튼을 그 상태에서만 노출한다 — 위 wdCurrentRetryBtn과 같은 개념을
// 메인 화면 칩에도 적용한 것.
const mainWeatherRetryBtn = document.getElementById("mainWeatherRetryBtn");
// 2026-07-17 벤치마크 기획(묶음1·2·3·4): 상세 지표(바람/자외선/기압/가시거리/
// 이슬점), 일출·일몰, 시간대별 예보 스트립 DOM 참조 추가.
const wdCurrentSun = document.getElementById("wdCurrentSun");
// 2026-07-21 유저 요청: 최고/최저 기온 아래 바람 표시.
const wdCurrentWind = document.getElementById("wdCurrentWind");
// 2026-07-18 리디자인(클로드 디자인 목업 수용): 현재 날씨 카드 상단 이모지 아이콘.
const wdCurrentIcon = document.getElementById("wdCurrentIcon");
// 2026-07-19 5차 리디자인: 애플 날씨 스타일 상단 요약(날씨 상태 텍스트,
// 최고/최저) — renderWeatherCurrentToday()가 채운다.
const wdCurrentCondition = document.getElementById("wdCurrentCondition");
// 2026-07-20 유저 피드백: 강수확률/mm 보조정보를 조건 단어와 분리된 작은
// 폰트로 표기하기 위한 별도 span(wdCurrentHiLo와 같은 스타일).
const wdCurrentConditionRain = document.getElementById("wdCurrentConditionRain");
const wdCurrentHiLo = document.getElementById("wdCurrentHiLo");
// 2026-07-18 2차 피드백: "상세 지표" 카드 삭제 — wdDetailIndicators/
// wdDetailComment DOM 참조와 renderWeatherDetailIndicators() 함수를 함께
// 제거했다(유저 요청).
const wdHourlyStrip = document.getElementById("wdHourlyStrip");
const wdTopComment = document.getElementById("wdTopComment");
// 2026-07-17 2차 기획(묶음B): 다음 비 카운트다운.
const wdNextRain = document.getElementById("wdNextRain");
const wdCareComment = document.getElementById("wdCareComment");
const wdRainWindows = document.getElementById("wdRainWindows");
// 2026-07-17 2차 기획(묶음A): 주간 기온 예보.
const wdWeeklyForecast = document.getElementById("wdWeeklyForecast");
// 2026-07-17 2차 기획(묶음C): 미세먼지·초미세먼지.
const wdAirQuality = document.getElementById("wdAirQuality");
// 2026-07-17 2차 기획(묶음D): 일평균 대비 기온차(평년값).
const wdTempVsNormal = document.getElementById("wdTempVsNormal");
const wd24hComparison = document.getElementById("wd24hComparison");
const wdYesterday = document.getElementById("wdYesterday");
const wdTropicalBadges = document.getElementById("wdTropicalBadges");
const wdTropicalComment = document.getElementById("wdTropicalComment");
const weatherDetailTitle = document.getElementById("weatherDetailTitle");
// 2026-07-21 3차 기획: 기상특보(KMA) 배너 + 인라인 아코디언 상세.
// 2026-07-21 2차 피드백: 레이어팝업(weatherAdvisoryPanel)이 실제로는 열리지
// 않는 문제가 있어 별도 오버레이 패널 자체를 없앴다 — 배너 바로 아래
// #wdAdvisoryDetail을 펼치고 접는 방식으로 대체.
const wdAdvisoryBanner = document.getElementById("wdAdvisoryBanner");
const wdAdvisoryBannerText = document.getElementById("wdAdvisoryBannerText");
// 2026-07-22 유저 요청: "펼침 아이콘만 말고 특보 부분 전체가 눌리면 좋겠다".
// 예전엔 <button id="wdAdvisoryMoreBtn">가 유일한 탭 표적이었다 — 이제
// 탭 가능한 실제 컨트롤은 head 전체(#wdAdvisoryBannerHead, role="button")로
// 옮기고, wdAdvisoryMoreBtn은 ▾/▴만 표시하는 장식용 아이콘(<span>,
// aria-hidden)으로 남긴다.
const wdAdvisoryBannerHead = document.getElementById("wdAdvisoryBannerHead");
const wdAdvisoryMoreBtn = document.getElementById("wdAdvisoryMoreBtn");
const wdAdvisoryDetail = document.getElementById("wdAdvisoryDetail");
let wdLastAdvisoryData = null;

// 2026-07-22 유저 요청: "긴급 주의보가 있을 때 이지롱 베이스캠프의 간략한
// 날씨 정보 옆에 빨간 점 배지를 찍어달라 — 알림 배지처럼. 날씨 상세에
// 갔다 나오면 사라져야 한다." tmFc(발표시각) 단위로 "이미 본 특보"를
// localStorage에 기억해서, 같은 특보를 다시 볼 땐 안 뜨고 새 특보(tmFc가
// 바뀜)가 뜨면 다시 배지가 켜지게 한다.
const weatherAdvisoryDot = document.getElementById("weatherAdvisoryDot");
const WEATHER_ADVISORY_ACK_KEY = "flipzenWeatherAdvisoryAckTmFc_v1";

// 2026-07-22 임시 원격 진단 도구(PLAYBOOK 표준 패턴 — ?진단플래그=1로만
// 발동, 일반 방문자에겐 노출 안 됨). "펼침을 눌러도 아무것도 안 보인다"는
// 제보가 사파리 직접 접속에서도 재현됐고, 백엔드는 cache-bust로 직접
// 검증해 정상임을 이미 확인했다 — 남은 건 브라우저 안에서 데이터가 실제로
// 어디까지 도달하는지(fetch 성공 여부 / DOM에 실제로 쓰였는지 / 쓰였는데
// 안 보이는지)를 화면 위 텍스트 리포트 한 장으로 확정하는 것뿐이다.
// 확인 끝나면 반드시 제거한다 — 지우지 않고 남겨두지 말 것.
const WX_ADVISORY_DIAG = new URLSearchParams(location.search).get("wxdiag") === "1";
let wxDiagBannerEl = null;
function wxDiagReport(status, valueOrReason) {
  if (!WX_ADVISORY_DIAG) return;
  if (!wxDiagBannerEl) {
    wxDiagBannerEl = document.createElement("div");
    wxDiagBannerEl.id = "wxDiagBanner";
    wxDiagBannerEl.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:999999;background:#000;color:#0f0;" +
      "font-size:11px;line-height:1.5;padding:8px;white-space:pre-wrap;word-break:break-all;" +
      "max-height:50vh;overflow:auto;font-family:monospace;pointer-events:none;";
    document.body.appendChild(wxDiagBannerEl);
  }
  const detailEl = document.getElementById("wdAdvisoryDetail");
  const html = detailEl ? detailEl.innerHTML : null;
  const lines = [
    "[wxdiag v1] " + new Date().toISOString(),
    "advisoryR.status=" + status,
    "value=" + JSON.stringify(valueOrReason && valueOrReason.message ? String(valueOrReason.message) : valueOrReason).slice(0, 600),
    "wdAdvisoryDetail found=" + Boolean(detailEl),
    "wdAdvisoryDetail.hidden=" + (detailEl ? detailEl.hidden : "N/A"),
    "wdAdvisoryDetail.innerHTML.length=" + (html ? html.length : "N/A"),
    "wdAdvisoryDetail.innerHTML(앞 300자)=" + (html ? html.slice(0, 300) : "N/A")
  ];
  wxDiagBannerEl.textContent = lines.join("\n");
}

const digitElements = [
  document.getElementById("hourTens"),
  document.getElementById("hourOnes"),
  document.getElementById("minuteTens"),
  document.getElementById("minuteOnes")
];

// 2026-07-22 유저 요청 — "정각 세리모니"를 플립시계 숫자판 4개까지 확장.
// checkFlipClockHourlyCeremony(아래) 참조.
const flipClockEl = document.querySelector(".flip-clock");
const flipClockSparkleEl = document.getElementById("flipClockSparkle");

let activeScene = "";
let activeQuoteMinute = "";
let lastQuoteTitle = "";
// 2026-07-16: "가끔 알라딘 아이콘이 무반응이다, 강제 종료 후 재실행하면
// 된다"는 실기기 제보에 대응하기 위해 마지막으로 렌더링한 문장을 기억해
// 둔다 — 앱이 포그라운드로 돌아올 때 아이콘 상태를 이 값 기준으로 다시
// 맞춰준다(resyncAladinUiAfterForeground 참고).
let lastRenderedQuote = null;
let quoteDeck = [];
// 2026-07-20 유저 요청: 문장 4개 미리로드 창 — activePhotoSet/activePhotoIndex와
// 동일한 역할(아래 ensureQuoteWindow/selectQuoteIndex 참조).
let quoteWindow = [];
let activeQuoteIndex = 0;
// 2026-07-22: 위 3개 상태(투자 세부 카테고리/문학 세부 카테고리/1depth
// 장르)를 평평한 단일 선택 집합 하나로 대체했다 — flatGenreLabels 참조.
let selectedFlatGenres = new Set(["investment"]);
let lastScenePhoto = {};
let lastDigits = ["", "", "", ""];
let timeHasRendered = false;
let manualSceneUntil = 0;
let backgroundArchiveLoaded = false;
let weatherResolved = false;
let activePhotoSet = [];
let activePhotoSetKey = "";
// 2026-08-04 운영자 리듬 설계 — 4장을 한 바퀴(16분) 다 보여줄 때마다 1씩
// 올라가는 세대 카운터. photoSetKey에 포함되어 다음 4장 세트를 강제한다.
let photoCycleGen = 0;
let activePhotoIndex = 0;
let activePhotoSlot = "";
let manualPhotoUntil = 0;
let swipeStart = null;
// 2026-07-22: 스키마가 바뀌어(1depth+세부 2단 → 평평한 단일 목록) 옛 3개
// 키를 그대로 읽으면 값 형식이 안 맞을 수 있어 새 키를 쓴다 — 옛 키에
// 남아있던 값은 이제 아무도 읽지 않아 자동으로 무해해진다.
const flatGenreStorageKey = "ezlong:selectedFlatGenres";
// 2026-07-19: 히스토리 목록 기본 5개만 노출, "모두 보기" 클릭 시 전체 표시.
let musicHistoryExpanded = false;
// 2026-07-28 W9 — 초기 표시값도 로케일을 탄다. 카탈로그 키는 W8 때 이미
// 만들어져 있었는데 호출부가 한국어 리터럴 그대로였다(스캐너로 확인).
let weatherState = {
  location: t("weather.locating", null, "위치 확인 중"),
  temp: "--°",
  summary: t("weather.loadingWeather", null, "날씨 불러오는 중"),
  icon: "sun-icon",
  tag: "clear"
};

// 2026-07-14: 날씨 상세 화면 상태.
// WEATHER_API_BASE는 weather-backend/README.md의 배포 절차대로
// `npm run deploy` 실행 후 출력되는 실제 워커 URL로 반드시 교체해야 한다
// (배포 전까지는 상세 화면을 열어도 각 섹션이 "불러올 수 없어요"로 표시됨 —
// 정상이다, 백엔드가 아직 인터넷에 없다는 뜻이다).
const WEATHER_API_BASE = "https://flipgen-weather-backend.ezlong.workers.dev";

// 2026-07-20 유저 피드백("절대 한 번도 실패해서는 안 된다"): 타임아웃+자동
// 재시도(위 fetchWeatherJson 참조)로도 못 살리는 진짜 장애(백엔드 다운,
// Visual Crossing 쿼터 소진 등)가 오면, 예전엔 화면이 완전히 비어버렸다.
// 마지막으로 성공한 현재 날씨 응답을 기기에 저장해뒀다가, 새 요청이 계속
// 실패해도 "n분 전 정보"라고 명확히 표시하면서 그 데이터를 그대로 보여준다
// — 에러 화면 대신 살짝 오래된 진짜 숫자를 보여주는 쪽이 훨씬 유용하다.
const WD_LAST_GOOD_KEY = "flipzenWeatherLastGoodCurrent_v1";

function wdSaveLastGoodCurrent(currentData, hourlyNowItem) {
  try {
    localStorage.setItem(
      WD_LAST_GOOD_KEY,
      JSON.stringify({ currentData, hourlyNowItem, savedAt: Date.now() })
    );
  } catch (e) {
    // 프라이빗 모드 등 localStorage를 못 쓰는 환경 — 조용히 무시(안전망일
    // 뿐이라 실패해도 앱 동작엔 지장 없음).
  }
}

function wdLoadLastGoodCurrent() {
  try {
    const raw = localStorage.getItem(WD_LAST_GOOD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.currentData || !parsed.currentData.current) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

function wdMinutesAgoLabel(savedAt) {
  const mins = Math.max(0, Math.round((Date.now() - savedAt) / 60000));
  // 2026-07-28 W9 — 영어는 단/복수가 갈리므로(1 minute / 2 minutes) 카탈로그의
  // plural 규칙을 태운다. 한국어는 규칙상 other 하나뿐이라 결과가 예전과 같다.
  if (mins < 1) return t("time.justNow", null, "방금 전");
  if (mins < 60) return t("time.minutesAgo", { count: mins }, `${mins}분 전`);
  const hours = Math.round(mins / 60);
  if (hours < 24) return t("time.hoursAgo", { count: hours }, `${hours}시간 전`);
  const days = Math.round(hours / 24);
  return t("time.daysAgo", { count: days }, `${days}일 전`);
}
// 2026-07-18 5차 피드백: "지금 이슬비가 오는데 왜 구름이냐, 비 애니메이션
// 테스트를 하려면 강제로라도 비 오게 해놔라" — Visual Crossing의
// currentConditions(관측소 실측치)는 옅은 이슬비처럼 약한 강수를 정확히
// 못 잡을 때가 있어(관측 샘플링 특성), 이미 100%로 정확히 잡고 있는
// hourly-strip의 "지금" 예보값과 어긋날 수 있다(아래 weatherEmojiFromCurrent
// 주석 참조 — 근본 수정은 그쪽에서 함). 그것과 별개로, 실기기에서 실제
// 강수 여부와 무관하게 언제든 즉시 비 애니메이션을 켜서 확인하고 싶을 때를
// 위해 URL에 ?forceRain=1을 붙이면 강제로 "비 오는 중"으로 취급한다.
// 일반 방문자 URL엔 이 파라미터가 없으므로 평소엔 전혀 영향 없다.
const DEBUG_FORCE_RAIN = new URLSearchParams(location.search).get("forceRain") === "1";

// 2026-07-18 7차 피드백: "비 오는 날 말고 다른 날씨(맑음/흐림 등) 애니메이션도
// 전반적으로 확인할 테스트 방법을 강구해달라" — forceRain=1은 "비냐 아니냐"
// 하나만 강제할 수 있어서, 실제 그 순간 날씨가 우연히 맞아떨어져야만 특정
// 상태(예: 흐림, 옅은 안개, 폭설)를 볼 수 있었다. 이 맵은 current.current
// 필드 전체를 시나리오별로 통째로 흉내내서, 실제 날씨와 무관하게 원하는
// 상태를 URL 하나로 결정론적으로 재현한다 — weatherEmojiFromCurrent/
// weatherEmojiFromEnglish가 분기하는 모든 경우(뇌우/눈/비/안개/흐림/
// 구름조금/맑음)를 이 맵으로 전부 커버한다. 일반 방문자 URL엔 이 파라미터가
// 없으므로 평소 동작에는 전혀 영향 없다.
// 2026-07-18 8차 피드백(Fable 5 검토 반영): 각 시나리오에 바람(windSpeedKmh/
// gustKmh)·강수강도 등급(rainIntensityGrade)까지 목업으로 채워서, 비 애니메이션의
// 바람 기울기·강도별 밀도/굵기까지 실제 날씨와 무관하게 결정론적으로 테스트할
// 수 있게 했다(rainIntensityGrade는 백엔드 classifyRainIntensity와 동일한
// grade 문자열 — NONE/DRIZZLE/RAIN/HEAVY/VERY_HEAVY).
const WEATHER_TEST_SCENARIOS = {
  clear: { temp: 27, feelslike: 28, humidity: 45, precip: 0, precipprob: 0, preciptype: null, conditions: "Clear", windSpeedKmh: 8, gustKmh: 10, rainIntensityGrade: "NONE" },
  "partly-cloudy": { temp: 25, feelslike: 25, humidity: 55, precip: 0, precipprob: 10, preciptype: null, conditions: "Partially cloudy", windSpeedKmh: 12, gustKmh: 15, rainIntensityGrade: "NONE" },
  cloudy: { temp: 23, feelslike: 23, humidity: 60, precip: 0, precipprob: 15, preciptype: null, conditions: "Cloudy", windSpeedKmh: 15, gustKmh: 19, rainIntensityGrade: "NONE" },
  overcast: { temp: 21, feelslike: 21, humidity: 72, precip: 0, precipprob: 25, preciptype: null, conditions: "Overcast", windSpeedKmh: 20, gustKmh: 26, rainIntensityGrade: "NONE" },
  fog: { temp: 18, feelslike: 18, humidity: 96, precip: 0, precipprob: 10, preciptype: null, conditions: "Fog", windSpeedKmh: 3, gustKmh: 3, rainIntensityGrade: "NONE" },
  drizzle: { temp: 20, feelslike: 20, humidity: 90, precip: 0.4, precipprob: 80, preciptype: ["rain"], conditions: "Rain, Overcast", windSpeedKmh: 10, gustKmh: 13, rainIntensityGrade: "DRIZZLE" },
  rain: { temp: 19, feelslike: 19, humidity: 92, precip: 4, precipprob: 95, preciptype: ["rain"], conditions: "Rain, Overcast", windSpeedKmh: 22, gustKmh: 30, rainIntensityGrade: "RAIN" },
  heavyrain: { temp: 18, feelslike: 18, humidity: 95, precip: 18, precipprob: 100, preciptype: ["rain"], conditions: "Rain, Overcast", windSpeedKmh: 35, gustKmh: 55, rainIntensityGrade: "HEAVY" },
  storm: { temp: 20, feelslike: 20, humidity: 90, precip: 28, precipprob: 100, preciptype: ["rain"], conditions: "Thunderstorm, Rain", windSpeedKmh: 55, gustKmh: 88, rainIntensityGrade: "VERY_HEAVY" },
  snow: { temp: -2, feelslike: -5, humidity: 80, precip: 3, precipprob: 90, preciptype: ["snow"], conditions: "Snow", windSpeedKmh: 18, gustKmh: 24, rainIntensityGrade: "NONE" }
};
// 2026-07-18 9차 피드백: "지금 비가 안 오니 날씨별 애니메이션을 쉽게 보여
// 달라" — ?forceWeather=X는 URL을 매번 다시 입력해야 하는 불편이 있어서,
// 화면 안에서 탭 한 번으로 시나리오를 바로 바꿔볼 수 있는 스위처를
// ?fxtest=1일 때만 띄운다(일반 방문자 URL엔 없으므로 평소엔 존재 자체가
// 없음). wdActiveScenarioKey를 mutable로 바꿔서 초기값은 ?forceWeather의
// 값을 그대로 쓰고, 이후 스위처 탭으로 언제든 바뀔 수 있게 했다.
const WD_FX_TEST = new URLSearchParams(location.search).get("fxtest") === "1";
const WD_FX_TEST_LABELS = {
  clear: "맑음",
  "partly-cloudy": "구름조금",
  cloudy: "흐림",
  overcast: "잔뜩흐림",
  fog: "안개",
  drizzle: "이슬비",
  rain: "비",
  heavyrain: "강한비",
  storm: "뇌우",
  snow: "눈"
};
let wdActiveScenarioKey = new URLSearchParams(location.search).get("forceWeather");
let wdLastCurrentData = null;
let wdLastHourlyNowItem = null;
let wdFxTestBarEl = null;
// 2026-07-20 11차 피드백: renderWeatherCurrent()가 계산한 "지금 비가
// 오는가"(VC/백엔드 기준, 시간대별 스트립과 같은 소스)와 조건텍스트 뒤에
// 붙일 강수확률/mm 접미사를 renderWeatherCurrentToday()가 그대로 이어받아
// 쓴다(항상 renderWeatherCurrent가 먼저 실행되므로 순서상 안전 —
// fetchWeatherDetail 참조). wdCurrentConditionBase는 renderWeatherCurrent가
// "Open-Meteo 문구를 그대로 써도 되는지" 판단한 결과 — null이면
// renderWeatherCurrentToday가 today.conditionsKo(백엔드 기준, 스트립과 같은
// 소스)로 폴백해야 한다는 신호다.
let wdCurrentIsRainingNow = false;
let wdCurrentRainSuffix = "";
let wdCurrentConditionBase = null;

function wdActiveScenario() {
  return wdActiveScenarioKey && WEATHER_TEST_SCENARIOS[wdActiveScenarioKey]
    ? WEATHER_TEST_SCENARIOS[wdActiveScenarioKey]
    : null;
}

// 스위처에서 칩을 탭했을 때 호출 — 새 네트워크 요청 없이, 마지막으로
// 성공한 fetch 결과(wdLastCurrentData/wdLastHourlyNowItem, fetchWeatherDetail
// 참조)를 그대로 재사용해 즉시 다시 그린다. key가 null/빈 문자열이면 실제
// 데이터로 복귀한다.
function wdApplyTestScenario(key) {
  wdActiveScenarioKey = key || null;
  renderWeatherCurrent(wdLastCurrentData, wdLastHourlyNowItem);
  wdRenderFxTestBar();
}

// ?fxtest=1일 때만 하단에 뜨는 디버그 전용 시나리오 칩 바 — 실제 방문자
// URL엔 이 쿼리 파라미터가 없으므로 함수 자체는 로드돼도 아무 것도
// 만들지 않는다(WD_FX_TEST 가드).
function wdRenderFxTestBar() {
  if (!WD_FX_TEST) return;
  if (!wdFxTestBarEl) {
    wdFxTestBarEl = document.createElement("div");
    wdFxTestBarEl.className = "wd-fxtest-bar";
    document.body.appendChild(wdFxTestBarEl);
  }
  const resetActive = !wdActiveScenarioKey ? " is-active" : "";
  const chips = Object.keys(WEATHER_TEST_SCENARIOS)
    .map((key) => {
      const active = wdActiveScenarioKey === key ? " is-active" : "";
      return `<button type="button" class="wd-fxtest-chip${active}" data-scenario="${key}">${WD_FX_TEST_LABELS[key] || key}</button>`;
    })
    .join("");
  wdFxTestBarEl.innerHTML = `<button type="button" class="wd-fxtest-chip wd-fxtest-reset${resetActive}" data-scenario="">실제날씨</button>${chips}`;
  wdFxTestBarEl.querySelectorAll("[data-scenario]").forEach((btn) => {
    btn.addEventListener("click", () => wdApplyTestScenario(btn.getAttribute("data-scenario")));
  });
}

// 위치 권한을 못 받았을 때 쓰는 기본 좌표(인천) — 인수인계서 예시와 동일.
const DEFAULT_WEATHER_COORDS = { lat: 37.4563, lng: 126.7052 };
let userCoords = null;
let weatherDetailFetching = false;
// 2026-07-15: 상세보기를 열 때마다 매번 재요청하지 않고, 마지막 요청 후
// 일정 시간은 캐시를 재사용한다(좌표가 바뀌면(위치 갱신 등) 캐시를 무시하고
// 즉시 새로 받는다).
// 2026-07-21 유저 피드백(재조정): 원래는 1시간이었다("로딩될 때 실시간
// 업데이트, 이후 1시간은 업데이트 안 해도 된다"는 당시 요청 반영). 그런데
// 이 앱은 "대기화면"이라 유저가 화면을 계속 켜놓고 음악만 듣는 용도로 오래
// 쓴다는 게 실사용으로 확인됐다 — 그 상태로 1시간 넘게 두면 실제로는 폭우가
// 쏟아지는데 메인 화면·상세 화면 둘 다 예전 "옅은 이슬비"에 그대로 멈춰
// 있는 문제가 실측됐다. 15분으로 줄인다 — 백엔드 자체가 Visual Crossing
// 원본 호출을 4시간(CACHE_TTL_HOURS) D1 캐시로 이미 막아주므로, 프론트가
// 더 자주 물어봐도 실제 유료 API 호출 빈도는 늘지 않고(Cloudflare Worker
// 요청·D1 읽기만 늘어남, 둘 다 사실상 무료), 그날그날 발생한 429 사태와도
// 무관하다. 아래 WEATHER_REFRESH_INTERVAL_MS(10분 주기 자동 재요청)와 짝을
// 이뤄야 실제로 효과가 있다 — 자동 재요청 주기가 이 캐시 시간보다 길면
// 캐시에 막혀 매번 그냥 no-op된다.
const WEATHER_DETAIL_CACHE_MS = 15 * 60 * 1000;
let weatherDetailLastFetchAt = 0;
let weatherDetailLastCoordsKey = "";

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

// 2026-07-18 이슈 제보 — page2(.ezlong-webview) 안에서 세로 스크롤이 전혀
// 안 되고, 위로 스와이프해 되돌아가는 제스처도 안 먹힌다는 진단 요청.
// 이 함수는 원래 ezlong.com을 "항상 390 CSS px 너비의 아이폰에서 보는 것"
// 처럼 렌더한 뒤 transform:scale()로 실제 컨테이너 너비에 맞춰 시각적으로만
// 늘리고/줄이는 트릭이었다. iOS Safari/WebKit에는 transform이 걸린 iframe이
// 내부 터치 히트테스트 좌표가 실제 렌더 좌표와 어긋나 스크롤·탭 인식이
// 깨지는 것으로 널리 알려진 문제가 있고, 이 프로젝트가 겪은 다른 스크롤
// 사건들(CLAUDE.md 15차 등)도 전부 "조상에 transform이 있으면 그 하위
// 스크롤 인식이 깨진다"는 동일 계열 증상이었다 — iframe 자기 자신에게 걸린
// transform:scale()이 유력한 원인 후보라고 판단해, 이 스케일 트릭 자체를
// 제거하고 iframe이 컨테이너 폭 그대로(실제 기기 너비)로 렌더되게 한다
// (styles.css .ezlong-frame이 이제 width:100%/height:100%로 단순화됨).
// ezlong.com 자체가 반응형이라 실제 기기 너비로 렌더돼도 무리 없을 것으로
// 판단했다 — "항상 390px처럼 보이게 하는 시각적 일관성"보다 "스크롤이
// 되는 것"이 우선이라는 트레이드오프. 이 조치로도 스크롤이 안 되면
// #pageTrack(will-change:transform 상시 적용)이나 .clock-app(overflow:hidden)
// 같은 조상 요소가 진짜 원인일 가능성이 남아있고, 그 경우엔 설정/날씨상세
// 때처럼 이 페이지를 #pageTrack 밖으로 빼는 더 큰 구조 변경이 필요하다 —
// 실기기 검증 없이는 확정할 수 없는 영역이라 이번 라운드에서 시도하지 않음.

let lastAppliedScreenHeight = 0;

// 2026-07-07: iOS 네이티브 앱(WKWebView)에서 문장박스 하단 및 점4개 줄이
// 화면 밖으로 잘리는 버그의 원인을 찾음 — 아래 safariBottomGuard/
// browserBottomLift는 "모바일 사파리 주소창이 접혔다 폈다 하는 상황"을
// 대비해 실제 화면 높이보다 최대 143px 더 크게 --first-screen-height를
// 잡아주는 보정값인데, 네이티브 앱은 주소창 자체가 아예 없는 풀스크린
// WKWebView라서 이 보정이 전혀 필요 없다. 그런데 `standalone` 판정이
// PWA(홈화면 추가) 여부만 보고, "브라우저 chrome이 없는 네이티브 래퍼"는
// 구분하지 못해서 일반 모바일 사파리 탭과 똑같이 취급되어 실제 화면보다
// 143px(852pt 기준 약 17%)나 더 큰 높이로 grid를 계산 — 그 초과분만큼
// scene-dots·quote-panel 하단이 화면 밖으로 밀려났다. iOS 앱(ContentView.swift)이
// URL 뒤에 붙여주는 ?native=ios 쿼리스트링으로 "이건 chrome 없는 네이티브
// 래퍼다"를 구분해서 이 보정을 건너뛴다.
// 2026-07-24 신설 — 안드로이드 앱(MainActivity.kt)은 동일한 목적으로
// ?native=android를 붙인다. 두 값 모두 "네이티브 풀스크린 웹뷰"로 취급.
const isNativeWrapper = ["ios", "android"].includes(
  new URLSearchParams(window.location.search).get("native")
);
// 2026-07-27 신설 — 팝업배너/강제업데이트 브릿지가 iOS/안드로이드 분기를
// 매번 새로 판별할 필요 없이 재사용하는 값. isNativeWrapper와 같은 쿼리를
// 다시 읽을 뿐 기존 로직에는 영향 없음.
const nativePlatformKey = new URLSearchParams(window.location.search).get("native");

function syncFirstScreenHeight() {
  if (!app) return;
  const viewportHeight = Math.ceil(Math.max(
    window.innerHeight || 0,
    window.visualViewport?.height || 0
  ));
  // 뷰포트 높이가 1~2px 수준으로만 흔들리는 경우(서브픽셀 반올림, 스크롤바 유무 등)는
  // 무시한다 — 실제 모바일 사파리 주소창 접힘처럼 의미 있는 변화일 때만 다시 세팅해서
  // 불필요한 재조정(및 그로 인한 사진 영역 리사이즈 체감)을 줄인다.
  if (Math.abs(viewportHeight - lastAppliedScreenHeight) <= 2 && lastAppliedScreenHeight > 0) return;
  lastAppliedScreenHeight = viewportHeight;
  const touchDevice = window.matchMedia("(pointer: coarse)").matches;
  const standalone = isNativeWrapper || window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const safariBottomGuard = touchDevice && !standalone
    ? Math.min(164, Math.max(96, Math.round(viewportHeight * 0.09)))
    : 0;
  const userAgent = navigator.userAgent || "";
  const iOSSafari = touchDevice && /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(userAgent);
  const browserBottomLift = iOSSafari && !standalone
    ? Math.min(72, Math.max(46, Math.round(viewportHeight * 0.055)))
    : 0;

  app.style.setProperty("--first-screen-height", `${viewportHeight + safariBottomGuard}px`);
  app.style.setProperty("--first-screen-tail", `${safariBottomGuard}px`);
  app.style.setProperty("--browser-bottom-lift", `${browserBottomLift}px`);
}

function padTime(value) {
  return String(value).padStart(2, "0");
}

function getSceneForHour(hour) {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "midday";
  if (hour >= 17 && hour < 20) return "golden-hour";
  return "night";
}

function getTimeBucketForHour(hour) {
  if (hour >= 5 && hour < 6) return "dawn";
  if (hour >= 6 && hour < 8) return "early-morning";
  if (hour >= 8 && hour < 10) return "morning";
  if (hour >= 10 && hour < 12) return "late-morning";
  if (hour >= 12 && hour < 14) return "midday";
  if (hour >= 14 && hour < 16) return "afternoon";
  if (hour >= 16 && hour < 18) return "late-afternoon";
  if (hour >= 18 && hour < 20) return "sunset";
  if (hour >= 20 && hour < 22) return "evening";
  if (hour >= 22) return "night";
  if (hour < 3) return "midnight";
  return "pre-dawn";
}

// 2026-07-22 유저 요청 — "강수확률 30~40%대인데도 비 아이콘/문구가 뜬다,
// 애플 날씨와 비교하면 우리만 유독 많이 틀린 것 같다"는 피드백으로, 비로
// 표시하는 문턱을 30%→50%로 올렸다. 배경: classifyRainIntensity()(백엔드,
// weather-backend/src/logic.ts)는 precipProb>=30 && mm<1이면 이미 DRIZZLE
// ("약한 비") 등급을 매기는데, 이 mm<1 조건은 "아직 실제로 비가 거의/전혀
// 안 왔다"는 뜻이라 확률이 40%대만 돼도 "약한 비"라고 단정해버리는 게
// 체감 오탐의 근본 원인이었다. 백엔드 재배포 없이(그건 유저가 별도로
// wrangler deploy해야 해서 즉시 반영이 안 됨) 프런트 한 곳에서 표시 여부만
// 다시 판정하도록, 이 함수 하나를 current/hourly-strip/weekly 3곳이 전부
// 공유한다(8항 공유 함수 동기화 원칙 — 절대 복제하지 말 것).
// 규칙: 확률>=50%면 비로 취급(기존 mm 기반 4단계 라벨 그대로 재사용).
// 확률<50%인데 실제 강수량이 이미 1mm를 넘는(=진짜 비가 관측/예보된) 애매한
// 경우엔 "비"라고 단정하지 않되 정보를 숨기지도 않고 "흐림(약한 비 가능성
// NN%)"으로 절충 표기한다. 확률<50%이고 강수량도 1mm 미만이면 확률 자체를
// 표시에 반영하지 않는다(기존 흐림/맑음 판정에 맡김).
const RAIN_DISPLAY_PROB_THRESHOLD = 50;
const RAIN_DISPLAY_MM_THRESHOLD = 1;
// 2026-07-24 이슈 제보: "약한 비 74%"처럼 확률만 높고 실제 예보 강수량은
// 0mm에 가까운 순간에도 "비"로 확정 표시되는 오탐이 있었다(여름 소나기
// 모델이 흔히 만드는 패턴). 원인은 이 함수가 확률>=50%만 보고 바로
// showAsRain을 확정해버려서였다 — 정작 이 화면 하단의 "다음 비 소식"
// 문구(백엔드 buildNextRainCountdown 등)는 강수량이 실제로 잡혀야만 비로
// 인정하므로, 같은 화면 안에서 "비 74%"와 "이번 주는 비 소식 없음"이
// 동시에 뜨는 자기모순이 났다. 운영 지침: "비"로 확정하려면 확률 50%
// 이상"이고" 강수량도 0.2mm/h 이상이어야 한다(AND 조건) — 확률만으론
// 부족하다.
const RAIN_CONFIRM_MM_THRESHOLD = 0.2;
// 2026-07-27 유저 확정(헌법 개정): 확률이 아무리 높아도 시간당 강수량이
// 0.1mm 미만(사실상 0)이면 절충 신호 ②로도 취급하지 않는다 — 전 화면에서
// 비 신호를 제거한다(③). 이유: 이 앱 비 예보의 존재 이유는 "우산을
// 챙겨야 하나"인데, 0.1mm/h 미만은 우산 판단에 아무 정보가 없다. Visual
// Crossing이 하루 확률(예: 65%)을 전 시간에 같은 값으로 뭉개 주는 특성
// 때문에, 강수량 0인 시간마다 파란 확률 숫자가 도배되는 소음이 실제로
// 발생했다(2026-07-27 09:23 제보). "스쳐 지나갈 수는 있다" 뉘앙스는 우산
// 조언 문장(백엔드 buildUmbrellaAdvice) 한 곳만 담당한다. 이 문턱을
// 우회하는 화면별 예외를 추가하지 말 것 — 화면끼리 모순이 재발한다.
const RAIN_MAYBE_MIN_MM_THRESHOLD = 0.1;

// 2026-07-24 유저 제안: "6~8월 여름철엔 하루 종일 오는 비가 아니라 1~3시간
// 정도 스쳐 지나가는 낮은 확률의 비가 대부분이니, 그 경우 '약한 비 가능성'
// 대신 '약한 소나기 가능성'이라고 하면 사람들 체감(여름 소나기는 잠깐
// 왔다 갈 수도, 안 올 수도 있다는 인식)과 더 잘 맞는다"는 의견 반영.
// isCoolSummerWindow()(사진 풀 전용, 7/1~8/30)와는 별개로 이 문구는
// 유저가 명시한 6~8월 전체를 그대로 쓴다 — 기존 isCoolSummerActive()의
// month===7 || (month===8&&day<=30) 판정을 재사용하지 않는다.
// 실기기(WebView)는 항상 한국에서 KST로 구동되므로 new Date()를 그대로
// 쓰면 되고, 백엔드처럼 별도 KST 변환 헬퍼가 필요 없다(dateUtil.ts와 다른
// 부분 — 프론트는 항상 클라이언트 로컬 타임존 기준).
function isSummerShowerSeason(date = new Date()) {
  const month = date.getMonth() + 1;
  return month >= 6 && month <= 8;
}

// 2026-07-24 Fable 5 검토회신 반영(FABLE5_검토회신_비표시일관성_2026-07-24.md):
// 히어로·시간대별 스트립·주간예보가 각자 이 함수의 showAsRain/cloudyProbLabel
// 만 보고 "그럼 아이콘은?/숫자는 보여줘?"를 스스로 다시 판단하다가, 오늘
// 새로 생긴 ②(절충) 상태를 못 받아주는 소비처(스트립 아이콘)가 조용히
// ③(신호 없음)과 똑같이 그려버렸다 — 세 화면이 서로 다른 말을 하게 된
// 근본 원인. JS는 컴파일러가 새 상태 추가를 강제해주지 않으니, 규칙을
// 문서가 아니라 "반환값의 모양"으로 못박는다: 이 함수가 상태별 최종
// 표현(아이콘/숫자 노출 여부)까지 전부 계산해서 내려주고, 소비처는 그
// 값을 사전 찾듯 그대로 쓰기만 한다(직접 재판정 금지).
//
// 헌법: "②는 어떤 화면에서도 ③과 똑같이 보여선 안 된다 — ②의 최소 표현은
// 흐림 계열 아이콘 + 확률 숫자." (이 원칙 자체는 2026-07-27 개정 후에도
// 유효하다 — 개정된 것은 "무엇이 ②인가"의 진입 조건뿐이며, 강수량 0.1mm/h
// 미만은 이제 ②가 아니라 ③이다.)
//
// state: "rain"(①확정) | "maybe"(②절충) | "none"(③없음).
// iconDay/iconNight: 그 상태에서 써야 할 아이콘. null이면 "비와 무관한
// 아이콘"이라는 뜻이라 소비처가 기존 맑음/밤 로직을 그대로 쓰면 된다.
// showProb/probText: 확률 숫자를 보여줘야 하는지와 그 텍스트.
// showAsRain/cloudyProbLabel은 기존 소비처(히어로 등) 호환을 위해 그대로 둔다.
function deriveRainDisplay(precipProb, precipMm) {
  const prob = Math.max(0, Math.min(100, Number(precipProb) || 0));
  const mm = Math.max(0, Number(precipMm) || 0);
  const probText = `${Math.round(prob)}%`;

  if (prob >= RAIN_DISPLAY_PROB_THRESHOLD && mm >= RAIN_CONFIRM_MM_THRESHOLD) {
    // ① 비 확정
    return {
      state: "rain",
      showAsRain: true,
      cloudyProbLabel: null,
      iconDay: prob >= 60 ? "🌧️" : "🌦️",
      iconNight: "🌧️",
      showProb: true,
      probText,
    };
  }
  // 확률은 문턱을 넘었고 강수량도 최소한(0.1mm/h)은 잡혔지만 아직
  // 0.2mm/h(확정)에 못 미치는 경우도, mm이 이미 1mm를 넘어 "확률은 낮아도
  // 실제로 비가 잡힌" 경우도 — 둘 다 "비"라고 단정하진 않되 신호 자체는
  // 숨기지 않고 절충 표기한다. 6~8월엔 "약한 소나기 가능성", 그 외 계절엔
  // "약한 비 가능성"으로 단어만 바꾼다.
  // 2026-07-27 개정: 확률 경로에 "&& mm >= 0.1" 최소 강수량 조건 추가 —
  // 확률만 높고 강수량 0인 시간은 ③으로 떨어진다(위 상수 주석 참조).
  if (
    (prob >= RAIN_DISPLAY_PROB_THRESHOLD && mm >= RAIN_MAYBE_MIN_MM_THRESHOLD) ||
    mm >= RAIN_DISPLAY_MM_THRESHOLD
  ) {
    // ② 절충 신호
    const noun = isSummerShowerSeason()
      ? t("weather.lightShowerPossible", null, "약한 소나기 가능성")
      : t("weather.lightRainPossible", null, "약한 비 가능성");
    return {
      state: "maybe",
      showAsRain: false,
      cloudyProbLabel: `${noun} ${probText}`,
      iconDay: "⛅",
      iconNight: "☁️", // 밤엔 해가 든 ⛅가 어색해 구름만
      showProb: true,
      probText,
    };
  }
  // ③ 신호 없음
  return {
    state: "none",
    showAsRain: false,
    cloudyProbLabel: null,
    iconDay: null,
    iconNight: null,
    showProb: false,
    probText: "",
  };
}

// 2026-07-21 운영 지침("지금 하자, 시간이 걸려도 충분히"): 대기화면 메인
// 한줄 요약이 그동안 클라이언트에서 Open-Meteo를 직접 호출해 왔다(WMO
// weather_code 기반 weatherCodeToTag/weatherCodeToSummary). 문제 2가지 —
// (1) Open-Meteo 무료 티어는 "비영리 전용" 약관이라 이 서비스를 유료
// 전환하려는 목표와 근본적으로 상충한다. (2) 날씨상세 패널은 이미 이
// 백엔드(Visual Crossing 경유)를 쓰고 있어서, 메인 한줄과 상세가 서로 다른
// 프로바이더의 순간 스냅샷을 따로 불러오다 보니 "메인은 옅은 이슬비인데
// 상세는 맑음" 같은 모순이 반복 발생했다(2026-07-20 9차 피드백 등). 이제
// 메인 한줄도 /api/weather/current(백엔드) 응답 하나로 통일해서 두 문제를
// 한 번에 없앤다 — weatherCodeToTag/weatherCodeToSummary/currentPrecipitation
// (Open-Meteo 전용 로직)은 더 이상 쓰이지 않아 삭제했다. 백엔드가 이미
// classifyRainIntensity()로 강수강도를, mapConditionsToKo()로 조건 한글
// 라벨을 계산해 내려주므로(둘 다 날씨상세가 이미 신뢰하는 값), 여기서
// 임계값을 새로 복제하지 않고 그 값을 그대로 재사용한다.
function vcCurrentTag(c) {
  const conditions = (c.conditions || "").toLowerCase();
  const precipTypes = (c.preciptype || []).map((t) => String(t).toLowerCase());
  const isSnow = precipTypes.includes("snow") || /snow/.test(conditions);
  const grade = (c.rainIntensity && c.rainIntensity.grade) || "NONE";
  const rainDisplay = deriveRainDisplay(c.precipprob, c.precip);

  if (isSnow) return "snow";
  // 2026-07-22: 50% 미만이면 백엔드 grade가 DRIZZLE 등이어도 비 아이콘으로
  // 취급하지 않고 아래 흐림/맑음 판정으로 내려간다.
  if (rainDisplay.showAsRain) {
    if (grade === "DRIZZLE") return "light-rain";
    if (grade === "RAIN") return "rain";
    if (grade === "HEAVY" || grade === "VERY_HEAVY") return "heavy-rain";
  }

  // 비/눈이 아닌 경우 — 백엔드가 이미 계산해 내려주는 conditionsKo(한글
  // 라벨, mapConditionsToKo 결과)로 판정한다. 응답에 아직 conditionsKo가
  // 없는(배포 전환 과도기) 경우를 대비해 conditions 원문도 보조로 살핀다.
  // 2026-07-28 글로벌화 W2: 한국어 문자열 비교 → 코드 비교.
  // 영어 모드에서는 conditionsKo 가 "Fog"/"Overcast" 로 오므로 아래
  // 등가비교가 전부 false 가 되어 배경 장면이 통째로 clear 로 떨어졌다.
  // conditions 원문 정규식은 예전 그대로 보조로 남겨둔다 — 백엔드가
  // conditionCode 를 아직 안 주는 응답(캐시 등)의 안전망이다.
  const code = conditionCodeOf(c);
  const C = WX.CONDITION;
  if (code === C.FOG || /fog|mist|haze/.test(conditions)) return "mist";
  if (code === C.CLOUDY || /overcast/.test(conditions)) return "cloudy";
  if (code === C.PARTLY_CLOUDY || /partially cloudy|partly cloudy/.test(conditions)) return "partly-cloudy";
  if (code === C.MOSTLY_CLOUDY || /cloudy/.test(conditions)) return "cloudy";
  if (code === C.CLEAR || /clear/.test(conditions)) return "clear";
  if (rainDisplay.cloudyProbLabel) return "cloudy";
  // conditionsKo가 "비"/"눈"/"천둥번개"처럼 강수 계열인데 rainIntensity가
  // NONE으로 판정한 드문 불일치 상황 — 비/눈 아이콘을 잘못 켜는 것보다
  // 구름으로 안전하게 대체한다.
  if (code === C.RAIN || code === C.SNOW || code === C.THUNDER) return "cloudy";
  return "clear";
}

function vcCurrentSummary(c) {
  const conditions = (c.conditions || "").toLowerCase();
  const precipTypes = (c.preciptype || []).map((t) => String(t).toLowerCase());
  const isSnow = precipTypes.includes("snow") || /snow/.test(conditions);
  const grade = (c.rainIntensity && c.rainIntensity.grade) || "NONE";
  const isThunder = /thunder|storm/.test(conditions);
  const rainDisplay = deriveRainDisplay(c.precipprob, c.precip);

  // 2026-07-28 글로벌화 W2: 반환 문자열을 카탈로그 경유로 바꿨다.
  // t() 는 키가 없으면 fallback(현행 한국어)을 그대로 돌려주므로,
  // 한국어 화면에서는 이 변경 전후가 완전히 같은 값이다.
  if (isSnow) return conditionLabel(WX.CONDITION.SNOW, "눈");
  if (rainDisplay.showAsRain && grade !== "NONE") {
    // rainIntensity.label은 백엔드가 이미 "약한 비/비/강한 비/매우 강한
    // 비"로 계산해 내려주는 문구 — 날씨상세 패널(wdCurrentConditionBase)도
    // 같은 값을 쓰므로 재사용하면 두 화면이 항상 같은 말을 하게 된다.
    if (isThunder) return t("weather.thunderShower", null, "뇌우");
    return rainGradeLabel(c.rainIntensity) || conditionLabel(WX.CONDITION.RAIN, "비");
  }

  // 2026-07-22: 확률<50%인데 강수량이 이미 1mm를 넘는 애매한 경우 —
  // "비"라고 단정하지 않되 확률 정보는 숨기지 않는 절충 표기.
  if (rainDisplay.cloudyProbLabel) {
    return t("weather.cloudyWithRainChance", { label: rainDisplay.cloudyProbLabel },
             `흐림(${rainDisplay.cloudyProbLabel})`);
  }

  // 드문 경우지만, 백엔드 conditions 원문이 "Rain" 계열인데 실측
  // precip/precipprob 기준(classifyRainIntensity)으로는 NONE 등급인 상충
  // 상황이 있을 수 있다(하루 단위 conditions 텍스트와 순간 실측치가 다른
  // 소스로 계산되기 때문) — 이때 conditionsKo를 그대로 보여주면 "비 없음"
  // 등급인데 텍스트는 "비"라고 말하는 자기모순이 생긴다. vcCurrentTag도
  // 같은 상황에서 아이콘을 cloudy로 안전하게 대체하므로, 텍스트도 같은
  // 기준으로 안전한 값으로 대체해 아이콘·문구가 항상 같은 판정을 말하게 한다.
  // 2026-07-28 글로벌화 W2: 정규식 /비|눈|천둥번개/ → 코드 비교.
  // 이 정규식은 영어 모드에서 절대 매치되지 않아 자기모순(아이콘은 구름,
  // 문구는 Rain)이 그대로 살아났다.
  const summaryCode = conditionCodeOf(c);
  if (summaryCode === WX.CONDITION.RAIN || summaryCode === WX.CONDITION.SNOW ||
      summaryCode === WX.CONDITION.THUNDER) {
    return conditionLabel(WX.CONDITION.CLOUDY, "흐림");
  }
  if (summaryCode !== WX.CONDITION.UNKNOWN) {
    return conditionLabel(summaryCode, c.conditionsKo);
  }
  // 사전에 없는 값(빈 문자열·미지의 라벨) — 예전처럼 원문을 그대로 쓰고,
  // 그마저 없으면 맑음으로 떨어진다.
  return c.conditionsKo || conditionLabel(WX.CONDITION.CLEAR, "맑음");
}

function weatherTagGroup(tag) {
  if (["light-rain", "rain", "heavy-rain"].includes(tag)) return "rain";
  if (["partly-cloudy", "cloudy", "mist"].includes(tag)) return "cloudy";
  return tag;
}

function weatherIconFor(tag, isDay) {
  // partly-cloudy(구름 약간)는 해+구름 아이콘으로, cloudy/mist(흐림·안개)는
  // 구름만 있는 아이콘으로 구분한다 — 유저 디자인 세트에 둘 다 있어서 세분화.
  if (tag === "partly-cloudy") return "sun-cloud-icon";
  const group = weatherTagGroup(tag);
  if (group === "rain") return "rain-icon";
  if (group === "snow") return "snow-icon";
  if (group === "cloudy") return "cloud-icon";
  return isDay === false ? "moon-icon" : "sun-icon";
}

function photoRotationSlot() {
  return String(Math.floor(Date.now() / (15 * 60 * 1000)));
}

function photoBatchSlot() {
  // 활성 4장 후보군 자체를 2시간마다 새로 뽑는다. 장마처럼 같은 날씨/계절/시간대가
  // 며칠씩 이어져도 대기화면 사진이 계속 바뀌도록 하기 위함 (photoSetKey에 사용).
  return String(Math.floor(Date.now() / (2 * 60 * 60 * 1000)));
}

const photoHistoryStorageKey = "ezlong:photoHistory";
const photoHistoryMaxPerContext = 400;

function loadPhotoHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(photoHistoryStorageKey) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch (error) {
    return {};
  }
}

function savePhotoHistory(history) {
  try {
    localStorage.setItem(photoHistoryStorageKey, JSON.stringify(history));
  } catch (error) {
    // localStorage를 못 쓰는 환경이어도 앱 동작에는 지장이 없어야 한다.
  }
}

function photoHistoryContextKey() {
  // 정확한 weather tag(예: light-rain/rain/heavy-rain) 대신 그룹 단위(rain/cloudy/snow/clear)로
  // 묶어서 히스토리를 공유한다. 장마 기간처럼 세부 태그가 오가도 "비 계열" 전체 사진 풀을
  // 하나의 순환 대상으로 취급해야 실제로 겹치지 않는 효과가 난다.
  return [getCurrentSeason(), weatherTagGroup(weatherState.tag)].join("|");
}

function pickNonRepeatingPhotos(pool, count) {
  if (pool.length <= count) return shuffledPhotos(pool);

  const historyKey = photoHistoryContextKey();
  const history = loadPhotoHistory();
  const recentUrls = new Set(history[historyKey] || []);

  // 최근에 보여준 적 없는 사진을 우선 사용하고, 그것만으로 부족할 때만(=이미 거의
  // 다 순환했을 때) 전체 후보군에서 다시 뽑는다. 그래서 같은 날씨가 오래 이어져도
  // 전체 사진을 다 보여주기 전까지는 반복되지 않는다.
  const unseen = pool.filter((image) => !recentUrls.has(imageUrl(image)));
  const source = unseen.length >= count ? unseen : pool;
  const picked = shuffledPhotos(source).slice(0, count);

  const updatedHistory = [...(history[historyKey] || []), ...picked.map(imageUrl)].slice(-photoHistoryMaxPerContext);
  history[historyKey] = updatedHistory;
  savePhotoHistory(history);

  return picked;
}

/**
 * 배경사진에 쓸 계절. 2026-07-28 글로벌화 W3 — 남반구 대응.
 *
 * ─────────────────────────────────────────────────────────────
 * 왜 위도를 보는가
 * ─────────────────────────────────────────────────────────────
 * 지금까지는 달(month)만 봤다. 한국만 쓰던 동안엔 맞았지만, 1차 출시
 * 대상에 **호주·뉴질랜드**가 들어있다 — 지금(7월) 한국은 여름이지만
 * 시드니는 한겨울이다. 달만 보면 그들에게 출시 첫날부터 한여름 사진이
 * 깔린다. 남반구는 북반구를 6개월 민 것과 같으므로 위도로 뒤집는다.
 *
 * ★ 한국(위도 33~39)에서는 결과가 예전과 완전히 같다 ★
 * 위도를 모를 때(권한 거부·측위 전)도 북반구로 간주하므로 같다.
 * 이 동등성은 scripts/test-season.mjs 가 12개월 전수로 확인한다.
 */
function getCurrentSeason(date = new Date()) {
  const lat = userCoords && typeof userCoords.lat === "number" ? userCoords.lat : null;
  if (FZ_SEASON && FZ_SEASON.resolveSeason) return FZ_SEASON.resolveSeason(date, lat);

  // i18n 스크립트 미로드 시 폴백 — 예전 동작(북반구 고정) 그대로
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

/**
 * 시간대 버킷을 앞뒤 한 칸씩 넓힌다(하루는 원형이라 pre-dawn 다음은 dawn).
 *
 * 2026-08-04 운영 승인 — 밤에 "여름 + 약한 비" 후보가 딱 4장이었다.
 * 밤·자정·새벽은 촬영분 자체가 적은데(밤 15장, 자정 3장, 새벽 3장) 자동
 * 모드가 버킷 하나만 보고 있어서, 16분마다 새 세트를 뽑아도 같은 4장이
 * 순서만 바뀌어 돌았다. 저녁 사진은 58장이나 되고 밤 사진과 눈으로
 * 구분되지 않으니, 시간대만 한 칸씩 열어주면 재고 문제가 풀린다.
 * 날씨·계절 조건은 건드리지 않는다 — 비 오는 사진은 그대로 비 사진이다.
 *
 * 배열을 함수 안에 두는 이유: 이 파일 앞쪽에서 벌어진 TDZ 사고(2026-08-04
 * lastPhotoRotateAt) 이후, 모듈 최상위 const에 의존하지 않는 쪽을 택한다.
 */
function widenTimeBuckets(buckets) {
  const cycle = [
    "dawn", "early-morning", "morning", "late-morning", "midday", "afternoon",
    "late-afternoon", "sunset", "evening", "night", "midnight", "pre-dawn"
  ];
  const widened = new Set(buckets);
  buckets.forEach((bucket) => {
    const index = cycle.indexOf(bucket);
    if (index < 0) return;
    widened.add(cycle[(index - 1 + cycle.length) % cycle.length]);
    widened.add(cycle[(index + 1) % cycle.length]);
  });
  return Array.from(widened);
}

function getSceneTimeBuckets(sceneId) {
  if (Date.now() >= manualSceneUntil) return [getTimeBucketForHour(new Date().getHours())];
  if (sceneId === "morning") return ["dawn", "early-morning", "morning"];
  if (sceneId === "midday") return ["late-morning", "midday", "afternoon"];
  if (sceneId === "golden-hour") return ["late-afternoon", "sunset", "evening"];
  if (sceneId === "night") return ["night", "midnight", "pre-dawn"];
  return [getTimeBucketForHour(new Date().getHours())];
}

function getQuoteCategory(quote) {
  return Object.prototype.hasOwnProperty.call(categoryLabels, quote.category) ? quote.category : "mindset";
}

function buildScenePhotos(sceneId) {
  return Array.from({ length: 12 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return `assets/backgrounds/${sceneId}/${number}.jpg`;
  });
}

function imageUrl(image) {
  if (typeof image === "string") return image;
  return image?.publicUrl || image?.src || "";
}

function photoCreditText(image) {
  if (!image || typeof image === "string" || image.source === "local") return "Photo: ezlong archive";
  const author = image.attribution || image.author || (image.source === "wikimedia-commons" ? "Wikimedia Commons" : "Photo archive");
  return image.license ? `${author} · ${image.license}` : author;
}

function renderPhotoCredit(image) {
  if (!photoCredit) return;
  photoCredit.textContent = photoCreditText(image);
  const url = image?.sourceUrl || image?.publicUrl || "#";
  photoCredit.href = url;
  photoCredit.toggleAttribute("aria-hidden", !url || url === "#");
}

// 2026-07-25 유저 요청 — 설정 화면 "배경 사진" 섹션에 계절/날씨/시간대 3개
// 매칭 기준을 각각 켜고 끌 수 있는 토글을 신설했다. 꺼진 기준은 아래
// matchingArchivePhotos의 필터 조건에서 완전히 빠져서, 그 기준과 무관하게
// 랜덤으로 사진이 뽑힌다. "계절"은 현재 여름 사진밖에 없어(CLAUDE.md 30항
// 계절 사진 수집 일정 참조 — 겨울 35장뿐 등 계절별 물량이 아직 안 갖춰짐)
// 설정 화면에서 체크박스 자체를 disabled로 막아뒀고, 여기 로직도 항상
// true로 취급한다(loadBgFilterToggle을 아예 부르지 않음).
const bgFilterWeatherStorageKey = "ezlong:bgFilterWeather";
const bgFilterTimeStorageKey = "ezlong:bgFilterTimeOfDay";

function loadBgFilterToggle(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw === null ? true : raw === "1"; // 기본값: 켜짐(그 기준으로 매칭)
  } catch (error) {
    return true;
  }
}

function saveBgFilterToggle(storageKey, value) {
  try {
    localStorage.setItem(storageKey, value ? "1" : "0");
  } catch (error) {
    // localStorage를 못 쓰는 환경이어도 배경사진 표시 자체에는 지장이 없어야 한다.
  }
}

// 체크됨/해제됨을 문자 기호로 보여주는 상태 문구용 — 컬러 이모지 대신
// 단순 텍스트 기호(☑/☐)를 쓴다(유저가 준 원문 문구의 취지를 살리되
// 앱 전체에서 이모지를 안 쓰는 기존 톤과 맞춘다).
function bgFilterCheckSymbol(on) {
  return on ? "☑" : "☐";
}

// 설정 화면을 열 때(그리고 토글을 바꿀 때마다) 체크박스 체크 상태와
// 하단 상태 문구를 저장값에 맞춰 다시 그린다. "계절"은 함수 진입 시점에
// 이미 HTML에 checked+disabled로 고정돼 있어 여기서 건드리지 않는다.
function syncBgFilterUi() {
  const weatherOn = loadBgFilterToggle(bgFilterWeatherStorageKey);
  const timeOn = loadBgFilterToggle(bgFilterTimeStorageKey);
  if (bgFilterWeatherEl) bgFilterWeatherEl.checked = weatherOn;
  if (bgFilterTimeEl) bgFilterTimeEl.checked = timeOn;
  if (bgFilterStatusEl) {
    // 2026-07-25 2차 피드백 — 계절/날씨/시간대 각 라벨(체크기호 포함)을
    // .bg-filter-status-tag로 감싸서 굵게+오렌지로 강조한다. 이 문구는
    // innerHTML로 그리는 유일한 곳이라, 라벨 3개가 전부 고정 문자열(사용자
    // 입력이 섞이지 않음)이라는 걸 유지해야 한다 — 나중에 라벨을 동적
    // 값으로 바꾸게 되면 반드시 이스케이프 처리를 추가할 것.
    const tag = (on, label) => `<span class="bg-filter-status-tag">${bgFilterCheckSymbol(on)} ${label}</span>`;
    // 2026-07-28 W9-2 — 문장 뼈대를 카탈로그로 옮긴다. {filters} 자리에
    // 태그 3개를 이어붙인 HTML 이 들어가는데, 라벨은 전부 카탈로그에서 온
    // 고정 문자열이라 여전히 사용자 입력이 섞이지 않는다(위 주석의 전제 유지).
    const filters = [
      tag(true, t("settings.background.season", null, "계절")),
      tag(weatherOn, t("settings.background.weather", null, "날씨")),
      tag(timeOn, t("settings.background.timeOfDay", null, "시간대")),
    ].join(" ");
    bgFilterStatusEl.innerHTML = t(
      "settings.background.activeNotice",
      { filters },
      `현재 ${filters} 에 맞는 배경 사진만 나옵니다.`
    );
  }
}

function photoSetKey(sceneId) {
  const timeBuckets = getSceneTimeBuckets(sceneId);
  const currentTag = weatherState.tag;
  const currentSeason = getCurrentSeason();
  // 토글 상태도 키에 포함시켜서, 설정 화면에서 날씨/시간대를 껐다 켰다 할
  // 때마다 캐시된 4장 세트(activePhotoSetKey)가 즉시 무효화되고 다시
  // 계산되게 한다 — 안 그러면 토글을 바꿔도 다음 자연 순환 전까지 화면이
  // 그대로다.
  const weatherOn = loadBgFilterToggle(bgFilterWeatherStorageKey) ? "1" : "0";
  const timeOn = loadBgFilterToggle(bgFilterTimeStorageKey) ? "1" : "0";
  return [currentSeason, currentTag, timeBuckets.join("-"), photoBatchSlot(), weatherOn, timeOn, String(photoCycleGen)].join("|");
}

function matchingArchivePhotos(sceneId) {
  const timeBuckets = getSceneTimeBuckets(sceneId);
  const currentTag = weatherState.tag;
  const groupedTag = weatherTagGroup(currentTag);
  const currentSeason = getCurrentSeason();
  const weatherFilterOn = loadBgFilterToggle(bgFilterWeatherStorageKey);
  const timeFilterOn = loadBgFilterToggle(bgFilterTimeStorageKey);
  const seasonMatches = (image) => image.seasonTags?.includes(currentSeason);
  const timeMatches = (image) => !timeFilterOn || image.timeBuckets?.some((bucket) => timeBuckets.includes(bucket));
  const exactWeatherMatches = (image) => !weatherFilterOn || image.weatherTags?.includes(currentTag);
  const groupedWeatherMatches = (image) => !weatherFilterOn || image.weatherTags?.includes(groupedTag);
  // 2026-07-07 재발 방지: 예전엔 currentTag === "light-rain"일 때만 heavy-rain/
  // 폭풍 이미지를 걸러냈다 — 그런데 "흐림(cloudy)"인데 번개 치는 사진이 나온
  // 실제 사고가 있었다. 원인은 사진 데이터(background-manifest.json)에서
  // 벼락/폭풍 사진 일부가 weatherTags에 "cloudy"를 부가 태그로 같이 갖고
  // 있었던 것 — 태그 자체는 고쳤지만(2026-07-08), 앞으로 자동 수집
  // 파이프라인이 비슷하게 잘못 태깅해도 화면에 안 나오도록 로직도 같이
  // 강화한다. "극적인 폭풍/번개" 성격의 사진은 실제 날씨가 진짜
  // heavy-rain(폭우/뇌우)급일 때만 허용하고, 그 외 모든 날씨(맑음/흐림/
  // 옅은 비 등)에서는 무조건 제외한다.
  const dramaticStormMoodTags = ["storm-front", "dramatic-sky", "lightning", "night-storm", "summer-thunderstorm"];
  const moodSafe = (image) => {
    const weatherTags = image.weatherTags || [];
    const moodTags = image.moodTags || [];
    const isDramaticStorm = weatherTags.includes("heavy-rain")
      || weatherTags.includes("thunderstorm")
      || moodTags.some((tag) => dramaticStormMoodTags.includes(tag));
    if (!isDramaticStorm) return true;
    return currentTag === "heavy-rain";
  };
  const uniquePhotos = (items) => {
    const seen = new Set();
    return items.filter((image) => {
      const url = imageUrl(image);
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
  };
  const archivePhotos = backgroundArchive
    .filter((image) => {
      const seasonMatch = seasonMatches(image);
      const timeMatch = timeMatches(image);
      const exactWeatherMatch = exactWeatherMatches(image);
      return seasonMatch && timeMatch && exactWeatherMatch && moodSafe(image) && imageUrl(image);
    })
    .map((image) => image);

  // 정확한 날씨 태그(예: light-rain) 매칭 사진이 이미 충분하면(4장 이상) 그것만 쓴다.
  // 예전 코드는 매칭 수와 무관하게 그룹/폴백 티어를 항상 합쳐버려서, 비가 오는데도
  // 맑음/흐림 태그의 무관한 사진이 후보에 섞여 4장 중 1장만 비 사진으로 보이는 문제가 있었다.
  const exactPhotos = uniquePhotos(archivePhotos);
  // 2026-08-04 운영 승인 — 예전엔 여기서 4장만 넘으면 바로 끝냈다.
  // 그런데 4장은 '한 세트'와 정확히 같은 수라서, 16분마다 새 세트를
  // 뽑아도 같은 4장이 순서만 바뀌어 돌아왔다(밤+비 조건의 실제 증상).
  // 한 바퀴 돌 때 새 얼굴이 나오려면 최소한 세트의 3배는 있어야 한다.
  const photoPoolComfortable = 12;
  if (exactPhotos.length >= photoPoolComfortable) return exactPhotos;
  // 재고가 얇을 때 가장 먼저 푸는 것은 '시간대'다. 운영자가 반복해서
  // 지적하신 건 늘 날씨가 안 맞는다는 것이었지 시간대가 아니었고,
  // 저녁 사진과 밤 사진은 눈으로 구분되지 않는다. 계절·날씨 조건은
  // 그대로 둔 채 앞뒤 한 칸씩만 연다.
  const widenedBuckets = widenTimeBuckets(timeBuckets);
  const widerTimeMatches = (image) =>
    !timeFilterOn || image.timeBuckets?.some((bucket) => widenedBuckets.includes(bucket));
  const widerTimePhotos = uniquePhotos(
    backgroundArchive.filter((image) =>
      seasonMatches(image) && widerTimeMatches(image) && exactWeatherMatches(image)
      && moodSafe(image) && imageUrl(image))
  );
  if (widerTimePhotos.length >= 4) return widerTimePhotos;
  if (exactPhotos.length >= 4) return exactPhotos;

  const groupedArchivePhotos = backgroundArchive
    .filter((image) => {
      const seasonMatch = seasonMatches(image);
      const timeMatch = timeMatches(image);
      const weatherMatch = groupedWeatherMatches(image);
      return seasonMatch && timeMatch && weatherMatch && moodSafe(image) && imageUrl(image);
    })
    .map((image) => image);
  const groupedPhotos = uniquePhotos([...exactPhotos, ...groupedArchivePhotos]);
  if (groupedPhotos.length >= 4) return groupedPhotos;

  // 같은 시간대에 날씨가 맞는 사진이 부족할 때, 다음 우선순위는 "시간대 무관하지만
  // 날씨는 맞는 사진"이다. 시간대가 살짝 어긋난 비 사진 쪽이, 시간대는 맞지만
  // 맑은 하늘이 나오는 사진보다 사용자에게 덜 어색하다(오늘 사용자 피드백 반영).
  const weatherOnlyPhotos = backgroundArchive
    .filter((image) => {
      const seasonMatch = seasonMatches(image);
      const weatherMatch = groupedWeatherMatches(image);
      return seasonMatch && weatherMatch && moodSafe(image) && imageUrl(image);
    })
    .map((image) => image);
  const weatherPriorityPhotos = uniquePhotos([...groupedPhotos, ...weatherOnlyPhotos]);
  if (weatherPriorityPhotos.length >= 4) return weatherPriorityPhotos;

  // 계절까지 맞는 날씨 사진이 4장이 안 될 때, 다음 우선순위는 "계절/시간대는 달라도
  // 날씨(비/눈/맑음 등)만은 맞는 사진"이다. 유저가 반복적으로 지적한 건 항상
  // "날씨가 안 맞는다"였지 "계절이 안 맞는다"가 아니었다 — 그래서 날씨 정확도를
  // 계절 정확도보다 우선한다. 이 단계는 아직 실제 아카이브 사진(태그 있음)이라
  // 완전 무관 사진(로컬 제네릭 폴백)보다는 훨씬 낫다.
  const weatherAnySeasonPhotos = backgroundArchive
    .filter((image) => groupedWeatherMatches(image) && moodSafe(image) && imageUrl(image))
    .map((image) => image);
  const weatherOverSeasonPhotos = uniquePhotos([...weatherPriorityPhotos, ...weatherAnySeasonPhotos]);
  if (weatherOverSeasonPhotos.length >= 4) return weatherOverSeasonPhotos;

  const fallbackArchivePhotos = backgroundArchive
    .filter((image) => seasonMatches(image) && timeMatches(image) && moodSafe(image) && imageUrl(image))
    .map((image) => image);

  return uniquePhotos([...weatherOverSeasonPhotos, ...fallbackArchivePhotos]);
}

function shuffledPhotos(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

const preloadedPhotoUrls = new Set();

// 점(dot)으로 다른 배경사진으로 넘길 때 ~1초 로딩 지연이 있었다 — 그 사진을
// 처음 화면에 쓸 때가 되어서야 브라우저가 다운로드를 시작했기 때문이다.
// 4장 세트가 정해지는 시점(ensurePhotoSet)에 바로 전부 미리 받아두면,
// 실제로 그 사진으로 전환될 땐 이미 브라우저 캐시에 있어 지연이 없다.
function preloadPhotoSet(photos) {
  photos.forEach((photo) => {
    const url = imageUrl(photo);
    if (!url || preloadedPhotoUrls.has(url)) return;
    preloadedPhotoUrls.add(url);
    const preloadImage = new Image();
    preloadImage.src = url;
  });
}

// 2026-07-13: "Cool Summer" 사진 풀 — 매년 7/1~8/30, 07~19시(주간), 비/눈/안개가
// 아닌 날씨(맑음/구름조금/흐림)일 때 4장 중 최소 2장을 이 풀(collection ===
// "cool-summer")에서 보장한다. 사무실·도서관에서 여름 더위에 지친 사람들에게
// 청량한 여름 사진(바다/휴가)을 보여주기 위한 유저 요청. 일반 매칭 로직
// (matchingArchivePhotos)은 건드리지 않고, 이 조건일 때만 4장 구성 방식을 바꾼다
// — 다른 계절·시간대·날씨에서는 기존 동작과 완전히 동일하다.
function isCoolSummerWindow(date = new Date()) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return month === 7 || (month === 8 && day <= 30);
}

function isCoolSummerActive() {
  const now = new Date();
  if (!isCoolSummerWindow(now)) return false;
  const hour = now.getHours();
  if (hour < 7 || hour >= 19) return false;
  return ["clear", "partly-cloudy", "cloudy"].includes(weatherState.tag);
}

const coolSummerMinCount = 2;

function pickPhotoSetWithCoolSummer(photos) {
  if (!isCoolSummerActive()) return pickNonRepeatingPhotos(photos, 4);

  const coolPool = photos.filter((image) => image && image.collection === "cool-summer");
  if (coolPool.length === 0) return pickNonRepeatingPhotos(photos, 4);

  const coolCount = Math.min(coolSummerMinCount, coolPool.length);
  const regularPool = photos.filter((image) => !(image && image.collection === "cool-summer"));
  const regularCount = 4 - coolCount;

  const coolPicks = pickNonRepeatingPhotos(coolPool, coolCount);
  const regularPicks = regularPool.length > 0 ? pickNonRepeatingPhotos(regularPool, regularCount) : [];
  return shuffledPhotos([...coolPicks, ...regularPicks]);
}

function ensurePhotoSet(sceneId) {
  const nextKey = photoSetKey(sceneId);
  if (activePhotoSetKey === nextKey && activePhotoSet.length > 0) return;

  const candidates = matchingArchivePhotos(sceneId);
  const fallbackCandidates = scenePhotos[sceneId] || [];
  // 실제 아카이브 매칭 사진이 4장 미만이면(예: 새벽/야간처럼 촬영분이 아직 적은 시간대)
  // 로컬 기본 사진으로 채워서 항상 최대 4장 후보가 나오도록 한다.
  const seenUrls = new Set(candidates.map((image) => imageUrl(image)));
  const photos = candidates.length >= 4
    ? candidates
    : [...candidates, ...fallbackCandidates.filter((image) => !seenUrls.has(imageUrl(image)))];
  activePhotoSet = pickPhotoSetWithCoolSummer(photos);
  activePhotoSetKey = nextKey;
  // 2026-08-04 — 새 세트는 항상 1번 사진부터 순서대로(15분 슬롯 기반
  // 시작 인덱스는 명시 타이머 전환 후 의미가 없어졌다).
  // 3차 — 다만 웹뷰가 재로드돼 '같은 조건의 같은 세트'로 돌아온
  // 것이라면, 보던 위치를 이어받아야 리듬이 끊기지 않는다.
  const savedRotate = loadPhotoRotateState();
  activePhotoIndex =
    savedRotate && savedRotate.key === nextKey && typeof savedRotate.index === "number"
      ? Math.min(Math.max(0, savedRotate.index), Math.max(0, activePhotoSet.length - 1))
      : 0;
  activePhotoSlot = "";
  manualPhotoUntil = 0;
  preloadPhotoSet(activePhotoSet);
}

function syncPhotoDots() {
  dots.forEach((dot, index) => {
    const hasPhoto = index < activePhotoSet.length;
    dot.classList.toggle("active", index === activePhotoIndex && hasPhoto);
    dot.disabled = !hasPhoto;
    dot.setAttribute(
      "aria-label",
      hasPhoto
        ? t("settings.background.photoAria", { index: index + 1 }, `배경 사진 ${index + 1}`)
        : t("settings.background.photoMissingAria", { index: index + 1 }, `배경 사진 ${index + 1} 없음`)
    );
  });
}

function pickScenePhoto(sceneId) {
  if (!backgroundArchiveLoaded || !weatherResolved) return "";

  ensurePhotoSet(sceneId);
  if (activePhotoSet.length === 0) return "";

  // 2026-08-04 이슈 제보(배경 자동 전환 멈춤) — 슬롯 비교 기반 자동
  // 회전을 여기서 제거하고 아래 명시적 5분 타이머(photoAutoRotateTick)로
  // 이관했다. activePhotoSlot 갱신은 남긴다 — renderTime의 shouldRotatePhoto()
  // 경로가 15분에 1회만 강제 setScene을 발화하게 하는 스로틀 역할
  // (그 강제 호출은 ensurePhotoSet의 날씨/2시간 배치 변화 반영에 여전히 쓰인다).
  activePhotoSlot = photoRotationSlot();

  const photo = activePhotoSet[activePhotoIndex];
  lastScenePhoto[sceneId] = imageUrl(photo);
  return photo;
}

function selectPhotoIndex(index) {
  if (!activePhotoSet.length) return;
  activePhotoIndex = (index + activePhotoSet.length) % activePhotoSet.length;
  manualPhotoUntil = Date.now() + 15 * 60 * 1000;
  activePhotoSlot = photoRotationSlot();
  setScene(activeScene || getSceneForHour(new Date().getHours()), { syncDots: true, force: true });
}

function movePhoto(direction) {
  // 2026-08-15 — 동영상 배경이 도는 동안에는 스와이프가 영상을 넘긴다.
  // (사진은 영상 밑에 있어서 넘겨도 보이지 않는다 — 이슈 제보)
  try {
    if (typeof window.__flipzenVideoBgSwipe === "function"
        && window.__flipzenVideoBgSwipe(direction)) {
      return;
    }
  } catch (error) { /* 무시 — 사진 경로로 계속 */ }
  selectPhotoIndex(activePhotoIndex + direction);
}

function shouldRotatePhoto() {
  return Date.now() >= manualPhotoUntil && activePhotoSet.length > 0 && activePhotoSlot !== photoRotationSlot();
}

function animateDigit(element) {
  window.clearTimeout(element.flipTimer);
  element.classList.remove("is-flipping");
  element.offsetHeight;
  element.classList.add("is-flipping");
  element.flipTimer = window.setTimeout(() => {
    element.classList.remove("is-flipping");
  }, 640);
}

function renderTime(now = new Date()) {
  const hour = padTime(now.getHours());
  const minute = padTime(now.getMinutes());
  const nextDigits = [hour[0], hour[1], minute[0], minute[1]];

  nextDigits.forEach((digit, index) => {
    if (lastDigits[index] !== digit) {
      const previousDigit = lastDigits[index] || digit;
      digitElements[index].dataset.prev = previousDigit;
      digitElements[index].dataset.next = digit;
      digitElements[index].textContent = digit;
      if (timeHasRendered) {
        animateDigit(digitElements[index]);
      }
    }
  });

  lastDigits = nextDigits;
  timeHasRendered = true;
  renderDate(now);
  if (Date.now() >= manualSceneUntil) {
    const nextScene = getSceneForHour(now.getHours());
    setScene(nextScene, { syncDots: true, force: activeScene === nextScene && shouldRotatePhoto() });
  }
}

// 2026-07-28 글로벌화 W3: 날짜 라벨을 로케일화.
// 한국어는 "7월 28일 (화)" 그대로다 — FZ_REGION.formatDateLabel 의 ko 분기가
// 아래 폴백과 글자 단위로 같은 구현이며, scripts/test-region.mjs 가 확인한다.
// (영어는 "Jul 28 (Tue)" 형태 — "요일" 잘라내기 같은 한국어 전용 처리가
//  영어에 그대로 적용되면 아무 일도 안 일어나 조용히 어색해진다)
function renderDate(now) {
  if (FZ_REGION && FZ_REGION.formatDateLabel) {
    setText("dateLabel", FZ_REGION.formatDateLabel(now, FZ_LOCALE));
    return;
  }
  const monthDay = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric"
  }).format(now);
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    weekday: "short"
  }).format(now).replace("요일", "");
  setText("dateLabel", `${monthDay} (${weekday})`);
}

// 2026-07-21 유저 요청 — 상단 날짜를 누르면 문장박스가 완전히 사라지고
// 이번달 달력이 내려온다(일요일 시작, 오늘 강조, 심플하게 — 연/월 텍스트도
// 생략). 다시 누르면 접히고 문장박스가 되돌아온다.
// 2026-07-21 6차 피드백(구조 재설계) — "달력을 위에 두지 말고 문장박스
// 자리를 그대로 대체해라. 플립시계·음악박스는 위치가 같고, 문장박스만
// 밀려나고 그 자리에 달력이 온다." calendar-panel을 index.html에서
// .clock-fixed-group 밖으로 꺼내 quote-panel의 바로 앞 형제로 옮기고,
// styles.css에서 둘 다 .sky-room의 같은 grid 행(row3, 고정 크기)을
// 명시적으로 공유하게 했다 — row3이 고정 크기라 문장박스↔달력 전환 때
// clock-stage(플립시계·음악박스)는 전혀 영향받지 않는다(styles.css
// .sky-room/.quote-panel,.calendar-panel 규칙 참조).
// 2026-07-21 2차 피드백 — 좌우 스와이프로 전후달 이동(-12~+12개월, 총
// 25개월 범위)을 추가한다. "오늘이 속한 달"을 기준(diff=0)으로 매번 range를
// 계산해서, 자정을 넘겨 오늘 날짜가 바뀌어도 항상 실제 오늘 기준으로
// 재계산된다(달력을 열 때마다 이번 달로 리셋하므로 날짜 경계 문제 없음).
let calendarPanelOpen = false;
let calendarViewYear = null;
let calendarViewMonth = null; // 0-indexed

function calendarMonthDiffFromToday(year, month) {
  const now = new Date();
  return (year - now.getFullYear()) * 12 + (month - now.getMonth());
}

// 2026-07-21 7차 피드백 — 매달 1일 칸에 "7/1"로 월을 끼워 표기하던 방식(5·6차)
// 대신, 음악박스~달력 사이의 넉넉한 여백에 월 표기 한 줄("7 JULY")을 따로
// 두는 것으로 교체(유저 요청). 1일 칸은 다시 순수 숫자로 되돌린다.
const CALENDAR_MONTH_NAMES_EN = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
];

function buildCalendarGrid() {
  if (!calendarGridEl || calendarViewYear === null) return;
  const year = calendarViewYear;
  const month = calendarViewMonth;
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const todayDate = now.getDate();
  const startWeekday = new Date(year, month, 1).getDay(); // 0=일요일
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  if (calendarMonthLabelEl) {
    calendarMonthLabelEl.textContent = `${month + 1} ${CALENDAR_MONTH_NAMES_EN[month]}`;
  }
  let html = "";
  for (let i = 0; i < startWeekday; i += 1) {
    html += '<span class="calendar-day is-empty"></span>';
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    const isToday = isCurrentMonth && d === todayDate;
    const cls = ["calendar-day", isToday ? "is-today" : ""].filter(Boolean).join(" ");
    html += `<span class="${cls}">${d}</span>`;
  }
  calendarGridEl.innerHTML = html;
}

// 스와이프로 전후달 이동. range는 "오늘이 속한 달"로부터 ±12개월(총 25개월).
function shiftCalendarMonth(delta) {
  if (calendarViewYear === null) return;
  let newMonth = calendarViewMonth + delta;
  let newYear = calendarViewYear;
  while (newMonth < 0) { newMonth += 12; newYear -= 1; }
  while (newMonth > 11) { newMonth -= 12; newYear += 1; }
  const diff = calendarMonthDiffFromToday(newYear, newMonth);
  if (diff < -12 || diff > 12) return; // 범위 밖 — 무시(맨 끝에서 더 스와이프해도 그대로 유지)
  calendarViewYear = newYear;
  calendarViewMonth = newMonth;
  buildCalendarGrid();
}

function toggleCalendarPanel() {
  if (!calendarPanelEl) return;
  calendarPanelOpen = !calendarPanelOpen;
  if (dateLabelEl) dateLabelEl.setAttribute("aria-expanded", String(calendarPanelOpen));
  if (app) app.classList.toggle("calendar-open", calendarPanelOpen);
  if (quotePanel) quotePanel.classList.toggle("is-calendar-hidden", calendarPanelOpen);
  if (calendarPanelOpen) {
    const now = new Date();
    calendarViewYear = now.getFullYear();
    calendarViewMonth = now.getMonth();
    buildCalendarGrid();
    calendarPanelEl.setAttribute("aria-hidden", "false");
    // 다음 프레임에 실제 콘텐츠 높이(scrollHeight)로 max-height를 지정해야
    // "0 → 실제 높이"로 트랜지션된다(0 → auto는 애니메이션되지 않음).
    requestAnimationFrame(() => {
      calendarPanelEl.classList.add("is-open");
      calendarPanelEl.style.maxHeight = `${calendarPanelEl.scrollHeight}px`;
    });
  } else {
    // 닫을 때도 먼저 현재 실측 높이를 명시적으로 찍어준 뒤(이미 열려있어
    // scrollHeight와 같음) 다음 프레임에 0으로 낮춰야 "auto/이미 찍힌 값 →
    // 0"으로 트랜지션이 정상 재생된다.
    calendarPanelEl.style.maxHeight = `${calendarPanelEl.scrollHeight}px`;
    requestAnimationFrame(() => {
      calendarPanelEl.style.maxHeight = "0px";
      calendarPanelEl.classList.remove("is-open");
    });
    calendarPanelEl.setAttribute("aria-hidden", "true");
  }
}

if (dateLabelEl) {
  dateLabelEl.addEventListener("click", () => {
    // 2026-07-21 8차 — 온보딩 자동시연 도중 유저가 직접 탭하면, 예약돼 있던
    // 자동 열기/닫기/반짝임 타이머와 절대 충돌해선 안 된다(유저 조작이 항상
    // 우선). 탭이 들어온 순간 남은 타이머를 전부 취소한다.
    cancelCalendarOnboardingHint();
    toggleCalendarPanel();
  });
  dateLabelEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      cancelCalendarOnboardingHint();
      toggleCalendarPanel();
    }
  });
}

// 2026-07-21 8차 피드백 — "날짜를 누르면 달력이 열린다"는 걸 아무도 모를
// 것 같다는 지적. 앱을 처음 켰을 때 한 번, 달력을 자동으로 5초간 열었다
// 닫으면서 "여기 누르는 거구나"를 몸으로 보여주고, 닫히는 순간 상단
// 날짜칩에 5초짜리 마법가루 반짝임을 얹어 "방금 그 반짝인 자리를 눌러보면
// 되겠네"라는 직관적 유도를 만든다.
// 2026-07-21 피드백 — 최초엔 "하루에 한 번은 아쉽다"는 운영 피드백으로
// localStorage 1회 제한을 완전히 제거, 앱을 실행할 때마다 매번 재생한다.
let calendarOnboardingTimers = [];

function cancelCalendarOnboardingHint() {
  calendarOnboardingTimers.forEach((id) => window.clearTimeout(id));
  calendarOnboardingTimers = [];
}

function sparkleDateChip() {
  if (!dateChipSparkleEl || !dateLabelEl) return;
  // 2026-07-22 3차 피드백 — "5초도 너무 짧아서 인지를 못 한다"는 재지적으로
  // 15초까지 연장. 단순히 EFFECT_MS만 늘리면 기존 delay 분포(0~3.4초)가
  // 그대로라 파티클이 초반 5초 안에 다 등장·소멸해버리고 나머지 10초는
  // 아무것도 없는 빈 화면이 된다 — delay 범위를 13초까지 넓히고 개수도
  // 20→72로 늘려 15초 내내 고르게 반짝이도록 재조정했다.
  const SPARK_COUNT = 72;
  const EFFECT_MS = 15000;
  let html = "";
  for (let i = 0; i < SPARK_COUNT; i += 1) {
    const sx = (Math.random() * 130 - 15).toFixed(1); // -15%~115% — 칩 테두리 살짝 밖까지
    const sy = (Math.random() * 130 - 15).toFixed(1);
    const size = (3 + Math.random() * 3).toFixed(1);
    const delay = (Math.random() * 13).toFixed(2); // 15초 동안 물결치듯 등장
    const dur = (1.0 + Math.random() * 0.6).toFixed(2);
    html += `<span class="spark" style="--sx:${sx}%;--sy:${sy}%;--ssize:${size}px;--sdelay:${delay}s;--sdur:${dur}s;"></span>`;
  }
  dateChipSparkleEl.innerHTML = html;
  dateChipSparkleEl.classList.add("is-active");
  dateLabelEl.classList.add("is-sparkling");
  window.setTimeout(() => {
    dateChipSparkleEl.classList.remove("is-active");
    dateLabelEl.classList.remove("is-sparkling");
    dateChipSparkleEl.innerHTML = "";
  }, EFFECT_MS + 100);
}

function runCalendarOnboardingHint() {
  if (!calendarPanelEl || !dateLabelEl) return;
  // 2026-07-21 2차 피드백 — "5초는 나왔다 바로 사라지는 느낌"이라 10초로
  // 연장. localStorage 1회 제한은 완전히 제거해 앱을 켤 때마다 매번 재생.
  const openTimer = window.setTimeout(() => {
    if (calendarPanelOpen) return; // 이미 유저가 직접 열어둔 상태면 건드리지 않음
    toggleCalendarPanel();
    const closeTimer = window.setTimeout(() => {
      if (!calendarPanelOpen) return; // 유저가 이미 직접 닫은 경우 중복 토글 방지
      toggleCalendarPanel();
      sparkleDateChip();
    }, 10000);
    calendarOnboardingTimers.push(closeTimer);
  }, 1200);
  calendarOnboardingTimers.push(openTimer);
}

runCalendarOnboardingHint();

// 2026-07-21 2차 피드백 — 달력 위에서 좌우로 스와이프하면 전후달로 이동.
// .sky-room 전체에 이미 걸린 사진/문장 스와이프 리스너(위 skyRoom
// touchstart/touchend, movePhoto/moveQuote 호출)가 이 터치도 그대로 받아서
// 같이 동작해버리면 안 되므로, 확실한 가로 스와이프로 판정된 순간에만
// stopPropagation으로 그쪽 리스너 도달을 막는다 — 짧은 탭이나 세로 스와이프
// (페이지 전환 제스처)는 그대로 통과시켜 기존 동작을 건드리지 않는다.
if (calendarPanelEl) {
  let calendarSwipeStart = null;
  calendarPanelEl.addEventListener("touchstart", (event) => {
    const touch = event.touches[0];
    calendarSwipeStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }, { passive: true });
  calendarPanelEl.addEventListener("touchend", (event) => {
    if (!calendarSwipeStart) return;
    const touch = event.changedTouches[0];
    const start = calendarSwipeStart;
    calendarSwipeStart = null;
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const horizontalDominant = Math.abs(dx) > Math.abs(dy) * 1.2 && Math.abs(dx) > 40;
    if (!horizontalDominant) return;
    event.stopPropagation();
    shiftCalendarMonth(dx < 0 ? 1 : -1);
  }, { passive: true });
}

function setScene(sceneId, options = {}) {
  if (!scenes[sceneId] || (activeScene === sceneId && !options.force)) return;

  const scene = scenes[sceneId];
  activeScene = sceneId;
  app.dataset.scene = sceneId;
  const photo = pickScenePhoto(sceneId);
  const photoUrl = imageUrl(photo);
  app.classList.toggle("is-photo-ready", Boolean(photoUrl));
  if (photoUrl) {
    app.style.setProperty("--photo", `url("${photoUrl}")`);
    app.style.setProperty("--photo-position", photo?.photoPosition || "center center");
    // 2026-07-13: contain+블러 배경으로 여백을 채우는 방식을 두 차례
    // 시도했으나(무조건 contain → 크롭률 20% 임계값), 둘 다 선명한 사진과
    // 블러 배경 사이 경계가 "위/아래가 반복되는" 이음매로 보이는 문제가
    // 있었고, 유저가 명시적으로 "세로 길이 기준으로 채우고 가로 좌우를
    // 잘라내라"고 지시해 cover 고정으로 되돌렸다. 이음매 없는 화면이
    // 원본 전체를 보여주려다 생기는 부작용보다 우선한다는 판단.
    app.style.setProperty("--photo-size", photo?.photoSize || "cover");
  }
  renderPhotoCredit(photo);
  syncPhotoDots();

  renderWeather();

  if (options.syncDots) {
    syncPhotoDots();
  }
}

function renderWeather() {
  app.dataset.weather = weatherState.tag;
  setText("tempLabel", weatherState.temp);
  setText("weatherSummary", weatherState.summary);

  const icon = document.getElementById("weatherIcon");
  icon.className = `mini-weather ${weatherState.icon}`;

  // 2026-07-26: 위치 조회가 플레이스홀더 상태("위치 권한 필요"/"날씨 오류")일
  // 때만 메인 화면 재시도 버튼을 보여준다. WEATHER_SUMMARY_PLACEHOLDERS는
  // 이 함수보다 아래에서 선언되지만, 이 함수는 requestCurrentWeather()를 통해
  // 스크립트 파싱이 전부 끝난 뒤에만 호출되므로 참조 시점엔 문제 없다.
  if (mainWeatherRetryBtn) {
    mainWeatherRetryBtn.hidden = !weatherSummaryPlaceholders().includes(weatherState.summary);
  }
}

// 2026-07-20 9차 피드백(유저 질문+요청): "날씨 상세 페이지가 열 때마다
// '불러오는 중'으로 3초 걸리는데, 미리 불러와 둘 수 없나?" — 답은 "가능하고
// 안전하다"이다. fetchWeatherDetail()은 좌표+시간 기준 1시간 캐시가 이미
// 있어서(weatherDetailLastCoordsKey/weatherDetailLastFetchAt), 여기서 미리
// 한 번 불러두면 실제로 패널을 열 때는 그 캐시를 그대로 재사용해 API 호출이
// 또 나가지 않는다 — "미리 불러오기"가 "이중 호출"이 되지 않는다는 뜻.
// 비용 측면도 안전하다: weather-backend는 Visual Crossing 원본 호출 자체를
// D1에 4시간(CACHE_TTL_HOURS) 캐시해두므로, 이 프리페치가 늘리는 건 Cloudflare
// Worker 요청 수·D1 읽기(둘 다 사실상 무료 수준)뿐이고, 유료 API인 Visual
// Crossing 쪽 호출 빈도는 전혀 늘지 않는다 — 사용자가 몇 명이든 같은 4시간
// 캐시를 공유한다. 좌표가 아직 확정 안 된 시점(geolocation 대기 중)에
// 프리페치하면 기본 좌표로 한 번 낭비될 수 있으므로, userCoords가 실제로
// 정해지는 이 세 지점(권한없음/성공/거부) 각각에서 renderWeather() 직후에만
// 부른다 — 항상 그 시점 기준 "확정된" 좌표로 정확히 한 번만 프리페치된다.
// 2026-07-26: 메인 화면 재시도 버튼(mainWeatherRetryBtn)이 "지금 다시 시도해서
// 끝날 때까지" 버튼을 비활성화해둘 수 있도록 Promise를 반환하게 바꿨다 — 기존
// 세 호출부(앱 로드 시/10분 주기 타이머/포그라운드 복귀 시)는 반환값을 그냥
// 무시하므로 동작에 변화가 없다. 내부 로직(위치 확정 3분기)은 그대로다.
// 2026-08-04 이슈 제보(안드로이드 날씨 첫 로드 실패) — 늦은 위치 fix
// 자동 수신 장치. getCurrentPosition이 타임아웃으로 실패한 뒤에도 기기가
// 뒤늦게 위치를 잡으면(안드로이드 실기기에서 수십 초~수 분 뒤) 그 순간
// 자동으로 날씨를 다시 불러온다 — 유저가 '다시'를 누를 필요가 없다.
// fix 1회면 충분하므로 받자마자 watch를 해제한다.
let lateGeoWatchId = null;
function startLateGeoWatch() {
  if (lateGeoWatchId !== null || !navigator.geolocation) return;
  try {
    lateGeoWatchId = navigator.geolocation.watchPosition(
      () => {
        if (lateGeoWatchId !== null) {
          navigator.geolocation.clearWatch(lateGeoWatchId);
          lateGeoWatchId = null;
        }
        requestCurrentWeather();
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000 }
    );
  } catch (e) {
    lateGeoWatchId = null;
  }
}

function requestCurrentWeather() {
  if (!navigator.geolocation) {
    userCoords = DEFAULT_WEATHER_COORDS;
    weatherState = {
      location: t("weather.defaultLocation", null, "서울"),
      temp: "--°",
      summary: t("weather.permissionNeeded", null, "위치 권한 필요"),
      icon: "sun-icon",
      tag: "clear"
    };
    weatherResolved = true;
    renderWeather();
    fetchWeatherDetail();
    if (activeScene) setScene(activeScene, { syncDots: true, force: true });
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    // 2026-08-04 — 성공 콜백을 이름 있는 함수로 분리: 아래 onGeoError의
    // "캐시 좌표 즉시 사용" 폴백이 같은 경로를 그대로 재사용한다.
    const onCoords = async ({ coords }) => {
        try {
          const { latitude, longitude } = coords;
          userCoords = { lat: latitude, lng: longitude };
          // 2026-08-04 — 다음 실행에서 안드로이드 위치 타임아웃이 나도
          // 즉시 날씨를 그릴 수 있도록 마지막 성공 좌표를 기억해둔다.
          try { localStorage.setItem("ezlong:lastWeatherCoords", JSON.stringify(userCoords)); } catch (e) {}
          const location = await reverseGeocode(latitude, longitude);
          // 2026-07-21: 이 fetchWeatherJson 호출은 fetchWeatherDetail()이 바로
          // 뒤이어 다시 부르는 /api/weather/current와 같은 엔드포인트다 —
          // 중복 호출처럼 보이지만 비용상 문제 없다: 백엔드가 좌표를 1~2km
          // 격자로 반올림해 4시간 D1 캐시를 공유하므로, 바로 뒤따르는
          // fetchWeatherDetail()의 같은 호출은 이 요청이 방금 만들어둔 캐시를
          // 그대로 읽어 즉시 응답한다(Visual Crossing 쪽 실제 API 호출은
          // 늘지 않음). 대신 메인 한줄이 날씨상세 7종 호출 전체가 끝나기를
          // 기다리지 않고 훨씬 먼저(가장 가벼운 호출 하나만으로) 갱신된다.
          const weatherData = await fetchWeatherJson("/api/weather/current");
          const current = weatherData && weatherData.current;
          if (!current) throw new Error("현재 날씨 데이터 없음");

          const tag = vcCurrentTag(current);
          const isDay =
            typeof current.sunriseEpoch === "number" && typeof current.sunsetEpoch === "number"
              ? current.datetimeEpoch >= current.sunriseEpoch && current.datetimeEpoch < current.sunsetEpoch
              : true;
          weatherState = {
            location,
            temp: formatTemp(current.temp),
            summary: vcCurrentSummary(current),
            icon: weatherIconFor(tag, isDay),
            tag
          };
        } catch (error) {
          weatherState = {
            location: t("weather.currentLocation", null, "현재 위치"),
            temp: "--°",
            summary: t("weather.error", null, "날씨 오류"),
            icon: "sun-icon",
            tag: "clear"
          };
        }
        weatherResolved = true;
        renderWeather();
        fetchWeatherDetail();
        if (activeScene) setScene(activeScene, { syncDots: true, force: true });
        resolve();
    };
    const onGeoError = () => {
        // 2026-08-04 — 안드로이드 WebView는 첫 위치 fix가 느려 9초
        // 타임아웃에 자주 걸린다(iOS는 CoreLocation 캐시로 즉시). 지난번
        // 성공 좌표가 있으면 그걸로 즉시 그리고, 진짜 fix는 watch가
        // 늦게라도 받아 자동 갱신한다.
        startLateGeoWatch();
        let cached = null;
        try { cached = JSON.parse(localStorage.getItem("ezlong:lastWeatherCoords") || "null"); } catch (e) { cached = null; }
        if (cached && typeof cached.lat === "number" && typeof cached.lng === "number") {
          onCoords({ coords: { latitude: cached.lat, longitude: cached.lng } });
          return;
        }
        userCoords = DEFAULT_WEATHER_COORDS;
        weatherState = {
      location: t("weather.defaultLocation", null, "서울"),
      temp: "--°",
      summary: t("weather.permissionNeeded", null, "위치 권한 필요"),
      icon: "sun-icon",
      tag: "clear"
    };
        weatherResolved = true;
        renderWeather();
        fetchWeatherDetail();
        if (activeScene) setScene(activeScene, { syncDots: true, force: true });
        resolve();
    };
    // 2026-08-26 — 위치 권한 팝업이 정리되면 네이티브에 알린다.
    //
    // 유럽 사용자의 첫 실행에서 GDPR 동의 폼과 이 위치 권한 팝업이 한꺼번에
    // 겹쳐 떴다. iOS 시스템 권한 알림은 언제나 앱 화면 위에 뜨기 때문에,
    // 동의 폼이 그 밑에 깔려 반쯤 가려진 채로 보인다. 첫인상은 한 번뿐이다.
    //
    // 그래서 네이티브가 동의 폼을 이 신호까지 기다렸다가 띄운다. 허용이든
    // 거부든 상관없다 — "팝업이 화면에서 사라졌다"만 알리면 된다.
    // 신호가 영영 안 와도 네이티브 쪽에 타임아웃이 있어 폼은 반드시 뜬다.
    var geoToldNative = false;
    function tellNativeGeoSettled() {
      if (geoToldNative) return;
      geoToldNative = true;
      try { postToNativeAd({ action: "geoSettled" }); } catch (error) { /* 무시 */ }
    }
    navigator.geolocation.getCurrentPosition(
      function (position) { tellNativeGeoSettled(); onCoords(position); },
      function (error) { tellNativeGeoSettled(); onGeoError(error); },
      {
        enableHighAccuracy: false,
        timeout: 9000,
        maximumAge: 10 * 60 * 1000
      });
  });
}

async function loadBackgroundArchive() {
  try {
    const response = await fetch("data/background-manifest.json", { cache: "no-cache" });
    if (!response.ok) {
      backgroundArchiveLoaded = true;
      return;
    }
    const data = await response.json();
    backgroundArchive = Array.isArray(data.images) ? data.images : [];
    backgroundArchiveLoaded = true;
    if (activeScene) setScene(activeScene, { syncDots: true, force: true });
  } catch (error) {
    backgroundArchive = [];
    backgroundArchiveLoaded = true;
    if (activeScene) setScene(activeScene, { syncDots: true, force: true });
  }
}

// 2026-07-28 글로벌화 W3: accept-language 를 로케일에 맞춘다.
// ko 로 고정돼 있으면 영어 사용자에게 "런던"이 아니라 한글 지명이 뜬다 —
// 화면 전체가 영어인데 도시명만 한글이라 특히 눈에 띈다.
// 한국어에서는 여전히 "ko" 이므로 동작이 같다(FZ_REGION.geocodeLanguage).
async function reverseGeocode(latitude, longitude) {
  const lang = FZ_REGION && FZ_REGION.geocodeLanguage
    ? FZ_REGION.geocodeLanguage(FZ_LOCALE)
    : "ko";
  const fallbackName = t("weather.currentLocation", null, "현재 위치");
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=${lang}`;
    const response = await fetch(url);
    const data = await response.json();
    const address = data.address || {};
    return address.city || address.town || address.county || address.borough || address.village || fallbackName;
  } catch (error) {
    return fallbackName;
  }
}

function restartQuoteProgress() {
  quoteProgress.style.animation = "none";
  quoteProgress.offsetHeight;
  quoteProgress.style.animation = "";
}

// 2026-07-16: "가끔 알라딘 아이콘이 무반응"이 계속 재발한다는 재확인 —
// 기존 resyncAladinUiAfterForeground()로도 못 잡은 걸 보니, 백그라운드
// 타이머 유실보다 더 단순한 원인이 있을 수 있다고 보고 다시 살펴봤다.
// renderQuote()가 760ms 지연 콜백을 매번 새로 예약하는데, 만약 이 콜백이
// 아직 안 끝난 상태에서(예: 수동으로 관심분야/장르를 바꿔서
// applyFlatGenreSelection이 즉시 renderQuote를 다시
// 부르거나, 분(rotateQuote)이 마침 같은 타이밍에 겹치는 경우) renderQuote가
// 또 호출되면, 오래된 콜백이 나중에 실행되면서 최신 문장의 아이콘
// 상태(dataset.url/hidden)를 옛날 문장 기준으로 덮어써버릴 수 있다 —
// 그러면 화면엔 새 문장이 보이는데 아이콘은 그 전 문장 기준으로 멈춰있는
// 상태가 되고, 다음 문장이 바뀌기 전까지는 이 어긋난 상태가 그대로 유지된다.
// pendingQuoteTimeoutId로 이전 예약을 취소해서 항상 "가장 최근에 부른
// renderQuote"만 실제로 반영되게 막는다.
let pendingQuoteTimeoutId = null;
// 2026-07-22 유저 요청: 배경사진(점 탭/스와이프)은 즉시 바뀌는데 문장박스만
// 페이드아웃(760ms)→텍스트교체→페이드인으로 총 2초 넘게 걸려 "왜 문장만
// 느리냐"는 지적. 가만히 뒀을 때 1분마다 자동으로 넘어가는 경우엔 이 서서히
// 나타나는 느낌이 오히려 편안해서 그대로 두되, 유저가 직접 스와이프/점탭으로
// 넘길 때만(selectQuoteIndex) immediate=true를 넘겨 지연/페이드를 건너뛰고
// 배경사진처럼 즉시 반영한다.
function renderQuote(index, immediate = false) {
  const quote = index;
  lastRenderedQuote = quote;
  if (pendingQuoteTimeoutId !== null) {
    window.clearTimeout(pendingQuoteTimeoutId);
    pendingQuoteTimeoutId = null;
  }

  const applyQuote = () => {
    // 2026-07-20 유저 요청: 영어 원문은 원래 "한글만 있으면 짧아서 허전해
    // 보이는 문장"에 멋을 더하려고 넣은 부가 요소였는데, 원문이 길면 오히려
    // 총 글자수가 늘어나 quote-long/quote-dense 폰트 축소가 세게 걸려서 한글
    // 본문까지 잘 안 보이게 되는 역효과가 났다. 원문이 120자(공백 포함)를
    // 넘으면 아예 보여주지 않는다(지시가 30자→60자→110자→120자로 재조정
    // 됨) — JS의 .length는 원래 공백도 포함해서 세므로 별도 처리 불필요.
    // has-english 클래스가 꺼지며 CSS(.quote-panel .quote-english
    // { display:none })가 박스 자체를 접어주고, 길이 계산(textLength)에서도
    // 빠지므로 폰트 축소 판정에 영향을 주지 않는다.
    // ─────────────────────────────────────────────────────────
    // 2026-07-28 글로벌화 W8 — 영어 화면에서는 영어만 보여준다
    // ─────────────────────────────────────────────────────────
    // 한국어 화면은 "영어 원문(작게) + 한국어 번역(크게)" 두 줄 구성이다.
    // 이 구조를 영어 사용자에게 그대로 내보내면 읽지도 못하는 한국어가
    // 본문 자리를 차지한다 — 실제로 시뮬레이터 촬영에서 그렇게 나왔다.
    // 영어 화면에서는 영어 원문을 **본문 자리로 올리고** 번역 줄을 비운다.
    //
    // 원문이 없는 문장(한국 원서 등)은 영어 화면에 내보낼 수 없다 —
    // 지금은 표시 단계에서만 걸러 한국어를 그대로 두지만, 애초에 그런
    // 문장이 뽑히지 않게 하는 **문장 풀 필터링이 다음 과제**다.
    const rawEnglish = quote.english || "";
    const koMode = isKoreanLocale();
    // 일본어 등 번역이 준비된 언어면 번역문을 가져온다. 없으면 null.
    const translated = koMode ? null : lookupQuoteTranslation(rawEnglish);

    let englishText, bodyText;
    if (koMode) {
      // ★ 한국어는 예전과 완전히 동일 ★ 120자 초과 원문 숨김 규칙 포함
      // 2026-08-05 이슈 제보(아이폰 문장박스가 비주얼라이저와 겹침) —
      // 기존 규칙은 **영어 원문 길이만** 봤다. 그런데 실제로 박스를 넘치게
      // 만드는 건 두 줄의 합이다. 원문이 84자로 짧아도 한국어 본문이 118자면
      // 합쳐서 박스를 넘긴다(제보된 그 문장이 정확히 그랬다).
      // 그래서 한국어 본문이 이미 긴 경우(95자 초과)에도 원문을 접는다 —
      // 본문이 주인공이고 원문은 곁들이는 멋이니, 둘 중 하나를 접어야 한다면
      // 접을 것은 원문 쪽이다.
      const koBodyLen = (quote.text || "").length;
      englishText = (rawEnglish.length > 120 || koBodyLen > 95) ? "" : rawEnglish;
      bodyText = quote.text;
    } else if (translated) {
      // 번역이 있는 언어 — 한국어 화면과 같은 두 줄 구성으로 돌려놓는다.
      // 위에 영어 원문(작게), 아래에 그 언어 번역(크게). 원래 이 디자인이
      // "원문의 울림 + 읽을 수 있는 뜻"을 같이 주려던 것이었으므로, 번역이
      // 생긴 순간 영어권 말고는 다 이 구성으로 돌아오는 것이 맞다.
      // 120자 초과 원문을 접는 규칙도 한국어와 똑같이 적용한다.
      englishText = rawEnglish.length > 120 ? "" : rawEnglish;
      bodyText = translated.text;
    } else if (rawEnglish) {
      englishText = "";              // 위 작은 줄은 비우고
      bodyText = rawEnglish;         // 원문을 본문 자리로 올린다
    } else {
      // 원문이 없는 문장 — 빈 화면보다는 한국어라도 보여준다
      englishText = "";
      bodyText = quote.text;
    }

    const textLength = bodyText.length + Math.floor(englishText.length * 0.55);
    quotePanel.classList.toggle("quote-long", textLength > 115);
    quotePanel.classList.toggle("quote-dense", textLength > 190);
    quotePanel.classList.toggle("has-english", Boolean(englishText));
    setText("quoteEnglish", englishText);
    setText("quoteText", bodyText);
    setText("quoteSource", formatQuoteSource(quote, koMode, translated));
    updateAladinLinkButton(quote);
    quotePanel.classList.remove("is-changing");
    restartQuoteProgress();
  };

  if (immediate) {
    // 배경사진 점탭/스와이프와 동일하게 페이드 없이 바로 반영.
    applyQuote();
    return;
  }

  quotePanel.classList.add("is-changing");
  pendingQuoteTimeoutId = window.setTimeout(() => {
    pendingQuoteTimeoutId = null;
    applyQuote();
  }, 760);
}

/**
 * 문장 아래 출처 한 줄. 2026-07-28 글로벌화 W8 신설.
 *
 * 한국어: `<현명한 투자자> 벤저민 그레이엄` — 예전과 글자 그대로 같다.
 * 영어  : `<The Intelligent Investor> Benjamin Graham`
 *
 * 영문 서지정보는 i18n/book-titles.js(data/book-i18n-map.json 에서 구움)에서
 * 찾는다. 없으면 한국어 표기를 그대로 쓴다 — 출처를 아예 안 보여주는 것보다
 * 낫고, 어느 책인지 못 찾는 상황을 화면에서 드러내 보완 대상을 알려준다.
 */
/**
 * 출처 한 줄을 만든다. `<책제목> 저자` 형태.
 *
 * 2026-07-29 — 책이 아닌 출처를 위해 "제목 없음"을 정식으로 지원한다.
 * 계기: 데이터에 『존 템플턴의 투자 격언』이라는 제목이 있었는데, 그런
 * 책은 한국에도 일본에도 없다. 템플턴이 남긴 것은 칼럼("투자자를 위한
 * 22가지 지침")과 여러 자리에서의 발언이지 단행본이 아니다.
 *
 * 이런 경우 억지로 책 제목을 만들어 넣으면 검색해도 안 나오는 책이 되고,
 * 그 순간 앱이 출처를 확인하지 않았다는 사실이 독자에게 드러난다.
 * title 이 비어 있으면 꺾쇠 없이 저자만 적는다 — 없는 책을 지어내는 것보다
 * "누가 한 말인지만 밝히는" 편이 정직하다.
 */
// 2026-08-10 운영 지침 — "책제목과 저자 이름은 원어명을 굳이 쓰지 않아도
// 된다. <행운에 속지마라> 나심 니콜라스 탈레브 처럼 심플하게. 다른 나라
// 언어도 마찬가지다. 굳이 원어 제목과 이름을 써서 복잡해 보이게 만들지 마라."
//
// 문장 데이터의 제목은 오래전부터 "행운에 속지 마라 (Fooled by Randomness)"
// 처럼 원어를 괄호로 달고 있었다. 데이터 자체를 고치면 될 것 같지만 그러면
// 안 된다 — 알라딘 링크(aladin-links.js)와 영문 서지(book-titles.js)가 이
// 문자열을 **열쇠 그대로** 쓰고 있어서, 한 글자만 바꿔도 그 책의 서점 버튼이
// 통째로 사라진다. 그래서 데이터는 그대로 두고 **보여줄 때만** 한 언어로
// 추린다. 열쇠와 표시를 분리하는 것이 이 경우의 정석이다.
//
// 규칙은 단순하다. 뒤에 붙은 괄호 한 덩어리만 보고, 괄호 밖과 안이 서로 다른
// 문자 체계일 때만 화면 언어에 맞는 쪽을 남긴다.
//   "행운에 속지 마라 (Fooled by Randomness)" → 한국어 화면: 행운에 속지 마라
//                                              영어 화면: Fooled by Randomness
//   "Poor Charlie's Almanack (푸어 찰리스 알마낙)" → 한국어 화면: 푸어 찰리스 알마낙
// 같은 문자 체계면 그건 원어 병기가 아니라 부제·판본이므로 건드리지 않는다.
//   "버크셔 해서웨이 주주 서한 (1989년)"  "The Life Before Us (Madame Rosa)"
// 괄호 안에 라틴 문자가 없으면(예: "곰돌이 푸의 도(道)") 원어 병기로 보지
// 않는다 — 제목의 일부다.
function simplifyBibliography(text, preferKo) {
  const raw = String(text == null ? "" : text).trim();
  if (!raw) return raw;
  const m = raw.match(/^(.*?)\s*[（(]([^（()）]+)[)）]\s*$/);
  if (!m) return raw;
  const outside = (m[1] || "").trim();
  const inside = (m[2] || "").trim();
  if (!outside || !inside) return raw;
  const HANGUL = /[가-힣]/;
  const LATIN = /[A-Za-z]{2,}/;
  const outKo = HANGUL.test(outside);
  const inKo = HANGUL.test(inside);
  const inLat = LATIN.test(inside);
  if (preferKo) {
    if (outKo && inLat && !inKo) return outside;
    if (!outKo && inKo) return inside;
    return raw;
  }
  if (outKo && inLat && !inKo) return inside;
  if (!outKo && inKo) return outside;
  return raw;
}

function formatQuoteSource(quote, koMode, translated) {
  const author = simplifyBibliography(quote.author || "", koMode);
  // 2026-08-23 운영자: 수면 격언 등 authorEn 이 있으면 비한국어 화면엔 영어 출처.
  if (!koMode && quote.authorEn) return simplifyBibliography(quote.authorEn, false);
  // 번역된 서지가 있으면 그쪽이 우선이다. 본문은 일본어인데 출처만 영어면
  // 화면 안에서 언어가 갈린다 — 실제로 영어 서지로 먼저 붙였다가 그렇게 됐다.
  if (!koMode && translated && (translated.title || translated.author)) {
    const t = simplifyBibliography(translated.title || "", false);
    const a = simplifyBibliography(translated.author || author, false);
    return t ? `<${t}> ${a}` : a;
  }
  if (!koMode && FZ_BOOK_TITLES && FZ_BOOK_TITLES.lookup) {
    // 열쇠는 원본 제목 그대로 넘긴다(quote.title) — 추린 제목으로 찾으면 못 찾는다.
    const en = FZ_BOOK_TITLES.lookup(quote.title);
    if (en && en.t) {
      return `<${simplifyBibliography(en.t, false)}> ${simplifyBibliography(en.a || author, false)}`;
    }
  }
  const title = simplifyBibliography(quote.title || "", koMode);
  if (!title) return author;
  return `<${title}> ${author}`;
}

// 2026-07-16: 현재 문장의 책이 알라딘과 매칭됐으면 아이콘을 보여주고 링크를
// data-url에 저장, 매칭이 안 됐으면 숨긴다. aladin-links.js 로드 실패/누락
// 시에도(window.aladinLinks === undefined) 에러 없이 그냥 숨김 처리한다.
//
// 2026-08-09 운영 지침로 확장 — 비한국어 로케일에서도 이 버튼을 띄운다.
// 그전까지는 한국어에만 알라딘 버튼이 떴고, 다른 언어에서는 아마존 링크가
// "복사본 마지막 줄"에만 들어갔다. 즉 링크는 있는데 화면에서 갈 길이 없었다.
// 어느 서점이냐는 quote-source 모듈이 로케일을 보고 정한다(한국어→알라딘,
// 그 밖의 모든 언어→아마존 검색).
//
// 한국어까지 이 모듈에 맡겨도 되는지는 실측으로 확인했다 — 라이브에서 문장
// 1,202개를 전수 비교했더니 예전 직접조회(aladinLinks[제목|저자])와 resolve()
// 가 1,092건 전부 같은 URL 이었고, 한쪽에만 링크가 있는 경우는 0건이었다.
// 그래서 두 경로를 하나로 합친다. 버튼이 여는 주소와 복사본에 담기는 주소가
// 같은 함수에서 나오므로 앞으로 둘이 어긋날 일도 없다.
// 아마존 검색어를 만든다. 순서에 이유가 있다.
//
//   1) 표시 언어의 번역 서지. 일본 이용자를 amazon.co.jp 로 보내면서 영어
//      제목으로 검색시키면 정작 일본어판을 못 찾는다. 화면에 보이는 그
//      제목으로 찾게 하는 것이 맞다.
//   2) 영문 서지(book-titles). 번역이 없는 책의 표준 경로다. 각국 아마존은
//      원서도 같이 팔기 때문에 결과가 나온다.
//   3) 둘 다 없으면 빈 문자열. 그러면 quote-source 가 한국어 제목을 보고
//      스스로 링크를 포기한다(한글 검색어를 아마존에 던져봐야 안 나온다).
//
// zh 만 1번을 건너뛴다. 아마존 중국은 도서를 접어서 중국어권 이용자는
// amazon.com 으로 가는데, 거기에 중국어 제목을 넣으면 결과가 비어버린다.
function quoteAmazonQuery(quote) {
  if (!quote) return "";
  if (FZ_LOCALE !== "zh") {
    try {
      const translated = lookupQuoteTranslation(quote.english || "");
      if (translated && translated.title) {
        return `${translated.title} ${translated.author || ""}`.trim();
      }
    } catch (error) { /* 무시 */ }
  }
  try {
    if (FZ_BOOK_TITLES && FZ_BOOK_TITLES.lookup) {
      const en = FZ_BOOK_TITLES.lookup(quote.title);
      if (en && en.t) return `${en.t} ${en.a || ""}`.trim();
    }
  } catch (error) { /* 무시 */ }
  return "";
}

// 버튼과 복사본이 같은 주소를 쓰도록, 링크 결정은 이 함수 하나만 거친다.
// 예전에는 버튼이 aladinLinks 를 직접 뒤지고 복사본은 quote-source 를 부르는
// 두 갈래였다 — 둘이 어긋나면 아무도 눈치채지 못한다.
function resolveQuoteBookLink(quote) {
  if (!quote) return null;
  try {
    if (FZ_QUOTE_SRC && typeof FZ_QUOTE_SRC.resolve === "function") {
      const opts = {};
      if (!isKoreanLocale()) {
        const query = quoteAmazonQuery(quote);
        if (query) opts.amazonQuery = query;
      }
      return FZ_QUOTE_SRC.resolve(quote, opts);
    }
    // 모듈 로드가 실패했을 때의 안전망 — 한국어만이라도 예전처럼 동작시킨다.
    if (isKoreanLocale()) {
      const legacy = (window.aladinLinks || {})[`${quote.title}|${quote.author}`];
      if (legacy) return { kind: "aladin", url: legacy, labelKey: "quote.buyOnAladin" };
    }
  } catch (error) { /* 링크 하나 때문에 문장이 안 뜨는 일은 없어야 한다 */ }
  return null;
}

function updateAladinLinkButton(quote) {
  if (!quoteAladinLink) return;

  const link = resolveQuoteBookLink(quote);

  if (link && link.url) {
    const store = link.kind || "aladin";
    const labelKey = link.labelKey || (store === "amazon" ? "quote.buyOnAmazon" : "quote.buyOnAladin");
    quoteAladinLink.dataset.url = link.url;
    quoteAladinLink.dataset.store = store;
    // 아리아 라벨은 서점에 따라 갈린다. data-i18n-aria 속성까지 갈아끼우는
    // 이유는, 언어를 바꾸면 i18n 적용기가 이 속성을 다시 읽어 라벨을 덮어쓰기
    // 때문이다 — 속성을 그대로 두면 아마존 버튼에 "알라딘에서 이 책 보기"가
    // 도로 붙는다.
    quoteAladinLink.setAttribute("data-i18n-aria", labelKey);
    quoteAladinLink.setAttribute("aria-label", t(labelKey, null, quoteAladinLink.getAttribute("aria-label") || ""));
    quoteAladinLink.hidden = false;
  } else {
    delete quoteAladinLink.dataset.url;
    delete quoteAladinLink.dataset.store;
    quoteAladinLink.hidden = true;
  }
}

function shuffleQuotes(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

// 2026-07-15: "2030 여성 독자층" 큐레이션 도서(문학·에세이·교양 장르에 한정,
// 투자서는 절대 대상 아님) 노출 가산점 — quote.priority === true인 문장을
// 덱을 새로 채울 때 PRIORITY_WEIGHT배만큼 더 넣어서, 같은 덱 한 바퀴 안에서
// 더 자주 뽑히도록 한다. genre !== "literature"이면 priority 필드가 있어도
// 무시한다(투자서는 절대 가중치 대상이 아니라는 운영 지침를 코드로도 강제).
const PRIORITY_WEIGHT = 3;

function buildWeightedDeckSource(items) {
  const pool = [];
  items.forEach((quote) => {
    const isWeighted = quote.genre === "literature" && quote.priority === true;
    const copies = isWeighted ? PRIORITY_WEIGHT : 1;
    for (let i = 0; i < copies; i += 1) pool.push(quote);
  });
  return pool;
}

function getNextQuote() {
  const eligibleQuotes = getEligibleQuotes();
  if (quoteDeck.length === 0) {
    quoteDeck = shuffleQuotes(buildWeightedDeckSource(eligibleQuotes));
  }

  if (quoteDeck.length > 1 && quoteDeck[0].title === lastQuoteTitle) {
    const alternativeIndex = quoteDeck.findIndex((quote) => quote.title !== lastQuoteTitle);
    if (alternativeIndex > 0) {
      [quoteDeck[0], quoteDeck[alternativeIndex]] = [quoteDeck[alternativeIndex], quoteDeck[0]];
    }
  }

  const quote = quoteDeck.shift();
  lastQuoteTitle = quote.title;
  return quote;
}

// 2026-07-20 유저 요청: 배경 사진(점 4개)과 똑같은 방식으로 문장도 4개를
// 미리 불러와 스와이프/점탭으로 수동 이동할 수 있게 한다. quoteWindow가
// activePhotoSet과 동격, activeQuoteIndex가 activePhotoIndex와 동격이다.
// 다른 점은 자동 전환 주기 — 사진은 15분마다, 문장은 1분마다(rotateQuote)
// 자동으로 한 칸씩 전진하므로 두 인덱스는 각자의 시계로 따로 움직이고,
// 스와이프나 점탭처럼 "수동 조작이 실제로 일어나는 그 순간"에만 두
// 인덱스를 같은 방향으로 함께 옮겨 짝을 맞춘다.
// 2026-08-23 운영자: 밤(현지 22~05시)엔 문장 4개 세트 중 2개를 '수면 격언'으로.
// 투자자에게 잠의 중요성을 상기시킨다. 수면 격언은 sleep-quotes.js의 별도 풀이라
// 낮/설정 주제 필터에는 전혀 섞이지 않고, 밤에만 이 경로로 끼어든다.
// 비한국어 화면엔 넣지 않는다(한국어가 본문 자리에 새지 않도록).
const sleepQuotes = (typeof window !== "undefined" && window.sleepQuotes) || [];
let sleepDeck = [];
let lastSleepEnglish = "";
function getNextSleepQuote() {
  if (!sleepQuotes.length) return getNextQuote();   // 안전망
  if (sleepDeck.length === 0) sleepDeck = shuffleQuotes(sleepQuotes.slice());
  if (sleepDeck.length > 1 && sleepDeck[0].english === lastSleepEnglish) {
    const alt = sleepDeck.findIndex((q) => q.english !== lastSleepEnglish);
    if (alt > 0) { const tmp = sleepDeck[0]; sleepDeck[0] = sleepDeck[alt]; sleepDeck[alt] = tmp; }
  }
  const q = sleepDeck.shift();
  lastSleepEnglish = q.english || "";
  return q;
}
function sleepInjectNow() {
  if (!sleepQuotes.length) return false;
  // 2026-08-23 운영자: 모든 로케일에서 현지 밤 시간(22~05시)에 노출한다.
  const h = new Date().getHours();
  return (h >= 22 || h < 5);   // 현지 22:00 ~ 04:59
}
// 문장 4개 창을 만든다. 밤이면 [수면, 일반, 수면, 일반]으로 2개를 수면 격언에 배정.
function buildQuoteWindow() {
  if (sleepInjectNow()) {
    return [getNextSleepQuote(), getNextQuote(), getNextSleepQuote(), getNextQuote()];
  }
  return [getNextQuote(), getNextQuote(), getNextQuote(), getNextQuote()];
}

function ensureQuoteWindow() {
  if (quoteWindow.length === 4) return;
  quoteWindow = buildQuoteWindow();
  activeQuoteIndex = 0;
}

// 2026-07-21 유저 재지적으로 수정: 예전엔 오른쪽으로 index가 창(0~3)을
// 벗어나는 순간 곧바로 새 4개를 뽑아버려서, 스와이프를 연달아 하면
// "문장이 수만 가지"인 것처럼 계속 새로 나오고, 왼쪽으로 한 번 갔다가
// 다시 오른쪽으로 가도 방금 본 문장으로 못 돌아왔다("아껴서 보여줄
// 필요가 있다"는 운영 피드백 그대로 재발). 이제 수동 이동(스와이프/점탭)은
// 사진 점(selectPhotoIndex)과 완전히 동일하게 "이미 불러온 4개 안에서만"
// 양방향 순환한다 — 새 4개를 뽑는 건 아래 advanceQuoteAuto()(1분마다
// 자동 전진, 4개를 다 지나면 그때만 새로 리필)에서만 일어난다.
function selectQuoteIndex(index) {
  ensureQuoteWindow();
  const length = quoteWindow.length;
  if (length === 0) return;
  postToNativeHaptic("selection");
  activeQuoteIndex = ((index % length) + length) % length;
  // 같은 분(minute) 안에서 자동 전환(rotateQuote)이 곧바로 또 겹쳐
  // 발동하지 않도록, 수동 이동 시점도 "이번 분은 이미 처리됐다"로 표시.
  activeQuoteMinute = Math.floor(Date.now() / 60000);
  renderQuote(quoteWindow[activeQuoteIndex], true);
}

function moveQuote(direction) {
  selectQuoteIndex(activeQuoteIndex + direction);
}

// 2026-07-21 신설: 1분마다 도는 자동 전진(rotateQuote) 전용 — 수동 스와이프와
// 달리 이쪽은 "시간이 지나면 결국 새 문장으로" 요청이 살아있어야 하므로,
// 창을 한 바퀴(4개) 다 보여준 뒤에는 새 4개로 리필하는 예전 동작을
// 그대로 유지한다. 유저가 손대지 않고 놔뒀을 때만 이 경로가 쓰인다.
function advanceQuoteAuto() {
  ensureQuoteWindow();
  const length = quoteWindow.length;
  if (length === 0) return;
  let nextIndex = activeQuoteIndex + 1;
  if (nextIndex >= length) {
    quoteWindow = buildQuoteWindow();
    nextIndex = 0;
  }
  activeQuoteIndex = nextIndex;
  activeQuoteMinute = Math.floor(Date.now() / 60000);
  renderQuote(quoteWindow[activeQuoteIndex]);
}

// 카테고리/장르 설정을 바꿔 즉시 미리보기할 때 쓰던 기존
// "quoteDeck=[]; lastQuoteTitle=''; renderQuote(getNextQuote());" 3줄
// 패턴을 창 모델에 맞게 대체 — 덱과 창을 모두 비우고 새로 4개를 채운
// 뒤 첫 번째를 보여준다.
function resetQuoteWindow() {
  quoteDeck = [];
  lastQuoteTitle = "";
  quoteWindow = [];
  ensureQuoteWindow();
  activeQuoteMinute = Math.floor(Date.now() / 60000);
  renderQuote(quoteWindow[activeQuoteIndex]);
}

// 2026-07-22 재설계: 투자서/문학·교양서 1depth + 각자의 세부 카테고리
// 2단 구조를 없애고, 평평한 단일 목록(flatGenreLabels) 하나로 필터링한다.
// "비어있으면 전체 통과, 아니면 선택된 것만" 규칙은 기존과 동일하게 유지.
// 2026-07-28 글로벌화 W8-b — 영어 화면의 문장 "풀" 자체를 거른다.
//
// W8 에서 렌더 단계는 이미 고쳤다: 영어 화면이면 english 원문을 본문
// 자리로 올리고, 없으면 quote.text(한국어)로 떨어진다. 그런데 그 폴백은
// 영어 사용자에게 **읽을 수 없는 한국어 한 판**이다 — 1,109개 중 202개
// (18%)가 여기 해당한다(류시화·이기주·장영희 등 한국 저자, 일본서의
// 한국어 번역본 등 애초에 영문 원문이 존재하지 않는 책들).
//
// 그래서 뽑기 단계에서 아예 제외한다. 남는 907개는 그레이엄·버핏·멍거
// 같은 영문 원전이라 영어권 사용자에게 오히려 더 잘 맞는다.
//
// ★ 한국어 화면은 이 게이트를 통과하지 않는다 ★ — koMode 일 때는 예전
// 필터식 그대로라, 운영자가 보시는 화면의 문장 풀은 1,109개 전부 유지된다.
// 2026-07-29 운영자 확정 — **비한국어 화면은 투자서 문장만 내보낸다.**
// 문학·시·에세이·인문역사 같은 분야는 한국어 화면 전용이다. 이유가 둘이다.
//   1. 그 분야 문장은 한국 독자를 향해 고른 것이라, 번역 없이 영문 원문만
//      던지면 맥락이 통째로 빠진다(투자서는 애초에 영문 원전이 대부분이라
//      원문 그대로가 오히려 정직하다).
//   2. 투자서만 남으므로 설정의 '문장의 분야' 선택 UI 자체가 의미를 잃는다 —
//      그래서 비한국어에서는 그 섹션을 감춘다(applyKoreaOnlyGating 아님,
//      언어 기준이다. renderQuoteTopicsSection 참조).
//
// ★ selectedFlatGenres 를 비한국어에서는 아예 보지 않는다 ★
// 예전에 한국어로 쓰다가 기기 언어를 바꾸면 저장된 선택값에 문학 분야가
// 남아있을 수 있다. 그 값에 의존하면 "설정에서 못 고치는데 문학이 나오는"
// 상태가 된다 — 언어로만 판정해서 그 함정을 없앤다.
/**
 * 설정의 '문장의 분야' 섹션을 로케일로 게이팅한다.
 *
 * ★ 좌표가 아니라 '언어'로 판정한다 ★ — applyKoreaOnlyGating()(기상특보·
 * 미세먼지·평년비교)과 판정 기준이 다르다. 저쪽은 한국 기상청 데이터라
 * "한국에 있는가"가 기준이고, 이쪽은 문장 풀 구성이라 "한국어로 읽는가"가
 * 기준이다. 한국에 사는 일본어 사용자에게 문학 분야를 열어줄 이유가 없다.
 *
 * 섹션을 감추기만 하고 저장된 선택값(selectedFlatGenres)은 건드리지 않는다 —
 * 기기 언어를 한국어로 되돌리면 예전에 고른 분야가 그대로 살아나야 한다.
 */
function applyQuoteTopicsLocaleGating() {
  const section = document.getElementById("quoteTopicsSection");
  if (!section) return;
  section.hidden = !isKoreanLocale();
}

function getEligibleQuotes() {
  const koMode = isKoreanLocale();
  const filtered = quotes.filter((quote) => {
    const key = getQuoteFlatGenreKey(quote);
    if (!koMode) {
      if (key !== "investment") return false;
      if (!(quote.english && String(quote.english).trim())) return false;
      return true;
    }
    if (selectedFlatGenres.size > 0 && !selectedFlatGenres.has(key)) return false;
    return true;
  });
  // 안전망: 뽑을 문장이 하나도 없어 문장 박스가 비어버리는 일은 없어야 한다.
  // 비한국어에서 영문 원문 조건까지 걸었다가 0개가 되면, 투자서라는 조건만
  // 남기고 영문 게이트를 푼다(빈 화면보다 낫다).
  if (!koMode && filtered.length === 0) {
    return quotes.filter((quote) => getQuoteFlatGenreKey(quote) === "investment");
  }
  return filtered;
}

function renderFlatGenreOptions() {
  if (!flatGenreOptionsEl) return;
  flatGenreOptionsEl.innerHTML = "";
  Object.keys(flatGenreCatalogKeys).forEach((value) => {
    const label = flatGenreLabel(value);
    const option = document.createElement("label");
    option.className = "field-option";
    option.innerHTML = `<input type="checkbox" value="${value}" data-flat-genre-option><span>${label}</span>`;
    flatGenreOptionsEl.appendChild(option);
  });
}

function syncFlatGenreControls() {
  document.querySelectorAll("[data-flat-genre-option]").forEach((input) => {
    input.checked = selectedFlatGenres.has(input.value);
  });
  if (allFlatGenresEl) allFlatGenresEl.checked = selectedFlatGenres.size === 0;
}

function loadSavedFlatGenres() {
  try {
    const saved = JSON.parse(localStorage.getItem(flatGenreStorageKey) || "[\"investment\"]");
    if (Array.isArray(saved)) {
      selectedFlatGenres = new Set(
        saved.filter((value) => Object.prototype.hasOwnProperty.call(flatGenreCatalogKeys, value))
      );
    }
  } catch (error) {
    selectedFlatGenres = new Set(["investment"]);
  }
  syncFlatGenreControls();
  quoteDeck = [];
}

function saveSelectedFlatGenres() {
  localStorage.setItem(flatGenreStorageKey, JSON.stringify([...selectedFlatGenres]));
}

// 2026-07-19 3차 피드백: "확인" 버튼은 원래 흰색이지만, 아직 저장 안 된
// 분야 선택 변경이 있으면 하늘색(파란색)으로 바뀌어 "지금 누르면 반영된다"는
// 걸 알려준다. 2026-07-25 유저 요청으로 범위 확장 — 문장의 분야뿐 아니라
// 설정 패널 안의 다른 변경(배경사진 토글, 음악 제외 토글, 플레이리스트/
// Special 선택, 비주얼라이저 옵션)도 즉시 저장되긴 하지만, 똑같이 이
// 버튼을 파란색으로 바꿔 "방금 뭔가 바꿨다"는 걸 일관되게 알려준다
// (각 change 리스너에서 markSettingsDirty() 호출 — 아래 grep 참조:
// applyFlatGenreSelection/applyMusicPlaylistFilter/setMusicVizOption/
// MUSIC_EXCLUDABLE_CATEGORIES 리스너/bgFilterWeatherEl·bgFilterTimeEl 리스너).
function markSettingsDirty() {
  if (settingsSave) settingsSave.classList.add("is-dirty");
}

function clearSettingsDirty() {
  if (settingsSave) settingsSave.classList.remove("is-dirty");
}

// 2026-07-16 4차 개정 — 이 자리에 있던 lockScrollSnap/unlockScrollSnap(html에
// scroll-snap-type:none, 나중엔 overflow:hidden까지 토글하던 방식, 1~3차
// 개정)을 완전히 제거했다. 3차(overflow:hidden)까지 갔는데도 유저 실기기
// 재확인 결과 기존 증상은 그대로였고, 오히려 멀쩡하던 "ezlong.com 텍스트 탭
// → 플립 전환"까지 새로 멈춰버렸다 — html의 scroll-snap 상태를 프로그램적으로
// 건드리는 접근 자체가 이 페이지의 이미 복잡한 스냅/perspective 구조와
// 얽혀 부작용을 낳는 것으로 결론짓는다. 이번엔 html은 전혀 건드리지 않고,
// 실제 누수 지점(스크롤할 내용이 없는 .settings-backdrop 위에서 시작된
// 터치가 그대로 배경 문서로 흘러가는 것)을 touchmove에서 직접
// preventDefault로 끊는다 — 아래 setupModalBackdropScrollGuard() 참조.
// 이제 openSettings/closeSettings는 다시 순수하게 패널 열고 닫는 일만 한다.

// 2026-07-17 8차 개정(근본 재설계): 6~7차까지의 lockOuterScroll/
// unlockOuterScroll(html에 overflow:hidden을 토글하는 방식)을 완전히
// 제거했다. 이제 html/body는 styles.css에서 영구적으로 overflow:hidden
// 이라 토글할 대상 자체가 없다 — 문서가 애초에 스크롤되지 않으므로 모달이
// 열려있든 아니든 상관없다. 페이지 전환은 아래 pageTrack 관련 코드가
// 전담한다.

// 2026-07-17 10차 개정: position:fixed 팝업(.is-open 클래스 + opacity 토글)
// 방식을 걷어내고, #quoteSettings 자체가 #pageTrack 안의 2번 페이지가
// 됐으므로 goToPage(2)/goToPage(0) 호출로 전환한다. is-open/aria-hidden
// 토글은 접근성 트리 힌트로 남겨두되(해가 없음), 실제 화면 전환은
// goToPage()가 전담한다.
// 2026-07-17 13차: #quoteSettings가 #pageTrack 밖으로 나가면서 goToPage()
// 호출은 더 이상 필요 없다(그 페이지 전환 트랙과 무관해졌다) — is-open
// 클래스 토글만으로 표시/숨김이 전부 처리된다(styles.css .app-page.is-open).
// 2026-07-18 15차-c(핵심 — 제거 금지): 열 때마다 body에 appendChild로
// "재부착"한다. 이미 body 자식이라 위치는 그대로지만, appendChild는
// DOM에서 떼었다 다시 붙이는 동작이라 WebKit이 이 요소의 렌더 노드를
// 새로 만든다 — 이때 터치 스크롤 영역(네이티브 스크롤러)도 새로
// 등록된다. 이 iOS(26.5)에서는 display:none→block 토글만으로 나타난
// 요소의 터치 스크롤 등록이 누락되는 현상이 실기기 계측으로 확인됐다
// (진단 v6: 제스처 35회 전부 스크롤 0px vs 진단 v5: 열린 상태에서
// appendChild로 이동시키자 즉시 827px 완주 — 유일한 차이가 재부착).
// 2026-08-04 운영 요청 — 음악 플레이어의 톱니로 들어오면 설정 맨 위가
// 아니라 음악 섹션으로 바로 데려다준다("음악 설정하려고 눌렀는데 못
// 찾는다"). focusSection 인자가 없으면 기존과 완전히 동일하게 동작한다.
function openSettings(focusSection) {
  settingsPanel.classList.add("is-open");
  try { if (window.__flipzenReportAdLayout) window.__flipzenReportAdLayout(); } catch (e) { /* 무시 */ }
  try { if (window.__flipzenAlarmRefresh) window.__flipzenAlarmRefresh(); } catch (e) { /* 무시 */ }
  // 2026-08-04 2차 — 시트를 열 때마다 '앱을 열면 보일 화면'을 저장값으로
  // 다시 그린다. HTML에 checked가 박혀 있어서, 어떤 이유로든 초기 배선이
  // 실패하면 저장값과 무관하게 늘 기본값으로 보이는 착시가 생긴다.
  try {
    if (typeof window.syncStartPageUi === "function") window.syncStartPageUi();
  } catch (error) {
    // 동기화 실패가 설정 열기를 막아서는 안 된다.
  }
  document.body.appendChild(settingsPanel);
  settingsPanel.setAttribute("aria-hidden", "false");
  settingsOpen.setAttribute("aria-expanded", "true");
  if (musicSettingsOpen) musicSettingsOpen.setAttribute("aria-expanded", "true");
  // 2026-07-19 3차 피드백: 패널을 새로 열 때마다 "확인" 버튼은 항상 깨끗한
  // (흰색) 상태로 시작한다 — 지난번 열었을 때의 dirty 표시가 남아있지 않게.
  clearSettingsDirty();
  // 2026-07-22 유저 요청 — 설정을 열 때마다 비주얼라이저 미리보기 막대를
  // 준비하고(이미 만들어져 있으면 no-op) 애니메이션 루프를 켠다. 본화면
  // 음악패널을 한 번도 안 열어봤어도 여기서 바로 재생 중인 오디오에 반응하는
  // 미리보기를 볼 수 있다.
  ensureMusicVizGraph();
  if (!musicVizAnimId) drawMusicViz();

  // 2026-08-04 — 특정 섹션으로 바로 데려다주기(현재는 "music"만 사용).
  // 시트가 화면에 자리를 잡은 다음 스크롤해야 위치가 정확하다.
  // 2026-08-20 — "alarm"을 추가하며 섹션 id 대응표로 일반화했다. 새 섹션이
  // 늘어도 이 표에 한 줄만 얹으면 된다.
  const FOCUS_SECTION_IDS = { music: "musicSettingsSection", alarm: "wakeAlarmSection" };
  if (FOCUS_SECTION_IDS[focusSection]) {
    const target = document.getElementById(FOCUS_SECTION_IDS[focusSection]);
    if (target) {
      window.setTimeout(() => {
        try {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (error) {
          target.scrollIntoView(true);
        }
      }, 260);
    }
  }
}

function closeSettings() {
  settingsPanel.classList.remove("is-open");
  try { if (window.__flipzenReportAdLayout) window.__flipzenReportAdLayout(); } catch (e) { /* 무시 */ }
  settingsPanel.setAttribute("aria-hidden", "true");
  settingsOpen.setAttribute("aria-expanded", "false");
  if (musicSettingsOpen) musicSettingsOpen.setAttribute("aria-expanded", "false");
  // 본화면 음악패널도 닫혀있는 경우에만 루프를 완전히 멈춘다(배터리 배려).
  if (musicVizAnimId && !isMusicVizActiveContext()) {
    cancelAnimationFrame(musicVizAnimId);
    musicVizAnimId = null;
  }
}

// 2026-07-16: 알라딘 제휴 수수료 추적용 파라미터 — aladin-links.js에 있는
// URL은 자동 매칭 스크립트가 항상 붙여서 저장하지만, gallery-server.js
// 수정 화면에서 사람이 알라딘 URL을 직접 복사+붙여넣기로 고칠 때는 이
// 파라미터를 빠뜨릴 수 있다. 데이터 쪽에서 매번 붙이는 걸 믿기보다,
// 실제로 iframe을 여는 이 순간에 마지막으로 한 번 더 강제로 붙여서 항상
// 보장한다(이미 있으면 덮어쓰기만 하고 중복 추가는 안 함).
const ALADIN_PARTNER_ID = "friends327";
function withAladinPartnerParam(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("partner", ALADIN_PARTNER_ID);
    return parsed.toString();
  } catch (error) {
    // URL 파싱이 실패하는 예외적인 경우(상대경로 등)엔 원본을 그대로
    // 쓴다 — 깨뜨리는 것보다는 파라미터 없이라도 여는 게 낫다.
    return url;
  }
}

// 2026-07-16 3차 개정: "새 창에서 보기" 버튼을 없앴다 — 네이티브
// WKWebView에는 진짜 "새 탭"이 없어서, 그 버튼을 누르면 사실 앱 화면
// 전체가 알라딘으로 통째로 바뀌어버리고 돌아올 방법이 없었다(유저 실측
// 피드백). 그래서 처음부터 iframe을 풀사이즈(높이 100%)로 보여주고,
// 하단엔 확실하게 앱으로 돌아올 수 있는 큰 "닫기" 버튼만 둔다.
// 2026-07-16 4차 개정: 이슈 제보 — 알라딘 로그인/장바구니가 이 iframe
// 안에서 전혀 유지되지 않는다("담기 하면 장바구니로 넘어가는데 비어있다,
// 로그인해도 다음에 열면 또 로그아웃돼있다"). 원인은 이 iframe이 ezlong.com
// 기준으로 "서드파티" 컨텍스트라, iOS WebKit이 여기 심기는 알라딘 쿠키를
// 오래 유지해주지 않기 때문이다(ITP류 정책 — 우리가 쿠키를 지우는 게
// 아니다, WKWebView 데이터스토어는 기본 영구 저장소를 그대로 쓰고 있고
// 코드 어디에도 쿠키를 지우는 로직이 없다). 이걸 근본적으로 우회하려면
// 알라딘을 "퍼스트파티" 컨텍스트로 열어야 한다. 1차로 네이티브에서
// SFSafariViewController(앱 내부에 뜨는 Safari 스타일 시트)를 시도했으나
// 유저 실기기 재확인 결과 그 안에서도 로그인이 유지되지 않았다 —
// SFSafariViewController는 기본 Safari 앱과 쿠키 저장소를 항상 100%
// 공유하는 게 아니다. 2026-07-16 5차 개정: 유저 요청대로 아예 스마트폰의
// 기본 브라우저(Safari) 앱 자체로 내보낸다. 네이티브에선
// ContentView.swift가 이 postMessage를 받아 UIApplication.shared.open()으로
// 처리하고, 일반 브라우저/PWA에서는 그대로 진짜 새 탭(window.open)을 쓴다.
// aladinModalCurrentUrl/aladinModalExternalOpenEl 버튼이 그 진입점이다.
let aladinModalCurrentUrl = null;

function openAladinModal(url, store) {
  if (!url) return;
  // 2026-08-09: 이제 아마존 링크도 이 함수를 탄다. 제휴 파라미터 규칙이 서점마다
  // 다르므로(알라딘 partner=, 아마존 tag=) 알라딘일 때만 보강한다 — 아마존
  // 주소는 quote-source 가 이미 완성해서 넘겨준다.
  const isAladinStore = (store || "aladin") !== "amazon";
  const finalUrl = isAladinStore ? withAladinPartnerParam(url) : url;
  aladinModalCurrentUrl = finalUrl;
  // 2026-07-18: 네이티브 앱에서는 iframe 모달을 아예 띄우지 않는다. iframe은
  // ezlong.com 기준 서드파티 컨텍스트라 ITP가 알라딘 로그인/장바구니 쿠키를
  // 막는 게 근본 원인이었다(위 withAladinPartnerParam 주석 4차 개정 참고).
  // 대신 ContentView.swift의 SFSafariViewController를 top-level(퍼스트파티)
  // 페이지로 직접 띄운다 — 네이버·퍼플렉시티 앱과 동일한 방식. 이러면 로그인
  // 자체가 진짜 aladin.co.kr 문서 컨텍스트에서 이뤄지므로 쿠키가 정상 저장된다.
  if (isNativeWrapper && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.flipzenNativeRadio) {
    window.webkit.messageHandlers.flipzenNativeRadio.postMessage({ action: "openAladinInApp", url: finalUrl });
    return;
  }
  // 2026-07-24 신설 — 안드로이드 분기(iOS 분기는 그대로 두고 추가만 함).
  if (isNativeWrapper && window.AndroidNativeBridge) {
    window.AndroidNativeBridge.postMessage("flipzenNativeRadio", JSON.stringify({ action: "openAladinInApp", url: finalUrl }));
    return;
  }
  // 아마존은 iframe 안에 뜨지 않는다(X-Frame-Options). 네이티브가 아닌
  // 환경에서는 모달을 건너뛰고 새 탭으로 보낸다 — 빈 모달을 띄우느니 낫다.
  if (!isAladinStore) {
    let openedTab = null;
    try {
      openedTab = window.open(finalUrl, "_blank", "noopener");
    } catch (error) {
      openedTab = null;
    }
    if (!openedTab) window.location.href = finalUrl;
    return;
  }

  // 네이티브가 아닌 일반 브라우저/PWA에서는 기존 iframe 모달을 그대로 쓴다
  // (이 경로는 데스크톱 사파리/크롬 등 다양한 환경이 섞여있어 이번 수정
  // 범위 밖 — 이번 문제는 네이티브 iOS 앱에 한정된 제보였다).
  if (!aladinModalPanel) return;
  if (aladinModalFrame) aladinModalFrame.src = finalUrl;
  aladinModalPanel.classList.add("is-open");
  // 15차-c: 동일 재부착 (제거 금지)
  document.body.appendChild(aladinModalPanel);
  aladinModalPanel.setAttribute("aria-hidden", "false");
}

if (aladinModalExternalOpenEl) {
  aladinModalExternalOpenEl.addEventListener("click", () => {
    if (!aladinModalCurrentUrl) return;
    if (isNativeWrapper && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.flipzenNativeRadio) {
      window.webkit.messageHandlers.flipzenNativeRadio.postMessage({ action: "openExternalSafari", url: aladinModalCurrentUrl });
      return;
    }
    // 2026-07-24 신설 — 안드로이드 분기.
    if (isNativeWrapper && window.AndroidNativeBridge) {
      window.AndroidNativeBridge.postMessage("flipzenNativeRadio", JSON.stringify({ action: "openExternalSafari", url: aladinModalCurrentUrl }));
      return;
    }
    let opened = null;
    try {
      opened = window.open(aladinModalCurrentUrl, "_blank", "noopener");
    } catch (error) {
      opened = null;
    }
    if (!opened) {
      window.location.href = aladinModalCurrentUrl;
    }
  });
}

// 2026-07-16: "가끔 알라딘 아이콘을 눌러도 모달이 안 뜬다, 앱을 강제
// 종료하고 재실행하면 된다"는 실기기 제보 — iOS WKWebView가 앱을
// 백그라운드로 보냈다가 다시 불러올 때 JS 타이머(특히 renderQuote()의
// 760ms 지연 콜백)가 씹혀서, quotePanel에 "is-changing" 클래스가 계속
// 남아있거나 아이콘 상태(hidden/dataset.url)가 어중간하게 멈춘 채로 남을
// 수 있다고 추정된다. 강제 종료는 이 JS 상태를 통째로 리셋해서 낫는
// 것이므로, 포그라운드로 돌아올 때마다 같은 효과를 내도록 자동으로
// 정리해준다 — 재현을 100% 확인하진 못했지만 가장 유력한 원인에 대한
// 방어 코드다.
function resyncAladinUiAfterForeground() {
  if (quotePanel) quotePanel.classList.remove("is-changing");
  if (lastRenderedQuote) updateAladinLinkButton(lastRenderedQuote);
  closeAladinModal();
}

function closeAladinModal() {
  if (!aladinModalPanel) return;
  aladinModalPanel.classList.remove("is-open");
  aladinModalPanel.setAttribute("aria-hidden", "true");
  if (aladinModalFrame) aladinModalFrame.src = "about:blank";
}

// 2026-07-18 4차 피드백: 애플 날씨 스타일 실사 사진 배경 — 시계 화면이
// 지금 쓰고 있는 배경사진(activePhotoSet[activePhotoIndex], pickScenePhoto
// 참조)을 그대로 재사용해 #weatherDetailPanel의 --wd-photo 변수에 넣는다.
// 별도의 사진 매칭 로직을 새로 만들지 않는 이유: (1) 시계 화면 사진은 이미
// 현재 날씨(weatherState.tag)·시간대·계절까지 맞춰 골라둔 상태라 그대로
// 재사용하는 게 가장 정확하고, (2) "내 앱의 기본이 배경사진 앱인데 날씨
// 상세만 다른 사진/스타일이면 이상하다"는 유저 피드백의 핵심이 "같은 사진을
// 써야 앱 전체가 일관돼 보인다"는 것이었기 때문이다.
function applyWeatherDetailPhoto() {
  if (!weatherDetailPanel) return;
  const photo = activePhotoSet[activePhotoIndex];
  const url = photo ? imageUrl(photo) : "";
  if (url) {
    weatherDetailPanel.style.setProperty("--wd-photo", `url("${url}")`);
  }
  applyWeatherDetailVideo();
}

// 2026-08-16 운영 요청 — "날씨 상세도 스탠바이의 그 동영상 배경이면
// 좋겠다". 메인에서 동영상 배경이 도는 동안에는 상세 패널의 사진 대신
// 같은 영상을 패널 전용 <video>로 튼다(무음·인라인·루프). 스크림은
// styles.css 의 .weather-detail-video ::after 가 얹는다. 영상이 안 돌면
// (사진 모드·셀룰러·비프리미엄) 기존 사진 경로 그대로다.
function applyWeatherDetailVideo() {
  if (!weatherDetailPanel) return;
  const layer = weatherDetailPanel.querySelector(".weather-detail-photo");
  if (!layer) return;
  let vurl = "";
  try {
    if (typeof window.__flipzenVideoBgCurrent === "function") {
      vurl = window.__flipzenVideoBgCurrent() || "";
    }
  } catch (error) { vurl = ""; }
  let vid = layer.querySelector(".wd-vidbg");
  if (!vurl) {
    weatherDetailPanel.classList.remove("weather-detail-video");
    if (vid) {
      try { vid.pause(); vid.removeAttribute("src"); vid.load(); } catch (error) {}
      vid.remove();
    }
    return;
  }
  if (!vid) {
    vid = document.createElement("video");
    vid.className = "wd-vidbg";
    vid.poster = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; // 2026-08-17 안드 기본 재생 아이콘 봉쇄
    vid.muted = true;
    vid.setAttribute("muted", "");
    vid.playsInline = true;
    vid.setAttribute("playsinline", "");
    vid.loop = true;
    vid.preload = "auto";
    layer.appendChild(vid);
  }
  weatherDetailPanel.classList.add("weather-detail-video");
  if (vid.getAttribute("src") !== vurl) {
    vid.setAttribute("src", vurl);
    try { vid.load(); } catch (error) {}
  }
  try { vid.play().catch(function () {}); } catch (error) {}
}

// 2026-07-18 6차 피드백: "비 내리는 애니메이션이 옛날 TV 노이즈 같다, 애플처럼
// 고급스럽게 못 하면 포기하자" — CSS repeating-linear-gradient의 균일한
// 줄무늬가 무아레/스캔라인처럼 보인 게 원인이라 canvas 2D 절차적 빗줄기로
// 교체했다(1차). 2026-07-18 7차 피드백에서 "많이 좋아졌지만 서비스급은
// 아니다"며 바람 각도·강수강도별 굵기/빈도·카드 표면 물리감 3가지를
// 요청했고, Fable 5 검토(FABLE5_검토회신_비애니메이션_2026-07-18.md) 결과를
// 반영해 아래처럼 전면 재작성한다.
//
// Fable 5 핵심 조언 요약과 반영 지점:
//  1) 바람 세기 4단계(무풍/약~보통/강함/매우강함, describeWind와 동일 임계값
//     5/25/50km/h)로 기울기 세기만 반영하고 풍향(화면 좌우)은 반영하지 않는다
//     — 폰의 실제 방위를 모르는 상태에서 풍향을 매핑하면 "그럴듯한 오정보"가
//     된다는 판단. 기울기 방향은 항상 왼쪽 고정(세션마다 랜덤 금지 — QA
//     혼란 방지).
//  2) "돌풍 변조"(wdWindFactor) — 전역 바람 계수를 5~15초 주기 사인파+노이즈로
//     출렁이게 해서 "바람이 훅 불었다 잦아드는" 살아있는 느낌을 준다. 이게
//     정적 반복(=TV노이즈로 보였던 원인)을 깨는 가장 효율 높은 한 수라는 조언.
//  3) 강수강도 5단계(classifyRainIntensity와 동일 grade)별로 밀도·굵기·속도·
//     투명도·대기 톤을 전부 다르게 — 이슬비는 "오는 듯 마는 듯"하게 아주
//     소심하게, 강한 비 이상은 화면 전체에 옅은 대기 톤(atmosphere tint)까지.
//     밀도는 절대 개수가 아니라 화면 면적 비례로 정규화(기준 390×844).
//  4) 성능: devicePixelRatio는 2로 캡(이미 적용), 낙하 레이어는 ~40fps로
//     캡(ProMotion 120Hz 기기 배려), 맺힘 레이어는 10~15fps 별도 저속 루프.
//     document.visibilitychange에서 완전 정지, prefers-reduced-motion이면
//     낙하 애니메이션 자체를 끄고 맺힘은 정적 한 프레임만 그린다.
//  5) 카드 표면 "충돌"보다 "맺힘(응결)"이 진짜 핵심 — 캔버스가 이미
//     z-index:-1로 카드 뒤에 있어 "카드를 뚫고 지나가는 비" 문제는 애초에
//     없었다(글래스 카드의 backdrop-filter가 뒤의 비를 뿌옇게 비춰 "젖은
//     유리 너머"까지 공짜로 나온다). 대신 카드 "위"(pointer-events:none,
//     z-index 양수지만 닫기 버튼보다는 낮게)에 별도 저속 캔버스를 얹어
//     작은 물방울이 맺혔다 가끔 흘러내리는 효과를 낸다.
//  6) 깊이감(원경/중경/근경 레이어)을 빗줄기마다 부여해 같은 개수로도
//     "공간"이 생기게 한다. 빗줄기 길이(len)는 항상 속도에 비례시킨다
//     (빠른 줄기=긴 모션블러 — 강풍에서 속도만 오르고 길이가 그대로면 어색).

// ── 강수강도(classifyRainIntensity와 동일 5등급)별 파라미터 테이블 ──────
// density: 기준 화면(390×844, iPhone 표준 뷰포트)에서의 빗줄기 개수.
// condCount: 맺힘(응결) 방울 목표 개수. atmosphereAlpha: 대기 톤 오버레이 농도.
const WD_RAIN_INTENSITY_PARAMS = {
  NONE: { density: 0, alphaMin: 0, alphaMax: 0, speedMul: 1, widthHeavyRatio: 0, atmosphereAlpha: 0, condCount: 0 },
  // Fable 5: "이슬비는 화면에 몇 가닥 안 보일 정도로 희박하고 가늘어야 한다 —
  // 40개도 많다. 고급스러움은 '오는 듯 마는 듯'에서 나온다."
  DRIZZLE: { density: 26, alphaMin: 0.06, alphaMax: 0.12, speedMul: 0.72, widthHeavyRatio: 0.02, atmosphereAlpha: 0, condCount: 10 },
  RAIN: { density: 110, alphaMin: 0.10, alphaMax: 0.24, speedMul: 1, widthHeavyRatio: 0.12, atmosphereAlpha: 0.04, condCount: 30 },
  HEAVY: { density: 170, alphaMin: 0.15, alphaMax: 0.32, speedMul: 1.15, widthHeavyRatio: 0.30, atmosphereAlpha: 0.10, condCount: 45 },
  VERY_HEAVY: { density: 220, alphaMin: 0.18, alphaMax: 0.36, speedMul: 1.25, widthHeavyRatio: 0.42, atmosphereAlpha: 0.16, condCount: 60 }
};

function wdRainIntensityParams() {
  return WD_RAIN_INTENSITY_PARAMS[wdRainIntensityGrade] || WD_RAIN_INTENSITY_PARAMS.RAIN;
}

// 면적 비례 정규화 — iPhone SE와 Pro Max는 화면 면적이 1.6배 차이 나므로
// 절대 개수를 그대로 쓰면 작은 기기에서 과밀해 보인다(Fable 5 지적).
function wdRainComputeDensity(baseDensity, w, h) {
  if (!baseDensity) return 0;
  const normalized = Math.round((baseDensity * (w * h)) / (390 * 844));
  return Math.max(8, Math.min(220, normalized));
}

// 바람 4단계(describeWind와 동일 임계값 5/25/50km/h) → 빗줄기 기울기 세기.
// 풍향은 반영하지 않는다(위 주석 참조) — 기울기 방향은 항상 왼쪽 고정.
function wdRainDriftForWind(speedKmh) {
  const s = typeof speedKmh === "number" ? speedKmh : 0;
  if (s < 5) return 0.04 + Math.random() * 0.06; // 무풍 — 거의 수직
  if (s < 25) return 0.3 + Math.random() * 0.3; // 약~보통 — 살짝 사선
  if (s < 50) return 0.8 + Math.random() * 0.5; // 강함 — 꽤 사선
  return 1.6 + Math.random() * 0.8; // 매우강함(강풍주의보 수준) — 아주 사선
}

// 접근성(prefers-reduced-motion)과 디버그(?fxoff=1) — 둘 다 모듈 로드 시
// 한 번만 계산한다. fxoff는 "혹시 애니메이션 때문에 느린가?"를 1초 만에
// 판별하는 디버그 스위치(Fable 5 제안), 일반 방문자 URL엔 없으므로 평소엔
// 영향 없다.
const wdReducedMotion =
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const WD_FX_OFF = new URLSearchParams(location.search).get("fxoff") === "1";

let wdRainCanvasEl = null;
let wdRainCtx = null;
let wdRainDrops = [];
let wdRainRunning = false;
let wdRainAnimHandle = null;
let wdRainWindSpeedKmh = 0;
let wdRainGustKmh = 0;
let wdRainIntensityGrade = "RAIN";
let wdWindFactor = 1;
let wdRainLastFallFrameTime = 0;
let wdRainWasRunningBeforeHidden = false;
const WD_RAIN_FALL_FRAME_MS = 1000 / 40; // ~40fps 캡(ProMotion 120Hz 기기 배려, Fable 5 권고)

// 렌더 시점(renderWeatherCurrent)마다 실측(또는 ?forceWeather 목업) 바람·
// 강수강도 값을 여기에 반영한다 — 이미 돌고 있으면 밀도만 다시 계산한다.
function setWeatherRainParams(windSpeedKmh, gustKmh, intensityGrade) {
  wdRainWindSpeedKmh = typeof windSpeedKmh === "number" ? windSpeedKmh : 0;
  wdRainGustKmh = typeof gustKmh === "number" ? gustKmh : wdRainWindSpeedKmh;
  wdRainIntensityGrade = intensityGrade || "RAIN";
  if (wdRainRunning) wdRainResize();
}

// "돌풍 변조" — 전역 바람 계수를 느린 이중 사인파로 출렁이게 한다. 진폭은
// (돌풍-평균풍속) 차이가 클수록(=바람이 들쭉날쭉할수록) 커진다. 이게 정적
// 반복(=예전 TV노이즈 혹평의 원인)을 깨는 핵심이라는 게 Fable 5 조언.
function wdUpdateWindFactor(tSeconds) {
  const gustAmp = Math.min(1, Math.max(0, (wdRainGustKmh - wdRainWindSpeedKmh) / 40));
  wdWindFactor = 1 + gustAmp * (0.45 * Math.sin(tSeconds * 0.7) + 0.25 * Math.sin(tSeconds * 1.9 + 1.3));
}

// 깊이감(원경/중경/근경) — 같은 개수라도 레이어를 나누면 "공간"이 생긴다.
// len(빗줄기 길이)은 항상 speed에 비례시킨다(빠를수록 긴 모션블러).
function wdRainMakeDrop(w, h, randomizeY, params) {
  const roll = Math.random();
  const layer = roll < 0.55 ? 0 : roll < 0.82 ? 1 : 2; // 0=원경(다수) 1=중경 2=근경(소수)
  const layerSpeedMul = layer === 0 ? 0.65 : layer === 1 ? 1 : 1.4;
  const layerAlphaMul = layer === 0 ? 0.65 : layer === 1 ? 1 : 1.15;
  const layerWidthMul = layer === 0 ? 0.85 : layer === 1 ? 1 : 1.25;
  const speed = (6 + Math.random() * 7) * (params.speedMul || 1) * layerSpeedMul;
  return {
    x: Math.random() * w,
    y: randomizeY ? Math.random() * h : -30 - Math.random() * h * 0.3,
    speed,
    len: speed * (1.7 + Math.random() * 0.9),
    drift: wdRainDriftForWind(wdRainWindSpeedKmh),
    alpha: (params.alphaMin + Math.random() * (params.alphaMax - params.alphaMin)) * layerAlphaMul,
    width: (Math.random() < (params.widthHeavyRatio || 0) ? 1.6 : 1) * layerWidthMul
  };
}

function wdRainResize() {
  if (!wdRainCanvasEl) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // Fable 5: dpr 캡이 어떤 파티클 튜닝보다 성능에 크게 기여
  wdRainCanvasEl.width = Math.round(w * dpr);
  wdRainCanvasEl.height = Math.round(h * dpr);
  if (wdRainCtx) wdRainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const params = wdRainIntensityParams();
  const density = wdRainComputeDensity(params.density, w, h);
  wdRainDrops = new Array(density).fill(null).map(() => wdRainMakeDrop(w, h, true, params));
}

function wdRainStep(timestamp) {
  if (!wdRainCtx || !wdRainCanvasEl || !wdRainRunning) return;
  if (wdRainLastFallFrameTime && timestamp - wdRainLastFallFrameTime < WD_RAIN_FALL_FRAME_MS) {
    wdRainAnimHandle = requestAnimationFrame(wdRainStep);
    return;
  }
  wdRainLastFallFrameTime = timestamp;
  wdUpdateWindFactor(timestamp / 1000);

  const w = window.innerWidth;
  const h = window.innerHeight;
  const params = wdRainIntensityParams();

  wdRainCtx.clearRect(0, 0, w, h);
  // 강도별 대기 톤(atmosphere tint) — Fable 5: "애플 연출의 절반은 파티클이
  // 아니라 이 대기 톤이다." 강한 비 이상에서만 옅게 깐다.
  if (params.atmosphereAlpha > 0) {
    wdRainCtx.fillStyle = `rgba(6,10,18,${params.atmosphereAlpha})`;
    wdRainCtx.fillRect(0, 0, w, h);
  }

  wdRainCtx.lineCap = "round";
  for (let i = 0; i < wdRainDrops.length; i++) {
    const d = wdRainDrops[i];
    wdRainCtx.strokeStyle = `rgba(214,232,255,${d.alpha})`;
    wdRainCtx.lineWidth = d.width;
    wdRainCtx.beginPath();
    wdRainCtx.moveTo(d.x, d.y);
    wdRainCtx.lineTo(d.x - d.drift * d.len * 0.42, d.y + d.len);
    wdRainCtx.stroke();
    d.x -= d.drift * 1.6 * wdWindFactor; // 돌풍 변조는 기울기(가로 이동)에만 곱한다(Fable 5 스펙 그대로)
    d.y += d.speed;
    if (d.y > h + 30 || d.x < -30) {
      wdRainDrops[i] = wdRainMakeDrop(w, h, false, params);
    }
  }
  wdRainAnimHandle = requestAnimationFrame(wdRainStep);
}

function startWeatherRainFx() {
  if (WD_FX_OFF || wdReducedMotion) return; // reduced-motion은 낙하 애니메이션 자체를 끈다(맺힘은 정적으로 별도 표시)
  if (wdRainRunning) return;
  if (!wdRainCanvasEl) wdRainCanvasEl = document.querySelector(".weather-detail-rain-fx");
  if (!wdRainCanvasEl || typeof wdRainCanvasEl.getContext !== "function") return;
  if (!wdRainCtx) wdRainCtx = wdRainCanvasEl.getContext("2d");
  wdRainResize();
  wdRainRunning = true;
  wdRainLastFallFrameTime = 0;
  wdRainAnimHandle = requestAnimationFrame(wdRainStep);
}

function stopWeatherRainFx() {
  wdRainRunning = false;
  if (wdRainAnimHandle) cancelAnimationFrame(wdRainAnimHandle);
  wdRainAnimHandle = null;
  if (wdRainCtx && wdRainCanvasEl) {
    wdRainCtx.clearRect(0, 0, wdRainCanvasEl.width, wdRainCanvasEl.height);
  }
}

// ── 카드 표면 "맺힘(응결)" 레이어 ────────────────────────────────────
// Fable 5 검토: 낙하 캔버스가 이미 z-index:-1로 카드 뒤에 있어 "비가 카드를
// 뚫고 지나가는" 문제는 원래부터 없었다(backdrop-filter가 뒤의 비를 뿌옇게
// 비춰 "젖은 유리 너머" 효과가 이미 공짜로 나옴). 카드가 진짜 "물리적
// 실체"로 느껴지게 하는 건 충돌이 아니라 유리 표면에 맺힌 물방울(응결)이라,
// 카드 "위"(pointer-events:none)에 별도 저속(10~15fps) 캔버스를 얹어 작은
// 물방울을 흩뿌리고 가끔 흘러내리게 한다. 카드 rect는 스크롤 리스너로
// 캐싱하지 않고 저속 루프의 매 틱마다 그냥 다시 읽는다(Fable 5: "카드 10개
// × 15fps는 비용이 무시 가능한 수준이고, 캐시 무효화 버그를 원천 차단한다"
// — 이 프로젝트가 제일 잘 아는 부류의 버그).
const WD_COND_SELECTORS = ".weather-current-card, .weather-stat-tile, .weather-hourly-item, .weather-weekly-row";
const WD_COND_FRAME_MS = 1000 / 13; // 10~15fps 저속 루프

let wdCondCanvasEl = null;
let wdCondCtx = null;
let wdCondDrops = [];
let wdCondRunning = false;
let wdCondAnimHandle = null;
let wdCondLastFrameTime = 0;
let wdCondWasRunningBeforeHidden = false;

function wdCondEligibleCardEls() {
  const vh = window.innerHeight;
  return Array.from(document.querySelectorAll(WD_COND_SELECTORS)).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 24 && r.height > 24 && r.bottom > 0 && r.top < vh;
  });
}

function wdCondMakeDropOn(el) {
  return {
    el,
    relX: Math.random(),
    relY: Math.random(),
    r: 1.5 + Math.random() * 3.5,
    born: performance.now(),
    life: 8000 + Math.random() * 14000, // 8~22초 뒤 자연 소멸
    sliding: false,
    slideAmount: 0,
    slideTarget: 10 + Math.random() * 22
  };
}

function wdCondDrawFrame(now) {
  if (!wdCondCtx) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  wdCondCtx.clearRect(0, 0, w, h);
  for (const d of wdCondDrops) {
    if (!d.el || !d.el.isConnected) continue;
    const rect = d.el.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) continue;
    const age = now - d.born;
    let alphaMul = 1;
    if (age < d.life * 0.15) alphaMul = age / (d.life * 0.15);
    else if (age > d.life * 0.8) alphaMul = Math.max(0, (d.life - age) / (d.life * 0.2));
    if (d.sliding && d.slideAmount < d.slideTarget) d.slideAmount += 0.6;

    const x = rect.left + d.relX * rect.width;
    const y = rect.top + d.relY * rect.height + d.slideAmount;
    const alpha = 0.32 * Math.max(0, Math.min(1, alphaMul));
    if (alpha <= 0.01) continue;

    // 작은 물방울 하나 = 원형 radial-gradient(가장자리 어둡게, 중심 밝게) +
    // 좌상단 쪽에 살짝 치우친 하이라이트 — 셰이더 없이 2D에서 "물방울"로
    // 읽히는 조합(Fable 5 제안).
    const grad = wdCondCtx.createRadialGradient(x - d.r * 0.3, y - d.r * 0.3, 0, x, y, d.r);
    grad.addColorStop(0, `rgba(255,255,255,${alpha * 0.9})`);
    grad.addColorStop(0.55, `rgba(200,222,242,${alpha * 0.5})`);
    grad.addColorStop(1, `rgba(70,92,124,${alpha * 0.22})`);
    wdCondCtx.fillStyle = grad;
    wdCondCtx.beginPath();
    wdCondCtx.arc(x, y, d.r, 0, Math.PI * 2);
    wdCondCtx.fill();

    if (d.sliding) {
      wdCondCtx.strokeStyle = `rgba(200,222,242,${alpha * 0.3})`;
      wdCondCtx.lineWidth = Math.max(0.6, d.r * 0.22);
      wdCondCtx.beginPath();
      wdCondCtx.moveTo(x, y - d.slideAmount);
      wdCondCtx.lineTo(x, y);
      wdCondCtx.stroke();
    }
  }
}

function wdCondStep(timestamp) {
  if (!wdCondCtx || !wdCondCanvasEl || !wdCondRunning) return;
  if (wdCondLastFrameTime && timestamp - wdCondLastFrameTime < WD_COND_FRAME_MS) {
    wdCondAnimHandle = requestAnimationFrame(wdCondStep);
    return;
  }
  wdCondLastFrameTime = timestamp;

  wdCondDrops = wdCondDrops.filter((d) => timestamp - d.born < d.life && d.el && d.el.isConnected);

  const params = wdRainIntensityParams();
  const targetCount = params.condCount || 0;
  if (wdCondDrops.length < targetCount) {
    const cards = wdCondEligibleCardEls();
    if (cards.length > 0) {
      const need = Math.min(targetCount - wdCondDrops.length, 3); // 한 틱에 과하게 몰아 추가하지 않음
      for (let i = 0; i < need; i++) {
        wdCondDrops.push(wdCondMakeDropOn(cards[Math.floor(Math.random() * cards.length)]));
      }
    }
  }
  wdCondDrops.forEach((d) => {
    if (!d.sliding && Math.random() < 0.0015) d.sliding = true; // "가끔 흘러내림"(Fable 5: 화룡점정)
  });

  wdCondDrawFrame(timestamp);
  if (wdCondRunning) wdCondAnimHandle = requestAnimationFrame(wdCondStep);
}

function wdCondResizeCanvas() {
  if (!wdCondCanvasEl) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  wdCondCanvasEl.width = Math.round(w * dpr);
  wdCondCanvasEl.height = Math.round(h * dpr);
  if (wdCondCtx) wdCondCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function startWeatherCondensationFx() {
  if (WD_FX_OFF) return;
  if (wdCondRunning) return;
  if (!wdCondCanvasEl) wdCondCanvasEl = document.querySelector(".weather-detail-condensation");
  if (!wdCondCanvasEl || typeof wdCondCanvasEl.getContext !== "function") return;
  if (!wdCondCtx) wdCondCtx = wdCondCanvasEl.getContext("2d");
  wdCondResizeCanvas();
  wdCondDrops = [];
  wdCondRunning = true;
  wdCondLastFrameTime = 0;

  if (wdReducedMotion) {
    // 접근성 배려(Fable 5 권고): 움직임 없이 정적 맺힘 한 프레임만 그리고
    // 루프는 돌리지 않는다 — "비가 온다"는 단서는 남기되 모션은 없앤다.
    const cards = wdCondEligibleCardEls();
    const params = wdRainIntensityParams();
    const count = Math.round((params.condCount || 0) * 0.6);
    const now = performance.now();
    for (let i = 0; i < count && cards.length > 0; i++) {
      const d = wdCondMakeDropOn(cards[Math.floor(Math.random() * cards.length)]);
      d.born = now - d.life * 0.4; // 이미 맺혀 정착된 상태로 즉시 보이게
      wdCondDrops.push(d);
    }
    wdCondDrawFrame(now);
    return;
  }
  wdCondAnimHandle = requestAnimationFrame(wdCondStep);
}

function stopWeatherCondensationFx() {
  wdCondRunning = false;
  if (wdCondAnimHandle) cancelAnimationFrame(wdCondAnimHandle);
  wdCondAnimHandle = null;
  if (wdCondCtx && wdCondCanvasEl) wdCondCtx.clearRect(0, 0, wdCondCanvasEl.width, wdCondCanvasEl.height);
  wdCondDrops = [];
}

// 낙하 레이어 + 맺힘 레이어를 하나로 묶어 호출하는 래퍼 — 열기/닫기/렌더
// 시점에서 항상 둘을 같이 켜고 끈다.
function startWeatherRainFxAll() {
  startWeatherRainFx();
  startWeatherCondensationFx();
}
function stopWeatherRainFxAll() {
  stopWeatherRainFx();
  stopWeatherCondensationFx();
}

window.addEventListener("resize", () => {
  if (wdRainRunning) wdRainResize();
  if (wdCondRunning) wdCondResizeCanvas();
});

// 배터리 배려(Fable 5 권고) — 앱이 백그라운드로 가면(다른 앱 전환, 화면
// 잠금 등) 두 루프 모두 완전히 멈추고, 다시 보일 때 비가 계속 오는 중이면
// 자동 재시작한다.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (wdRainRunning) {
      wdRainWasRunningBeforeHidden = true;
      stopWeatherRainFx();
    }
    if (wdCondRunning) {
      wdCondWasRunningBeforeHidden = true;
      stopWeatherCondensationFx();
    }
  } else {
    if (wdRainWasRunningBeforeHidden) {
      wdRainWasRunningBeforeHidden = false;
      startWeatherRainFx();
    }
    if (wdCondWasRunningBeforeHidden) {
      wdCondWasRunningBeforeHidden = false;
      startWeatherCondensationFx();
    }
  }
});

// 2026-07-14: 날씨 상세 화면 열기/닫기 — 기존 설정 패널과 동일한 메커니즘
// (is-open 클래스 토글 + aria-hidden)을 그대로 따른다.
// 2026-07-17 10차 개정: #weatherDetailPanel도 #pageTrack 안의 3번 페이지로
// 전환됐으므로 goToPage(3)/goToPage(0) 호출을 추가한다(openSettings/
// closeSettings와 동일 패턴).
// 2026-07-17 13차: #weatherDetailPanel도 #pageTrack 밖으로 나가면서
// goToPage() 호출 제거 — 위 openSettings/closeSettings와 동일 이유.
function openWeatherDetail() {
  if (!weatherDetailPanel) return;
  weatherDetailPanel.classList.add("is-open");
  // 15차-c: openSettings와 동일 — 재부착으로 터치 스크롤 영역 재등록 (제거 금지)
  document.body.appendChild(weatherDetailPanel);
  // 2026-08-23 운영자: 기상 알람 '해제됨' 화면(.wake-ring, z-index 9000) 위에서
  // 열면 날씨 상세(.app-page, z-index 20)가 그 뒤에 가려 안 보이던 문제 수정.
  // 링 화면이 떠 있을 때만 상세 패널을 그 위(9500)로 올리고, 평소엔 기본값 유지.
  try {
    var wdRing = document.getElementById("wakeRingScreen");
    weatherDetailPanel.style.zIndex = (wdRing && !wdRing.hidden) ? "9500" : "";
  } catch (eWdZ) { /* 무시 */ }
  weatherDetailPanel.setAttribute("aria-hidden", "false");
  if (weatherChipOpen) weatherChipOpen.setAttribute("aria-expanded", "true");
  applyWeatherDetailPhoto();
  // fetchWeatherDetail()이 1시간 캐시로 renderWeatherCurrent 재호출을 건너뛸
  // 수 있으므로(코드 위쪽 캐시 로직 참조), 이전에 이미 .weather-detail-rainy가
  // 켜져 있었다면(비가 계속 오는 중) 캔버스 루프를 여기서 다시 시작해야
  // 한다 — closeWeatherDetail에서 배터리 절약을 위해 매번 멈춰두기 때문.
  if (weatherDetailPanel.classList.contains("weather-detail-rainy")) startWeatherRainFxAll();
  // ?fxtest=1일 때만 하단 시나리오 스위처를 띄운다 (일반 방문자에겐 안 보임)
  wdRenderFxTestBar();
  // 2026-07-18 유저 피드백: "뒤로가기 제스처로 닫히게" — history 항목을 하나
  // 쌓아두고 popstate에서 실제로 닫는다. 아이폰 사파리 좌측 엣지 스와이프,
  // 안드로이드 뒤로가기 버튼 모두 popstate를 발생시킨다. 다만 이 앱을
  // 감싼 네이티브 WKWebView가 자체적으로 "뒤로/앞으로 스와이프 제스처"를
  // 꺼둔 상태라면(allowsBackForwardNavigationGestures=false) 이 웹 코드만
  // 으로는 제스처 자체를 만들어낼 수 없다 — 그 경우는 네이티브 쪽 설정이다.
  history.pushState({ weatherDetail: true }, "");
  fetchWeatherDetail();

  // 2026-07-22: 날씨 상세를 열람하면(=확인함) 그 시점 기준 활성 특보의
  // tmFc를 "확인함"으로 기록해 베이스캠프 빨간 점 배지를 끈다. 아직 데이터를
  // 못 받아온 첫 오픈 순간엔 wdLastAdvisoryData가 비어있을 수 있는데, 그때는
  // fetchWeatherDetail() 완료 후 renderWeatherAdvisory()가 다시 배지를
  // 갱신하므로(같은 함수가 매번 최신 데이터로 재판정) 문제없다.
  if (wdLastAdvisoryData && wdLastAdvisoryData.tmFc) {
    try {
      localStorage.setItem(WEATHER_ADVISORY_ACK_KEY, String(wdLastAdvisoryData.tmFc));
    } catch (e) {
      // localStorage 접근 실패(사파리 프라이빗 모드 등)해도 배지 기능만 계속
      // 켜져 있는 정도의 부작용이라 무시하고 진행한다.
    }
    updateWeatherAdvisoryDot(wdLastAdvisoryData);
  }
}

function closeWeatherDetail() {
  if (!weatherDetailPanel) return;
  weatherDetailPanel.classList.remove("is-open");
  weatherDetailPanel.setAttribute("aria-hidden", "true");
  if (weatherChipOpen) weatherChipOpen.setAttribute("aria-expanded", "false");
  // 패널이 닫혀 안 보이는 동안엔 캔버스 애니메이션 루프를 완전히 멈춘다
  // (배터리 배려) — .weather-detail-rainy 클래스 자체는 그대로 둬서, 다시
  // 열 때 openWeatherDetail이 그 값을 보고 루프 재시작 여부를 판단한다.
  stopWeatherRainFxAll();
  // 2026-08-16 — 패널 전용 배경 영상도 내린다(배터리·디코더 절약).
  const wdVid = weatherDetailPanel.querySelector(".weather-detail-photo .wd-vidbg");
  if (wdVid) {
    try { wdVid.pause(); wdVid.removeAttribute("src"); wdVid.load(); } catch (error) {}
    wdVid.remove();
  }
  weatherDetailPanel.classList.remove("weather-detail-video");
  // 링 화면 위에서 올렸던 z-index를 원복(다음 일반 오픈에 영향 없게).
  try { weatherDetailPanel.style.zIndex = ""; } catch (eWdZ2) { /* 무시 */ }
}

// X 버튼 등 "명시적" 닫기는 이걸 호출한다. openWeatherDetail이 쌓아둔 history
// 항목을 history.back()으로 되돌리면 popstate 핸들러가 실제 닫기를 수행한다 —
// 그래야 X 버튼 경로와 뒤로가기 제스처 경로가 하나로 합쳐져 history 스택이
// 어긋나지 않는다(항목만 쌓이고 안 지워지는 상태 방지).
function requestCloseWeatherDetail() {
  if (!weatherDetailPanel || !weatherDetailPanel.classList.contains("is-open")) return;
  if (history.state && history.state.weatherDetail) {
    history.back();
  } else {
    closeWeatherDetail();
  }
}

window.addEventListener("popstate", () => {
  if (weatherDetailPanel && weatherDetailPanel.classList.contains("is-open")) {
    closeWeatherDetail();
  }
});

// 2026-07-18 3차 피드백: "뒤로가기 제스처로 닫힌다더니 안 닫힌다" — 위
// history.pushState/popstate 방식은 브라우저 표준 스와이프-뒤로가기가
// 실제로 발생해야만 작동하는데, 이 앱을 감싼 네이티브 WKWebView가
// "뒤로/앞으로 스와이프 제스처" 자체를 꺼둔 상태(allowsBackForwardNavigationGestures
// =false)라면 제스처 자체가 애초에 발생하지 않아 popstate도 못 받는다 —
// 이건 웹 코드가 통제할 수 없는 네이티브 설정이라 신뢰할 수 없었다.
// 그래서 네이티브 뒤로가기 제스처에 의존하지 않는, 순수 터치 이벤트 기반
// 좌측 엣지 스와이프를 직접 구현한다 — Safari든 WKWebView든 터치 이벤트
// 자체는 항상 정상 발생하므로 네이티브 설정과 무관하게 항상 동작한다.
// 화면 왼쪽 가장자리(EDGE_ZONE_PX 이내)에서 시작한 터치만 추적하고,
// 오른쪽으로 CLOSE_THRESHOLD_PX 이상 + 세로 이동보다 가로 이동이 뚜렷할
// 때만 닫는다 — 그 외 지점(세로 스크롤, 가로 스크롤 시간대별 스트립 등)
// 에서 시작한 터치는 전혀 건드리지 않고, preventDefault도 전혀 안 써서
// (passive:true) 기존 스크롤 동작에 영향이 없다(CLAUDE.md 스크롤 절대
// 규칙과 무관 — 이 코드는 터치를 "가로채지" 않고 "관찰"만 한다).
function setupWeatherDetailEdgeSwipe() {
  if (!weatherDetailPanel) return;
  const EDGE_ZONE_PX = 24;
  const CLOSE_THRESHOLD_PX = 80;
  let startX = null;
  let startY = null;
  let tracking = false;

  weatherDetailPanel.addEventListener(
    "touchstart",
    (event) => {
      if (!weatherDetailPanel.classList.contains("is-open")) {
        tracking = false;
        return;
      }
      const touch = event.touches[0];
      if (!touch || touch.clientX > EDGE_ZONE_PX) {
        tracking = false;
        return;
      }
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    },
    { passive: true }
  );

  weatherDetailPanel.addEventListener(
    "touchend",
    (event) => {
      if (!tracking || startX == null) {
        tracking = false;
        return;
      }
      tracking = false;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - (startY ?? touch.clientY));
      if (dx > CLOSE_THRESHOLD_PX && dy < dx * 0.6) {
        requestCloseWeatherDetail();
      }
      startX = null;
      startY = null;
    },
    { passive: true }
  );
}

function weatherDetailCoords() {
  return userCoords || DEFAULT_WEATHER_COORDS;
}

// 2026-07-20 유저 피드백("절대 한 번도 실패해서는 안 된다"): 예전엔 이
// fetch()에 타임아웃이 전혀 없었다. 응답이 없이 그냥 멈춰버리는 요청이
// 하나라도 생기면(약한 전파, 네트워크 전환 중 끊긴 연결 등) fetchWeatherDetail()
// 안의 Promise.allSettled 전체가 영원히 안 끝나고, weatherDetailFetching
// 플래그가 영구히 true로 막혀서 재시도 버튼을 눌러도 그 즉시 아무 일도 안
// 일어나는 상태가 됐다("다시 시도"가 계속 "다시 시도" 텍스트만 반복). 이제
// WEATHER_FETCH_TIMEOUT_MS 안에 반드시 실패로 확정하고, 실패하면 자동으로
// 한 번 더 시도한다 — 대부분의 일시적 순단은 유저가 아무것도 안 눌러도
// 이 안에서 스스로 회복된다.
const WEATHER_FETCH_TIMEOUT_MS = 10000;

async function fetchWeatherJsonOnce(path) {
  const { lat, lng } = weatherDetailCoords();
  // 2026-07-28 W9-5 — 백엔드는 W4 때부터 ?lang= 을 받고 있었는데(i18n.ts
  // resolveLang), 정작 프론트가 한 번도 안 보내서 서버가 늘 기본값 "ko" 로
  // 응답하고 있었다. 시뮬레이터 날씨 상세 화면에서 우산 조언 문단만 통째로
  // 한국어로 남아 있던 게 이것 때문이다.
  // ★ lang 미지정 = "ko" = 예전 응답과 완전히 동일 ★ 이므로, 한국어 사용자의
  //   응답은 이 파라미터가 붙어도 글자 하나 바뀌지 않는다.
  const url = `${WEATHER_API_BASE}${path}?lat=${lat}&lng=${lng}&lang=${encodeURIComponent(FZ_LOCALE || "ko")}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEATHER_FETCH_TIMEOUT_MS);
  try {
    // 2026-07-22 근본 원인 수정: 기상특보 상세("펼침")가 매번 비어보인다는
    // 반복 제보의 진짜 원인이 여기 있었다 — 백엔드(D1 20분 캐시)는 이미
    // 정상 작동 중이었는데(cache-bust 파라미터로 직접 검증 완료), 이
    // fetch()에 cache 옵션을 안 줘서 iOS WKWebView/사파리가 동일 URL(같은
    // lat/lng, 쿼리 그대로)의 예전 HTTP 응답을 자체적으로 재사용해버릴 수
    // 있었다. 서버 쪽 캐시(D1, 20분~4시간 TTL)만으로 신선도를 통제하고
    // 있으므로, 브라우저 자체 HTTP 캐시는 완전히 꺼서 이중 캐싱을 없앤다.
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWeatherJson(path) {
  try {
    return await fetchWeatherJsonOnce(path);
  } catch (e) {
    // 첫 시도 실패 — 콜드스타트/순단이면 두 번째 시도에서 대개 회복된다.
    return await fetchWeatherJsonOnce(path);
  }
}

// 2026-07-14: prob(강수확률)을 함께 넘기면 뱃지 안에 라벨+확률을 2줄로 쌓는다
// (유저 피드백: "'약한 비' 딱지에 강수확률도 같이 표시해주자"). 열대야
// 뱃지처럼 확률 개념이 없는 호출은 prob을 생략하면 기존처럼 라벨만 나온다.
// 2026-07-18 리디자인(클로드 디자인 목업 수용, 유저 피드백 "너무 어둡다,
// 밝고 경쾌하게"): 텍스트만 있던 자리에 이모지 아이콘을 붙여 스캔하기
// 쉽게 만든다. 전부 순수 장식 판단이라 백엔드 재배포·API 변경 없이
// 프론트에서만 결정한다 — 데이터 정확성에는 영향이 없다.
function weatherEmojiFromEnglish(conditions) {
  const c = (conditions || "").toLowerCase();
  if (/thunder|storm/.test(c)) return "⛈️";
  if (/snow/.test(c)) return "❄️";
  if (/rain|drizzle|shower/.test(c)) return "🌧️";
  if (/fog|mist|haze/.test(c)) return "🌫️";
  if (/overcast/.test(c)) return "☁️";
  if (/partially cloudy|partly cloudy/.test(c)) return "⛅";
  if (/cloud/.test(c)) return "🌥️";
  if (/clear/.test(c)) return "☀️";
  return "🌤️";
}

// 2026-07-18 유저 피드백(실기기 발견): Visual Crossing의 conditions 텍스트가
// "구름 조금" 계열로 뭉뚱그려져 있는데 실제로는 그 순간 비가 오고 있는
// 경우가 있었다(conditions는 하루 단위 요약에 가깝고, 실시간 강수 여부와
// 어긋날 수 있음) — 화면 맨 위 상징 아이콘이 아래 "지금 비가 오고 있어요"
// 문구와 모순되는 버그였다. 백엔드는 이미 current.precip/precipprob를
// 내려주고 있으니(추가 배포 불필요), 아이콘 결정에서 이 실측값을
// conditions 텍스트보다 우선한다 — "판단해서 알려준다" 철학에 맞게 실제
// 강수 여부가 텍스트 분류보다 항상 더 신뢰할 수 있는 근거다.
// 2026-07-18 5차 피드백(재발): 그런데도 여전히 실기기에서 "지금 이슬비가
// 오는데 아이콘은 구름"인 경우가 있었다. 원인은 c(=current.current)가
// Visual Crossing의 "currentConditions"(관측소 실측 스냅샷)라서, 옅은
// 이슬비처럼 약한 강수를 그 관측 순간에 정확히 못 잡을 수 있다는 것 —
// 반면 오늘 시간대별 예보 스트립의 "지금" 항목은 같은 응답의 hours[]
// (모델 예보값)에서 나오는데, 이쪽은 100%로 정확히 비를 잡고 있었다.
// 두 값 다 이미 클라이언트가 들고 있으므로 새 API 호출 없이, hourly-strip의
// "지금" 강수확률(hourlyNowProb)도 OR 조건으로 반영해 두 표시가 서로
// 모순되지 않게 한다.
function weatherEmojiFromCurrent(c, hourlyNowProb, hourlyNowMm) {
  // 2026-07-24 이슈 제보 반영: 확률만 보고 비를 확정하던 예전 OR 조건을
  // 버리고, current/hourly-strip/weekly가 전부 공유하는 deriveRainDisplay()
  // (확률>=50% && 강수량>=0.2mm/h AND 조건)로 통일한다 — 아이콘·비
  // 애니메이션·히어로 텍스트가 항상 같은 판정을 말하게 하기 위함.
  const effProb = Math.max(
    typeof c.precipprob === "number" ? c.precipprob : 0,
    typeof hourlyNowProb === "number" ? hourlyNowProb : 0
  );
  const effMm = Math.max(
    typeof c.precip === "number" ? c.precip : 0,
    typeof hourlyNowMm === "number" ? hourlyNowMm : 0
  );
  const isRainingNow = DEBUG_FORCE_RAIN || deriveRainDisplay(effProb, effMm).showAsRain;
  const types = (c.preciptype || []).map((t) => String(t).toLowerCase());
  if (isRainingNow) {
    if (types.includes("snow")) return "❄️";
    if (/thunder|storm/.test((c.conditions || "").toLowerCase())) return "⛈️";
    return "🌧️";
  }
  return weatherEmojiFromEnglish(c.conditions);
}

// 2026-07-28 글로벌화 W2: 이모지 표를 i18n/weather-codes.js 로 옮겼다.
// 이 함수는 이름·시그니처만 남은 얇은 어댑터다 — 호출부가 많아 한꺼번에
// 바꾸면 검토가 어려워지므로, 표만 먼저 한 곳으로 모았다.
// 동작이 그대로임은 scripts/test-condition-golden.mjs 가 리팩터 전에
// 얼려둔 실행 결과와 대조해 기계로 증명한다.
function weatherEmojiFromKoCondition(ko) {
  return WX.conditionEmoji(conditionCodeOf({ conditionsKo: ko }), false);
}

// 시간대별 스트립엔 조건 텍스트가 안 내려오므로, 강수확률(precipprob)과
// 대략의 시각(hourLabel 파싱, "지금"이면 기기 로컬시각)으로 갈음한다 —
// 장식용 아이콘이라 낮/밤 추정이 다소 근사치여도 무방하다.
// 2026-07-22: 비 아이콘 진입 문턱을 deriveRainDisplay()(30%→50%)와 통일 —
// renderWeatherHourlyStrip의 isRainHour 판정과 반드시 같은 기준이어야 한다.
// 2026-07-24 이슈 제보: 강수 신호가 없는 시간이 전부 "맑음" 아이콘으로
// 떨어져, 실제로는 흐리거나 구름 많은 시간에도 스트립엔 계속 해가 떠
// 있었다 — deriveRainDisplay()의 iconDay/iconNight가 null인(=③, 비와
// 무관) 경우의 폴백이 무조건 ☀️/🌙였던 게 원인. 이제 백엔드가 시간별로
// 내려주는 conditionsKo(구름량 텍스트, buildHourlyStrip() 참조)를 반영해
// 밤엔 "맑음이면 달, 그 외엔 구름"으로 단순화(⛅류 아이콘은 해가 들어있어
// 밤엔 어색함 — Fable 5 회신의 iconNight:"☁️" 선택과 같은 원칙), 낮엔
// weatherEmojiFromKoCondition()을 그대로 재사용해 흐림/구름조금/구름많음을
// 구분해서 보여준다.
// 2026-07-28 글로벌화 W2: 밤 분기표도 i18n/weather-codes.js 로 이동.
// (밤에는 구름 조금/많음/흐림을 ☁️ 하나로 뭉치는 규칙 그대로)
function weatherEmojiFromHourCondition(conditionsKo, isNight) {
  return WX.conditionEmoji(conditionCodeOf({ conditionsKo }), !!isNight);
}

function weatherEmojiFromHour(precipprob, precipMm, hourLabel, isNow, conditionsKo, hour24) {
  // 2026-07-28 글로벌화 W2: "14시" 파싱을 WX.hourOf() 로 옮겼다.
  // 영어 모드에서는 이 라벨이 "2 PM" 같은 형태로 오므로 /^(\d+)시/ 가
  // 조용히 실패해 밤/낮 아이콘이 통째로 틀어진다. hourOf() 는 백엔드가
  // 주는 hour/datetimeEpoch 를 먼저 보고, 없을 때만 라벨을 파싱한다.
  // ★ isNow 를 먼저 보는 순서는 그대로 유지한다 ★ hourOf() 는 라벨을
  //   isNow 보다 우선하므로, 순서를 바꾸면 "지금" 카드가 라벨 시각을
  //   따라가 버린다 — 지금 동작과 달라진다.
  // 2026-07-28 W9-6 — hour24(백엔드 신규 숫자 필드)를 함께 넘긴다.
  // 영어 라벨은 "6 PM" 형태라 문자열 파싱이 통하지 않는다.
  const hour = isNow ? new Date().getHours() : WX.hourOf({ hourLabel, hour24 });
  const isNight = WX.isNightHour(hour);
  // 2026-07-24 Fable 5 검토회신 반영: 이 함수가 "비냐 아니냐"만 보던
  // 이분법이 오늘 사건의 원인 중 하나였다 — deriveRainDisplay()가 새로
  // 반환하는 ②(절충) 상태를 받을 자리가 없어 조용히 ③(맑음)과 똑같이
  // 그려버렸다. 이제 직접 판정하지 않고 deriveRainDisplay()가 계산해준
  // iconDay/iconNight를 그대로 쓴다 — null이면(=③, 비와 무관) 실제 구름량
  // 기반 아이콘으로 폴백한다(conditionsKo가 구버전 캐시 등으로 없으면
  // 안전하게 예전처럼 맑음/밤 아이콘).
  const rainDisplay = deriveRainDisplay(precipprob, precipMm);
  const icon = isNight ? rainDisplay.iconNight : rainDisplay.iconDay;
  if (icon) return icon;
  if (conditionsKo) {
    // 2026-07-27 헌법(36항) 뒷문 봉쇄: 비 계열 아이콘은 deriveRainDisplay의
    // ①/②에서만 나올 수 있다. Visual Crossing은 강수량 0인 시간에도
    // conditions 라벨을 "Rain"으로 붙여 내려주는 일이 흔한데(하루 확률을
    // 전 시간에 뭉개는 특성과 같은 뿌리), 여기서 그 텍스트("비")를 그대로
    // 아이콘화하면 위에서 ③으로 억제한 비 신호가 폴백 경로로 되살아난다 —
    // 실제 사고: ver.1.6.13.7 배포 직후 스트립 전 시간이 🌧️로 도배
    // (2026-07-27 13:2x 이슈 제보). "비"는 구름량 정보로 강등해 "흐림"으로
    // 그린다. 천둥번개(⛈️)·눈(❄️)은 우산과 별개의 고유 신호라 유지.
    // 2026-07-28 글로벌화 W2: 강등 규칙을 WX.applyRainDowngrade() 로 이동.
    // 여기까지 왔다는 건 deriveRainDisplay 가 ③(비 신호 없음)을 준
    // 상태이므로, 두 번째 인자는 항상 false 다.
    const code = WX.applyRainDowngrade(conditionCodeOf({ conditionsKo }), false);
    return WX.conditionEmoji(code, isNight);
  }
  return isNight ? "🌙" : "☀️";
}

/**
 * 한국 전용 기능(평년비교·기상특보·미세먼지)의 노출을 좌표로 결정한다.
 * 2026-07-28 글로벌화 W3 신설.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 언어가 아니라 좌표로 판정한다 ★
 * ─────────────────────────────────────────────────────────────
 * "영어면 숨긴다"로 짜고 싶어지지만 틀린 설계다:
 *   · 서울에 사는 영어권 사용자 → 미세먼지·기상특보가 가장 필요한 사람인데
 *     언어로 자르면 못 본다
 *   · 해외 거주 한국어 사용자 → 한국 기상특보를 봐야 할 이유가 없다
 * 이 세 기능의 데이터 출처는 전부 한국 기상청·환경부다. "한국어를 쓰는가"가
 * 아니라 "한국에 있는가"가 판정 기준이어야 한다.
 *
 * 좌표를 아직 모를 때(측위 전·권한 거부)는 **보여준다** — 지금까지의 동작이
 * 그렇고, 한국 사용자가 대다수인 현재 상태에서 안전한 쪽이다.
 * (i18n/region.js showKoreaOnlyFeatures 의 계약, scripts/test-region.mjs 확인)
 *
 * @returns {boolean} 한국 전용 기능을 노출할 것인가
 */
function applyKoreaOnlyGating() {
  // ★ showKoreaOnlyFeatures 는 (lat, lng) 두 인자를 받는다 ★
  // 초안에서 userCoords 객체를 통째로 넘겼더니, 첫 인자가 number 가 아니라
  // "좌표를 모른다"로 판정되어 **어디서든 항상 true**(전부 노출)가 됐다.
  // 에러도 경고도 없이 게이트만 조용히 무력화되는 종류의 버그였고,
  // scripts/test-region.mjs 의 뉴욕·시드니 케이스가 잡아냈다.
  const lat = userCoords && typeof userCoords.lat === "number" ? userCoords.lat : null;
  const lng = userCoords && typeof userCoords.lng === "number" ? userCoords.lng : null;
  const show = FZ_REGION && FZ_REGION.showKoreaOnlyFeatures
    ? FZ_REGION.showKoreaOnlyFeatures(lat, lng)
    : true;   // i18n 미로드 → 예전처럼 전부 노출

  // 카드를 숨긴다. 숨기지 않으면 "불러올 수 없어요"가 남아 고장처럼 보인다.
  const normalSection = document.getElementById("wdNormalSection");
  const normalDivider = document.getElementById("wdNormalDivider");
  for (const el of [normalSection, normalDivider]) {
    if (el) el.hidden = !show;
  }
  if (!show && wdAdvisoryBanner) {
    wdAdvisoryBanner.hidden = true;
    wdAdvisoryBanner.setAttribute("aria-hidden", "true");
  }
  if (!show && wdAirQuality) {
    const airCard = wdAirQuality.closest ? wdAirQuality.closest(".weather-card") : null;
    if (airCard) airCard.hidden = true;
  }
  return show;
}

/**
 * 주간예보 한 줄의 아이콘·문구·확률표시를 정한다.
 * 2026-07-28 글로벌화 W2 — renderWeatherWeekly() 안에 인라인으로 있던
 * 블록을 함수로 꺼냈다. 꺼낸 이유가 둘이다:
 *   1. 인라인 상태로는 기계가 대조할 수가 없다(호출할 이름이 없다).
 *      리팩터 전 동작을 얼려둔 golden-condition.json 과 이 함수를
 *      scripts/test-condition-golden.mjs 가 대조한다.
 *   2. 한국어 문자열 비교(d.conditionsKo === "비")가 여기에도 있었다.
 *
 * ★ CLAUDE.md 36항(우산 헌법) 뒷문 봉쇄가 적용되는 자리다 ★
 * VC 는 강수량 0인 날에도 conditions 를 "Rain" 으로 준다. 그 라벨을
 * 그대로 그리면 ③으로 억제한 비 신호가 되살아난다 — 그래서 비 계열은
 * rainDisplay 가 ①/②일 때만 비로 남고, 아니면 흐림으로 강등된다.
 *
 * @returns {{icon: string, text: string, base: string, isRainDay: boolean, probHtml: string}}
 */
function deriveWeeklyConditionDisplay(d, rainDisplay, isRainStopped, probForDisplay, mmForDisplay) {
  const C = WX.CONDITION;
  const code = conditionCodeOf(d);
  const mmHtml = mmForDisplay >= 0.1 ? ` ${mmForDisplay}mm/h` : "";

  const isRainDay = !isRainStopped && code === C.RAIN && rainDisplay.showAsRain;

  // 사전에 없는 라벨(빈 값·미지의 문자열)은 예전처럼 원문을 그대로 쓴다 —
  // 카탈로그를 태우면 없는 키라 빈칸이 될 수 있다.
  const rawLabel = (code === C.UNKNOWN) ? d.conditionsKo : conditionLabel(code, d.conditionsKo);

  let baseCode = code;
  let base = rawLabel;
  let text = rawLabel;

  if (isRainStopped) {
    // "그쳤다"는 건 비가 있었다는 뜻 — 아이콘은 비, 문구만 (그침)
    baseCode = C.RAIN;
    base = conditionLabel(C.RAIN, "비");
    text = t("weather.rainStopped", null, "비(그침)");
  } else if (code === C.RAIN && !rainDisplay.showAsRain) {
    baseCode = C.CLOUDY;
    base = conditionLabel(C.CLOUDY, "흐림");
    text = rainDisplay.cloudyProbLabel
      ? t("weather.cloudyWithRainChance", { label: rainDisplay.cloudyProbLabel },
          `흐림(${rainDisplay.cloudyProbLabel})`)
      : base;
  }

  return {
    icon: WX.conditionEmoji(baseCode, false),
    text,
    base,
    isRainDay,
    probHtml: isRainDay
      ? `<span class="weather-weekly-prob">${probForDisplay}%${mmHtml}</span>`
      : "",
  };
}

function weatherBadgeHtml(grade, label, prob) {
  const probHtml = typeof prob === "number" ? `<span class="weather-badge-prob">${prob}%</span>` : "";
  return `<span class="weather-badge" data-grade="${grade}"><span class="weather-badge-label">${label}</span>${probHtml}</span>`;
}

// 2026-07-14: 헤더의 "지금 날씨"를 "서울 지금 날씨"처럼 지역명을 붙여 표시.
// weatherState.location은 requestCurrentWeather()의 역지오코딩(accept-language=ko)
// 결과라 이미 한글 지명이다 — 별도 API 호출 없이 재사용한다.
function updateWeatherDetailTitle() {
  if (!weatherDetailTitle) return;
  const loc = weatherState.location;
  // 2026-07-28 W9 — 자리표시자 비교도 카탈로그를 거친 값과 해야 한다.
  // 예전 코드는 한국어 리터럴과 비교했는데, 이제 weatherState.location 이
  // 영어일 수 있으므로 그냥 두면 영어 화면에서 "Finding your location weather"
  // 같은 문장이 제목에 박힌다.
  const placeholders = [
    t("weather.locating", null, "위치 확인 중"),
    t("weather.currentLocation", null, "현재 위치"),
  ];
  const isPlaceholder = !loc || placeholders.indexOf(loc) !== -1;
  weatherDetailTitle.textContent = isPlaceholder
    ? t("weather.title", null, "날씨")
    : t("weather.titleWithLocation", { location: loc }, `${loc} 날씨`);
}

// 2026-08-10 이슈 제보 — "메인은 37도인데 상세에 들어가면 29도다."
//
// 두 화면이 같은 엔드포인트(/api/weather/current)를 보는데도 값이 갈린 이유는,
// 각자 자기 시점의 응답을 따로 들고 있었기 때문이다. 메인 칩(weatherState)은
// 앱 로드·10분 타이머·포그라운드 복귀 때만 갱신되고, 상세는 자기 15분 캐시로
// 따로 움직인다. 안드로이드에서 앱을 오래 재우면 웹뷰의 JS 상태는 살아 있는데
// 갱신 신호가 안 와서, 메인 칩만 어제 값(그날의 최고기온 37도)에 얼어붙는다.
// 상세를 열면 캐시가 만료돼 새로 받아오니 거기만 29도로 맞았다.
//
// 고치는 방향은 "둘을 더 자주 갱신하자"가 아니라 "둘이 같은 숫자를 보게 하자"다.
// 상세 요청이 성공하면 그 응답으로 메인 칩까지 함께 맞춘다 — 더 새로운 데이터가
// 손에 들어왔는데 옆 화면이 옛 숫자를 붙들고 있을 이유가 없다.
function syncMainChipFrom(current) {
  if (!current || typeof current.temp !== "number") return;
  const tag = vcCurrentTag(current);
  const isDay =
    typeof current.sunriseEpoch === "number" && typeof current.sunsetEpoch === "number"
      ? current.datetimeEpoch >= current.sunriseEpoch && current.datetimeEpoch < current.sunsetEpoch
      : true;
  const nextTemp = formatTemp(current.temp);
  const nextSummary = vcCurrentSummary(current);
  // 위치 문구는 역지오코딩 결과라 이 응답에 없다 — 기존 값을 그대로 둔다.
  if (weatherState && weatherState.temp === nextTemp && weatherState.summary === nextSummary) return;
  weatherState = {
    location: (weatherState && weatherState.location) || t("weather.currentLocation", null, "현재 위치"),
    temp: nextTemp,
    summary: nextSummary,
    icon: weatherIconFor(tag, isDay),
    tag
  };
  weatherResolved = true;
  renderWeather();
}

function renderWeatherCurrent(current, hourlyNowItem) {
  if (!wdCurrentTemp) return;
  updateWeatherDetailTitle();
  // 2026-07-18 9차 피드백: "지금 비가 안 오니 날씨별 애니메이션을 쉽게
  // 보여달라" — ?fxtest=1 스위처(아래 wdApplyTestScenario 참조)로 실제
  // 데이터가 아직 안 왔거나 실패했어도 시나리오를 바로 볼 수 있어야 하므로,
  // activeScenario가 있으면 current(실제 API 응답)가 null이어도 에러
  // 화면으로 빠지지 않는다.
  const activeScenario = wdActiveScenario();
  if (!activeScenario && (!current || !current.current)) {
    // 2026-07-20 유저 피드백("절대 한 번도 실패해서는 안 된다"): 타임아웃+
    // 자동재시도(fetchWeatherJson)로도 못 살린 진짜 실패라면, 화면을 비우는
    // 대신 마지막으로 성공했던 데이터를 "n분 전 정보"라고 밝히고 그대로
    // 보여준다. cached.currentData.current가 이미 확인된 값이라 아래
    // 재귀호출은 이 early-return 분기를 다시 타지 않고 정상 렌더 경로로
    // 간다(무한재귀 아님).
    const cached = wdLoadLastGoodCurrent();
    if (cached) {
      renderWeatherCurrent(cached.currentData, cached.hourlyNowItem);
      wdCurrentSub.textContent = t(
        "weather.staleNotice",
        { relative: wdMinutesAgoLabel(cached.savedAt) },
        `${wdMinutesAgoLabel(cached.savedAt)} 정보예요 · 새로고침에 실패했어요`
      );
      if (wdCurrentRetryBtn) wdCurrentRetryBtn.hidden = false;
      return;
    }
    wdCurrentTemp.textContent = "--°";
    if (wdCurrentHumidity) wdCurrentHumidity.textContent = "";
    wdCurrentSub.textContent = t(
      "weather.failed", null,
      "날씨 정보를 불러오지 못했어요. 아래 버튼으로 다시 시도해보세요."
    );
    if (wdCurrentRetryBtn) wdCurrentRetryBtn.hidden = false;
    if (wdCurrentSun) wdCurrentSun.textContent = "";
    if (wdCurrentWind) wdCurrentWind.textContent = "";
    if (wdCurrentIcon) wdCurrentIcon.textContent = "";
    wdCurrentIsRainingNow = false;
    wdCurrentRainSuffix = "";
    wdCurrentConditionBase = null;
    if (weatherDetailPanel) weatherDetailPanel.classList.remove("weather-detail-rainy");
    stopWeatherRainFxAll();
    return;
  }
  // 정상적으로 데이터가 들어온 경우엔(혹은 fxtest 시나리오가 켜진 경우엔)
  // 이전에 떠 있었을 수 있는 재시도 버튼을 다시 숨긴다.
  if (wdCurrentRetryBtn) wdCurrentRetryBtn.hidden = true;
  // 2026-07-18 7차 피드백: ?forceWeather=<시나리오>(또는 9차 피드백의
  // ?fxtest=1 스위처로 화면에서 직접 고른 시나리오)가 있으면 실제 관측치
  // 대신 WEATHER_TEST_SCENARIOS의 가짜 값을 써서 원하는 날씨 상태를
  // 결정론적으로 재현한다. 이때는 hourlyNowProb(실제 예보값)도 함께
  // 무시해야 "맑음" 테스트 중에 실제로 비가 오고 있어서 강수 판정이
  // 섞여드는 일이 없다.
  const c = activeScenario ? activeScenario : current.current;
  const hourlyNowProb = activeScenario
    ? null
    : hourlyNowItem && typeof hourlyNowItem.precipprob === "number"
      ? hourlyNowItem.precipprob
      : null;
  // 2026-07-24 이슈 제보 반영: hourly-strip "지금" 항목의 강수량(precipMm)도
  // 함께 넘겨서 deriveRainDisplay()의 AND 조건(확률>=50% && 강수량>=0.2mm/h)이
  // 아이콘·애니메이션·히어로 텍스트 전부에서 같은 기준으로 판정되게 한다.
  const hourlyNowMm = activeScenario
    ? null
    : hourlyNowItem && typeof hourlyNowItem.precipMm === "number"
      ? hourlyNowItem.precipMm
      : null;
  if (wdCurrentIcon) wdCurrentIcon.textContent = weatherEmojiFromCurrent(c, hourlyNowProb, hourlyNowMm);
  // 2026-07-18 4차 피드백: 애플 날씨처럼 비 오는 날엔 빗줄기 애니메이션을
  // 배경에 켠다(.weather-detail-rain-fx/-condensation, styles.css 참조) —
  // 아이콘과 같은 신호(실시간 precip/precipprob + hourly-strip "지금" 예보,
  // 5차 피드백 반영)를 써서 "아이콘은 비인데 애니메이션은 없다" 같은 모순이
  // 생기지 않게 한다. DEBUG_FORCE_RAIN(?forceRain=1)이면 무조건 켠다.
  // 2026-07-18 8차 피드백(Fable 5 검토 반영): preciptype이 눈뿐이면 비
  // 애니메이션을 켜지 않는다 — 예전엔 강수량/확률만 보고 판정해서 눈
  // 오는 날에도 빗줄기가 내리는 모순이 있었다(사소하지만 쉬운 교정).
  const precipTypes = (c.preciptype || []).map((t) => String(t).toLowerCase());
  const isSnowOnly = precipTypes.length > 0 && precipTypes.every((t) => t === "snow");
  // 2026-07-24 이슈 제보 반영: "확률>=50%거나 강수량>0" OR 조건이던 예전
  // 판정을 버리고, deriveRainDisplay()(확률>=50% && 강수량>=0.2mm/h AND
  // 조건)로 통일한다 — c(순간 관측)와 hourly-strip "지금" 예보 중 더 강한
  // 쪽을 각각 취해(effProb/effMm) 하나의 판정 근거로 쓰고, 이 값을 아래
  // 히어로 텍스트(NN%/mm 표시)에도 그대로 재사용해 판정과 표시가 항상
  // 같은 숫자를 말하게 한다.
  const effCurrentProb = Math.max(
    typeof c.precipprob === "number" ? c.precipprob : 0,
    typeof hourlyNowProb === "number" ? hourlyNowProb : 0
  );
  const effCurrentMm = Math.max(
    typeof c.precip === "number" ? c.precip : 0,
    typeof hourlyNowMm === "number" ? hourlyNowMm : 0
  );
  const currentRainDisplay = deriveRainDisplay(effCurrentProb, effCurrentMm);
  const isRainingNow = !isSnowOnly && (DEBUG_FORCE_RAIN || currentRainDisplay.showAsRain);
  if (weatherDetailPanel) weatherDetailPanel.classList.toggle("weather-detail-rainy", isRainingNow);

  // 2026-07-18 8차 피드백(Fable 5 검토 반영): 바람 세기·강수강도를 비
  // 애니메이션에 반영한다. ?forceWeather 테스트 시나리오가 켜져 있으면
  // 그 시나리오의 목업 바람/강도값을 쓰고(실제 API 바람 데이터와 섞이지
  // 않게), 아니면 실제 API 값(current.detail.wind, c.rainIntensity)을
  // 쓴다. c.rainIntensity는 백엔드가 classifyRainIntensity()로 이미
  // 계산해 내려주는 등급(경로 A, Fable 5 권고) — 프론트에서 임계값을
  // 복제하지 않아 로직이 한 곳에만 존재한다.
  const windInfoReal = current && current.detail && current.detail.wind;
  const windSpeedKmh = activeScenario
    ? activeScenario.windSpeedKmh || 0
    : windInfoReal
      ? windInfoReal.speedKmh
      : 0;
  const gustKmh = activeScenario
    ? activeScenario.gustKmh || windSpeedKmh
    : windInfoReal
      ? (windInfoReal.gustKmh ?? windInfoReal.speedKmh)
      : windSpeedKmh;
  const intensityGrade = activeScenario
    ? activeScenario.rainIntensityGrade || (isRainingNow ? "RAIN" : "NONE")
    : (c.rainIntensity && c.rainIntensity.grade) || (isRainingNow ? "RAIN" : "NONE");
  setWeatherRainParams(windSpeedKmh, gustKmh, intensityGrade);
  if (isRainingNow) startWeatherRainFxAll();
  else stopWeatherRainFxAll();
  wdCurrentTemp.textContent = formatTemp(c.temp);
  // 2026-07-20 11차 피드백(유저 요청): 습도를 조건텍스트 옆에서 기온
  // (wdCurrentTemp) 옆으로 이동.
  // 2026-07-20 12차 피드백(유저 요청): 가운뎃점(·) 접두사 삭제 — 빈
  // 문자열이면 CSS :empty가 display:none으로 접어 gap도 안 생긴다.
  if (wdCurrentHumidity) wdCurrentHumidity.textContent = t(
    "weather.detail.humidity",
    { value: Math.round(c.humidity) },
    `습도 ${Math.round(c.humidity)}%`
  );
  wdCurrentSub.textContent = "";

  // 2026-07-17 벤치마크 기획(묶음3): 일출·일몰 한 줄 — 현재 날씨 카드의
  // 부가 정보로. 백엔드가 오늘자 day에 sunrise/sunset이 없으면(과거 캐시가
  // 아직 안 갱신됐거나 응답에 값이 비어있는 경우) sun이 null로 내려오므로
  // 그 경우엔 줄 자체를 비워 레이아웃에 빈 여백이 남지 않게 한다.
  if (wdCurrentSun) {
    const sun = current && current.detail && current.detail.sun;
    wdCurrentSun.textContent = sun
      ? t(
          "weather.detail.sunriseSunset",
          { sunrise: sun.sunriseLabel, sunset: sun.sunsetLabel },
          `🌅 일출 ${sun.sunriseLabel} · 🌇 일몰 ${sun.sunsetLabel}`
        )
      : "";
  }

  // 2026-07-21 유저 요청: 최고/최저 기온 아래 바람 — 숫자(km/h)보다 "약함/
  // 강함" 체감 등급을 먼저 보여주고, 정확한 수치는 기상청 관례대로 m/s로
  // 환산해 작게 붙인다. fxtest 시나리오와 무관하게 항상 실제 API 값만
  // 쓴다(renderWeatherCurrentToday의 최고/최저와 같은 원칙 — 바람까지
  // 가짜로 바뀌면 오해 소지가 크다).
  // 2026-07-21 2차 피드백(유저 요청): 풍향("남남동풍" 등)은 복잡해 보이기만
  // 한다 — 빼고 강도라벨+수치만 남긴다.
  if (wdCurrentWind) {
    if (windInfoReal && typeof windInfoReal.speedKmh === "number") {
      const mps = Math.round(windInfoReal.speedKmh / 3.6);
      wdCurrentWind.innerHTML =
        t("weather.detail.wind", { label: windInfoReal.strengthLabel },
          `바람 ${windInfoReal.strengthLabel}`) + " " +
        `<span class="weather-current-wind-value">${mps}m/s</span>`;
    } else {
      wdCurrentWind.textContent = "";
    }
  }

  // 2026-07-20 11차 피드백(유저 요청): "강수확률·강수량은 비가 오는
  // 경우에만 조건텍스트 옆에 바로 붙여줘(예: '옅은 이슬비 강수확률 90%
  // 1mm/h')" — 9~10차의 상시표시 줄(wdCurrentRain)을 없애고, 이 카드의
  // isRainingNow(백엔드/시간대별 스트립과 같은 소스)로 게이트한다.
  //
  // 같은 요청의 두 번째 절반 — "옅은 이슬비인데 그 아래 시간대별 상세
  // 예보는 맑다고 한다, 모순이다"(유저 스크린샷 확인) — 당시엔 문구
  // (weatherState.summary)가 Open-Meteo, isRainingNow/시간대별 스트립은
  // 백엔드(Visual Crossing) 기준이라 서로 다른 프로바이더의 순간값이라
  // 어긋날 수 있었다. 2026-07-21 메인 한줄도 이 백엔드 하나로 통일한
  // 뒤로는(vcCurrentTag/vcCurrentSummary 참조) 두 값이 원리적으로 같은
  // 소스지만, weatherState는 requestCurrentWeather()의 독립된 10분 주기
  // 갱신이고 이 c는 fetchWeatherDetail()의 별도 호출 결과라 아주 짧은
  // 시차(둘 다 같은 4시간 D1 캐시를 보므로 보통은 완전히 같은 값) 안에서
  // 드물게 어긋날 여지는 남아있다 — 그 잔여 위험에 대한 안전망으로 이
  // 로직은 그대로 둔다. weatherState.summary가 강수를 말하는데 이 페이지의
  // isRainingNow가 아니라고 하면(= 아래 시간대별 스트립도 "지금"에 비
  // 아이콘이 없다는 뜻), 그 문구를 버리고 renderWeatherCurrentToday가
  // today.conditionsKo(스트립과 같은 백엔드 소스)로 대신 채우도록
  // wdCurrentConditionBase를 null로 넘긴다. 두 소스가 일치하는 절대다수의
  // 경우엔 그대로 weatherState.summary의 더 세밀한 표현을 쓴다.
  wdCurrentIsRainingNow = isRainingNow;
  const liveSummaryForCondition =
    typeof weatherState.summary === "string" && !weatherSummaryPlaceholders().includes(weatherState.summary)
      ? weatherState.summary
      : null;
  // 2026-07-29: 이 판정도 한국어 전용 정규식 하나뿐이었다. 영어·일본어
  // 화면에서는 무조건 false 가 되어 늘 아래 등급 라벨 분기로 떨어졌다.
  // 한국어는 예전 정규식을 **먼저** 그대로 태워 결과가 1비트도 안 바뀌게
  // 하고, 그 외 언어에서만 카탈로그가 실제로 내보내는 강수 라벨 집합과
  // 대조한다(문자열 비교를 언어별로 새로 짜지 않기 위함).
  const summaryIndicatesPrecip = liveSummaryForCondition
    ? (/비|눈|뇌우/.test(liveSummaryForCondition) ||
       precipSummaryLabels().includes(liveSummaryForCondition))
    : false;
  if (isRainingNow) {
    // weatherState.summary가 이미 강수를 말하면 그 표현을 그대로 쓰고,
    // 드물게 어긋나 있으면 백엔드 rainIntensity 등급 라벨(약한 비/비/
    // 강한 비 등)로 대체한다.
    wdCurrentConditionBase = summaryIndicatesPrecip
      ? liveSummaryForCondition
      : rainGradeLabel(c.rainIntensity) || conditionLabel(WX.CONDITION.RAIN, "비");
    // 2026-07-24: 판정에 실제로 쓰인 값(effCurrentProb/effCurrentMm)을 그대로
    // 표시한다 — 판정은 effProb/effMm로 해놓고 화면엔 c.precipprob(더 낮을
    // 수 있는 순간 관측치)를 보여주면 "비라며 정작 숫자는 낮다"는 또 다른
    // 모순이 생긴다.
    let prob = Math.round(effCurrentProb);
    const mm = Math.round(effCurrentMm * 10) / 10;
    if (prob === 0) prob = 5; // 비가 이미 확인됐는데 반올림으로 0%면 자기모순이니 최소 5%
    const showMm = mm >= 0.1;
    // 2026-07-20: 이제 별도 span(wdCurrentConditionRain)에 독립적으로
    // 넣으므로 조건 단어와 이어붙일 때 쓰던 선행 공백을 제거한다.
    // 2026-07-21 유저 요청: "강수확률"이라는 말을 빼고 퍼센티지만 바로 보이게.
    wdCurrentRainSuffix = `${prob}%${showMm ? ` ${mm}mm/h` : ""}`;
  } else {
    // 비가 아닌 상태 — weatherState.summary가 강수를 말하면(모순) 버리고
    // null로 넘겨 today.conditionsKo 폴백을 쓰게 한다.
    wdCurrentConditionBase = summaryIndicatesPrecip ? null : liveSummaryForCondition;
    wdCurrentRainSuffix = "";
  }
}

// 2026-07-18 2차 피드백: "상세 지표" 카드(바람·자외선지수·기압·가시거리·
// 이슬점)를 유저 요청으로 삭제 — renderWeatherDetailIndicators() 함수와
// 그 호출부(fetchWeatherDetail 안)를 함께 제거했다. 백엔드는
// current.detail 필드를 여전히 그대로 내려주므로(재배포 불필요), 나중에
// 다시 이 카드를 붙이고 싶으면 git 이력에서 이 함수(2026-07-17 벤치마크
// 기획 묶음1·2)를 그대로 복원하면 된다.

// 2026-07-17 벤치마크 기획(묶음4): 오늘 시간대별 예보 가로 스크롤 스트립.
// 주의 — 이 스트립은 #weatherDetailPanel(세로 스크롤 컨테이너) 안에 있는
// 가로 스크롤 영역이다. CLAUDE.md의 스크롤 절대 규칙(스크롤 필요한 UI는
// body 직속에)은 패널 자체에는 이미 적용돼 있어 안전하지만, "세로 스크롤
// 컨테이너 안의 가로 스크롤"이라는 이 조합은 아직 실기기 검증 전이다 —
// 배포 전 아이폰 사파리에서 좌우 스와이프가 실제로 움직이는지 반드시 확인.
function renderWeatherHourlyStrip(data) {
  if (!wdHourlyStrip) return;
  if (!data || !Array.isArray(data.hours) || data.hours.length === 0) {
    wdHourlyStrip.innerHTML = `<p class="weather-empty">${t("weather.hourly.unavailable", null, "시간대별 예보를 불러올 수 없어요.")}</p>`;
    return;
  }

  // 2026-07-19 6차 피드백: "퍼센트가 비올 확률인데, 비 아이콘이 없는
  // 시간대에도 항상 떠서 헷갈린다" — weatherEmojiFromHour()가 비 아이콘을
  // 고르는 기준과 정확히 같은 조건으로 맞춰서, 비 아이콘이 뜨는 시간대에만
  // 확률·강수량(mm)을 같이 보여준다. precipMm은 백엔드 buildHourlyStrip()이
  // 새로 내려주는 필드(구버전 캐시 대비 숫자가 아니면 0으로 방어). 빈
  // 문자열이어도 슬롯 자체는 유지(.weather-hourly-prob:empty가
  // visibility:hidden으로 높이를 보존해 카드 높이가 들쭉날쭉해지지 않게).
  // 2026-07-19 7차 피드백: "0mm인데도 비오는 걸로 치나, 0mm가 너무 많다" —
  // 강수확률(precipprob)만으로 비 아이콘/퍼센트 표시 여부를 정하다 보니,
  // 확률은 30% 넘어도 실제 강수량은 반올림하면 0.0mm인 시간대(안개비 수준
  // 이하)가 흔했다. mm 자체는 0.1mm 미만이면 아예 붙이지 않는다 — 그
  // 시간대엔 "N%"만 남고, 0.1mm 이상일 때만 "N% · X mm"로 같이 보여준다.
  // 2026-07-22 유저 요청: 문턱을 30%→50%로 올렸다(deriveRainDisplay 공유
  // 함수, vcCurrentTag/vcCurrentSummary와 동일 기준). 다만 이 카드는 폭이
  // 좁아 "흐림(약한 비 가능성 47%)" 같은 긴 문구를 넣을 자리가 없다 — 그래서
  // 확률<50%여도 실제 강수량이 1mm를 넘는 시간대엔 아이콘은 해/달 그대로
  // 두되 숫자(%)만 조용히 보여주는 절충으로 맞췄다(문구 없이 숫자만).
  wdHourlyStrip.innerHTML = data.hours
    .map((h) => {
      const precipMm = typeof h.precipMm === "number" ? h.precipMm : 0;
      const rainDisplay = deriveRainDisplay(h.precipprob, precipMm);
      // 2026-07-24 Fable 5 검토회신 반영: mm>=1 직접 판정을 여기서 중복하지
      // 않는다 — 그 문턱은 이미 deriveRainDisplay() 안에 있으므로 showProb를
      // 그대로 받아쓴다(①②는 true, ③은 false).
      const showProb = rainDisplay.showProb;
      const showMm = precipMm >= 0.1;
      const probHtml = showProb ? `${h.precipprob}%${showMm ? ` · ${precipMm}mm` : ""}` : "";
      return `
    <div class="weather-hourly-item" data-now="${h.isNow ? "true" : "false"}">
      <span class="weather-hourly-hour">${h.hourLabel}</span>
      <span class="weather-hourly-icon">${weatherEmojiFromHour(h.precipprob, precipMm, h.hourLabel, h.isNow, h.conditionsKo, h.hour24)}</span>
      <span class="weather-hourly-temp">${formatTemp(h.temp)}</span>
      <span class="weather-hourly-prob">${probHtml}</span>
    </div>`;
    })
    .join("");
}

// 2026-07-14 전면 재작성: "이번 주 강수 예보"를 오늘 포함 3일 상세 + 이후
// 4일 요약 + 이번 주말 코멘트 + 다음주 한 줄로 재구성. 백엔드
// buildWeeklyRainOutlook()의 응답 구조를 그대로 렌더링한다.
// 2026-07-18 3차 피드백: "이번 주 강수 예보" 카드의 '주말' 딱지 제거 —
// dateLabel(예: "07/19(일)")에 이미 요일이 괄호로 표기돼 있어 중복이라는
// 유저 피드백. '오늘' 딱지는 요일 표기만으로는 알 수 없는 정보라 유지한다.
function renderRainDayCard(day) {
  const todayTag = day.isToday
    ? `<span class="weather-rain-day-tag">${t("weather.weekly.today", null, "오늘")}</span>`
    : "";
  const windowsHtml =
    day.windows && day.windows.length > 0
      ? day.windows
          .map(
            (w) => `
      <div class="weather-rain-window">
        <div>
          <div class="weather-rain-window-time">${w.timeLabel}</div>
          <div class="weather-rain-window-detail">누적 ${w.totalPrecipMm}mm</div>
        </div>
        ${weatherBadgeHtml(w.intensity.grade, w.intensity.label, w.maxPrecipProb)}
      </div>`
          )
          .join("")
      : `<p class="weather-empty">${t("weather.rain.none", null, "비 소식 없어요.")}</p>`;
  return `
    <div class="weather-rain-day">
      <p class="weather-rain-day-label">${day.dateLabel}${todayTag}</p>
      ${windowsHtml}
    </div>`;
}

// 2026-07-15: 우산조언(umbrellaToday)을 강수예보 카드 안이 아니라 화면
// 맨 위 wdTopComment로 뺀다(유저 피드백: "코멘트 2~3줄은 상단으로, '이번 주
// 강수 예보'는 그 아래로"). 문구 자체는 그대로 재사용 — 두 함수가 같은
// rain-windows API 응답(data.umbrellaToday)을 나눠서 채울 뿐이다.
// 2026-08-05 운영 지침 — 한국 장마철 판정.
// "비 소식이 없어요, 우산 없이 다녀와도 괜찮아요"는 비가 올지 말지가 매일의
// 관심사인 기간에만 살가운 말이다. 평상시에는 당연한 걸 말하는 것이라 낯설다.
// 기상청 기준 중부지방 장마는 해마다 다르지만 대체로 6월 하순에 시작해
// 7월 하순에 끝난다 — 창을 6/20~7/31로 넉넉히 잡아도 "비가 관심사인 기간"을
// 벗어나지 않는다. 한국 밖 사용자에게는 장마라는 개념 자체가 없으므로
// 이 창을 적용하지 않고, 비가 없는 날에는 그냥 말을 아낀다.
function isKoreanRainySeason(now) {
  try {
    if (!isKoreanLocale()) return false;
    const d = now instanceof Date ? now : new Date();
    const month = d.getMonth() + 1;   // 1~12
    const day = d.getDate();
    if (month === 6) return day >= 20;
    if (month === 7) return true;
    return false;
  } catch (error) {
    return false;   // 판정 실패 시엔 조용한 쪽으로
  }
}

function renderWeatherTopComment(data) {
  if (!wdTopComment) return;
  if (!data || !data.umbrellaToday) {
    wdTopComment.textContent = "";
    return;
  }
  // 2026-08-05 운영 지침 — 우산 인사는 두 갈래로 나뉜다.
  //   · 비가 온다(needed=true) — 언제나 말한다. 계절과 무관하게 필요한 정보다.
  //   · 비 소식이 없다(needed=false) — 한국 장마철에만 말한다. 그 밖에는
  //     아무 말도 하지 않는다("비 안 온다"는 말은 평상시엔 당연한 소리다).
  if (!data.umbrellaToday.needed && !isKoreanRainySeason()) {
    wdTopComment.textContent = "";
    wdTopComment.removeAttribute("data-needed");
    return;
  }
  // 2026-07-19 6차 피드백: 이모티콘 접두사(☔) 제거 — 유저 요청.
  wdTopComment.textContent = data.umbrellaToday.message;
  wdTopComment.setAttribute("data-needed", String(data.umbrellaToday.needed));
}

// 2026-07-17 2차 기획(묶음B, Fable 5 우선순위 3위): "3시간 뒤 비가 와요" —
// 우산조언 코멘트 바로 아래 짧은 한 줄로 붙인다. 이번 주에 비 소식이 아예
// 없으면(available:false) 굳이 "비 소식 없어요"를 여기서 또 말하지 않는다
// — 우산조언 문장이 이미 그 얘기를 하고 있어 중복이기 때문.
// 2026-07-18 2차 피드백: "지금 비가 오고 있어요"도 같은 이유로 뺀다 —
// isRainingNow일 때 이 문구가 뜨는데, 맨 위 현재 날씨 아이콘이 이미
// weatherEmojiFromCurrent()로 실시간 강수 여부를 반영해 비 아이콘을
// 보여주고 있으므로(위 weatherEmojiFromCurrent 참조) 텍스트로 한 번 더
// "지금 비가 온다"고 말하는 건 중복이다. isRainingNow가 아닐 때(몇 시간
// 뒤 비 예보 등)는 아이콘이 알려줄 수 없는 정보라 그대로 보여준다.
function renderWeatherNextRain(data) {
  if (!wdNextRain) return;
  const countdown = data && data.nextRainCountdown;
  if (!countdown || !countdown.available || countdown.isRainingNow) {
    wdNextRain.textContent = "";
    return;
  }
  // 2026-07-19 6차 피드백: 이모티콘 접두사(⏳) 제거 — 유저 요청.
  wdNextRain.textContent = countdown.message;
}

// 2026-08-04 운영 지침 — 폭염(35°+)·강추위(-10°−)에는 이용자를 챙기는
// 케어 한 줄을 덧붙인다("그늘에서 틈틈이 쉬어가세요. 건강이 먼저예요.").
// 사람이 살가운 느낌이 드는 인간적인 앱 — 백엔드 careComment(rain-windows
// 응답, logic.ts buildTempCareComment)를 그대로 보여주기만 한다.
function renderWeatherCare(data) {
  if (!wdCareComment) return;
  const care = data && data.careComment;
  wdCareComment.textContent = care && care.message ? care.message : "";
}

// 2026-07-21 3차 기획: 기상특보(KMA). 유저 요청 "맨 위 날씨 코멘트에
// 기상특보가 있다면 표현되면 좋겠다".
// data.active가 false인 경우(특보 없음/서비스키 미설정/한국 영역 밖/API
// 실패 전부 포함)는 배너 자체를 숨긴다 — 어떤 이유로 못 보여주는지를
// 유저에게 굳이 알릴 필요는 없다(날씨 조회 실패와 달리 이건 "정보가
// 없다"는 상태이지 에러 상태가 아니다).
// 2026-07-21 2차 피드백: 별도 레이어팝업이 열리지 않는 문제가 있어(원인
// 추정: weatherDetailPanel과 같은 z-index:20이라 DOM 순서만으론 항상
// 위로 뜬다는 보장이 없었던 것으로 보임 — .app-page도 .settings-panel도
// 전부 z-index:20 동일값), 배너 바로 아래로 펼쳐지는 인라인 아코디언으로
// 전환했다. 이미 스크롤되는 #weatherDetailPanel 안의 콘텐츠 일부라 별도
// 오버레이 스택킹/재부착 문제 자체가 생기지 않는다.
// 활성 특보의 tmFc가 "이미 확인함" 기록과 다르면 배지를 켠다. 특보가
// 없거나(활성 아님) 이미 확인한 tmFc와 같으면(=같은 특보를 이미 봤음) 끈다.
function updateWeatherAdvisoryDot(activeData) {
  if (!weatherAdvisoryDot) return;
  if (!activeData || !activeData.tmFc) {
    weatherAdvisoryDot.hidden = true;
    return;
  }
  let acked = null;
  try {
    acked = localStorage.getItem(WEATHER_ADVISORY_ACK_KEY);
  } catch (e) {
    acked = null;
  }
  weatherAdvisoryDot.hidden = String(activeData.tmFc) === acked;
}

function renderWeatherAdvisory(data) {
  // ★ 2026-07-29 시뮬레이터 실측으로 잡은 결함 ★
  // 일본어 기기 + Cupertino 위치인데 화면에 한국 기상특보가 떴다
  // ("폭염경보 : 경기도(고양, 남양주…)"). applyKoreaOnlyGating() 이
  // wdAdvisoryBanner.hidden = true 를 이미 걸어뒀는데도 그랬다.
  //
  // 원인은 CSS 우선순위였다. hidden 속성의 display:none 은 **UA 스타일시트**가
  // 주는 것이고, styles.css 의 `.weather-advisory-banner.is-active { display:flex }`
  // 는 **작성자 스타일시트**다 — 작성자 쪽이 항상 이긴다. 그래서 게이트가
  // hidden 을 걸어놔도, 특보 응답이 도착해 is-active 가 붙는 순간 배너가
  // 도로 보였다. 에러도 경고도 없이 게이트만 조용히 무력화되는 종류다.
  //
  // 이건 언어와 무관한 버그다 — 미국의 영어 사용자도 똑같이 한국 특보를
  // 봤다. 기상특보 데이터는 기상청 전국 자료라 좌표와 무관하게 내려온다.
  //
  // 수정은 두 겹이다.
  //   1) 여기서 게이트를 다시 확인해, 꺼져 있으면 is-active 를 아예 안 붙인다
  //   2) styles.css 에 `[hidden] { display:none !important }` 를 더해
  //      "hidden 인데 보이는" 상태 자체가 불가능하게 만든다
  // 한국 사용자는 게이트가 항상 켜져 있으므로 동작이 바뀌지 않는다.
  if (wdAdvisoryBanner && wdAdvisoryBanner.hidden) {
    wdAdvisoryBanner.classList.remove("is-active");
    wdAdvisoryBanner.setAttribute("aria-hidden", "true");
    collapseWeatherAdvisoryDetail();
    return;
  }
  wdLastAdvisoryData = data && data.active ? data : null;
  updateWeatherAdvisoryDot(wdLastAdvisoryData);
  if (!wdAdvisoryBanner || !wdAdvisoryBannerText) return;
  if (!wdLastAdvisoryData) {
    wdAdvisoryBanner.classList.remove("is-active");
    wdAdvisoryBanner.setAttribute("aria-hidden", "true");
    collapseWeatherAdvisoryDetail();
    return;
  }
  // 2026-07-21 3차 피드백으로 우선순위 반전: title(t1)은 "가장 최근에
  // 발표된 개별 통보문의 제목"이라, 그게 하필 어떤 특보의 "해제"일 때
  // 다른 특보가 여전히 활성 상태여도 배너에 "OO 해제"라고만 떠서 오해를
  // 줄 수 있다(실측 사례: 호우주의보 해제 통보문이 최신이지만 이 자체는
  // active 판정과 무관 — statusText가 진짜 "지금 유효한 것 전체"다).
  // statusText(t6, 특보발효현황내용)의 첫 줄을 배너 대표 문구로 우선
  // 쓰고, 혹시 비어있으면 title로, 그마저 없으면 최후 폴백 문구.
  const firstLine = (text) => (text ? text.split(/\r?\n/)[0].trim() : "");
  wdAdvisoryBannerText.textContent =
    firstLine(wdLastAdvisoryData.statusText) || wdLastAdvisoryData.title || "기상특보 발효 중";
  wdAdvisoryBanner.classList.add("is-active");
  wdAdvisoryBanner.setAttribute("aria-hidden", "false");
  renderWeatherAdvisoryDetailContent(wdLastAdvisoryData);
}

function advisoryRow(label, value) {
  if (value === null || value === undefined || value === "") return "";
  // 기상청 응답이 줄바꿈에 \r\n을 섞어 보내는 경우가 있어(예: note 필드
  // "o 없음\r\n\r\n"), pre-line이 \r을 지저분하게 남기지 않도록 정리한다.
  // 2026-07-22 Fable: 값이 문자열이 아닐 수 있어(숫자 tmFc 등) String() 강제.
  const cleaned = String(value).replace(/\r\n/g, "\n").trim();
  if (!cleaned) return "";
  return `
    <div class="weather-advisory-detail-row">
      <p class="weather-advisory-detail-label">${label}</p>
      <p class="weather-advisory-detail-value">${cleaned}</p>
    </div>`;
}

// tmFc는 "YYYYMMDDHHmm" 형식 — 백엔드에 별도 포맷터를 두지 않고 여기서만
// 가볍게 가공한다(화면 표시 전용, 판단 로직이 아니라 새로 만들어도
// "로직은 한 곳에만" 원칙과 무관).
function formatAdvisoryTmFc(tmFc) {
  // 2026-07-22 Fable — "펼침 눌러도 빈 화면" 사건의 진범: KMA 응답의 tmFc는
  // 따옴표 없는 숫자(예: 202607221610)로 내려온다(weatherAdvisory.ts 주석에도
  // 명시). 숫자에는 .length가 없어 아래 가드가 undefined<12=false로 뚫리고,
  // 곧바로 tmFc.slice에서 TypeError가 터졌다. 이 예외가 rows 문자열 조립
  // 도중에 발생해 wdAdvisoryDetail.innerHTML 대입까지 도달하지 못했고 —
  // 그래서 상세도, "표시할 특보 상세가 없어요" 폴백조차도 영영 안 그려졌다.
  // 문자열로 강제 변환해 근본 차단한다.
  tmFc = tmFc === null || tmFc === undefined ? "" : String(tmFc);
  if (!tmFc || tmFc.length < 12) return tmFc || "";
  const y = tmFc.slice(0, 4);
  const mo = tmFc.slice(4, 6);
  const d = tmFc.slice(6, 8);
  const h = tmFc.slice(8, 10);
  const mi = tmFc.slice(10, 12);
  return `${y}.${mo}.${d} ${h}:${mi}`;
}

function renderWeatherAdvisoryDetailContent(data) {
  if (!wdAdvisoryDetail) return;
  const rows =
    advisoryRow("현재 발효 현황", data.statusText) +
    advisoryRow("해당구역", data.areaText) +
    advisoryRow("내용", data.content) +
    advisoryRow("예비특보 발효현황", data.preAdvisoryText) +
    advisoryRow("참고사항", data.note) +
    advisoryRow("발표시각", formatAdvisoryTmFc(data.tmFc));
  wdAdvisoryDetail.innerHTML = rows || `<p class="weather-empty">표시할 특보 상세가 없어요.</p>`;
}

// 펼침(▾)/오므리기(▴) 아이콘과 aria-expanded를 함께 토글한다 — 유저 요청:
// "'더보기'가 아니라 '펼침'을 상징하는 기호로, 토글로 반대로 '오므리기'를
// 상징하는 기호로".
function collapseWeatherAdvisoryDetail() {
  if (wdAdvisoryDetail) wdAdvisoryDetail.hidden = true;
  if (wdAdvisoryMoreBtn) wdAdvisoryMoreBtn.textContent = "▾";
  if (wdAdvisoryBannerHead) {
    wdAdvisoryBannerHead.setAttribute("aria-expanded", "false");
    wdAdvisoryBannerHead.setAttribute("aria-label", "기상특보 상세 펼치기");
  }
}

function toggleWeatherAdvisoryDetail() {
  if (!wdAdvisoryDetail) return;
  const willExpand = wdAdvisoryDetail.hidden;
  wdAdvisoryDetail.hidden = !willExpand;
  if (wdAdvisoryMoreBtn) wdAdvisoryMoreBtn.textContent = willExpand ? "▴" : "▾";
  if (wdAdvisoryBannerHead) {
    wdAdvisoryBannerHead.setAttribute("aria-expanded", String(willExpand));
    wdAdvisoryBannerHead.setAttribute("aria-label", willExpand ? "기상특보 상세 접기" : "기상특보 상세 펼치기");
  }
  wxDiagReport("toggle(펼침탭 순간)", wdLastAdvisoryData);
}

// 2026-07-22: 탭 표적을 아이콘 하나에서 배너 head 전체로 확장 — 헤드
// 안에서 클릭이 일어나면(아이콘 위 클릭 포함, 버블링으로 자동 수신)
// 한 번만 토글되도록 리스너는 head 하나에만 건다(아이콘엔 별도로 걸지
// 않음 — 중복 바인딩 시 아이콘 클릭이 두 번 토글돼 원상태로 되돌아가는
// 버그가 생긴다).
if (wdAdvisoryBannerHead) {
  wdAdvisoryBannerHead.addEventListener("click", toggleWeatherAdvisoryDetail);
  wdAdvisoryBannerHead.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      toggleWeatherAdvisoryDetail();
    }
  });
}

function renderWeatherRainWindows(data) {
  if (!wdRainWindows) return;
  if (!data || !Array.isArray(data.detailedDays)) {
    wdRainWindows.innerHTML = `<p class="weather-empty">${t("weather.rain.unavailable", null, "강수 예보를 불러올 수 없어요.")}</p>`;
    return;
  }

  const daysHtml = data.detailedDays.map(renderRainDayCard).join("");
  const laterHtml = data.laterSummary ? `<p class="weather-comment">${data.laterSummary.comment}</p>` : "";
  const weekendHtml = data.weekendComment
    ? `<p class="weather-comment weather-rain-outlook-weekend">${data.weekendComment}</p>`
    : "";

  // 2026-07-14: "다음 주는 예보 범위 밖이에요" 같은 무능력 고지는 넣지 않는다
  // (유저 피드백: "예보할 수 없으면 아예 코멘트를 하지 말아야 한다") — 백엔드가
  // 아예 nextWeekComment 필드를 내려주지 않으므로 여기서도 별도 처리 없음.
  wdRainWindows.innerHTML = `
    ${daysHtml}
    <div class="weather-rain-outlook-extra">
      ${laterHtml}
      ${weekendHtml}
    </div>`;
}

// 2026-07-17 2차 기획(묶음A, Fable 5 우선순위 2위): 주간 기온 예보 —
// 강수 위주인 위 카드와 달리 7일 최저·최고 기온을 세로 리스트로 훑어본다.
// 가로 스크롤이 아니라 세로 리스트로 만든 이유: Fable 5 검토에서 지적된
// "세로 스크롤 컨테이너 안의 가로 스크롤" 리스크를 새 카드에서 또 만들지
// 않기 위해서다 — 이 카드는 세로로만 쌓이므로 스크롤 축 충돌 자체가 없다.
function renderWeatherWeeklyForecast(data) {
  if (!wdWeeklyForecast) return;
  if (!data || !Array.isArray(data.days) || data.days.length === 0) {
    wdWeeklyForecast.innerHTML = `<p class="weather-empty">${t("weather.weekly.unavailable", null, "주간 예보를 불러올 수 없어요.")}</p>`;
    return;
  }

  // 2026-07-18 유저 피드백: 오늘/주말 딱지 제거, 칼럼 순서를 요일→아이콘→
  // 날씨텍스트→기온범위로 바꾸고, 비 올 확률은 별도 칼럼 없이 "비"로
  // 표기된 날에만 그 텍스트 바로 밑에 서브라인으로 붙인다.
  // 2026-07-20 8차 피드백(유저 요청): "비 오는 날, 시간당 최대 몇 mm인지"
  // — 백엔드 buildWeeklyForecastCard()가 새로 내려주는 maxHourlyPrecipMm을
  // 확률 옆에 같이 붙인다. 0.1mm 미만(7차 피드백과 동일 기준)이면 mm는
  // 생략하고 확률만 남긴다 — 구름·안개비 수준까지 "0mm"로 노출되는 걸 막기 위함.
  wdWeeklyForecast.innerHTML = data.days
    .map((d) => {
      // 2026-07-20 9차 피드백(유저 요청): "'최대'라는 말은 삭제, 퍼센트
      // 뒤의 가운뎃점도 빼줘" — "70% 3.2mm/h"처럼 공백만 남긴다.
      const maxMm = typeof d.maxHourlyPrecipMm === "number" ? d.maxHourlyPrecipMm : 0;
      // 2026-07-22 유저 요청: current/hourly와 같은 deriveRainDisplay() 공유 —
      // 확률<50%면 "비"라고 단정하지 않는다. 백엔드 mapConditionsToKo()가
      // "비"로 내려준 날이라도 확률이 50% 미만이면 여기서 "흐림"으로 강등
      // 표시하고, 그중 강수량(mm)이 1mm를 넘는 애매한 날만 "흐림(약한 비
      // 가능성 NN%)"로 확률을 같이 보여준다.
      let rainDisplay = deriveRainDisplay(d.precipprob, maxMm);
      let probForDisplay = d.precipprob;
      let mmForDisplay = maxMm;
      let isRainStopped = false;

      // 2026-07-24 이슈 제보 반영, 같은 날 Fable 5 검토회신으로 사다리 재정렬
      // (FABLE5_검토회신_비표시일관성_2026-07-24.md): "오늘" 행만 하루 전체
      // (자정~24시) 확률로 판단하면, 이미 새벽에 그친 비가 마치 "이제부터
      // 올 비"처럼 보여 시간대별 스트립·우산 조언(둘 다 지금 이후만 봄)과
      // 모순된다. 원칙 — "미래가 항상 과거를 이긴다": 미래에 조금이라도
      // 신호가 있으면(확정 비 "rain"이든 절충 신호 "maybe"든) 과거 확정
      // 여부와 무관하게 항상 미래 쪽 문구를 쓴다("maybe"면 히어로와 정확히
      // 같은 "약한 소나기 가능성 NN%" 문구가 되어 모순이 구조적으로
      // 불가능해진다). "비(그침)"은 미래가 완전히 조용(state "none")하고
      // 과거에 확정된 비가 있었을 때만 말한다.
      const hasSplit =
        d.isToday &&
        typeof d.futurePrecipProb === "number" &&
        typeof d.futureMaxHourlyPrecipMm === "number" &&
        typeof d.pastPrecipProb === "number" &&
        typeof d.pastMaxHourlyPrecipMm === "number";
      if (hasSplit) {
        const futureRain = deriveRainDisplay(d.futurePrecipProb, d.futureMaxHourlyPrecipMm);
        const pastRain = deriveRainDisplay(d.pastPrecipProb, d.pastMaxHourlyPrecipMm);
        if (futureRain.state === "none" && pastRain.state === "rain") {
          isRainStopped = true;
        } else {
          rainDisplay = futureRain;
          probForDisplay = d.futurePrecipProb;
          mmForDisplay = d.futureMaxHourlyPrecipMm;
        }
      }

      const wk = deriveWeeklyConditionDisplay(d, rainDisplay, isRainStopped, probForDisplay, mmForDisplay);
      return `
    <div class="weather-weekly-row">
      <span class="weather-weekly-day">${d.weekdayKo}</span>
      <span class="weather-weekly-icon">${wk.icon}</span>
      <span class="weather-weekly-mid">
        <span class="weather-weekly-condition">${wk.text}</span>
        ${wk.probHtml}
      </span>
      <span class="weather-weekly-range">
        <span class="weather-weekly-min">${formatTemp(d.tempMin)}</span>
        <span class="weather-weekly-bar" aria-hidden="true"></span>
        <span class="weather-weekly-max">${formatTemp(d.tempMax)}</span>
      </span>
    </div>`;
    })
    .join("");
}

// 2026-07-19 5차 리디자인(유저 요청: "상단 날씨 요약 부분은 애플 아이폰
// 기본 날씨 앱 스타일로 가자, 똑같이 해보자"): 애플 날씨는 큰 온도 아래에
// "흐림" 같은 날씨 상태 텍스트, 그 아래 "최고:28° 최저:23°" 한 줄이 온다.
// 이 정보(오늘의 날씨텍스트·최고·최저)는 새 API 호출을 만들지 않고 이미
// fetchWeatherDetail()이 받아오는 weekly-forecast 응답의 오늘자
// (data.days[0])를 재사용한다 — 주간예보 리스트의 "일" 첫 행과 정확히
// 같은 값이라 화면 두 군데의 수치가 어긋날 일도 없다. renderWeatherCurrent
// (현재 온도·아이콘·체감·습도)와는 데이터 출처가 달라 별도 함수로 분리했다
// — fxtest 시나리오 스위처(wdApplyTestScenario)는 이 값을 건드리지 않고
// 항상 실제 API값을 유지한다(아이콘/비연출만 테스트용으로 바뀌는 것과
// 의도적으로 분리 — 오늘 실제 최고/최저까지 가짜로 바뀌면 오해 소지가 큼).
// 2026-07-20 9차 피드백(운영 피드백): "메인페이지는 '옅은 이슬비'처럼 세밀한데
// 날씨상세는 '비'로 대충 나온다, 왜 상세페이지가 더 대충이냐?" — 당시 원인은
// 두 화면이 서로 다른 날씨 소스를 쓰고 있었기 때문이다. 메인페이지 브리핑
// (weatherState.summary)은 Open-Meteo WMO 코드 기반 weatherCodeToSummary()가
// 옅은 이슬비/이슬비/짙은 이슬비 등 10여 단계로 세밀하게 분류하는데, 날씨상세
// 히어로는 Visual Crossing 기반 weekly-forecast의 conditionsKo(맑음/구름
// 조금/구름 많음/흐림/비/눈/천둥번개 7단계뿐)를 썼다. 새 분류기를 또 만드는
// 대신, 이미 메인페이지에서 쓰고 있는 weatherState.summary를 그대로 재사용
// 한다 — 두 화면이 "같은 계산의 다른 표현"이 아니라 "같은 값"을 보게 되어
// 앞으로도 어긋날 일이 구조적으로 없다.
// 2026-07-21 갱신: 그 뒤로 메인페이지 브리핑 자체도 Open-Meteo를 완전히
// 걷어내고 이 백엔드(Visual Crossing) 기반 vcCurrentSummary()로 바뀌었다
// (requestCurrentWeather() 참조 — 비영리 전용 ToS 리스크 제거 + 두 화면
// 소스 통일이 목적). 이 함수가 weatherState.summary를 재사용하는 설계는
// 그대로 유효하고 오히려 더 튼튼해졌다 — 이제는 "같은 프로바이더의 다른
// 표현"이 아니라 "같은 프로바이더의 같은 계산"을 재사용하는 것이기 때문이다.
// weatherState.summary가 아직
// 위치 권한 대기 등으로 플레이스홀더("위치 권한 필요"/"날씨 오류")인
// 경우에만 예전처럼 conditionsKo로 폴백한다.
// 2026-07-28 W9-4 — ★ 이 목록은 반드시 weatherState.summary 를 만드는
// 코드와 **같은 카탈로그 키**를 써야 한다 ★. W9-1 에서 summary 를
// 로케일화했는데 여기가 한국어 리터럴로 남아 있어, 영어 화면에서는
// 어떤 값과도 일치하지 않아 "다시 시도" 버튼이 영영 안 뜨는 회귀가
// 생겼다(스캐너가 잡아냄). 상수 대신 함수로 둬서 로케일이 바뀌어도
// 항상 현재 언어 기준으로 비교되게 한다.
function weatherSummaryPlaceholders() {
  return [
    t("weather.permissionNeeded", null, "위치 권한 필요"),
    t("weather.error", null, "날씨 오류"),
  ];
}
// 2026-07-20 11차 피드백(운영 피드백): "옅은 이슬비 강수확률 5%"인데 바로
// 아래 시간대별 상세 예보(백엔드/Visual Crossing 기준)는 "지금" 시간에
// 맑음 아이콘을 보여주는 모순이 스크린샷으로 실측됐다. wdCurrentConditionBase/
// wdCurrentRainSuffix는 renderWeatherCurrent()(항상 이 함수보다 먼저
// 실행됨, fetchWeatherDetail 참조)가 이미 "두 소스가 일치하는지" 판단해
// 넘겨주는 값이다 — null이면 불일치 상태라는 뜻이므로 today.conditionsKo
// (백엔드 기준, 시간대별 스트립과 같은 소스)로 폴백해 이 화면 안에서는
// 항상 서로 맞는 말을 하게 한다.
function renderWeatherCurrentToday(data) {
  if (!wdCurrentCondition && !wdCurrentHiLo) return;
  const today = data && Array.isArray(data.days) ? data.days[0] : null;
  if (wdCurrentCondition) {
    const baseText = wdCurrentConditionBase != null ? wdCurrentConditionBase : today ? today.conditionsKo || "" : "";
    // 2026-07-20 유저 피드백: 조건 단어(큰 폰트)와 강수확률/mm 보조정보
    // (작은 폰트, wdCurrentHiLo와 같은 크기)를 별개 span으로 분리한다.
    wdCurrentCondition.textContent = baseText;
    if (wdCurrentConditionRain) {
      wdCurrentConditionRain.textContent = baseText ? wdCurrentRainSuffix : "";
    }
  }
  if (wdCurrentHiLo) {
    const hasRange = today && typeof today.tempMax === "number" && typeof today.tempMin === "number";
    // ★ ° 는 formatTemp 안에 있다 ★ 카탈로그 템플릿은 "{high} {low}" 처럼
    // 단위 기호 없이 두고, 값이 기호를 달고 온다. 예전엔 템플릿에 °를 두고
    // 코드에서 떼어내는(replace) 방식이었는데, 그러면 화씨·섭씨로 표기가
    // 갈릴 때 기호를 두 곳에서 관리하게 된다.
    wdCurrentHiLo.textContent = hasRange
      ? t("weather.detail.highLow",
          { high: formatTemp(today.tempMax), low: formatTemp(today.tempMin) },
          `최고:${formatTemp(today.tempMax)} 최저:${formatTemp(today.tempMin)}`)
      : "";
    // 2026-08-23 — 기상 화면(알람)에서 '오늘 날씨'로 쓰라고 전역에 담아 둔다.
    try {
      window.__flipzenTodayHiLo = hasRange
        ? t("weather.detail.highLow",
            { high: formatTemp(today.tempMax), low: formatTemp(today.tempMin) },
            `최고 ${formatTemp(today.tempMax)} 최저 ${formatTemp(today.tempMin)}`)
        : (window.__flipzenTodayHiLo || "");
    } catch (e) { /* 무시 */ }
  }
}

// 2026-07-14 재설계: "지난 24시간" 수치 나열이 아니라 "향후 24시간이 지난
// 24시간보다 덥다/춥다/습하다"를 한 줄 코멘트로 먼저 보여주고, 그 아래
// 지난/향후 두 구간을 나란히 대조한다(누적강수는 뺐다 — 유저 피드백:
// "직관적으로 비교해서 말해주려는 것이다. 누적강수는 필요 없다").
// 예전에 따로 있던 "어제와 비교하면" 카드는 이 카드로 흡수돼 삭제됐다.
function renderWeatherYesterday(data) {
  if (wd24hComparison) {
    // ★ comparison 은 백엔드가 만드는 한국어 서술문이다 ★
    // 운영자 확정(2026-07-29): 날씨 상세의 서술문은 비한국어에서 아예 뺀다.
    // 라벨은 번역하되 문장은 내보내지 않는다 — 영어 화면에 한국어 문장이
    // 끼어드는 것보다, 아래 두 칼럼 대조표만 보여주는 편이 낫다.
    // (백엔드 문장 템플릿이 다국어화되면 그때 이 게이트를 풀면 된다.)
    const showSentence = isKoreanLocale();
    wd24hComparison.textContent = showSentence && data && data.comparison ? data.comparison : "";
  }
  if (!wdYesterday) return;
  if (!data || !data.past24h || !data.next24h) {
    wdYesterday.innerHTML = `<p class="weather-empty">${t("weather.compare.unavailable", null, "비교 정보를 불러올 수 없어요.")}</p>`;
    return;
  }
  const p = data.past24h;
  const n = data.next24h;
  // 2026-07-18 2차 피드백: "좌측열 숫자는 우측 정렬, 우측열 숫자는 좌측
  // 정렬해서 맞닿게" — 오른쪽(향후 24시간) 칼럼에 weather-24h-col--future
  // 클래스를 추가한다. styles.css의 .weather-24h-col--future .weather-stat-tile
  // 규칙이 이 클래스를 보고 타일 내부를 row-reverse로 뒤집어, 값이 가운데
  // 경계 쪽(왼쪽), 라벨이 바깥쪽(오른쪽)에 오도록 만든다 — 왼쪽 칼럼과
  // 대칭을 이루며 두 값이 가운데서 마주본다.
  // 라벨은 카탈로그를 거친다. 한국어는 카탈로그 값이 예전 문자열과 글자
  // 그대로 같아서 화면이 바뀌지 않는다(골든이 이를 보증한다).
  const lPast = t("weather.compare.past24h", null, "🌙 지난 24시간");
  const lNext = t("weather.compare.next24h", null, "☀️ 향후 24시간");
  const lMin = t("weather.compare.tempMin", null, "최저기온");
  const lMax = t("weather.compare.tempMax", null, "최고기온");
  const lHum = t("weather.compare.humidityAvg", null, "평균습도");
  wdYesterday.innerHTML = `
    <div class="weather-24h-col">
      <p class="weather-24h-col-label">${lPast}</p>
      <div class="weather-stat-tile"><span class="weather-stat-label">${lMin}</span><span class="weather-stat-value">${formatTemp(p.tempMin)}</span></div>
      <div class="weather-stat-tile"><span class="weather-stat-label">${lMax}</span><span class="weather-stat-value">${formatTemp(p.tempMax)}</span></div>
      <div class="weather-stat-tile"><span class="weather-stat-label">${lHum}</span><span class="weather-stat-value">${Math.round(p.humidityAvg)}%</span></div>
    </div>
    <div class="weather-24h-col weather-24h-col--future">
      <p class="weather-24h-col-label">${lNext}</p>
      <div class="weather-stat-tile"><span class="weather-stat-label">${lMin}</span><span class="weather-stat-value">${formatTemp(n.tempMin)}</span></div>
      <div class="weather-stat-tile"><span class="weather-stat-label">${lMax}</span><span class="weather-stat-value">${formatTemp(n.tempMax)}</span></div>
      <div class="weather-stat-tile"><span class="weather-stat-label">${lHum}</span><span class="weather-stat-value">${Math.round(n.humidityAvg)}%</span></div>
    </div>`;
}

function renderWeatherTropical(data) {
  if (!wdTropicalBadges) return;
  if (!data) {
    wdTropicalBadges.innerHTML = `<p class="weather-empty">${t("weather.tropicalNight.unavailable", null, "열대야 정보를 불러올 수 없어요.")}</p>`;
    if (wdTropicalComment) wdTropicalComment.textContent = "";
    return;
  }
  const officialLabel = data.official.isTropicalNight
    ? t("weather.tropicalNight.official", null, "공식 열대야")
    : t("weather.tropicalNight.officialNormal", null, "공식 기준 정상");
  const officialGrade = data.official.isTropicalNight ? "VERY_HEAVY" : "OK";
  const sleepLabel = data.sleepWindow.isFeelsLikeTropicalNight
    ? t("weather.tropicalNight.feels", null, "체감 열대야")
    : t("weather.tropicalNight.feelsOk", null, "체감상 괜찮음");
  const sleepGrade = data.sleepWindow.isFeelsLikeTropicalNight ? "VERY_HEAVY" : "OK";
  wdTropicalBadges.innerHTML =
    weatherBadgeHtml(officialGrade, officialLabel) + weatherBadgeHtml(sleepGrade, sleepLabel);
  if (wdTropicalComment) {
    const icon = data.sleepWindow.isFeelsLikeTropicalNight ? "🥵" : "🌙";
    if (isKoreanLocale()) {
      wdTropicalComment.textContent = data.sleepWindow.comment ? `${icon} ${data.sleepWindow.comment}` : "";
    } else {
      // comment 는 백엔드가 만드는 한국어 서술문이라 내보내지 않는다.
      // 대신 같은 정보를 라벨+숫자로만 보여준다 — 문장을 통째로 지우면
      // 배지만 남아 "몇 도인지"가 사라지는데, 그건 정보 손실이다.
      const s = data.sleepWindow;
      const ok = typeof s.minFeelsLike === "number" && s.sampleHourCount > 0;
      wdTropicalComment.textContent = ok
        ? `${icon} ` + t("weather.tropicalNight.sleepMin",
            { start: s.sleepStartHour, end: s.sleepEndHour, temp: formatTemp(s.minFeelsLike) },
            `${s.sleepStartHour}시~${s.sleepEndHour}시 체감 최저 ${formatTemp(s.minFeelsLike)}`)
        : "";
    }
  }
}

// 2026-07-17 2차 기획(묶음C, Fable 5 우선순위 1위): 미세먼지·초미세먼지.
// 서비스키 미설정(configured:false)과 일시 조회 실패(available:false)를
// 구분해서 다르게 안내한다 — 전자는 "설정이 필요하다"는 안내(운영자용),
// 후자는 다른 카드들과 같은 "불러올 수 없어요" 톤(유저용)이다.
function renderWeatherAirQuality(data) {
  if (!wdAirQuality) return;
  if (!data || !data.configured) {
    wdAirQuality.innerHTML = `<p class="weather-empty">${
      data && data.message ? data.message : "미세먼지 정보를 불러올 수 없어요."
    }</p>`;
    return;
  }
  if (!data.available) {
    wdAirQuality.innerHTML = `<p class="weather-empty">미세먼지 정보를 불러올 수 없어요.</p>`;
    return;
  }

  const gradeLabelKo = { GOOD: "좋음", MODERATE: "보통", BAD: "나쁨", VERY_BAD: "매우 나쁨" };
  const tiles = [];
  if (typeof data.pm10Value === "number") {
    tiles.push(
      `<div class="weather-stat-tile"><span class="weather-stat-label">미세먼지(PM10)</span><span class="weather-stat-value">${data.pm10Value} · ${gradeLabelKo[data.pm10Grade] || ""}</span></div>`
    );
  }
  if (typeof data.pm25Value === "number") {
    tiles.push(
      `<div class="weather-stat-tile"><span class="weather-stat-label">초미세먼지(PM2.5)</span><span class="weather-stat-value">${data.pm25Value} · ${gradeLabelKo[data.pm25Grade] || ""}</span></div>`
    );
  }
  const tilesHtml = tiles.length
    ? `<div class="weather-detail-grid">${tiles.join("")}</div>`
    : "";
  const commentHtml = data.message ? `<p class="weather-comment">${data.message}</p>` : "";
  wdAirQuality.innerHTML = tilesHtml + commentHtml || `<p class="weather-empty">미세먼지 정보를 불러올 수 없어요.</p>`;
}

// 2026-07-17 2차 기획(묶음D, Fable 5 우선순위 4위): 일평균 대비 기온차.
// 이 카드는 그 달력일이 처음 조회될 때 백엔드가 과거 10년치를 계산하느라
// 응답이 살짝 느릴 수 있다(캐시된 뒤로는 즉시) — 실패해도 다른 카드에
// 영향 없이 이 카드만 조용히 "불러올 수 없어요"로 접힌다.
function renderWeatherTempVsNormal(data) {
  if (!wdTempVsNormal) return;
  if (!data || !data.available) {
    wdTempVsNormal.textContent = t("weather.normal.unavailable", null, "평년값 비교에 필요한 데이터가 아직 부족해요.");
    return;
  }
  let icon = "➡️";
  if (data.normal && typeof data.todayTempMax === "number") {
    const diff = Math.round(data.todayTempMax) - Math.round(data.normal.avgTempMax);
    icon = diff > 1 ? "📈" : diff < -1 ? "📉" : "➡️";
  }
  if (isKoreanLocale()) {
    wdTempVsNormal.textContent = `${icon} ${data.message}`;
    return;
  }
  // message 는 백엔드가 만드는 한국어 서술문 — 비한국어에서는 내보내지 않고
  // 같은 두 숫자를 라벨과 함께 보여준다. 화살표 아이콘이 이미 "평년보다
  // 높다/낮다"를 말해주므로, 문장이 없어도 뜻은 전달된다.
  const hasBoth = data.normal && typeof data.todayTempMax === "number";
  wdTempVsNormal.textContent = hasBoth
    ? `${icon} ` + t("weather.normal.compact",
        { today: formatTemp(data.todayTempMax), normal: formatTemp(data.normal.avgTempMax) },
        `오늘 ${formatTemp(data.todayTempMax)} · 평년 ${formatTemp(data.normal.avgTempMax)}`)
    : t("weather.normal.unavailable", null, "평년값 비교에 필요한 데이터가 아직 부족해요.");
}

async function fetchWeatherDetail() {
  if (weatherDetailFetching) return;

  // 1시간 캐시 — 좌표가 그대로고 마지막 요청이 1시간 안쪽이면 재요청하지
  // 않는다. 패널을 닫아도 DOM 내용은 그대로 남아있어 다시 열면 직전
  // 렌더링이 그대로 보인다(제목만은 항상 최신 위치를 반영하도록 갱신).
  const { lat, lng } = weatherDetailCoords();
  const coordsKey = `${lat},${lng}`;
  const cacheStillFresh =
    coordsKey === weatherDetailLastCoordsKey && Date.now() - weatherDetailLastFetchAt < WEATHER_DETAIL_CACHE_MS;
  if (cacheStillFresh) {
    updateWeatherDetailTitle();
    return;
  }

  weatherDetailFetching = true;
  // 2026-07-20 유저 피드백("절대 한 번도 실패해서는 안 된다"): 아래 블록
  // 전체를 try/finally로 감싼다 — 렌더 함수 중 하나가 예상치 못한 예외를
  // 던지는 경우까지 포함해서, 무슨 일이 있어도 weatherDetailFetching이
  // 반드시 false로 돌아오게 보장한다. 예전엔 이 보장이 없어서, 뭔가
  // 하나라도 어긋나면 이 플래그가 true로 영구히 막혀 재시도 버튼을 눌러도
  // 맨 위 가드에서 그냥 조용히 리턴돼버리는(그래서 "다시 시도" 문구만
  // 반복되는 것처럼 보이는) 구조적 결함이 있었다.
  try {
    // 2026-07-17: 벤치마크 기획 묶음4(시간대별 예보 스트립)용 호출 추가.
    // 2026-07-17 2차 기획: 주간 기온 예보(묶음A) 호출 추가. 다음 비
    // 카운트다운(묶음B)은 새 호출 없이 rain-windows 응답에 이미 포함돼 있다.
    // 미세먼지(묶음C)는 유저 요청으로 이번 배포에서 보류("다음에 하자") —
    // 호출 자체를 넣지 않는다(카드가 안 보이는데 네트워크 요청만 날리는
    // 낭비를 피한다). renderWeatherAirQuality 함수는 다음에 재개할 때
    // 바로 쓸 수 있도록 그대로 남겨뒀다.
    // 2026-07-28 글로벌화 W3: 한국 전용 기능 게이트.
    // 평년비교(기상청 과거 관측)와 기상특보(기상청 WthrWrnInfoService)는
    // 한국 좌표에서만 데이터가 존재한다. 한국 밖에서는 호출하지 않고
    // 카드도 숨긴다 — 부르면 백엔드가 available:false 로 돌려주긴 하지만,
    // 그러면 "불러올 수 없어요"라는 실패처럼 보이는 문구가 남는다.
    // ★ 판정은 언어가 아니라 좌표로 한다 ★ 한국에 사는 영어 사용자는
    //   이 기능들을 계속 봐야 하고, 해외의 한국어 사용자에게는 없는 게 맞다.
    const koreaOnly = applyKoreaOnlyGating();
    const [currentR, rainR, yesterdayR, tropicalR, hourlyStripR, weeklyForecastR, tempVsNormalR, advisoryR] =
      await Promise.allSettled([
        fetchWeatherJson("/api/weather/current"),
        fetchWeatherJson("/api/weather/rain-windows"),
        fetchWeatherJson("/api/weather/yesterday"),
        fetchWeatherJson("/api/weather/tropical-night"),
        fetchWeatherJson("/api/weather/hourly-strip"),
        fetchWeatherJson("/api/weather/weekly-forecast"),
        // 2026-07-17 2차 기획(묶음D): 평년값 비교. 그 달력일이 처음
        // 조회되는 날엔 백엔드가 과거 10년치를 계산하느라 이 호출만 살짝
        // 느릴 수 있다 — Promise.allSettled라 다른 카드 렌더링을 막지 않는다.
        koreaOnly ? fetchWeatherJson("/api/weather/temp-vs-normal") : Promise.resolve(null),
        // 2026-07-21 3차 기획: 기상특보. 서비스키 미등록/API 실패 시에도
        // configured:false 또는 available:false로 안전하게 응답하므로
        // Promise.allSettled에서 reject되는 경우는 네트워크 자체 장애뿐이다.
        koreaOnly ? fetchWeatherJson("/api/weather/advisory") : Promise.resolve(null)
      ]);

    const tropicalData = tropicalR.status === "fulfilled" ? tropicalR.value : null;
    const rainData = rainR.status === "fulfilled" ? rainR.value : null;
    const currentData = currentR.status === "fulfilled" ? currentR.value : null;
    const hourlyStripData = hourlyStripR.status === "fulfilled" ? hourlyStripR.value : null;
    // 2026-07-18 5차 피드백: 현재 날씨 아이콘/비 애니메이션이 hourly-strip의
    // "지금" 예보(이미 fetch된 데이터, 새 호출 불필요)도 참고하도록
    // renderWeatherCurrent에 그 항목을 같이 넘긴다 — weatherEmojiFromCurrent
    // 주석 참조.
    const hourlyNowItem =
      hourlyStripData && Array.isArray(hourlyStripData.hours)
        ? hourlyStripData.hours.find((h) => h.isNow)
        : null;
    // ?fxtest=1 스위처(wdApplyTestScenario)가 네트워크 재요청 없이 즉시
    // 재렌더링할 수 있도록 마지막 fetch 결과를 캐싱해둔다.
    wdLastCurrentData = currentData;
    wdLastHourlyNowItem = hourlyNowItem;
    // 2026-07-20 유저 피드백: 이번 요청이 성공했으면 다음 실패 때 보여줄
    // "n분 전 정보" 안전망으로 기기에 저장해둔다.
    if (currentData && currentData.current) {
      wdSaveLastGoodCurrent(currentData, hourlyNowItem);
      syncMainChipFrom(currentData.current);
    }
    renderWeatherCurrent(currentData, hourlyNowItem);
    renderWeatherTopComment(rainData);
    renderWeatherNextRain(rainData);
    renderWeatherCare(rainData);
    renderWeatherHourlyStrip(hourlyStripData);
    const weeklyForecastData = weeklyForecastR.status === "fulfilled" ? weeklyForecastR.value : null;
    renderWeatherWeeklyForecast(weeklyForecastData);
    // 2026-07-19 5차 리디자인: 애플 스타일 상단 요약(날씨텍스트·최고/최저) —
    // 같은 weekly-forecast 응답을 재사용(위 renderWeatherCurrentToday 주석 참조).
    renderWeatherCurrentToday(weeklyForecastData);
    if (koreaOnly) {
      renderWeatherTempVsNormal(tempVsNormalR.status === "fulfilled" ? tempVsNormalR.value : null);
    }
    renderWeatherRainWindows(rainData);
    renderWeatherYesterday(yesterdayR.status === "fulfilled" ? yesterdayR.value : null);
    renderWeatherTropical(tropicalData);
    if (koreaOnly) {
      renderWeatherAdvisory(advisoryR.status === "fulfilled" ? advisoryR.value : null);
      wxDiagReport(advisoryR.status, advisoryR.status === "fulfilled" ? advisoryR.value : advisoryR.reason);
    }

    // 2026-07-15: 실패한 응답까지 "캐시됨"으로 기록해버리는 버그 수정 — 최초
    // 요청이 서버 콜드스타트 등으로 한 번 실패하면, 그 실패 상태가 1시간 동안
    // 그대로 캐시되어 재시도가 전혀 안 됐다(유저가 앱을 강제종료·재실행해야만
    // JS 메모리가 초기화되며 우연히 재시도됐던 것). current 데이터가 실제로
    // 성공했을 때만 캐시 타임스탬프를 갱신해서, 실패 시 다음에 상세보기를
    // 열면 자동으로 재시도되게 한다.
    // 2026-07-18 2차 피드백 대응: 위 수정은 "current"만 확인했는데, 그 사이
    // 7개 호출 중 current는 성공하고 다른 하나(예: weekly-forecast)만 그
    // 순간 실패하는 경우가 실기기에서 발견됐다("주간 예보를 불러올 수
    // 없어요"가 계속 떠 있음) — current만 보고 "성공"으로 캐시 타임스탬프를
    // 갱신해버리면, 그 카드는 다음 1시간 동안 재시도 자체가 안 돼 실패
    // 상태가 그대로 얼어붙는다. 이제 7개 호출이 전부 fulfilled일 때만
    // 캐시를 갱신한다 — 하나라도 실패하면 다음에 열 때 전체를 다시 시도해서
    // 일시적 실패(콜드스타트·네트워크 순단 등)가 스스로 회복될 기회를 준다.
    const allWeatherFetchesOk = [
      currentR,
      rainR,
      yesterdayR,
      tropicalR,
      hourlyStripR,
      weeklyForecastR,
      tempVsNormalR
    ].every((r) => r.status === "fulfilled");
    if (currentData && currentData.current && allWeatherFetchesOk) {
      weatherDetailLastFetchAt = Date.now();
      weatherDetailLastCoordsKey = coordsKey;
    }
  } finally {
    weatherDetailFetching = false;
  }
}

let musicIndex = 0;
let musicPlaying = false;
// 2026-07-08 버그 수정: 재생/일시정지를 빠르게 연타하면(또는 오디오
// 리소스 준비가 늦어지는 사이 다시 누르면) 먼저 눌렀던 재생 시도가 뒤늦게
// 비동기로 끝나면서, 그 사이 사용자가 이미 일시정지로 바꾼 뒤인데도
// player.play()를 실행해버려 "버튼은 일시정지 상태인데 소리는 계속 남"
// 현상이 발생했다 — 토글을 누를 때마다 토큰을 새로 발급해서, 오래된
// 토큰을 들고 있는 재생 시도는 자기 차례가 아니게 되면 조용히 중단하게
// 한다.
let musicActionToken = 0;

const musicHistoryStorageKey = "ezlong:musicHistory";

function loadMusicHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(musicHistoryStorageKey) || "[]");
    return Array.isArray(raw) ? raw.filter((value) => Number.isInteger(value)) : [];
  } catch (error) {
    return [];
  }
}

function saveMusicHistory(history) {
  try {
    localStorage.setItem(musicHistoryStorageKey, JSON.stringify(history));
  } catch (error) {
    // localStorage를 못 쓰는 환경이어도 재생 자체는 지장이 없어야 한다.
  }
}

// 재생했든(끝까지) 스킵했든 "들었다"로 기록한다. 전체 곡을 한 바퀴 다 돌기
// 전까지는 같은 곡이 다시 나오지 않도록 하기 위함(같은 곡이 자주 반복된다는 피드백 반영).
// 곡 수만큼 채워지면(=한 바퀴 완주) 다음 곡부터 새 사이클로 리셋한다.
function recordTrackHeard(index) {
  if (!Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return;
  let history = loadMusicHistory().filter((value) => value !== index);
  history.push(index);
  if (history.length >= musicPlaylist.length) history = [index];
  saveMusicHistory(history);
}

// 2026-07-16: "곡 순서가 마음에 안 들 때" 다시 섞기 버튼. musicHistory(이번
// 사이클에 이미 나온 곡 기록)를 통째로 비워서 "한 바퀴 다 돌기 전엔 같은
// 곡이 안 나온다" 제약을 리셋하고, 그 자리에서 바로 다음 곡으로 넘어가
// 체감이 되게 한다. "이 곡이 싫어서"가 아니라 "순서가 마음에 안 들어서"
// 누르는 것이므로 좋아요/싫어요 학습 데이터에는 영향을 주지 않는다.
function reshuffleMusicOrder() {
  saveMusicHistory([]);
  showMusicToast("Shuffled! Fresh order incoming.");
  // 2026-07-16: 운영 피드백 — "셔플만 되어야지 왜 정각 세리모니까지 같이
  // 뜨나?" recordPlayLog(→handleMusicCeremonyOnTrackStart)는 모든 트랙
  // 전환 경로에 공통으로 걸려있어(8항 원칙과 동일하게 재활용), 셔플이
  // 유발한 전환도 "새 곡 시작"으로 똑같이 인식되고 있었다. 셔플은 사용자가
  // 명시적으로 누른 "순서 재배치" 행위지 "마침 정각에 곡이 바뀐 우연"이
  // 아니므로, 이번 트랙 전환 1회에 한해 세리모니 판정을 건너뛰게 플래그를
  // 세운다.
  suppressCeremonyOnNextTrackStart = true;
  playNextTrack();
}

// 2026-07-08: 로그인 없이(디바이스 local storage 기준) "싫어요" 학습 —
// 인덱스가 아니라 파일명(track.file)으로 저장해야 플레이리스트 순서가
// 바뀌어도 안전하다.
// 2026-07-16 개정: 원래는 10초 이상 들은 곡을 수동 스킵('다음곡')하기만
// 해도 이 목록에 자동으로 추가되는 암묵적 휴리스틱이 있었다. 유저 요청으로
// 이 자동 추가 로직(recordDislikeIfWarranted)을 완전히 제거했다 — 지금은
// 아래 musicDislikeButton("싫어요" 버튼)을 명시적으로 눌렀을 때만 이
// 목록에 들어간다. '다음곡'은 순수하게 다음 곡 재생만 한다.
const musicDislikedStorageKey = "ezlong:musicDisliked";

function loadDislikedTracks() {
  try {
    const raw = JSON.parse(localStorage.getItem(musicDislikedStorageKey) || "[]");
    return Array.isArray(raw) ? raw.filter((value) => typeof value === "string") : [];
  } catch (error) {
    return [];
  }
}

function saveDislikedTracks(list) {
  try {
    localStorage.setItem(musicDislikedStorageKey, JSON.stringify(list));
  } catch (error) {
    // localStorage를 못 쓰는 환경이어도 재생 자체는 지장이 없어야 한다.
  }
}

// 2026-07-13: 음악 아이콘 탭 시 곧바로 음악설정으로 가지 않고, 지금 재생
// 중인 곡 정보(비주얼라이저+곡명+좋아요/싫어요)를 먼저 보여주는 패널로
// 바꾼다. 톱니바퀴를 눌러야만 음악설정으로 이동한다. 문제가 생기면 이 값만
// false로 바꾸면 아래 새 코드를 지우지 않고도 예전 동작(음악 아이콘 탭 →
// 바로 음악설정 오픈)으로 즉시 돌아간다.
const MUSIC_PANEL_V2_ENABLED = true;

// "좋아요"는 기존에 없던 개념이라 새 키로 저장한다. 2026-07-14: 좋아요한
// 곡은 pickNextTrackIndex()에서 후보 배열에 가중치(복제)를 줘서 다음 곡
// 선정 확률을 높인다(MUSIC_LIKED_WEIGHT, 아래 참조) — "다음에 플레이될
// 가능성을 높여달라"는 요청 반영. "싫어요"는 이미 있던
// musicDislikedStorageKey/loadDislikedTracks/saveDislikedTracks를 그대로
// 재사용한다 — 수동 스킵으로 추론되는 기존 싫어요와 같은 목록이라야
// pickNextTrackIndex()의 제외 로직이 곧바로 적용된다.
const musicLikedStorageKey = "ezlong:musicLiked";

function loadLikedTracks() {
  try {
    const raw = JSON.parse(localStorage.getItem(musicLikedStorageKey) || "[]");
    return Array.isArray(raw) ? raw.filter((value) => typeof value === "string") : [];
  } catch (error) {
    return [];
  }
}

function saveLikedTracks(list) {
  try {
    localStorage.setItem(musicLikedStorageKey, JSON.stringify(list));
  } catch (error) {
    // localStorage를 못 쓰는 환경이어도 재생 자체는 지장이 없어야 한다.
  }
}

function currentMusicTrack() {
  if (!Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return null;
  return musicPlaylist[musicIndex % musicPlaylist.length] || null;
}

// 패널의 좋아요/싫어요 버튼 상태를 "지금 재생 중인 곡" 기준으로 갱신한다.
function renderMusicReactionButtons() {
  const track = currentMusicTrack();
  const file = track && track.file;
  const liked = file ? loadLikedTracks().includes(file) : false;
  const disliked = file ? loadDislikedTracks().includes(file) : false;
  if (musicLikeButton) musicLikeButton.setAttribute("aria-pressed", String(liked));
  if (musicDislikeButton) musicDislikeButton.setAttribute("aria-pressed", String(disliked));
}

// 2026-07-14: "싫어요" 눌렀을 때 "연기처럼" 나타났다 사라지는 가벼운 피드백
// 토스트. 유머러스한 영어 문구를 매번 무작위로 골라서 단조롭지 않게 한다.
// 총 수명 약 5초: 페이드인(0.35s) → 유지(~3.15s) → 페이드아웃(1.5s).
const MUSIC_DISLIKE_TOAST_MESSAGES = [
  "Noted. Never gonna hear this again. 💨",
  "Poof — vanished from the rotation forever.",
  "RIP this track. Gone but not missed.",
  "Banished. Officially dead to us now.",
  "Yeeted into the void. Never again.",
  "Consider it erased from existence. 💨"
];
let musicToastHideTimer = null;
let musicToastClearTimer = null;
function showMusicToast(text) {
  if (!musicToast) return;
  clearTimeout(musicToastHideTimer);
  clearTimeout(musicToastClearTimer);
  musicToast.textContent = text;
  musicToast.classList.remove("is-leaving");
  musicToast.setAttribute("aria-hidden", "false");
  // 연속 클릭 시 트랜지션이 재트리거되도록 강제 리플로우.
  void musicToast.offsetWidth;
  musicToast.classList.add("is-visible");
  // 2026-07-22 이슈 제보 — "너무 짧게 나타났다 사라진다"는 컴플레인으로
  // 5초 더 연장(3500ms→8500ms, 5000ms→10000ms). 숨김 시작~완전 사라짐
  // 사이 페이드아웃 간격(1500ms)은 그대로 유지.
  musicToastHideTimer = setTimeout(() => {
    musicToast.classList.remove("is-visible");
    musicToast.classList.add("is-leaving");
  }, 8500);
  musicToastClearTimer = setTimeout(() => {
    musicToast.classList.remove("is-leaving");
    musicToast.setAttribute("aria-hidden", "true");
  }, 10000);
}
function showMusicDislikeToast() {
  const msg = MUSIC_DISLIKE_TOAST_MESSAGES[Math.floor(Math.random() * MUSIC_DISLIKE_TOAST_MESSAGES.length)];
  showMusicToast(msg);
}

function isMusicPanelOpen() {
  return Boolean(musicInfoPanel && musicInfoPanel.classList.contains("is-open"));
}

// 2026-07-22 유저 요청 — 설정 페이지 "비주얼라이저" 카드의 실시간 미리보기.
// 본화면 음악패널이 열려있거나, 설정 시트(그 안에 미리보기가 들어있는 곳)가
// 열려있으면 애니메이션 루프를 계속 돌린다. 어느 쪽이든 닫히면 나머지
// 하나가 열려있는지 다시 확인해 그때만 완전히 멈춘다.
function isMusicVizActiveContext() {
  // 2026-08-05 — 침대맡 모드에서는 그리지 않는다. 화면이 어두워 보이지도
  // 않는데 60fps로 계속 그리는 건 순수한 낭비다(Fable 5 작업 5-1·5-2).
  if (typeof bedsideActive !== "undefined" && bedsideActive) return false;
  // 2026-08-05 운영 피드백 — 문서가 안 보이면(다른 앱 전환·화면 잠금)
  // 그릴 이유가 없다. 브라우저가 대개 rAF를 재워주지만 '대개'에 기대지
  // 않는다 — 웹뷰 구현마다 다르고, 이 프로젝트는 그 차이에 여러 번 데였다.
  try {
    if (document.visibilityState === "hidden") return false;
  } catch (error) { /* 무시 */ }
  // 설정 시트가 열려 있으면 그 안의 미리보기를 위해 계속 돈다(페이지와 무관).
  if (settingsPanel && settingsPanel.classList.contains("is-open")) return true;
  // ezlong.com 페이지(2페이지)를 보는 중이면 비주얼라이저는 화면 밖이다.
  try {
    if (typeof currentPageIndex !== "undefined" && currentPageIndex >= 1) return false;
  } catch (error) { /* 무시 */ }
  return isMusicPanelOpen();
}

// 2026-08-05 운영 요청 — "사람들이 비주얼라이저를 켤 수 있다는 걸 모른다."
// 그래서 이 패널의 기본값을 '열림'으로 바꿨다. 다만 접은 사람에게 매번 다시
// 펴 보이지는 않는다 — 접었다는 사실을 기억한다(강요하지 않는다).
const musicPanelOpenStorageKey = "ezlong:musicPanelOpen";
function loadMusicPanelPreferredOpen() {
  try {
    return localStorage.getItem(musicPanelOpenStorageKey) !== "0"; // 값 없음 = 기본 열림
  } catch (error) {
    return true;
  }
}
function saveMusicPanelPreferredOpen(open) {
  try { localStorage.setItem(musicPanelOpenStorageKey, open ? "1" : "0"); } catch (error) {}
}

// ═════════════════════════════════════════════════════════════════
// 비주얼라이저 첫 실행 온보딩 — 2026-08-12 운영 지침
// ═════════════════════════════════════════════════════════════════
// 2026-08-05에 "비주얼라이저를 켤 수 있다는 걸 사람들이 모른다"는 이유로
// 이 패널의 기본값을 '열림'으로 바꿨다. 그 대가로 배경사진을 늘 가리게
// 됐고, 그러면서도 "이걸 접었다 폈다 할 수 있다"는 사실은 여전히 전달되지
// 않았다. 켜져 있는 상태는 조작 가능성을 설명하지 못한다.
//
// 그래서 노출을 '상태'에서 '동작'으로 바꾼다. 앱을 켜면 10초만 보여주고,
// 그 사이 음악을 틀지 않으면 스스로 접힌다. 접히는 그 움직임 자체가
// "이건 접었다 폈다 하는 것"이라는 설명이다 — 문구 한 줄 없이, 그러므로
// 번역 한 줄 없이(9개 언어 × 새 문구 = 없음).
//
// 운영자 확정 규칙(2026-08-12):
//   · 학습의 기준은 '토글 조작'이다. 음악 재생이 아니다. 음악은 하단
//     ▶ 버튼으로도 틀 수 있으니, 틀었다는 사실이 곧 "패널을 접었다 폈다
//     할 줄 안다"는 뜻은 아니다.
//   · 학습 전까지는 매 실행마다 10초를 준다. 한 번만 보여주고 말면, 그때
//     마침 화면을 안 보고 있던 사람에게는 없었던 일과 같다.
// 학습이 끝나면 이 연출은 영구히 사라진다 — 아는 사람에게 반복하는 안내만큼
// 앱을 싸구려 보이게 하는 것이 없다.
const vizOnboardLearnedKey = "ezlong:vizOnboardLearned";
const VIZ_ONBOARD_MS = 10000;
let vizOnboardTimer = null;

// localStorage를 못 쓰는 환경은 '학습됨'으로 간주한다. 기억하지 못하는
// 기기에서 매번 10초 만에 접히는 연출이 반복되면 안내가 아니라 고장으로 읽힌다.
function vizOnboardLearned() {
  try {
    return localStorage.getItem(vizOnboardLearnedKey) === "1";
  } catch (error) {
    return true;
  }
}

function cancelVizOnboardCountdown() {
  if (vizOnboardTimer) {
    window.clearTimeout(vizOnboardTimer);
    vizOnboardTimer = null;
  }
}

// 토글을 손으로 만진 순간 = 학습 완료. 방향(펼침/접힘)은 상관없다 — 어느
// 쪽이든 "이게 조작되는 물건이다"를 이미 알았다는 증거다.
function markVizOnboardLearned() {
  cancelVizOnboardCountdown();
  try { localStorage.setItem(vizOnboardLearnedKey, "1"); } catch (error) { /* 무시 */ }
}

// 부팅 직후 기본 노출에서만 부른다. 사용자가 손으로 펼쳐서 열린 패널은
// 이 카운트다운의 대상이 아니다(그 순간 이미 학습이 끝난다).
function startVizOnboardCountdown() {
  cancelVizOnboardCountdown();
  if (vizOnboardLearned()) return;
  vizOnboardTimer = window.setTimeout(function () {
    vizOnboardTimer = null;
    try {
      // 10초 안에 음악을 틀었으면 그대로 둔다 — 보려고 튼 것을 뺏지 않는다.
      // 다만 이것을 학습으로 치지도 않는다(운영자 확정 규칙).
      if (typeof musicPlaying !== "undefined" && musicPlaying) return;
      if (!isMusicPanelOpen()) return;
      // persist=false — 이건 사용자의 선택이 아니라 안내 연출의 마무리다.
      // 선택으로 기억해버리면 다음 실행에 기본 노출이 통째로 무너진다.
      setMusicPanelOpen(false, false);
    } catch (error) { /* 무시 */ }
  }, VIZ_ONBOARD_MS);
}

function setMusicPanelOpen(open, persist) {
  if (!musicInfoPanel) return;
  // persist가 명시적으로 false면 취향으로 기억하지 않는다 — 배터리 보호로
  // 자동으로 접는 경우가 그렇다(2026-08-05). 자동 조작을 사용자의 선택으로
  // 기억하면 다음 실행에서 기본 노출이 통째로 무너진다.
  if (persist !== false) saveMusicPanelPreferredOpen(open);
  musicInfoPanel.classList.toggle("is-open", open);
  musicInfoPanel.setAttribute("aria-hidden", String(!open));
  if (musicSettingsOpen) musicSettingsOpen.setAttribute("aria-expanded", String(open));
  if (open) {
    renderMusicReactionButtons();
    ensureMusicVizGraph();
    if (musicVizAnimId) cancelAnimationFrame(musicVizAnimId);
    musicVizAnimId = null;
    drawMusicViz();
  } else if (musicVizAnimId && !isMusicVizActiveContext()) {
    // 설정 시트가 아직 열려있으면(미리보기가 보이는 중) 루프를 끄지 않는다.
    cancelAnimationFrame(musicVizAnimId);
    musicVizAnimId = null;
  }
}

// 음악 아이콘 탭 동작 — 플래그에 따라 분기(3번 위 주석 참조).
function handleMusicIconTap() {
  if (!MUSIC_PANEL_V2_ENABLED) {
    openSettings(); // 롤백 모드: 예전 그대로 바로 음악설정 오픈
    return;
  }
  markVizOnboardLearned();
  setMusicPanelOpen(!isMusicPanelOpen());
}

// 2026-07-28 W9 — QC 전용 "곡 삭제" 도구를 제거했다.
//   원음 품질 점검용 임시 도구였는데(?musicqc=1 로만 노출), 글로벌 출시
//   준비 중 설정 화면 전수 점검에서 발견돼 운영 판단으로 삭제했다.
//   개발자용 문구가 사용자 화면에 남아있을 이유가 없고, 번역 대상도 아니다.
//   기기에 남은 ezlong:musicQCMode / ezlong:musicRemovalRequests 키는
//   이제 아무도 읽지 않아 자동으로 무해해진다(정리 코드 불필요).
// 2026-07-08: 로그인 없이 "마지막 재생 곡/위치"를 기억해서 앱을 다시 켰을 때
// 이어들을 수 있게 한다. 이것도 파일명 기준으로 저장한다.
const musicResumeStorageKey = "ezlong:musicResume";
let lastResumeSaveAt = 0;

function loadMusicResume() {
  try {
    const raw = JSON.parse(localStorage.getItem(musicResumeStorageKey) || "null");
    if (raw && typeof raw.file === "string" && Number.isFinite(raw.time)) return raw;
  } catch (error) {
    // 무시 — 복원 없이 그냥 새로 고른다.
  }
  return null;
}

// 2026-07-09: "이어듣기"가 날짜 구분 없이 무한정 유지되면서, 앱을 대기화면처럼
// 하루 종일 켜두는 유저에게 "다음날 다시 켜도 항상 어제 그 곡부터 시작"하는
// 지루함을 만들었다 — 유저 피드백: "앱을 실행할 때마다 같은 음악이 나와서
// 지루하다"는 착각이 아니라 이 코드의 실제 동작이었다. 저장 시점의 "기기
// 로컬 날짜"를 함께 남겨서, 되살릴 때 같은 날짜인 경우에만 이어듣기를
// 적용하고, 날짜가 바뀌었으면 새 곡을 고르게 한다(아래 prefetchFirstTrack
// 참조). 같은 날 안에서 앱을 잠깐 껐다 켜는 정상적인 이어듣기 경험은 그대로
// 유지된다.
function localDateStamp(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function saveMusicResume() {
  try {
    const player = activePlayer();
    if (!player || !Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return;
    const track = musicPlaylist[musicIndex % musicPlaylist.length];
    if (!track || !track.file) return;
    localStorage.setItem(musicResumeStorageKey, JSON.stringify({
      file: track.file,
      time: player.currentTime || 0,
      savedOn: localDateStamp(),
    }));
  } catch (error) {
    // localStorage를 못 쓰는 환경이어도 재생 자체는 지장이 없어야 한다.
  }
}

// timeupdate마다(초당 여러 번) 매번 쓰지 않도록 5초에 한 번으로 제한한다.
// force=true는 일시정지/스킵/화면 전환처럼 "지금 확실히 저장해야 하는"
// 시점에 제한을 무시하고 즉시 저장한다.
function maybeSaveMusicResume(force = false) {
  const now = Date.now();
  if (!force && now - lastResumeSaveAt < 5000) return;
  lastResumeSaveAt = now;
  saveMusicResume();
}

// 2026-07-12: "여러 장르가 골고루, 질리지 않게, 같은 제목(파트1/2/3...)은
// 연달아 나오지 않게" 요청 반영 — 아래 세 가지를 추가한다.
// (1) 플레이리스트(장르) 선택 — localStorage에 저장, "all"이면 전체 랜덤.
// (2) "all" 모드에서는 카테고리(장르)를 라운드로빈으로 순환해 특정 장르가
//     몰아서 나오는 것을 막는다(장르 내부 곡 선택 자체는 무작위 유지).
// (3) 같은 "그룹"(제목이 같은 part1/2/3... 변주)은 최근 재생분과 최소 간격을
//     두기 전까지 후보에서 제외한다 — 플레이리스트 필터와 무관하게 항상 적용.
const musicPlaylistFilterStorageKey = "ezlong:musicPlaylistFilter";
const ORIGINAL_CATEGORY_KEY = "__original__";
const musicRecentGroupSpacing = 8; // 같은 그룹은 최소 이만큼 곡이 지나야 다시 후보가 됨

// 2026-07-18 5차 피드백 — "걸스록"을 "ROCK"으로 라벨만 개명한다. 원래도
// "vocal- girls rock"은 "보컬"(CITY POP/workspace 계열)과는 별도 카테고리로
// 이미 분리돼 있었다(canonical key 매핑 대상이 아님) — 유저가 기억하는
// "원래 ROCK이 따로 있었다"는 이 카테고리를 가리키는 것으로 판단, 실제
// 트랙 재그룹핑 없이 표시 이름만 바꾼다.
// 2026-07-18 유저 요청 — "BGM 시네마틱" 카테고리 완전 삭제. 곡 수가 15곡
// 정도로 적고 앞으로 추가될 가능성도 낮아, music-playlist.js에서 이 곡들
// 자체를 지우고(원본 트랙 데이터 삭제) 라벨 매핑에서도 뺐다. trackCategoryKey()가
// 더 이상 "BGM"이라는 키를 만들어낼 트랙 자체가 없으므로, 플레이리스트 선택
// 목록(buildMusicPlaylistOptions)과 "전체 랜덤" 로테이션(byCategoryAll) 양쪽
// 모두에서 자동으로 사라진다 — 이 라벨 엔트리를 지우는 것 자체는 사실 없어도
// 무방하지만(더 이상 매칭될 키가 없으니), 죽은 매핑을 남겨두지 않기 위해
// 함께 정리했다.
// 2026-07-20 유저 요청: 새로 다운로드한 5개 폴더(classic 20260718/
// Rock-20260720/Calm Circles.../sleep/명상)를 반영 — "classic 20260718"은
// 기존 "피아노 · 첼로" 라벨을 "클래식"으로 바꿔 그 카테고리에 통합하고,
// "Rock-20260720"은 기존 ROCK에 통합한다(둘 다 아래 CATEGORY_CANONICAL_KEY
// 참조). 나머지 3개(스트레스 해소/수면유도/명상)는 통합하지 않고 독립
// 카테고리로 두되, 아래 SPECIAL_CATEGORY_KEYS에 등록해 "전체 랜덤" 풀과
// 일반 플레이리스트 라디오 목록에서는 빠지고 별도 "Special" 박스에서만
// 선택 가능하게 한다.
// 2026-07-28 W9-2 — 왼쪽 키는 music-playlist.js 트랙의 category 원본 값이라
// 절대 손대지 않는다(매칭용 식별자). 오른쪽만 카탈로그 키로 바꿨다.
const MUSIC_CATEGORY_CATALOG_KEYS = {
  [ORIGINAL_CATEGORY_KEY]: "music.categories.acoustic",
  "My Workspace": "music.categories.acoustic",
  "piano chello": "music.categories.classical",
  "vocal - CITY POP": "music.categories.vocal",
  "vocal - workspace 20260711 1400": "music.categories.vocal",
  "vocal- girls rock": "music.categories.rock",
  "Calm Circles For A Busy Brain-스트레스해소": "music.categories.stressRelief",
  "sleep": "music.categories.sleep",
  "명상": "music.categories.meditation",
};
// i18n 이 통째로 실패해도 한국어 화면이 예전 그대로이도록 남기는 폴백.
const MUSIC_CATEGORY_LABELS = {
  [ORIGINAL_CATEGORY_KEY]: "어쿠스틱 연주곡",
  "My Workspace": "어쿠스틱 연주곡",
  "piano chello": "클래식",
  "vocal - CITY POP": "보컬",
  "vocal - workspace 20260711 1400": "보컬",
  "vocal- girls rock": "ROCK",
  "Calm Circles For A Busy Brain-스트레스해소": "스트레스 해소",
  "sleep": "수면유도",
  "명상": "명상",
};

// 2026-07-16 유저 요청 — 성격이 겹치는 카테고리를 하나로 통합한다.
// "오리지널"(58곡, category 필드 없는 트랙)과 "My Workspace"(199곡)는 둘 다
// 사실상 같은 성격의 연주곡이라 "어쿠스틱 연주곡"(257곡) 하나로 묶는다.
// "vocal - CITY POP"(16곡)과 "vocal - workspace 20260711 1400"(22곡, 기존
// 라벨 "보컬")도 보컬이 있다는 공통점으로 "보컬"(38곡) 하나로 묶는다.
// music-playlist.js의 358개 트랙 데이터(각 트랙의 category 필드)는 건드리지
// 않고, 그룹핑용 "대표 키(canonical key)"로만 매핑한다 — 358개 트랙을 일일이
// 수정하는 것보다 훨씬 안전하고, 수정 범위가 좁아 되돌리기도 쉽다. 이 매핑
// 하나만으로 카테고리 선택 UI(buildMusicPlaylistOptions), "전체" 랜덤 로테이션
// (byCategoryAll), 곡수 집계까지 전부 통합된 것처럼 자동으로 동작한다.
const CATEGORY_CANONICAL_KEY = {
  [ORIGINAL_CATEGORY_KEY]: "My Workspace",
  "vocal - CITY POP": "vocal - workspace 20260711 1400",
  // 2026-07-20: classic 20260718(96곡)→piano chello(기존 31곡, 라벨 "클래식")
  // 통합, Rock-20260720(96곡)→vocal- girls rock(기존 16곡, 라벨 "ROCK") 통합.
  "classic 20260718": "piano chello",
  "Rock-20260720": "vocal- girls rock",
};

function trackCategoryKey(track) {
  const rawKey = track && track.category ? track.category : ORIGINAL_CATEGORY_KEY;
  return CATEGORY_CANONICAL_KEY[rawKey] || rawKey;
}

function musicCategoryLabel(key) {
  const catalogKey = MUSIC_CATEGORY_CATALOG_KEYS[key];
  if (!catalogKey) return key;
  return t(catalogKey, null, MUSIC_CATEGORY_LABELS[key] || key);
}

// 2026-07-20 신설 — "all"까지 포함해 필터 키를 사람이 읽을 라벨로 바꾼다
// (musicCategoryLabel은 "all"을 모르므로 이 래퍼가 필요). 설정 화면 즉시
// 피드백 토스트와 첫 재생 안내 토스트가 공유한다.
function musicPlaylistFilterAnnounceLabel(key) {
  return key === "all"
    ? t("music.allShuffle", null, "전체 랜덤")
    : musicCategoryLabel(key);
}

// 2026-07-20 유저 요청 — "Special"(스트레스 해소/수면유도/명상)은 특수한
// 상황에서만 듣는 음악이라 기본 "전체 랜덤"에 섞이면 안 된다. 이 Set에
// 속한 카테고리 키는 (1) buildMusicPlaylistOptions()의 일반 목록에서 빠지고
// buildMusicSpecialOptions()의 별도 목록에만 나타나며, (2) pickNextTrackIndex()가
// filterKey==="all"일 때 후보 풀에서 제외한다 — 유저가 Special 중 하나를
// 명시적으로 선택했을 때만(filterKey가 그 키 자체일 때) 재생 대상이 된다.
const SPECIAL_CATEGORY_KEYS = new Set([
  "Calm Circles For A Busy Brain-스트레스해소",
  "sleep",
  "명상",
]);

function isSpecialCategory(key) {
  return SPECIAL_CATEGORY_KEYS.has(key);
}

// 2026-07-25 재설계 (유저 요청) — "Vocal 제외"/"연주곡 제외" 2개짜리
// 이분법을 걷어내고, 4개 플레이리스트(어쿠스틱 연주곡/클래식/보컬/ROCK)를
// 각각 독립적으로 제외할 수 있게 한다. elId는 index.html의 체크박스 id와
// 정확히 일치해야 한다(#musicExcludeFilters 참조).
//
// **"보컬" 항목만 특별하다**: 카테고리 단위 제외에 더해, 아래
// matchesGenreToggle()에서 track.vocal===true인 개별 트랙까지 카테고리와
// 무관하게 함께 걸러낸다. 이유: "클래식"("piano chello"+"classic 20260718"
// 96곡) 폴더 안에 실제로는 보컬이 섞인 트랙이 있어도, 그 트랙들은 폴더
// 단위로 일괄 vocal:false가 매겨져 있었다(scripts/build-music-playlist.js
// 작성 당시 "제목만 보고 인스트루멘탈일 것"이라 추정한 것 — 실제로 들어본
// 게 아니다, 2026-07-25 조사로 확인). 카테고리 이름만으로 판정하던 예전
// isVocalCategory() 방식은 이런 "폴더 오분류"를 절대 못 잡았다 — 지금은
// track.vocal 필드를 실제로 읽으므로, 갤러리 관리툴(scripts/gallery-server.js
// 음악 탭)에서 개별 트랙의 vocal 값을 true로 바로잡아두면 이 필터가 그
// 즉시 반영한다. 자동 음성 감지(오디오 내용 분석)는 하지 않는다 — 제목
// 문자열만으로는 보컬 유무를 판단할 근거가 없다는 게 확인됐다(658곡 전체를
// 훑어도 "Aria"/"Chorus" 같은 보컬 단서 제목이 하나도 없었다).
const MUSIC_EXCLUDABLE_CATEGORIES = [
  { key: "My Workspace", label: t("music.categoriesShort.acoustic", null, "어쿠스틱"), storageKey: "ezlong:musicExcludeAcoustic", elId: "musicExcludeAcoustic" },
  { key: "piano chello", label: t("music.categories.classical", null, "클래식"), storageKey: "ezlong:musicExcludeClassical", elId: "musicExcludeClassical" },
  { key: "vocal - workspace 20260711 1400", label: t("music.categories.vocal", null, "보컬"), storageKey: "ezlong:musicExcludeVocal", elId: "musicExcludeVocal" },
  { key: "vocal- girls rock", label: "ROCK", storageKey: "ezlong:musicExcludeRock", elId: "musicExcludeRock" },
];
const MUSIC_VOCAL_CATEGORY_KEY = "vocal - workspace 20260711 1400";
// 기존 "보컬" 토글 저장 키를 그대로 재사용 — 예전에 "Vocal 제외"를 켜뒀던
// 유저라면 이번 업데이트 이후에도 그 설정이 그대로 이어진다.
const musicExcludeVocalStorageKey = MUSIC_EXCLUDABLE_CATEGORIES.find((c) => c.key === MUSIC_VOCAL_CATEGORY_KEY).storageKey;

// 2026-07-16 유저 요청 — 플레이리스트로 특정 장르 "하나만" 선택한 상태에서
// 그 장르 자체를 걸러내는 제외 필터를 동시에 켜면 후보가 0개가 되는 모순이
// 생긴다. 예: '클래식'만 선택 + '클래식 제외' 체크 → 재생할 곡이 하나도
// 안 남는다. 이 판정 함수 하나를 재생 로직(pickNextTrackIndex)과 설정
// 화면 체크박스 활성화 여부 둘 다에서 그대로 공유해서 절대 어긋나지 않게
// 한다(8항 공유 함수 동기화 원칙과 동일 적용).
function musicExcludeFilterContradicts(categoryKey, filterKey) {
  if (!filterKey || filterKey === "all") return false;
  return filterKey === categoryKey;
}

// defaultValue: 저장된 값이 없을 때 쓸 기본값. "포함" 체크박스 시절엔 항상
// true(기본 켜짐)였지만, "제외" 체크박스는 기본이 false(기본적으로 아무것도
// 제외하지 않음)여야 자연스럽다 — 그래서 두 번째 인자로 받는다.
function loadMusicGenreToggle(storageKey, defaultValue) {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw === null ? defaultValue : raw === "1";
  } catch (error) {
    return defaultValue;
  }
}

function saveMusicGenreToggle(storageKey, value) {
  try {
    localStorage.setItem(storageKey, value ? "1" : "0");
  } catch (error) {
    // localStorage를 못 쓰는 환경이어도 재생 자체에는 지장이 없어야 한다.
  }
}

function loadMusicPlaylistFilter() {
  try {
    const raw = localStorage.getItem(musicPlaylistFilterStorageKey);
    return typeof raw === "string" && raw ? raw : "all";
  } catch (error) {
    return "all";
  }
}

function saveMusicPlaylistFilter(value) {
  try {
    localStorage.setItem(musicPlaylistFilterStorageKey, value);
  } catch (error) {
    // localStorage를 못 쓰는 환경이어도 재생 자체는 지장이 없어야 한다.
  }
}

function shuffleArray(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

// "all" 모드 전용 — 매 사이클마다 순서를 새로 섞어 순환한다. 새로고침하면
// 초기화되는 가벼운 런타임 상태일 뿐, 하루 단위 이어듣기(musicResume)와는
// 무관하다.
//
// 2026-07-16: 예전엔 카테고리마다 사이클에 정확히 1번씩만 들어갔다(완전히
// 공평한 순번) — 그런데 실제 카테고리 곡수를 세어보니 My Workspace 199곡
// 대 BGM/보컬 계열 16곡처럼 12배 넘게 차이가 나서, "순번은 공평"해도 "곡
// 하나가 뽑힐 확률"로 환산하면 소규모 카테고리 곡이 큰 카테고리 곡보다
// 12배 넘게 자주 나오는 결과가 됐다(이슈 제보: "좋아요 안 누른 곡이 자주
// 나오는 느낌" — 실제로 그럴 만했다). 그렇다고 곡수에 정확히 비례해서
// 순번을 주면(완전 비례) My Workspace 혼자 전체 재생의 56%를 차지하게 돼,
// 이번엔 반대로 "같은 카테고리만 계속 나온다"던 2026-07-12의 원래 문제가
// 재발한다. 그래서 절충안으로 각 카테고리가 사이클에 들어가는 횟수를
// 곡수의 제곱근에 비례하게 만든다 — 제곱근은 큰 수는 압축하고 작은 수는
// 상대적으로 덜 압축하는 함수라, 곡수 차이(12배)를 확률 차이(약 3.5배)로
// 완만하게 줄여준다. 정확히는: My Workspace(199)→14회, ORIGINAL(58)→8회,
// piano chello(31)→6회, vocal-workspace(22)→5회, BGM·CITY POP·girls
// rock(16)→4회씩. 한쪽 극단(완전 공평)도 반대쪽 극단(완전 비례)도 아닌
// 중간 지점 — 소규모 카테고리가 완전히 묻히지도, 유저가 느낀 것처럼
// 지나치게 자주 나오지도 않는 균형을 노린다.
let categoryRotationQueue = [];

function categoryRotationWeight(count) {
  if (!Number.isFinite(count) || count <= 0) return 1;
  return Math.max(1, Math.round(Math.sqrt(count)));
}

function nextRotatedCategory(eligibleKeys, sizeByKey) {
  if (eligibleKeys.length === 0) return null;
  categoryRotationQueue = categoryRotationQueue.filter((key) => eligibleKeys.includes(key));
  if (categoryRotationQueue.length === 0) {
    const weightedKeys = [];
    eligibleKeys.forEach((key) => {
      const count = sizeByKey instanceof Map ? sizeByKey.get(key) : undefined;
      const weight = categoryRotationWeight(count);
      for (let n = 0; n < weight; n += 1) weightedKeys.push(key);
    });
    categoryRotationQueue = shuffleArray(weightedKeys);
  }
  return categoryRotationQueue.shift();
}

function pickNextTrackIndex() {
  const total = Array.isArray(musicPlaylist) ? musicPlaylist.length : 0;
  if (total === 0) return 0;

  const filterKey = loadMusicPlaylistFilter();
  const disliked = new Set(loadDislikedTracks());
  const isDisliked = (i) => {
    const track = musicPlaylist[i];
    return Boolean(track && track.file && disliked.has(track.file));
  };
  // 2026-07-14: "좋아요" 누른 곡은 다음 곡 선정 시 뽑힐 확률을 높인다 —
  // 최종 후보 배열에 넣기 직전, 좋아요 곡의 인덱스를 N번 더 복제해서
  // Math.random() 추첨 대상 안에서 차지하는 비중을 키우는 방식(가장
  // 단순하고, 카테고리 로테이션·그룹 간격 제외 로직은 전혀 건드리지
  // 않는다). "내일 한번 더 듣게 해주거나"라는 요청은 완전한 예약 스케줄
  // 대신 이 확률 가중치로 구현 — 후보 풀에 다시 들어오는 순간부터
  // 평소보다 훨씬 잘 뽑힌다.
  const liked = new Set(loadLikedTracks());
  const isLiked = (i) => {
    const track = musicPlaylist[i];
    return Boolean(track && track.file && liked.has(track.file));
  };
  const MUSIC_LIKED_WEIGHT = 4;
  const applyLikedWeight = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return arr;
    const weighted = [];
    arr.forEach((i) => {
      weighted.push(i);
      if (isLiked(i)) {
        for (let extra = 1; extra < MUSIC_LIKED_WEIGHT; extra += 1) weighted.push(i);
      }
    });
    return weighted;
  };
  // 2026-07-20: "전체 랜덤"(filterKey==="all")일 땐 Special 카테고리(스트레스
  // 해소/수면유도/명상)를 항상 후보에서 뺀다 — 유저가 Special 박스에서 그
  // 카테고리를 직접 선택했을 때(filterKey가 그 키와 정확히 일치할 때)만
  // 재생 대상이 된다.
  const matchesFilter = (i) => {
    const key = trackCategoryKey(musicPlaylist[i]);
    if (filterKey === "all") return !isSpecialCategory(key);
    return key === filterKey;
  };
  // 2026-07-25 재설계: 4개 카테고리(어쿠스틱/클래식/보컬/ROCK) 각각의 제외
  // 토글을 독립적으로 확인한다. 선택된 장르(filterKey)와 제외 필터가 서로
  // 모순되는 조합이면(예: '클래식'만 선택 + '클래식 제외') 저장값이
  // true여도 여기서 강제로 무시한다 — 설정 화면 체크박스는 이 경우
  // 비활성화돼 있어(아래 syncMusicExcludeFilterUi) 평소엔 애초에 true로
  // 저장될 일이 없지만, 이 재생 로직 자체도 독립적으로 같은 판정을 하게
  // 해서 후보가 0개가 되는 사고를 이중으로 막는다.
  const matchesGenreToggle = (i) => {
    const track = musicPlaylist[i];
    const key = trackCategoryKey(track);
    for (let c = 0; c < MUSIC_EXCLUDABLE_CATEGORIES.length; c += 1) {
      const cat = MUSIC_EXCLUDABLE_CATEGORIES[c];
      if (key !== cat.key) continue;
      const excluded = loadMusicGenreToggle(cat.storageKey, false) && !musicExcludeFilterContradicts(cat.key, filterKey);
      if (excluded) return false;
    }
    // '보컬 제외'가 켜져 있으면, 카테고리와 무관하게 트랙 자체가
    // vocal:true로 표시된 경우(예: '클래식'/'ROCK' 폴더 안에 잘못 섞인
    // 보컬 곡)도 함께 걸러낸다 — 위 카테고리 단위 제외만으로는 폴더
    // 오분류를 못 잡기 때문에 필요한 보완 조건이다.
    const excludeVocalTracks = loadMusicGenreToggle(musicExcludeVocalStorageKey, false) && !musicExcludeFilterContradicts(MUSIC_VOCAL_CATEGORY_KEY, filterKey);
    if (excludeVocalTracks && track && track.vocal === true) return false;
    return true;
  };

  const baseIndices = [];
  for (let i = 0; i < total; i += 1) {
    if (matchesFilter(i) && matchesGenreToggle(i) && !isDisliked(i)) baseIndices.push(i);
  }
  // 2026-07-20 유저 긴급 제보로 발견·수정: "ROCK을 선택했는데 명상 곡이
  // 나온다." 원인은 이 폴백이었다 — baseIndices가 어떤 이유로든(예: 제외
  // 필터+싫어요 조합이 그 카테고리를 통째로 비웠을 때) 비면, 카테고리
  // 필터 자체를 무시하고 곧장 전체 658곡 카탈로그로 되돌아갔다. "전체
  // 랜덤"이 아니라 특정 카테고리를 명시적으로 골랐는데 완전히 다른
  // 카테고리 곡이 나올 수 있는 구조였던 것 — 데이터(music-playlist.js)
  // 자체는 검증 결과 문제없었고 이 폴백 순서가 진짜 원인이다.
  // 이제 2단계로 완화한다: 먼저 "카테고리 필터만은 지키고" 장르 제외/
  // 싫어요 조건만 무시한 풀로 폴백하고, 그 풀조차 비어야만(사실상 있을 수
  // 없음 — 실제 존재하는 카테고리는 항상 트랙이 있음) 최후의 수단으로
  // 전체 카탈로그를 쓴다.
  let searchBase = baseIndices;
  if (searchBase.length === 0) {
    const filterOnlyIndices = [];
    for (let i = 0; i < total; i += 1) {
      if (matchesFilter(i)) filterOnlyIndices.push(i);
    }
    searchBase = filterOnlyIndices.length > 0
      ? filterOnlyIndices
      : Array.from({ length: total }, (_, i) => i);
  }

  const recentHistory = loadMusicHistory();
  const heard = new Set(recentHistory);

  // 최근 재생한 "그룹"(같은 제목의 다른 파트)은 간격이 찰 때까지 제외한다 —
  // 필터 종류와 무관하게 항상 적용.
  const recentGroups = new Set(
    recentHistory.slice(-musicRecentGroupSpacing)
      .map((i) => musicPlaylist[i] && musicPlaylist[i].group)
      .filter((g) => g !== undefined)
  );
  const isGroupSafe = (i) => {
    const g = musicPlaylist[i] && musicPlaylist[i].group;
    return g === undefined || !recentGroups.has(g);
  };

  if (filterKey !== "all") {
    // 특정 장르만 고르는 중 — 그 장르 안에서만 "한 바퀴 다 돌면 새 사이클"을
    // 적용한다(전체 카탈로그 상태와 무관하게 이 장르 자체가 독립적으로 순환).
    let pool = searchBase.filter((i) => !heard.has(i));
    if (pool.length === 0) pool = searchBase;
    let groupSafe = pool.filter(isGroupSafe);
    if (groupSafe.length === 0) groupSafe = pool; // 후보가 다 걸러지면 간격 제약을 완화
    const weightedGroupSafe = applyLikedWeight(groupSafe);
    return weightedGroupSafe[Math.floor(Math.random() * weightedGroupSafe.length)];
  }

  // 기본(전체) 모드 — 카테고리를 라운드로빈으로 순환해 장르가 골고루 섞이게
  // 한다. 2026-07-12 수정: 처음엔 "아직 안 들은 곡"만 후보로 삼았는데, 카테고리
  // 크기가 8배 이상 차이나다 보니(My Workspace 199곡 vs BGM 17곡) 작은
  // 카테고리가 먼저 다 "들은 곡"이 되어 로테이션에서 통째로 빠지고, 그 뒤로는
  // 가장 큰 카테고리만 연달아 나오는 문제가 실측 시뮬레이션(2000회)에서
  // 확인됐다(같은 카테고리 최대 연속 140회). 그래서 "안 들은 곡" 여부는
  // 카테고리를 고른 *다음에* 그 카테고리 안에서만 따지도록 바꿨다 — 각
  // 카테고리가 자기 곡을 다 들으면 그 카테고리만 독립적으로 새 사이클을
  // 시작하고, 로테이션 순서 자체에는 전혀 영향을 주지 않는다.
  const byCategoryAll = new Map();
  searchBase.forEach((i) => {
    const key = trackCategoryKey(musicPlaylist[i]);
    if (!byCategoryAll.has(key)) byCategoryAll.set(key, []);
    byCategoryAll.get(key).push(i);
  });
  const eligibleKeys = Array.from(byCategoryAll.keys());
  // 2026-07-16: 카테고리별 실제 곡수(제곱근 가중치 계산용) — searchBase
  // 기준이라 현재 필터/장르 제외/싫어요 반영 후의 "실질" 곡수다.
  const categorySizeByKey = new Map(
    eligibleKeys.map((key) => [key, (byCategoryAll.get(key) || []).length])
  );
  const chosenCategory = nextRotatedCategory(eligibleKeys, categorySizeByKey);
  const categoryPool = chosenCategory ? byCategoryAll.get(chosenCategory) : searchBase;

  let candidates = (categoryPool || searchBase).filter(isGroupSafe);
  if (candidates.length === 0) candidates = categoryPool || searchBase;
  let unheardCandidates = candidates.filter((i) => !heard.has(i));
  if (unheardCandidates.length === 0) unheardCandidates = candidates; // 이 카테고리만 새 사이클 시작

  const weightedUnheard = applyLikedWeight(unheardCandidates);
  return weightedUnheard[Math.floor(Math.random() * weightedUnheard.length)];
}

let musicErrorRetryCount = 0;
let stallRetryCount = 0;
let stallWatchCurrentTime = -1;
let stallWatchSince = Date.now();

// 곡 끝나기 이만큼(초) 전부터 다음 곡을 미리 재생 시작해서 겹치게(크로스페이드)
// 넘긴다. 2026-07-07: 처음엔 페이드아웃만(무음 구간 있음) 2.5초로 넣었는데
// 유저가 "그래도 끊긴다, 3.5초로 하고 바로 다음곡으로 연결해야 할 듯"이라고
// 재지적 — 페이드만 하는 게 아니라 이 시점에 실제로 다음 곡을 미리 재생
// 시작해서 무음 구간 자체가 없도록 구조를 바꿨다(ffmpeg 완전디코드로 파일
// 자체가 그 지점에서 끝나는 것 자체는 이미 확인됨 — 버그가 아니라 편집).
// 2026-07-07 재조정: iOS 앱에서 페이드 없이 뚝 끊긴다는 재지적 — 0.5초
// 앞당겨 4초로 늘려서 크로스페이드가 트리거될 여유를 더 준다.
const musicFadeOutSeconds = 4;

// 2026-07-07 추가: "정말 한 번도 볼륨이 줄어드는 느낌이 없었다"는 재지적을
// 계속 받아서 재조사한 결과, 볼륨 자체(GainNode)는 문제가 아니라 크로스페이드
// 트리거 조건(remaining <= musicFadeOutSeconds)이 애초에 걸리지 않았을
// 가능성이 가장 유력하다는 결론에 도달했다 — player.duration이 네트워크
// 스트리밍 도중 안정적으로 잡히지 않으면(hasDuration=false) 이 함수가 매번
// 조기 return되어 크로스페이드 자체가 시작도 못 한다. 이번엔 다음 곡을 훨씬
// 여유 있게(끝나기 18초 전) 통째로 미리 받아두는 방식으로 바꿔서, 그 시점의
// duration은 완전히 로컬에 있는 blob 기준이라 네트워크와 무관하게 확실히
// 잡힌다. musicFadeOutSeconds(4초)는 여전히 "언제부터 볼륨을 실제로 줄이기
// 시작할지"의 타이밍으로 그대로 쓰고, 이 값은 "언제부터 다음 곡을 미리
// 받기 시작할지"를 가리키는 별도의, 더 이른 시점이다.
//
// 2026-07-16: 네이티브 크로스페이드용 prefetchNext도 이 시점에 같이 나가는데,
// 실기기 로그로 직접 확인해보니 18초로는 여유가 부족해서 crossfadeStart
// (끝나기 4초 전) 시점에 로컬 캐시가 아직 준비 안 된 채로 원격 스트리밍
// 폴백으로 떨어지는 경우가 실제로 관찰됐다 — 크로스페이드가 매끄럽지 않게
// 느껴지고 초반이 씹히는 원인. 다운로드에 더 여유를 주기 위해 28초로 늘린다.
const musicPrebufferLeadSeconds = 28;

// 두 개의 <audio>를 번갈아 쓴다 — 하나(activePlayer)가 페이드아웃되는 동안
// 다른 하나(standbyPlayer)가 이미 다음 곡을 재생 중이어야 겹치는 소리가
// 난다. 곡이 끝나면 역할만 서로 바꾼다(swap), 새로 로드하지 않는다.
const musicPlayers = [bgAudio, bgAudioB].filter(Boolean);
// 2026-07-12 버그 수정: R2(pub-xxxx.r2.dev)로 옮긴 뒤 "재생은 되는데(진행률은
// 움직이는데) 소리가 전혀 안 남" 증상 — ensureAudioGraph()가 이 <audio>들을
// createMediaElementSource로 Web Audio API(GainNode)에 물려서 재생하는데,
// R2 버킷에 CORS 정책이 없으면 loadMusicTrack의 fetch(url)이 조용히 실패해
// player.src = url(원격 URL 직결) 폴백으로 떨어지고, 이 상태에서 다른 출처
// 미디어를 Web Audio 그래프에 연결하면 브라우저가 보안상 출력을 무음으로
// 만든다(오디오 자체는 정상 재생되는 것처럼 보여도). crossOrigin="anonymous"를
// 미리 지정해두면 fetch가 CORS 모드로 명확히 요청하고, R2 쪽 CORS 정책만
// 맞으면(버킷 Settings > CORS Policy) 이 경로가 정상 작동한다.
musicPlayers.forEach((player) => { player.crossOrigin = "anonymous"; });
// 2026-07-15 2차 시도 후 롤백: masterGainNode 외에 HTMLMediaElement.muted도
// true로 걸어서 iOS가 이 <audio>를 아예 무음 미디어로 인식하게 하려 했으나,
// 실기기 테스트에서 비주얼라이저가 재생 5초 즈음부터 완전히 멈추는 새 증상이
// 나타났다 — iOS WebKit은 (Chrome 등과 달리) createMediaElementSource로 이미
// Web Audio 그래프에 연결된 엘리먼트라도 .muted=true를 걸면 일정 시간 뒤
// AnalyserNode로 가는 실제 신호 자체를 끊어버리는 것으로 실측 확인됐다(사전
// 예상과 다른 실기기 특성). 그런데도 배경전환 시 소리가 끊기는 핵심 증상은
// 해결되지 않아 — 새 회귀만 만들고 실익이 없어 롤백한다. masterGainNode
// 단독 음소거 방식으로 되돌리고, 배경 오디오 문제는 NativeRadioPlayer.swift의
// 오디오 세션 인터럽션(.ended) 처리 쪽에서 다시 접근한다.
let activePlayerIndex = 0;
let crossfadeTriggered = false;
let pendingNextIndex = -1;
// 2026-07-30 신설(안드로이드 전용, CLAUDE.md 35-B (a)안) — 프리페치 2단계
// 슬롯의 웹측 미러. pendingNextIndex(슬롯1: 네이티브 crossfadePlayer)에 더해,
// 그 다음다음 곡(슬롯2: 네이티브 prefetchQueue)의 인덱스를 기억해둔다.
// 배경: 백그라운드 무음의 최종 실측 — 곡 전환 시점에 웹의 prefetch/crossfade
// 명령이 아예 도착하지 않아 매번 needNext 비상 왕복에 의존하고 있었고, 그
// 왕복이 유실되면 그대로 무음 정지였다. 웹이 깨어있는 순간에 2곡을 미리
// 보내두면 네이티브가 두 번의 전환을 자력으로 이어간다. iOS는 프리페치가
// 단일 슬롯 교체 방식(NativeRadioPlayer.prefetch)이라 슬롯2를 보내면 오히려
// 슬롯1을 덮어써 크로스페이드가 깨진다 — 반드시 안드로이드에서만 쓴다.
let pendingSecondIndex = -1;
function isAndroidNativeWrapper() {
  return isNativeWrapper && !!window.AndroidNativeBridge;
}
// 슬롯2 채우기 — 픽·청취기록·네이티브 전송까지. 슬롯1(pendingNextIndex)이
// 이미 예약된 상태에서만 부른다(순서 보장: 네이티브 큐는 FIFO).
function fillSecondPrefetchSlot() {
  if (!isAndroidNativeWrapper()) return;
  if (pendingSecondIndex >= 0 || pendingNextIndex < 0) return;
  if (!Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return;
  pendingSecondIndex = pickNextTrackIndex();
  recordTrackHeard(pendingSecondIndex);
  const upcoming2 = musicPlaylist[pendingSecondIndex % musicPlaylist.length];
  if (upcoming2) {
    postToNativeRadio({ action: "prefetchNext", url: resolveTrackAbsoluteUrl(upcoming2) });
  }
}

// 2026-07-15 구조적 재설계(4차 시도까지 실패 후): 네이티브 앱(isNativeWrapper)
// 에서는 이 <audio> 엘리먼트를 절대로 실제 play()하지 않는다. 실기기에서
// 확인된 결정적 단서 — 제어센터를 열어 음량을 조절하는 순간(=앱이 잠깐
// willResignActive→didBecomeActive를 거치는 순간)에만 죽어있던 비주얼라이저가
// 반짝 살아났다가 다시 죽었다. 이는 WKWebView 내부의 <audio>가(masterGainNode로
// 출력만 죽여놔도) 몇 초 뒤 iOS에 의해 파이프라인 자체가 서스펜드되고,
// 앱 활성 상태가 잠깐 바뀌는 순간(__flipzenNativeTimeSync가 예전엔 그 안에서
// player.play()를 다시 불렀다)에만 우연히 되살아났다는 뜻이다 — 그리고 이
// <audio>가 "재생 중" 상태를 유지하는 것 자체가 iOS 공유 AVAudioSession을
// 놓고 네이티브 AVPlayer와 경합해 배경재생이 끊기는 진짜 원인이었다
// (Swift 쪽 세션 재적용 타이밍 문제가 아니었다). 진짜 소리는 이미 네이티브
// AVPlayer가 전담하고 있고, 크로스페이드도 masterGainNode=0으로 원래부터
// 유저 귀에는 안 들렸으므로(네이티브는 trackChanged 시점에 크로스페이드 없이
// 바로 전환한다 — NativeRadioPlayer.swift 참조), 이 <audio>가 실제로
// "재생"될 필요 자체가 없다 — 다음 곡 전환 타이밍과 화면 진행률만 계산하면
// 충분하다. 그래서 실제 play()를 걸지 않고, 대신 이 가상시계가 currentTime을
// 직접 전진시켜 timeupdate를 발생시킨다(setter로 currentTime을 바꾸면 paused
// 상태에서도 timeupdate가 발생한다) — 그러면 updateMusicProgress/크로스페이드
// 예약 로직을 그대로 재사용할 수 있다. 트레이드오프: 실제 오디오 신호가 없어
// 비주얼라이저는 항상 대기(idle) 애니메이션으로 폴백한다(activeMusicAnalyser
// 참조).
let nativeClockTimerId = null;
let nativeClockLastTs = 0;

function startNativeVirtualClock() {
  if (!isNativeWrapper || nativeClockTimerId !== null) return;
  nativeClockLastTs = performance.now();
  nativeClockTimerId = window.setInterval(tickNativeVirtualClock, 250);
}

function stopNativeVirtualClock() {
  if (nativeClockTimerId !== null) {
    window.clearInterval(nativeClockTimerId);
    nativeClockTimerId = null;
  }
}

function tickNativeVirtualClock() {
  if (!musicPlaying) return;
  const player = activePlayer();
  if (!player) return;
  const now = performance.now();
  const dt = (now - nativeClockLastTs) / 1000;
  nativeClockLastTs = now;
  // 탭이 백그라운드에서 돌아오는 등으로 dt가 비정상적으로 크면(브라우저가
  // 타이머를 오래 쉬었다 몰아서 실행) 그대로 반영하지 않는다 — 이 경우
  // __flipzenNativeTimeSync가 이미 네이티브의 진짜 위치로 currentTime을
  // 다시 맞춰주므로, 여기서는 그냥 이번 tick만 건너뛴다.
  if (!(dt > 0) || dt > 5) return;
  player.currentTime = (player.currentTime || 0) + dt;
  updateMusicProgress({ target: player }); // 진행률/프리버퍼/크로스페이드 예약 로직 재사용
  const liveDuration = player.duration;
  const duration = Number.isFinite(liveDuration) && liveDuration > 0
    ? liveDuration
    : parseFloat(player.dataset.cachedDuration || "NaN");
  if (Number.isFinite(duration) && duration > 0 && player.currentTime >= duration - 0.05) {
    // 실제로 play() 중이 아니므로 브라우저의 "ended" 이벤트가 오지 않는다 —
    // 곡 끝 도달을 직접 감지해서 handleActivePlayerEnded와 동일하게 처리한다.
    handleActivePlayerEnded({ target: player });
  }
}

function activePlayer() {
  return musicPlayers[activePlayerIndex] || bgAudio;
}

function standbyPlayer() {
  if (musicPlayers.length < 2) return null;
  return musicPlayers[1 - activePlayerIndex];
}

// 2026-07-13: 음악 정보 패널의 오디오 비주얼라이저. 실제 트랙 파일이
// same-origin(R2 fetch 후 blob URL로 재생, resolveTrackUrl/loadMusicTrack
// 참조)이라 CORS로 분석 데이터가 막힐 일이 거의 없다 — 그래도 AnalyserNode
// 자체를 못 만드는 예외적 환경(구형 브라우저 등) 대비로 조용한 폴백만 둔다.
// 2026-07-13 8차: 운영자가 첨부한 macOS 스펙트럼 스타일 참고 영상 — 가는
// 막대 다수, 조용할 땐 점처럼 수축, 활성 구간만 봉긋 솟는 모양. 7차의
// "14개, 넓은 폭"이 오히려 어색하다는 피드백으로 다시 늘렸다.
// 2026-07-22 유저 요청 — "지겨워질 때 바꿀 수 있는" 비주얼라이저 커스터마이징
// 옵션 7종(색상/감도/베이스펀치/모양/밀도/좌우배치/유휴애니메이션). 설정은
// localStorage에 저장되고, 설정 페이지 "비주얼라이저" 카드(index.html,
// Special과 들은 음악 사이)에서 바꾼 즉시 반영된다. 각 옵션의 실제 적용
// 지점은 아래 각 draw 함수/헬퍼 참조.
const MUSIC_VIZ_COLOR_PRESETS = {
  // rainbow/mono은 공식이 달라 아래 getVizBarColorProps()에서 별도 분기 —
  // 여기엔 "단일색 그라데이션" 3종만 base(중심 hue)/spread(폭)로 정의.
  ocean: { base: 195, spread: 50 },
  sunset: { base: 335, spread: 55 },
  neonpurple: { base: 262, spread: 55 }
};
const MUSIC_VIZ_SENSITIVITY_PRESETS = {
  calm: { heightMul: 0.68, attackMul: 0.6 },
  normal: { heightMul: 1, attackMul: 1 },
  intense: { heightMul: 1.32, attackMul: 1.2 }
};
// 2026-07-22 운영 피드백 — "바꿔도 뭐가 바뀐지 잘 모르겠다"는 재지적으로
// strong 배율을 1.6 → 2.2로 키워 체감 차이를 키웠다. 다만 이 효과는 곡에
// 실제로 뚜렷한 킥 드럼/베이스 타격이 있을 때만 발동한다 — 잔잔한 배경음악
// 구간에서는 강하게로 바꿔도 원래 타격 자체가 감지 안 돼 차이가 없을 수
// 있다(설정 자체 결함이 아니라 오디오 콘텐츠 특성).
const MUSIC_VIZ_BASS_PUNCH_PRESETS = { off: 0, normal: 1, strong: 2.2 };
const MUSIC_VIZ_DENSITY_PRESETS = { dense: 48, normal: 34, wide: 20 };
// 2026-07-22 유저 요청 — "고음/저음 차이를 더 크게" 하는 대비(contrast) 옵션.
// 값은 "얼마나 더 벌릴지"를 나타내는 순수 배율 스칼라 하나뿐이고, 실제 공식은
// 경로(네이티브/애널라이저)마다 다르게 적용한다(아래 drawMusicVizNative/
// drawMusicViz 참조) — 기존에 이미 존재하던 위치 기반 저음↔고음 곡선(가중치,
// trebleBoost 등)은 그대로 두고 그 위에 배율만 하나 더 곱하는 방식이라
// 회귀 위험이 낮다. normal(0)은 기존 동작과 완전히 동일.
const MUSIC_VIZ_CONTRAST_PRESETS = { normal: 0, boost: 0.5, strong: 1.0 };
const MUSIC_VIZ_SETTINGS_DEFAULT = {
  color: "rainbow",       // rainbow | rainbow2 | ocean | sunset | neonpurple | mono
  sensitivity: "normal",  // calm | normal | intense
  bassPunch: "normal",    // off | normal | strong
  shape: "capsule",       // capsule | block | line
  density: "normal",      // dense | normal | wide
  layout: "sweep",        // sweep | mirror
  idle: "breathe",        // breathe | sparkle | minimal
  contrast: "normal",     // normal | boost | strong — 고음/저음 차이 강조 정도
  pointBars: "off"        // off | on — 맨 끝 2개 막대만 고음 트랜지언트에 유독 예민하게
};
const musicVizSettingsStorageKey = "ezlong:musicVizSettings";
let musicVizSettings = { ...MUSIC_VIZ_SETTINGS_DEFAULT };
function loadMusicVizSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(musicVizSettingsStorageKey) || "null");
    if (raw && typeof raw === "object") musicVizSettings = { ...MUSIC_VIZ_SETTINGS_DEFAULT, ...raw };
  } catch (e) {}
}
function saveMusicVizSettings() {
  try { localStorage.setItem(musicVizSettingsStorageKey, JSON.stringify(musicVizSettings)); } catch (e) {}
}
loadMusicVizSettings();

// 막대 위치(i)별 hue/saturation을 현재 색상 설정에 맞춰 계산한다. rainbow는
// 기존 공식(0~300도, 왼쪽에서 오른쪽으로 쫙 펼침)을 그대로 유지해 기본값
// 사용자는 시각적으로 전혀 달라지지 않는다. ocean/sunset/neonpurple은 중심
// hue ± spread/2 범위의 좁은 폭으로 "단일색 그라데이션" 느낌을 낸다. mono는
// hue 자체를 쓰지 않고 채도(sat)를 낮춰 흰색~은색 계열로 보이게 한다.
function getVizBarColorProps(i, count) {
  const t = count > 1 ? i / (count - 1) : 0;
  // 2026-07-22 유저 재지적 — "화이트"가 실제로는 채도만 낮춘 회색이라 흰색처럼
  // 안 보였다. hsl 명도(lightness) 자체를 훨씬 높은 구간(88~98%)으로 끌어올려
  // 실제로 흰빛에 가깝게 보이도록 lightBase/lightRange를 별도로 준다(다른
  // 색상 프리셋은 기존 52~66% 그대로 — --bar-light-base/--bar-light-range
  // CSS 변수 기본값과 동일해 시각적으로 안 바뀐다).
  if (musicVizSettings.color === "mono") return { hue: 0, sat: 0, lightBase: 88, lightRange: 10 };
  if (musicVizSettings.color === "rainbow") return { hue: Math.round(t * 300), sat: 92, lightBase: 52, lightRange: 14 };
  // 2026-07-22 유저 요청 — "반무지개": 빨강(0)→보라(300)이 아니라 보라(300)
  // →빨강(0)으로, 방향만 뒤집은 무지개.
  if (musicVizSettings.color === "rainbow2") return { hue: Math.round(300 - t * 300), sat: 92, lightBase: 52, lightRange: 14 };
  const preset = MUSIC_VIZ_COLOR_PRESETS[musicVizSettings.color] || MUSIC_VIZ_COLOR_PRESETS.ocean;
  const hue = Math.round((((preset.base + (t - 0.5) * preset.spread) % 360) + 360) % 360);
  return { hue, sat: 92, lightBase: 52, lightRange: 14 };
}
// 막대 하나에 색상 관련 CSS 변수 4종을 한 번에 적용한다(초기 생성/설정 변경
// 시 공용으로 재사용).
function applyVizBarColorVars(barEl, i, count) {
  const props = getVizBarColorProps(i, count);
  barEl.style.setProperty("--bar-hue", props.hue);
  barEl.style.setProperty("--bar-sat", props.sat + "%");
  barEl.style.setProperty("--bar-light-base", props.lightBase + "%");
  barEl.style.setProperty("--bar-light-range", props.lightRange + "%");
}
// 이미 만들어진 막대들에 색상 설정만 다시 입힌다(모양/밀도와 달리 DOM을
// 새로 만들 필요 없이 CSS 변수만 갱신하면 되는 가벼운 변경). 본화면 막대와
// 설정 페이지 미리보기 막대 둘 다 대상으로 한다.
function applyMusicVizColorToBars() {
  [musicVizBarEls, musicVizPreviewBarEls].forEach((arr) => {
    if (!arr) return;
    for (let i = 0; i < arr.length; i++) applyVizBarColorVars(arr[i], i, arr.length);
  });
}
// 막대 모양(캡슐/블록/라인) — styles.css의 .viz-shape-* 클래스가 실제 CSS를
// 담당하고, 여기선 그 클래스만 wrap에 토글한다.
function applyMusicVizShapeClass() {
  const shapeClass = "viz-shape-" + (musicVizSettings.shape || "capsule");
  [musicVizWrap, musicVizPreviewWrap].forEach((wrap) => {
    if (!wrap) return;
    wrap.classList.remove("viz-shape-capsule", "viz-shape-block", "viz-shape-line");
    wrap.classList.add(shapeClass);
  });
}
// 2026-07-22 운영 피드백 — "예민에서 막대가 박스 높이에 다 닿아서 다 똑같아
// 보인다. 무조건 위에서 자르지 말고, 예민일 때만 박스 자체의 height를
// 키워달라." drawMusicViz/drawMusicVizNative의 `target = Math.min(target, h)`
// 클램프는 그대로 두되(막대가 박스를 뚫고 나가는 건 여전히 막아야 함),
// h(=musicVizWrap.clientHeight)는 매 프레임 실측값이라 CSS로 박스 자체를
// 키우면 클램프 상한도 자동으로 같이 올라간다 — JS 쪽은 전혀 건드릴 필요
// 없다. .viz-sens-intense 클래스를 wrap 2개(본화면/미리보기) + 본화면
// 패널(.music-info-panel, max-height도 같이 커져야 늘어난 wrap이 패널
// 경계에서 잘리지 않는다)에 토글하고, 실제 height 값은 styles.css의
// .viz-sens-intense 규칙이 담당한다.
function applyMusicVizSensitivityClass() {
  const isIntense = musicVizSettings.sensitivity === "intense";
  [musicVizWrap, musicVizPreviewWrap].forEach((wrap) => {
    if (wrap) wrap.classList.toggle("viz-sens-intense", isIntense);
  });
  if (musicInfoPanel) musicInfoPanel.classList.toggle("viz-sens-intense", isIntense);
}
// "좌우 배치" 미러 모드용 — 물리적 화면상 j번째 막대가 어느 논리 채널(저음
// 0~고음 n-1) 값을 보여줄지 결정한다. sweep(기본)은 항등함수(j 그대로).
// mirror는 중앙을 저음(0)으로 두고 양 끝으로 갈수록 고음 쪽 채널을 보여줘
// 중앙에서 좌우 대칭으로 뻗어나가는 VU미터 느낌을 낸다 — 실제 오디오 분석/
// 대역 매핑 로직(nativeVizBandWeights 등)은 전혀 건드리지 않고, 이미 계산된
// 채널별 값을 어느 막대에 "그릴지"만 재배치하는 순수 시각 효과라 회귀 위험이
// 낮다.
function vizMirrorSourceIndex(j, n) {
  if (musicVizSettings.layout !== "mirror" || n <= 1) return j;
  const center = (n - 1) / 2;
  return Math.min(n - 1, Math.round(Math.abs(j - center)));
}
// 3개 draw 함수(idle/native/analyser)가 공통으로 쓰는 최종 DOM 반영 단계.
// 각 draw 함수는 musicVizBars[i](막대 높이)와 musicVizIntensity[i](밝기
// 0~1)만 채우고, 실제 style.height/--bar-intensity 대입과 미러 재배치는
// 전부 여기서 한 곳으로 모아 처리한다.
// 2026-07-25 이슈 제보(배터리 급소모) — drawMusicViz는 requestAnimationFrame으로
// 화면 주사율만큼(ProMotion 기기면 최대 120회/초) 계속 돌아가는데, 실제
// 오디오 반응 값(nativeAudioBass/Mid/Treble)은 네이티브에서 15Hz로만 갱신된다
// (ios CLAUDE.md 28항 "15Hz 스냅샷 방출" 규격). 즉 대부분의 rAF 틱은 같은
// 값으로 최대 34개 막대 × 2곳(본화면+미리보기) 스타일을 다시 쓰는 낭비였다.
// 오디오 반응 계산(EMA/타격감지 등, 위 draw 함수들)은 튜닝된 타이밍이 깨질까
// 봐 손대지 않고, 실제로 비용이 큰 이 DOM 쓰기 단계만 30fps로 캡을 씌운다 —
// 사람 눈에는 30fps도 충분히 매끄럽고, 15Hz 오디오 갱신 주기보다는 여전히
// 2배 빠르므로 반응성 체감도 그대로다.
let vizBarsLastWriteTs = 0;
const VIZ_BAR_WRITE_MIN_INTERVAL_MS = 1000 / 30;
function writeVizBarsToDom() {
  const nowTs = performance.now();
  if (nowTs - vizBarsLastWriteTs < VIZ_BAR_WRITE_MIN_INTERVAL_MS) return;
  vizBarsLastWriteTs = nowTs;
  const n = MUSIC_VIZ_BAR_COUNT;
  for (let j = 0; j < n; j++) {
    const src = vizMirrorSourceIndex(j, n);
    const height = Math.round(musicVizBars[src]) + "px";
    const intensity = (musicVizIntensity[src] || 0).toFixed(3);
    if (musicVizBarEls) {
      musicVizBarEls[j].style.height = height;
      musicVizBarEls[j].style.setProperty("--bar-intensity", intensity);
    }
    // 2026-07-22 유저 요청 — 설정 페이지 미리보기 막대도 같은 값으로 동시에
    // 갱신한다(본화면과 완전히 동일한 오디오 반응, 별도 계산 없음).
    if (musicVizPreviewBarEls) {
      musicVizPreviewBarEls[j].style.height = height;
      musicVizPreviewBarEls[j].style.setProperty("--bar-intensity", intensity);
    }
  }
}
function getVizSensitivity() {
  return MUSIC_VIZ_SENSITIVITY_PRESETS[musicVizSettings.sensitivity] || MUSIC_VIZ_SENSITIVITY_PRESETS.normal;
}
function getVizContrastAmount() {
  const v = MUSIC_VIZ_CONTRAST_PRESETS[musicVizSettings.contrast];
  return typeof v === "number" ? v : 0;
}
function isVizPointBarsOn() {
  return musicVizSettings.pointBars === "on";
}
function getVizBassPunchMul() {
  const v = MUSIC_VIZ_BASS_PUNCH_PRESETS[musicVizSettings.bassPunch];
  return typeof v === "number" ? v : 1;
}

let MUSIC_VIZ_BAR_COUNT = MUSIC_VIZ_DENSITY_PRESETS[musicVizSettings.density] || 34;
let musicVizBars = new Array(MUSIC_VIZ_BAR_COUNT).fill(0);
let musicVizIntensity = new Array(MUSIC_VIZ_BAR_COUNT).fill(0.1);
let musicVizSparklePhase = new Array(MUSIC_VIZ_BAR_COUNT).fill(0);
let musicVizBandRanges = null;
let musicVizAnimId = null;
let musicVizIdlePhase = 0;
let musicVizBarEls = null;
let musicVizPreviewBarEls = null;
// "밀도(개수)" 설정 변경 시 막대 DOM을 통째로 다시 만든다(본화면 + 미리보기
// 둘 다). ensureMusicVizBarsBuilt는 appendChild만 하고 innerHTML을 지우지
// 않으므로, .viz-bar만 골라 제거해야 그 형제인 "퇴근 세리모니" 문구
// (#musicLeaveWork, 본화면 wrap 전용)가 함께 지워지지 않는다.
function rebuildMusicVizBars() {
  const wasBuilt = !!musicVizBarEls;
  const previewWasBuilt = !!musicVizPreviewBarEls;
  if (wasBuilt && musicVizWrap) musicVizWrap.querySelectorAll(".viz-bar").forEach((el) => el.remove());
  if (previewWasBuilt && musicVizPreviewWrap) musicVizPreviewWrap.querySelectorAll(".viz-bar").forEach((el) => el.remove());
  musicVizBarEls = null;
  musicVizPreviewBarEls = null;
  musicVizBandRanges = null;
  MUSIC_VIZ_BAR_COUNT = MUSIC_VIZ_DENSITY_PRESETS[musicVizSettings.density] || 34;
  musicVizBars = new Array(MUSIC_VIZ_BAR_COUNT).fill(0);
  musicVizIntensity = new Array(MUSIC_VIZ_BAR_COUNT).fill(0.1);
  musicVizSparklePhase = new Array(MUSIC_VIZ_BAR_COUNT).fill(0);
  // 열려있던 쪽만 즉시 다시 그려서 반영 — 둘 다 닫혀 있었다면 다음에 열릴
  // 때 ensureMusicVizBarsBuilt가 새 개수로 알아서 만든다.
  if (wasBuilt || previewWasBuilt) ensureMusicVizBarsBuilt();
}
// 2026-07-14 18차: "고음/드럼 반응이 약하다, 더 다이나믹하게"라는 피드백 —
// 베이스(저음) 대역의 순간 에너지가 최근 평균보다 확 튀는 순간(=드럼/킥
// 타격)을 감지해 맨 왼쪽 1~2개 막대에 짧고 강한 펀치를 얹는다.
// musicVizBassEnergyAvg = 최근 베이스 에너지의 느린 이동평균(기준선),
// musicVizBassHit = 타격 감지 시 1로 튀었다가 프레임마다 빠르게 감쇠하는 값.
let musicVizBassEnergyAvg = 0;
let musicVizBassHit = 0;
// 2026-07-22 2차 유저 요청 — "포인트 막대"(맨 끝 2개, 고음 전용 예민 반응)용
// 트레블 타격 감지. 위 베이스 타격 감지(musicVizBassEnergyAvg/musicVizBassHit)와
// 똑같은 패턴을 고음역에 그대로 복제한 것 — 이미 검증된 방식이라 회귀 위험이 낮다.
let musicVizTrebleEnergyAvg = 0;
let musicVizTrebleHit = 0;

// 2026-08-11 신설 — 킥 온셋 검출과 느린 자동이득의 상태.
//   musicVizKickPrev  : 직전 프레임의 30~90Hz 에너지(오름폭 계산용)
//   musicVizKickFluxAvg: 오름폭의 이동평균 — 곡마다 다른 문턱을 자동으로 맞춘다
//   musicVizKickLastAt : 마지막 타격 시각 — 불응기(120ms)로 이중계산 방지
//   musicVizAgcPeak    : 최근 몇 초의 최댓값 — 프레임별 정규화를 대체한다
let musicVizKickPrev = 0;
let musicVizKickFluxAvg = 0;
let musicVizKickLastAt = 0;
let musicVizAgcPeak = 60;

// 2026-08-11 전면 교체 — 이전 판은 **bin 번호**로 로그 경계를 만들었고,
// 시작을 log10(1)=0 으로 잡아 경계 첫 값이 **1** 이었다. 그 바람에
// **0번 bin 이 통째로 빠졌다.** fftSize 128 에서 0번 bin 은 0~345Hz —
// 즉 킥과 베이스 전부다. 비주얼라이저가 박자를 못 보여준 진짜 이유가 이것이다.
//
// 새 판은 bin 번호가 아니라 **실제 주파수**로 경계를 잡는다.
//   · 0번 막대 = 30~90Hz — 킥 전용. 이 막대 하나가 박자를 친다.
//   · 나머지 = 90Hz~16kHz 를 로그로 나눈다(귀가 듣는 방식).
function buildMusicVizBands(analyser, barCount) {
  const binCount = analyser.frequencyBinCount;
  const nyquist = (analyser.context ? analyser.context.sampleRate : 44100) / 2;
  const binOf = (hz) => Math.max(0, Math.min(binCount, Math.round(hz / nyquist * binCount)));
  const bounds = [binOf(30), binOf(90)];
  const loLog = Math.log10(90);
  const hiLog = Math.log10(Math.min(16000, nyquist));
  for (let i = 1; i <= barCount - 1; i++) {
    const t = i / (barCount - 1);
    const hz = Math.pow(10, loLog + t * (hiLog - loLog));
    bounds.push(Math.max(binOf(hz), bounds[bounds.length - 1] + 1));
  }
  return bounds;
}

// 2026-07-13 3차: 1차(무지개 LED 세그먼트) → 2차(backdrop-filter 블러 유리)를
// 거쳐, "플립시계 디자인과 같은 스타일"이라는 요청에 맞춰 캔버스 자체를
// 걷어내고 실제 DOM 막대 26개로 교체했다. 캔버스 위에서 그라디언트+inset
// shadow를 근사하는 대신, .viz-bar CSS 클래스가 .flip-card와 완전히 같은
// 배경/보더/그림자 값을 그대로 쓰게 해서 "같은 스타일"을 픽셀 단위로
// 보장한다. DOM은 한 번만 만들고, 매 프레임은 각 막대의 style.height만
// 갱신 — 너비는 flex가 자동으로 맞춰주므로 별도 리사이즈 로직도 불필요.
// 막대 N개를 만들어 wrap에 붙이고 엘리먼트 배열을 돌려준다. 본화면/미리보기
// 둘 다 이 함수 하나로 만든다 — 완전히 같은 모양·색상 로직을 보장하기 위해.
function buildVizBarsInto(wrap) {
  if (!wrap) return null;
  const frag = document.createDocumentFragment();
  const els = [];
  for (let i = 0; i < MUSIC_VIZ_BAR_COUNT; i++) {
    const bar = document.createElement("span");
    bar.className = "viz-bar";
    // 2026-07-14 12차: "밋밋하다 — 첫날처럼 컬러를 넣되 투명하게"라는 요청 —
    // 막대 위치 기준으로 무지개 hue를 한 번만 정해서 CSS 커스텀 프로퍼티로
    // 심어둔다. 실시간 밝기/알파는 --bar-intensity로 매 프레임 따로 갱신
    // (drawMusicViz/drawMusicVizIdle 참조) — hue는 고정, intensity만 움직인다.
    applyVizBarColorVars(bar, i, MUSIC_VIZ_BAR_COUNT);
    bar.style.setProperty("--bar-intensity", "0.1");
    els.push(bar);
    frag.appendChild(bar);
  }
  wrap.appendChild(frag);
  return els;
}

function ensureMusicVizBarsBuilt() {
  if (musicVizWrap && !musicVizBarEls) musicVizBarEls = buildVizBarsInto(musicVizWrap);
  if (musicVizPreviewWrap && !musicVizPreviewBarEls) musicVizPreviewBarEls = buildVizBarsInto(musicVizPreviewWrap);
  applyMusicVizShapeClass();
  applyMusicVizSensitivityClass();
}

function ensureMusicVizGraph() {
  // 2026-08-05 긴급 수정 — 여기서 ensureAudioGraph()를 부르면 안 된다.
  //
  // ensureAudioGraph()는 AudioContext를 만들면서 <audio> 두 개를
  // createMediaElementSource로 그래프에 **영구히** 물린다. iOS는 사용자
  // 제스처 밖에서 만들어진 AudioContext를 suspended/interrupted 상태로
  // 두는데, 그 죽어 있는 그래프에 물린 <audio>는 재생 시계(currentTime/
  // duration)가 흔들린다. 이 앱은 그 시계로 크로스페이드 시점을 계산하므로
  // (timeupdate의 remaining = duration - currentTime), 시계가 흔들리면
  // 곡 한복판에서 "끝났다"고 판단해 다음 곡으로 넘어간다.
  //
  // 그래서 그래프 생성은 원래 자리(playMusic — 사용자가 재생을 누른 그
  // 순간)에만 둔다. 여기서는 막대 DOM만 만든다. 잃는 것은 없다 — 음악이
  // 멈춰 있는 동안 비주얼라이저는 분석기를 쓰지 않고 바닥에 깔려 있고,
  // 분석기가 필요한 순간에는 이미 그래프가 만들어져 있다.
  ensureMusicVizBarsBuilt();
}

// 오디오 그래프를 못 쓰는 예외적 환경을 위한 잔잔한 폴백 웨이브. 실제
// 소리는 대부분 정상 분석되므로 이 분기는 안전장치 성격이 강하다.
// 2026-08-05 운영 지침 — 음악이 멈춰 있을 때의 모습. 사인파도 반짝임도
// 없이, 막대가 있던 자리에서 바닥까지 스르르 내려앉는다. 다 내려앉으면
// true를 돌려주고, 호출자는 그때 rAF 루프 자체를 끝낸다(정지 화면을
// 60fps로 다시 그릴 이유가 없다 — 배터리).
function drawMusicVizFlat(h) {
  const FLOOR = 3;
  let settled = true;
  for (let i = 0; i < MUSIC_VIZ_BAR_COUNT; i++) {
    musicVizBars[i] += (FLOOR - musicVizBars[i]) * 0.18;
    if (Math.abs(musicVizBars[i] - FLOOR) > 0.4) settled = false;
    musicVizIntensity[i] = Math.min(1, musicVizBars[i] / h);
  }
  writeVizBarsToDom();
  return settled;
}

function drawMusicVizIdle(h) {
  musicVizIdlePhase += 0.045;
  // 2026-07-22 유저 요청 — 유휴(대기) 애니메이션 스타일 3종. 실제 오디오
  // 신호가 없을 때(패널만 열려있거나 네이티브 레벨이 잠깐 끊겼을 때) 보여주는
  // 이 "숨쉬기" 패턴 자체를 취향껏 고를 수 있게 했다.
  const idleStyle = musicVizSettings.idle || "breathe";
  for (let i = 0; i < MUSIC_VIZ_BAR_COUNT; i++) {
    // 2026-07-14 13차: 아래 drawMusicViz와 같은 "산 모양" 실루엣 곡선을
    // 대기 상태에도 동일하게 적용 — 실제 음악이 안 걸려도 늘 예쁜 모양.
    // 2026-07-14 18차: 실제 재생 중 곡선과 억제 폭(0.75~1.0)을 맞춰 통일.
    const t = i / (MUSIC_VIZ_BAR_COUNT - 1);
    const shapeEnvelope = 0.75 + 0.25 * Math.sin(Math.PI * t);
    let target;
    if (idleStyle === "minimal") {
      // 거의 안 움직이는 미니멀형 — 진폭을 기본(0.4)의 약 1/3로 낮춤.
      const wave = Math.sin(musicVizIdlePhase * 0.6 + i * 0.7) * 0.5 + 0.5;
      target = (4 + wave * (h * 0.14)) * shapeEnvelope;
    } else if (idleStyle === "sparkle") {
      // 반짝임형 — 매 프레임 낮은 확률로 막대 하나가 확 튀었다가 빠르게 가라앉는다.
      const flicker = Math.random() < 0.05 ? 1 : 0;
      musicVizSparklePhase[i] = Math.max(musicVizSparklePhase[i] * 0.86, flicker);
      target = (4 + musicVizSparklePhase[i] * (h * 0.55)) * shapeEnvelope;
    } else {
      // breathe(기본) — 기존 완만한 사인파 숨쉬기 그대로.
      const wave = Math.sin(musicVizIdlePhase + i * 0.7) * 0.5 + 0.5;
      target = (4 + wave * (h * 0.4)) * shapeEnvelope;
    }
    const factor = target > musicVizBars[i] ? 0.4 : 0.12;
    musicVizBars[i] += (target - musicVizBars[i]) * factor;
    musicVizIntensity[i] = Math.min(1, musicVizBars[i] / h);
  }
  writeVizBarsToDom();
}

// 2026-07-15: 네이티브 앱에서 실제 오디오에 반응하는 비주얼라이저.
// NativeRadioPlayer.swift의 MTAudioProcessingTap이 15Hz로 계산해준 저음/
// 중음/고음 3개 대역 에너지(nativeAudioBass/Mid/Treble, 0...1)를 34개 막대에
// 매핑한다 — 실제 34-bin FFT처럼 촘촘한 스펙트럼은 아니지만(3개 대역뿐),
// "진짜 소리에 반응한다"는 체감은 충분히 준다. 기존 drawMusicViz의 "산 모양"
// 실루엣(shapeEnvelope)과 어택/릴리즈 감쇠, 베이스 타격 펀치 연출을 그대로
// 재사용해 실제 FFT 경로와 시각적 언어를 통일한다.
let nativeAudioBass = 0;
let nativeAudioMid = 0;
let nativeAudioTreble = 0;
let nativeAudioLevelReceivedAt = 0;

window.__flipzenNativeAudioLevels = function (bass, mid, treble) {
  if (!isNativeWrapper) return;
  nativeAudioBass = Number.isFinite(bass) ? bass : 0;
  nativeAudioMid = Number.isFinite(mid) ? mid : 0;
  nativeAudioTreble = Number.isFinite(treble) ? treble : 0;
  nativeAudioLevelReceivedAt = Date.now();
};

// 2026-08-10 3차 이슈 제보 — "음은 세게 나오는데 파동은 0.x초 늦다.
// 음에 맞춰 춤추는 게 아니라 제멋대로다. 아이폰과 달리 뻑뻑하다."
//
// 안드로이드는 이제 값을 받아 기다리지 않고, 그리기 직전에 직접 집어 온다.
// 왜 그래야 하는지는 NativeRadioService.kt 링버퍼 주석에 길게 적어 두었다 —
// 요약하면 (1) 네이티브 탭은 스피커보다 앞서 있고 (2) 밀어 넣는 길은
// 들쭉날쭉 늦으며 (3) 15Hz 로 밀면 60Hz 화면에서 네 프레임에 한 번만
// 움직여 계단이 진다. 여기서 매 프레임 당겨 오면 셋 다 사라진다.
// 네이티브가 "지금 귀에 닿는 순간"의 값을 골라 주므로 정렬도 네이티브 몫이다.
// iOS 는 이 함수가 아무것도 하지 않는다(브릿지 자체가 없다) — 기존 밀어넣기
// 경로 그대로다.
let nativeLevelPullActive = false;
// 2026-08-11 신설 — 안드로이드가 보내주는 **진짜 스펙트럼**.
//   지금까지는 저·중·고 숫자 세 개만 받아서 막대 서른네 개를 그렸다. 가중치와
//   흔들림으로 서른네 개처럼 보이게 만든 그림이었지, 막대가 각자의 악기를
//   나타내지는 않았다(운영 피드백: "각자 오케스트라 단원인 것처럼").
//   이제 네이티브가 2048점 FFT 로 24개 대역 + 킥 타격을 25글자 문자열에 눌러
//   보낸다. 옛 빌드에서는 이 창구가 없어 빈 문자열이 오고, 그때는 기존 세 값
//   경로로 그대로 폴백한다 — 앱 업데이트 전에도 화면이 죽지 않는다.
const NATIVE_VIZ_BANDS = 24;
let nativeAudioSpectrum = null;   // Float 24개 (0..1)
let nativeAudioKick = 0;          // 킥 타격 0..1
let nativeSpectrumAt = 0;         // 마지막 수신 시각
let nativeSpectrumUnsupported = false;  // 창구 자체가 없는 빌드 — 두 번 묻지 않는다

function pullNativeAudioSpectrum(bridge) {
  if (nativeSpectrumUnsupported) return false;
  if (typeof bridge.audioSpectrumPacked !== "function") {
    nativeSpectrumUnsupported = true;
    return false;
  }
  let packed = "";
  try {
    packed = bridge.audioSpectrumPacked();
  } catch (e) {
    nativeSpectrumUnsupported = true;
    return false;
  }
  if (typeof packed !== "string" || packed.length < NATIVE_VIZ_BANDS + 1) return false;
  if (!nativeAudioSpectrum) nativeAudioSpectrum = new Array(NATIVE_VIZ_BANDS).fill(0);
  for (let i = 0; i < NATIVE_VIZ_BANDS; i++) {
    nativeAudioSpectrum[i] = (packed.charCodeAt(i) - 48) / 63;
  }
  nativeAudioKick = (packed.charCodeAt(NATIVE_VIZ_BANDS) - 48) / 63;
  nativeSpectrumAt = Date.now();
  return true;
}

function pullNativeAudioLevels() {
  const bridge = window.AndroidNativeBridge;
  if (!bridge || typeof bridge.audioLevelsPacked !== "function") return false;
  let packed = -1;
  try {
    packed = bridge.audioLevelsPacked();
  } catch (e) {
    return false;
  }
  if (!(typeof packed === "number") || packed < 0) return false;
  nativeAudioBass = ((packed >> 20) & 1023) / 1023;
  nativeAudioMid = ((packed >> 10) & 1023) / 1023;
  nativeAudioTreble = (packed & 1023) / 1023;
  nativeAudioLevelReceivedAt = Date.now();
  pullNativeAudioSpectrum(bridge);
  if (!nativeLevelPullActive) {
    nativeLevelPullActive = true;
    // 당겨 오는 게 확인된 뒤에야 밀어넣기를 끈다 — 순서가 반대면 브릿지가
    // 없는 빌드에서 레벨이 통째로 끊긴다.
    try {
      if (typeof bridge.setLevelPush === "function") bridge.setLevelPush(false);
    } catch (e) {}
  }
  return true;
}

// 막대마다 고정된(항상 같은) 살짝의 세기 차이를 줘서 평평한 블록처럼
// 보이지 않게 한다 — index 기반 결정적 해시라 프레임마다 흔들리지 않고
// 항상 같은 모양을 유지한다.
function nativeVizBarJitter(i) {
  return 0.82 + 0.36 * Math.abs(Math.sin(i * 12.9898));
}

// 2026-07-15 3차: "빨강/노랑/초록/보라 4덩어리로 뚝뚝 끊겨 보인다"는 재지적 —
// 2차 버전은 0~11/12~23/24~33을 칼같이 3등분해서 그 경계(막대 12번, 24번)에서
// 값이 순간적으로 바뀌었다. 이번엔 막대 위치마다 저음/중음/고음 3개 값을
// 가우시안 형태로 겹쳐서 부드럽게 섞는다(bandWeights) — 그러면 인접한
// 막대끼리 값 차이가 항상 완만해서 "덩어리"가 아니라 하나의 이어진 파형처럼
// 보인다. 또 "반짝임이 너무 촐랑댄다"는 재지적도 반영 — 반짝임의 진폭·속도
// 둘 다 절반 가까이 줄여서 밋밋함과 산만함의 중간 지점을 찾는다.
//
// 2026-07-16: 그런데 이번엔 반대쪽 재지적 — "전체가 너무 골고루/인위적으로
// 평균화돼 보인다"는 것. 원인은 시그마(0.32)가 너무 넓어서 저음/중음/고음
// 3개 값이 화면 거의 전체에서 서로 절반씩 섞였고(예: 막대 30%지점에서도
// 저음:중음이 거의 50:50), 타격(hit)까지 이 넓은 가중치를 그대로 재사용하다
// 보니 킥 하나가 터져도 그 반응이 화면 전반에 얇게 퍼져 "다같이 밋밋하게
// 출렁이는 평균값 파도"처럼 보였다. 두 가지로 나눠 고친다 — ① 대역 색상용
// bandWeights는 시그마를 0.32→0.20으로 좁혀 구역성(왼쪽=저음/가운데=중음/
// 오른쪽=고음 느낌)을 되살리되, 여전히 연속함수라 예전의 "칼같은 3등분"
// 사고는 재발하지 않는다. ② 타격 전용으로 훨씬 좁은 hitWeights(시그마 0.13,
// 정규화 안 함)를 따로 둬서 킥/스네어/하이햇이 각자 구역의 몇 개 막대에만
// 확 튀도록 국지화한다 — 이래야 "쇼"답게 개별적으로 팍팍 튀어 보인다.
function nativeVizBandWeights(i) {
  const t = i / (MUSIC_VIZ_BAR_COUNT - 1);
  const bassW = Math.exp(-Math.pow((t - 0.10) / 0.20, 2));
  const midW = Math.exp(-Math.pow((t - 0.50) / 0.20, 2));
  const trebleW = Math.exp(-Math.pow((t - 0.90) / 0.20, 2));
  const sum = bassW + midW + trebleW;
  return [bassW / sum, midW / sum, trebleW / sum];
}

// 정규화하지 않는다 — 자기 구역 한복판에선 1에 가깝고, 벗어나면 빠르게
// 0으로 떨어져야 "몇 개 막대만 국지적으로 튄다"는 느낌이 산다.
function nativeVizHitWeights(i) {
  const t = i / (MUSIC_VIZ_BAR_COUNT - 1);
  const bassW = Math.exp(-Math.pow((t - 0.10) / 0.13, 2));
  const midW = Math.exp(-Math.pow((t - 0.50) / 0.13, 2));
  const trebleW = Math.exp(-Math.pow((t - 0.90) / 0.13, 2));
  return [bassW, midW, trebleW];
}

let nativeVizShimmerPhase = 0;
let nativeVizBassHit2 = 0;
let nativeVizMidHit2 = 0;
let nativeVizTrebleHit2 = 0;
let nativeVizBassAvg2 = 0;
let nativeVizMidAvg2 = 0;
let nativeVizTrebleAvg2 = 0;

// 2026-08-11 신설 — 대역 24개를 받은 경우의 그리기.
//   설계 원칙은 운영자 말씀 그대로다: 음향학적 정확도가 아니라 "음이 보인다"는
//   느낌. 막대는 각자 자기 대역의 악기이고, 쎈 소리는 실제로 높이 올라가고,
//   박자에는 화면 전체가 한 박 친다.
//   웹/아이폰 경로(ver.1.9.24)와 같은 문법으로 맞춰 두 플랫폼의 체감을 통일한다.
function drawMusicVizNativeSpectrum(h) {
  const sens = getVizSensitivity();
  const contrastAmount = getVizContrastAmount();
  const bassPunchMul = getVizBassPunchMul();
  const pointBarsOn = isVizPointBarsOn();
  const kick = nativeAudioKick * bassPunchMul;
  const n = MUSIC_VIZ_BAR_COUNT;
  for (let i = 0; i < n; i++) {
    // 막대 수(20/34/48)가 대역 수(24)와 달라도 되도록 선형 보간한다.
    const pos = (i / Math.max(1, n - 1)) * (NATIVE_VIZ_BANDS - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(NATIVE_VIZ_BANDS - 1, lo + 1);
    const f = pos - lo;
    let v = nativeAudioSpectrum[lo] * (1 - f) + nativeAudioSpectrum[hi] * f;

    // 대비 설정 — 저음 쪽은 살짝 낮추고 고음 쪽은 살짝 올리는 중앙 대칭 기울기.
    const t = i / Math.max(1, n - 1);
    v *= 1 + contrastAmount * 0.5 * (t - 0.5) * 2;
    // 대비를 키우는 지수 — 이번 순간의 강한 대역만 확실히 솟게.
    let target = Math.pow(Math.max(0, Math.min(1, v)), 1.35) * h;

    // 0번 막대(30~90Hz)는 킥 전용 — 박자를 치는 자리.
    if (i === 0) target = Math.max(target, kick * h * 0.96);
    // 포인트 막대 — 맨 끝 2개는 고음 대역에 유독 예민하게.
    const isPointBar = pointBarsOn && i >= n - 2;
    if (isPointBar) target = Math.max(target, Math.pow(v, 0.55) * h * 0.8);

    // 킥이 박히면 화면 전체가 한 번 숨 쉰다.
    target *= 1 + 0.2 * kick;
    target *= sens.heightMul;
    target = Math.max(4, Math.min(target, h));

    // 비대칭 포락선 — 올라갈 땐 빠르게(때린다), 내려올 땐 천천히(여운).
    const factor = target > musicVizBars[i]
      ? Math.min(0.97, (isPointBar ? 0.88 : 0.72) * sens.attackMul)
      : (isPointBar ? 0.28 : 0.18);
    musicVizBars[i] += (target - musicVizBars[i]) * factor;
    musicVizIntensity[i] = Math.min(1, Math.max(musicVizBars[i] / h, i === 0 ? kick : 0));
  }
  writeVizBarsToDom();
}

function drawMusicVizNative(h) {
  // 2026-08-10 3차 — 안드로이드는 그리기 직전에 직접 집어 온다(위 함수 주석).
  pullNativeAudioLevels();
  // 네이티브 레벨이 한동안(1.2초) 안 들어오면(재생 시작 전, 또는 트랙 전환
  // 찰나) 대기 애니메이션으로 자연스럽게 폴백한다.
  if (Date.now() - nativeAudioLevelReceivedAt > 1200) {
    drawMusicVizIdle(h);
    return;
  }
  // 대역 24개가 신선하게 들어오고 있으면 그쪽으로 — 없으면(옛 앱 빌드)
  // 아래 기존 3값 경로가 그대로 돈다.
  if (nativeAudioSpectrum && Date.now() - nativeSpectrumAt < 600) {
    drawMusicVizNativeSpectrum(h);
    return;
  }
  nativeVizShimmerPhase += 0.12;

  const bassNow = nativeAudioBass;
  const midNow = nativeAudioMid;
  const trebleNow = nativeAudioTreble;

  // 3개 대역 각각에서 독립적으로 "타격"(순간적으로 최근 평균보다 확 튀는
  // 순간 = 킥/스네어/하이햇)을 감지한다 — 저음만 보던 1차 버전과 달리
  // 중음·고음 구역도 각자 펀치를 받아 화면 전체가 신나게 반응한다.
  if (bassNow > nativeVizBassAvg2 * 1.28 + 0.14) { nativeVizBassHit2 = 1; } else { nativeVizBassHit2 *= 0.78; }
  nativeVizBassAvg2 += (bassNow - nativeVizBassAvg2) * 0.12;
  if (midNow > nativeVizMidAvg2 * 1.28 + 0.14) { nativeVizMidHit2 = 1; } else { nativeVizMidHit2 *= 0.78; }
  nativeVizMidAvg2 += (midNow - nativeVizMidAvg2) * 0.12;
  // 2026-07-24 — 고음(하이햇/보컬 고역) 타격을 더 예민하고(문턱 1.22→1.15)
  // 더 날카롭게(감쇠 0.74→0.68 = 더 짧게 번쩍) — "높은 보이스에 엣지" 요청.
  if (trebleNow > nativeVizTrebleAvg2 * 1.15 + 0.10) { nativeVizTrebleHit2 = 1; } else { nativeVizTrebleHit2 *= 0.68; }
  nativeVizTrebleAvg2 += (trebleNow - nativeVizTrebleAvg2) * 0.12;

  // 2026-07-24 유저 요청 "고저가 드라마틱하게" — 대역별 편차 증폭.
  // 각 대역 값이 자기 "최근 평균"에서 벗어난 정도를 위로는 2.1배, 아래로는
  // 1.6배로 부풀린다: 평균 근처(잔잔한 구간)는 거의 그대로, 평균보다 큰
  // 순간(드럼·강세)은 확 치솟고, 평균보다 작은 순간(비트 사이 골짜기)은
  // 더 깊게 파인다. AGC가 이미 "곡 나름의 0..1"로 정규화해준 값 위에서
  // 편차만 키우는 것이라, 조용한 곡이든 시끄러운 곡이든 똑같이 동작한다.
  function nativeVizExpand(now, avg) {
    const dev = now - avg;
    return Math.min(1, Math.max(0, avg + dev * (dev > 0 ? 2.1 : 1.6)));
  }
  const bassDyn = nativeVizExpand(bassNow, nativeVizBassAvg2);
  const midDyn = nativeVizExpand(midNow, nativeVizMidAvg2);
  const trebleDyn = nativeVizExpand(trebleNow, nativeVizTrebleAvg2);

  // 2026-07-22 유저 요청 — 감도(sensitivity)/베이스펀치(bassPunch) 설정을
  // 기존 공식은 그대로 두고 배율로만 곱해서 반영한다(회귀 위험 최소화).
  const sens = getVizSensitivity();
  const bassPunchMul = getVizBassPunchMul();
  // 2026-07-22 2차 유저 요청 — 대비(고음/저음 차이 강조)와 포인트 막대(맨 끝
  // 2개만 고음 트랜지언트에 유독 예민)도 같은 방식(기존 공식 유지 + 배율만
  // 추가)으로 반영한다.
  const contrastAmount = getVizContrastAmount();
  const pointBarsOn = isVizPointBarsOn();
  for (let i = 0; i < MUSIC_VIZ_BAR_COUNT; i++) {
    const t = i / (MUSIC_VIZ_BAR_COUNT - 1);
    const shapeEnvelope = 0.75 + 0.25 * Math.sin(Math.PI * t);
    // 3개 값을 딱 자르지 않고 위치별 가중치로 부드럽게 섞는다 — 경계에서
    // 값이 뚝 끊기지 않아 3~4덩어리로 나뉘어 보이던 문제가 사라진다.
    const [bassW, midW, trebleW] = nativeVizBandWeights(i);
    // 2026-07-24 — 막대 높이는 편차 증폭된 값(bassDyn 등)으로 그린다. 타격
    // 감지는 위에서 원본 값으로 이미 끝났으므로 이중 증폭은 없다.
    const band = bassW * bassDyn + midW * midDyn + trebleW * trebleDyn;
    // 2026-07-16: 타격은 대역 색상용 넓은 가중치가 아니라 훨씬 좁은
    // hitWeights로 국지화한다 — 그래야 킥/스네어가 화면 전체를 얇게
    // 출렁이지 않고 자기 구역의 몇 개 막대만 확 튄다.
    const [bassHW, midHW, trebleHW] = nativeVizHitWeights(i);
    const jitter = nativeVizBarJitter(i);
    // 타격에도 막대별 고정 지터를 곱한다(제곱으로 대비를 키움) — 같은 구역
    // 안에서도 막대마다 튀는 크기가 달라져야 "계산된 곡선"이 아니라
    // "제각각 튀는 쇼"처럼 보인다.
    const hitPunch = Math.pow(jitter, 2.2);
    let hit = (bassHW * nativeVizBassHit2 + midHW * nativeVizMidHit2 + trebleHW * nativeVizTrebleHit2) * hitPunch;
    hit *= bassPunchMul;
    // 막대마다 다른 위상으로 아주 옅은 반짝임 — "너무 촐랑댄다"는 재지적으로
    // 진폭(0.6→0.18)과 속도(band*2.2→band*0.9) 둘 다 크게 낮춰 은은한
    // 정도로만 남긴다(밋밋함과 산만함의 중간).
    const shimmer = 0.5 + 0.5 * Math.sin(nativeVizShimmerPhase * (0.5 + band * 0.9) + i * 1.7);
    const liveliness = 0.82 + 0.18 * shimmer;
    // 2026-07-16: "곡 끝 여음(리버브 꼬리)이 아직 들리는데 비주얼라이저는
    // 벌써 다 가라앉아 보인다"는 재지적 — AGC(피크 대비 정규화)가 최근
    // 시끄러웠던 구간의 피크를 한동안 기억하고 있어서, 꼬리의 조용한 소리는
    // 정규화된 band 값 자체가 매우 작다(예: 0.1 근처). 그런데 지수 1.25(>1)는
    // 작은 값을 더욱더 작게 짓눌러서(0.1^1.25≈0.056) 거의 안 보이게
    // 만들었다 — 지수를 0.7(<1)로 낮춰 작은 값을 오히려 부풀려서(0.1^0.7≈0.2)
    // 조용한 여음도 막대가 눈에 띄게 살아있도록 한다. 큰 값(1 근처)은 거의
    // 그대로라 시끄러운 구간의 다이나믹함은 그대로 유지된다.
    const ratio = Math.pow(Math.max(0, band), 0.7) * jitter;
    let target = Math.max(4, ratio * shapeEnvelope * h * liveliness);
    // 대역별 타격 펀치 — 이제 hitWeights로 국지화된 데다 막대별 지터까지
    // 곱해져서, 같은 킥 한 방에도 막대마다 확연히 다르게 튄다.
    target = Math.max(target, hit * h * 1.18 * shapeEnvelope);
    // 2026-07-22 2차 — 대비: t=0(저음)에서 살짝 줄고 t=1(고음)에서 살짝 커지는
    // 중앙 대칭 기울기. normal(contrastAmount=0)은 배율이 항상 1이라 기존
    // 동작과 완전히 동일(회귀 없음).
    target *= 1 + contrastAmount * 0.5 * (t - 0.5) * 2;
    const isPointBar = pointBarsOn && i >= MUSIC_VIZ_BAR_COUNT - 2;
    if (isPointBar) {
      // 포인트 막대 — 맨 끝 2개만 고음 트랜지언트(하이햇/보컬 고음 등)에
      // 유독 예민하게. 기존 트레블 히트 신호를 더 큰 배율로 다시 밀어넣어
      // "이 두 막대만 유독 반짝인다"는 느낌을 낸다(다른 막대 계산엔 영향 없음).
      target = Math.max(target, nativeVizTrebleHit2 * h * 1.35);
      target = Math.max(target, Math.pow(Math.max(0, trebleNow), 0.55) * h * 0.7);
    }
    target *= sens.heightMul;
    // 2026-07-22 운영 피드백 — "격렬" 감도(heightMul 1.32)가 박스 높이(h)를
    // 넘어서 막대가 비주얼라이저 박스 테두리를 뚫고 나가버렸다. 예전에
    // 그만두기로 한 "정각 세리모니" 돌출 연출과 똑같은 문제라 반드시
    // 박스 안에서만 움직여야 한다 — 배율을 곱한 뒤 박스 높이로 다시
    // 잘라낸다. "격렬"의 반응감은 이 상한에 더 자주/빨리 닿는 것과 아래
    // attackMul(더 빠른 어택)로 표현되고, 절대 높이 자체는 넘지 않는다.
    target = Math.min(target, h);
    // 어택은 빠르게(비트에 팍 반응), 릴리즈는 그보다 느리게 — "쇼"답게 대비를 키운다.
    // 감도 설정의 attackMul은 어택 쪽에만 곱해 "격렬"일수록 더 스냅 있게,
    // "차분"일수록 더 느긋하게 반응하도록 한다(0.95 상한으로 발산 방지).
    // 2026-07-22 2차 — 포인트 막대는 어택/릴리즈 둘 다 더 빠르게 줘서 부드럽게
    // 따라가지 않고 "팟" 하고 튀었다 가라앉는 트위치한 느낌을 낸다.
    const attackBase = isPointBar ? 0.92 : 0.8;
    const factor = target > musicVizBars[i]
      ? Math.min(0.97, attackBase * sens.attackMul)
      : (isPointBar ? 0.3 : 0.2);
    musicVizBars[i] += (target - musicVizBars[i]) * factor;
    musicVizIntensity[i] = Math.min(1, Math.max(musicVizBars[i] / h, hit));
  }
  writeVizBarsToDom();
}

function drawMusicViz() {
  // 2026-07-22 유저 요청 — 설정 페이지의 실시간 미리보기도 같은 루프로
  // 그린다. 본화면 패널이 닫혀 있어도 설정 시트가 열려있으면(비주얼라이저
  // 카드의 미리보기가 보이는 동안) 계속 돈다 — isMusicVizActiveContext 참조.
  if (!isMusicVizActiveContext() || (!musicVizBarEls && !musicVizPreviewBarEls)) {
    musicVizAnimId = null; // 둘 다 닫히면 다음 프레임을 예약하지 않고 루프 종료
    return;
  }
  musicVizAnimId = requestAnimationFrame(drawMusicViz);

  const h = (musicVizWrap && musicVizWrap.clientHeight) || (musicVizPreviewWrap && musicVizPreviewWrap.clientHeight) || 52;

  // 2026-08-05 — 음악이 멈춰 있으면 바닥에 깔린다(운영 지침).
  // 설정 화면의 미리보기는 예외 — 거기서는 색·감도를 고르는 중이라
  // 움직임이 보여야 고를 수 있다.
  const vizSettingsOpen = Boolean(settingsPanel && settingsPanel.classList.contains("is-open"));
  if (!vizSettingsOpen && typeof musicPlaying !== "undefined" && !musicPlaying) {
    if (drawMusicVizFlat(h)) {
      // 다 내려앉았다 — 여기서 루프를 끝낸다.
      if (musicVizAnimId) cancelAnimationFrame(musicVizAnimId);
      musicVizAnimId = null;
    }
    return;
  }

  if (isNativeWrapper) {
    drawMusicVizNative(h);
    return;
  }

  const analyser = activeMusicAnalyser();
  if (!analyser) {
    drawMusicVizIdle(h);
    return;
  }

  if (!musicVizBandRanges) {
    musicVizBandRanges = buildMusicVizBands(analyser, MUSIC_VIZ_BAR_COUNT);
  }
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);

  // 2026-07-13 7차: "막대쇼처럼 다 같이 움직여야 한다"는 피드백 — 5차는
  // 절대 에너지(avg/255)에 압축을 걸었더니 베이스/미드 대역이 거의 항상
  // 천장 근처에 붙어버려서(실사용 음악은 저음이 절대값 자체가 크다) 왼쪽
  // 대부분이 "가만히 서 있는" 것처럼 보이고, 원래도 에너지가 작은 오른쪽
  // 1~2개 고음역 막대만 눈에 띄게 움직였다. 절대값 기준을 버리고 이번
  // 프레임에서 가장 센 대역을 100%로 놓고 나머지를 그에 비례해 정규화한다
  // — 그 순간 제일 큰 소리가 꼭대기까지 닿고, 어느 막대가 그 "1등"이 될지는
  // 매 프레임 계속 바뀌므로 전체가 다 같이 들썩이는 막대쇼 느낌이 난다.
  // 2026-07-22 2차 — 대비(contrast) 설정만큼 기존 trebleBoost 기울기(0.7)에
  // 더 얹는다. normal(0)은 0.7 그대로라 기존 동작과 완전히 동일.
  const contrastAmount = getVizContrastAmount();
  const avgs = new Array(MUSIC_VIZ_BAR_COUNT);
  let kickRaw = 0;   // 0번 막대(30~90Hz)의 **보정 전** 에너지 — 온셋 검출용
  let maxAvg = 24; // 무음에 가까운 순간에 0으로 나누는 걸 막는 바닥값
  for (let i = 0; i < MUSIC_VIZ_BAR_COUNT; i++) {
    const start = musicVizBandRanges[i];
    const end = Math.max(musicVizBandRanges[i + 1], start + 1);
    let sum = 0;
    for (let j = start; j < end; j++) sum += data[j];
    let avg = sum / (end - start);
    // 2026-07-14 18차: "고음이나 저음이나 큰 차이가 없다, 고음이 더 솟구쳐야
    // 한다"는 피드백 — 실제 음악은 raw FFT 에너지가 저음에 훨씬 쏠려있어서,
    // 프레임별 최댓값 정규화를 해도 고음역 막대가 "이번 프레임 1등"이 될
    // 기회 자체가 드물었다. 위치(고음역)가 높을수록 미리 이득(gain)을 줘서
    // 하이햇/심벌 같은 고음 타격이 실제로 화면에서 튀어 보이게 보정한다.
    // 2026-08-11 — 대역을 이제 실주파수 로그로 나누므로 고음 이득을 줄인다.
    //   예전엔 bin 균등분할이라 고음 막대가 구조적으로 불리해 0.7~2.7배를 부었다.
    const trebleBoost = 1 + (i / (MUSIC_VIZ_BAR_COUNT - 1)) * (0.45 + contrastAmount);
    if (i === 0) kickRaw = avg;   // 보정 전 원재료를 기억
    avg *= trebleBoost;
    avgs[i] = avg;
    if (avg > maxAvg) maxAvg = avg;
  }

  // 2026-08-11 신설 — **킥 온셋(타격 순간) 검출**.
  //   운영자: "제일 중요한 것은 비트감/박자이고, 쎈 소리가 세게 표현되는 것."
  //   방식은 사람이 듣는 방식과 같다 — 저음이 **직전보다 갑자기 올라간
  //   순간**을 잡는다(스펙트럴 플럭스). 크기가 아니라 "오름"을 보므로
  //   베이스가 기다란 구간에서도 킥만 골라낸다.
  //   문턱값·불응기(120ms)는 'Green window notes' 실측(316회/121.8초,
  //   타격 간격 중앙값 354ms)을 잡아내는 값으로 맞췄다.
  const kickFlux = Math.max(0, kickRaw - musicVizKickPrev);
  musicVizKickPrev = kickRaw;
  const nowMs = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  if (kickFlux > musicVizKickFluxAvg * 1.8 + 3 && nowMs - musicVizKickLastAt > 120) {
    musicVizKickLastAt = nowMs;
    musicVizBassHit = 1;
  } else {
    musicVizBassHit *= 0.80;   // 5~6프레임 안에 빠지는 "팍" 펀치감
  }
  musicVizKickFluxAvg += (kickFlux - musicVizKickFluxAvg) * 0.08;

  // 2026-08-11 — **프레임별 최댓값 정규화를 버린다.**
  //   이전에는 매 프레임 그 순간 제일 센 대역을 100% 로 놓았다. 그러면
  //   조용한 구간이든 터지는 구간이든 제일 큰 막대는 항상 천장에 닿는다 —
  //   "쎈 소리를 세게"가 원리적으로 불가능한 구조였다.
  //   대신 **느린 자동이득** — 최근 몇 초의 최댓값을 기준으로 삼아
  //   곡마다의 절대 음량은 맞춰주되, 곡 안의 셈여림은 그대로 남긴다.
  //   0.997^60 ≈ 초당 0.84 — 반감기 약 4초.
  musicVizAgcPeak = Math.max(maxAvg, musicVizAgcPeak * 0.997);
  if (musicVizAgcPeak < 30) musicVizAgcPeak = 30;
  const normPeak = musicVizAgcPeak;

  // (구 버전의 저음 타격 감지는 위 킥 온셋 검출로 대체됐다 — 2026-08-11.
  //  이전 방식은 고음 이득이 곱해진 avgs 를 봤고, 게다가 0번 bin 이 빠져
  //  있어 실제 킥이 아닌 것을 타격으로 세고 있었다.)

  // 2026-07-22 2차 — "포인트 막대"용 트레블 타격 감지. 위 베이스 타격 감지와
  // 완전히 같은 패턴을 맨 오른쪽 2개 대역(가장 높은 고음)에 적용한다.
  const pointBarsOn = isVizPointBarsOn();
  const trebleAvgNow = (avgs[MUSIC_VIZ_BAR_COUNT - 1] + avgs[MUSIC_VIZ_BAR_COUNT - 2]) / 2;
  if (trebleAvgNow > musicVizTrebleEnergyAvg * 1.3 + 5) {
    musicVizTrebleHit = 1;
  } else {
    musicVizTrebleHit *= 0.76;
  }
  musicVizTrebleEnergyAvg += (trebleAvgNow - musicVizTrebleEnergyAvg) * 0.1;

  // 2026-07-22 유저 요청 — 네이티브 경로와 동일하게 감도/베이스펀치 배율만
  // 곱해서 반영(기존 공식은 그대로 유지).
  const sens = getVizSensitivity();
  const bassPunchMul = getVizBassPunchMul();
  const bassHitForViz = musicVizBassHit * bassPunchMul;

  for (let i = 0; i < MUSIC_VIZ_BAR_COUNT; i++) {
    // 2026-07-14 13차: "그래프 모양이 좌측만 높고 우측은 낮다 — 실제 신호
    // 세기가 아니라 보기 좋은 과장된 연출이 중요하다"는 피드백. 저음역이
    // 실제로 거의 항상 raw 에너지가 제일 커서, 프레임별 정규화(7차)를
    // 해도 결국 왼쪽이 도드라져 보였다 — 위치 기준 고정 "산" 모양 곡선을
    // 실시간 에너지 비율에 곱해서 실루엣 자체를 항상 예쁜 언덕 모양으로
    // 유도한다.
    // 2026-07-14 18차: 다만 이 고정 곡선이 너무 세게(0.5~1.0 범위) 실제
    // 신호를 눌러버려서 "고음/저음 차이가 안 느껴진다"는 재지적 — 억제
    // 폭을 절반으로 줄여(0.75~1.0) 실제 대역별 에너지 차이가 더 살아나게
    // 하고, 비율 자체도 지수(1.5)를 줘서 이번 프레임 1등만 확실히 솟고
    // 나머지는 더 가라앉는 대비를 키운다.
    const t = i / (MUSIC_VIZ_BAR_COUNT - 1);
    const shapeEnvelope = 0.75 + 0.25 * Math.sin(Math.PI * t);
    const ratio = Math.pow(Math.max(0, avgs[i] / normPeak), 1.5);
    let target = Math.max(4, ratio * shapeEnvelope * h);
    if (i <= 1) {
      // 드럼 타격 시 맨 왼쪽 1~2개 막대만 별도로 순간 펀치 — 다른 막대의
      // 정규화 로직과 무관하게 항상 눈에 띄게 솟구친다.
      target = Math.max(target, bassHitForViz * h * 0.96);
    }
    // 2026-07-22 2차 — 포인트 막대: 맨 오른쪽 2개만 트레블 타격에 별도로
    // 순간 펀치(위 베이스 펀치와 대칭 구조).
    const isPointBar = pointBarsOn && i >= MUSIC_VIZ_BAR_COUNT - 2;
    if (isPointBar) {
      target = Math.max(target, musicVizTrebleHit * h * 0.96);
    }
    // 2026-08-11 — 킥이 박히는 순간 **화면 전체**가 한 번 숨 쉰다.
    //   한 막대만 튀는 것보다 오케스트라가 다 같이 한 박 치는 편이
    //   "박자가 보인다"는 느낌에 훨씬 가깝다(운영자 표현: 각자 단원처럼).
    target *= 1 + 0.20 * bassHitForViz;
    target *= sens.heightMul;
    // 2026-07-22 운영 피드백 — 네이티브 경로와 동일하게 "격렬"이 박스 높이(h)를
    // 뚫고 나가지 않도록 상한을 건다.
    target = Math.min(target, h);
    // 어택은 더 빠르게(비트에 팍! 반응), 릴리즈도 조금 더 빠르게 — "더
    // 다이나믹하게, 변동성이 크면 좋겠다"는 피드백으로 어택 0.62→0.72,
    // 릴리즈 0.12→0.18로 올려 오르내림 자체를 더 선명하게 만들었다.
    // 감도 설정의 attackMul은 어택 쪽에만 곱한다(0.95 상한으로 발산 방지).
    // 2026-07-22 2차 — 포인트 막대는 어택/릴리즈 둘 다 더 빠르게(트위치한 느낌).
    const attackBase = isPointBar ? 0.88 : 0.72;
    const factor = target > musicVizBars[i]
      ? Math.min(0.97, attackBase * sens.attackMul)
      : (isPointBar ? 0.28 : 0.18);
    musicVizBars[i] += (target - musicVizBars[i]) * factor;
    musicVizIntensity[i] = (i <= 1 || isPointBar)
      ? Math.min(1, Math.max(musicVizBars[i] / h, bassHitForViz, isPointBar ? musicVizTrebleHit : 0))
      : Math.min(1, musicVizBars[i] / h);
  }
  writeVizBarsToDom();
}

// 2026-07-07: "크로스페이드가 볼륨이 줄어드는 느낌이 전혀 없이 뚝 끊긴다"는
// 반복된 재지적의 진짜 원인 — iOS Safari/WKWebView는 HTMLMediaElement의
// .volume 프로퍼티를 조용히 무시한다(하드웨어 볼륨 버튼만 존중하도록 iOS 5
// 시절부터 의도된 플랫폼 제약. 에러도 안 뜨고 그냥 아무 효과가 없다).
// 그래서 지금까지 player.volume = t로 아무리 값을 바꿔도 두 트랙이 항상
// 풀볼륨으로 겹쳐 재생되다가 첫 트랙이 ended되며 뚝 끊기는 것처럼 들렸던
// 것이다. Web Audio API의 GainNode는 iOS에서도 정상적으로 볼륨을 조절하는
// 표준 우회법이라, 볼륨 제어를 전부 여기로 옮긴다.
let audioContext = null;
let playerGainNodes = null; // musicPlayers와 같은 순서의 GainNode 배열
// 2026-07-15: 네이티브 앱(iOS)에서는 실제 스피커 출력을 AVPlayer(네이티브)가
// 전담하고, 여기(WKWebView 내부 Web Audio 그래프)는 크로스페이드 타이밍/
// 비주얼라이저/진행률 계산만 계속 담당한다 — 두 군데서 동시에 소리가 나면
// 안 되므로, 개별 트랙 GainNode 뒤에 이 마스터 GainNode를 하나 더 두고
// isNativeWrapper일 때만 0으로 죽인다. 일반 웹/PWA에서는 항상 1이라 지금까지의
// 크로스페이드 볼륨 동작과 완전히 동일하다.
let masterGainNode = null;
// 2026-07-13: 음악 정보 패널의 오디오 비주얼라이저용 AnalyserNode.
// musicPlayers/playerGainNodes와 같은 순서로 둔다. 기존 gain → destination
// 출력 경로는 그대로 두고, gain에서 분석용으로만 하나 더 분기(fan-out)한다 —
// 소리 출력 경로 자체에는 영향이 없다.
let playerAnalysers = null;

function ensureAudioGraph() {
  if (audioContext) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return; // 극히 예외적으로 없는 환경 — setPlayerVolume이 .volume으로 폴백
  try {
    audioContext = new AudioContextClass();
    playerAnalysers = [];
    masterGainNode = audioContext.createGain();
    masterGainNode.gain.value = isNativeWrapper ? 0 : 1;
    masterGainNode.connect(audioContext.destination);
    playerGainNodes = musicPlayers.map((player) => {
      const source = audioContext.createMediaElementSource(player);
      const gain = audioContext.createGain();
      const analyser = audioContext.createAnalyser();
      // 2026-08-11 운영 피드백 — "비트감이 보이지 않는다."
      //   fftSize 128 은 44.1kHz 기준 한 칸이 **345Hz** 다. 킥(30~90Hz)이
      //   0번 칸 하나에 통째로 들어가 베이스·저음 피아노와 구분이 안 됐다.
      //   2048 이면 한 칸이 21.5Hz — 킥이 세 칸에 걸쳐 뚜렷하게 보인다.
      //   실측 근거: 'Green window notes' 저음 타격 316회/121.8초(169BPM).
      //   평활 0.85 는 타격의 순간(20~50ms)을 뭉개는 값이다. 0.6 으로 내리고
      //   대신 막대별 비대칭 포락선(빠른 어택/느린 릴리즈)으로 때리는 느낌을 만든다.
      //   CPU: 2048점 FFT 는 프레임당 수십µs 수준 — 체감 비용 없다.
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(gain);
      gain.connect(masterGainNode);
      gain.connect(analyser);
      playerAnalysers.push(analyser);
      return gain;
    });
  } catch (error) {
    audioContext = null;
    playerGainNodes = null;
    playerAnalysers = null;
    masterGainNode = null;
  }
}

// 지금 소리가 나오고 있는 쪽(activePlayer)의 AnalyserNode를 돌려준다.
// 크로스페이드 중 잠깐은 standby 쪽도 같이 들리지만, 비주얼라이저는
// "화려할 필요 없이 가벼운" 용도라 근사치로 충분하다.
function activeMusicAnalyser() {
  // 2026-07-15: 네이티브 앱에서는 이 <audio>를 실제로 play()하지 않으므로
  // (위 nativeClockTimerId 관련 주석 참조) AnalyserNode에 흐를 실제 신호
  // 자체가 없다 — 항상 null을 돌려줘서 drawMusicViz()가 매번 drawMusicVizIdle
  // (대기 애니메이션)로 폴백하게 한다. 어설프게 무신호 막대를 보여주는 것보다
  // 의도된 잔잔한 애니메이션이 더 낫다는 판단.
  if (isNativeWrapper) return null;
  if (!playerAnalysers) return null;
  const index = musicPlayers.indexOf(activePlayer());
  return playerAnalysers[index] || null;
}

function setPlayerVolume(player, value) {
  const index = musicPlayers.indexOf(player);
  if (playerGainNodes && playerGainNodes[index]) {
    playerGainNodes[index].gain.value = value;
    return;
  }
  player.volume = value; // Web Audio API를 못 쓰는 환경(구형 브라우저 등)의 폴백
}

function resetActiveWatchState() {
  musicErrorRetryCount = 0;
  stallRetryCount = 0;
  stallWatchCurrentTime = -1;
  stallWatchSince = Date.now();
}

// 2026-07-07 재작성: 진행형 스트리밍(player.src = url)은 네트워크 상황에 따라
// (1) 재생 20초 지점에서 몇 초씩 멈추는 버퍼링 정지, (2) duration/loadedmetadata가
// 안정적으로 안 잡혀 크로스페이드 트리거 자체가 못 걸리는 문제, 두 가지의
// 공통 원인으로 보인다. 파일 전체를 fetch로 통째로 받아 Blob URL로 재생하면
// 재생 시작 이후로는 완전히 로컬 데이터라 두 문제 모두 원천적으로 사라진다.
// prebuffer:false는 옛 방식(즉시 스트리밍) 폴백 — 지금은 모든 호출부가
// prebuffer:true를 쓴다.
// 트랙 하나의 실제 재생 URL을 계산한다(상대경로 또는 musicSourceBaseUrl
// 기준 CDN 경로). 네이티브 브릿지(백그라운드 그림자 재생기)에도 그대로
// 재사용한다 — 두 군데서 URL 계산 방식이 어긋나지 않게 여기 한 곳에만 둔다.
function resolveTrackUrl(track) {
  const base = typeof musicSourceBaseUrl === "string" ? musicSourceBaseUrl.trim() : "";
  const fileName = track.file.replace(/^assets\/music\//, "");
  if (!base) return track.file;
  // 2026-07-11: R2로 옮긴 새 트랙들은 폴더/파일명에 공백·괄호가 그대로 들어있다
  // (예: "My Workspace/A Pocketful of Noon.m4a"). 세그먼트별로 encodeURIComponent를
  // 적용해 "/" 구분자는 유지하면서 나머지는 안전하게 퍼센트 인코딩한다 — 브라우저의
  // 자동 인코딩에 기대지 않고 명시적으로 처리해 WKWebView에서도 안정적으로 동작하게 함.
  const encodedFileName = fileName.split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/$/, "")}/${encodedFileName}`;
}

// 네이티브 쪽(별도 프로세스)은 페이지의 상대경로 개념이 없으므로, 반드시
// 완전한 절대 URL(https://...)로 변환해서 넘겨줘야 한다.
function resolveTrackAbsoluteUrl(track) {
  try {
    return new URL(resolveTrackUrl(track), window.location.href).href;
  } catch (error) {
    return resolveTrackUrl(track);
  }
}

async function loadMusicTrack(player, index, { prebuffer = true } = {}) {
  if (!player || !Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return;
  setPlayerVolume(player, 1);
  const track = musicPlaylist[index % musicPlaylist.length];
  const url = resolveTrackUrl(track);

  delete player.dataset.cachedDuration;
  player.addEventListener("loadedmetadata", function onCacheDuration() {
    if (Number.isFinite(player.duration) && player.duration > 0) {
      player.dataset.cachedDuration = String(player.duration);
    }
  }, { once: true });

  if (!prebuffer) {
    player.src = url;
    return;
  }

  player.dataset.pendingUrl = url;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`music fetch failed: ${response.status}`);
    const blob = await response.blob();
    // fetch가 진행되는 동안 같은 player에 더 최신 로드 요청이 들어왔다면
    // (예: 스킵을 연타) 이 결과는 버리고 최신 요청 결과만 반영되게 한다.
    if (player.dataset.pendingUrl !== url) return;
    const objectUrl = URL.createObjectURL(blob);
    if (player.dataset.blobUrl) URL.revokeObjectURL(player.dataset.blobUrl);
    player.dataset.blobUrl = objectUrl;
    player.src = objectUrl;
  } catch (error) {
    // fetch 실패(오프라인 등) 시 예전처럼 직접 스트리밍 URL로 폴백 —
    // 최소한 재생 자체는 되게 한다.
    if (player.dataset.pendingUrl === url) player.src = url;
  }
}

async function updateMusicProgress(event) {
  const player = event ? event.target : activePlayer();
  if (player !== activePlayer()) return; // standby(미리 준비 중인 다음곡)의 timeupdate는 무시
  if (!musicToggle || !player) return;
  maybeSaveMusicResume(); // 5초에 한 번, 재생 위치를 로그인 없이 기억해둔다.
  // player.duration이 일시적으로 NaN/Infinity가 되는 환경 대비 — loadMusicTrack의
  // loadedmetadata 시점에 캐싱해둔 값을 폴백으로 쓴다(위 loadMusicTrack 주석 참조).
  const liveDuration = player.duration;
  const duration = Number.isFinite(liveDuration) && liveDuration > 0
    ? liveDuration
    : parseFloat(player.dataset.cachedDuration || "NaN");
  const hasDuration = Number.isFinite(duration) && duration > 0;
  const progress = hasDuration
    ? Math.min(1, Math.max(0, player.currentTime / duration))
    : 0;
  // 5차 수정(2026-07-07): border-width 두께 변화(2~4차 시도)가 실기기에서
  // 여전히 안 보인다는 재지적 — border 두께 조절 자체를 버리고, 프로그레스
  // 링에 흔히 쓰는 conic-gradient 채움 방식으로 교체(styles.css 참조).
  // 여긴 0~1 진행률 숫자만 넘기면 된다.
  musicToggle.style.setProperty("--progress", String(progress));
  // 2026-07-14 15차: 음악 패널 진행률 가로 바 — 위 링 진행률과 같은 값을
  // 그대로 재사용해 폭(%)만 매 프레임 갱신한다(새 계산 없음, 8항 원칙과 동일).
  if (musicProgressFill) musicProgressFill.style.width = (progress * 100).toFixed(2) + "%";

  // 2026-08-04 이슈 제보 — 음악은 잘 나오는데 곡명이 "재생 대기 중"으로
  // 남는 경우가 종종 있다. 곡명은 트랙 전환 시점에만 다시 그려지므로,
  // 웹뷰 재로드·플레이리스트 늦은 로드처럼 라벨을 그린 "후에" 트랙
  // 정보가 채워지는 경로에서는 대기 문구가 다음 곡까지 남았다. 재생이
  // 실제 진행 중인 이 timeupdate에서 라벨이 아직 대기 문구면 스스로
  // 고쳐 그린다(자기 치유). skipNativeSync — 화면 텍스트만 갱신하고
  // 네이티브에 trackChanged를 다시 보내지 않는다(크로스페이드 경쟁 방지,
  // renderMusicPlaylistInfo 안 주석 참조).
  if (musicTrackTitle && Array.isArray(musicPlaylist) && musicPlaylist.length > 0
      && musicTrackTitle.textContent === t("music.waiting", null, "재생 대기 중")) {
    renderMusicPlaylistInfo({ skipNativeSync: true });
  }

  if (!hasDuration) return;
  const remaining = duration - player.currentTime;
  const standby = standbyPlayer();

  // 1단계 — 여유 있게(끝나기 18초 전) 다음 곡 전체를 미리 통째로 받아둔다.
  // 이렇게 받은 blob은 그 자체가 완전한 로컬 파일이라 duration/loadedmetadata가
  // 네트워크 상태와 무관하게 즉시, 확실하게 잡힌다 — 아래 2단계 크로스페이드
  // 트리거가 "duration을 못 믿어서 아예 안 걸리는" 문제 자체를 없앤다.
  if (pendingNextIndex < 0 && standby && remaining <= musicPrebufferLeadSeconds) {
    pendingNextIndex = pickNextTrackIndex();
    recordTrackHeard(pendingNextIndex);
    standby._pendingLoad = loadMusicTrack(standby, pendingNextIndex, { prebuffer: true });
    // 2026-07-16: 네이티브 모드에서는 이 시점(끝나기 18초 전)에 다음 곡
    // URL을 네이티브에도 미리 알려줘서 TrackFileCache가 여유있게 로컬로
    // 받아두게 한다 — 예전엔 crossfadeStart(끝나기 4초 전) 시점에야 같은
    // URL을 다시 prefetch()했는데, 그건 이미 그 순간 막 재생을 시작한
    // 파일과 똑같은 파일을 또 받으러 가는 셈이라 대역폭이 두 배로 들어
    // 곡 초반이 끊기는 원인이었다(NativeRadioPlayer.swift 주석 참조). 이제
    // 진짜로 미리(18초 여유) 받아두므로 크로스페이드 시점엔 이미 로컬 파일이다.
    if (isNativeWrapper && Array.isArray(musicPlaylist) && musicPlaylist.length > 0) {
      const upcoming = musicPlaylist[pendingNextIndex % musicPlaylist.length];
      if (upcoming) {
        postToNativeRadio({ action: "prefetchNext", url: resolveTrackAbsoluteUrl(upcoming) });
      }
    }
  }

  // 1.5단계(2026-07-30, 안드로이드 전용) — 슬롯1 예약이 끝났으면 다음다음
  // 곡(슬롯2)도 미리 보내 네이티브 큐를 채운다. 웹이 이 직후 잠들어도
  // 네이티브가 두 번의 곡 전환을 자력으로 이어가게 하는 보험이다
  // (CLAUDE.md 35-B (a)안, pendingSecondIndex 선언부 주석 참조).
  if (standby && remaining <= musicPrebufferLeadSeconds) {
    fillSecondPrefetchSlot();
  }

  // 2단계 — 실제 크로스페이드 시작(끝나기 4초 전). 1단계에서 이미 준비
  // 중이던(또는 이미 완료된) standby를 그대로 쓴다.
  if (!crossfadeTriggered && standby && pendingNextIndex >= 0 && remaining <= musicFadeOutSeconds && remaining > 0.05) {
    crossfadeTriggered = true;
    if (standby._pendingLoad) {
      try { await standby._pendingLoad; } catch (error) { /* 폴백은 loadMusicTrack 내부에서 처리됨 */ }
    }
    setPlayerVolume(standby, 0);
    // 네이티브 앱에서는 이 <audio>를 절대 실제로 play()하지 않는다(파일 상단
    // nativeClockTimerId 관련 주석 참조) — 어차피 masterGainNode=0이라 유저
    // 귀에는 안 들리던 크로스페이드였다. standby는 활성으로 바뀔 때(swap)
    // currentTime 0에서 시작하는 상태 그대로 대기한다.
    if (!isNativeWrapper) {
      standby.play().catch(() => {});
    } else if (Array.isArray(musicPlaylist) && musicPlaylist.length > 0) {
      // 2026-07-15: "웹앱 버전처럼 곡 끝과 다음 곡이 자연스럽게 볼륨
      // 믹싱되면서 넘어가야 한다"는 요청 — 네이티브(NativeRadioPlayer)는
      // v1에서 트랙 전환을 크로스페이드 없이 즉시 바꿨는데, 진짜 소리는
      // 항상 네이티브가 내므로 그쪽에서도 실제로 볼륨을 서서히 섞어야만
      // 유저 귀에 자연스러운 전환으로 들린다. 여기서 다음 곡 URL과 함께
      // "이 시간 동안 서서히 믹싱해라"는 신호를 보낸다 — 실제 페이드는
      // NativeRadioPlayer.crossfadeStart()가 두 번째 AVPlayer로 수행한다.
      const nextTrack = musicPlaylist[pendingNextIndex % musicPlaylist.length];
      if (nextTrack) {
        postToNativeRadio({
          action: "crossfadeStart",
          url: resolveTrackAbsoluteUrl(nextTrack),
          title: nextTrack.title || "FlipZen Radio",
          duration: musicFadeOutSeconds,
        });
      }
    }
  }

  if (crossfadeTriggered && standby) {
    const t = Math.max(0, Math.min(1, remaining / musicFadeOutSeconds)); // 1 → 0으로 줄어듦
    setPlayerVolume(player, t);
    setPlayerVolume(standby, 1 - t);
  } else {
    setPlayerVolume(player, 1);
  }
}

// error/ended 어느 쪽도 안 뜨고 재생위치가 그대로 멈춰있는 "조용한 정지"를
// 잡아내는 watchdog. 6초 동안 currentTime이 안 움직이면 멈춘 것으로 보고
// 먼저 load()+같은 위치 재생을 두 번까지 시도하고, 그래도 안 되면 다음
// 곡으로 넘긴다(무한정 멈춰있는 것보단 낫다).
function musicStallWatchdog() {
  // 2026-07-15: 네이티브 모드에서는 이 <audio>가 애초에 실제로 play()되지
  // 않으므로(파일 상단 nativeClockTimerId 관련 주석 참조) player.paused가
  // 항상 true라 아래 조기 return에 자연히 걸린다 — 그래도 의도를 명확히
  // 하기 위해 명시적으로도 막아둔다.
  if (isNativeWrapper) return;
  const player = activePlayer();
  if (!player || !musicPlaying || player.paused) {
    stallRetryCount = 0;
    stallWatchCurrentTime = -1;
    return;
  }
  const now = Date.now();
  const current = player.currentTime;
  if (Math.abs(current - stallWatchCurrentTime) > 0.4) {
    stallWatchCurrentTime = current;
    stallWatchSince = now;
    stallRetryCount = 0;
    return;
  }
  if (now - stallWatchSince < 6000) return;
  stallWatchSince = now;
  if (stallRetryCount >= 2) {
    stallRetryCount = 0;
    playNextTrack();
    return;
  }
  stallRetryCount += 1;
  const savedTime = current;
  player.load();
  player.currentTime = savedTime;
  player.play().catch(() => {});
}

// 2026-07-08: pause/playing 네이티브 이벤트 디바운스 동기화 — 위
// musicPlayers.forEach 안의 리스너 설명 참조. 여러 이벤트가 겹쳐 도착해도
// 마지막에 한 번, 그 시점의 실제 오디오 상태(player.paused)만 확정 반영한다.
let musicStateSyncTimer = null;
function scheduleMusicStateSync() {
  if (musicStateSyncTimer !== null) return;
  musicStateSyncTimer = window.setTimeout(() => {
    musicStateSyncTimer = null;
    const player = activePlayer();
    if (!player) return;
    const actuallyPlaying = !player.paused && !player.ended;
    if (actuallyPlaying !== musicPlaying) {
      musicPlaying = actuallyPlaying;
      renderMusicToggle();
    }
  }, 120);
}

// 2026-07-22 유저 요청 — 서버 트래픽/스트리밍 비용 우려 대응: 유저가 끄는
// 걸 잊고 장시간 켜두는 상황에 상한을 둔다. Special(스트레스 해소/수면유도/
// 명상)은 연속 1시간, 그 외 일반 플레이리스트는 연속 2시간이 지나면 자동
// 일시정지한다. 트랙이 바뀌어도(크로스페이드 등) 계속 재생 중이면 타이머는
// 리셋하지 않는다 — "연속 재생 시간"이 기준이지 "한 곡 길이"가 아니다.
const MUSIC_AUTOPAUSE_LIMIT_SPECIAL_MS = 60 * 60 * 1000; // 1시간
const MUSIC_AUTOPAUSE_LIMIT_NORMAL_MS = 2 * 60 * 60 * 1000; // 2시간
const MUSIC_AUTOPAUSE_CHECK_INTERVAL_MS = 60 * 1000; // 1분마다 점검
let continuousPlaybackStartedAt = null;
let continuousPlaybackWatchdogId = null;

function musicAutoPauseLimitMs() {
  const base = isSpecialCategory(loadMusicPlaylistFilter())
    ? MUSIC_AUTOPAUSE_LIMIT_SPECIAL_MS
    : MUSIC_AUTOPAUSE_LIMIT_NORMAL_MS;
  // 2026-08-05 운영 지침 — 충전 중이 아니면 절반으로 앞당긴다
  // (Special 1시간→30분, 일반 2시간→1시간). "비충전 상태에서는 배터리를
  // 절약해주는 게 고마운 것"이라는 판단. 충전 중이면 기존 그대로다.
  // 충전 여부는 비주얼라이저 배터리 보호와 같은 판정을 쓴다
  // (네이티브 __FLIPZEN_CHARGING__ 우선, 없으면 Battery Status API,
  //  둘 다 없으면 '모름' = 비충전으로 간주).
  try {
    if (typeof window.__flipzenKnownNotCharging === "function"
        && window.__flipzenKnownNotCharging()) {
      return Math.round(base / 2);
    }
  } catch (error) { /* 판정 실패 시엔 기존 상한 그대로 */ }
  return base;
}

// setInterval 콜백 — musicPlaying이 계속 true인 동안 1분마다 불려서 누적
// 연속 재생 시간을 확인한다. 상한을 넘기면 toggleMusic의 "끄기" 경로와
// 동일한 방식(musicPlaying=false + pauseMusic + renderMusicToggle)으로
// 정지시키고, 갑자기 조용해진 이유를 토스트로 안내한다.
function checkMusicAutoPauseWatchdog() {
  if (!musicPlaying || continuousPlaybackStartedAt === null) return;
  const elapsed = Date.now() - continuousPlaybackStartedAt;
  if (elapsed < musicAutoPauseLimitMs()) return;
  musicPlaying = false;
  musicActionToken += 1;
  pauseMusic();
  renderMusicToggle();
  postToNativeHaptic("soft");
  showMusicToast(t("music.autoPaused", null, "귀의 휴식을 위해 자동 일시정지됐어요."));
}

// renderMusicToggle()이 재생/일시정지가 바뀔 수 있는 모든 경로(토글 클릭/
// 트랙 전환/실제 <audio> 이벤트 동기화 등)에서 공통으로 호출되는 지점이라
// 여기 하나에만 걸면 위 감시 타이머의 시작·정지가 전부 자동으로 커버된다.
function syncContinuousPlaybackWatchdog() {
  if (musicPlaying) {
    if (continuousPlaybackStartedAt === null) continuousPlaybackStartedAt = Date.now();
    if (continuousPlaybackWatchdogId === null) {
      continuousPlaybackWatchdogId = window.setInterval(checkMusicAutoPauseWatchdog, MUSIC_AUTOPAUSE_CHECK_INTERVAL_MS);
    }
  } else {
    continuousPlaybackStartedAt = null;
    if (continuousPlaybackWatchdogId !== null) {
      window.clearInterval(continuousPlaybackWatchdogId);
      continuousPlaybackWatchdogId = null;
    }
  }
}

function renderMusicToggle() {
  syncContinuousPlaybackWatchdog();
  if (!musicToggle) return;
  musicToggle.classList.toggle("is-playing", musicPlaying);
  // 2026-08-05 — 비주얼라이저 한가운데의 큰 재생 버튼은 "멈춰 있을 때만"
  // 보인다. 상태를 패널에 얹어두면 CSS 한 줄로 나타났다 물러난다.
  if (musicInfoPanel) musicInfoPanel.classList.toggle("is-music-playing", musicPlaying);
  // 2026-08-05 — 정지 상태에서는 rAF 루프를 아예 꺼두므로(위 drawMusicViz의
  // 가라앉기 분기), 재생이 시작되는 이 순간에 다시 깨워줘야 한다.
  try {
    if (musicPlaying && isMusicVizActiveContext() && !musicVizAnimId) drawMusicViz();
  } catch (error) { /* 무시 */ }
  musicToggle.setAttribute("aria-pressed", String(musicPlaying));
  musicToggle.setAttribute(
    "aria-label",
    musicPlaying ? t("music.pause", null, "음악 일시정지") : t("music.play", null, "음악 재생")
  );
  renderMusicHistoryList(); // 재생/일시정지에 따라 "바로 듣기"/"재생 중" 라벨도 같이 갱신한다.
  syncNativePlayState(); // 재생/일시정지 상태를 네이티브(잠금화면·오디오세션)에도 즉시 반영.
}

// 에러 이벤트도, ended 이벤트도 없이 재생이 조용히 멈추는 증상이 있었다
// (2026-07-07 유저 리포트: "에러메시지도 안 뜨고 그냥 멈춘다. 재생 버튼
// 눌러도 재생이 안 된다"). 이건 브라우저가 error를 던지지 않고 그냥
// 버퍼링에서 멈춰버리는 경우라, 위 watchdog으로 별도 감지한다.
// 그리고 멈춘 상태에서 재생 버튼을 눌렀을 때 단순히 play()만 다시 부르면
// 똑같이 막힌 상태라 반응이 없었을 것 — 실패하면 load()로 리셋 후 같은
// 위치에서 재시도하도록 바꾼다.
async function playMusic(token) {
  // 유저의 실제 탭(toggleMusic 클릭)으로만 호출되는 지점이라, iOS가 요구하는
  // "사용자 제스처 안에서" AudioContext를 만들고 깨우는 조건을 만족한다.
  ensureAudioGraph();
  // 2026-07-08 버그 수정: 에어팟을 뺐다 다시 끼우는 등 오디오 라우트가
  // 바뀐 직후엔 AudioContext가 suspended 상태로 남아있는 경우가 있다.
  // 예전엔 resume()을 기다리지 않고(fire-and-forget) 곧바로 player.play()를
  // 불렀는데, resume()이 아직 끝나기 전에 재생이 시작되면 <audio> 엘리먼트
  // 자체는 "재생 중"이 되지만 GainNode(볼륨 담당) 뒤쪽 AudioContext가 아직
  // 안 살아있어서 소리가 전혀 안 나는 상태가 됐다 — 버튼은 "일시정지"로
  // 바뀌는데 실제 소리는 없어서 다시 눌러야만 재생되는 증상의 원인이었다.
  // resume()을 확실히 기다린 뒤에 play()를 호출한다.
  // 2026-07-08 재수정: 에어팟을 뺐다 다시 끼우는 재검증에서 "재생 버튼을
  // 눌러도 소리가 전혀 안 나고, 일시정지→재생을 몇 번 반복해야 겨우
  // 소리가 난다"는 증상이 남아있었다 — state === "suspended"만 체크했는데,
  // iOS WebKit은 오디오 라우트가 끊겼다가 복구되는 구간에서 AudioContext를
  // "suspended"가 아닌 다른 비-running 상태로 두는 경우가 있어(예:
  // "interrupted") 이 조건에 안 걸려 resume()이 호출되지 않았다. "running"이
  // 아니면 무조건 resume을 시도하도록 조건을 넓힌다 — resume()은 이미
  // running인 컨텍스트에 불러도 안전하므로 넓혀도 부작용이 없다.
  if (audioContext && audioContext.state !== "running") {
    try { await audioContext.resume(); } catch (error) { /* 실패해도 아래에서 play 자체는 시도한다 */ }
  }
  // 이 await 도중에 사용자가 다시 눌러 더 최신 토큰이 발급됐다면, 이
  // 재생 시도는 이제 유효하지 않다 — 여기서 조용히 멈춘다.
  if (token !== musicActionToken) return;
  const player = activePlayer();
  if (!player) return;
  if (!player.src && !player._pendingLoad) {
    // 앱 실행 직후 prefetchFirstTrack()이 이미 이 트랙을 미리 받고 있는
    // 중이라면(_pendingLoad) 여기서 새로 고르지 않고 그 결과를 그대로 쓴다.
    musicIndex = pickNextTrackIndex();
    recordTrackHeard(musicIndex);
    recordPlayLog(musicIndex);
    renderMusicPlaylistInfo();
    renderMusicHistoryList();
    player._pendingLoad = loadMusicTrack(player, musicIndex, { prebuffer: true });
  }
  resetActiveWatchState();
  if (musicToggle) musicToggle.style.setProperty("--progress", "0");
  if (player._pendingLoad) {
    try { await player._pendingLoad; } catch (error) { /* 폴백은 loadMusicTrack 내부에서 처리됨 */ }
  }
  if (token !== musicActionToken) return; // fetch 대기 중 다시 눌렀다면 여기서도 중단
  if (isNativeWrapper) {
    // 네이티브 앱에서는 이 <audio>를 절대 실제로 play()하지 않는다 — 진짜
    // 소리는 이미 syncNativeTrackInfo/syncNativePlayState로 네이티브
    // AVPlayer에 전달됐다(renderMusicPlaylistInfo/renderMusicToggle 호출
    // 경로). 여기서는 화면 진행률/다음곡 전환 타이밍을 계산하는 가상시계만
    // 시작한다(파일 상단 nativeClockTimerId 관련 주석 참조).
    startNativeVirtualClock();
    return;
  }
  const resumeFrom = player.currentTime;
  player.play().catch(() => {
    if (token !== musicActionToken) return;
    const savedTime = resumeFrom;
    player.load();
    player.currentTime = savedTime;
    player.play().catch(() => {
      if (token !== musicActionToken) return;
      musicPlaying = false;
      renderMusicToggle();
    });
  });
}

function pauseMusic() {
  maybeSaveMusicResume(true); // 멈추는 순간 위치를 확실히 저장해둔다.
  stopNativeVirtualClock(); // 네이티브 모드가 아니면 애초에 실행 중이 아니므로 무해하다.
  activePlayer()?.pause();
  standbyPlayer()?.pause();
}

// 2026-07-15 재설계: 아래 SilentAudioKeepAlive/그림자 재생(heartbeat) 방식은
// 4차 시도까지 실기기에서 안정적으로 동작하지 않는 것으로 결론 났다
// (NATIVE_APP_STRATEGY.md 참조 — WKWebView는 백그라운드 전환 즉시 내부
// WebContent 프로세스의 HTML5 <audio>를 서스펜드해버려서, "전환되는 그
// 찰나에 네이티브가 바통을 받는" 방식 자체가 타이밍 경쟁을 안고 있었다).
// 이번 방식은 그 경쟁 자체를 없앤다 — 라디오(음악) 소리는 유저가 재생
// 버튼을 누르는 순간부터 끝까지, 포그라운드·백그라운드 구분 없이 항상
// 네이티브 AVPlayer가 낸다. 이 안의 <audio> 엘리먼트/크로스페이드/비주얼
// 라이저/진행률 계산 로직은 전혀 안 건드리고 그대로 "브레인" 역할을 하되,
// 실제 스피커 출력만 masterGainNode로 죽인다(ensureAudioGraph 참조) —
// 네이티브 쪽에 이중으로 소리가 나는 걸 막기 위해서다. 일반 웹/PWA(무료
// 버전)에서는 window.webkit이 없으므로 postToNativeRadio가 조용히 아무
// 일도 안 하고, masterGainNode도 항상 1로 유지된다 — 웹 동작에는 전혀
// 영향이 없다.
function postToNativeRadio(payload) {
  if (!isNativeWrapper) return;
  try {
    // 2026-07-24 신설 — 안드로이드 네이티브 브릿지(AndroidNativeBridge)는
    // JavascriptInterface 특성상 객체를 직접 못 받고 문자열만 받는다.
    // JSON.stringify로 감싸 채널명과 함께 넘긴다(Kotlin NativeBridge.postMessage
    // 참조). iOS 분기는 그대로 두고 안드로이드 분기만 추가한 형태라 기존
    // iOS 동작에는 전혀 영향이 없다.
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.flipzenNativeRadio) {
      window.webkit.messageHandlers.flipzenNativeRadio.postMessage(payload);
    } else if (window.AndroidNativeBridge) {
      window.AndroidNativeBridge.postMessage("flipzenNativeRadio", JSON.stringify(payload));
    }
  } catch (error) {
    // 네이티브 브릿지가 아직 준비 전이거나 없는 환경 — 조용히 무시(웹 동작 무관).
  }
}

// 2026-07-22 유저 요청 — "버튼 누르는 감성까지 좋았으면 좋겠다"에 대응해
// 신설한 햅틱 브릿지. postToNativeRadio와 완전히 같은 안전 패턴(네이티브
// 래퍼가 아니면 조용히 무시, 브릿지 미준비 시 에러 삼킴)을 그대로 재사용
// 하되, 채널 이름은 완전히 분리(flipzenHaptic)해 라디오 로직과 절대 섞이지
// 않는다. style은 iOS UIImpactFeedbackGenerator/UINotificationFeedbackGenerator
// 스타일 문자열 그대로 전달한다: "light"(일반 탭) / "soft"(좋아요처럼 부드러운
// 긍정) / "rigid"(싫어요처럼 또렷한 부정) / "success"(설정 저장 등 완결) /
// "selection"(문장 넘기기처럼 연속 스크럽 느낌).
function postToNativeHaptic(style) {
  if (!isNativeWrapper) return;
  try {
    // 2026-07-24 신설 — 안드로이드 분기 추가(위 postToNativeRadio와 동일 패턴).
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.flipzenHaptic) {
      window.webkit.messageHandlers.flipzenHaptic.postMessage({ style: style || "light" });
    } else if (window.AndroidNativeBridge) {
      window.AndroidNativeBridge.postMessage("flipzenHaptic", JSON.stringify({ style: style || "light" }));
    }
  } catch (error) {
    // 네이티브 브릿지가 아직 준비 전이거나(구버전 앱) 없는 환경 — 조용히 무시.
  }
}

// 2026-07-23 신설 — 광고/구매 브릿지(flipzenAd). postToNativeRadio/
// postToNativeHaptic과 완전히 동일한 안전 패턴(네이티브 래퍼 아니면 조용히
// 무시, 브릿지 미준비 시 에러 삼킴)을 그대로 재사용한다. 두 가지 용도:
//   - { action: "screenTransition" } — goToPage() 등 자연스러운 화면 전환
//     시점마다 호출. 네이티브가 그날 아직 리워드 전면 광고를 안 보여줬으면
//     이 신호를 계기로 광고를 제시한다(하루 1회 상한은 네이티브
//     AdTimerManager가 관리 — 웹은 그냥 "지금이 자연스러운 타이밍"이라는
//     신호만 보낸다).
//   - { action: "openPaywall" } — 설정 페이지 '프리미엄으로 업그레이드'
//     버튼에서 호출. 네이티브가 구매 시트(PaywallView)를 띄운다.
function postToNativeAd(payload) {
  if (!isNativeWrapper) return;
  try {
    // 2026-07-24 신설 — 안드로이드 분기 추가(위 postToNativeRadio와 동일 패턴).
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.flipzenAd) {
      window.webkit.messageHandlers.flipzenAd.postMessage(payload);
    } else if (window.AndroidNativeBridge) {
      window.AndroidNativeBridge.postMessage("flipzenAd", JSON.stringify(payload));
    }
  } catch (error) {
    // 네이티브 브릿지가 아직 준비 전이거나(구버전 앱) 없는 환경 — 조용히 무시.
  }
}

// ============================================================
// 2026-07-27 신설 — 원격 설정(app-config.json) 기반 "실행 시 팝업 배너" +
// "강제 업데이트". 설계 문서: DESIGN_앱푸시_팝업배너_강제업데이트_2026-07-27.md
// 핵심 원칙: 이 기능 전체(fetch 실패·JSON 파싱 실패·브릿지 미준비·구버전 앱
// 등 어떤 이유로도) 절대 앱의 나머지 기능을 막아선 안 된다 — 모든 단계가
// 실패하면 조용히 무시하고 "아무 것도 표시 안 함"으로 폴백한다. 일반 웹/PWA
// (isNativeWrapper === false)에서는 강제업데이트 자체가 대상이 아니므로
// 팝업 배너만 동작한다.
// ============================================================
const APP_CONFIG_URL = "https://ezlong.com/time/app-config.json";

// postToNativeRadio/postToNativeHaptic/postToNativeAd와 완전히 동일한 안전
// 패턴(네이티브 래퍼 아니면 조용히 무시, 브릿지 미준비 시 에러 삼킴)의
// 새 채널(flipzenApp) — NativeBridge.kt/ContentView.swift와 이름을 맞췄다.
function postToNativeApp(payload) {
  if (!isNativeWrapper) return;
  try {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.flipzenApp) {
      window.webkit.messageHandlers.flipzenApp.postMessage(payload);
    } else if (window.AndroidNativeBridge) {
      window.AndroidNativeBridge.postMessage("flipzenApp", JSON.stringify(payload));
    }
  } catch (error) {
    // 브릿지가 아직 준비 전이거나(구버전 앱) 없는 환경 — 조용히 무시.
  }
}

// 안드로이드는 JavascriptInterface가 문자열을 동기 반환할 수 있어 즉시
// 콜백한다. iOS는 WKScriptMessageHandler가 동기 반환을 지원하지 않는
// 구조적 제약이 있어(ContentView.swift 주석 참조) postMessage로 요청만
// 보내고 네이티브가 window.__flipzenAppVersionResult를 evaluateJavaScript로
// 직접 호출해주길 기다리는 1회성 콜백으로 우회한다. 브릿지 자체가 없는
// 일반 웹/PWA·구버전 앱에서는 callback(null)로 즉시 종료 — 호출부
// (checkForceUpdate)가 "버전을 모르면 아무 것도 안 함"으로 자연 폴백한다.
function getNativeAppVersion(callback) {
  if (!isNativeWrapper) {
    callback(null);
    return;
  }
  if (nativePlatformKey === "android" && window.AndroidNativeBridge && typeof window.AndroidNativeBridge.getAppVersion === "function") {
    try {
      callback(JSON.parse(window.AndroidNativeBridge.getAppVersion()));
    } catch (error) {
      callback(null);
    }
    return;
  }
  if (nativePlatformKey === "ios" && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.flipzenApp) {
    let settled = false;
    window.__flipzenAppVersionResult = (result) => {
      if (settled) return;
      settled = true;
      callback(result || null);
    };
    // 네이티브가 응답을 못 보내는 예외 상황(구버전 앱 등) 대비 타임아웃.
    setTimeout(() => {
      if (settled) return;
      settled = true;
      callback(null);
    }, 3000);
    postToNativeApp({ action: "getAppVersion" });
    return;
  }
  callback(null);
}

function openNativeAppStore() {
  postToNativeApp({ action: "openAppStore" });
}

// ── 2026-08-24 운영자: 설정 하단 '앱 공유'·'우리를 평가해 주세요' ──────────
// 공유는 각 플랫폼 스토어 링크를 시스템 공유 시트로, 평가는 스토어 페이지로.
function appStoreShareUrl() {
  var plat = new URLSearchParams(window.location.search).get("native");
  if (plat === "android") return "https://play.google.com/store/apps/details?id=com.ezlong.flipzenweather";
  if (plat === "ios") return "https://apps.apple.com/app/id6793780938";
  return "https://ezlong.com/time/";
}
function showShareToast(msg) {
  var el = document.getElementById("shareToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "shareToast";
    el.className = "share-toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("is-on");
  window.setTimeout(function () { el.classList.remove("is-on"); }, 2600);
}
function shareAppNow() {
  var url = appStoreShareUrl();
  var text = t("settings.shareAppMessage", null, "하루가 편해지는 플립시계·기상 알람 앱, Long Time, Easy Life를 써보세요.");
  if (navigator.share) {
    navigator.share({ title: "Long Time, Easy Life", text: text, url: url })
      .catch(function () { /* 사용자가 닫으면 조용히 */ });
    return;
  }
  try {
    navigator.clipboard.writeText(text + " " + url);
    showShareToast(t("settings.shareCopied", null, "링크를 복사했어요. 붙여넣어 공유하세요."));
  } catch (e) { /* 무시 */ }
}
function rateAppNow() {
  if (isNativeWrapper) { openNativeAppStore(); return; }
  try { window.open(appStoreShareUrl(), "_blank", "noopener"); } catch (e) { /* 무시 */ }
}
(function bindShareRate() {
  var shareBtn = document.getElementById("shareAppBtn");
  var rateBtn = document.getElementById("rateAppBtn");
  if (shareBtn) shareBtn.addEventListener("click", shareAppNow);
  if (rateBtn) rateBtn.addEventListener("click", rateAppNow);

  // 2026-08-26 — 광고 개인정보 동의(UMP) 재설정.
  //
  // 이 줄을 보여도 되는지는 UMP 가 지역을 확인한 뒤에야 안다. 페이지가 뜨는
  // 시점에는 알 수 없다는 뜻이라, 문서 시작 전 주입이 아니라 콜백으로 받는다.
  // 네이티브가 동의 절차를 마치면 스스로 한 번 알려주고(iOS ConsentManager
  // .notifyWebPrivacyOptions / Android notifyPrivacyOptionsToWeb), 혹시 그
  // 알림보다 페이지가 늦게 떴을 경우를 대비해 여기서도 한 번 물어본다.
  var privacyBtn = document.getElementById("privacyOptionsBtn");
  window.__flipzenPrivacyOptions = function (available) {
    if (!privacyBtn) return;
    privacyBtn.hidden = !available;
  };
  if (privacyBtn) {
    privacyBtn.addEventListener("click", function () {
      postToNativeAd({ action: "showPrivacyOptions" });
    });
    [0, 1500, 4000].forEach(function (delay) {
      window.setTimeout(function () { postToNativeAd({ action: "privacyOptionsStatus" }); }, delay);
    });
  }
})();

// 알라딘 모달과 동일한 "iOS는 기본 브라우저로, 안드로이드는 Custom Tabs로"
// 외부 링크 열기 패턴을 그대로 재사용한다(openAladinModal/withAladinPartnerParam
// 근처 참조) — 새 로직을 만들지 않는다.
function openPopupLink(url) {
  if (!url) return;
  if (isNativeWrapper) {
    if (nativePlatformKey === "ios" && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.flipzenNativeRadio) {
      window.webkit.messageHandlers.flipzenNativeRadio.postMessage({ action: "openExternalSafari", url });
      return;
    }
    if (nativePlatformKey === "android" && window.AndroidNativeBridge) {
      window.AndroidNativeBridge.postMessage("flipzenNativeRadio", JSON.stringify({ action: "openExternalSafari", url }));
      return;
    }
  }
  window.open(url, "_blank", "noopener");
}

// 2026-07-27 신설 — 앱푸시(FCM) 알림을 탭했을 때 네이티브(Android
// MainActivity.kt의 flushPendingDeepLink / iOS ContentView.swift Coordinator의
// webView(_:didFinish:))가 evaluateJavaScript로 직접 호출하는 훅. 새 열기
// 로직을 만들지 않고 기존 openPopupLink()(iOS 기본 브라우저/안드로이드 Custom
// Tabs 분기)를 그대로 재사용한다 — 팝업 배너 이미지 탭과 동일한 방식으로
// 링크가 열린다.
window.__flipzenOpenDeepLink = function (url) {
  if (!url) return;
  openPopupLink(url);
};

function checkAppConfig() {
  fetch(APP_CONFIG_URL, { cache: "no-cache" })
    .then((res) => (res.ok ? res.json() : null))
    .then((config) => {
      if (!config) return;
      maybeShowPopupBanner(config.popup);
      checkForceUpdate(config.update);
    })
    .catch(() => {
      // 원격 설정 파일이 아직 없거나(최초 배포 전) 네트워크 실패한 경우 —
      // 앱은 평소대로 계속 동작해야 하므로 조용히 무시.
    });
}

function popupDismissKey(id) {
  return `dismissedPopup_${id}`;
}

// enabled && 기간 안 && "다시 보지 않기" 기록 없음 — 세 조건 모두 통과할
// 때만 노출한다. 캠페인마다 id가 다르므로 새 이벤트가 뜨면 이전 캠페인의
// 다시보지않기 기록과 무관하게 자동으로 다시 노출된다(설계문서 3번).
function maybeShowPopupBanner(popup) {
  if (!popup || !popup.enabled || !popup.id || !popup.imageUrl) return;
  const now = Date.now();
  if (popup.startAt && now < Date.parse(popup.startAt)) return;
  if (popup.endAt && now > Date.parse(popup.endAt)) return;
  try {
    if (localStorage.getItem(popupDismissKey(popup.id)) === "1") return;
  } catch (e) {
    // localStorage 접근 실패(프라이빗 모드 등) — 매번 뜨는 정도의 부작용만
    // 있고 기능은 계속 동작해야 하므로 무시하고 진행.
  }
  renderPopupBanner(popup);
}

function renderPopupBanner(popup) {
  if (document.getElementById("appPromoOverlay")) return; // 중복 방지.
  const overlay = document.createElement("div");
  overlay.id = "appPromoOverlay";
  overlay.setAttribute(
    "style",
    "position:fixed;inset:0;z-index:999997;background:rgba(0,0,0,0.6);" +
      "display:flex;align-items:center;justify-content:center;padding:24px;"
  );

  const card = document.createElement("div");
  card.setAttribute(
    "style",
    "position:relative;max-width:360px;width:100%;background:#161616;border-radius:20px;" +
      "overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);"
  );

  const closeBtn = document.createElement("button");
  closeBtn.setAttribute("aria-label", t("common.close", null, "닫기"));
  closeBtn.textContent = "✕";
  closeBtn.setAttribute(
    "style",
    "position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:16px;" +
      "border:none;background:rgba(0,0,0,0.45);color:#fff;font-size:16px;line-height:1;" +
      "cursor:pointer;z-index:2;"
  );

  const img = document.createElement("img");
  img.src = popup.imageUrl;
  img.alt = "";
  img.setAttribute("style", "display:block;width:100%;height:auto;");
  if (popup.linkUrl) {
    img.style.cursor = "pointer";
    img.addEventListener("click", () => {
      postToNativeHaptic("light");
      openPopupLink(popup.linkUrl);
    });
  }

  const footer = document.createElement("div");
  footer.setAttribute(
    "style",
    "padding:14px 16px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;"
  );

  const label = document.createElement("label");
  label.setAttribute("style", "display:flex;align-items:center;gap:6px;color:#c7c7c7;font-size:14px;");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  label.appendChild(checkbox);
  label.appendChild(document.createTextNode(t("common.dontShowAgain", null, "다시 보지 않기")));

  const closeText = document.createElement("button");
  closeText.textContent = t("common.close", null, "닫기");
  closeText.setAttribute(
    "style",
    "background:transparent;border:none;color:#8ab4ff;font-size:14px;font-weight:600;cursor:pointer;padding:6px 4px;"
  );

  footer.appendChild(label);
  footer.appendChild(closeText);

  card.appendChild(img);
  card.appendChild(closeBtn);
  card.appendChild(footer);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function dismiss() {
    if (checkbox.checked) {
      try {
        localStorage.setItem(popupDismissKey(popup.id), "1");
      } catch (e) {
        // 무시 — 다음에 또 뜨는 정도의 부작용.
      }
    }
    overlay.remove();
  }

  closeBtn.addEventListener("click", dismiss);
  closeText.addEventListener("click", dismiss);
}

// nativePlatformKey("ios"/"android")별로 update.ios/update.android 규칙을
// 골라 현재 설치된 빌드와 비교한다. 버전을 못 받아오면(구버전 브릿지 등)
// 판단 자체를 하지 않는다 — 잘못된 정보로 정상 버전 유저를 막는 사고보다
// "이번엔 그냥 넘어감"이 항상 안전하다.
function checkForceUpdate(update) {
  if (!update || !nativePlatformKey) return; // 일반 웹/PWA는 대상 아님.
  const rule = update[nativePlatformKey];
  if (!rule) return;
  getNativeAppVersion((info) => {
    if (!info) return;
    const currentBuild = parseInt(info.versionCode, 10);
    const minBuild = nativePlatformKey === "ios" ? rule.minBuild : rule.minVersionCode;
    if (!Number.isFinite(currentBuild) || !Number.isFinite(minBuild)) return;
    if (currentBuild >= minBuild) return; // 이미 최신 이상 — 표시 안 함.
    renderUpdateGate(rule);
  });
}

function renderUpdateGate(rule) {
  if (document.getElementById("appUpdateGateOverlay")) return; // 중복 방지.
  const dismissible = !rule.forceUpdate;
  const overlay = document.createElement("div");
  overlay.id = "appUpdateGateOverlay";
  overlay.setAttribute(
    "style",
    "position:fixed;inset:0;z-index:999998;background:rgba(0,0,0,0.85);" +
      "display:flex;align-items:center;justify-content:center;padding:28px;"
  );

  const card = document.createElement("div");
  card.setAttribute(
    "style",
    "max-width:340px;width:100%;background:#1c1c1e;border-radius:20px;padding:28px 24px;" +
      "text-align:center;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,0.6);"
  );

  const title = document.createElement("div");
  title.textContent = dismissible
    ? t("update.availableTitle", null, "새 버전이 있어요")
    : t("update.requiredTitle", null, "업데이트가 필요합니다");
  title.setAttribute("style", "font-size:18px;font-weight:700;margin-bottom:10px;");

  const message = document.createElement("div");
  message.textContent = rule.message || t("update.body", null, "새로운 버전으로 업데이트해 주세요.");
  message.setAttribute("style", "font-size:15px;color:#c7c7c7;line-height:1.5;margin-bottom:22px;");

  const updateBtn = document.createElement("button");
  updateBtn.textContent = t("update.now", null, "지금 업데이트");
  updateBtn.setAttribute(
    "style",
    "width:100%;padding:14px;border-radius:14px;border:none;background:#0a84ff;color:#fff;" +
      "font-size:16px;font-weight:700;cursor:pointer;"
  );
  updateBtn.addEventListener("click", () => {
    postToNativeHaptic("light");
    openNativeAppStore();
  });

  card.appendChild(title);
  card.appendChild(message);
  card.appendChild(updateBtn);

  if (dismissible) {
    const laterBtn = document.createElement("button");
    laterBtn.textContent = t("update.later", null, "나중에");
    laterBtn.setAttribute(
      "style",
      "width:100%;padding:12px;margin-top:10px;border-radius:14px;border:none;" +
        "background:transparent;color:#8e8e93;font-size:15px;cursor:pointer;"
    );
    laterBtn.addEventListener("click", () => overlay.remove());
    card.appendChild(laterBtn);
  }

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

// renderMusicPlaylistInfo()가 트랙이 바뀌는 모든 지점(첫 재생 시작·수동
// 스킵·자동 크로스페이드 완료·플레이리스트/장르 필터 변경)에서 공통으로
// 호출되므로, 여기 한 곳에만 붙여도 트랙 전환을 하나도 놓치지 않고
// 네이티브에 전달할 수 있다.
function syncNativeTrackInfo() {
  if (!isNativeWrapper) return;
  const track = Array.isArray(musicPlaylist) && musicPlaylist.length > 0
    ? musicPlaylist[musicIndex % musicPlaylist.length]
    : null;
  if (!track) return;
  const player = activePlayer();
  postToNativeRadio({
    action: "trackChanged",
    url: resolveTrackAbsoluteUrl(track),
    title: track.title || "FlipZen Radio",
    time: player ? (player.currentTime || 0) : 0,
    playing: musicPlaying,
  });
}

// renderMusicToggle()이 재생/일시정지 상태가 바뀌는 유일한 공통 지점이라
// 여기서만 네이티브에 재생 상태를 알린다(곡 자체는 안 바뀌었을 수 있으니
// syncNativeTrackInfo와 분리해둔다).
function syncNativePlayState() {
  postToNativeRadio({ action: "playState", playing: musicPlaying });
}

// 진행률 바를 손가락/마우스/키보드로 옮겼을 때(seekMusicProgressToClientX,
// 화살표키 탐색) 네이티브 재생 위치도 맞춰준다 — 안 그러면 화면 진행률과
// 잠금화면/제어센터 쪽 실제 재생 위치가 어긋난다. 재생 중에만 15초마다도
// 한 번씩 같은 함수로 가볍게 재동기화해서(아래 setInterval), 오랜 시간
// 백그라운드에 있어도 위치가 크게 벌어지지 않게 한다.
function syncNativeSeek() {
  if (!isNativeWrapper) return;
  const player = activePlayer();
  if (!player) return;
  postToNativeRadio({ action: "seek", time: player.currentTime || 0 });
}

// 네이티브(잠금화면/제어센터)에서 재생·일시정지·다음곡 버튼을 눌렀을 때
// 호출된다(ContentView.swift → evaluateJavaScript). "네이티브 전용 로직"을
// 새로 만들지 않고 기존 toggleMusic()/playNextTrack()을 그대로 재사용해서,
// 화면 UI·크로스페이드·재생기록 등 모든 부수효과가 잠금화면 조작에도 똑같이
// 따라오게 한다.
// 앱이 백그라운드에서 돌아올 때 네이티브(ContentView.swift의 didBecomeActive
// 관찰자)가 호출한다. WKWebView는 백그라운드 동안 내부 미디어 파이프라인
// 자체를 멈춰두므로(이 프로젝트에서 반복 확인된 동작), 이 웹 쪽 <audio>는
// 배경 전 마지막 위치에 그대로 멈춰있다 — 실제 소리(네이티브)는 배경 내내
// 정확히 흘러왔으므로, 그 진짜 위치로 화면 진행률·크로스페이드 타이밍을
// 맞춰준다. 이 보정이 없으면 복귀 직후 진행률 바가 잠깐 "거꾸로" 보이거나,
// 15초 재동기화(syncNativeSeek)가 오히려 네이티브를 과거로 되감길 수 있다.
window.__flipzenNativeTimeSync = function (time) {
  if (!isNativeWrapper || !Number.isFinite(time)) return;
  const player = activePlayer();
  if (!player) return;
  player.currentTime = time;
  // 2026-07-15: 예전엔 여기서 player.play()를 다시 불렀는데, 이게 바로
  // "제어센터를 열고 닫을 때만 비주얼라이저가 잠깐 살아났다 죽는" 증상의
  // 정체였다(파일 상단 nativeClockTimerId 관련 주석 참조) — 이 <audio>는
  // 네이티브 모드에서 절대 실제로 play()하지 않는다. 방금 갓 동기화한
  // 시점으로 가상시계의 델타 기준을 리셋하고, 화면 진행률만 즉시 반영한다.
  nativeClockLastTs = performance.now();
  updateMusicProgress({ target: player });
};

window.__flipzenNativeCommand = function (command) {
  if (command === "play") {
    if (!musicPlaying) toggleMusic();
  } else if (command === "pause") {
    if (musicPlaying) toggleMusic();
  } else if (command === "next") {
    playNextTrack();
  } else if (command === "autoAdvanced") {
    // 2026-07-26 Fable5 지시서 작업2 — 아래 handleNativeAutoAdvance() 주석 참조.
    handleNativeAutoAdvance();
  } else if (command === "needNext") {
    // ★ 2026-07-29 안드로이드 무음 사건의 최종 해결 ★
    // 네이티브가 곡을 끝까지 재생했는데 이어받을 프리페치가 없어서 그 자리에
    // 선 상태다(실측: state=ENDED, pos≥dur, vol=1.0). 원인은 백그라운드에서
    // WebView 타이머가 스로틀돼 우리가 prefetchNext 를 못 보낸 것이다.
    //
    // 즉 지금 이 순간 음악은 **멈춰 있다**. 가상시계(tickNativeVirtualClock)만
    // 계속 돌아서 진행바가 움직이니 화면으로는 재생 중처럼 보인다 —
    // 운영자가 "무음인데 진행바는 간다"고 하신 그 상태가 이것이다.
    //
    // 여기서 할 일은 하나뿐이다: 즉시 다음 곡으로 넘겨 소리를 되살린다.
    // 재생 중일 때만 반응한다 — 유저가 일시정지해둔 상태라면 곡이 끝나
    // 멈춰 있는 게 정상이므로 건드리지 않는다.
    if (musicPlaying) {
      playNextTrack();
      // 2026-07-30 (35-B (a)안) — needNext는 네이티브 큐까지 전부 바닥났다는
      // 뜻이다. 지금은 evaluateJavascript로 웹이 깨어난 순간이니, 새 곡을
      // 트는 것에서 멈추지 않고 다음·다음다음 곡까지 즉시 재예약해 큐를
      // 다시 채운다(playNextTrack이 방금 슬롯 미러를 리셋했고, 네이티브도
      // setTrack에서 큐를 비웠다 — 여기서 새로 쌓는 것이 정합).
      if (isAndroidNativeWrapper() && Array.isArray(musicPlaylist) && musicPlaylist.length > 0) {
        pendingNextIndex = pickNextTrackIndex();
        recordTrackHeard(pendingNextIndex);
        const refillStandby = standbyPlayer();
        if (refillStandby) {
          refillStandby._pendingLoad = loadMusicTrack(refillStandby, pendingNextIndex, { prebuffer: true });
        }
        const refillUpcoming = musicPlaylist[pendingNextIndex % musicPlaylist.length];
        if (refillUpcoming) {
          postToNativeRadio({ action: "prefetchNext", url: resolveTrackAbsoluteUrl(refillUpcoming) });
        }
        fillSecondPrefetchSlot();
      }
    }
  }
};

function toggleMusic() {
  postToNativeHaptic("light");
  musicPlaying = !musicPlaying;
  musicActionToken += 1; // 이 클릭이 "가장 최신 의도"임을 표시 — 이전 재생 시도는 이 값으로 자기 차례가 지났음을 안다.
  if (musicPlaying) {
    playMusic(musicActionToken);
    announceActiveFilterOnFirstPlay();
  } else {
    pauseMusic();
  }
  renderMusicToggle();
}

// 2026-07-20 유저 요청 — 기본값(전체 랜덤 + 제외 필터 없음)이 아닌 상태로
// 재생을 시작하면, 앱을 켤 때마다(세션당 1회) 지금 어떤 필터가 걸려있는지
// 토스트로 알려준다. 배경: 유저가 예전에 골라둔 카테고리/제외 필터를
// 잊어버리고 "왜 특정 곡만 계속 나오지?"라고 오인하는 걸 막기 위함 —
// 재생 버튼(toggleMusic)이 유일한 재생 시작 경로라 여기 한 곳만 걸면 된다.
// musicToast는 시계 화면(#musicToast)에 있어 설정 화면이 아니라 재생을
// 시작하는 시점(=시계 화면으로 돌아온 상태)에만 자연스럽게 보인다.
let firstPlayFilterAnnounced = false;
function announceActiveFilterOnFirstPlay() {
  if (firstPlayFilterAnnounced) return;
  firstPlayFilterAnnounced = true;
  const filterKey = loadMusicPlaylistFilter();
  const hasFilter = Boolean(filterKey && filterKey !== "all");
  // 2026-07-25: 이분법(Vocal/연주곡) 대신 4개 카테고리 제외 토글을 순회해
  // 켜진 것만 라벨로 모은다.
  const excludeParts = [];
  MUSIC_EXCLUDABLE_CATEGORIES.forEach((cat) => {
    const excluded = loadMusicGenreToggle(cat.storageKey, false) && !musicExcludeFilterContradicts(cat.key, filterKey);
    if (excluded) excludeParts.push(`${cat.label} 제외`);
  });
  if (!hasFilter && excludeParts.length === 0) return; // 기본값 그대로면 알려줄 게 없음
  // 2026-07-22 운영 피드백 — "'수면유도'만 상태로"라는 표현이 어색하다는
  // 피드백으로, 카테고리 필터가 있을 땐 "'xxxx' 플레이리스트를 재생 중"으로
  // 자연스럽게 바꿨다. 제외 필터는 괄호로 덧붙여 정보는 그대로 유지.
  // 카테고리 필터 없이 제외만 걸려있는 경우(부를 플레이리스트 이름이
  // 없음)엔 기존 "OO 상태로 재생 중" 문구를 그대로 쓴다.
  let message;
  if (hasFilter) {
    message = `지금 '${musicPlaylistFilterAnnounceLabel(filterKey)}' 플레이리스트를 재생 중이에요`;
    if (excludeParts.length > 0) message += ` (${excludeParts.join(" · ")})`;
  } else {
    message = `지금 ${excludeParts.join(" · ")} 상태로 재생 중이에요`;
  }
  showMusicToast(message);
}

// 스킵 버튼(수동)은 크로스페이드 없이 즉시 곡을 바꾼다 — 유저가 직접 누른
// 즉각 반응이 우선이고, 곡이 끝나기 전 자동 전환과는 성격이 다르다.
//
// 2026-07-08 버그 수정: "재생 중에는 스킵이 안 먹힌다(멈춤 상태에서는
// 먹힌다)" — 예전 코드는 전체 파일을 fetch로 통째로 받는(prebuffer)
// 작업이 끝나길 await한 뒤에야 player.play()를 불렀다. 그 await(네트워크
// 요청, 파일 크기에 따라 수백ms~수초) 동안 iOS는 이 클릭을 "유저 제스처"로
// 인정하는 유효 구간을 지나쳐버려서, 이후의 play() 호출이 아무 에러 없이
// 조용히 무시됐다. 멈춤 상태에서 스킵을 누르면 재생 자체는 안 하고 다음
// 트랙만 준비해두고 끝나서, 나중에 재생 버튼을 누르는 "새로운" 제스처가
// play()를 불러 문제가 없었던 것 — 그래서 딱 "재생 중에만" 증상이 있었다.
// 고친 방법: loadMusicTrack을 prebuffer:false로 불러 await 없이(같은 함수
// 안에서 네트워크를 기다리지 않고) 곧바로 player.src를 스트리밍 URL로
// 세팅하고, 그 즉시(제스처가 아직 살아있는 채로) player.play()를 부른다.
async function playNextTrack() {
  if (!Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return;
  musicActionToken += 1; // 진행 중이던 이전 재생 시도(있었다면)를 무효화한다.
  crossfadeTriggered = false;
  pendingNextIndex = -1;
  pendingSecondIndex = -1; // 수동 스킵 — 슬롯2 미러도 폐기(네이티브 setTrack이 큐를 비운다)
  const standby = standbyPlayer();
  if (standby) {
    standby.pause();
    standby.removeAttribute("src");
    // 백그라운드로 이 standby를 향해 이미 날아가고 있던 prebuffer fetch가
    // 있었다면, 그 결과가 나중에 도착했을 때 방금 지운 src를 도로 채워
    // 넣지 못하도록 대상 URL 표식을 함께 지운다.
    delete standby.dataset.pendingUrl;
  }
  const player = activePlayer();
  musicIndex = pickNextTrackIndex();
  recordTrackHeard(musicIndex);
  recordPlayLog(musicIndex);
  renderMusicPlaylistInfo();
  renderMusicHistoryList();
  resetActiveWatchState();
  if (musicToggle) musicToggle.style.setProperty("--progress", "0");
  if (player.dataset.blobUrl) {
    URL.revokeObjectURL(player.dataset.blobUrl);
    delete player.dataset.blobUrl;
  }
  delete player.dataset.pendingUrl;
  player._pendingLoad = null;
  loadMusicTrack(player, musicIndex, { prebuffer: false });
  // 네이티브 모드에서는 이 <audio>를 절대 실제로 play()하지 않는다(파일 상단
  // nativeClockTimerId 관련 주석 참조) — syncNativeTrackInfo(renderMusicPlaylistInfo
  // 안에서 이미 호출됨)가 네이티브 AVPlayer에 새 트랙을 즉시 전달한다.
  if (musicPlaying && !isNativeWrapper) {
    player.play().catch(() => {});
  }
}

// 자동 종료(곡이 끝) 처리 — 크로스페이드가 이미 걸려서 standby가 겹쳐
// 재생 중이었다면 역할만 바꾼다(새로 로드하지 않으니 무음 구간이 없다).
// 크로스페이드가 못 걸린 예외적인 경우(길이 정보를 못 받았거나 페이드
// 구간을 놓친 경우)에만 기존처럼 즉시 다음 곡을 새로 로드한다.
function handleActivePlayerEnded(event) {
  const player = event.target;
  if (player !== activePlayer()) return;
  const standby = standbyPlayer();
  if (crossfadeTriggered && standby && pendingNextIndex >= 0) {
    player.pause();
    player.currentTime = 0;
    activePlayerIndex = 1 - activePlayerIndex;
    musicIndex = pendingNextIndex;
    pendingNextIndex = -1;
    // 2026-07-30(안드로이드 전용) — 슬롯2 미러를 슬롯1로 승격한다. 네이티브도
    // 같은 순간 큐 헤드를 새 crossfadePlayer로 준비하므로(FIFO) 양쪽 장부가
    // 일치한다. 이미 recordTrackHeard/프리페치 전송까지 끝난 곡이라 여기서는
    // 다시 기록하거나 다시 보내지 않는다 — standby 로드만 새로 건다.
    if (isAndroidNativeWrapper() && pendingSecondIndex >= 0) {
      pendingNextIndex = pendingSecondIndex;
      pendingSecondIndex = -1;
      const promotedStandby = standbyPlayer();
      if (promotedStandby) {
        promotedStandby._pendingLoad = loadMusicTrack(promotedStandby, pendingNextIndex, { prebuffer: true });
      }
    }
    if (isNativeWrapper) {
      // 2026-07-16: 크로스페이드가 끝난 이 순간, 네이티브(AVPlayer)의 새
      // 트랙은 이미 musicFadeOutSeconds(4초)만큼 실제로 재생된 상태다 —
      // crossfadeStart에서 볼륨 0으로 미리 재생을 시작해 fadeDuration에
      // 걸쳐 서서히 페이드했기 때문. 그런데 JS 쪽 "가상시계" 역할을 하는
      // 새 activePlayer(방금 전까지 standby였던 <audio>)는 네이티브
      // 모드에서 한 번도 실제로 play()된 적이 없어(위 nativeClockTimerId
      // 주석 참조) currentTime이 초기값 0에 그대로 멈춰있었다. 이 ~4초
      // 차이가 15초마다 도는 syncNativeSeek()(아래 setInterval)에 그대로
      // 실려 네이티브에 "몇 초 전으로 되돌아가라"는 신호로 전달됐고,
      // 크로스페이드 직후 다음 15초 재동기화 타이밍이 우연히 겹치는
      // 순간마다 곡이 갑자기 되감겼다 정상 재생되는 버그로 이어졌다(유저
      // 제보: "5초 정도에서 2초 정도 되돌림, 두세곡에 한번꼴"). 근본
      // 원인은 이 가상시계가 네이티브의 실제 재생 위치를 반영하지 못했던
      // 것 — 여기서 네이티브의 실제 위치(약 fadeDuration초)로 맞춰준다.
      activePlayer().currentTime = musicFadeOutSeconds;
    }
    recordPlayLog(musicIndex);
    // 2026-07-15: 네이티브 모드에서는 위 renderMusicPlaylistInfo() 주석 참조 —
    // 이 전환은 네이티브가 이미 스스로 크로스페이드로 끝낸 것이라 trackChanged를
    // 다시 보내지 않는다(화면 텍스트만 갱신).
    renderMusicPlaylistInfo(isNativeWrapper ? { skipNativeSync: true } : undefined);
    renderMusicHistoryList();
    crossfadeTriggered = false;
    setPlayerVolume(activePlayer(), 1);
    // 방어 코드(2026-07-07): 위 updateMusicProgress에서 걸었던 standby.play()가
    // 어떤 이유로든(iOS 앱 환경 등) 실제로는 재생을 못 시작했을 경우를 대비해,
    // 역할을 바꾼 새 activePlayer가 확실히 재생 중인 상태로 만든다. 이미
    // 재생 중이면 이 호출은 사실상 아무 효과가 없어 무해하다.
    // 2026-07-15: 네이티브 모드에서는 이 <audio>를 절대 실제로 play()하지
    // 않는다(파일 상단 nativeClockTimerId 관련 주석 참조) — 새 activePlayer는
    // currentTime 0에서 대기만 하고, 진짜 소리는 이미 syncNativeTrackInfo로
    // 네이티브 AVPlayer에 전달됐다.
    if (!isNativeWrapper) activePlayer().play().catch(() => {});
    resetActiveWatchState();
    return;
  }
  playNextTrack();
}

// 2026-07-26 Fable5 지시서 작업2 — 안드로이드가 백그라운드에서 곡을 끝까지
// 재생했는데(작업1의 10분 버퍼 확대로 이제 곡 중간에 끊기지 않는다) 정작
// "지휘자" 역할인 JS가 화면 꺼짐·절전으로 완전히 잠들어 다음 곡 명령을
// 보내지 못하는 경우를 위한 보험. NativeRadioService.autoAdvanceIfPossible()가
// 이미 준비해뒀던 크로스페이드 플레이어를 스스로 승격시켜 소리는 끊김없이
// 다음 곡으로 넘어간 뒤, evaluateJavascript로 이 "autoAdvanced" 명령을
// 강제 주입한다 — 이 호출은 setInterval 스로틀과 무관하게 즉시 실행되므로
// 잠들어 있던 JS도 이 순간만큼은 깨어나 실행된다. 여기선 이미 끝난 소리
// 전환을 JS의 장부(musicIndex/activePlayerIndex/제목 UI)에 뒤늦게 반영하고,
// 다음 곡(그 다음 순번)을 새로 예약해 네이티브에 미리 알려준다 — 그래야
// 이 곡이 끝날 때도 네이티브의 crossfadePlayer가 비어있지 않다.
function handleNativeAutoAdvance() {
  if (!isNativeWrapper) return;
  const standby = standbyPlayer();
  if (standby && pendingNextIndex >= 0) {
    // 정상 경로: 18초 프리버퍼 시점에 이미 이 트랙을 pendingNextIndex로
    // 예약해뒀고, 네이티브도 그때 받은 prefetchNext URL로 crossfadePlayer를
    // 준비해뒀다가 지금 그걸 그대로 승격했다 — handleActivePlayerEnded의
    // crossfadeTriggered 분기와 사실상 동일한 상태 전이이나, 실제 페이드
    // 없이 즉시 전환됐으므로 currentTime은 0으로 맞춘다.
    activePlayerIndex = 1 - activePlayerIndex;
    musicIndex = pendingNextIndex;
  } else {
    // 방어 코드: 프리버퍼 예약 전에 JS가 이미 잠들어 pendingNextIndex를
    // 못 남긴 극히 드문 경우 — 네이티브가 실제로 어떤 곡으로 넘어갔는지
    // JS는 정확히 알 수 없으므로, 최소한 화면·다음 예약이라도 어긋나지
    // 않게 새로 하나를 뽑아 맞춘다(완전한 동기화 보장은 아니다).
    musicIndex = pickNextTrackIndex();
  }
  crossfadeTriggered = false;
  pendingNextIndex = -1;
  const player = activePlayer();
  player.currentTime = 0;
  recordTrackHeard(musicIndex);
  recordPlayLog(musicIndex);
  // 네이티브가 이미 스스로 전환을 끝냈다 — trackChanged/crossfadeStart를
  // 또 보내면 안 된다(renderMusicPlaylistInfo 위쪽 주석과 동일 원칙).
  renderMusicPlaylistInfo({ skipNativeSync: true });
  renderMusicHistoryList();
  resetActiveWatchState();
  nativeClockLastTs = performance.now();
  setPlayerVolume(activePlayer(), 1);

  // 네이티브의 crossfadePlayer 슬롯이 방금 소비돼 비었다 — 이 곡이 끝날
  // 때도 같은 보험이 작동하도록, 정상적인 18초-프리버퍼 타이밍을 기다리지
  // 않고 바로 다음 순번을 새로 예약해 네이티브에 미리 알려준다.
  // 2026-07-30 확장(35-B (a)안): 안드로이드에서는 슬롯2 미러가 있으면 그걸
  // 슬롯1로 승격한다 — 네이티브도 같은 순간 큐 헤드를 새 crossfadePlayer로
  // 준비했으므로(refillPrefetchFromQueue, FIFO) 양쪽 장부가 일치한다. 승격된
  // 곡은 이미 기록·전송이 끝났으니 standby 로드만 새로 걸고, 빈 슬롯2는
  // 지금(웹이 깨어있는 순간) 즉시 재충전한다.
  const nextStandby = standbyPlayer();
  if (nextStandby && Array.isArray(musicPlaylist) && musicPlaylist.length > 0) {
    if (isAndroidNativeWrapper() && pendingSecondIndex >= 0) {
      pendingNextIndex = pendingSecondIndex;
      pendingSecondIndex = -1;
      nextStandby._pendingLoad = loadMusicTrack(nextStandby, pendingNextIndex, { prebuffer: true });
    } else {
      pendingNextIndex = pickNextTrackIndex();
      recordTrackHeard(pendingNextIndex);
      nextStandby._pendingLoad = loadMusicTrack(nextStandby, pendingNextIndex, { prebuffer: true });
      const upcoming = musicPlaylist[pendingNextIndex % musicPlaylist.length];
      if (upcoming) {
        postToNativeRadio({ action: "prefetchNext", url: resolveTrackAbsoluteUrl(upcoming) });
      }
    }
    fillSecondPrefetchSlot();
  }
}

// 2026-07-15: "제목에 (1), (2)가 많은데 파일명 중복 흔적이냐"는 질문 —
// 확인해보니 파일명이 아니라 music-playlist.js의 playlist 필드였다.
// scripts/build-music-playlist.js의 parseFileName()이 파일명 끝의
// "_partN" 또는 "_N"에서 변주(같은 곡의 다른 버전) 번호를 뽑아내는데, 이때
// "part"라는 단어는 버리고 숫자만 남긴다 — 그래서 파일명을 "part2"로
// 바꿔도 결과는 여전히 순수 숫자 "2"다(유저가 파일명을 고쳐도 이 증상이
// 그대로였던 이유). 기존 30곡(58트랙) 세트는 A/B 글자 코드라 "(A)"처럼
// 봐줄 만했지만, 숫자만 있으면 "이게 뭔가 잘못된 흔적인가" 싶게 어색하다.
// 데이터를 건드리는 대신(빌드 스크립트는 유저의 실제 Mac 폴더를 스캔해야
// 해서 이 세션에서 재실행 불가) 표시 단계에서만 숫자 코드를 "Part N"으로
// 풀어써서 훨씬 자연스럽게 보이게 한다(2026-07-19: "파트"는 한국식 발음
// 표기라 유저 요청대로 영어 표기 "Part"로 변경). 글자 코드(A/B)는 그대로 둔다.
function formatPlaylistVariant(playlist) {
  if (!playlist || playlist === "SINGLE") return "";
  return /^\d+$/.test(playlist) ? ` (Part ${playlist})` : ` (${playlist})`;
}

// 2026-07-08: "지금 재생 중인 곡이 뭔지 궁금하다"는 질문에 답할 방법이
// 화면 어디에도 없었다(재생/스킵 버튼만 있고 곡명 표시가 없었음) — 음악
// 설정 패널에 이미 있던 총 곡수 안내에 현재 곡 제목을 덧붙인다.
// 2026-07-19 4차 피드백: 설정 패널 맨 위 "NOW PLAYING" 박스는 다시
// 완전히 없앤다(직전 라운드에 부각시켜 달라고 했다가 이번엔 아예 빼
// 달라는 요청) — musicPlaylistInfo 관련 HTML(#musicPlaylistInfo)과
// CSS(.now-playing 계열)도 함께 제거했다. 이 함수는 이제 그 표시를
// 완전히 건드리지 않고, 곡 제목(musicTrackTitle)·좋아요싫어요 버튼·
// 네이티브 동기화만 담당한다.
function renderMusicPlaylistInfo(options) {
  const track = Array.isArray(musicPlaylist) && musicPlaylist.length > 0
    ? musicPlaylist[musicIndex % musicPlaylist.length]
    : null;
  // 2026-07-13: 음악 정보 패널의 곡명 표시 + 좋아요/싫어요 버튼 상태도
  // 트랙이 바뀔 때마다 여기서 함께 갱신한다(호출 지점이 이미 여러 곳이라
  // 이 한 함수에만 붙여두면 전부 자동으로 따라온다).
  if (musicTrackTitle) {
    musicTrackTitle.textContent = track && track.title
      ? track.title
      : t("music.waiting", null, "재생 대기 중");
  }
  // 트랙이 바뀌는 시점에 이전 곡의 진행률이 잠깐 남아 보이지 않도록 즉시 리셋
  // — 새 값은 곧이어 updateMusicProgress()의 timeupdate가 다시 채운다.
  if (musicProgressFill) musicProgressFill.style.width = "0%";
  renderMusicReactionButtons();
  // 2026-07-15: 네이티브 크로스페이드 완료 시점(handleActivePlayerEnded의
  // crossfadeTriggered 분기)에는 이 트랙 전환 소식을 네이티브에 또 보내면
  // 안 된다 — 네이티브는 이미 자기 자신의 crossfadeStart/tickFade 타이머로
  // 이 전환을 스스로 끝냈고(currentURLString·제목·잠금화면 정보까지 이미
  // NativeRadioPlayer.finishCrossfade()가 갱신함), 여기서 JS가 또 trackChanged를
  // 보내면 두 타이머가 정확히 같은 순간에 끝나지 않는 경우(수십ms 오차)
  // "네이티브는 아직 페이드 중인데 JS는 벌써 끝났다고 판단" 하는 경쟁이
  // 생겨 cancelActiveCrossfade()가 페이드를 도중에 끊고 새 트랙을 처음부터
  // 다시 하드컷하는 사고로 이어질 수 있다. 네이티브가 이미 알아서 처리한
  // 전환이므로 JS 쪽 신호는 생략하고 화면 텍스트 갱신만 한다.
  if (!(options && options.skipNativeSync)) {
    syncNativeTrackInfo(); // 이 함수가 트랙 전환 전부(수동 스킵·자동전환·필터변경 포함)의 공통 지점.
  }
}

// 2026-07-12: "몇 가지 플레이리스트로 나눌 수 있나" 요청 — 실제 존재하는
// category 값(오리지널 포함 7종)을 기준으로 자동으로 옵션을 만든다. 트랙이
// 나중에 더 늘어나거나 카테고리가 추가돼도 이 목록·라디오 버튼은 코드 수정
// 없이 자동으로 따라간다.
// 2026-07-20 수정: Special 카테고리(스트레스 해소/수면유도/명상)는 이 일반
// 목록에서 뺀다 — buildMusicSpecialOptions()가 별도로 만든다. "전체 랜덤"의
// count도 Special 트랙 수를 뺀 실질 곡수로 맞춘다(그 풀에 실제로 안 섞이니).
function buildMusicPlaylistOptions() {
  const counts = new Map();
  let allCount = 0;
  if (Array.isArray(musicPlaylist)) {
    musicPlaylist.forEach((track) => {
      const key = trackCategoryKey(track);
      if (isSpecialCategory(key)) return;
      counts.set(key, (counts.get(key) || 0) + 1);
      allCount += 1;
    });
  }
  const options = [{ key: "all", label: t("music.allShuffle", null, "전체 랜덤"), count: allCount }];
  Array.from(counts.keys()).forEach((key) => {
    options.push({ key, label: musicCategoryLabel(key), count: counts.get(key) });
  });
  return options;
}

// 2026-07-20 신설 — Special 전용 목록. "전체" 항목 없이 3개 카테고리만.
function buildMusicSpecialOptions() {
  const counts = new Map();
  if (Array.isArray(musicPlaylist)) {
    musicPlaylist.forEach((track) => {
      const key = trackCategoryKey(track);
      if (!isSpecialCategory(key)) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  }
  return Array.from(counts.keys()).map((key) => ({
    key,
    label: musicCategoryLabel(key),
    count: counts.get(key),
  }));
}

// 2026-07-18 유저 요청 — "몇 곡 있는지 알지 못하게" 하기 위해 표시 텍스트에서
// 곡수를 뺀다. buildMusicPlaylistOptions()의 option.count 자체는 그대로 두는데
// (라운드로빈 로테이션 등 내부 로직이 곡수에 의존하지 않고 category 목록만
// 쓰므로 지워도 무해하지만, 굳이 건드릴 이유가 없어 계산은 유지하고 화면
// 표시에서만 뺐다), 라벨 뒤에 곡수를 붙이던 부분만 제거한다.
function renderMusicPlaylistFilterOptions() {
  if (!musicPlaylistOptionsEl) return;
  const options = buildMusicPlaylistOptions();
  const current = loadMusicPlaylistFilter();
  musicPlaylistOptionsEl.innerHTML = options.map((option) => {
    const checked = option.key === current ? " checked" : "";
    return `<label class="field-option"><input type="radio" name="musicPlaylistFilter" value="${option.key}"${checked}><span>${option.label}</span></label>`;
  }).join("");
  renderMusicSpecialFilterOptions();
}

// 2026-07-20 신설 — Special 박스 렌더링. name="musicPlaylistFilter"를 위
// 일반 목록과 동일하게 써서 브라우저 라디오 그룹이 자동으로 하나만
// 남기도록 한다(Special에서 하나 고르면 위 일반 선택은 자동 해제되고,
// 반대로 일반 쪽에서 고르면 Special 선택도 자동 해제된다).
// 2026-08-04 운영 요청 — Special 카테고리별 "왜 효과가 있는가" 과학
// 설명(2~3줄). 쉬우면서 전문성이 느껴지는 문장으로, 6개 언어 번역은
// i18n/locales/*.json(music.specialInfo.*)에 있다.
function specialCategoryInfoText(key) {
  if (key === "Calm Circles For A Busy Brain-스트레스해소") {
    return t("music.specialInfo.stress", null, "60~80BPM의 느린 템포와 저주파 위주의 부드러운 사운드는 심박과 호흡이 리듬에 맞춰 함께 느려지는 '동조(entrainment)' 반응을 일으킵니다. 이때 자율신경의 균형이 교감신경에서 부교감신경 우위로 옮겨가면서 심박변이도(HRV)가 안정되고, 스트레스 호르몬 코르티솔이 감소하는 것이 임상 연구로 확인되어 있습니다.");
  }
  if (key === "sleep") {
    return t("music.specialInfo.sleep", null, "잠들 무렵 뇌파는 깨어 있을 때의 베타파(13~30Hz)에서 알파파(8~12Hz)를 거쳐 얕은 수면의 세타파(4~8Hz)로 내려갑니다. 안정 시 심박보다 느린 60BPM 안팎, 고음역(고주파 성분)을 덜어낸 반복 선율은 이 하강을 부드럽게 도와 입면 시간을 줄이고 수면의 질을 높이는 것으로 보고되어 있습니다.");
  }
  if (key === "명상") {
    return t("music.specialInfo.meditation", null, "일정하게 지속되는 소리는 주의가 흩어질 때 되돌아올 청각적 '닻'이 됩니다. 뇌파(EEG) 연구에서는 명상 중 이완된 집중과 관련된 알파파(8~12Hz)·세타파(4~8Hz)의 증가가 관찰되고, fMRI 연구는 잡념을 만들어내는 기본모드 네트워크(DMN)의 활동 저하를 보여줍니다. 단순한 화성과 느린 전개의 음악은 바로 이 상태로의 진입을 돕습니다.");
  }
  return "";
}

function renderMusicSpecialFilterOptions() {
  if (!musicSpecialOptionsEl) return;
  const options = buildMusicSpecialOptions();
  const current = loadMusicPlaylistFilter();
  musicSpecialOptionsEl.innerHTML = options.map((option) => {
    const checked = option.key === current ? " checked" : "";
    // 2026-08-04 — 항목 옆 정보(i) 버튼: 터치하면 아래로 과학 설명이
    // 펼쳐진다(한 번에 하나만, 다시 누르면 접힘). 키에 공백·한글이
    // 있어 data 속성에는 encodeURIComponent로 안전하게 싣는다.
    const info = specialCategoryInfoText(option.key);
    const infoId = encodeURIComponent(option.key);
    // 2026-08-07 — 한글 폴백을 템플릿 리터럴 밖으로 뺀다.
    // 안에 두면 audit-strings 가 이 조각 전체를 "번역 안 된 화면 문자열"로 잡아
    // verify:i18n 이 영구히 빨간불이 된다. 늘 실패하는 검사는 꺼진 검사다.
    const infoAria = t("music.specialInfoAria", null, "이 음악이 도움이 되는 이유");
    const infoBtn = info
      ? `<button type="button" class="special-info-btn" data-special-info-btn="${infoId}" aria-expanded="false" aria-label="${infoAria}">i</button>`
      : "";
    const infoText = info
      ? `<p class="special-info-text" data-special-info-text="${infoId}" hidden>${info}</p>`
      : "";
    return `<div class="special-option-block"><div class="special-option-row"><label class="field-option"><input type="radio" name="musicPlaylistFilter" value="${option.key}"${checked}><span>${option.label}</span></label>${infoBtn}</div>${infoText}</div>`;
  }).join("");
}

// 정보(i) 버튼 토글 — 컨테이너 위임 방식이라 innerHTML을 다시 그려도
// 리스너를 다시 걸 필요가 없다. 라디오 선택(change 버블링)과는 무관.
if (musicSpecialOptionsEl) {
  musicSpecialOptionsEl.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-special-info-btn]");
    if (!btn) return;
    event.preventDefault();
    const id = btn.getAttribute("data-special-info-btn");
    const text = musicSpecialOptionsEl.querySelector(`[data-special-info-text="${id}"]`);
    if (!text) return;
    const willOpen = text.hidden;
    musicSpecialOptionsEl.querySelectorAll("[data-special-info-text]").forEach((el) => { el.hidden = true; });
    musicSpecialOptionsEl.querySelectorAll("[data-special-info-btn]").forEach((el) => el.setAttribute("aria-expanded", "false"));
    text.hidden = !willOpen;
    btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });
}

// 2026-07-22 유저 요청 — 비주얼라이저 커스터마이징 옵션 7종의 "현재 선택됨"
// 표시를 실제 musicVizSettings 값과 맞춘다. HTML(index.html #musicVizOptions)은
// 이미 정적으로 존재하므로 여기선 innerHTML을 새로 만들지 않고 is-active
// 클래스만 토글한다 — 클릭 즉시 반응이 필요한 UI라 매번 DOM을 새로 그리는
// 것보다 가볍다.
function renderMusicVizSettingsUI() {
  if (!musicVizOptionsEl) return;
  musicVizOptionsEl.querySelectorAll("[data-viz-group]").forEach((row) => {
    const group = row.dataset.vizGroup;
    const current = musicVizSettings[group];
    row.querySelectorAll(".viz-chip").forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.vizValue === current);
    });
  });
}

// 옵션 하나가 바뀔 때 실제로 반영해야 할 후속 작업을 분기한다 — 색상/모양은
// 이미 그려진 막대에 즉시 다시 입히면 되고, 밀도는 막대 DOM 자체를 다시
// 만들어야 한다(rebuildMusicVizBars 참조). 베이스펀치/좌우배치/유휴 애니메이션은
// 매 프레임 musicVizSettings를 직접 참조하므로 별도 반영 코드가 필요 없다 —
// 값 저장만으로 다음 프레임부터 자동 적용된다.
// 2026-07-22 추가 — 감도는 예외: "예민"일 때 박스 자체의 height를 키워야
// 해서(아래 applyMusicVizSensitivityClass 참조) DOM 클래스 토글이 필요하다.
function setMusicVizOption(group, value) {
  if (!(group in MUSIC_VIZ_SETTINGS_DEFAULT) || musicVizSettings[group] === value) return;
  musicVizSettings[group] = value;
  markSettingsDirty();
  saveMusicVizSettings();
  if (group === "color") applyMusicVizColorToBars();
  else if (group === "shape") applyMusicVizShapeClass();
  else if (group === "density") rebuildMusicVizBars();
  else if (group === "sensitivity") applyMusicVizSensitivityClass();
  renderMusicVizSettingsUI();
}
if (musicVizOptionsEl) {
  musicVizOptionsEl.addEventListener("click", (event) => {
    const chip = event.target.closest(".viz-chip");
    if (!chip) return;
    const row = chip.closest("[data-viz-group]");
    if (!row) return;
    postToNativeHaptic("light");
    setMusicVizOption(row.dataset.vizGroup, chip.dataset.vizValue);
  });
}

// 2026-07-20 이슈 제보 — "설정에서 값을 선택하면 선택되는데 2초 정도
// 걸린다." 라디오 자체는 브라우저 네이티브 :checked라 탭 즉시 반영되지만,
// 재생 중일 때 이 함수가 곧바로 playTrackAtIndex(트랙 전환+네트워크 로드)
// 까지 같은 틱에서 처리하다 보니, 유저가 "선택됐다"는 확신을 얻는 시점이
// (구분이 옅은 카드 강조색만 보고 판단하기보다는) 실제 곡이 바뀌어
// 들리는 시점과 뒤섞여 "선택 자체가 느리다"고 느껴진 것으로 판단했다.
// 대응 두 가지: (1) 탭한 즉시 "OO 선택됨" 문구를 카드 바로 아래 인라인으로
// 띄워 트랙 전환 완료 여부와 무관하게 선택 자체를 명확히 확인시킨다.
// (2) 실제 트랙 전환(무거울 수 있는 부분)은 requestAnimationFrame으로 한
// 프레임 미뤄, 브라우저가 방금 찍힌 :checked 페인트를 확실히 먼저 그리고
// 나서 처리하도록 순서를 보장한다.
// 2026-07-21 유저 재점검("baseIndices가 빌 이유가 없는데?")으로 찾아낸 진짜
// 근본 원인. 음악이 "일시정지"(재생 전 포함) 상태에서 필터를 바꾸면, 아래
// else 분기는 renderMusicPlaylistInfo()만 부르고 실제 <audio>에 이미 실려
// 있던 트랙(앱을 켤 때 prefetchFirstTrack()이 미리 받아두었거나, 오늘
// 이어듣기로 복원된, 새 필터와 무관한 곡)은 그대로 방치했다. 그 상태에서
// 재생 버튼을 누르면 playMusic()은 "player.src가 이미 있으면 새로 고르지
// 않는다"는 최적화(초반 끊김 방지용) 때문에 이 필터-불일치 곡을 그대로
// 틀어버린다 — 이게 "ROCK을 선택했는데 명상 곡이 나온다"의 실제 트리거였다
// (직전에 고쳤던 baseIndices 폴백 문제와는 별개의, 더 근본적인 원인).
function preloadTrackForFilterChange() {
  if (!Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return;
  const player = activePlayer();
  if (!player) return;
  const standby = standbyPlayer();
  if (standby) {
    standby.pause();
    standby.removeAttribute("src");
    delete standby.dataset.pendingUrl;
  }
  crossfadeTriggered = false;
  pendingNextIndex = -1;
  pendingSecondIndex = -1; // 슬롯2 미러도 폐기
  if (player.dataset.blobUrl) {
    URL.revokeObjectURL(player.dataset.blobUrl);
    delete player.dataset.blobUrl;
  }
  delete player.dataset.pendingUrl;
  player._pendingLoad = null;
  musicIndex = pickNextTrackIndex();
  recordTrackHeard(musicIndex);
  recordPlayLog(musicIndex);
  renderMusicPlaylistInfo();
  renderMusicHistoryList();
  player._pendingLoad = loadMusicTrack(player, musicIndex, { prebuffer: true });
}

// 2026-07-21 유저 재제보 — "설정에서 버튼을 누르면 5초 정도 걸린다. 터치
// 반응은 바로 오고 뒷단 처리는 나중에 해달라." 코드를 다시 정독한 결과,
// 이 함수 자체(저장→토스트 표시)는 이미 동기로 즉시 실행되고, 무거운
// 트랙 전환(playTrackAtIndex/preloadTrackForFilterChange)은 이미
// requestAnimationFrame으로 한 프레임 미뤄져 있다 — 즉 "선택됨" 토스트와
// 라디오 체크(:checked→:has() CSS, 별도 JS 없이 즉시 반영)는 이론상으로도
// 이미 즉시 반응해야 한다. 그런데도 체감 지연이 남아있다는 재제보이므로,
// 두 가지를 추가한다: (1) 어떤 백엔드 지연이 있든 무관하게 "손가락이 닿는
// 순간" 그 자체에서 시각 반응이 나오도록 pointerdown 시점에 눌림 효과를
// 별도로 건다(아래 bindInstantTapFeedback, change 이벤트를 기다리지 않음).
// (2) 실제 어디서 시간이 소요되는지 다음에도 재현되면 Safari 원격 디버깅
// (맥 Safari > 개발자용 메뉴 > 아이폰 > 웹뷰)으로 바로 확인할 수 있도록
// 최소한의 타이밍 로그를 남긴다(성능에 영향 없는 console.log 수준).
// 2026-07-25 유저 요청 — 위쪽 플레이리스트(장르) 선택이 바뀌면 4개 제외
// 토글을 전부 0(미선택)으로 되돌린다. 예전 카테고리에서 골라둔 제외
// 설정이 다른 카테고리/전체 랜덤으로 넘어갈 때도 조용히 이어지는 걸
// 막기 위함 — 제외 토글은 항상 "지금 이 플레이리스트 기준으로 새로
// 정하는 것"이 되게 한다.
function resetMusicExcludeFilters() {
  MUSIC_EXCLUDABLE_CATEGORIES.forEach(({ storageKey }) => {
    saveMusicGenreToggle(storageKey, false);
  });
}

function applyMusicPlaylistFilter(newKey) {
  const __t0 = (window.__fzFilterTapT0 || performance.now());
  markSettingsDirty();
  saveMusicPlaylistFilter(newKey);
  categoryRotationQueue = [];
  resetMusicExcludeFilters();
  syncMusicExcludeFilterUi();
  flashMusicFilterNotice(`${musicPlaylistFilterAnnounceLabel(newKey)} 선택됨`);
  console.log(`[FZ-FILTER] tap→토스트 표시 ${(performance.now() - __t0).toFixed(0)}ms`);
  requestAnimationFrame(() => {
    console.log(`[FZ-FILTER] tap→rAF 진입 ${(performance.now() - __t0).toFixed(0)}ms`);
    if (musicPlaying) {
      playTrackAtIndex(pickNextTrackIndex());
    } else {
      // 일시정지 상태여도 필터에 맞는 곡을 곧바로 다시 골라 미리
      // 로드해둔다(재생은 시작하지 않음) — 위 preloadTrackForFilterChange
      // 주석 참조. 이걸 빼면 다음 재생 버튼 클릭 때 옛 필터의 곡이 나간다.
      preloadTrackForFilterChange();
    }
    console.log(`[FZ-FILTER] tap→트랙전환 동기 구간 완료 ${(performance.now() - __t0).toFixed(0)}ms`);
  });
}

let musicFilterNoticeTimer = null;
function flashMusicFilterNotice(text) {
  if (!musicFilterNoticeEl) return;
  clearTimeout(musicFilterNoticeTimer);
  musicFilterNoticeEl.textContent = text;
  musicFilterNoticeEl.classList.remove("is-visible");
  void musicFilterNoticeEl.offsetWidth; // 연속 선택 시 트랜지션 재트리거
  musicFilterNoticeEl.classList.add("is-visible");
  musicFilterNoticeTimer = setTimeout(() => {
    musicFilterNoticeEl.classList.remove("is-visible");
  }, 1600);
}

// 2026-07-16 유저 요청 — 플레이리스트로 선택된 장르 하나와 제외 필터가
// 서로 모순되는 조합(위 musicExcludeFilterContradicts 참조)이면, 그 제외
// 체크박스를 비활성화하고 화면에서도 체크 해제된 것처럼 보여준다. 저장된
// 실제 선호값(localStorage)은 건드리지 않으므로, 나중에 '전체'나 다른
// 장르로 돌아가면 원래 체크해뒀던 제외 설정이 그대로 복원된다.
function syncMusicExcludeFilterUi() {
  const filterKey = loadMusicPlaylistFilter();
  MUSIC_EXCLUDABLE_CATEGORIES.forEach(({ key, storageKey, elId }) => {
    const el = document.getElementById(elId);
    if (!el) return;
    const contradicts = musicExcludeFilterContradicts(key, filterKey);
    el.disabled = contradicts;
    el.checked = contradicts ? false : loadMusicGenreToggle(storageKey, false);
    const chip = el.closest(".exclude-chip");
    if (chip) chip.classList.toggle("is-disabled", contradicts);
  });
}

// Rock/Vocal 포함 체크박스를 바꾼 직후 — 플레이리스트 필터를 바꿀 때와 동일한
// 방식으로 즉시 반영한다(라운드로빈 순서 리셋 + 재생 중이면 바로 전환).
// 2026-07-25 이슈 제보 — 제외 토글 체크박스가 눌러도 3초 가까이 체크
// 표시가 안 뜨는 것처럼 보인다는 버그. 원인은 위 플레이리스트 라디오
// 버튼에서 2026-07-20에 이미 한 번 고쳤던 것과 동일하다(FZ-FILTER 로그
// 주석 참조) — playTrackAtIndex(트랙 전환, 크로스페이드 준비 등 무거운
// 동기 작업)를 change 이벤트와 같은 틱에서 바로 부르면, 체크박스 자체는
// 네이티브로 즉시 체크되지만 브라우저가 그 화면을 실제로 그릴 틈도 없이
// 이어서 무거운 작업이 메인 스레드를 막아버려 "체크 표시가 늦게 뜨는"
// 것처럼 보인다. requestAnimationFrame으로 한 프레임 미뤄서, 체크 표시가
// 먼저 그려지고 난 뒤에 트랙 전환이 시작되게 한다.
function applyMusicGenreToggle() {
  categoryRotationQueue = [];
  requestAnimationFrame(() => {
    if (musicPlaying) {
      playTrackAtIndex(pickNextTrackIndex());
    } else {
      renderMusicPlaylistInfo();
    }
  });
}

// 2026-07-08: "지금 재생 중" 표시만으로는 방금 지나간 곡을 다시 찾아 듣기
// 어렵다는 요청 — 실제로 재생 대상이 된 곡을 최신순으로 기록해두고, 음악
// 설정 패널에 목록으로 보여주며 곡마다 "바로 듣기" 버튼을 붙인다.
const musicPlayLogStorageKey = "ezlong:musicPlayLog";
const musicPlayLogMax = 30;

function loadMusicPlayLog() {
  try {
    const raw = JSON.parse(localStorage.getItem(musicPlayLogStorageKey) || "[]");
    return Array.isArray(raw) ? raw.filter((entry) => entry && typeof entry.file === "string") : [];
  } catch (error) {
    return [];
  }
}

function saveMusicPlayLog(log) {
  try {
    localStorage.setItem(musicPlayLogStorageKey, JSON.stringify(log));
  } catch (error) {
    // localStorage를 못 쓰는 환경이어도 재생 자체에는 지장이 없어야 한다.
  }
}

// 2026-07-16: "정각 세리모니" / "퇴근 세리모니" — 운영 요청("어려우면
// 리스크 감수하지 말고")에 맞춰 기존 오디오/재생 로직은 전혀 건드리지
// 않고, "새 곡이 실제로 시작된 순간"에만 훅을 거는 방식으로 구현한다.
// recordPlayLog(index)는 자동재생/스킵/크로스페이드전환/히스토리 바로듣기/
// 앱 재시작 복원 등 "새 트랙 시작" 경로 전부(위 grep으로 5곳 전체 확인)에서
// 정확히 1회씩만 호출되는 유일한 공통 지점이라, 여기 하나에만 걸어두면
// 모든 경로가 자동으로 커버된다 — 개별 호출부를 일일이 건드릴 필요가 없어
// 실수로 한 경로를 빠뜨릴 위험도 없다.
// 트리거는 어디까지나 "수동적"이다: 정각마다 강제로 곡을 바꾸지 않고,
// 그 순간 마침 새 곡이 시작됐을 때만 시계를 확인한다 — 재생 중이던 곡을
// 세리모니를 위해 억지로 끊는 일은 절대 없다(운영 요청 원문 "시작되는
// 음악이 있는 경우"에 정확히 맞춘 설계).
// 2026-07-16: 곡이 3분 안팎으로 길 수 있어 "정각+2분"은 너무 타이트하다는
// 재지적 — 실제 서비스 값을 2분 → 5분으로 넓혔다.
// 2026-07-16: 임시 테스트 확대(60분, 사실상 상시 발동)로 인해 "세리모니가
// 항상 켜져있다"는 재지적 발생 — 테스트 목적 달성 후 원래 값 5로 원복.
const MUSIC_HOURLY_CEREMONY_WINDOW_MIN = 5;

// 2026-07-20 이슈 제보 2건 대응:
// (1) "정각+5분 창 안에 곡이 2번 바뀌면 세리모니가 2번 뜬다" — 원래
//     handleMusicCeremonyOnTrackStart는 "그 순간 시계"만 보고 매번 새로
//     판정했다. 짧은 곡이 연달아 나오면(예: 정각+1분에 한 곡 끝나고 정각+3분에
//     다음 곡 시작) 둘 다 "아직 5분 안"이라 똑같이 트리거됐던 것 — 원인
//     확인. lastCeremonyHourKey로 "이 시간대(연/월/일/시)엔 이미 한 번
//     띄웠다"를 기억해서, 같은 시간대 안에서는 두 번째 트랙 전환부터는
//     건너뛴다.
// (2) "6시·7시에 곡이 재생 중인데도 퇴근 세리모니가 안 뜬 것 같다" — 기존
//     설계는 "정각+5분 사이에 마침 새 곡이 시작되는 경우"에만 수동적으로
//     발동해서, 그 좁은 창 안에 우연히 곡 전환이 없으면(곡 길이가 3~4분대라
//     실제로 이 확률이 낮다) 그 시간대는 그냥 조용히 넘어갔다 — 버그라기보다
//     "우연에 의존하는 설계"의 한계였다. 이제 tick()(매초 실행) 안에서도
//     checkHourlyCeremonyTick()으로 같은 조건을 확인해서, 곡이 재생 중이기만
//     하면(트랙이 마침 그 순간 시작됐는지와 무관하게) 정각+5분 창에 진입하는
//     순간 자동으로 세리모니를 띄운다 — "재생 중이던 곡을 억지로 끊지 않는다"
//     는 원래 제약은 그대로 지킨다(트랙 전환을 일으키지 않고 오버레이만
//     얹는다). 두 경로(트랙 시작 훅 / 매초 틱) 모두 같은 lastCeremonyHourKey
//     가드를 공유하므로 (1)의 중복 방지도 자동으로 함께 적용된다.
let lastCeremonyHourKey = null;
function ceremonyHourKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
}

// 2026-07-16: reshuffleMusicOrder()가 유발한 트랙 전환 1회만 세리모니
// 판정에서 제외하기 위한 1회성 플래그(아래 handleMusicCeremonyOnTrackStart
// 참조). 셔플 버튼처럼 "사용자가 명시적으로 누른 행위"로 인한 전환은
// "마침 정각에 새 곡이 시작된 우연"이 아니므로 세리모니를 띄우면 안 된다.
let suppressCeremonyOnNextTrackStart = false;

// 비주얼라이저가 패널 박스를 뚫고 위(플립시계 쪽)로 솟구치는 연출.
// 2026-07-16 2차: 10초 고정 타이머는 "너무 짧다"는 재지적으로 완전히
// 제거했다 — 이제 "Leave Work" 문구와 똑같은 생명주기를 쓴다. 즉 그 곡이
// 끝날 때(=다음 곡의 recordPlayLog가 hideMusicHourlyCeremony를 호출할 때)
// 까지 계속 유지되고, 다음 곡이 시작되면 그 곡이 조건에 다시 해당하는지를
// 새로 판단한다. 실제 막대 높이 계산(drawMusicViz 등 오디오 반응 로직)은
// 전혀 건드리지 않고, 이미 그려진 막대 각각을 CSS transform:scaleY로
// 시각적으로만 부풀린다 — 오디오/캔버스 쪽 회귀 위험이 없는 순수 CSS
// 오버레이 효과.
function triggerMusicHourlyCeremony() {
  if (musicInfoPanel) musicInfoPanel.classList.add("ceremony-breakout");
}

function hideMusicHourlyCeremony() {
  if (musicInfoPanel) musicInfoPanel.classList.remove("ceremony-breakout");
}

function showLeaveWorkCeremony() {
  if (musicLeaveWorkEl) musicLeaveWorkEl.classList.add("is-visible");
}

function hideLeaveWorkCeremony() {
  if (musicLeaveWorkEl) musicLeaveWorkEl.classList.remove("is-visible");
}

// recordPlayLog(index)가 호출될 때마다(= 새 곡이 막 시작될 때마다) 실행.
// 2026-07-21 이슈 제보("9시1분에 시작한 곡인데 정각 세리모니가 안 떴다")로
// 발견된 버그 수정: 예전엔 이 함수 맨 위에서 무조건 hideMusicHourlyCeremony()를
// 불러 이전 세리모니를 껐다. checkHourlyCeremonyTick()(매초 실행)이 이미 그
// 시간대의 세리모니를 "먼저" 띄워둔 상태(예: 정각에 마침 재생 중이던, 유저가
// 못 본 곡에 얹힌 경우)라면, 그 직후 새 곡이 시작될 때 이 함수가 무조건
// 꺼버리고 lastCeremonyHourKey가 이미 이 시간대로 채워져 있어(중복 방지 로직)
// 다시 켜지도 않았다 — 결과적으로 유저가 실제로 알아챈 그 곡(9시1분 곡)에는
// 세리모니가 한 번도 안 뜬 것처럼 보였다. 이제 "이미 이 시간대에 띄운 적
// 있으면 끄지 않고 그대로 둔다"로 바꿔서, tick과 트랙전환 중 무엇이 먼저
// 트리거했든 상관없이 그 시간대 안에서는 계속 떠 있게 한다 — "시간당 1번"
// 이라는 기존 중복 방지 원칙은 그대로 유지된다.
function handleMusicCeremonyOnTrackStart() {
  hideLeaveWorkCeremony();
  if (suppressCeremonyOnNextTrackStart) {
    // 셔플 버튼이 유발한 전환 — 이번 1회만 건너뛰고 플래그를 바로 리셋한다.
    suppressCeremonyOnNextTrackStart = false;
    hideMusicHourlyCeremony();
    return;
  }
  const now = new Date();
  if (now.getMinutes() >= MUSIC_HOURLY_CEREMONY_WINDOW_MIN) {
    hideMusicHourlyCeremony(); // 정각+5분 지났으면 세리모니 없음
    return;
  }
  // 2026-07-20: 같은 시간대(연/월/일/시)에 이미 한 번 띄웠으면 두 번째
  // 트랙 전환부터는 새로 트리거하지 않는다 — "곡 2개가 연달아 튀는" 중복
  // 방지. 단 2026-07-21부터는 끄지도 않는다(위 설명 참조) — 이미 떠 있는
  // 세리모니를 이번 트랙에도 그대로 이어서 보여준다.
  const hourKey = ceremonyHourKey(now);
  if (hourKey === lastCeremonyHourKey) return;
  lastCeremonyHourKey = hourKey;
  triggerMusicHourlyCeremony();
  // "퇴근 세리모니": 18시대 또는 19시대에 정각 세리모니 조건까지 겹치면
  // 추가로 텍스트 표시 — 이 곡이 끝날 때까지 유지된다.
  // 2026-07-16: 하루 2번(18시·19시)으로 확대 — "6시에 퇴근 못하는 사람도
  // 7시엔 퇴근하라"는 운영 요청.
  if (now.getHours() === 18 || now.getHours() === 19) showLeaveWorkCeremony();
}

// 2026-07-20: tick()(매초)에서 호출 — "정각+5분 창에 마침 새 곡이 시작되는
// 우연"에 기대지 않고, 곡이 재생 중이기만 하면 이 창에 진입하는 순간
// 자동으로 세리모니를 띄운다. 트랙 전환을 일으키지 않으므로(재생 중인
// 곡은 그대로 유지) "재생 중이던 곡을 억지로 끊지 않는다"는 기존 설계
// 제약을 그대로 지킨다. handleMusicCeremonyOnTrackStart와 lastCeremonyHourKey
// 가드를 공유해서 두 경로가 같은 시간대에 중복으로 띄우지 않는다.
function checkHourlyCeremonyTick(now) {
  if (!musicPlaying) return; // 재생 중이 아니면 대상 아님
  if (now.getMinutes() >= MUSIC_HOURLY_CEREMONY_WINDOW_MIN) return;
  const hourKey = ceremonyHourKey(now);
  if (hourKey === lastCeremonyHourKey) return;
  lastCeremonyHourKey = hourKey;
  triggerMusicHourlyCeremony();
  if (now.getHours() === 18 || now.getHours() === 19) showLeaveWorkCeremony();
}

// 2026-07-22 1차: "비주얼라이저가 정각에 솟구치는" 연출을 곡 생명주기 대신
// 시계 1분 창(정각~정각+1분)에 묶어 재설계했었으나, 같은 날 밤 유저
// 재지적("과도하게 위로 솟구치는 것은 괴기하다, 안 이쁘다 — 그럼 포기")으로
// 완전히 폐기한다. 이 함수는 이제 그 재설계 로직을 실행하는 대신 매초
// "ceremony-breakout" 클래스를 무조건 제거만 한다 — triggerMusicHourlyCeremony()
// (handleMusicCeremonyOnTrackStart/checkHourlyCeremonyTick가 호출, "퇴근
// 세리모니" 문구와 생명주기를 공유하므로 그대로 둠)가 여전히 그 클래스를
// 걸려고 시도해도, tick()에서 이 함수가 그 다음에 매초 호출되어 항상
// 강제로 꺼버리므로 실질적으로 완전 무력화된다 — 저 함수들 자체를 건드리지
// 않는 최소 변경(surgical) 방식.
function enforceVisualizerCeremonyWindow(now) {
  if (!musicInfoPanel) return;
  musicInfoPanel.classList.remove("ceremony-breakout");
}

// 2026-07-22 1차: "진정한 정각 세리모니" — 음악 재생 여부와 무관하게
// 정각~정각+1분 사이엔 플립시계 숫자판 4개 위에 마법가루를 뿌리고, 시계
// 전체가 까불까불 흔들리는 연출(hour-ceremony 클래스 + styles.css
// flipClockWiggle)을 함께 추가했었으나, 같은 날 밤 유저 재지적("움직이는
// 것도 이상하다, 과하다, 하지 말자")으로 흔들림만 완전히 제거했다. 마법
// 가루 반짝임만 세리모니로 유지 — 판정 로직(정각~정각+1분)과 트리거/해제
// 타이밍은 이전과 동일하되, "was active" 판단 기준을 (제거된) flipClockEl의
// hour-ceremony 클래스 대신 flipClockSparkleEl의 is-active 클래스로 옮겼다.
function checkFlipClockHourlyCeremony(now) {
  if (!flipClockEl) return;
  const active = now.getMinutes() === 0;
  const wasActive = Boolean(flipClockSparkleEl && flipClockSparkleEl.classList.contains("is-active"));
  if (active && !wasActive) {
    buildFlipClockSparkleParticles();
    if (flipClockSparkleEl) flipClockSparkleEl.classList.add("is-active");
  } else if (!active && wasActive) {
    if (flipClockSparkleEl) {
      flipClockSparkleEl.classList.remove("is-active");
      flipClockSparkleEl.innerHTML = "";
    }
  }
}

// 정각 1분 동안 플립시계 위에서 반짝일 마법가루 입자를 새로 만든다. 날짜칩
// 반짝임(sparkleDateChip)과 달리 "한 번 반짝 튀고 사라지는" 연출이 아니라
// 60초 내내 은은하게 계속 반짝여야 해서, 각 입자는 무한 반복(infinite)
// 트윙클 애니메이션을 쓰고 음수 delay로 시작 타이밍을 흩어둔다(styles.css
// flipSparkTwinkle 참조) — 그래야 60개가 동시에 딱 맞춰 반짝이는 부자연스러운
// 느낌 없이 제각각 반짝인다.
function buildFlipClockSparkleParticles() {
  if (!flipClockSparkleEl) return;
  const SPARK_COUNT = 26;
  let html = "";
  for (let i = 0; i < SPARK_COUNT; i += 1) {
    const sx = (Math.random() * 100).toFixed(1);
    const sy = (Math.random() * 100).toFixed(1);
    const size = (3 + Math.random() * 3).toFixed(1);
    const dur = (1.3 + Math.random() * 1.1).toFixed(2);
    const delay = (-(Math.random() * 2.4)).toFixed(2);
    html += `<span class="spark" style="--sx:${sx}%;--sy:${sy}%;--ssize:${size}px;--sdur:${dur}s;--sdelay:${delay}s;"></span>`;
  }
  flipClockSparkleEl.innerHTML = html;
}

// 같은 곡을 다시 들으면 중복으로 쌓지 않고 맨 위로 올린다(흔한 "최근 재생" UX 관례).
function recordPlayLog(index) {
  if (!Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return;
  const track = musicPlaylist[index % musicPlaylist.length];
  if (!track || !track.file) return;
  let log = loadMusicPlayLog().filter((entry) => entry.file !== track.file);
  // 2026-07-22 유저 요청: "들은 음악" 목록에서 이 곡이 어느 플레이리스트
  // (카테고리)에 속했는지 보이게 해달라 — trackCategoryKey로 캐노니컬
  // 키를 구해 저장해두고, 렌더 시 musicCategoryLabel로 사람이 읽을 라벨로
  // 바꾼다. 이 필드가 없는 과거 기록(이 수정 이전에 쌓인 localStorage
  // 데이터)은 렌더 쪽에서 빈 문자열로 안전하게 처리한다.
  log.unshift({ file: track.file, title: track.title || track.file, playlist: track.playlist || "", category: trackCategoryKey(track), at: Date.now() });
  if (log.length > musicPlayLogMax) log = log.slice(0, musicPlayLogMax);
  saveMusicPlayLog(log);
  handleMusicCeremonyOnTrackStart();
}

// 2026-07-19 리디자인: 표(<tr>/<td>) 구조를 버리고 카드형 2줄 구조로
// 바꿨다 — 1줄: 곡제목(줄바꿈 허용, 말줄임표 없이 전부 표시), 2줄: 재생/
// 좋아요/싫어요 버튼을 우측 정렬로 배치. 또한 기본은 최근 5개만 보여주고
// "모두 보기" 버튼으로 전체 목록을 펼칠 수 있게 했다(musicHistoryExpanded).
function renderMusicHistoryList() {
  const target = musicHistoryBody || musicHistoryList;
  if (!target) return;
  const log = loadMusicPlayLog();
  if (log.length === 0) {
    target.innerHTML = `<div class="settings-desc settings-desc-muted">${t("settings.music.historyEmpty", null, "아직 재생 기록이 없습니다.")}</div>`;
    if (musicHistoryViewAll) musicHistoryViewAll.hidden = true;
    return;
  }
  const currentTrack = Array.isArray(musicPlaylist) && musicPlaylist.length > 0
    ? musicPlaylist[musicIndex % musicPlaylist.length]
    : null;
  // 2026-07-15: 히스토리 목록에서도 좋아요/싫어요 상태를 보고 바로 고칠 수
  // 있게 신설 — 매 렌더마다 현재 좋아요/싫어요 목록을 한 번만 불러와
  // Set으로 만들어 행마다 반복 조회 비용을 줄인다.
  const likedSet = new Set(loadLikedTracks());
  const dislikedSet = new Set(loadDislikedTracks());
  const HISTORY_COLLAPSED_COUNT = 5;
  const visibleLog = musicHistoryExpanded ? log : log.slice(0, HISTORY_COLLAPSED_COUNT);
  target.innerHTML = visibleLog.map((entry) => {
    const isCurrent = Boolean(currentTrack && currentTrack.file === entry.file);
    const variant = formatPlaylistVariant(entry.playlist);
    const isPlayingNow = isCurrent && musicPlaying;
    const ariaLabel = isPlayingNow
      ? t("music.nowPlaying", null, "지금 재생 중")
      : t("music.playAction", null, "재생");
    const isLiked = Boolean(entry.file && likedSet.has(entry.file));
    const isDisliked = Boolean(entry.file && dislikedSet.has(entry.file));
    // 2026-07-22: 곡 제목 아래에 이 곡이 속한 플레이리스트(카테고리)명을
    // "- 라벨" 형태로 표기. entry.category가 없는 과거 기록(이 수정 전
    // localStorage에 이미 쌓여있던 항목)은 라벨 줄 자체를 만들지 않는다.
    const playlistLabel = entry.category ? musicCategoryLabel(entry.category) : "";
    const playlistLabelHtml = playlistLabel
      ? `<span class="music-history-playlist-label">- ${playlistLabel}</span>`
      : "";
    return `<div class="music-history-item${isCurrent ? " is-current" : ""}">`
      + `<div class="music-history-title-row"><span class="music-history-title">${entry.title}${variant}</span>${playlistLabelHtml}</div>`
      + `<div class="music-history-actions-row">`
        + `<button type="button" class="music-history-play-btn${isPlayingNow ? " is-playing" : ""}" data-history-file="${entry.file}" aria-label="${ariaLabel}"></button>`
        + `<button type="button" class="music-history-like-btn" data-history-like="${entry.file}" aria-pressed="${isLiked}" aria-label="이 곡 좋아요"></button>`
        + `<button type="button" class="music-history-dislike-btn" data-history-dislike="${entry.file}" aria-pressed="${isDisliked}" aria-label="이 곡 싫어요"></button>`
      + `</div>`
      + `</div>`;
  }).join("");
  if (musicHistoryViewAll) {
    if (log.length > HISTORY_COLLAPSED_COUNT) {
      musicHistoryViewAll.hidden = false;
      // 2026-07-18 5차 피드백: "펼치기"인데 ">"(다음/이동 느낌)를 쓰는 게
      // 어색하다는 지적 — 아래로 펼쳐지는 동작에 맞게 "▾"(아래 방향), 접을
      // 때는 반대로 "▴"(위 방향)로 바꾼다.
      musicHistoryViewAll.textContent = musicHistoryExpanded
        ? t("common.collapse", null, "접기 ▴")
        : t("common.showAll", { count: log.length }, `모두 보기 (${log.length}) ▾`);
    } else {
      musicHistoryViewAll.hidden = true;
    }
  }
}

// 히스토리 목록의 "바로 듣기" 버튼 — 스킵 버튼과 같은 방식(크로스페이드 없이
// 즉시 전환)으로 유저가 지정한 곡으로 바로 바꾼다. playNextTrack과 전환
// 로직은 같고, 다음 곡을 무작위로 고르는 대신 지정된 파일을 찾아 튼다는
// 점만 다르다 — 기존 playNextTrack은 그대로 두고 별도 함수로 추가해서
// (현재 실기기 검증 대기 중인) 기존 재생 전환 로직에 영향을 주지 않는다.
// 2026-07-12: 원래 playTrackFromHistory(file) 하나뿐이었는데, 플레이리스트
// (장르) 필터를 바꿨을 때도 같은 "즉시 전환" 동작이 필요해져서 인덱스 기반
// 공통 로직을 playTrackAtIndex로 분리했다. 동작은 기존과 완전히 동일하다 —
// playTrackFromHistory는 파일명으로 인덱스만 찾아 그대로 위임한다.
// 2026-07-18 5차 피드백: 히스토리에서 "다른" 곡(현재 재생곡이 아닌)의
// 재생 버튼을 누르면 recordPlayLog가 그 곡을 목록 맨 위로 재정렬해버려서
// "위치가 실시간으로 바뀌어 헷갈린다"는 지적을 받았다. options.skipPlayLog로
// 이 경로에서만 recordPlayLog(재정렬+세리모니 판정)를 건너뛰고, 그 자리에서
// 곡만 바꿔 재생한다 — recordTrackHeard(반복 방지용 "들었음" 표시)는
// 그대로 유지해 다른 재생 로직에 영향을 주지 않는다.
function playTrackAtIndex(index, options) {
  if (!Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return;
  if (index < 0 || index >= musicPlaylist.length) return;
  const skipPlayLog = Boolean(options && options.skipPlayLog);
  musicActionToken += 1; // 진행 중이던 이전 재생 시도(있었다면)를 무효화한다.
  crossfadeTriggered = false;
  pendingNextIndex = -1;
  pendingSecondIndex = -1; // 수동 재생 — 슬롯2 미러도 폐기
  const standby = standbyPlayer();
  if (standby) {
    standby.pause();
    standby.removeAttribute("src");
    delete standby.dataset.pendingUrl;
  }
  const player = activePlayer();
  musicIndex = index;
  recordTrackHeard(musicIndex);
  if (!skipPlayLog) recordPlayLog(musicIndex);
  renderMusicPlaylistInfo();
  resetActiveWatchState();
  if (musicToggle) musicToggle.style.setProperty("--progress", "0");
  if (player.dataset.blobUrl) {
    URL.revokeObjectURL(player.dataset.blobUrl);
    delete player.dataset.blobUrl;
  }
  delete player.dataset.pendingUrl;
  player._pendingLoad = null;
  loadMusicTrack(player, musicIndex, { prebuffer: false });
  musicPlaying = true;
  // 2026-07-15: 네이티브 모드에서는 이 <audio>를 절대 실제로 play()하지
  // 않는다(파일 상단 nativeClockTimerId 관련 주석 참조) — 대신 가상시계를
  // 시작한다. 진짜 소리는 renderMusicPlaylistInfo() 안의 syncNativeTrackInfo가
  // 네이티브 AVPlayer에 전달한다.
  if (isNativeWrapper) {
    startNativeVirtualClock();
  } else {
    player.play().catch(() => {});
  }
  renderMusicToggle();
}

function playTrackFromHistory(file) {
  if (!Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return;
  const index = musicPlaylist.findIndex((track) => track && track.file === file);
  if (index < 0) return;
  playTrackAtIndex(index, { skipPlayLog: true });
}

// 2026-07-13: 히스토리 목록의 재생 버튼이 "지금 재생 중인 곡"을 다시 누르면
// 무조건 playTrackAtIndex(트랙 재로드 + 목록 맨 위로 재정렬)를 호출해버려서,
// 유저가 일시정지하려고 눌러도 곡이 처음부터 다시 로드되며 잠깐 끊겼다가
// 그대로 계속 재생되는 증상이 있었다(재정렬도 불필요하게 같이 일어남).
// 지금 재생 중인 곡이면 메인 재생/일시정지 버튼과 동일한 toggleMusic()을
// 그대로 재사용한다 — 이미 실기기에서 검증된 pause/resume 경로라 트랙을
// 다시 로드하지 않고 그 자리에서 멈추고/이어서 재생되며, recordPlayLog를
// 거치지 않으므로 목록 순서도 그대로 유지된다. 아직 재생된 적 없는 다른
// 곡을 누르는 경우에만 기존처럼 새로 재생을 시작한다(이때는 "최근 재생"
// 관례대로 맨 위로 오는 게 맞다).
function toggleTrackFromHistory(file) {
  if (!Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return;
  const currentTrack = musicPlaylist[musicIndex % musicPlaylist.length];
  const isCurrent = Boolean(currentTrack && currentTrack.file === file);
  if (isCurrent) {
    toggleMusic();
    return;
  }
  playTrackFromHistory(file);
}

// 2026-07-15: 히스토리 목록의 좋아요/싫어요 버튼 — 메인 패널 버튼과 같은
// 저장 로직(loadLikedTracks/saveLikedTracks, loadDislikedTracks/
// saveDislikedTracks)을 그대로 재사용하되, "이미 눌려있으면 취소, 아니면
// 적용"하는 순수 토글로 만든다("한번 더 누르면 취소, 또 누르면 다시
// 싫어요(토글)" 요청 반영). 재생 중인 곡이 아니라 목록의 임의의 과거
// 트랙에 적용하는 것이므로, 메인 패널의 싫어요 버튼과 달리 playNextTrack()/
// 토스트는 호출하지 않는다 — 재생 중인 곡을 건드리는 게 아니라면 굳이
// 재생을 끊을 이유가 없다.
function toggleLikeFromHistory(file) {
  if (!file) return;
  const liked = loadLikedTracks();
  const idx = liked.indexOf(file);
  if (idx >= 0) liked.splice(idx, 1);
  else liked.push(file);
  saveLikedTracks(liked);
  renderMusicReactionButtons();
  renderMusicHistoryList();
}

function toggleDislikeFromHistory(file) {
  if (!file) return;
  const disliked = loadDislikedTracks();
  const idx = disliked.indexOf(file);
  if (idx >= 0) disliked.splice(idx, 1);
  else disliked.push(file);
  saveDislikedTracks(disliked);
  renderMusicReactionButtons();
  renderMusicHistoryList();
}

if (musicHistoryList) {
  musicHistoryList.addEventListener("click", (event) => {
    const likeBtn = event.target.closest("[data-history-like]");
    if (likeBtn) {
      toggleLikeFromHistory(likeBtn.dataset.historyLike);
      return;
    }
    const dislikeBtn = event.target.closest("[data-history-dislike]");
    if (dislikeBtn) {
      toggleDislikeFromHistory(dislikeBtn.dataset.historyDislike);
      return;
    }
    const button = event.target.closest("[data-history-file]");
    if (!button) return;
    toggleTrackFromHistory(button.dataset.historyFile);
  });
}

// 2026-07-19: "모두 보기 / 접기" 토글 — 클릭할 때마다 상태만 뒤집고
// 렌더 함수 하나(renderMusicHistoryList)가 목록·버튼 라벨을 함께 갱신한다.
if (musicHistoryViewAll) {
  musicHistoryViewAll.addEventListener("click", () => {
    postToNativeHaptic("light");
    musicHistoryExpanded = !musicHistoryExpanded;
    renderMusicHistoryList();
  });
}

// 2026-07-22: 투자서/문학·교양서 세부 3개 apply 함수(applyCategorySelection/
// applyLitCategorySelection/applyGenreSelection)를 평평한 단일 목록용
// 하나로 통합 — 체크 즉시 미리보기(resetQuoteWindow)만 하고, 저장은
// 기존 관례대로 "확인"(settingsSave) 클릭 시에만 한다.
function applyFlatGenreSelection() {
  selectedFlatGenres = new Set(
    [...document.querySelectorAll("[data-flat-genre-option]:checked")].map((input) => input.value)
  );
  if (allFlatGenresEl) allFlatGenresEl.checked = selectedFlatGenres.size === 0;
  markSettingsDirty();
  resetQuoteWindow();
}

function rotateQuote(now = new Date()) {
  const minuteKey = Math.floor(now.getTime() / 60000);
  if (minuteKey === activeQuoteMinute) return;
  // 2026-07-20 유저 요청: 문장 4개 미리로드 창 도입 — 최초 1회(부팅 직후)는
  // 창의 0번(첫 문장)을 그대로 보여주고, 그 이후 매분마다 창을 한 칸씩
  // 자동으로 전진시킨다(4번째까지 다 보여주면 advanceQuoteAuto가 새 4개로
  // 자동 리필). "문장은 1분에 하나씩 밀려나게" 요청 그대로 자동 전환
  // 주기는 그대로 1분이다.
  // 2026-07-21: 여기서 selectQuoteIndex 대신 advanceQuoteAuto를 쓰는 게
  // 핵심 — 자동 전진만 4개를 다 돈 뒤 새로 리필하고, 유저가 손으로 하는
  // 스와이프/점탭(selectQuoteIndex)은 이제 절대 새로 리필하지 않는다.
  const isFirstRun = activeQuoteMinute === "";
  activeQuoteMinute = minuteKey;
  if (isFirstRun) {
    ensureQuoteWindow();
    renderQuote(quoteWindow[activeQuoteIndex]);
  } else {
    advanceQuoteAuto();
  }
}

function tick() {
  const now = new Date();
  renderTime(now);
  // 2026-08-04 2차 — 배경 자동전환(4분마다 1장, 4장 돌면 새 세트).
  // 위 photoAutoRotateTick 주석 참조 — 시계 루프에 얹어 확실하게.
  // 2026-08-04 3차 — 예전엔 여기서 무조건 타이머를 리셋한 뒤 회전을
  // 시도했다. 그런데 화면이 꺼져 있거나 수동 스와이프 잠금 중이면
  // photoAutoRotateTick()은 아무것도 하지 않고 돌아온다 — 그 사이
  // 4분이 지날 때마다 '회전 기회'만 조용히 버려졌다. 폰을 켜서 보면
  // 카운터가 방금 리셋된 상태라 또 4분을 기다려야 하니, 짧게 보고 끄는
  // 사용자는 전환을 영영 못 본다. 실제로 회전이 일어난 경우에만 소모한다.
  if (typeof lastPhotoRotateAt === "number" && Date.now() - lastPhotoRotateAt >= PHOTO_AUTO_ROTATE_MS) {
    if (photoAutoRotateTick()) lastPhotoRotateAt = Date.now();
  }
  rotateQuote(now);
  // 2026-07-20: 정각 세리모니/퇴근 세리모니가 트랙 전환 우연에만 기대지
  // 않도록 매초 별도로도 확인한다(handleMusicCeremonyOnTrackStart 위
  // 주석 참조).
  checkHourlyCeremonyTick(now);
  // 2026-07-22: 비주얼라이저 정각 세리모니를 "곡 재생시간 내내"가 아니라
  // "정각~정각+1분" 벽시계 창으로 강제한다 + 플립시계 마법가루/흔들림도
  // 같은 창으로 켠다(둘 다 위 주석 참조).
  enforceVisualizerCeremonyWindow(now);
  checkFlipClockHourlyCeremony(now);
}

dots.forEach((dot) => {
  dot.addEventListener("click", () => {
    const index = [...dots].indexOf(dot);
    selectPhotoIndex(index);
    selectQuoteIndex(index);
  });
});

// 2026-07-17 8차 개정(근본 재설계): 페이지 전환을 네이티브 scroll-snap
// 대신 #pageTrack의 transform으로 직접 구동한다. currentPageIndex와
// goToPage()가 유일한 페이지 전환 경로다 — 문서 자체는 styles.css에서
// 영구적으로 overflow:hidden이라 "스크롤해서 넘어가는" 개념이 없고, 오직
// 스와이프 제스처 감지(아래) 또는 명시적 탭(appBrand/뒤로가기 버튼/설정·
// 날씨상세 열기버튼)으로만 페이지가 바뀐다. 모달 시트 내부 스크롤과는
// 이벤트 계통이 완전히 분리되므로(하나는 overflow:auto 진짜 스크롤, 하나는
// 이 JS 스와이프+transform), 7번의 실패를 낳았던 "시트 스크롤이 페이지
// 전환으로 새는" 문제가 구조적으로 성립하지 않는다.
//
// 2026-07-17 10차: 설정(#quoteSettings)·날씨 상세(#weatherDetailPanel)를
// position:fixed 팝업에서 #pageTrack 안의 진짜 페이지(인덱스 2/3)로
// 전환하면서, 0/1 두 페이지만 다루던 하드코딩을 걷어내고 #pageTrack의
// 실제 자식 개수만큼 일반화한다. DOM 순서 = 0:.sky-room, 1:.ezlong-webview,
// 2:#quoteSettings, 3:#weatherDetailPanel (index.html #pageTrack 참조).
let currentPageIndex = 0;
// 2026-07-20 16차(페이지2 스크롤 근본 수술): 트랙 슬라이드(pageOffset/
// pageTrack.transform) 메커니즘 폐기. 실기기 자가보고 진단(page-diag.js)으로
// "ezlong 섹션이 body 직속 + transform 없는 상태여야만 iframe 내부 스크롤이
// 산다"가 확정됐다(경위는 index.html 16차 주석). 그래서 ezlong 섹션은 로드
// 순간부터 body 직속 fixed(z-index:1)에 정착해 영원히 움직이지 않고, 페이지
// 전환은 시계(.clock-app z-index:2)가 .ezlong-open 클래스로 translateY(-100%)
// 비켜주는 방식으로 역전했다. goToPage(index) 시그니처는 기존 호출부(스와이프/
// 뒤로가기 버튼/브랜드 탭 플립) 호환을 위해 유지한다 — index>=1이면 열림.
// 2026-07-20 16차-b(최종 확정): 정적 body 직속 배치만으로는 부족했다 —
// iPhone 미러링으로 Fable이 직접 실기기 계측한 결과, 기준선(정적 배치)에선
// 휠 25틱에도 0px, 진단 3단계(런타임 appendChild 재부착) 후에는 동일 입력에
// 정상 스크롤. 즉 iframe도 설정 패널(15차-c)과 동일하게 iOS 26.5에서는
// "재부착으로 새로 생성된 렌더 노드"여야만 네이티브 스크롤 영역이 등록된다.
// 그래서 첫 열림 때 1회 재부착하고, iframe은 data-src로 비워뒀다가 재부착
// "후"에 src를 주입한다(진단 3단계의 성공 순서 그대로: 재부착 → 로드).
// 재로드 비용 0(어차피 첫 로드), 앱 시작 시 ezlong 선로딩도 없어져 부팅이
// 가벼워지는 부수효과. 이 재부착·주입 코드는 제거 금지.
// 16차-c(추가 실측): t=0(시계가 아직 덮고 있는 시점) 재부착은 실패했다 —
// Fable 미러링 재계측 결과, 섹션이 "노출된 상태"에서 재부착해야만 등록된다
// (진단 3단계의 성공 조건에는 "노출"까지 포함돼 있었던 것). 그래서 첫 열림
// 때 시계 전환(500ms)이 끝나 섹션이 화면에 드러난 "후"(620ms)에 재부착하고,
// iframe 로드는 그보다도 뒤에 시작시킨다. 이 지연·순서는 전부 실측 근거 —
// 임의로 줄이거나 t=0으로 되돌리지 말 것.
// 16차-d(최종 실측): 노출 후 재부착(16차-c)만으로도 부족했다 — 성공했던 진단
// 3단계와의 마지막 차이는 z-순서였다. 진단에선 섹션이 z40(시계보다 위)이었고,
// 실패한 정적 구조에선 z1(시계 아래)이었다. iOS 26.5의 네이티브 히트테스트가
// transform으로 비켜난 시계(.clock-app)를 여전히 "화면을 덮은 상태"로 취급해
// 제스처를 시계(overflow:hidden — 제스처 소멸 지점)에 넘겨버리는 것으로 추정.
// 그래서 열림이 완료되는 시점(620ms)에 섹션 z를 40으로 올리고 시계를
// visibility:hidden으로 완전히 치우며, 첫 열림이면 그 상태에서 재부착+로드까지
// 한다(진단 3단계 성공 조건의 완전 재현). 닫을 때는 t=0에 즉시 원복해 슬라이드
// 복귀 애니메이션을 유지한다. 전부 실측 근거 — 임의 변경 금지.
let ezlongInitialized = false;
let ezlongSettleTimer = null;
function settleEzlongOpen() {
  if (!ezlongSection) return;
  if (!ezlongInitialized) {
    ezlongInitialized = true;
    document.body.appendChild(ezlongSection); // 노출+z40 상태에서 재부착
    const fr = ezlongSection.querySelector(".ezlong-frame");
    if (fr && !fr.getAttribute("src")) {
      // 2026-07-28: index.html 의 data-src 는 한국어 기본값일 뿐이고,
      // 실제 주소는 ezlongSiteUrl() 이 로케일별로 정한다. data-src 는
      // 스크립트가 통째로 실패했을 때의 최후 폴백으로만 남겨둔다.
      // embed:true — 이 경로만 앱 웹뷰 안이다(아래 새창 열기는 사파리로 나간다).
      fr.src = ezlongSiteUrl({ embed: true }) || (fr.dataset && fr.dataset.src) || "https://ezlong.com";
    }
  }
  ezlongSection.style.zIndex = "40";      // 시계보다 위 — 네이티브 제스처 라우팅 확보
  if (app) app.style.visibility = "hidden"; // 비켜난 시계를 히트테스트에서 완전 제거
}
// 2026-08-04 운영 요청 — 앱을 열었을 때 첫 화면을 고를 수 있게 한다.
// 기본값은 '투자명저 문장'(기존 동작 그대로). 'ezlong.com'을 고른
// 사람은 실행 직후 바로 2페이지로 넘어간다.
const startPageStorageKey = "ezlong:startPage";
function loadStartPage() {
  try {
    return localStorage.getItem(startPageStorageKey) === "ezlong" ? "ezlong" : "quote";
  } catch (error) {
    return "quote";
  }
}
function saveStartPage(value) {
  try {
    localStorage.setItem(startPageStorageKey, value === "ezlong" ? "ezlong" : "quote");
  } catch (error) {
    // 저장 실패해도 이번 실행에는 영향 없다.
  }
}

function goToPage(index) {
  const open = index >= 1;
  currentPageIndex = open ? 1 : 0;
  // 2026-08-11 이슈 제보 — "StandBy 를 보다가 백그라운드 갔다 오면
  // ezlong.com 으로 바뀌어 있다." 지금 어느 화면인지를 여기서 남겨 둔다.
  // sessionStorage 를 쓰는 이유가 핵심이다: 이 값은 **웹뷰가 다시 로드돼도
  // 살아남고, 앱이 완전히 새로 뜨면 비어 있다.** 그래서 "이용 중 복귀"와
  // "첫 실행"을 코드가 따로 묻지 않고도 구분할 수 있다(아래 부팅 적용부).
  try { sessionStorage.setItem("ezlong:lastPage", open ? "ezlong" : "quote"); } catch (error) { /* 무시 */ }
  // 2026-07-23 신설 — 페이지 전환은 "자연스러운 중단 지점"이라 하루 1회
  // 리워드 전면 광고를 제안하기 적합한 타이밍이다. 실제 노출 여부/1일 상한은
  // 네이티브 AdTimerManager가 판단한다 — 여기서는 그냥 신호만 보낸다.
  postToNativeAd({ action: "screenTransition" });
  if (ezlongSettleTimer) { window.clearTimeout(ezlongSettleTimer); ezlongSettleTimer = null; }
  if (open) {
    if (app) app.classList.add("ezlong-open");
    ezlongSettleTimer = window.setTimeout(settleEzlongOpen, 620); // 슬라이드 완료 후 정착
    // 2026-07-20 유저 요청: 페이지2에 들어올 때마다 ⏏ 아이콘이 위로 살짝
    // 튀는 짧은 힌트를 재생 — "이걸 누르면 위로 올라간다"는 암시. 클래스를
    // 뗐다 붙여(강제 리플로우) 두 번째 이후 진입에서도 매번 재생되게 한다.
    // getElementById로 직접 참조하는 이유: webviewBackButton const가 이
    // 함수보다 뒤에서 선언돼 있어(temporal dead zone) 여기서 그 변수를
    // 직접 쓰면 초기 실행 순서에 따라 깨질 수 있다 — 안전하게 우회.
    const backBtnForHint = document.getElementById("webviewBackButton");
    if (backBtnForHint) {
      backBtnForHint.classList.remove("hint-play");
      void backBtnForHint.offsetWidth; // 강제 리플로우로 애니메이션 재시작
      backBtnForHint.classList.add("hint-play");
    }
  } else {
    // 닫기: 원복을 먼저(t=0) — 시계가 다시 보이며 z2>z1로 위에서 슬라이드 복귀
    if (ezlongSection) ezlongSection.style.zIndex = "";
    if (app) { app.style.visibility = ""; app.classList.remove("ezlong-open"); }
  }
}
// 16차: 트랙 오프셋 개념이 사라져 재계산할 것이 없다 — 호출부(뷰포트 리사이즈)
// 호환을 위해 빈 함수로 유지.
function resyncPageTrackOffset() {}

if (skyRoom) {
  skyRoom.addEventListener("touchstart", (event) => {
    const touch = event.touches[0];
    swipeStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }, { passive: true });

  // 2026-08-12 — touchcancel 안전망. iOS 는 시스템이 제스처를 가져가면
  //   touchend 를 안 보내고 touchcancel 을 보낸다. 이 핸들러가 없으면 시작
  //   좌표가 그대로 남아, 다음 터치의 판정이 엉뚱한 기준점으로 계산될 수 있다.
  //   (씹힘의 근본은 문장박스 쪽 CSS 에서 막았고 — styles.css .quote-panel 주석 —
  //    이건 그래도 새는 경우를 위한 뒷정리다.)
  skyRoom.addEventListener("touchcancel", () => {
    swipeStart = null;
  }, { passive: true });

  skyRoom.addEventListener("touchend", (event) => {
    if (!swipeStart) return;
    const touch = event.changedTouches[0];
    const start = swipeStart;
    swipeStart = null;
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const verticalDominant = Math.abs(dy) > Math.abs(dx) * 1.35;
    if (verticalDominant) {
      // 위로 스와이프(손가락이 위로 이동, dy가 충분히 음수) → 2페이지로.
      if (dy < -64) goToPage(1);
      return;
    }
    if (Math.abs(dx) < 48) return;
    const direction = dx < 0 ? 1 : -1;
    movePhoto(direction);
    moveQuote(direction);
  }, { passive: true });
}

// 2페이지(ezlong-webview)에서 아래로 스와이프하면 1페이지로 복귀한다.
// 주의: iframe 내부(ezlong.com 콘텐츠 자체)에서 시작된 터치는 브라우저
// 구조상 이 리스너까지 버블링되지 않는다(iframe 경계는 항상 이벤트를
// 막는다 — 동일 출처라도 마찬가지). 그래서 footer 등 iframe 바깥 영역에서
// 시작된 스와이프만 감지되며, iframe 내부에서라도 확실히 돌아갈 수 있게
// 아래 #webviewBackButton(뒤로가기 버튼)을 별도로 둔다.
// 2026-07-22 유저 요청: 맨 위 그래버(.webview-grabber)의 "아래로 쓸어내려
// 복귀" 제스처를 없앤다 — 하단 Basecamp 버튼이 이미 같은 역할을 하므로
// 중복이라는 판단. 대신 그래버는 "탭하면 ezlong.com 콘텐츠 맨 위로 스크롤"
// 로 용도를 바꾼다(아래 참조). 그래서 이 스와이프 판정은 그래버에서 시작된
// 터치를 제외하고, footer 등 그 외 영역에서 시작된 스와이프만 계속 감지한다.
if (ezlongSection) {
  let webviewSwipeStart = null;
  ezlongSection.addEventListener("touchstart", (event) => {
    if (event.target && event.target.closest(".webview-grabber")) {
      webviewSwipeStart = null;
      return;
    }
    const touch = event.touches[0];
    webviewSwipeStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }, { passive: true });
  ezlongSection.addEventListener("touchend", (event) => {
    if (!webviewSwipeStart) return;
    const touch = event.changedTouches[0];
    const start = webviewSwipeStart;
    webviewSwipeStart = null;
    if (!touch) return;
    const dy = touch.clientY - start.y;
    const dx = touch.clientX - start.x;
    if (dy > 64 && Math.abs(dy) > Math.abs(dx) * 1.35) goToPage(0);
  }, { passive: true });
}

const webviewBackButton = document.getElementById("webviewBackButton");
if (webviewBackButton) {
  webviewBackButton.addEventListener("click", () => goToPage(0));
}

// 2026-07-22 유저 요청: "스크롤 한참 내려간 뒤 위로 올라가기 힘들다,
// 최상단 바를 터치하면 맨 위로 올라가면 좋겠다" — 그래버(.webview-grabber)
// 탭 시 iframe 안(ezlong.com 콘텐츠)을 맨 위로 스크롤시킨다. iframe이
// 크로스오리진처럼 터치를 삼키는 경계라(위 주석 참조) 부모가 iframe
// 내부 스크롤 위치를 직접 조작하지 않고, postMessage로 요청만 보낸다 —
// 수신측 리스너는 ezlong.com 저장소의 ez-nav.js에 추가했다(모든
// ezlong.com 페이지가 <body> 직후 이 스크립트를 로드하므로 페이지
// 종류와 무관하게 동작). 이 메시지를 받을 준비가 안 된 옛 배포본이
// 떠 있어도 그냥 무시될 뿐 에러는 안 난다(안전한 점진적 배포).
// 2026-07-24 유저 재요청: 단일 탭 → 더블탭(사파리 상태바 탭처럼)으로 변경 +
// 터치존을 가운데 112px에서 전폭(100%)으로 확장. 시각적 손잡이(핏 이미지)도
// 완전히 제거(styles.css 참조) — 이제 눈에 보이는 흔적 없이 "상단 어딘가를
// 빠르게 두 번 탭"하면 스크롤톱이 실행된다. dblclick 네이티브 이벤트는
// WKWebView·안드로이드 WebView에서 터치 더블탭에 항상 신뢰성 있게 매핑된다는
// 보장이 없어(이 프로젝트에서 반복 확인된 터치 이벤트 불일치 전례 참고),
// touchend 타임스탬프+좌표 차이를 직접 재는 수동 더블탭 판정을 쓴다. 전폭
// 확장의 트레이드오프(로고·헤더 메뉴 탭이 이 구역에서는 반응 안 함)는
// styles.css .webview-grabber 주석 참조 — 유저 확인 후 진행.
const webviewGrabber = document.querySelector(".webview-grabber");
if (webviewGrabber && ezlongSection) {
  let lastTapAt = 0;
  let lastTapX = null;
  let lastTapY = null;
  const DOUBLE_TAP_MS = 350;
  const DOUBLE_TAP_DIST_PX = 40;
  function scrollEzlongToTop() {
    postToNativeHaptic("light");
    const frame = ezlongSection.querySelector(".ezlong-frame");
    if (!frame || !frame.contentWindow) return;
    try {
      frame.contentWindow.postMessage({ source: "flipzen-app", action: "scrollToTop" }, "https://ezlong.com");
    } catch (error) {
      // 크로스오리진 등으로 postMessage 자체가 막혀도 앱 동작에는 영향 없음.
    }
  }
  webviewGrabber.addEventListener("touchend", (event) => {
    const touch = event.changedTouches && event.changedTouches[0];
    if (!touch) return;
    const now = Date.now();
    const dx = lastTapX === null ? Infinity : Math.abs(touch.clientX - lastTapX);
    const dy = lastTapY === null ? Infinity : Math.abs(touch.clientY - lastTapY);
    const isDoubleTap = (now - lastTapAt) <= DOUBLE_TAP_MS && dx <= DOUBLE_TAP_DIST_PX && dy <= DOUBLE_TAP_DIST_PX;
    if (isDoubleTap) {
      lastTapAt = 0;
      lastTapX = null;
      lastTapY = null;
      event.preventDefault();
      scrollEzlongToTop();
    } else {
      lastTapAt = now;
      lastTapX = touch.clientX;
      lastTapY = touch.clientY;
    }
  }, { passive: false });
  // 터치가 없는 일반 브라우저(PC 등) 폴백 — 네이티브 더블클릭.
  webviewGrabber.addEventListener("dblclick", scrollEzlongToTop);
}

// 2026-07-20 9차 피드백(이슈 제보: "브라우저에서 보기 버튼 눌러도 무반응") —
// 예전엔 <a href target="_blank">였는데, WKWebView는 target="_blank" 새 창
// 열기를 기본적으로 무시한다(별도 WKUIDelegate 처리가 있어야 동작). 알라딘
// 모달의 aladinModalExternalOpenEl과 완전히 같은 증상·같은 해법 — 이미 있는
// openExternalSafari 네이티브 브릿지(ContentView.swift, 알라딘 때 이미 구현
// 완료)를 그대로 재사용한다. 새 네이티브 액션이 아니라서 Xcode 재빌드 없이
// 웹 배포만으로 반영된다.
const webviewOpenButton = document.getElementById("webviewOpenButton");
if (webviewOpenButton) {
  webviewOpenButton.addEventListener("click", () => {
    // 2026-07-28: 웹뷰가 보고 있는 것과 같은 로케일 주소로 연다 —
    // 안에서는 일본어를 보다가 새 창은 한국어가 뜨면 안 된다.
    // embed 신호는 붙이지 않는다 — 여기서 열리는 건 진짜 사파리·크롬이고,
    // 거기서는 브라우저 자동번역이 정상 동작하므로 프록시 우회가 불필요하다.
    const url = ezlongSiteUrl();
    if (isNativeWrapper && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.flipzenNativeRadio) {
      window.webkit.messageHandlers.flipzenNativeRadio.postMessage({ action: "openExternalSafari", url });
      return;
    }
    // 2026-07-24 신설 — 안드로이드 분기.
    if (isNativeWrapper && window.AndroidNativeBridge) {
      window.AndroidNativeBridge.postMessage("flipzenNativeRadio", JSON.stringify({ action: "openExternalSafari", url }));
      return;
    }
    let opened = null;
    try {
      opened = window.open(url, "_blank", "noopener");
    } catch (error) {
      opened = null;
    }
    if (!opened) {
      window.location.href = url;
    }
  });
}

// 2026-07-08: 우측 상단 "ezlong.com" 글자를 탭하면 플립시계 컨셉에 맞는
// "위로 플립" 연출을 더해서 2페이지로 이동한다. 2026-07-17 8차 개정으로
// scrollIntoView/scrollSnapType 토글 로직을 걷어내고 goToPage()로 교체 —
// 회전 애니메이션과 페이지 전환 타이밍만 맞추면 되므로 훨씬 단순해졌다.
// 2026-07-17 11차: perspective/preserve-3d가 이제 상시 적용이 아니라
// .is-flipping-3d 클래스로만 켜지므로(styles.css 참조), 회전이 실제로
// 진행되는 이 900ms 구간에만 .clock-app과 #pageTrack에 그 클래스를 같이
// 붙였다 뗀다 — 스크롤이 이 3D 컨텍스트 때문에 막혔었는지 실기기로
// 검증하기 위한 조치다.
if (appBrand && skyRoom && ezlongSection) {
  appBrand.addEventListener("click", () => {
    if (skyRoom.classList.contains("is-flipping-away")) return; // 연타 방지
    skyRoom.classList.add("is-flipping-away");
    if (app) app.classList.add("is-flipping-3d");
    if (pageTrack) pageTrack.classList.add("is-flipping-3d");
    window.setTimeout(() => {
      goToPage(1);
    }, 260); // 회전이 절반쯤 진행됐을 때 페이지 전환을 시작해 자연스럽게 이어지게 한다.
    window.setTimeout(() => {
      skyRoom.classList.remove("is-flipping-away");
      if (app) app.classList.remove("is-flipping-3d");
      if (pageTrack) pageTrack.classList.remove("is-flipping-3d");
    }, 900); // 화면 밖으로 충분히 벗어난 뒤 원상태로 리셋(다음에 다시 볼 때 정상 모습).
  });
}

// 2026-07-20 유저 요청: 하단 우측 "ezlong.com" 링크 — appBrand와 달리
// 회전 애니메이션(is-flipping-away/is-flipping-3d) 없이 goToPage(1)만
// 곧장 호출한다. .clock-app.ezlong-open은 순수 translateY(-100%) 슬라이드라
// (styles.css 참조), "이 자리 아래에 원래 ezlong.com이 있었다"는 느낌으로
// 화면이 위로 걷힌다 — appBrand의 회전 플립과 의도적으로 다른 연출.
if (sceneEzlongLink) {
  sceneEzlongLink.addEventListener("click", () => goToPage(1));
}

renderFlatGenreOptions();
loadSavedFlatGenres();
renderMusicPlaylistInfo();
renderMusicPlaylistFilterOptions();
syncMusicExcludeFilterUi();
syncBgFilterUi();
renderMusicToggle();
renderMusicVizSettingsUI();
settingsOpen.addEventListener("click", () => {
  postToNativeHaptic("light");
  openSettings();
});
settingsSave.addEventListener("click", () => {
  postToNativeHaptic("success");
  saveSelectedFlatGenres();
  clearSettingsDirty();
  closeSettings();
});
document.querySelectorAll("[data-settings-close]").forEach((element) => {
  element.addEventListener("click", closeSettings);
});
// 2026-07-23 신설 — 네이티브 앱(iOS)에서만 실제로 동작한다. 웹/PWA에서는
// postToNativeAd가 조용히 무시되므로(isNativeWrapper === false) 버튼은
// 보이되 아무 일도 일어나지 않는다 — 그 환경엔 애초에 광고 자체가 없다.
if (premiumUpgradeButton) {
  premiumUpgradeButton.addEventListener("click", () => {
    postToNativeHaptic("light");
    postToNativeAd({ action: "openPaywall" });
  });
}

// 2026-08-26 — 광고 진단 한 줄(개발 빌드 전용).
//
// "광고가 안 나오네"를 짐작으로 쫓지 않기 위한 창구다. 광고가 뜨고 안
// 뜨고를 정하는 값이 여섯 개인데 전부 네이티브 안에 숨어 있다.
// 설정 화면이 열려 있는 동안만 3초에 한 번 물어본다 — 닫혀 있으면
// 묻지 않는다(릴리스 빌드는 응답 자체를 안 하므로 줄도 안 생긴다).
(function initAdDiag() {
  var line = document.getElementById("adDiagLine");
  var floating = document.getElementById("adDiagFloat");
  if (!line && !floating) return;

  // 2026-08-26 운영 지침 — 이제 안 나오게. 다만 지우지는 않는다.
  //
  // 오늘 이 줄이 세 번 일했다: 광고가 안 나오는 이유가 리워드 시청이었음을
  // 밝혔고, 눌러도 안 바뀌던 것이 옛 판 때문이었음을 밝혔고, 지금 붙은
  // 빌드가 무엇인지 보여 줬다. 지워 버리면 다음에 또 만들게 된다.
  //
  // 기본은 꺼 둔다. 되살리려면 설정 화면의 버전 라벨(ver.1.9.xx)을
  // 다섯 번 누른다 — 안드로이드 개발자 옵션과 같은 관습이다.
  var DIAG_KEY = "ezlong:adDiag";
  function diagOn() {
    try { return localStorage.getItem(DIAG_KEY) === "1"; } catch (error) { return false; }
  }
  (function wireDiagToggle() {
    var badge = document.getElementById("settingsVersion");
    if (!badge) return;
    var taps = 0;
    var timer = null;
    badge.style.cursor = "pointer";
    badge.addEventListener("click", function () {
      taps += 1;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(function () { taps = 0; }, 1200);
      if (taps < 5) return;
      taps = 0;
      var next = diagOn() ? "0" : "1";
      try { localStorage.setItem(DIAG_KEY, next); } catch (error) { /* 무시 */ }
      if (next === "0") {
        [line, floating].forEach(function (el) { if (el) el.hidden = true; });
      }
      badge.textContent = next === "1" ? "진단 켬" : "진단 끔";
      window.setTimeout(function () { location.reload(); }, 700);
    });
  })();
  if (!diagOn()) return;
  // 웹 버전도 함께 붙인다 — 네이티브만 새것이고 웹이 옛것인(또는 그
  // 반대인) 어긋남이 실제로 있었다. 둘 다 눈에 보여야 판별이 된다.
  function webVer() {
    try {
      var el = document.getElementById("settingsVersion");
      return (el && el.textContent ? el.textContent.trim() : "").replace(/^ver\./, "");
    } catch (error) { return ""; }
  }
  window.__flipzenAdDiag = function (text) {
    if (!text) return;
    var v = webVer();
    var full = v ? (text.replace(/^(b\S+)( · )?/, "$1 · web " + v + " · ")) : text;
    if (v && full === text) full = "web " + v + " · " + text;
    [line, floating].forEach(function (el) {
      if (!el) return;
      el.textContent = full;
      el.hidden = false;
    });
  };
  // 설정이 열려 있든 닫혀 있든 계속 묻는다. 광고는 설정이 닫혀 있을 때만
  // 뜨므로, 진단도 그때 보여야 쓸모가 있다.
  // 줄을 누르면 오늘 광고 상태를 지운다 — 리워드를 본 날에도 광고 모양을
  // 확인할 수 있어야 한다(개발 빌드에서만 네이티브가 응답한다).
  [line, floating].forEach(function (el) {
    if (!el) return;
    el.addEventListener("click", function () {
      postToNativeAd({ action: "adDiagReset" });
      el.textContent = "오늘 광고 상태 초기화 — 10초 뒤 배너";
    });
  });
  window.setInterval(function () {
    try { postToNativeAd({ action: "adDiag" }); } catch (error) { /* 무시 */ }
  }, 3000);
})();

// 2026-08-26 운영 지침 — 애플워치는 iOS 전용이다.
//
// 안드로이드 설정 화면에도 "애플워치" 안내 섹션이 그대로 떠 있었다.
// 살 수도 쓸 수도 없는 기능을 권하는 화면은 안내가 아니라 소음이다.
// 프리미엄 혜택 목록의 워치 줄도 같이 감춘다.
(function hideWatchOnAndroid() {
  if (nativePlatformKey !== "android") return;
  ["watchSettingsSection", "premiumPerkWatch"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.hidden = true;
  });
})();
if (weatherChipOpen) weatherChipOpen.addEventListener("click", () => {
  postToNativeHaptic("light");
  openWeatherDetail();
});
// 2026-07-26 유저 피드백: "안드로이드 메인에서 위치 정보를 못 가져왔다면서
// 안 된다. 10분 정도 후엔 다시 잘 나오는데, 그냥 기다리는 수밖에 없나?
// 재시도 버튼을 주면 어떤가" — mainWeatherRetryBtn은 renderWeather()가
// weatherState.summary가 플레이스홀더("위치 권한 필요"/"날씨 오류")일 때만
// 보여준다. 클릭 시 requestCurrentWeather()를 다시 호출해 위치 조회부터
// 새로 시도한다(10분 주기 자동 재시도·포그라운드 복귀 재시도와 완전히
// 같은 경로 — 별도의 새 로직을 만들지 않고 기존 함수를 그대로 재사용).
if (mainWeatherRetryBtn) {
  mainWeatherRetryBtn.addEventListener("click", async () => {
    postToNativeHaptic("light");
    mainWeatherRetryBtn.disabled = true;
    mainWeatherRetryBtn.textContent = t("weather.reloading", null, "다시 불러오는 중…");
    await requestCurrentWeather();
    mainWeatherRetryBtn.disabled = false;
    mainWeatherRetryBtn.textContent = "다시";
  });
}
// 2026-07-20 유저 피드백: 현재 날씨 조회 실패 시 뜨는 "다시 시도" 버튼.
// fetchWeatherDetail()은 실패한 요청을 캐시하지 않으므로(위 wdCurrentRetryBtn
// 선언부 주석 참조) 그냥 다시 호출하면 된다 — 별도의 강제 플래그 불필요.
if (wdCurrentRetryBtn) {
  wdCurrentRetryBtn.addEventListener("click", async () => {
    wdCurrentRetryBtn.disabled = true;
    wdCurrentRetryBtn.textContent = t("weather.reloading", null, "다시 불러오는 중…");
    try {
      await fetchWeatherDetail();
    } finally {
      wdCurrentRetryBtn.disabled = false;
      wdCurrentRetryBtn.textContent = t("common.retry", null, "다시 시도");
    }
  });
}
document.querySelectorAll("[data-weather-detail-close]").forEach((element) => {
  element.addEventListener("click", requestCloseWeatherDetail);
});
// 2026-07-18 3차 피드백: 네이티브 뒤로가기 제스처에 기대지 않는 좌측 엣지
// 스와이프 직접 구현 — 위 setupWeatherDetailEdgeSwipe() 정의부 주석 참조.
setupWeatherDetailEdgeSwipe();
// 2026-08-09 운영 요청 — 문장 복사 버튼. 화면에 보이는 그대로(영문 원문 →
// 한글 번역 → 출처)를 빈 줄로 나눠 클립보드에 담는다. 어디에 붙여넣어도
// 화면에서 읽던 모양 그대로 나오는 것이 목적이라, 따옴표나 말머리 같은
// 장식은 일부러 붙이지 않는다. 영문이 없는 문장(한국어 원전)은 그 줄을
// 통째로 건너뛴다.
const quoteCopyBtn = document.getElementById("quoteCopyBtn");
let quoteCopiedTimer = null;

// 2026-08-09 운영자 추가 요청 — 복사 맨 끝에 그 책을 더 볼 수 있는 링크를
// 붙인다. 어느 서점이냐는 quote-source 모듈이 로케일을 보고 정한다:
// 한국어면 알라딘, 그 밖의 모든 언어면 아마존(지역은 로케일에 맞춰 고른다).
// 링크를 만들 수 없는 책이면 아무것도 붙지 않는다.
// 2026-08-09 운영 지침 — 복사본 링크에서는 제휴 파라미터를 뗀다. 남이
// 붙여넣어 읽을 주소에 내 제휴 ID가 따라다닐 이유가 없고, 주소도 길어진다.
// 화면 버튼(알라딘 모달)이 여는 링크는 손대지 않으므로 수수료 추적에는
// 영향이 없다 — 복사본만 깨끗해진다. 알라딘 partner 와 아마존 tag 를 같은
// 기준으로 다룬다(둘 중 하나만 빼면 어느 쪽이 왜 남았는지 설명할 길이 없다).
function stripAffiliateParams(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("partner");
    parsed.searchParams.delete("tag");
    const query = parsed.searchParams.toString();
    return query ? parsed.origin + parsed.pathname + "?" + query : parsed.origin + parsed.pathname;
  } catch (error) {
    // URL 파싱이 안 되는 이상한 주소여도 복사 자체는 막지 않는다.
    return url.replace(/[?&](partner|tag)=[^&]*/g, "").replace(/\?&/, "?").replace(/[?&]$/, "");
  }
}

function currentQuoteBookLink() {
  const link = resolveQuoteBookLink(lastRenderedQuote);
  if (link && link.url) return stripAffiliateParams(link.url);
  // 모듈이 없거나 실패한 경우의 안전망 — 화면의 알라딘 버튼이 이미 링크를
  // 들고 있으면(= 보이는 상태면) 그것을 쓴다.
  if (quoteAladinLink && !quoteAladinLink.hidden && quoteAladinLink.dataset.url) {
    return stripAffiliateParams(quoteAladinLink.dataset.url);
  }
  return "";
}

function buildQuoteClipboardText() {
  const pick = (id) => {
    const element = document.getElementById(id);
    if (!element || element.hidden) return "";
    return (element.textContent || "").replace(/\s+$/, "").trim();
  };
  // 출처와 링크는 한 덩어리로 붙인다(빈 줄 없이 바로 아랫줄) — 붙여넣었을 때
  // "책 정보"가 한 뭉치로 읽히는 편이 자연스럽다.
  const tail = [pick("quoteSource"), currentQuoteBookLink()].filter(Boolean).join("\n");
  return [pick("quoteEnglish"), pick("quoteText"), tail]
    .filter(Boolean)
    .join("\n\n");
}

// 클립보드 쓰기는 환경마다 막힌는 지점이 달라 두 겹으로 간다.
// 1순위 표준 API(navigator.clipboard) — HTTPS + 사용자 제스처 안에서만 통한다.
// 2순위 execCommand — 표준 API가 막힌 웹뷰용. iOS 는 readOnly textarea 에서
// select() 가 먹지 않으므로 Range 로 직접 선택해야 실제로 복사된다.
async function writeToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) { /* 폴백으로 내려간다 */ }
  try {
    const holder = document.createElement("textarea");
    holder.value = text;
    holder.setAttribute("readonly", "");
    holder.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;";
    document.body.appendChild(holder);
    const range = document.createRange();
    range.selectNodeContents(holder);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    holder.setSelectionRange(0, text.length);
    const copied = document.execCommand("copy");
    selection.removeAllRanges();
    document.body.removeChild(holder);
    return copied;
  } catch (error) {
    return false;
  }
}

if (quoteCopyBtn) {
  quoteCopyBtn.addEventListener("click", async () => {
    const text = buildQuoteClipboardText();
    if (!text) return;
    const copied = await writeToClipboard(text);
    postToNativeHaptic("soft");
    // 토스트를 놓치거나 가려져도 눌린 자리에서 결과를 알 수 있게 버튼 자체가
    // 잠깐 초록으로 물든다(styles.css .quote-copy-btn.is-copied).
    if (copied) {
      quoteCopyBtn.classList.add("is-copied");
      clearTimeout(quoteCopiedTimer);
      quoteCopiedTimer = setTimeout(() => quoteCopyBtn.classList.remove("is-copied"), 1200);
    }
    showMusicToast(copied
      ? t("quote.copied", null, "문장을 복사했습니다")
      : t("quote.copyFailed", null, "복사하지 못했습니다"));
  });
}

if (quoteAladinLink) {
  quoteAladinLink.addEventListener("click", () => {
    const url = quoteAladinLink.dataset.url;
    if (url) openAladinModal(url, quoteAladinLink.dataset.store);
  });
}
// 2026-07-16 3차 개정: 하단 버튼이 이제 링크가 아니라 순수 "닫기" 버튼
// (data-aladin-modal-close)이라, 아래 공통 바인딩에 자동으로 걸린다 —
// 별도 클릭 핸들러가 더 필요 없다. window.open/location.href로 앱 밖으로
// 나가려던 예전 로직은 통째로 제거했다(네이티브 WKWebView에서 진짜 "새
// 탭"이 없어 돌아올 방법이 없었다는 유저 실측 피드백 반영).
document.querySelectorAll("[data-aladin-modal-close]").forEach((element) => {
  element.addEventListener("click", closeAladinModal);
});

// 2026-07-17 8차 개정(근본 재설계): 4차(배경 touchmove 차단)와 5차(시트
// 경계 touchmove 가드)를 여기서 완전히 제거했다. 문서(html/body)가
// styles.css에서 영구적으로 overflow:hidden이 된 지금은 "스크롤이 상위
// 문서로 새어나간다"는 현상 자체가 성립할 수 없다 — 새어나갈 상위 스크롤
// 대상이 아예 없다. .settings-sheet/.weather-detail-sheet의
// overscroll-behavior:contain, touch-action:pan-y(styles.css)만으로
// 충분하다.
if (musicSettingsOpen) musicSettingsOpen.addEventListener("click", () => {
  postToNativeHaptic("light");
  handleMusicIconTap();
});
if (musicToggle) musicToggle.addEventListener("click", toggleMusic);
if (musicSkip) musicSkip.addEventListener("click", () => {
  postToNativeHaptic("light");
  // 2026-07-16 유저 요청: 예전엔 10초 이상 들은 곡을 수동 스킵하면 "싫어요"와
  // 똑같이 disliked 목록에 자동으로 추가됐다(암묵적 학습 휴리스틱). 이제는
  // 명시적인 "싫어요" 버튼이 따로 있으므로, '다음곡'은 그 어떤 감산·학습
  // 효과도 없이 순수하게 다음 곡으로만 넘어간다.
  playNextTrack();
});

// 2026-07-13: 음악 정보 패널 — 톱니바퀴만 음악설정으로 이동, 좋아요/싫어요는
// 로컬 기록(1단계). 패널 토글과 겹치지 않도록 전부 stopPropagation.
if (musicGearOpen) musicGearOpen.addEventListener("click", (event) => {
  event.stopPropagation();
  postToNativeHaptic("light");
  openSettings("music"); // 음악 섹션으로 바로 (2026-08-04 운영 요청)
});
if (musicShuffleButton) musicShuffleButton.addEventListener("click", (event) => {
  event.stopPropagation();
  postToNativeHaptic("light");
  reshuffleMusicOrder();
});
if (musicLikeButton) musicLikeButton.addEventListener("click", (event) => {
  event.stopPropagation();
  postToNativeHaptic("soft");
  const track = currentMusicTrack();
  if (!track || !track.file) return;
  const liked = loadLikedTracks();
  const idx = liked.indexOf(track.file);
  if (idx >= 0) liked.splice(idx, 1); else liked.push(track.file);
  saveLikedTracks(liked);
  renderMusicReactionButtons();
});
if (musicDislikeButton) musicDislikeButton.addEventListener("click", (event) => {
  event.stopPropagation();
  postToNativeHaptic("rigid");
  const track = currentMusicTrack();
  if (!track || !track.file) return;
  const disliked = loadDislikedTracks();
  if (!disliked.includes(track.file)) {
    disliked.push(track.file);
    saveDislikedTracks(disliked);
  }
  renderMusicReactionButtons();
  showMusicDislikeToast();
  // 명시적으로 싫어요를 누른 것이므로, 스킵과 마찬가지로 바로 다음 곡으로
  // 넘어간다(이미 disliked에 들어갔으니 다시 뽑히지 않는다).
  playNextTrack();
});
if (musicInfoPanel) musicInfoPanel.addEventListener("click", (event) => event.stopPropagation());

// 2026-07-14 19차: 진행률 바 드래그/클릭 탐색(seek) — 운영 요청으로 재생
// 위치를 손가락/마우스로 자유롭게 옮길 수 있게 한다. Pointer Events 하나로
// 마우스·터치 모두 처리하고, setPointerCapture로 손가락이 바 바깥으로
// 나가도 드래그가 끊기지 않게 한다.
let musicProgressDragging = false;
function seekMusicProgressToClientX(clientX) {
  if (!musicProgressBar) return;
  const rect = musicProgressBar.getBoundingClientRect();
  if (!rect || rect.width <= 0) return;
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  const player = activePlayer();
  if (!player) return;
  const liveDuration = player.duration;
  const duration = Number.isFinite(liveDuration) && liveDuration > 0
    ? liveDuration
    : parseFloat(player.dataset.cachedDuration || "NaN");
  if (!Number.isFinite(duration) || duration <= 0) return;
  player.currentTime = ratio * duration;
  // timeupdate가 다음 프레임에 다시 정확한 값으로 갱신하겠지만, 드래그
  // 중에는 그 전에도 손끝을 그대로 따라가도록 낙관적으로 먼저 채워준다.
  if (musicProgressFill) musicProgressFill.style.width = (ratio * 100).toFixed(2) + "%";
}
if (musicProgressBar) {
  musicProgressBar.setAttribute("aria-hidden", "false");
  musicProgressBar.setAttribute("role", "slider");
  musicProgressBar.setAttribute("aria-label", t("music.position", null, "재생 위치"));
  musicProgressBar.setAttribute("aria-valuemin", "0");
  musicProgressBar.setAttribute("aria-valuemax", "100");
  musicProgressBar.setAttribute("tabindex", "0");
  musicProgressBar.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    musicProgressDragging = true;
    try { musicProgressBar.setPointerCapture(event.pointerId); } catch (error) { /* 구형 브라우저 폴백 없이 그냥 진행 */ }
    seekMusicProgressToClientX(event.clientX);
  });
  musicProgressBar.addEventListener("pointermove", (event) => {
    if (!musicProgressDragging) return;
    event.stopPropagation();
    seekMusicProgressToClientX(event.clientX);
  });
  const endMusicProgressDrag = (event) => {
    if (!musicProgressDragging) return;
    musicProgressDragging = false;
    try { musicProgressBar.releasePointerCapture(event.pointerId); } catch (error) { /* no-op */ }
    syncNativeSeek(); // 드래그가 끝난 최종 위치를 네이티브(잠금화면 재생 위치)에도 반영.
  };
  musicProgressBar.addEventListener("pointerup", endMusicProgressDrag);
  musicProgressBar.addEventListener("pointercancel", endMusicProgressDrag);
  // 키보드로도 5초 단위 탐색 가능(접근성 보너스).
  musicProgressBar.addEventListener("keydown", (event) => {
    const player = activePlayer();
    if (!player) return;
    if (event.key === "ArrowRight") { event.preventDefault(); player.currentTime = Math.min((player.duration || 0), player.currentTime + 5); syncNativeSeek(); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); player.currentTime = Math.max(0, player.currentTime - 5); syncNativeSeek(); }
  });
}
// 2026-07-07: "곡이 중간에 뚝 끊긴다"는 신고는 ffmpeg 완전디코드로 확인한
// 결과 버그가 아니었다(파일이 정말 그 지점에서 끝남) — 대신 크로스페이드로
// 무음 구간 자체를 없앴다(위 musicFadeOutSeconds 설명 참조). 두 <audio>
// 모두에 리스너를 걸고, 각 핸들러 안에서 activePlayer인지 standby인지
// 구분해서 처리한다.
musicPlayers.forEach((player) => {
  player.addEventListener("timeupdate", updateMusicProgress);
  player.addEventListener("ended", handleActivePlayerEnded);
  player.addEventListener("error", () => {
    if (player !== activePlayer()) {
      // 미리 준비 중이던 다음 곡(standby)이 로드/재생에 실패한 경우 —
      // 크로스페이드를 취소하고, 곡이 끝나는 시점에 기존 방식(즉시 새로
      // 고르기)으로 자연스럽게 되돌아가게 한다.
      crossfadeTriggered = false;
      pendingNextIndex = -1;
      pendingSecondIndex = -1; // 슬롯2 미러도 폐기
      return;
    }
    if (!musicPlaying) return;
    const code = player.error ? player.error.code : 0;
    const isFatal = code === 3 || code === 4; // MEDIA_ERR_DECODE / MEDIA_ERR_SRC_NOT_SUPPORTED
    // 2026-07-15: 네이티브 모드에서는 이 <audio>를 절대 실제로 play()하지
    // 않으므로(파일 상단 nativeClockTimerId 관련 주석 참조) 재시도도 load()+
    // play() 대신 곧바로 다음 곡으로 넘긴다 — 어차피 소리는 이 엘리먼트가
    // 아니라 네이티브 AVPlayer가 낸다.
    if (isFatal || musicErrorRetryCount >= 1 || isNativeWrapper) {
      playNextTrack();
      return;
    }
    musicErrorRetryCount += 1;
    player.load();
    player.play().catch(() => playNextTrack());
  });
  // 2026-07-08 버그 수정: 에어팟을 뺐다 다시 끼우면 iOS/WKWebView가
  // <audio>를 우리 코드 호출 없이 강제로 일시정지시킨다(라우트 변경 시
  // 표준 동작). 그런데 musicPlaying 변수는 toggleMusic()을 눌렀을 때만
  // 바뀌는 구조라, 이렇게 "코드가 모르는 사이에" 멈춘 경우 musicPlaying은
  // 계속 true로 남아 재생 버튼이 계속 "일시정지" 아이콘으로 표시됐다 —
  // 그 상태에서 버튼을 눌러도 실제로는 (일시정지→재생) 순서가 아니라
  // (재생 의도인데 UI는 이미 멈춤 아이콘) 순서로 꼬여서 여러 번 눌러야
  // 겨우 재생되는 원인이 됐다. <audio> 엘리먼트가 실제로 멈추거나
  // 재생되는 순간(원인 불문)을 그대로 반영해 항상 실제 상태와 동기화한다.
  // 2026-07-08 재수정: pause/playing 이벤트는 브라우저 큐를 거쳐 비동기로
  // 도착한다 — 연타 등으로 재생/일시정지 시도가 겹치면, 먼저 눌렀던
  // 시도의 이벤트가 나중 시도의 이벤트보다 늦게 도착해 최신 상태를
  // 덮어써버리는 경우가 있었다("재생 중인데 버튼은 일시정지 표시" 재발
  // 원인). 이벤트가 올 때마다 바로 반영하지 않고 짧게 모았다가(디바운스)
  // 그 시점의 실제 <audio>.paused 값 하나만 확정적으로 반영하도록 바꾼다 —
  // 이벤트가 몇 개, 어떤 순서로 도착하든 결과는 항상 실제 재생 상태와
  // 일치한다.
  player.addEventListener("pause", () => {
    if (player !== activePlayer()) return; // 크로스페이드 전환 중 옛 active player의 의도된 pause는 무시
    scheduleMusicStateSync();
  });
  player.addEventListener("playing", () => {
    if (player !== activePlayer()) return;
    scheduleMusicStateSync();
  });
});
// 2026-07-22: 투자서/문학·교양서 1depth + 각자의 세부 카테고리 이벤트
// 리스너 5개를 평평한 단일 그리드용 2개로 통합. "모든 분야"는 개별
// 선택을 전부 지우고, 개별 항목을 하나라도 체크하면 "모든 분야"가 꺼진다
// — 기존 categoryOptions 패턴과 동일(둘 다 꺼지는 걸 막을 필요가 없다,
// selectedFlatGenres가 비면 자동으로 "전체 통과"이므로 0개 상태가 곧
// "모든 분야"와 같다).
if (allFlatGenresEl) {
  allFlatGenresEl.addEventListener("change", () => {
    if (allFlatGenresEl.checked) {
      document.querySelectorAll("[data-flat-genre-option]").forEach((input) => {
        input.checked = false;
      });
      applyFlatGenreSelection();
    } else if (selectedFlatGenres.size === 0) {
      allFlatGenresEl.checked = true;
    }
  });
}
if (flatGenreOptionsEl) {
  flatGenreOptionsEl.addEventListener("change", (event) => {
    if (event.target.matches("[data-flat-genre-option]")) {
      if (event.target.checked && allFlatGenresEl) allFlatGenresEl.checked = false;
      applyFlatGenreSelection();
    }
  });
}
// 2026-07-21 — "터치 반응은 바로, 처리는 뒷단에서" 요청 대응. change
// 이벤트(브라우저가 라디오 체크를 확정한 뒤 발생)를 기다리지 않고, 손가락이
// 닿는 그 즉시(pointerdown) 눌린 카드에 즉각적인 시각 효과를 준다 — 이후
// applyMusicPlaylistFilter가 무엇을 하든(트랙 전환 등) 이 시각 반응 자체는
// 전혀 영향받지 않는다. 동시에 pointerdown 시각을 기록해 applyMusicPlaylistFilter
// 쪽 타이밍 로그의 기준점(t0)으로 재사용한다 — "손가락이 닿은 순간부터"
// 실제로 몇 ms 걸리는지 재현 시 콘솔에서 바로 확인 가능하다.
function bindInstantTapFeedback(container) {
  if (!container) return;
  const onDown = (event) => {
    window.__fzFilterTapT0 = performance.now();
    const card = event.target.closest(".field-option");
    if (card) card.classList.add("is-pressed");
  };
  const clearPressed = () => {
    container.querySelectorAll(".field-option.is-pressed").forEach((el) => el.classList.remove("is-pressed"));
  };
  container.addEventListener("pointerdown", onDown, { passive: true });
  container.addEventListener("pointerup", clearPressed, { passive: true });
  container.addEventListener("pointercancel", clearPressed, { passive: true });
}
bindInstantTapFeedback(musicPlaylistOptionsEl);
bindInstantTapFeedback(musicSpecialOptionsEl);

if (musicPlaylistOptionsEl) {
  musicPlaylistOptionsEl.addEventListener("change", (event) => {
    if (event.target.matches('input[name="musicPlaylistFilter"]') && event.target.checked) {
      applyMusicPlaylistFilter(event.target.value);
    }
  });
}
if (musicSpecialOptionsEl) {
  musicSpecialOptionsEl.addEventListener("change", (event) => {
    if (event.target.matches('input[name="musicPlaylistFilter"]') && event.target.checked) {
      applyMusicPlaylistFilter(event.target.value);
    }
  });
}
// 2026-07-25: 4개 카테고리 제외 체크박스를 배열 순회로 한 번에 바인딩한다
// (MUSIC_EXCLUDABLE_CATEGORIES 참조) — 카테고리를 추가/삭제할 때 이
// 리스너 등록부를 따로 손댈 필요가 없다.
// 2026-07-25 유저 요청 — 4개를 전부 체크하면 "전체 랜덤"에 재생할 곡이
// 하나도 안 남는 모순이 생긴다. 최소 1개 플레이리스트는 항상 남아야
// 하므로, 4번째 체크는 그 자리에서 되돌리고 안내만 띄운다(최대 3개).
MUSIC_EXCLUDABLE_CATEGORIES.forEach(({ storageKey, elId }) => {
  const el = document.getElementById(elId);
  if (!el) return;
  el.addEventListener("change", () => {
    if (el.checked) {
      const checkedCount = MUSIC_EXCLUDABLE_CATEGORIES.filter((cat) => {
        const box = document.getElementById(cat.elId);
        return box && box.checked;
      }).length;
      if (checkedCount >= MUSIC_EXCLUDABLE_CATEGORIES.length) {
        el.checked = false;
        flashMusicFilterNotice(t("settings.music.keepOne", null, "최소 1개 플레이리스트는 남겨두세요"));
        return;
      }
    }
    markSettingsDirty();
    saveMusicGenreToggle(storageKey, el.checked);
    applyMusicGenreToggle();
  });
});
// 2026-07-25 신설 — 배경사진 날씨/시간대 매칭 토글. 바뀌는 즉시 화면에
// 반영되도록 activeScene을 force 재렌더한다(다른 설정 변경들과 동일한
// "즉시 반영" 패턴 — setScene 호출부 주석 참조). 계절 토글은 disabled라
// 리스너 자체가 필요 없다.
if (bgFilterWeatherEl) {
  bgFilterWeatherEl.addEventListener("change", () => {
    markSettingsDirty();
    saveBgFilterToggle(bgFilterWeatherStorageKey, bgFilterWeatherEl.checked);
    syncBgFilterUi();
    if (activeScene) setScene(activeScene, { syncDots: true, force: true });
  });
}
if (bgFilterTimeEl) {
  bgFilterTimeEl.addEventListener("change", () => {
    markSettingsDirty();
    saveBgFilterToggle(bgFilterTimeStorageKey, bgFilterTimeEl.checked);
    syncBgFilterUi();
    if (activeScene) setScene(activeScene, { syncDots: true, force: true });
  });
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSettings();
    requestCloseWeatherDetail();
  }
});
window.addEventListener("resize", () => {
  syncFirstScreenHeight();
  resyncPageTrackOffset();
});
window.visualViewport?.addEventListener("resize", () => {
  syncFirstScreenHeight();
  resyncPageTrackOffset();
});

syncFirstScreenHeight();
loadBackgroundArchive();
tick();
requestCurrentWeather();
// 2026-07-27 신설 — 팝업배너/강제업데이트 원격 설정 확인. 다른 부팅 로직과
// 완전히 독립적인 fetch라 실패해도(파일 없음/네트워크 오류) 나머지 앱
// 동작에 영향이 없다(checkAppConfig 내부 catch 참조).
checkAppConfig();
// 2026-07-21 유저 피드백: "대기화면으로 계속 열어두고 있는데, 실제로는
// 폭우가 쏟아지는데 메인 화면 한 줄 요약도 상세 화면도 계속 '옅은
// 이슬비'로 멈춰 있다 — 재실행 안 해도 알아서 바뀌어야 한다." 예전엔
// requestCurrentWeather()가 앱 로드 시 딱 한 번만 불렸다(위치 확정 시점
// 3곳에서 한 번씩) — 그 뒤로는 아무 타이머도 없어서 화면을 계속 켜두면
// 날씨가 영원히 그 시점에 멈춰 있었다. 10분마다 자동으로 다시 불러서
// 메인 화면 칩(weatherState, Open-Meteo)과 상세 화면(fetchWeatherDetail,
// 위 WEATHER_DETAIL_CACHE_MS 15분 캐시) 둘 다 스스로 갱신되게 한다.
// 화면이 백그라운드(다른 앱 전환·화면 꺼짐)일 때는 건너뛴다 — 안 보이는
// 동안 갱신해봐야 배터리만 쓰고, 화면이 다시 보일 때(아래 visibilitychange
// "visible" 분기)와 다음 이 틱 중 더 빠른 쪽이 어차피 최신화해준다.
const WEATHER_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
window.setInterval(() => {
  if (document.visibilityState === "visible") requestCurrentWeather();
}, WEATHER_REFRESH_INTERVAL_MS);
window.setInterval(tick, 1000);

// 2026-08-04 이슈 제보 — "앱을 계속 켜두는데 배경이 자동으로 안 바뀐다".
// 기존 15분 슬롯-비교 사슬(renderTime→shouldRotatePhoto→setScene(force)→
// pickScenePhoto 내부 재비교)을 버리고, 한 곳에서 끝나는 명시적 타이머로
// 교체. 화면이 보이는 동안 5분마다 다음 장으로 한 장씩(4장 한 바퀴 20분).
// 수동 스와이프 직후 15분(manualPhotoUntil)은 기존 약속대로 손대지 않는다.
// 2026-08-04 운영자 리듬 설계 — 문장 4개(1분씩)가 흐르는 4분마다 배경
// 한 장. 4장이 다 돌면(16분) 같은 세트를 반복하지 않고 photoCycleGen을
// 올려 다음 4장 세트로 교체한다(photoHistory 덕에 본 사진은 회피됨).
const PHOTO_AUTO_ROTATE_MS = 4 * 60 * 1000;
// 2026-08-04 2차 — iOS에서 배경 자동전환이 또 멈췄다(안드로이드는 정상).
// 원인을 플랫폼별로 쫓는 대신, "실기기에서 매초 도는 것이 이미 증명된"
// tick()(플립시계 갱신 루프)에 경과시간 판정을 얹는다 — 시계가 움직이는
// 한 배경도 반드시 바뀐다. 독립 setInterval에 기대지 않는 구조.
// var — tick()이 선언보다 먼저 호출돼도 TDZ 오류가 없도록(2026-08-04 긴급수정).
// 2026-08-04 3차 — 저장된 마지막 전환 시각이 있으면 그걸 이어받는다
// (웹뷰 재로드로 리듬이 0으로 되돌아가던 문제).
var lastPhotoRotateAt = (function () {
  try {
    const saved = loadPhotoRotateState();
    if (saved && typeof saved.at === "number" && saved.at <= Date.now()) return saved.at;
  } catch (error) {
    // 무시 — 아래 기본값으로 시작한다.
  }
  return Date.now();
})();
// 2026-08-19 이슈 제보 — "동영상 배경을 끄고 사진으로 돌아왔더니 한
// 장이 30분 넘게 그대로다. 문장은 1분마다 잘 바뀌는데."
//
// 브라우저에서 재현해 보니 회전 로직은 멀쩡했다. 범인은 아래 회전 함수
// 첫 줄의 visibilityState 가드였다 — 탭을 뒤에 두면 열 번 호출해도 열 번
// 다 false를 반환하고 아무 일도 안 한다. 문장 회전(rotateQuote)에는 그
// 가드가 없어서 혼자 계속 넘어간다. 사장님이 본 "문장만 바뀜"이 이
// 비대칭 그대로다.
//
// 그래서 판정 신호를 하나 더 둔다. requestAnimationFrame은 브라우저가
// 화면을 실제로 그릴 때만 돈다 — 프레임이 돌고 있다는 건 그 화면이 지금
// 사람 눈앞에 있다는 뜻이다. WKWebView가 어떤 이유로든 visibilityState를
// hidden에 굳혀 놓아도, 프레임이 살아 있으면 사진을 멈추지 않는다.
// (진짜로 화면이 꺼져 있으면 rAF도 함께 멈추므로 배터리 걱정은 없다.)
var lastFrameAt = Date.now();
(function frameBeat() {
  lastFrameAt = Date.now();
  window.requestAnimationFrame(frameBeat);
})();
function screenIsLive() {
  if (document.visibilityState === "visible") return true;
  return Date.now() - lastFrameAt < 2000;
}

function photoAutoRotateTick() {
  // 회전이 실제로 일어났는지 돌려준다(tick이 타이머 소모 여부를 판단).
  if (!screenIsLive()) return false;
  if (!activePhotoSet.length || Date.now() < manualPhotoUntil) return false;
  if (!activeScene) return false;
  const nextIndex = (activePhotoIndex + 1) % activePhotoSet.length;
  if (nextIndex === 0) {
    photoCycleGen += 1; // 한 바퀴 완료 — setScene의 ensurePhotoSet이 새 4장을 뽑는다
  } else {
    activePhotoIndex = nextIndex;
  }
  setScene(activeScene, { syncDots: true, force: true });
  savePhotoRotateState();
  return true;
}

/* 2026-08-04 3차 — 배경 전환 리듬을 웹뷰 재로드 너머로 잇는다.
   iOS는 메모리가 부족하면 백그라운드의 WKWebView 내용을 버리고 앱에
   돌아올 때 다시 로드한다. 그때마다 경과 시간이 0으로 돌아가면, 앱을
   짧게 여러 번 보는 사람은 4분을 한 번도 채우지 못해 전환을 영영 못 본다.
   마지막 전환 시각과 위치를 남겨두면 재로드 뒤에도 이어지고, 앱을 껐다
   켠 사이에 4분이 지났다면 켜자마자 다음 장으로 넘어간다. */
const photoRotateStateKey = "ezlong:photoRotateState";
function loadPhotoRotateState() {
  try {
    const raw = JSON.parse(localStorage.getItem(photoRotateStateKey) || "null");
    return raw && typeof raw === "object" ? raw : null;
  } catch (error) {
    return null;
  }
}
function savePhotoRotateState() {
  try {
    localStorage.setItem(photoRotateStateKey, JSON.stringify({
      at: Date.now(),
      index: activePhotoIndex,
      key: activePhotoSetKey
    }));
  } catch (error) {
    // 저장 실패해도 이번 실행의 리듬에는 영향이 없다.
  }
}
// 2026-08-19 — 화면이 다시 보이는 순간, 밀린 시간을 따져 즉시 한 장
// 넘긴다. 예전에는 다음 tick(1초 주기)을 기다렸는데, 그 사이 조건이 또
// 어긋나면 회전이 계속 밀렸다. 돌아오자마자 바뀌는 편이 사람 감각에도 맞다.
function photoRotateCatchUp() {
  if (typeof lastPhotoRotateAt !== "number") return;
  if (Date.now() - lastPhotoRotateAt < PHOTO_AUTO_ROTATE_MS) return;
  if (photoAutoRotateTick()) lastPhotoRotateAt = Date.now();
}
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") {
    // 복귀 직후 한 프레임은 지나야 레이아웃이 안정된다.
    window.setTimeout(photoRotateCatchUp, 120);
  }
});
window.addEventListener("pageshow", function () {
  window.setTimeout(photoRotateCatchUp, 120);
});

// (독립 타이머는 폐기 — tick() 안에서 경과시간으로 호출한다.)
window.setInterval(musicStallWatchdog, 2000);
// 2026-07-16: 이 15초 주기 재동기화를 폐기한다 — 유저가 겪은 "곡 중간에
// 갑자기 몇 초 되감겼다 정상 재생됨"(5초 지점 2초 되돌림, 3~5초·65% 지점
// 씹힘, 에어팟이 25~50% 지점에서 끊긴 것처럼 보인 사고 전부)의 공통 원인이
// 바로 이 한 줄이었던 것으로 최종 판단했다(이슈 제보 "웹앱에서는 이런 문제가
// 한 번도 없었다"가 결정적 단서 — syncNativeSeek()은 네이티브 모드에서만
// 존재하는 경로다). 문제는 방향이 거꾸로였다는 것: 네이티브(AVPlayer)가
// 실제로 소리를 내는 "진짜 재생 위치"의 원본(source of truth)인데, 이 줄은
// 거꾸로 JS의 가상시계(tickNativeVirtualClock, 250ms 주기 setInterval — 메인
// 스레드가 잠깐이라도 밀리면 자연히 실제 위치보다 뒤처질 수 있음)의 값을
// 네이티브에 "이 시간으로 맞춰라"라고 떠밀었다. 밀린 값과 실제 위치가 1초
// 넘게 벌어지면(NativeRadioPlayer.seek()의 1초 허용오차) 네이티브가 강제로
// seek()당하는데, 아직 전부 버퍼링되지 않은 스트리밍 파일이면 이 seek 자체가
// 순간 버퍼링 정지를 유발해 "끊김"·"되감김"·"멈춰서 재생버튼 눌러야 함"처럼
// 들렸다. 방향을 바로잡으면(네이티브→JS로 시계를 맞추는 것) 이런 부작용
// 자체가 원천 차단된다 — 그리고 그 "네이티브→JS 동기화"는 이미
// __flipzenNativeTimeSync(앱이 백그라운드에서 돌아올 때 호출됨)가 정확히
// 담당하고 있으므로, 오랜 시간 재생 후에도 화면 진행률이 크게 벌어지는
// 문제는 이미 다른 경로로 방지돼 있다. syncNativeSeek() 함수 자체는 지우지
// 않는다 — 유저가 진행률 바를 직접 드래그하거나 화살표키로 탐색했을 때는
// "지금 이 위치로 실제로 이동하라"는 의도가 분명한 진짜 seek 요청이라
// 네이티브가 따라가는 게 맞다(아래 이벤트 리스너들에서 호출).

// 2026-07-07: 앱을 켜고 첫 곡을 재생할 때 초반 몇 초간 짧게 끊기는 증상 —
// 재생 버튼을 누른 그 순간에야 트랙 파일을 받기 시작해서 벌어지는 지연으로
// 판단, 앱이 뜨자마자(재생 버튼을 누르기 전부터) 첫 곡을 미리 로드해서
// preload="auto"가 백그라운드로 버퍼링을 시작하게 한다. 나중에 playMusic()이
// 실행될 때 player.src가 이미 채워져 있으면 새로 로드하지 않고 바로
// play()만 호출하므로, 이미 버퍼링된 상태에서 재생을 시작하게 된다.
(function prefetchFirstTrack() {
  const player = activePlayer();
  if (!player || player.src) return;
  // 2026-07-08: 로그인 없이 저장해둔 "마지막으로 듣던 곡"이 있으면 같은 곡을
  // 이어서 준비한다 — 단, 듣던 "초"까지는 맞추지 않고 항상 처음부터 재생한다.
  // (버그 수정: 예전엔 정확한 초까지 seek했는데, loadedmetadata가 늦게 와서
  // 재생 시작 후 몇 초간 진행바가 안 움직이다가 갑자기 그 지점으로 뚝
  // 끊기며 점프하는 불쾌한 증상이 있었다. 유저 피드백: "굳이 직전에 50초까지
  // 들었으면 51초부터 이어서 들을 필요는 없고, 해당 곡이면 된다" — 곡 단위
  // 이어듣기만 남기고 초 단위 탐색은 완전히 제거한다.)
  const resume = loadMusicResume();
  let resumeIndex = -1;
  // 2026-07-09: 저장된 날짜(savedOn)가 "오늘"과 같을 때만 이어듣기를 적용한다.
  // savedOn이 아예 없는 예전 저장값(이 수정 이전에 저장된 것)은 날짜를 알 수
  // 없으므로 안전하게 "오늘 아님"으로 취급해 새 곡을 고르게 한다 — 유저
  // 입장에선 이 업데이트 이후 첫 실행 한 번만 새 곡으로 시작하고, 그 다음부터는
  // 정상적으로 하루 단위 이어듣기가 자리잡는다.
  if (resume && Array.isArray(musicPlaylist) && resume.savedOn === localDateStamp()) {
    const idx = musicPlaylist.findIndex((track) => track && track.file === resume.file);
    if (idx >= 0) resumeIndex = idx;
  }
  musicIndex = resumeIndex >= 0 ? resumeIndex : pickNextTrackIndex();
  recordTrackHeard(musicIndex);
  recordPlayLog(musicIndex);
  renderMusicPlaylistInfo();
  renderMusicHistoryList();
  player._pendingLoad = loadMusicTrack(player, musicIndex, { prebuffer: true });
  // 2026-07-16: "3~5초쯤 한 번씩 씹힌다"는 재지적 — 네이티브 모드에서는
  // 위 JS쪽 blob 프리버퍼가 아무 의미가 없다(어차피 이 <audio>를 실제로
  // 재생하지 않으므로). 정작 소리를 내는 NativeRadioPlayer의 TrackFileCache는
  // 지금까지 "곡이 끝나갈 때"만 다음 곡을 미리 받아뒀지, 앱을 막 열어서
  // 재생 버튼을 처음 누르는 "첫 곡"은 미리 받아둘 기회 자체가 없어서 항상
  // 콜드 스트리밍으로 시작했다 — 이게 초반 몇 초가 씹히는 진짜 원인이었다.
  // 앱이 뜨자마자(재생 버튼을 누르기 전부터) 네이티브에도 첫 곡을 미리
  // 받아두라고 알려준다.
  if (isNativeWrapper && Array.isArray(musicPlaylist) && musicPlaylist.length > 0) {
    const firstTrack = musicPlaylist[musicIndex % musicPlaylist.length];
    if (firstTrack) {
      postToNativeRadio({ action: "prefetchNext", url: resolveTrackAbsoluteUrl(firstTrack) });
    }
  }
})();

// 2026-07-08: 앱이 백그라운드로 가거나(다른 앱 전환) 아예 종료될 때도 마지막
// 재생 위치를 놓치지 않도록 강제 저장한다. timeupdate 기반 저장(5초 간격)만
// 믿으면 그 사이에 앱이 꺼질 경우 최대 5초 분량이 유실될 수 있다.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    maybeSaveMusicResume(true);
    // 2026-07-15: 이제 백그라운드 전환 시점에 뭔가를 새로 트리거할 필요가
    // 없다 — 네이티브 AVPlayer가 재생 시작부터 이미 소리를 내고 있으므로,
    // 여기서는 예전과 같이 재생 위치 저장만 하면 된다.
  } else if (document.visibilityState === "visible") {
    // 2026-07-16: 포그라운드 복귀 시 알라딘 아이콘/모달 상태 재동기화(위
    // resyncAladinUiAfterForeground 주석 참고).
    resyncAladinUiAfterForeground();
    // 2026-07-21 유저 피드백: 화면이 꺼져있거나 다른 앱으로 전환돼 있던
    // 동안엔 위 10분 주기 타이머(WEATHER_REFRESH_INTERVAL_MS)도 사실상
    // 멈춰있었을 시간이 길 수 있다(iOS는 백그라운드 탭의 JS 타이머를 강하게
    // 억제한다) — 그래서 몇 시간 만에 화면을 다시 켰을 때도 날씨가 그새
    // 완전히 바뀌었을 수 있다. 돌아오는 즉시 한 번 더 갱신해서 "다시 켰는데
    // 아직도 예전 날씨"가 안 생기게 한다.
    requestCurrentWeather();
  }
});
window.addEventListener("pagehide", () => maybeSaveMusicResume(true));

// 2026-08-10 — visibilitychange 하나만 믿지 않는다. 안드로이드 웹뷰는 앱을
// 오래 재웠다 깨울 때 이 이벤트를 흘리는 경우가 있어(이슈 제보의 "메인만
// 어제 날씨" 가 그 증상이다), 창 포커스와 bfcache 복귀도 같은 갱신 신호로
// 받는다. 세 신호가 겹쳐 들어와도 30초 안에는 한 번만 실제로 요청한다 —
// 신호를 늘리는 것과 요청을 늘리는 것은 다른 이야기다.
let lastForegroundWeatherAt = 0;
function refreshWeatherOnForeground(reason) {
  const now = Date.now();
  if (now - lastForegroundWeatherAt < 30 * 1000) return;
  lastForegroundWeatherAt = now;
  try { requestCurrentWeather(); } catch (error) { /* 갱신 실패가 화면을 깨뜨리면 안 된다 */ }
}
window.addEventListener("focus", () => refreshWeatherOnForeground("focus"));
window.addEventListener("pageshow", () => refreshWeatherOnForeground("pageshow"));

// ============================================================================
// 2026-07-27 신설 — 광고 레이아웃 브릿지 (네이티브 앱 전용, 웹/PWA에서는
// isNativeWrapper === false라 통째로 비활성).
// 확정 스펙(수익화_기획서 + 2026-07-27 유저 확정): 배너는 "책속 문장 박스
// 사이즈만한" 크기로 문장박스 자리에 얹는다. 그 좌표의 유일한 소스가 이
// 브릿지다. 기존 함수(toggleCalendarPanel 등)를 일절 수정하지 않는 관찰
// 전용 코드 — 2초 주기로 문장박스 좌표와 달력 열림 상태를 읽어 "값이
// 바뀌었을 때만" 네이티브로 보낸다(이 웹뷰의 레이아웃 버그 전력 때문에
// 기존 코드 개입을 최소화하는 게 이 프로젝트의 원칙, CLAUDE.md 참조).
// 구버전 앱(빌드 8 이하)은 flipzenAd 핸들러의 default: break로 이 메시지를
// 조용히 무시하므로 역호환도 안전하다.
(function initAdLayoutBridge() {
  if (!isNativeWrapper) return;
  let lastSent = "";
  function reportAdLayout() {
    try {
      if (!quotePanel) return;
      const r = quotePanel.getBoundingClientRect();
      // 2026-08-04 운영 피드백 — 예전엔 이 사각형(박스 바깥 전체)을
      // 그대로 넘겨서 배너가 문장박스를 통째로 덮었다(유리 테두리까지
      // 안 보일 정도). 네이티브는 받은 높이를 인라인 적응형 배너의
      // maxHeight로 쓰기 때문에, 박스 높이(210~300px)를 넘기면 AdMob이
      // 그 안을 꽉 채우는 대형 광고를 골라 온다. 이제 두 가지를 지킨다:
      //   (1) 문장박스의 실제 패딩 + 여유 8px 만큼 안으로 들여서 유리
      //       테두리와 여백이 광고 옆으로 항상 보이게 하고,
      //   (2) 높이를 표준 배너대(최대 72px)로 제한해 안쪽 영역 세로
      //       중앙에 놓는다 — 광고도 이 화면의 여백 감각을 따르게.
      const cs = window.getComputedStyle(quotePanel);
      const padOf = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
      // 2026-08-27 운영 피드백 — "문장박스 height 보다 광고 height 가 너무
      // 짧다. 광고 문구가 몇 글자 못 들어간다."
      //
      // 재보니 그 말이 맞았다. 문장박스는 130dp 인데 광고 자리는 82dp 였다.
      // 48dp 를 어디서 잃었나 — 세로 패딩(위아래)을 통째로 빼고 거기에 다시
      // 8dp 씩 여유를 준 탓이다. 광고 카드는 자기 유리 배경을 이미 갖고 있어서
      // 문장박스 안쪽 여백까지 비워 둘 이유가 없다. **가로는 운영자 확인대로
      // 지금이 딱 맞으니 그대로 두고, 세로만 되찾는다.**
      const gapX = 8; // 가로 — 유리 테두리가 광고 옆으로 보이게(그대로)
      // 2026-08-27 2차(운영자: "광고 문구가 한 줄 늘었는데 두 줄 더 늘려도
      // 되겠다") — 세로 여백을 마지막 한 톨까지 내놓는다. 문장박스는
      // 393px 기기에서 122px 이고, 직전까지 광고에 준 자리는 110px 이었다.
      // 위아래 패딩을 0.35 만큼 남겨 두던 계수를 없애 12px 을 되찾는다.
      // 광고 카드는 자기 유리 배경(반지름 16)을 갖고 있고 좌우로 8px 씩
      // 들여져 있어서, 세로 2px 만 남겨도 문장박스의 둥근 모서리 안에
      // 얌전히 들어앉는다(8 + 16 ≈ 문장박스 반지름).
      const gapY = 2; // 세로 — 문장이 놓이던 높이를 전부 쓴다
      const innerX = r.left + padOf("padding-left") + gapX;
      const innerY = r.top + gapY;
      const innerW = Math.max(160, r.width - padOf("padding-left") - padOf("padding-right") - gapX * 2);
      const innerH = Math.max(50, r.height - gapY * 2);
      // 2026-08-26 운영 지침 — "문장박스 대신에 나오는 것이니 문장박스
      // height 만큼 해도 되는데, 지금 오히려 너무 작아서 광고 효과가 별로."
      //
      // 맞는 말이다. 이 광고는 문장박스를 덮는 것이 아니라 문장박스 자리에
      // 대신 서는 것이다. 그러면 그 자리를 다 쓰는 게 옳다. 8할로 줄이고
      // 144px 로 한 번 더 자르던 상한을 걷어낸다 — 문장이 놓이던 만큼.
      // (폭은 운영자 확인대로 이미 맞다. 세로만 손댄다.)
      const bannerH = Math.max(96, Math.round(innerH));
      const payload = {
        action: "adLayout",
        x: Math.round(innerX),
        y: Math.round(innerY + (innerH - bannerH) / 2),
        w: Math.round(innerW),
        h: bannerH,
        calendarOpen: !!calendarPanelOpen || !!window.__alarmHidesAd || !!(settingsPanel && settingsPanel.classList.contains("is-open")),
      };
      const key = [payload.x, payload.y, payload.w, payload.h, payload.calendarOpen].join(",");
      if (key === lastSent) return;
      lastSent = key;
      postToNativeAd(payload);
    } catch (error) {
      // 브릿지/DOM 미준비 — 조용히 무시(다음 주기에 재시도).
    }
  }
  window.setInterval(reportAdLayout, 2000);
  window.addEventListener("resize", () => window.setTimeout(reportAdLayout, 300));
  window.setTimeout(reportAdLayout, 1500);
  window.__flipzenReportAdLayout = reportAdLayout;

  // 네이티브가 배너(문장박스 크기 오버레이)를 띄우는 90초 동안 문장박스
  // 내용을 숨긴다 — 광고가 콘텐츠를 "가리는" 게 아니라 "빈 자리에 놓이는"
  // 구조로 만들어 AdMob 가림 정책 문제를 원천 차단한다(기획서 6번).
  // visibility만 바꾸므로 레이아웃(자리)은 그대로 유지된다.
  window.__flipzenBannerVisible = function (visible) {
    try {
      if (quotePanel) quotePanel.style.visibility = visible ? "hidden" : "";
    } catch (error) {
      // 무시 — 다음 호출에서 복구.
    }
  };
})();


// 2026-08-04 운영 요청 — 화면 왕복 내비게이션 3곳(상단 ezlong.com 브랜드·
// 하단 ezlong.com 링크·Basecamp 복귀)의 터치감. CSS :active에 맡기지 않고
// pointerdown에서 직접 클래스를 붙이는 이유는 두 가지다: (1) iOS WKWebView는
// 버튼이 아닌 요소(.app-brand는 div)의 :active를 잘 안 잡아준다, (2) 손을
// 떼는 시점(up/cancel/leave)을 우리가 통제해야 스크롤로 빠져나갈 때도
// 눌린 채로 남지 않는다. 시각 효과는 styles.css의 .is-pressed 규칙 참조.
(function setupNavPressFeedback() {
  const targets = document.querySelectorAll(".app-brand, .scene-ezlong-link, .webview-back");
  if (!targets.length) return;
  targets.forEach((el) => {
    const press = () => {
      el.classList.add("is-pressed");
      // 안드로이드 WebView는 짧은 햅틱을 지원한다 — 시각 효과와 같은
      // 프레임에 울려야 한 몸으로 느껴진다(apple-design 다감각 조화 원칙).
      // iOS WKWebView는 이 API가 없어 조용히 건너뛴다(1.3에서 네이티브 햅틱).
      // 2026-08-04 2차(운영 피드백) — "설정 버튼은 아이폰에서도 진동이
      // 온다"는 정확한 관찰. 이미 검증된 postToNativeHaptic() 브릿지가
      // 있었고(iOS flipzenHaptic / 안드로이드 AndroidNativeBridge 양쪽
      // 모두 처리), 내가 새로 만들 이유가 없었다. 그 함수를 그대로 쓴다.
      // 일반 브라우저(PWA)에서는 navigator.vibrate로 폴백.
      try {
        if (isNativeWrapper) {
          postToNativeHaptic("light");
        } else if (navigator.vibrate) {
          navigator.vibrate(8);
        }
      } catch (error) {
        // 진동 실패는 무시 — 터치감의 본체는 시각 효과다.
      }
    };
    const release = () => el.classList.remove("is-pressed");
    el.addEventListener("pointerdown", press);
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    el.addEventListener("pointerleave", release);
  });
})();


// 2026-08-04 운영 요청 — 설정의 '앱을 열면 보일 화면' 선택 배선.
// (라디오 2개: 투자명저 문장 / 투자AI도구 ezlong.com. 기본값 문장.)
(function setupStartPagePreference() {
  // 2026-08-04 2차(이슈 제보) — "ezlong.com으로 설정해도 재실행하면 도로
  // 문장으로 돌아와 있다." 1차 원인은 파일 앞쪽 TDZ 오류로 이 IIFE가 아예
  // 실행되지 않았던 것(1.8.38에서 수정). 원인이 그거 하나뿐이라고 믿지 않고
  // 저장·복원 양쪽에 각각 안전장치를 둔다.
  //   · change와 click을 모두 듣는다 — 라벨로 감싼 라디오는 웹킷 계열에서
  //     change가 늦거나 누락되는 사례가 있다.
  //   · 저장한 뒤 곧바로 다시 읽어 검증하고, 어긋나면 콘솔에 남긴다.
  //   · window.syncStartPageUi()로 재동기화를 밖에 열어둔다(설정을 열 때마다
  //     openSettings가 호출한다).
  var box = document.getElementById("startPageOptions");
  if (!box) return;
  var inputs = Array.prototype.slice.call(
    box.querySelectorAll("input[name=\"startPage\"]")
  );
  if (!inputs.length) return;

  window.syncStartPageUi = function syncStartPageUi() {
    var current = loadStartPage();
    inputs.forEach(function (input) {
      input.checked = input.value === current;
    });
  };

  function commit(input) {
    if (!input || !input.checked) return;
    saveStartPage(input.value);
    if (loadStartPage() !== input.value) {
      // 저장이 실제로 안 먹은 경우(사파리 프라이빗 모드 등). 조용히 넘기면
      // 운영자가 겪은 "설정한 게 무의미해지는" 상황이 반복된다.
      console.warn("[FlipZen] 시작 화면 설정 저장 실패:", input.value);
    }
  }

  inputs.forEach(function (input) {
    input.addEventListener("change", function () { commit(input); });
    input.addEventListener("click", function () { commit(input); });
  });

  // 화면을 저장값에 맞춰 처음 한 번 그린다(HTML의 checked를 덮어쓴다).
  window.syncStartPageUi();

  // 부팅 적용 — 웹뷰가 자리를 잡은 뒤 넘어가야 전환이 끊기지 않는다.
  //
  // 2026-08-11 이슈 제보 — "첫 화면을 ezlong.com 으로 해뒀는데, StandBy 를
  // 보다가 백그라운드 갔다 돌아오면 ezlong.com 으로 바뀌어 있다. 설정은 첫
  // 로딩에만 적용돼야지, 이용 중에는 직전 화면이 유지돼야 한다."
  //
  // 원인은 이 블록이 아니라 그 위에 있다. 포그라운드로 돌아올 때 웹뷰가
  // 통째로 다시 로드되는 일이 있고(docs/TODO.md 에 이미 적혀 있는 미해결
  // 과제), 그러면 이 코드가 처음부터 다시 돌면서 "설정대로 ezlong 으로"를
  // 또 실행한다. 설정을 문장 화면으로 두셨을 때는 리로드가 나도 제자리로
  // 보였기 때문에 아무도 눈치채지 못했을 뿐이다.
  //
  // 리로드 자체를 막는 것은 네이티브 쪽 숙제로 남기고, 여기서는 리로드가
  // 나도 **화면 위치는 어긋나지 않게** 만든다. sessionStorage 는 웹뷰가 다시
  // 로드돼도 살아남고 앱이 새로 뜨면 비어 있으므로, 그 값이 있다는 것 자체가
  // "첫 실행이 아니라 이용 중"이라는 증거다. 있으면 그걸 따르고, 없을 때만
  // 설정을 적용한다.
  var resumedPage = null;
  try { resumedPage = sessionStorage.getItem("ezlong:lastPage"); } catch (error) { /* 무시 */ }
  var bootTarget = resumedPage || loadStartPage();
  try { sessionStorage.setItem("ezlong:lastPage", bootTarget); } catch (error) { /* 무시 */ }
  if (bootTarget === "ezlong") {
    window.setTimeout(function () {
      try { goToPage(1); } catch (error) { /* 전환 실패는 무시 — 문장 화면 유지 */ }
    }, 900);
  }
})();


// ══════════════════════════════════════════════════════════════════
// 첫 실행 — 첫 화면 선택 (2026-08-05 운영 요청)
// ══════════════════════════════════════════════════════════════════
// 언제 뜨는가: 이 기기에서 아직 한 번도 답하지 않았을 때만, 딱 한 번.
//   · 이미 설정에서 첫 화면을 고른 적이 있는 사람에게는 묻지 않는다
//     (ezlong:startPage 값이 있으면 '이미 답한 것'으로 본다).
//   · 브랜드 시작 화면(네이티브 오버레이)이 걷힌 뒤에 올라온다 — 두 개가
//     겹치면 어느 쪽도 인상에 남지 않는다.
//
// 조작감: 카드 선택은 pointerdown에서 즉시 반응하고(§1), 같은 순간에
// 햅틱을 울린다(§13 harmony — 시각과 촉각이 같은 프레임에).
(function setupFirstRunChoice() {
  // 2026-08-05 재발 방지 — 이 스크립트가 시트 마크업보다 먼저 실행되는 순간이
  // 한 번 있었다(그때는 조용히 아무 일도 일어나지 않았다). 마크업 위치를
  // 바로잡았지만, 순서가 다시 어긋나도 동작하도록 DOM 완성을 기다린다.
  if (document.readyState === "loading" && !document.getElementById("firstRunSheet")) {
    document.addEventListener("DOMContentLoaded", setupFirstRunChoice, { once: true });
    return;
  }
  const ASKED_KEY = "ezlong:startPageAsked";
  const sheet = document.getElementById("firstRunSheet");
  if (!sheet) return;

  let answered = false;
  try {
    answered = localStorage.getItem(ASKED_KEY) === "1"
      || localStorage.getItem(startPageStorageKey) !== null;
  } catch (error) {
    answered = false;
  }
  if (answered) return;

  const cardQuote = document.getElementById("firstRunQuote");
  const cardEzlong = document.getElementById("firstRunEzlong");
  const cta = document.getElementById("firstRunStart");
  if (!cardQuote || !cardEzlong || !cta) return;

  // 미리보기 사진 — 이 기기의 언어로 찍은 실제 화면을 건다.
  // 지원 밖 언어는 영어판으로(로케일 해석 규칙과 같은 원칙).
  (function mountFirstRunShots() {
    // 2026-08-11 — 여기가 비한국어 사용자에게 한국어 사진을 보여주고 있었다.
    //   이유: 이 시트는 **첫 실행**에만 뜨는데, 그때 localStorage 의
    //   `flipzen.locale` 은 아직 비어 있다(사용자가 설정에서 고른 적이 없으니까).
    //   그러면 <html lang> 으로 떨어지는데, 그 값을 채워주는
    //   applyStaticTranslations() 는 DOMContentLoaded 에서 돌고 이 IIFE 는
    //   파싱 시점에 돌기 때문에, 항상 index.html 의 기본값 lang="ko" 가 읽혔다.
    //   결과로 일본·중국·스페인·브라질 사용자가 앱을 처음 열었을 때
    //   본 첫 화면이 한국어 사진이었다. 글로벌 언어 결함은 제1 문제다(CLAUDE.md).
    //   고침: DOM 을 거치지 않고 이미 확정된 FZ_LOCALE 을 그대로 쓴다.
    const SUPPORTED = ["ko", "en", "ja", "zh", "es", "pt"];
    let tag = "";
    try { tag = localStorage.getItem("flipzen.locale") || ""; } catch (error) { tag = ""; }
    if (!tag) tag = (typeof FZ_LOCALE === "string" && FZ_LOCALE) || "";
    if (!tag) tag = document.documentElement.getAttribute("lang") || "";
    const base = String(tag).toLowerCase().split(/[-_]/)[0];
    const loc = SUPPORTED.indexOf(base) >= 0 ? base : "en";
    [["firstRunShotQuote", "basecamp"], ["firstRunShotEzlong", "ezlong"]].forEach(function (pair) {
      const img = document.getElementById(pair[0]);
      if (!img) return;
      img.addEventListener("load", function () { img.classList.add("is-ready"); }, { once: true });
      img.addEventListener("error", function () {
        // 그 언어 사진이 없으면 영어판으로 한 번만 되짚는다(무한 루프 방지).
        if (img.dataset.fallback === "1") return;
        img.dataset.fallback = "1";
        img.src = "assets/firstrun/en-" + pair[1] + ".webp?v=2";
      }, { once: true });
      img.src = "assets/firstrun/" + loc + "-" + pair[1] + ".webp?v=2";
    });
  })();

  let choice = "quote"; // 기본값 — 문장 화면(기존 동작과 동일)

  function paint() {
    const pairs = [[cardQuote, "quote"], [cardEzlong, "ezlong"]];
    pairs.forEach(([el, value]) => {
      const on = choice === value;
      el.classList.toggle("is-selected", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function select(value) {
    if (choice === value) return;
    choice = value;
    paint();
    try { postToNativeHaptic("light"); } catch (error) { /* 진동 실패는 무시 */ }
  }

  // 응답은 눌리는 순간에. click까지 기다리면 손끝에서 반 박자 늦게 느껴진다.
  cardQuote.addEventListener("pointerdown", () => select("quote"));
  cardEzlong.addEventListener("pointerdown", () => select("ezlong"));
  // 키보드/보조기술 경로도 막지 않는다.
  cardQuote.addEventListener("click", () => select("quote"));
  cardEzlong.addEventListener("click", () => select("ezlong"));

  function open() {
    sheet.hidden = false;
    // 다음 프레임에 클래스를 붙여야 전환이 실제로 재생된다.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      sheet.classList.add("is-open");
      try { cta.focus({ preventScroll: true }); } catch (error) { /* 무시 */ }
    }));
  }

  function close() {
    sheet.classList.remove("is-open");
    sheet.classList.add("is-closing");
    window.setTimeout(() => {
      sheet.hidden = true;
      sheet.classList.remove("is-closing");
    }, 420);
  }

  cta.addEventListener("click", () => {
    try { saveStartPage(choice); } catch (error) { /* 무시 */ }
    try { localStorage.setItem(ASKED_KEY, "1"); } catch (error) { /* 무시 */ }
    try { postToNativeHaptic("light"); } catch (error) { /* 무시 */ }
    if (typeof window.syncStartPageUi === "function") {
      try { window.syncStartPageUi(); } catch (error) { /* 무시 */ }
    }
    close();
    if (choice === "ezlong") {
      // 시트가 내려가는 길과 화면 전환이 겹치지 않게 한 박자 뒤에.
      window.setTimeout(() => {
        try { goToPage(1); } catch (error) { /* 전환 실패는 무시 */ }
      }, 320);
    }
  });

  paint();
  // 브랜드 시작 화면이 걷히는 시간(네이티브 onPageFinished)을 지나서.
  window.setTimeout(open, 1150);
})();


// ══════════════════════════════════════════════════════════════════
// 음악 패널(비주얼라이저) 기본 노출 — 2026-08-05 운영 요청
// ══════════════════════════════════════════════════════════════════
// 왜 부팅 직후가 아니라 조금 뒤인가. 플립시계·날씨·문장이 먼저 자리를 잡은
// 다음에 비주얼라이저가 "합류"해야 화면이 어수선하지 않다. 첫 실행 시트가
// 떠 있는 경우에는 그 뒤에서 조용히 열려, 시트를 닫는 순간 이미 켜져 있다.
(function restoreMusicPanelDefault() {
  function apply() {
    try {
      if (!loadMusicPanelPreferredOpen()) return;
      if (typeof isMusicPanelOpen === "function" && isMusicPanelOpen()) return;
      // persist=false — 부팅 직후의 기본 노출은 사용자의 선택이 아니다.
      // (setMusicPanelOpen 주석의 원칙 — 자동 조작을 취향으로 기억하지 않는다.)
      setMusicPanelOpen(true, false);
      // 그리고 10초 시계를 돌린다 — 아직 토글을 손으로 만져본 적 없는 사람한테만.
      startVizOnboardCountdown();
    } catch (error) {
      // 패널 복원 실패는 앱 사용을 막지 않는다 — 조용히 넘어간다.
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      window.setTimeout(apply, 900);
    }, { once: true });
  } else {
    window.setTimeout(apply, 900);
  }
})();


// ══════════════════════════════════════════════════════════════════
// 침대맡 모드 — 2026-08-05 (Fable 5 배터리 지시서 작업 5-2)
// ══════════════════════════════════════════════════════════════════
// 7/26 실측 결론: iOS 배터리 폭식의 주범은 화면(디스플레이+GPU)이다.
// 백그라운드가 11분뿐인 날이 점유율 96%로 최고였다. 이 앱은 침대맡에
// 세워두고 밤새 켜두는 앱이니, 손대지 않는 동안 화면을 어둡게 하고 화면
// 위에서 도는 것을 멈추는 것이 가장 큰 한 수다.
//
// 설계 원칙
//   · 강요하지 않는다 — 설정에서 시간을 고르거나 아예 끌 수 있다(기본 3분).
//   · 깨우는 건 아무 터치 하나. 그 첫 터치는 장막이 삼킨다 — 어두운 화면을
//     깨우려다 '다음 곡'을 잘못 누르는 일이 없어야 한다.
//   · 설정 시트나 날씨 상세를 열어둔 동안에는 잠들지 않는다(읽는 중이다).
//   · 음악은 건드리지 않는다. 어두워져도 소리는 계속 난다 — 그게 이 앱이다.
var bedsideActive = false;
(function setupBedsideMode() {
  // 2026-08-06 운영 지침 — "침대맡 모드 설정 불필요. 충전 중엔 사용 안 함,
  // 비충전일 땐 3분." 고를 것이 없으면 고민할 것도 없다. 설정 화면에서
  // 항목을 빼고 값을 3분으로 못 박는다.
  //
  // ★ 예전에 저장해 둔 값(1·5·10·off)은 일부러 무시한다 ★ 설정 항목이
  // 사라진 마당에 옛 선택이 살아 있으면, 사용자는 어디서도 바꿀 수 없는
  // 상태에 갇힌다. 특히 "off"로 두었던 사람은 절전이 영영 안 걸린다.
  // localStorage 키는 지우지 않는다 — 나중에 설정을 되살릴 일이 생기면
  // 그때 다시 읽으면 된다.
  var DEFAULT_DELAY = "3";
  var veil = document.getElementById("bedsideVeil");
  var timer = null;

  function loadDelay() {
    return DEFAULT_DELAY;   // 항상 3분. 충전 중이면 shouldDim()이 따로 막는다.
  }

  // 2026-08-05 운영 피드백 — 충전 중에는 어두워지지 않는다.
  // 침대맡 모드의 존재 이유가 배터리 절약인데, 전기가 들어오는 동안에는
  // 아낄 이유가 없다. 판정은 비주얼라이저 보호와 같은 함수를 쓴다 —
  // 기준이 한 곳에만 있어야 두 기능이 어긋나지 않는다.
  function chargingNow() {
    try {
      if (typeof window.__flipzenIsCharging === "function") return window.__flipzenIsCharging();
    } catch (error) { /* 무시 */ }
    return false;
  }
  // 2026-08-05 2차 — 운영자 재제보: "아이폰은 충전 중인데도 어두워진다."
  // 아이폰 1.2에는 충전 브릿지가 없어 충전 여부가 '모름'인데, 모름을
  // 비충전으로 간주해 어둡게 만들고 있었다. 비주얼라이저 규칙은 이미
  // "확실히 비충전일 때만"으로 고쳤는데 침대맡 모드만 옛 기준으로 남아
  // 있었다 — 같은 기준으로 통일한다. 규칙이 두 개면 반드시 어긋난다.
  // 안드로이드는 지금도 정확히 알고, 아이폰은 1.3부터 정확해진다.
  function shouldDim() {
    try {
      if (typeof window.__flipzenKnownNotCharging === "function") {
        return window.__flipzenKnownNotCharging();
      }
    } catch (error) { /* 무시 */ }
    return false;   // 모르면 어둡게 하지 않는다
  }

  // 2026-08-10 — "충전 중인데도 어두워진다"가 두 번 재발했다. 두 번 다 원인이
  // 달랐고, 두 번 다 "고쳤다"고 말한 뒤에 다시 나왔다. 판정의 근거가 화면
  // 밖에 있어서 눈으로 확인할 길이 없었던 것이 진짜 문제다.
  // 그래서 앱이 뜰 때 한 번, 무엇을 근거로 어떻게 판정했는지 콘솔에 남긴다.
  // 사용자 화면에는 아무 영향이 없고(콘솔뿐), 다음에 또 재발하면 추측 대신
  // 이 한 줄을 읽으면 된다. 진단 도구를 남겨두는 비용보다 같은 버그를 세 번
  // 쫓는 비용이 크다.
  window.setTimeout(function () {
    // 로그 문자열은 일부러 전부 영문이다. 한국어로 쓰면 문자열 감사기가
    // "번역 안 된 화면 문구"로 잡아 verify:i18n 이 빨간불이 된다 —
    // IGNORE 목록으로 덮는 대신 애초에 걸리지 않게 쓴다. 개발자만 보는 줄이라
    // 영문이어도 잃는 것이 없다.
    var src = "unknown";
    var val = null;
    try {
      if (window.AndroidNativeBridge && typeof window.AndroidNativeBridge.isCharging === "function") {
        src = "android-bridge";
        val = window.AndroidNativeBridge.isCharging();
      } else if (typeof window.__FLIPZEN_CHARGING__ === "boolean") {
        src = "native-injected";
        val = String(window.__FLIPZEN_CHARGING__);
      } else if (navigator.getBattery) {
        src = "web-battery-api";
      }
    } catch (error) { src = "lookup-failed"; }
    console.log("[FZ-CHARGE] source=" + src + " value=" + val +
      " willDim=" + shouldDim() + " bedsideDelayMin=" + loadDelay());
  }, 2500);

  // 지금 잠들면 안 되는 상황인가 — 뭔가를 읽고 있는 중이면 기다린다.
  function busyReading() {
    try {
      if (settingsPanel && settingsPanel.classList.contains("is-open")) return true;
      var wd = document.getElementById("weatherDetailPanel");
      if (wd && wd.getBoundingClientRect().height > 200) return true;
      var fr = document.getElementById("firstRunSheet");
      if (fr && !fr.hidden) return true;
      if (currentPageIndex >= 1) return true;   // ezlong.com 페이지를 보는 중
    } catch (error) { /* 판단 실패 시엔 그냥 진행 */ }
    return false;
  }

  function enter() {
    if (bedsideActive) return;
    // 확실히 비충전일 때만 잠든다. 충전 중이거나 충전 여부를 모르면
    // 타이머만 다시 세워 두었다가, 상황이 바뀌면 그때 다시 센다.
    if (!shouldDim()) { arm(); return; }
    if (busyReading()) { arm(); return; }
    bedsideActive = true;
    document.body.classList.remove("is-bedside-waking");
    document.body.classList.add("is-bedside");
    // 비주얼라이저 루프는 다음 프레임에 스스로 멈춘다
    // (isMusicVizActiveContext가 false를 돌려준다).
  }

  function exit() {
    if (!bedsideActive) return;
    bedsideActive = false;
    document.body.classList.add("is-bedside-waking");
    document.body.classList.remove("is-bedside");
    window.setTimeout(function () {
      document.body.classList.remove("is-bedside-waking");
    }, 260);
    // 멈춰 있던 비주얼라이저를 다시 돌린다.
    try {
      if (typeof isMusicVizActiveContext === "function" && isMusicVizActiveContext()
          && !musicVizAnimId) drawMusicViz();
    } catch (error) { /* 무시 */ }
    try { postToNativeHaptic("light"); } catch (error) { /* 무시 */ }
  }

  // 2026-08-05 운영 요청 — 침대맡 모드 앞에 "얕은 절전" 한 단계를 더 둔다.
  // 무조작 30초가 지나면 콜론 깜빡임(1초)과 시계 숨쉬기(4초)를 멈춘다.
  // 이 둘은 비용 자체는 작지만 **매초 화면 합성을 깨우는** 성격이라, 가만히
  // 두는 시간이 긴 침대맡 앱에서는 쌓이면 무시하기 어렵다. 시각적으로는
  // 시계가 조용해질 뿐 정보는 하나도 줄지 않는다 — 시간은 그대로 보인다.
  // 손을 대는 순간 즉시 되살아난다. 충전 여부와 무관하게 적용한다(이건
  // 배터리 절약이자, 밤에 눈에 덜 거슬리는 쪽이기도 하다).
  var LOWMOTION_MS = 30000;
  var lowTimer = null;

  function armLowMotion() {
    if (lowTimer) { window.clearTimeout(lowTimer); lowTimer = null; }
    document.body.classList.remove("is-lowmotion");
    lowTimer = window.setTimeout(function () {
      // 2026-08-05 운영 피드백 — 충전 중에는 아낄 이유가 없다.
      // 판정은 침대맡 모드와 같은 함수(shouldDim = 확실히 비충전일 때만).
      // 규칙이 두 개면 반드시 어긋나므로 기준은 하나만 둔다.
      if (!shouldDim()) return;
      document.body.classList.add("is-lowmotion");
    }, LOWMOTION_MS);
  }

  function arm() {
    armLowMotion();
    if (timer) { window.clearTimeout(timer); timer = null; }
    var d = loadDelay();
    if (d === "off") return;
    timer = window.setTimeout(enter, parseInt(d, 10) * 60000);
  }

  function poke() {
    if (bedsideActive) exit();
    arm();
  }

  // 깨우는 첫 터치는 장막이 삼킨다 — 밑의 버튼으로 새어나가지 않게.
  if (veil) {
    ["pointerdown", "touchstart", "click"].forEach(function (type) {
      veil.addEventListener(type, function (event) {
        event.preventDefault();
        event.stopPropagation();
        exit();
        arm();
      }, { capture: true });
    });
  }

  // 평소의 조작은 전부 "아직 깨어 있다"는 신호다.
  ["pointerdown", "keydown", "wheel", "touchstart"].forEach(function (type) {
    document.addEventListener(type, function () {
      if (!bedsideActive) arm();
    }, { passive: true, capture: true });
  });

  // 화면이 꺼졌다 다시 켜지면 타이머를 새로 센다.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") poke();
  });

  // 2026-08-05 — 어두워진 상태에서 충전기를 꽂으면 스스로 밝아진다.
  // 손을 대지 않아도 된다 — 꽂는 행위 자체가 "계속 볼 거야"라는 뜻이다.
  // 배터리 이벤트를 직접 듣지 않고 10초마다 확인하는 이유: 충전 신호가
  // 오는 경로가 셋(네이티브 훅 / Battery API / 값 없음)이라, 어느 경로로
  // 바뀌었든 똑같이 걸리는 단순한 방법이 빠뜨림이 없다. 어두운 동안에만
  // 도는 확인이라 비용도 사실상 없다.
  window.setInterval(function () {
    if (bedsideActive && !shouldDim()) exit();
    // 충전기를 꽂으면 얕은 절전도 함께 풀린다(콜론·숨쉬기가 다시 살아난다).
    if (!shouldDim()) document.body.classList.remove("is-lowmotion");
  }, 10000);

  // 설정 UI 는 없앴다(2026-08-06). 다른 코드가 window.syncBedsideUi 를
  // 부를 수 있으므로 빈 함수만 남겨 둔다 — 없애면 그쪽에서 터진다.
  window.syncBedsideUi = function () {};

  arm();
})();


// ══════════════════════════════════════════════════════════════════
// ezlong.com 하단바 — 뒤로(<) / 맨 위로(^)  2026-08-05 운영 요청
// ══════════════════════════════════════════════════════════════════
// 부모가 iframe 안의 history/scroll을 직접 만지지 않고 postMessage로
// 부탁한다 — 스크롤톱 때 깔아둔 통로(ez-nav.js)를 그대로 재사용한다.
// 같은 출처라 직접 호출도 되지만, 사용자가 iframe 안에서 외부 사이트로
// 넘어간 순간 막힌다. 메시지는 어느 쪽이든 안전하다.
(function setupWebviewFooterNav() {
  // 부모가 iframe의 이동 기록을 직접 적는다. 브라우저 히스토리를 쓰지 않는
  // 이유는 이 파일 상단 주석(patch-footer2)과 같다 — iframe의 back()은
  // 합동 세션 히스토리를 되감아서 앱 자체를 뒤로 보낼 수 있다.
  var trail = [];          // 이 화면에 머무는 동안 iframe이 지나온 주소들
  var goingBack = false;   // 되돌아가는 중의 load는 기록하지 않는다

  function ezFrame() {
    var section = document.querySelector(".ezlong-webview");
    return section ? section.querySelector(".ezlong-frame") : null;
  }
  function ask(action) {
    var frame = ezFrame();
    if (!frame || !frame.contentWindow) return;
    try {
      frame.contentWindow.postMessage({ source: "flipzen-app", action: action }, "https://ezlong.com");
    } catch (error) { /* 막혀도 앱 동작에는 영향 없음 */ }
  }
  function currentUrl(frame) {
    // 같은 출처면 읽힌다. 외부 사이트로 넘어갔으면 예외가 난다 — 그때는
    // 주소를 모르는 채로 두고, 되돌아갈 때 마지막으로 알던 곳으로 간다.
    try { return frame.contentWindow.location.href; } catch (error) { return null; }
  }

  function syncBackButton() {
    var btn = document.getElementById("webviewHistoryBack");
    if (!btn) return;
    var can = trail.length > 1;
    btn.classList.toggle("is-dead", !can);
    btn.setAttribute("aria-disabled", can ? "false" : "true");
  }

  var frame = ezFrame();
  if (frame) {
    frame.addEventListener("load", function () {
      if (goingBack) { goingBack = false; syncBackButton(); return; }
      var url = currentUrl(frame);
      if (!url) { syncBackButton(); return; }              // 외부 사이트 — 기록 못 함
      if (trail.length && trail[trail.length - 1] === url) { syncBackButton(); return; }
      trail.push(url);
      if (trail.length > 40) trail.shift();                // 무한정 쌓지 않는다
      syncBackButton();
    });
  }

  var backBtn = document.getElementById("webviewHistoryBack");
  if (backBtn) {
    backBtn.addEventListener("click", function () {
      var f = ezFrame();
      if (!f) return;
      if (trail.length <= 1) return;                       // 돌아갈 곳이 없다
      try { postToNativeHaptic("light"); } catch (error) { /* 무시 */ }
      trail.pop();
      var target = trail[trail.length - 1];
      goingBack = true;
      // replace는 새 기록을 남기지 않는다 — 합동 히스토리를 건드리지 않으므로
      // 앱(부모)은 이 이동에 아무 영향도 받지 않는다.
      var moved = false;
      try {
        if (f.contentWindow && f.contentWindow.location) {
          f.contentWindow.location.replace(target);
          moved = true;
        }
      } catch (error) { /* 외부 사이트에 있었다 — 아래로 폴백 */ }
      if (!moved) {
        try { f.src = target; } catch (error) { goingBack = false; }
      }
      syncBackButton();
    });
  }

  var topBtn = document.getElementById("webviewTopButton");
  if (topBtn) {
    topBtn.addEventListener("click", function () {
      try { postToNativeHaptic("light"); } catch (error) { /* 무시 */ }
      var f = ezFrame();
      var done = false;
      // 같은 출처면 직접 올리는 쪽이 확실하다(ez-nav.js 버전에 의존하지 않는다).
      try {
        if (f && f.contentWindow && f.contentWindow.scrollTo) {
          f.contentWindow.scrollTo({ top: 0, behavior: "smooth" });
          done = true;
        }
      } catch (error) { /* 외부 사이트 — 메시지로 부탁한다 */ }
      if (!done) ask("scrollToTop");
    });
  }

  syncBackButton();
})();


// 2026-08-05 — 비주얼라이저 한가운데의 큰 재생 버튼. 작은 ▶를 정확히
// 겨누지 않아도, 비주얼라이저 한가운데를 누르면 음악이 시작된다.
(function setupVizPlayCue() {
  var cue = document.getElementById("vizPlayCue");
  if (!cue) return;
  cue.addEventListener("click", function (event) {
    // 패널 자체의 클릭 핸들러(stopPropagation)와 얽히지 않게 여기서 끊는다.
    event.stopPropagation();
    try { postToNativeHaptic("light"); } catch (error) { /* 무시 */ }
    try { toggleMusic(); } catch (error) { /* 무시 */ }
  });
  // 부팅 직후 한 번 — 이미 재생 중인 상태로 복원됐을 수 있다.
  try {
    if (musicInfoPanel && typeof musicPlaying !== "undefined") {
      musicInfoPanel.classList.toggle("is-music-playing", !!musicPlaying);
    }
  } catch (error) { /* 무시 */ }
})();


// ══════════════════════════════════════════════════════════════════
// 비충전 상태의 비주얼라이저 자동 접기 — 2026-08-05 운영자 제안
// ══════════════════════════════════════════════════════════════════
// 처음 몇 곡은 보여주고(발견), 그 뒤에는 조용히 접는다(절전).
// 충전 중이면 접지 않는다 — 전기가 들어오는 동안은 아낄 이유가 없다.
(function setupVizBatteryGuard() {
  var SONGS_BEFORE_COLLAPSE = 3;   // "몇 곡" — 세 곡이면 충분히 봤다
  var NOTE_MS = 10000;             // 안내는 10초
  var note = document.getElementById("vizGuardNote");
  var titleEl = document.getElementById("musicTrackTitle");
  if (!musicInfoPanel) return;

  var songsSinceOpen = 0;
  var lastTitle = "";
  var noteTimer = null;
  var batteryCharging = null;      // true | false | null(모름)

  // ── 충전 여부 ────────────────────────────────────────────────────
  // 네이티브가 알려준 값이 최우선이다(iOS 1.3에서 채워줄 예정).
  // 그 다음이 Battery Status API. 둘 다 없으면 "모름"이고, 모름은
  // 비충전으로 간주한다 — 배터리에 보수적인 쪽이 안전하다.
  // 2026-08-10 — 안드로이드는 "물어본다". 네이티브가 밀어 넣는 값은 타이밍에
  // 기대서, 페이지가 갈아엎이면 통째로 사라진다(운영자 재제보의 원인).
  // 물어보는 경로는 언제 불러도 그 순간의 사실을 준다.
  function androidChargingNow() {
    try {
      var b = window.AndroidNativeBridge;
      if (b && typeof b.isCharging === "function") {
        var v = b.isCharging();
        if (v === "true") return true;
        if (v === "false") return false;
      }
    } catch (error) { /* 무시 */ }
    return null;   // 브릿지가 없거나(웹·아이폰) 조회 실패면 모름
  }

  function isCharging() {
    var asked = androidChargingNow();
    if (asked !== null) return asked;
    try {
      if (typeof window.__FLIPZEN_CHARGING__ === "boolean") return window.__FLIPZEN_CHARGING__;
    } catch (error) { /* 무시 */ }
    return batteryCharging === true;
  }
  // 2026-08-05 — 충전 판정은 이 한 곳에서만 한다. 음악 자동 일시정지 상한
  // (musicAutoPauseLimitMs)도 같은 판정을 써야 규칙이 어긋나지 않는다.
  window.__flipzenIsCharging = isCharging;
  // 2026-08-05 — 충전 여부를 "확실히" 아는가. 네이티브 브릿지가 값을
  // 채워줬거나 Battery Status API가 답을 준 경우에만 true. 둘 다 없으면
  // (브릿지 없는 구버전 iOS 등) 모름이고, 모름일 때는 아무 규칙도
  // 적용하지 않는다 — 사실이 아닐 수 있는 이유로 기능을 뺏지 않는다.
  function chargingKnown() {
    if (androidChargingNow() !== null) return true;
    try {
      if (typeof window.__FLIPZEN_CHARGING__ === "boolean") return true;
    } catch (error) { /* 무시 */ }
    return batteryCharging !== null;
  }
  function knownNotCharging() {
    return chargingKnown() && !isCharging();
  }
  window.__flipzenKnownNotCharging = knownNotCharging;
  // 2026-08-05 — 네이티브(iOS)가 충전 상태를 알려줄 때 즉시 반응한다.
  // 꽂는 순간 그동안 센 곡 수는 없던 일로 한다 — 전기가 들어오는데
  // 접을 이유가 없다.
  window.__flipzenChargingChanged = function (charging) {
    try {
      if (charging) songsSinceOpen = 0;
    } catch (error) { /* 무시 */ }
  };
  try {
    if (navigator.getBattery) {
      navigator.getBattery().then(function (b) {
        batteryCharging = !!b.charging;
        b.addEventListener("chargingchange", function () {
          batteryCharging = !!b.charging;
          if (batteryCharging) songsSinceOpen = 0; // 꽂는 순간 카운트는 없던 일로
        });
      }).catch(function () { /* 무시 */ });
    }
  } catch (error) { /* 무시 */ }

  // ── 안내 문구 ────────────────────────────────────────────────────
  function showGuardNote() {
    if (!note) return;
    note.textContent = t("music.vizChargingHint", null,
      "비주얼라이저는 충전 중에 사용하시길 권합니다. 배터리를 빠르게 씁니다.");
    note.hidden = false;
    musicInfoPanel.classList.add("is-guard-note");
    // 다음 프레임에 클래스를 붙여야 전환이 실제로 재생된다.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { note.classList.add("is-shown"); });
    });
    if (noteTimer) window.clearTimeout(noteTimer);
    noteTimer = window.setTimeout(function () {
      note.classList.remove("is-shown");
      musicInfoPanel.classList.remove("is-guard-note");
      window.setTimeout(function () { note.hidden = true; }, 320);
    }, NOTE_MS);
  }

  // ── 곡이 바뀔 때마다 센다 ────────────────────────────────────────
  // 내부 재생 함수에 갈고리를 거는 대신 제목 변화를 본다. 곡 전환 경로가
  // 여럿(수동 스킵/크로스페이드/네이티브 autoAdvanced)이라, 어느 길로
  // 왔든 결국 제목이 바뀐다는 사실 하나만 보는 편이 빠뜨림이 없다.
  function onSongChanged() {
    if (!isMusicPanelOpen()) return;
    // 2026-08-05 — 확실히 비충전일 때만 센다. 충전 중이거나, 충전 여부를
    // 아예 모르는 기기(브릿지 없는 구버전 iOS)에서는 손대지 않는다.
    if (!knownNotCharging()) { songsSinceOpen = 0; return; }
    songsSinceOpen += 1;
    if (songsSinceOpen >= SONGS_BEFORE_COLLAPSE) {
      songsSinceOpen = 0;
      // persist=false — 이건 사용자의 선택이 아니라 배터리 보호다.
      try { setMusicPanelOpen(false, false); } catch (error) { /* 무시 */ }
    }
  }

  if (titleEl && typeof MutationObserver === "function") {
    lastTitle = (titleEl.textContent || "").trim();
    new MutationObserver(function () {
      var now = (titleEl.textContent || "").trim();
      if (!now || now === lastTitle) return;
      lastTitle = now;
      onSongChanged();
    }).observe(titleEl, { childList: true, characterData: true, subtree: true });
  }

  // ── 사용자가 손으로 다시 펼쳤을 때만 안내한다 ────────────────────
  // 부팅 직후의 기본 노출에서는 뜨지 않는다 — 매번 뜨면 잔소리가 된다.
  var noteBtn = document.getElementById("musicSettingsOpen");
  if (noteBtn) {
    noteBtn.addEventListener("click", function () {
      // 이 핸들러는 handleMusicIconTap 다음에 붙으므로, 이 시점의 패널
      // 상태가 곧 "방금 펼쳤는가"다.
      window.setTimeout(function () {
        if (!isMusicPanelOpen()) return;
        songsSinceOpen = 0;
        // 모르면 안내하지 않는다 — 사실이 아닐 수 있는 이유로 잔소리하지 않는다.
        if (knownNotCharging()) showGuardNote();
      }, 0);
    });
  }
})();


// 2026-08-05 — 위 게이트로 잠든 비주얼라이저를 "돌아왔을 때" 다시 깨운다.
// 잠들게 하는 조건이 세 가지(비가시 / 2페이지 / 침대맡)이므로, 깨우는
// 신호도 그만큼 필요하다. 조건 판정은 isMusicVizActiveContext 한 곳에만
// 있으니, 여기서는 "지금 다시 봐 달라"고 두드리기만 하면 된다.
(function setupVizWakeSignals() {
  function wake() {
    try {
      if (isMusicVizActiveContext() && !musicVizAnimId) drawMusicViz();
    } catch (error) { /* 무시 */ }
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") window.setTimeout(wake, 60);
  });
  window.addEventListener("pageshow", function () { window.setTimeout(wake, 60); });
  // 페이지 전환(1↔2)은 transform 애니메이션이라 이벤트가 따로 없다.
  // goToPage가 부르는 광고 브릿지에 얹지 않고, 여기서 가볍게 감시한다 —
  // 1초에 한 번, 깨어날 조건이 갖춰졌는데 루프가 멈춰 있으면 깨운다.
  // (조건이 안 맞으면 아무 일도 하지 않으므로 비용이 사실상 없다.)
  window.setInterval(function () {
    if (!musicVizAnimId) wake();
  }, 1000);
})();


// 2026-08-05 — 화면을 오가는 두 버튼의 "초대"는 한 번이면 된다.
// 한 번이라도 눌러본 기기는 다음 실행부터 딱 한 번만 인사하고 멈춘다.
(function setupNavInviteLearning() {
  var KEY = "ezlong:navLearned";
  var learned = false;
  try { learned = localStorage.getItem(KEY) === "1"; } catch (error) { learned = false; }
  if (learned) document.body.classList.add("nav-learned");

  function markUsed() {
    if (!learned) {
      learned = true;
      try { localStorage.setItem(KEY, "1"); } catch (error) { /* 무시 */ }
    }
    // 방금 쓴 사람에게 계속 권하는 건 실례다 — 이번 실행에서는 바로 멈춘다.
    document.body.classList.add("nav-used");
  }

  ["sceneEzlongLink", "webviewBackButton"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("click", markUsed);
  });
})();


// 2026-08-05 운영 피드백 — 안드로이드의 플립시계 숫자가 플립시계에 어울리지
// 않는다. 원인은 폰트다. 이 앱의 글꼴 스택은 -apple-system → SF Pro Display
// 순인데, 안드로이드에는 그 둘이 없어 결국 sans-serif(=Roboto)로 떨어진다.
// SF Pro는 애플 전용이라 웹폰트로 실어 나를 수 없다(라이선스). 그래서
// 운영자가 주신 대안대로 안드로이드에서는 크기를 10% 줄인다 — Roboto의
// 숫자는 SF보다 폭이 넓고 무거워서, 같은 크기로 두면 카드를 꽉 채워
// "플립시계 숫자판"이 아니라 "글자 상자"처럼 보인다.
// 굵기도 760(합성 굵기, Roboto에는 그 굵기가 없어 브라우저가 억지로
// 늘린다)에서 700(Roboto Bold 실물)으로 내린다 — 합성 굵기는 획이 뭉개진다.
(function markAndroidForClockFont() {
  try {
    if (!/Android/i.test(navigator.userAgent)) return;
    document.body.classList.add("is-android");
    // 2026-08-05 2차 — 운영 요청으로 Inter(무료, SIL 오픈폰트 라이선스)를
    // 숫자 열 개와 콜론만 잘라낸 3.3KB짜리 파일로 실어 붙인다. SF Pro와
    // 비례가 가장 가까운 무료 글꼴이다.
    //
    // ★ 원복 방법 ★ — 아래 한 줄의 "inter"를 "system"으로 바꾸면 끝난다.
    //   (기기에서 즉시 되돌리려면 localStorage 에
    //    ezlong:clockFont = "system" 을 넣으면 된다. 그 값이 항상 우선한다.)
    // 2026-08-05 운영 판단 — Inter보다 직전(10% 축소한 Roboto)이 낫다.
    // 파일과 규칙은 남겨둔다. "inter"로 바꾸면 언제든 다시 볼 수 있다.
    var DEFAULT_CLOCK_FONT = "system";    // "inter" | "system"
    var choice = DEFAULT_CLOCK_FONT;
    try {
      var saved = localStorage.getItem("ezlong:clockFont");
      if (saved === "inter" || saved === "system") choice = saved;
    } catch (error) { /* 무시 */ }
    if (choice === "inter") document.body.classList.add("clockfont-inter");
  } catch (error) { /* 무시 */ }
})();


// ══════════════════════════════════════════════════════════════════
// 네이티브 재생 정체 감시 — 2026-08-05 (웹 응급조치)
// ══════════════════════════════════════════════════════════════════
// 이슈 제보: 아이폰에서 음악이 진행되지 않고 "뿌우~~~" 하는 소리만
// 반복되는데, 다음 곡을 누르면 즉시 정상으로 돌아온다.
//
// 녹화 음성을 뜯어보니 11.7초 내내 음량이 완전히 일정했고(RMS 289~338),
// 220Hz 기본음에 660Hz 3배음이 얹힌 인공적인 파형이었다. 아주 짧은 조각
// (약 4.5ms)을 무한 반복하는 소리다 — 디코더가 굶었는데 출력은 계속
// 돌아서 마지막 버퍼를 되풀이하는, 전형적인 재생 파이프라인 정체다.
//
// 왜 스스로 못 빠져나오는가. 웹에는 이미 정체 감시(checkMusicStallWatchdog)가
// 있는데 첫 줄이 `if (isNativeWrapper) return;` 이다 — 네이티브 앱에서는
// 통째로 꺼져 있었다. 그리고 네이티브 쪽에는 대응하는 감시가 없다.
// 그래서 한 번 굶으면 사용자가 직접 '다음 곡'을 누를 때까지 그대로다.
//
// 여기서는 웹이 할 수 있는 응급조치를 한다. 네이티브가 15Hz로 보내주는
// 오디오 레벨(저음/중음/고음)을 지켜본다. **같은 조각이 반복되면 레벨도
// 딱 얼어붙는다** — 진짜 음악은 8초 동안 세 값이 소수점까지 똑같을 수
// 없다. 얼어붙은 채 8초가 지나면 다음 곡으로 넘긴다.
//
// 곡을 하나 잃는 것은 아쉽지만, '뿌우' 소리를 계속 듣는 것보다는 낫다.
// 곡을 잃지 않고 같은 자리에서 이어붙이는 정식 복구는 네이티브의 몫이라
// 1.3(iOS)·1.0.7(안드로이드)에 넣는다.
(function setupNativeStallWatchdog() {
  if (!isNativeWrapper) return;
  var FROZEN_MS = 8000;        // 이만큼 얼어붙어 있으면 정체로 본다
  var COOLDOWN_MS = 30000;     // 구조는 30초에 한 번까지만(되풀이 방지)
  var EPS = 0.004;             // 이보다 작은 변화는 "안 움직인 것"
  var lastTriple = null;
  var frozenSince = 0;
  var lastRescueAt = 0;

  window.setInterval(function () {
    try {
      if (typeof musicPlaying === "undefined" || !musicPlaying) { frozenSince = 0; return; }
      // 레벨 브릿지가 살아 있을 때만 판단한다. 백그라운드에서는 브릿지가
      // 꺼져 있어(2026-07-26 작업3) 값이 안 오는데, 그걸 정체로 오해하면 안 된다.
      if (Date.now() - nativeAudioLevelReceivedAt > 2000) { frozenSince = 0; return; }

      var now = Date.now();
      var t = [nativeAudioBass, nativeAudioMid, nativeAudioTreble];
      var same = lastTriple
        && Math.abs(t[0] - lastTriple[0]) < EPS
        && Math.abs(t[1] - lastTriple[1]) < EPS
        && Math.abs(t[2] - lastTriple[2]) < EPS;
      lastTriple = t;

      if (!same) { frozenSince = 0; return; }
      if (!frozenSince) { frozenSince = now; return; }
      if (now - frozenSince < FROZEN_MS) return;
      if (now - lastRescueAt < COOLDOWN_MS) return;

      frozenSince = 0;
      lastRescueAt = now;
      console.warn("[FlipZen] 재생이 멈춘 것으로 판단 — 다음 곡으로 넘깁니다.");
      try { playNextTrack(); } catch (error) { /* 무시 */ }
    } catch (error) { /* 감시 실패가 재생을 막으면 안 된다 */ }
  }, 1000);
})();


// ══════════════════════════════════════════════════════════════════
// 비주얼라이저 레벨 브릿지 2단 게이트 — 웹 신호 (2026-08-05)
// ══════════════════════════════════════════════════════════════════
// 네이티브는 "앱이 화면에 떠 있는가"까지만 스스로 안다(1단, 2026-07-26).
// 하지만 앱이 떠 있어도 비주얼라이저를 아무도 안 보는 시간이 훨씬 길다 —
// 음악이 멈춰 있을 때, ezlong.com 페이지를 보고 있을 때, 침대맡 모드로
// 화면이 어두울 때, 패널이 접혀 있을 때. 그건 웹만 안다. 그래서 알려준다.
//
// 판단은 isMusicVizActiveContext()가 이미 하고 있다(오늘 하루 조건을 모두
// 모아둔 곳이다). 여기서는 그 결과가 바뀔 때만 네이티브에 한 줄 보낸다.
// 매번 보내지 않는 이유 — 신호 자체가 프로세스 경계를 넘는 비용이라,
// 아끼자고 만든 장치가 새 낭비가 되면 안 된다.
//
// 네이티브 하위호환: 이 신호를 한 번이라도 받은 뒤에만 지시를 따르고,
// 받은 적 없으면 예전처럼 항상 켜둔다. 그래서 구버전 앱(iOS 1.2 등)에서는
// 이 메시지가 그냥 무시되고 아무 일도 일어나지 않는다.
(function setupVizStreamGate() {
  if (!isNativeWrapper) return;
  var lastSent = null;
  function evaluate() {
    var on;
    try {
      on = !!(isMusicVizActiveContext() && typeof musicPlaying !== "undefined" && musicPlaying);
    } catch (error) {
      on = true;    // 판단 실패 시엔 켜둔다 — 안 보이는 것보다 낫다
    }
    if (on === lastSent) return;
    lastSent = on;
    try { postToNativeRadio({ action: "vizStream", on: on }); } catch (error) { /* 무시 */ }
  }
  window.setInterval(evaluate, 1000);
  evaluate();
})();

/* ═══════════════════════════════════════════════════════════════════════
   우상단 배터리 표시 — 2026-08-10 운영 지침
   ───────────────────────────────────────────────────────────────────────
   운영 요청은 "아이폰 우상단처럼 신호·와이파이·배터리"였다. 그중 신호
   세기는 **아이폰이 앱에 내주지 않는다** — 애플 공개 API가 없고, Core
   Telephony 는 비공개 프레임워크라 쓰면 심사에서 걸린다. 없는 것을 지어내
   그리는 대신 읽을 수 있는 것만 정직하게 그린다.

   값을 구하는 순서에 이유가 있다.
     1) 네이티브가 심어준 값(window.__FLIPZEN_BATTERY__). 아이폰 WKWebView 에는
        Battery Status API 자체가 없어서 이 길뿐이다. 안드로이드도 이 길이
        더 정확하다(웹 API 는 기기·정책에 따라 값이 얼어붙는 사례를 이미
        충전 감지에서 겪었다).
     2) 그게 없으면 navigator.getBattery(). 크로미움 계열 웹뷰·브라우저용.
     3) 둘 다 없으면 **아무것도 그리지 않고 ".com" 을 그대로 둔다.**
        모르는 값을 그럴듯하게 지어내는 것보다 예전 모습이 낫다.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  // 2026-08-10 운영자 확인 — 안드로이드는 취소.
  // 이유가 명확하다. 안드로이드 앱은 시스템 상태표시줄을 그대로 띄우고
  // 있어서(투명 상태바 위에 OS 가 신호·와이파이·배터리를 직접 그린다)
  // 우리가 하나 더 그리면 배터리가 화면에 두 번 나온다. 아이폰은 반대로
  // 상태바를 숨기고 있어서(UIStatusBarHidden) 우리가 안 그리면 아무것도
  // 없다 — 그래서 아이폰에만 그린다.
  //
  // 일반 웹/PWA 도 대상이 아니다. 브라우저에는 이미 기기 상태표시줄이
  // 있고, 웹페이지가 남의 배터리를 굳이 그려 보일 이유가 없다.
  //
  // ※ 네이티브 잔량 전달은 안드로이드에도 그대로 남겨 둔다. 지금은 쓰지
  //   않지만 값은 정확하고 비용이 거의 없다 — 안드로이드가 나중에
  //   상태바를 숨기는 날 이 한 줄만 풀면 된다.
  if (nativePlatformKey !== "ios") return;

  var el = document.getElementById("appBattery");
  var fillEl = document.getElementById("appBatteryFill");
  var numEl = document.getElementById("appBatteryNum");
  var tldEl = document.getElementById("appBrandTld");
  if (!el || !fillEl || !numEl || !tldEl) return;

  var lastShown = -1;

  function readNativeLevel() {
    var v = window.__FLIPZEN_BATTERY__;
    if (typeof v === "number" && isFinite(v) && v >= 0 && v <= 100) return Math.round(v);
    return -1;
  }

  function chargingNow() {
    try {
      if (typeof window.__flipzenIsCharging === "function") return window.__flipzenIsCharging();
    } catch (e) { /* 무시 */ }
    return window.__FLIPZEN_CHARGING__ === true;
  }

  function render(level) {
    if (!(level >= 0)) {
      // 모르면 예전 모습으로 돌아간다 — 지어내지 않는다.
      el.hidden = true;
      tldEl.hidden = false;
      lastShown = -1;
      return;
    }
    tldEl.hidden = true;
    el.hidden = false;
    var charging = chargingNow();
    if (level !== lastShown) {
      numEl.textContent = String(level);
      // 0% 라도 실선 한 줄은 남긴다 — 완전히 비면 아이콘이 무엇인지 안 보인다.
      fillEl.style.width = Math.max(6, level) + "%";
      el.setAttribute("aria-label", level + "%");
      lastShown = level;
    }
    el.classList.toggle("is-charging", charging);
    el.classList.toggle("is-low", !charging && level < 20);
  }

  function tick() {
    var lv = readNativeLevel();
    if (lv >= 0) { render(lv); return; }
    if (navigator.getBattery) {
      navigator.getBattery().then(function (b) {
        var v = typeof b.level === "number" ? Math.round(b.level * 100) : -1;
        render(v);
      }).catch(function () { render(-1); });
      return;
    }
    render(-1);
  }

  // 네이티브가 값이 바뀔 때마다 불러 준다(iOS batteryLevelDidChange /
  // 안드로이드 ACTION_BATTERY_CHANGED). 폴링은 그 신호가 유실됐을 때를
  // 위한 그물이지 주된 경로가 아니다.
  window.__flipzenBatteryChanged = function (level) {
    if (typeof level === "number") window.__FLIPZEN_BATTERY__ = level;
    tick();
  };

  if (navigator.getBattery) {
    navigator.getBattery().then(function (b) {
      ["levelchange", "chargingchange"].forEach(function (evt) {
        try { b.addEventListener(evt, tick); } catch (e) { /* 무시 */ }
      });
    }).catch(function () { /* 무시 */ });
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) tick();
  });
  window.addEventListener("focus", tick);
  setInterval(tick, 60000);
  tick();
})();

// ─────────────────────────────────────────────────────────────
// 2026-08-15 동영상 배경 (ver.1.9.31, 프리미엄)
//   배경사진 레이어(.sky-photo) 안에 <video> A/B 두 장을 넣어
//   사진 위·모든 UI 아래에서 짧은 세로 영상을 돌린다. 운영자 확정 규칙:
//   [1] 설정 토글 ON + 프리미엄일 때만 (2주 무료 체험은 구독 상품이 처리)
//   [2] 충전 중 + Wi-Fi 에서만 재생 — 조건이 깨지면 즉시 사진 복귀.
//       사진이 항상 밑에 살아 있으므로 복귀는 영상 페이드아웃 하나로 끝.
//   [3] 셀룰러에서는 토글 자체를 못 켠다 (데이터 요금 보호)
//   [4] 음악과 같은 연속 상한(일반 2시간) — 초과 시 사진 복귀 + 토스트
//   조건 신호는 전부 네이티브 브릿지: __FLIPZEN_CHARGING__(기존),
//   __FLIPZEN_WIFI__/__FLIPZEN_PREMIUM__(1.8 신설). 웹 단독 접속은
//   신호가 없어 기능이 아예 안 보인다 — 의도된 앱 전용 기능이다.
//   ?vidbg=1 은 개발용 강제 스위치(모든 조건 무시). 목록은
//   data/video-backgrounds.json — scripts/build-video-backgrounds.mjs 가
//   굽고, 영상 본체는 R2(bgv/)에 있다.
// ─────────────────────────────────────────────────────────────
(function setupVideoBackground() {
  var host = document.querySelector(".sky-photo");
  if (!host) return;
  var devForce = false;
  try {
    devForce = new URLSearchParams(window.location.search).get("vidbg") === "1";
  } catch (error) { devForce = false; }

  var VIDBG_STORE_KEY = "ezlong:videoBgEnabled";
  var VIDBG_LIMIT_MS = 2 * 60 * 60 * 1000;  // 음악 일반 상한과 동일(2시간)
  var VIDBG_MIN_LOOPS = 3;

  var manifest = null;
  var manifestLoading = false;
  var front = null;
  var back = null;
  var playing = false;
  var loops = 0;
  var backReady = false;
  var wantSwap = false;      // 스와이프 예약 — 다음 영상이 준비되면 즉시 교체
  var currentEntry = null;
  var pickGroup = null;      // 지금 도는 영상을 고를 때의 날씨 그룹
  // 2026-08-15 3차(운영자) — 비충전 재생 허용. 단 5개까지만.
  //   충전 중에만 되면 이용자가 체험해 볼 수 없다는 판단. 비충전
  //   상태에서 영상 5개를 다 돌면 토글이 스스로 꺼지고 사진으로
  //   돌아간다(설정 안내 문구에 명시). 충전을 시작하면 카운터 리셋.
  var unpluggedPlays = 0;
  var groupSwitched = false; // 날씨가 바뀌어 조기 교체가 허용된 상태
  var startedAt = null;
  var restCooldown = false;  // 2시간 상한에 걸린 뒤 재개 신호까지 쉼
  var toggleEl = document.getElementById("videoBgToggle");

  function storedOn() {
    try { return localStorage.getItem(VIDBG_STORE_KEY) === "1"; }
    catch (error) { return false; }
  }
  function setStored(on) {
    try { localStorage.setItem(VIDBG_STORE_KEY, on ? "1" : "0"); }
    catch (error) { /* 무시 */ }
  }
  // 2026-08-16 운영자 확정 — "첫 2주는 프리미엄을 그대로 쓸 수 있어야
  // 한다". 광고의 설치 후 14일 무료 창과 같은 정신. 네이티브 구버전은
  // 설치일을 안 내려주므로 웹이 처음 본 날을 기록해 14일을 센다.
  // (신버전 네이티브는 __FLIPZEN_PREMIUM__ 자체에 무료 창을 합쳐 내려줘서
  //  이 폴백보다 정확하다. 스토리지가 지워지면 다시 시작되는 허점은
  //  배경 영상 수준의 혜택이라 감수 — 광고 무료 창은 네이티브가 지킨다.)
  var VIDBG_GRACE_MS = 14 * 24 * 60 * 60 * 1000;
  function graceOk() {
    try {
      var v = localStorage.getItem("flipzen_first_seen");
      if (!v) { v = String(Date.now()); localStorage.setItem("flipzen_first_seen", v); }
      return (Date.now() - Number(v)) < VIDBG_GRACE_MS;
    } catch (error) { return false; }
  }
  function premiumOk() {
    return devForce || window.__FLIPZEN_PREMIUM__ === true || graceOk();
  }
  function wifiOk() { return devForce || window.__FLIPZEN_WIFI__ === true; }
  function chargingOk() { return devForce || window.__FLIPZEN_CHARGING__ === true; }
  function autoDisable() {
    // 비충전 5개 소진 — 토글을 스스로 끄고 사진으로 복귀.
    setStored(false);
    if (toggleEl) toggleEl.checked = false;
    stop();
  }

  // 날씨 3분류 — 사진 매칭보다 훨씬 거칠게 간다(영상 수가 적으므로).
  function videoWeatherGroup() {
    var tag = "";
    try { tag = String(app.dataset.weather || "").toLowerCase(); }
    catch (error) { tag = ""; }
    if (/rain|drizzle|storm|thunder|shower/.test(tag)) return "rain";
    if (/snow|sleet|hail|blizzard/.test(tag)) return "snow";
    // 2026-08-17 — cloudy 세분화: 흐림·안개는 전용 컬렉션을 먼저 찾는다.
    // partly-cloudy(구름조금)는 밝은 하늘이라 기존 '그외'에 남긴다.
    // cloudy 태그 영상이 아직 없으면 candidates()가 '그외'로 폴백하므로 무해.
    if (tag === "cloudy" || tag === "mist" || /overcast|fog/.test(tag)) return "cloudy";
    return "other";
  }
  // 시간대 3분류(2026-08-16) — 밤(20~04시)·해질무렵(17~20시)·낮.
  // 스카이 그라데이션(getSceneForHour)과 같은 현지 시계를 쓴다.
  function videoTimeGroup() {
    var hour = new Date().getHours();
    if (hour >= 20 || hour < 4) return "night";
    if (hour >= 17) return "sunset";
    return "day";
  }

  function candidates() {
    if (!manifest || !Array.isArray(manifest.videos) || !manifest.videos.length) return [];
    var group = videoWeatherGroup();
    var hit = manifest.videos.filter(function (v) {
      return (v.w || []).indexOf(group) >= 0;
    });
    // 해당 날씨 영상이 없으면 '그외'로 폴백 — 빈 화면보다 낫다.
    if (!hit.length && group !== "other") {
      hit = manifest.videos.filter(function (v) {
        return (v.w || []).indexOf("other") >= 0;
      });
    }
    // 계절 필터(2026-08-15 2차) — 겨울 영상은 겨울에만. 판정은 사진과
    // 같은 getCurrentSeason(위도 반구 보정, i18n/season.js). 봄처럼
    // 태그에 없는 계절이면 필터를 접는다 — 빈 목록보다 낫다.
    var season = "";
    try { season = String(getCurrentSeason() || ""); } catch (error) { season = ""; }
    if (season) {
      var seasonHit = hit.filter(function (v) {
        return (v.s || []).indexOf(season) >= 0;
      });
      if (seasonHit.length) hit = seasonHit;
    }
    // 시간대 필터(2026-08-16) — t 태그 있는 영상은 제 시간대에만.
    // t 없는 기존 영상은 낮 취급이라, 밤에는 밤 컬렉션이 우선한다.
    var tg = videoTimeGroup();
    var timeHit = hit.filter(function (v) {
      var t = v.t || [];
      if (tg === "day") return !t.length || t.indexOf("day") >= 0;
      return t.indexOf(tg) >= 0;
    });
    if (timeHit.length) hit = timeHit;
    return hit;
  }
  function pickNext() {
    var pool = candidates();
    if (!pool.length) return null;
    if (pool.length === 1) return pool[0];
    var next = null;
    for (var attempt = 0; attempt < 6; attempt += 1) {
      next = pool[Math.floor(Math.random() * pool.length)];
      if (next !== currentEntry) break;
    }
    return next;
  }
  function entryUrl(entry) {
    return (manifest.base || "") + entry.x;
  }

  // 2026-08-16 — 날씨 상세 패널이 부른다: 지금 영상이 돌고 있으면 그 URL.
  window.__flipzenVideoBgCurrent = function () {
    return (playing && currentEntry) ? entryUrl(currentEntry) : "";
  };
  function loadManifest() {
    if (manifest || manifestLoading) return;
    manifestLoading = true;
    fetch("data/video-backgrounds.json")
      .then(function (r) { return r.json(); })
      .then(function (j) { manifest = j; manifestLoading = false; tickMonitor(); })
      .catch(function () { manifestLoading = false; });
  }

  function makeVideo() {
    var v = document.createElement("video");
    v.className = "vidbg";
    // 2026-08-17 — 안드로이드 WebView가 poster 없는 영상의 "아직 안 도는"
    // 찰나에 기본 재생 아이콘을 그린다. 투명 1px로 막는다.
    v.poster = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    v.muted = true;
    v.setAttribute("muted", "");
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.preload = "auto";
    v.disablePictureInPicture = true;
    v.setAttribute("disableremoteplayback", "");
    v.addEventListener("ended", onEnded);
    host.appendChild(v);
    return v;
  }
  function reallyReady(v) {
    if (v.readyState < 3 || !v.duration) return false;
    // 이미 실제로 흐르고 있으면 준비된 것 — 걷어찬(kickBack) 영상 경로.
    if (!v.paused && v.currentTime > 1) return true;
    for (var i = 0; i < v.buffered.length; i += 1) {
      if (v.buffered.end(i) >= v.duration - 0.3) return true;
    }
    return false;
  }
  // 비충전·저전력에서 iOS 가 숨은 영상의 preload 를 미룬다 — load() 만으로는
  // 한 바이트도 안 받는 경우가 있다. 무음 재생으로 걷어차면 받기 시작한다.
  function kickBack() {
    if (!back || !back.src) return;
    try {
      if (back.paused) back.play().catch(function () {});
    } catch (error) { /* 무시 */ }
  }
  var backEntry = null;
  function loadInto(v, entry) {
    backReady = false;
    backEntry = entry;
    if (!entry) return;
    v.src = entryUrl(entry);
    v.load();
    var timer = window.setInterval(function () {
      if (!playing) { window.clearInterval(timer); return; }
      if (reallyReady(v)) {
        backReady = true;
        window.clearInterval(timer);
        if (wantSwap) { wantSwap = false; swap(); }
      }
    }, 300);
  }
  function swap() {
    if (chargingOk()) {
      unpluggedPlays = 0;
    } else {
      unpluggedPlays += 1;
      if (unpluggedPlays >= 5) { autoDisable(); return; }
    }
    var t2 = front; front = back; back = t2;
    try { if (front.currentTime > 0.2) front.currentTime = 0; } catch (error) {}
    wantSwap = false;
    pickGroup = videoWeatherGroup();
    groupSwitched = false;
    currentEntry = backEntry;
    // 2026-08-17 — play()를 먼저, 노출을 나중에. 보이는 순간 이미 돌고
    // 있어야 안드로이드가 기본 포스터를 그릴 틈이 없다.
    front.play().catch(function () {});
    front.classList.add("on");
    back.classList.remove("on");
    loops = 0;
    loadInto(back, pickNext());
  }
  function onEnded() {
    if (!playing || this !== front) return;
    loops += 1;
    // 날씨가 바뀐 뒤라면(groupSwitched) 3회를 기다리지 않는다 —
    // 비가 막 시작됐는데 맑은 영상을 세 바퀴 더 도는 건 이상하다.
    if ((loops >= VIDBG_MIN_LOOPS || groupSwitched) && backReady) {
      swap();
    } else {
      if (loops >= VIDBG_MIN_LOOPS) kickBack();
      this.currentTime = 0;
      this.play().catch(function () {});
    }
  }

  function start() {
    if (playing) return;
    if (!manifest) { loadManifest(); return; }
    var first = pickNext();
    if (!first) return;
    if (!front) { front = makeVideo(); back = makeVideo(); }
    playing = true;
    startedAt = Date.now();
    unpluggedPlays = chargingOk() ? 0 : 1;
    pickGroup = videoWeatherGroup();
    groupSwitched = false;
    currentEntry = first;
    loops = 0;
    front.src = entryUrl(first);
    front.addEventListener("playing", function firstPlay() {
      front.removeEventListener("playing", firstPlay);
      if (!playing) return;
      front.classList.add("on");
      // 첫 재생 1.5초 뒤에야 다음 영상 프리로드 — 첫 화면 대역폭 보호
      window.setTimeout(function () {
        if (playing) loadInto(back, pickNext());
      }, 1500);
    });
    front.play().catch(function () {});
  }
  function stop() {
    if (!playing) return;
    playing = false;
    startedAt = null;
    [front, back].forEach(function (v) {
      if (!v) return;
      v.classList.remove("on");
      try { v.pause(); } catch (error) { /* 무시 */ }
    });
  }

  function shouldPlay() {
    if (restCooldown) return false;
    // 2026-08-17 운영자 실기기 제보 — 설정에서 '배경 동영상'을 꺼도 영상이
    // 계속 나왔다. 개발용 강제(?vidbg=1)가 토글까지 무시한 탓. 강제는
    // 프리미엄·Wi-Fi·충전 조건만 우회하고, 토글 해제는 존중한다.
    if (devForce) return storedOn();
    // 충전은 조건이 아니라 '분량'을 정한다 — 비충전이면 5개 뒤 자동 해제.
    return storedOn() && premiumOk() && wifiOk();
  }
  function tickMonitor() {
    if (playing) {
      if (!shouldPlay()) { stop(); return; }
      // 날씨 그룹이 바뀌면(첫 날씨 도착 포함) 다음 영상을 즉시
      // 새 그룹에서 다시 받는다. 15초 주기라 비 시작 후 늦어도
      // 15초 + 현재 영상 남은 시간 안에 비 영상으로 넘어간다.
      var groupNow = videoWeatherGroup();
      if (groupNow !== pickGroup) {
        pickGroup = groupNow;
        groupSwitched = true;
        loadInto(back, pickNext());
      }
      if (startedAt && Date.now() - startedAt > VIDBG_LIMIT_MS) {
        restCooldown = true;
        stop();
        try {
          showMusicToast(t("videoBg.autoPaused", null, "오래 재생되어 배경 동영상이 잠시 사진으로 돌아갔어요."));
        } catch (error) { /* 무시 */ }
      }
      return;
    }
    if (shouldPlay()) start();
  }
  window.setInterval(tickMonitor, 15000);

  // 충전 상태 변화 — 네이티브가 부르는 기존 훅에 끼어든다(체인 보존).
  var prevChargingHook = window.__flipzenChargingChanged;
  window.__flipzenChargingChanged = function (flag) {
    if (typeof prevChargingHook === "function") {
      try { prevChargingHook(flag); } catch (error) { /* 무시 */ }
    }
    restCooldown = false;  // 충전기를 다시 꽂으면 상한 휴식도 풀린다
    if (flag === true || flag === "true") {
      unpluggedPlays = 0;      // 충전 시작 — 비충전 카운터 리셋
    } else if (playing) {
      unpluggedPlays = 1;      // 재생 중 분리 — 지금 영상이 1개째
    }
    tickMonitor();
  };
  // 네트워크 변화 — 1.8 네이티브 브릿지가 부른다.
  window.__flipzenNetworkChanged = function () { tickMonitor(); };

  // 잠금 화면에 다녀오면 WKWebView 가 미디어 파이프라인을 끊어 영상이
  // 멈춘 채 굳는 일이 있다(운영자 실기기 제보). 3단 복구:
  //   play() → 거부되면 load()+play() → 1.5초 뒤에도 멈춰 있으면 재시작.
  function hardResume() {
    if (!playing) { tickMonitor(); return; }
    var v = front;
    if (!v) return;
    var attempt = v.play();
    if (attempt && attempt.catch) {
      attempt.catch(function () {
        try { v.load(); v.play().catch(function () {}); } catch (error) {}
      });
    }
    window.setTimeout(function () {
      if (playing && v === front && v.paused) {
        stop();
        start();
      }
    }, 1500);
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) hardResume();
  });
  window.addEventListener("pageshow", hardResume);
  window.addEventListener("focus", hardResume);

  // 배경 스와이프가 부른다(movePhoto) — 영상이 돌면 다음 영상으로.
  window.__flipzenVideoBgSwipe = function () {
    if (!playing) return false;
    hardResume();
    if (backReady) {
      swap();
    } else {
      wantSwap = true;
      loadInto(back, pickNext());
      kickBack();
    }
    return true;
  };

  // 설정 토글
  if (toggleEl) {
    toggleEl.checked = storedOn();
    toggleEl.addEventListener("change", function () {
      if (toggleEl.checked) {
        if (!premiumOk()) {
          toggleEl.checked = false;
          try { postToNativeAd({ action: "openPaywall" }); } catch (error) { /* 무시 */ }
          try { showMusicToast(t("videoBg.premiumOnly", null, "프리미엄에서 이용할 수 있어요.")); } catch (error) { /* 무시 */ }
          return;
        }
        if (!wifiOk()) {
          // 운영자 확정 — 셀룰러에서는 선택 자체가 안 된다.
          toggleEl.checked = false;
          try { showMusicToast(t("videoBg.wifiOnly", null, "Wi-Fi에 연결된 동안에만 켤 수 있어요.")); } catch (error) { /* 무시 */ }
          return;
        }
        setStored(true);
        loadManifest();
        tickMonitor();
      } else {
        setStored(false);
        tickMonitor();
      }
    });
  }

  if (devForce || storedOn()) loadManifest();
})();

// 2026-08-17 — 앱(WebView) 여부·프리미엄 여부를 ezlong.com 공통 페이지가
// 읽을 수 있게 localStorage로 중계한다. 루트 사이트의 애드센스 게이트가
// 이 두 키를 읽는다(광고 도입 가이드 문서 참조). 키 계약:
//   ezlong:inApp   → "android" | "ios"  (앱 WebView로 열린 적이 있으면 기록.
//                     WebView 저장소는 브라우저와 분리라 일반 방문자는 무관)
//   ezlong:premium → "1" | "0"  (네이티브가 내려준 __FLIPZEN_PREMIUM__ 미러.
//                     2주 무료 창 포함. 다음 /time 로드 때마다 갱신)
(function () {
  function mirrorPremium() {
    try {
      if (typeof window.__FLIPZEN_PREMIUM__ === "boolean") {
        localStorage.setItem("ezlong:premium", window.__FLIPZEN_PREMIUM__ ? "1" : "0");
      }
    } catch (error) { /* 무시 */ }
  }
  try {
    var native = new URLSearchParams(window.location.search).get("native");
    if (native === "android" || native === "ios") {
      localStorage.setItem("ezlong:inApp", native);
    }
  } catch (error) { /* 무시 */ }
  // 네이티브 주입은 onPageFinished(로드 뒤)라서 잠시 늦게 온다 — 20초 동안
  // 1초 간격으로 미러하고, 화면 복귀 때도 한 번씩 따라잡는다.
  mirrorPremium();
  var tries = 0;
  var timer = window.setInterval(function () {
    tries += 1;
    mirrorPremium();
    if (tries >= 20) window.clearInterval(timer);
  }, 1000);
  document.addEventListener("visibilitychange", mirrorPremium);
})();


// ══════════════════════════════════════════════════════════════════════
// 2026-08-20 운영 지침 — 기상 알람
//
// 왜 화면을 웹에 두는가. 알람 UI에 필요한 재료(곡 613개 목록, 미리듣기,
// 6개 로케일, 설정 화면의 유리 재질)가 전부 이미 웹에 있다. 네이티브에
// 같은 것을 한 벌 더 만들 이유가 없다. 네이티브는 이 화면이 정한 값을
// 받아 두 가지 일만 한다 — AlarmKit에 알람을 걸고, 아침에 음악을 3분에
// 걸쳐 서서히 키운다.
//
// 두 겹으로 깔되 겹쳐서 울리지는 않는다:
//   · 앱이 살아 있으면(취침 대기·충전 거치) 우리 음악이 페이드인으로 깨운다.
//     네이티브가 정각 직전에 시스템 알람 쪽을 스스로 취소한다.
//   · 앱이 죽어 있으면 AlarmKit이 무음·집중 모드를 뚫고 대신 울려 준다.
// 그래서 "못 깨는" 경우는 없다.
// ══════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════
// 2026-08-20 운영 지침 — 설정 상단 버전 표시
//
// "내 아이폰에 빌드 안되었다. 버전 확인해줘. 1.9.46이다."
//
// 여기 적힌 ver.1.9.46은 '웹' 버전이다. 앱(네이티브) 버전은 별개로
// 1.9.2(빌드 46)이고, 하필 46이라는 숫자가 겹쳐 더 헷갈렸다. 앱 안에서
// 볼 때는 두 번호를 나란히 보여 준다 — 새 앱이 실제로 깔렸는지
// 이 한 줄로 바로 확인된다.
// ══════════════════════════════════════════════════════════════════════
(function settingsVersionLabel() {
  "use strict";

  function paint() {
    var el = document.getElementById("settingsVersion");
    if (!el) return;
    var webLabel = (el.textContent || "").trim();
    if (typeof getNativeAppVersion !== "function") return;
    getNativeAppVersion(function (info) {
      if (!info || !info.versionName) return;   // 브라우저 — 웹 버전만 둔다
      var build = info.versionCode ? ("(" + info.versionCode + ")") : "";
      el.textContent = webLabel + "  ·  app " + info.versionName + build;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", paint);
  } else {
    paint();
  }
})();

(function wakeAlarmModule() {
  "use strict";

  var STORE_KEY   = "ezlong:wakeAlarms";
  var SOUND_KEY   = "ezlong:wakeAlarmSound";
  var BEDTIME_KEY = "ezlong:bedtimeArmed";

  // 볼륨을 0에서 최대까지 끌어올리는 데 쓰는 시간. 운영자 확정값.
  var FADE_SECONDS = 180;

  // 30초짜리로 사람을 깨울 수는 없다. 1분 30초 이상만 알람 후보로 둔다.
  var MIN_TRACK_SECONDS = 80;

  // 미리듣기는 곡을 다 들려줄 자리가 아니다 — 결을 확인할 만큼만.
  var PREVIEW_SECONDS = 18;

  var els = null;
  var supported = false;          // 네이티브가 알람을 받아줄 수 있는가
  var wakeAlarmUnsupported = false; // 2026-08-24 운영자: 알람이 '확정적으로' 미지원일 때만 true. 기상 아이콘은 확정 전엔 미리 보여줘서 시계와 동시에 뜨게 한다.
  var editingId = null;           // 수정 중인 알람 id(없으면 새로 거는 중)
  var selectedWeekdays = [];      // 0=일 … 6=토
  var selectedTrack = null;       // music-playlist.js의 트랙 객체
  var soundTab = "acoustic";
  var previewAudio = null;
  var previewFile = null;
  var previewStopTimer = null;

  // ── 저장 ────────────────────────────────────────────────────────

  function loadAlarms() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      // 2026-08-23 — id 없는 옥람에 id를 채운다. id가 없으면 수정이 업데이트 대신 중복 생성된다.
      var changed = false;
      for (var i = 0; i < list.length; i += 1) {
        if (list[i] && !list[i].id) {
          list[i].id = "wk" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
          changed = true;
        }
      }
      if (changed) { try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) { /* 무시 */ } }
      return list;
    } catch (error) {
      return [];
    }
  }

  function saveAlarms(list) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(list));
    } catch (error) { /* 저장 실패가 알람 거는 것을 막지는 않는다 */ }
  }

  function loadSavedSoundFile() {
    try { return localStorage.getItem(SOUND_KEY) || null; } catch (error) { return null; }
  }

  function saveSoundFile(file) {
    try {
      if (file) localStorage.setItem(SOUND_KEY, file);
      else localStorage.removeItem(SOUND_KEY);
    } catch (error) { /* 무시 */ }
  }

  function bedtimeArmed() {
    try { return localStorage.getItem(BEDTIME_KEY) === "1"; } catch (error) { return false; }
  }

  function setBedtimeArmed(on) {
    try {
      if (on) localStorage.setItem(BEDTIME_KEY, "1");
      else localStorage.removeItem(BEDTIME_KEY);
    } catch (error) { /* 무시 */ }
  }

  // ── 곡 목록 ─────────────────────────────────────────────────────

  function durationSeconds(track) {
    var raw = (track && track.duration) || "";
    var m = /^(\d+):(\d+)$/.exec(String(raw).trim());
    if (!m) return 0;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }

  // trackCategoryKey()가 "classic 20260718"을 "piano chello"로,
  // "My Workspace"를 __original__로 이미 통합해 준다(app.js 위쪽 참조).
  function tabOf(track) {
    var key = typeof trackCategoryKey === "function" ? trackCategoryKey(track) : "";
    if (key === "piano chello") return "classical";
    if (key === ORIGINAL_CATEGORY_KEY || key === "My Workspace") return "acoustic";
    if (key === "vocal- girls rock") return "rock";   // 2026-08-23 운영자: 꼭 깨야 할 때 시끄럽게
    return null;   // 보컬·명상 등은 기상 알람 후보가 아니다
  }

  var _tracksCache = null;

  function alarmTracks() {
    if (_tracksCache) return _tracksCache;
    var out = { acoustic: [], classical: [], rock: [] };
    if (Array.isArray(window.musicPlaylist || (typeof musicPlaylist !== "undefined" ? musicPlaylist : null))) {
      var source = window.musicPlaylist || musicPlaylist;
      for (var i = 0; i < source.length; i += 1) {
        var track = source[i];
        var tab = tabOf(track);
        if (!tab) continue;
        if (durationSeconds(track) < MIN_TRACK_SECONDS) continue;
        out[tab].push(track);
      }
    }
    function byTitle(a, b) {
      return String(a.title || "").localeCompare(String(b.title || ""));
    }
    out.acoustic.sort(byTitle);
    out.classical.sort(byTitle);
    out.rock.sort(byTitle);
    _tracksCache = out;
    return out;
  }

  function findTrackByFile(file) {
    if (!file) return null;
    var all = alarmTracks();
    var pools = [all.acoustic, all.classical, all.rock];
    for (var p = 0; p < pools.length; p += 1) {
      for (var i = 0; i < pools[p].length; i += 1) {
        if (pools[p][i].file === file) return pools[p][i];
      }
    }
    return null;
  }

  // ── 미리듣기 ────────────────────────────────────────────────────

  function stopPreview() {
    if (previewStopTimer) { window.clearTimeout(previewStopTimer); previewStopTimer = null; }
    if (previewAudio) {
      try { previewAudio.pause(); } catch (error) { /* 무시 */ }
      previewAudio = null;
    }
    previewFile = null;
    if (els && els.soundList) {
      var buttons = els.soundList.querySelectorAll(".alarm-sound-preview");
      for (var i = 0; i < buttons.length; i += 1) {
        buttons[i].dataset.playing = "0";
        buttons[i].textContent = "▶";
      }
    }
  }

  function playPreview(track, button) {
    if (previewFile === track.file) { stopPreview(); return; }
    stopPreview();
    // 배경음악과 겹쳐 나면 어느 쪽 결인지 분간이 안 된다. 잠깐 물러나게 한다.
    try { if (typeof pauseMusic === "function") pauseMusic(); } catch (error) { /* 무시 */ }
    var url = typeof resolveTrackAbsoluteUrl === "function"
      ? resolveTrackAbsoluteUrl(track)
      : (typeof resolveTrackUrl === "function" ? resolveTrackUrl(track) : track.file);
    try {
      previewAudio = new Audio(url);
      previewAudio.volume = 0.85;
      previewFile = track.file;
      button.dataset.playing = "1";
      button.textContent = "■";
      previewAudio.play().catch(function () { stopPreview(); });
      previewStopTimer = window.setTimeout(stopPreview, PREVIEW_SECONDS * 1000);
      previewAudio.addEventListener("ended", stopPreview, { once: true });
    } catch (error) {
      stopPreview();
    }
  }

  // ── 그리기 ──────────────────────────────────────────────────────

  function weekdayNames() {
    var fallback = ["일", "월", "화", "수", "목", "금", "토"];
    var out = [];
    for (var i = 0; i < 7; i += 1) {
      out.push(t("settings.alarm.weekday" + i, null, fallback[i]));
    }
    return out;
  }

  function renderWeekdays() {
    if (!els.weekdays) return;
    var names = weekdayNames();
    els.weekdays.innerHTML = "";
    for (var i = 0; i < 7; i += 1) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "alarm-weekday-chip";
      chip.textContent = names[i];
      chip.dataset.day = String(i);
      chip.setAttribute("aria-pressed", selectedWeekdays.indexOf(i) >= 0 ? "true" : "false");
      chip.addEventListener("click", onWeekdayClick);
      els.weekdays.appendChild(chip);
    }
    updateRepeatNote();
  }

  function onWeekdayClick(event) {
    var day = parseInt(event.currentTarget.dataset.day, 10);
    var at = selectedWeekdays.indexOf(day);
    if (at >= 0) selectedWeekdays.splice(at, 1);
    else selectedWeekdays.push(day);
    selectedWeekdays.sort(function (a, b) { return a - b; });
    event.currentTarget.setAttribute("aria-pressed", at >= 0 ? "false" : "true");
    updateRepeatNote();
  }

  function updateRepeatNote() {
    if (!els.repeatNote) return;
    els.repeatNote.textContent = selectedWeekdays.length
      ? t("settings.alarm.repeatWeekly", null, "고른 요일마다 매주 울립니다.")
      : t("settings.alarm.repeatOnce", null, "요일을 고르지 않으면 한 번만 울립니다.");
  }

  function renderSoundTabs() {
    if (!els.soundTabs) return;
    var tabs = [
      { key: "acoustic",  label: t("settings.alarm.tabAcoustic",  null, "어쿠스틱 연주곡") },
      { key: "classical", label: t("settings.alarm.tabClassical", null, "클래식") },
      { key: "rock",      label: t("settings.alarm.tabRock",      null, "ROCK") }
    ];
    els.soundTabs.innerHTML = "";
    tabs.forEach(function (tab) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "alarm-sound-tab";
      button.textContent = tab.label;
      button.dataset.tab = tab.key;
      button.setAttribute("aria-pressed", soundTab === tab.key ? "true" : "false");
      button.addEventListener("click", function () {
        if (soundTab === tab.key) return;
        soundTab = tab.key;
        stopPreview();
        renderSoundTabs();
        renderSoundList();
      });
      els.soundTabs.appendChild(button);
    });
  }

  function renderSoundList() {
    if (!els.soundList) return;
    var list = alarmTracks()[soundTab] || [];
    els.soundList.innerHTML = "";
    if (!list.length) {
      var empty = document.createElement("p");
      empty.className = "settings-desc settings-desc-muted";
      empty.style.margin = "10px 12px";
      empty.textContent = t("settings.alarm.soundEmpty", null, "고를 수 있는 곡이 없습니다.");
      els.soundList.appendChild(empty);
      return;
    }
    list.forEach(function (track) {
      var row = document.createElement("button");
      row.type = "button";
      row.className = "alarm-sound-item";
      row.setAttribute("aria-pressed", selectedTrack && selectedTrack.file === track.file ? "true" : "false");

      var preview = document.createElement("span");
      preview.className = "alarm-sound-preview";
      preview.setAttribute("role", "button");
      preview.dataset.playing = "0";
      preview.textContent = "▶";
      preview.addEventListener("click", function (event) {
        event.stopPropagation();
        playPreview(track, preview);
      });

      var title = document.createElement("span");
      title.className = "alarm-sound-title";
      title.textContent = track.title || track.file;

      var dur = document.createElement("span");
      dur.className = "alarm-sound-dur";
      dur.textContent = track.duration || "";

      row.appendChild(preview);
      row.appendChild(title);
      row.appendChild(dur);
      row.addEventListener("click", function () {
        selectedTrack = track;
        saveSoundFile(track.file);
        renderSoundList();
        updateSoundSummary();
        setSoundDetailOpen(false);
      });
      els.soundList.appendChild(row);
    });
  }

  function two(n) { return (n < 10 ? "0" : "") + n; }

  function alarmSubtitle(alarm) {
    var names = weekdayNames();
    var when;
    if (!alarm.weekdays || !alarm.weekdays.length) {
      when = t("settings.alarm.once", null, "한 번");
    } else if (alarm.weekdays.length === 7) {
      when = t("settings.alarm.everyday", null, "매일");
    } else {
      when = alarm.weekdays.map(function (d) { return names[d]; }).join(" ");
    }
    var track = findTrackByFile(alarm.trackFile);
    var song = track ? track.title : (alarm.trackTitle || "");
    return song ? (when + " · " + song) : when;
  }

  function renderList() {
    if (!els.list) return;
    var alarms = loadAlarms();
    els.list.innerHTML = "";
    alarms.forEach(function (alarm) {
      var row = document.createElement("div");
      row.className = "alarm-row";
      row.style.cursor = "pointer";
      row.addEventListener("click", function () { beginEdit(alarm); });

      var time = document.createElement("button");
      time.type = "button";
      time.className = "alarm-row-time";
      time.textContent = two(alarm.hour) + ":" + two(alarm.minute);
      time.setAttribute("aria-label", t("settings.alarm.editAria", null, "이 알람 수정"));
      // 운영 지침 — 걸어 둔 알람의 시각을 누르면 위 입력창으로 올라와 수정된다.
      time.addEventListener("click", function (e) { e.stopPropagation(); beginEdit(alarm); });

      var meta = document.createElement("span");
      meta.className = "alarm-row-meta";
      meta.textContent = alarmSubtitle(alarm);

      var del = document.createElement("button");
      del.type = "button";
      del.className = "alarm-row-delete";
      del.textContent = "✕";
      del.setAttribute("aria-label", t("settings.alarm.deleteAria", null, "이 알람 지우기"));
      del.addEventListener("click", function (e) { e.stopPropagation(); removeAlarm(alarm.id); });

      // 2026-08-23 — 수정 아이콘. 시각을 눌러도 되지만 모르는 사람이 많아서 명시한다.
      var edit = document.createElement("button");
      edit.type = "button";
      edit.className = "alarm-row-edit";
      edit.textContent = "\u270e";
      edit.setAttribute("aria-label", t("settings.alarm.editAria", null, "이 알람 수정"));
      edit.addEventListener("click", function (e) { e.stopPropagation(); beginEdit(alarm); });

      row.appendChild(time);
      row.appendChild(meta);
      row.appendChild(edit);
      row.appendChild(del);
      els.list.appendChild(row);
    });
    ensureAddAlarmButton();
    updateConfirmLabel();
    updateBedtimeButton();
    renderHomeSummary();
  }

  function updateConfirmLabel() {
    if (!els.confirm) return;
    els.confirm.textContent = editingId
      ? t("settings.alarm.confirmEdit", null, "수정 확인")
      : t("settings.alarm.confirm", null, "확인");
  }

  function beginEdit(alarm) {
    editingId = alarm.id;
    if (els.time) els.time.value = two(alarm.hour) + ":" + two(alarm.minute);
    selectedWeekdays = (alarm.weekdays || []).slice();
    if (els.snooze) els.snooze.checked = alarm.snooze !== false;
    var track = findTrackByFile(alarm.trackFile);
    if (track) {
      selectedTrack = track;
      soundTab = tabOf(track) || soundTab;
    }
    renderWeekdays();
    renderSoundTabs();
    renderSoundList();
    updateConfirmLabel();
    // 2026-08-23 — 리스트 어느 행을 눌러도 확실히 시각 설정(맨 위)으로 올린다.
    // scrollIntoView가 3번째 행부터 먹통이던 문제를 컨테이너 직접 스크롤로 교체.
    if (els.configScreen && !els.configScreen.hidden) {
      try { els.configScreen.scrollTo({ top: 0, behavior: "smooth" }); }
      catch (error) { els.configScreen.scrollTop = 0; }
    } else if (els.time) {
      try { els.time.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (error) { /* 무시 */ }
    }
    // 2026-08-23 — 수정 아이콘을 누르면 바로 시각 돌림판이 뜼게. 클릭 제스처 안에서 showPicker 호출.
    if (els.time) {
      try { els.time.focus({ preventScroll: true }); } catch (error) { /* 무시 */ }
      try { if (typeof els.time.showPicker === "function") els.time.showPicker(); } catch (error) { /* 무시 */ }
    }
  }

  // ── 네이티브 브릿지 ─────────────────────────────────────────────

  // 2026-08-23 신설 / 2026-08-25 개명 "새 알람 추가" — 기존 알람을 건드리지 않고 새 알람을
  // 만든다. 아직 알람이 없는 요일(예: 토·일)을 미리 골라 주고, 시각만 정하면 된다.
  function startNewAlarm() {
    editingId = null;
    // 2026-08-25 운영자: "새 알람 추가"는 낮잠·테스트 같은 단발 알람도 편히
    // 넣도록 요일을 비운 채(= 한 번만 울림) 시작한다. 반복이 필요하면
    // 위 요일 칩을 눌러 고르면 된다.
    selectedWeekdays = [];
    if (els.snooze) els.snooze.checked = true;
    renderWeekdays();
    renderSoundTabs();
    renderSoundList();
    updateConfirmLabel();
    if (els.configScreen && !els.configScreen.hidden) {
      try { els.configScreen.scrollTo({ top: 0, behavior: "smooth" }); }
      catch (error) { try { els.configScreen.scrollTop = 0; } catch (e2) { /* 무시 */ } }
    }
    if (els.time) {
      try { els.time.focus({ preventScroll: true }); } catch (error) { /* 무시 */ }
      try { if (typeof els.time.showPicker === "function") els.time.showPicker(); } catch (error) { /* 무시 */ }
    }
  }
  function ensureAddAlarmButton() {
    if (document.getElementById("alarmAddNew")) return;
    if (!els.list || !els.list.parentNode) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "alarmAddNew";
    btn.className = "alarm-add-new";
    btn.textContent = "\uff0b " + t("settings.alarm.addAnother", null, "새 알람 추가");
    btn.addEventListener("click", startNewAlarm);
    els.list.parentNode.insertBefore(btn, els.list);
  }

  // ── 2026-08-24 운영자: "알람이 화면에 안 뜨나요?" 진단·안내(안드로이드 전용) ──
  // 타 알람앱은 '다른 앱 위에 표시' 같은 무거운 권한을 요구하지만, 우리는
  // 상태를 진단해 필요한 사용자만 정확한 설정으로 보낸다. 네이티브가
  // alarmScreenStatus 질의에 {fullScreen, miui}로 답하면 여기서 그린다.
  function renderAlarmScreenGuide(st) {
    var host = els.list && els.list.parentNode;
    if (!host) return;
    var box = document.getElementById("alarmScreenGuide");
    var needFull = st.fullScreen === false;   // Android 14+에서 권한 회수됨
    var isMiui = !!st.miui;
    if (!needFull && !isMiui) { if (box) box.hidden = true; return; }
    if (!box) {
      box = document.createElement("div");
      box.id = "alarmScreenGuide";
      box.className = "alarm-screen-guide";
      host.appendChild(box);
    }
    box.hidden = false;
    box.innerHTML = "";
    var head = document.createElement("p");
    head.className = "alarm-screen-guide-title";
    head.textContent = t("settings.alarm.screenGuideTitle", null, "알람이 화면에 안 뜨나요?");
    box.appendChild(head);
    if (needFull) {
      var warn = document.createElement("p");
      warn.className = "alarm-screen-guide-warn";
      warn.textContent = t("settings.alarm.screenGuideFullOff", null, "전체 화면 알림이 꺼져 있어 알람이 울려도 화면이 뜨지 않을 수 있습니다.");
      box.appendChild(warn);
      var bFull = document.createElement("button");
      bFull.type = "button";
      bFull.className = "alarm-screen-guide-btn";
      bFull.textContent = t("settings.alarm.screenGuideFullBtn", null, "전체 화면 알림 켜기");
      bFull.addEventListener("click", function () {
        try { postAlarmBridge({ action: "openFullScreenSettings" }); } catch (e) { /* 무시 */ }
      });
      box.appendChild(bFull);
    }
    if (isMiui) {
      var desc = document.createElement("p");
      desc.className = "alarm-screen-guide-desc";
      desc.textContent = t("settings.alarm.screenGuideMiui", null, "샤오미(Redmi) 기기는 '백그라운드에서 팝업 창 표시'와 '자동 시작'을 켜야 알람 화면이 뜹니다.");
      box.appendChild(desc);
      var row = document.createElement("div");
      row.className = "alarm-screen-guide-row";
      var bPop = document.createElement("button");
      bPop.type = "button";
      bPop.className = "alarm-screen-guide-btn";
      bPop.textContent = t("settings.alarm.screenGuidePopupBtn", null, "팝업 권한 열기");
      bPop.addEventListener("click", function () {
        try { postAlarmBridge({ action: "openMiuiPopupSettings" }); } catch (e) { /* 무시 */ }
      });
      var bAuto = document.createElement("button");
      bAuto.type = "button";
      bAuto.className = "alarm-screen-guide-btn";
      bAuto.textContent = t("settings.alarm.screenGuideAutoBtn", null, "자동 시작 열기");
      bAuto.addEventListener("click", function () {
        try { postAlarmBridge({ action: "openMiuiAutostart" }); } catch (e) { /* 무시 */ }
      });
      row.appendChild(bPop);
      row.appendChild(bAuto);
      box.appendChild(row);
    }
  }
  window.__flipzenAlarmScreenStatus = function (st) {
    try { renderAlarmScreenGuide(st || {}); } catch (e) { /* 무시 */ }
  };
  function requestAlarmScreenStatus() {
    if (!window.AndroidNativeBridge) return;   // 안드로이드 앱에서만
    try { postAlarmBridge({ action: "alarmScreenStatus" }); } catch (e) { /* 무시 */ }
  }

  function pushAlarmToNative(alarm) {
    var track = findTrackByFile(alarm.trackFile);
    var url = "";
    if (track && typeof resolveTrackAbsoluteUrl === "function") {
      try { url = resolveTrackAbsoluteUrl(track); } catch (error) { url = ""; }
    }
    postAlarmBridge({
      action: "scheduleWakeAlarm",
      id: alarm.id,
      hour: alarm.hour,
      minute: alarm.minute,
      weekdays: alarm.weekdays || [],
      snooze: alarm.snooze !== false,
      soundUrl: url,
      soundTitle: (track && track.title) || alarm.trackTitle || "",
      fadeSeconds: FADE_SECONDS,
      label: t("settings.alarm.heading", null, "기상 알람")
    });
  }

  function removeAlarm(id) {
    var alarms = loadAlarms().filter(function (a) { return a.id !== id; });
    saveAlarms(alarms);
    postAlarmBridge({ action: "cancelWakeAlarm", id: id });
    if (editingId === id) { editingId = null; }
    if (!alarms.length && bedtimeArmed()) exitBedtime();
    renderList();
  }

  // 2026-08-23 운영자: 요일(시간대) 충돌 안내 — 같은 요일에 이미 알람이 있는데
  // 시각만 다르면 조용히 추가하지 않고 "기존 걸 이 시각으로 바꿀까요?" 먼저 묻는다.
  // 확인=기존 수정(대체), 취소=둘 다 추가.
  //
  // 2026-08-27 운영자: "요일별 다른 시간 추가하는 게 직관적이지 않다.
  // 요일이 다르면 당연히 추가로 인식해라."
  //
  // 맞는 지적이다. 여태 요일이 **하나라도 겹치면** 충돌로 봤다. 그래서
  // 일~금 06:45 를 두고 토·일 07:45 를 만들면 일요일 하나 겹쳤다고
  // "바꿀까요?"를 물었다. 사용자 머릿속에서 그 둘은 서로 다른 알람이다 —
  // 평일 알람과 주말 알람. 물어볼 일이 아니라 그냥 추가할 일이다.
  //
  // 이제 **요일 구성이 정확히 같을 때만** 묻는다. 그게 진짜 충돌이다:
  // 같은 날들에 두 시각이 걸린 것 = 십중팔구 시각을 바꾸려던 것.
  var DOW_KO_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
  // 빈 배열(매일)과 일곱 개 전부 선택은 같은 것으로 본다.
  function normDays(days) {
    var u = [];
    (days || []).forEach(function (d) {
      d = Number(d);
      if (d >= 0 && d <= 6 && u.indexOf(d) === -1) u.push(d);
    });
    if (!u.length) return "0,1,2,3,4,5,6";
    return u.sort(function (a, b) { return a - b; }).join(",");
  }
  function sameDays(a, b) { return normDays(a) === normDays(b); }
  function alarmDaysLabel(days) {
    if (!days || !days.length || normDays(days) === "0,1,2,3,4,5,6") {
      return t("settings.alarm.everyday", null, "매일");
    }
    var names = days.slice().sort(function (a, b) { return a - b; })
      .map(function (d) { return t("settings.alarm.weekday" + d, null, DOW_KO_LABELS[d] || ""); })
      .join(t("settings.alarm.daysJoin", null, "·"));
    return t("settings.alarm.daysWrap", { days: names }, "{days}요일");
  }
  function alarmHM(h, m) { return two(h) + ":" + two(m); }
  function showAlarmConfirm(message, onYes, onNo) {
    var prev = document.getElementById("alarmConfirmOverlay");
    if (prev) { try { prev.remove(); } catch (e) { /* 무시 */ } }
    var ov = document.createElement("div");
    ov.id = "alarmConfirmOverlay";
    ov.className = "alarm-confirm-overlay";
    var box = document.createElement("div");
    box.className = "alarm-confirm-box";
    var msg = document.createElement("p");
    msg.className = "alarm-confirm-msg";
    msg.textContent = message;
    var actions = document.createElement("div");
    actions.className = "alarm-confirm-actions";
    var no = document.createElement("button");
    no.type = "button";
    no.className = "alarm-confirm-btn alarm-confirm-no";
    no.textContent = t("settings.alarm.conflictAdd", null, "새로 추가");
    var yes = document.createElement("button");
    yes.type = "button";
    yes.className = "alarm-confirm-btn alarm-confirm-yes";
    yes.textContent = t("settings.alarm.conflictReplace", null, "기존 수정");
    function closeIt() { try { ov.remove(); } catch (e) { /* 무시 */ } }
    no.addEventListener("click", function () { closeIt(); if (onNo) onNo(); });
    yes.addEventListener("click", function () { closeIt(); if (onYes) onYes(); });
    actions.appendChild(no);
    actions.appendChild(yes);
    box.appendChild(msg);
    box.appendChild(actions);
    ov.appendChild(box);
    document.body.appendChild(ov);
  }
  function onConfirm() {
    var raw = (els.time && els.time.value) || "07:00";
    var parts = raw.split(":");
    var hour = Math.max(0, Math.min(23, parseInt(parts[0], 10) || 0));
    var minute = Math.max(0, Math.min(59, parseInt(parts[1], 10) || 0));
    var id = editingId || ("wk" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36));
    var record = {
      id: id,
      hour: hour,
      minute: minute,
      weekdays: selectedWeekdays.slice(),
      snooze: !els.snooze || els.snooze.checked,
      trackFile: selectedTrack ? selectedTrack.file : null,
      trackTitle: selectedTrack ? selectedTrack.title : ""
    };
    var conflicts = loadAlarms().filter(function (a2) {
      if (a2.id === record.id) return false;
      // 요일이 다르면 다른 알람이다 — 묻지 않고 추가한다(2026-08-27).
      if (!sameDays(a2.weekdays, record.weekdays)) return false;
      return !(a2.hour === record.hour && a2.minute === record.minute);
    });
    if (conflicts.length) {
      var c0 = conflicts[0];
      var extra = conflicts.length > 1 ? t("settings.alarm.conflictMore", { n: conflicts.length - 1 }, " (외 {n}개 더)") : "";
      var msg = t("settings.alarm.conflictBody", { days: alarmDaysLabel(c0.weekdays), time: alarmHM(c0.hour, c0.minute), extra: extra, newtime: alarmHM(record.hour, record.minute) }, "{days}에 이미 {time} 알람이 있어요{extra}. {newtime}(으)로 바꿀까요? 기존 수정을 누르면 그 알람을 이 시각으로 바꾸고, 새로 추가를 누르면 둘 다 남깁니다.");
      showAlarmConfirm(
        msg,
        function () { commitAlarm(record, conflicts.map(function (c) { return c.id; })); },
        function () { commitAlarm(record, []); }
      );
      return;
    }
    commitAlarm(record, []);
  }
  function commitAlarm(record, replaceIds) {
    var alarms = loadAlarms();
    replaceIds = replaceIds || [];
    // 2026-08-24 운영자: 기존 알람을 고치는 중인가(같은 id가 이미 있는가).
    var wasExistingAlarm = alarms.some(function (a) { return a.id === record.id; });
    if (replaceIds.length) {
      alarms = alarms.filter(function (a) { return replaceIds.indexOf(a.id) === -1; });
      replaceIds.forEach(function (rid) { if (rid) postAlarmBridge({ action: "cancelWakeAlarm", id: rid }); });
    }
    var at = -1;
    for (var i = 0; i < alarms.length; i += 1) {
      if (alarms[i].id === record.id) { at = i; break; }
    }
    if (at >= 0) alarms[at] = record;
    else alarms.push(record);
    var kept = [];
    var dropped = [];
    for (var k = 0; k < alarms.length; k += 1) {
      var a2 = alarms[k];
      // 2026-08-27 — 여기도 "겹치면 지운다"였다. 일~금 06:45 를 두고
      // 토·일 06:45 를 추가하면 일요일 하나 겹쳤다는 이유로 평일 알람이
      // 통째로 사라졌다. 진짜 중복은 시각도 요일도 같을 때뿐이다.
      if (a2.id !== record.id && a2.hour === record.hour && a2.minute === record.minute && sameDays(a2.weekdays, record.weekdays)) {
        dropped.push(a2.id);
      } else {
        kept.push(a2);
      }
    }
    alarms = kept;
    dropped.forEach(function (rid) { if (rid) postAlarmBridge({ action: "cancelWakeAlarm", id: rid }); });
    alarms.sort(function (a, b) { return (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute); });
    saveAlarms(alarms);
    // 2026-08-24 운영자: 기상 시간을 수정하면 옛 시각으로 남지 않게, 다시 걸기 전에
    // 같은 id의 옛 예약을 먼저 지운다. (네이티브가 동일 id 재예약을 교체하지 않고
    // 옛 알람을 남기던 문제 대비 — 충돌-대체 경로와 같은 '취소→예약' 순서다.)
    if (wasExistingAlarm) {
      try { postAlarmBridge({ action: "cancelWakeAlarm", id: record.id }); } catch (e) { /* 무시 */ }
    }
    pushAlarmToNative(record);
    editingId = null;
    stopPreview();
    renderList();
    flashConfirm();
  }

  function flashConfirm() {
    if (!els.confirm) return;
    var original = els.confirm.textContent;
    els.confirm.textContent = t("settings.alarm.saved", null, "알람을 걸었습니다");
    els.confirm.disabled = true;
    window.setTimeout(function () {
      els.confirm.disabled = false;
      updateConfirmLabel();
    }, 1400);
  }

  // ── 취침 모드 ───────────────────────────────────────────────────

  function nextAlarm() {
    var alarms = loadAlarms();
    if (!alarms.length) return null;
    var now = new Date();
    var best = null;
    var bestDelta = Infinity;
    alarms.forEach(function (alarm) {
      var delta = minutesUntil(alarm, now);
      if (delta < bestDelta) { bestDelta = delta; best = alarm; }
    });
    return best;
  }

  function minutesUntil(alarm, now) {
    var nowMin = now.getHours() * 60 + now.getMinutes();
    var target = alarm.hour * 60 + alarm.minute;
    if (!alarm.weekdays || !alarm.weekdays.length) {
      return target > nowMin ? (target - nowMin) : (target + 1440 - nowMin);
    }
    var today = now.getDay();
    var best = Infinity;
    alarm.weekdays.forEach(function (day) {
      var ahead = (day - today + 7) % 7;
      var delta = ahead * 1440 + target - nowMin;
      if (delta <= 0) delta += 7 * 1440;
      if (delta < best) best = delta;
    });
    return best;
  }

  function updateBedtimeButton() {
    if (!els.bedtime) return;
    var armed = bedtimeArmed();
    els.bedtime.dataset.armed = armed ? "1" : "0";
    els.bedtime.textContent = armed
      ? t("settings.alarm.bedtimeStop", null, "취침 해제")
      : t("settings.alarm.bedtimeStart", null, "취침 시작");
  }

  function enterBedtime() {
    if (!alarmPremiumOk()) { try { postToNativeAd({ action: "openPaywall" }); } catch (e) { /* 무시 */ } return; }
    // 시각을 편집 중(설정 화면이 열려 있음)이면 먼저 저장한다 —
    // '취침 시작'만 눌러도 '수정 완료'가 눌린 것처럼 동작한다.
    if (els.configScreen && !els.configScreen.hidden) { onConfirm(); }
    var alarm = nextAlarm();
    if (!alarm) {
      // 알람이 하나도 없으면 지금 화면의 시각으로 먼저 하나 걸어 준다.
      onConfirm();
      alarm = nextAlarm();
      if (!alarm) return;
    }
    // 2026-08-23 — 취침 시작 시 항상 네이티브 알람을 다시 건다.
    // (수정 없이 취침만 눌러도 예약이 확실히 서도록. 안드로이드 MIUI에서
    //  예약이 누락돼 아예 안 울리던 경로를 원천 차단한다.)
    try { pushAlarmToNative(alarm); } catch (e) { /* 무시 */ }
    try { localStorage.setItem("ezlong:bedtimeStartAt", String(Date.now())); } catch (e) { /* 무시 */ }
    clearWakeLog();
    setBedtimeArmed(true);
    document.body.classList.add("bedtime-mode");
    if (els.bar) els.bar.hidden = true;
    if (els.configScreen) els.configScreen.hidden = true;
    showSleepScreen(alarm);
    postAlarmBridge({ action: "startBedtime", id: alarm.id, title: t("settings.alarm.bedtimeActive", null, "취침 중") });
    stopPreview();
    updateBedtimeButton();
    try { if (typeof closeSettings === "function") closeSettings(); } catch (error) { /* 무시 */ }
    try { if (typeof goToPage === "function") goToPage(0); } catch (error) { /* 무시 */ }
  }

  function exitBedtime() {
    webWakeArmed = false;
    stopWebWakeAudio();
    setBedtimeArmed(false);
    document.body.classList.remove("bedtime-mode");
    if (els.bar) els.bar.hidden = true;
    if (els.sleep) els.sleep.hidden = true;
    if (els.configScreen) els.configScreen.hidden = true;
    setAlarmAdHidden(false);
    postAlarmBridge({ action: "stopBedtime" });
    updateBedtimeButton();
    try { updateWakeIcon(); } catch (e) { /* 무시 */ }
  }

  function restoreBedtimeUi() {
    if (!bedtimeArmed()) return;
    var alarm = nextAlarm();
    if (!alarm) { setBedtimeArmed(false); return; }
    if (els.bar) els.bar.hidden = true;
    showSleepScreen(alarm);
  }

  // ── 기상 화면 ───────────────────────────────────────────────────
  //
  // 운영자: "음악을 끄는 방법을 모르겠다."
  //
  // 네이티브가 음악을 틀기 시작하면 __flipzenWakeRinging(true)를 부른다.
  // 그 순간 화면 전체가 [그만] 하나로 바뀐다. 잠에서 덜 깬 사람이
  // 더듬을 곳을 남기지 않는 것이 이 화면의 유일한 목적이다.

  var ringClockTimer = null;

  function paintRingClock() {
    if (!els.ringClock) return;
    var now = new Date();
    els.ringClock.textContent = two(now.getHours()) + ":" + two(now.getMinutes());
  }

  // 2026-08-23 — 기상 화면(스탠바이 모티브). 시간대 배경 사진 위에 현재 시각,
  // 날씨, 수면 시간, 알람 버튼, 그리고 명언박스 자리에 깨우기 히스토리.
  function ringBackgroundUrl() {
    try {
      if (typeof activePhotoSet !== "undefined" && activePhotoSet && activePhotoSet.length
          && typeof imageUrl === "function") {
        return imageUrl(activePhotoSet[activePhotoIndex]) || "";
      }
    } catch (e) { /* 무시 */ }
    return "";
  }
  function renderSleepDuration() {
    if (!els.wakeSleepDuration) return;
    var startAt = 0;
    try { startAt = Number(localStorage.getItem("ezlong:bedtimeStartAt")) || 0; } catch (e) { startAt = 0; }
    if (!startAt) { els.wakeSleepDuration.hidden = true; return; }
    var sess = loadWakeSession();
    var wokeAt = (sess && sess.start) ? sess.start : Date.now();
    var mins = Math.max(0, Math.round((wokeAt - startAt) / 60000));
    if (mins < 1) { els.wakeSleepDuration.hidden = true; return; }
    var h = Math.floor(mins / 60), m = mins % 60, txt;
    if (h > 0 && m > 0) txt = t("settings.alarm.sleptHM", { h: h, m: m }, `${h}시간 ${m}분 주무셨어요`);
    else if (h > 0) txt = t("settings.alarm.sleptH", { h: h }, `${h}시간 주무셨어요`);
    else txt = t("settings.alarm.sleptM", { m: m }, `${m}분 주무셨어요`);
    els.wakeSleepDuration.textContent = txt;
    els.wakeSleepDuration.hidden = false;
  }
  function renderWakeWeather() {
    if (!els.wakeWeather) return;
    var parts = [];
    try {
      if (typeof weatherState !== "undefined" && weatherState) {
        var cur = [];
        if (weatherState.summary) cur.push(weatherState.summary);
        if (weatherState.temp) cur.push(weatherState.temp);
        if (cur.length) parts.push(cur.join(" "));
      }
    } catch (e) { /* 무시 */ }
    try {
      var hilo = window.__flipzenTodayHiLo;
      if (hilo) parts.push(t("settings.alarm.todayLabel", null, "오늘") + " " + hilo);
    } catch (e) { /* 무시 */ }
    if (parts.length) { els.wakeWeather.textContent = parts.join("   ·   "); els.wakeWeather.hidden = false; }
    else els.wakeWeather.hidden = true;
  }
  // 울리는 중 / 해제됨 두 상태의 버튼 전환.
  function setRingDismissed(dismissed) {
    if (els.ringStop) els.ringStop.hidden = dismissed;
    if (els.ringSnooze) els.ringSnooze.hidden = dismissed;
    if (els.wakeDismissed) els.wakeDismissed.hidden = !dismissed;
    if (els.ringMusicChange) els.ringMusicChange.hidden = !dismissed;
    if (els.wakeRingClose) els.wakeRingClose.hidden = !dismissed;
  }
  function showRingScreen(dismissed) {
    if (!els.ring) return;
    els.ring.hidden = false;
    if (els.sleep) els.sleep.hidden = true;
    if (els.configScreen) els.configScreen.hidden = true;
    setAlarmAdHidden(true);
    // 시간대에 맞는 배경 사진(스탠바이 감성). 없으면 기본 어두운 배경.
    var bg = ringBackgroundUrl();
    try {
      els.ring.style.backgroundImage = bg
        ? ('linear-gradient(180deg, rgba(4,10,20,0.42) 0%, rgba(4,10,20,0.32) 32%, rgba(4,10,20,0.78) 100%), url("' + bg + '")')
        : "";
    } catch (e) { /* 무시 */ }
    els.ring.classList.toggle("has-photo", !!bg);
    paintRingClock();
    renderWakeLog();
    renderWakeWeather();
    renderSleepDuration();
    if (els.wakeInfo) els.wakeInfo.hidden = false;
    if (ringClockTimer) window.clearInterval(ringClockTimer);
    ringClockTimer = window.setInterval(paintRingClock, 1000);
    if (els.ringSong) {
      var alarm = nextAlarm();
      els.ringSong.textContent = (alarm && alarm.soundTitle) ? alarm.soundTitle : "";
    }
    setRingDismissed(!!dismissed);
    document.body.classList.remove("bedtime-mode");
    try { if (typeof closeSettings === "function") closeSettings(); } catch (error) { /* 무시 */ }
  }

  function hideRingScreen() {
    if (ringClockTimer) { window.clearInterval(ringClockTimer); ringClockTimer = null; }
    if (els.ring) els.ring.hidden = true;
    stopWebWakeAudio();
    try { clearRockTimers(); } catch (e) { /* 무시 */ }
    setAlarmAdHidden(false);
  }

  // 2026-08-23 — 링/수면 화면 히스토리 위 "음악 변경하기" → 알람 설정 음악 부분으로.
  function goToMusicSettings() {
    try { postAlarmBridge({ action: "stopWakeMusic" }); } catch (e) { /* 무시 */ }
    try { stopWebWakeAudio(); } catch (e) { /* 무시 */ }
    try { hideRingScreen(); } catch (e) { /* 무시 */ }
    try { exitBedtime(); } catch (e) { /* 무시 */ }
    try { openAlarmSettings(); } catch (e) { /* 무시 */ }
    try { openConfigScreen(false); } catch (e) { /* 무시 */ }
    try { setSoundDetailOpen(true); } catch (e) { /* 무시 */ }
    window.setTimeout(function () {
      try {
        var node = (els && (els.soundDetail || els.soundList)) || null;
        if (node && node.scrollIntoView) node.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (e) { /* 무시 */ }
    }, 260);
  }
  function bindRingButtons() {
    if (els.ringMusicChange) els.ringMusicChange.addEventListener("click", goToMusicSettings);
    if (els.wakeWeatherDetail) els.wakeWeatherDetail.addEventListener("click", function () {
      try { if (typeof openWeatherDetail === "function") openWeatherDetail(); } catch (e) { /* 무시 */ }
    });

    if (els.ringStop) {
      els.ringStop.addEventListener("click", function () {
        // 소리만 멈춘다. 화면은 그대로 두고 '해제됨' 상태로 바꿔,
        // 깨우기 히스토리를 계속 볼 수 있게 한다(운영 지침).
        try { postAlarmBridge({ action: "stopWakeMusic" }); } catch (e) { /* 무시 */ }
        try { stopWebWakeAudio(); } catch (e) { /* 무시 */ }
        try { clearRockTimers(); } catch (e) { /* 무시 */ }
        try { var sess = loadWakeSession(); if (sess && !sess.stop) { sess.stop = Date.now(); saveWakeSession(sess); } } catch (e) { /* 무시 */ }
        stopWakeLogTimer();
        // 취침 모드는 끝났다(다시 안 울리게) — 다만 화면은 닫지 않는다.
        try { setBedtimeArmed(false); } catch (e) { /* 무시 */ }
        document.body.classList.remove("bedtime-mode");
        try { postAlarmBridge({ action: "stopBedtime" }); } catch (e) { /* 무시 */ }
        renderWakeLog();
        renderSleepDuration();
        setRingDismissed(true);
      });
    }
    if (els.wakeRingClose) {
      els.wakeRingClose.addEventListener("click", function () {
        hideRingScreen();
        setAlarmAdHidden(false);
      });
    }
    if (els.ringSnooze) {
      els.ringSnooze.addEventListener("click", function () {
        postAlarmBridge({ action: "snoozeWakeMusic", minutes: 10 });
        hideRingScreen();
      });
    }
  }

  // ── 2026-08-23 울림 화면 재생 내역 ─────────────────────────
  // 자느라 알람을 놓친 사람이 "왜 안 울렸지?" 오해하지 않도록, 어떤 음악이
  // 몇 시 몇 분 몇 초부터 울리고 있었는지 담담하게 보여준다. 죄책감 주지 않게.
  var WAKESESSION_KEY = "ezlong:wakeSession";
  function loadWakeSession() { try { var r = localStorage.getItem(WAKESESSION_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function saveWakeSession(sess) { try { localStorage.setItem(WAKESESSION_KEY, JSON.stringify(sess)); } catch (e) { /* 무시 */ } }

  // ── 2026-08-23 운영자: 록 에스컬레이션 ──────────────────────────
  // 소프트 곡으로 3분 재웠는데도 안 깨면(=알람 해제 안 하면) 시끄러운 록으로
  // 세게 깨운다. 3분·8분·13분 세 번, 매번 ROCK 탭에서 무작위로 한 곡 골라
  // 최대 볼륨으로. 세 번 다 실패하면 18분에 그냥 그만둔다 — 자는 게 아니라
  // 다른 일 중이거나 가방 속으로 본다. 타이밍은 웹이 쥐고, 네이티브는
  // "이 URL 을 크게 틀어라"만 받는다(escalateWake).
  var ROCK_OFFSETS = [180, 480, 780];   // 초 — 3분, 8분, 13분
  var ROCK_GIVE_UP = 1080;              // 초 — 18분
  var rockTimers = [];
  var webRockRampTimer = null;
  // 2026-08-23 운영자: 록 볼륨 계단 — 갑자기 크게 X.
  //
  // 2026-08-29 운영자: "락음악이 처음부터 큰 볼륨으로 나오는 건 안드로이드만이
  // 아니라 아이폰에도 있던 문제였다."
  //
  // 맞다. 그리고 원인은 내 쪽이었다. 이 램프 함수는 **세 곳**에 있다 —
  // 여기(웹), iOS WakeMusicPlayer.rockRampVolume, Android WakeVolumeCurve.rockSteps.
  // 8월 27일에 네이티브 두 곳만 0.06 으로 낮추고 **여기를 빠뜨렸다.** 웹 폴백이
  // 소리를 내고 있을 때는 이 값이 그대로 쓰이므로, 고쳤다고 말한 뒤에도
  // 0.40 으로 터졌다. 세 곳의 숫자가 어긋나면 어느 한쪽은 반드시 틀린다.
  //
  // ※ 이 표를 고칠 때는 반드시 세 곳을 함께 고칠 것.
  //    ios/FlipZenClock/WakeMusicPlayer.swift  rockRampVolume(_:)
  //    android/.../alarm/WakeAlarm.kt          WakeVolumeCurve.rockSteps
  function rockRampVolume(sec) {
    if (sec < 8) return 0.06;
    if (sec < 16) return 0.10;
    if (sec < 24) return 0.16;
    if (sec < 32) return 0.24;
    if (sec < 40) return 0.34;
    if (sec < 48) return 0.46;
    if (sec < 56) return 0.60;
    return 0.80;
  }
  function clearRockTimers() {
    for (var ri = 0; ri < rockTimers.length; ri += 1) {
      try { window.clearTimeout(rockTimers[ri]); } catch (e) { /* 무시 */ }
    }
    rockTimers = [];
  }
  function pickRockUrl() {
    try {
      var pool = (alarmTracks().rock || []);
      if (!pool.length) return null;
      var idx = Math.floor(Math.random() * pool.length);
      var track = pool[idx];
      var u = (typeof resolveTrackAbsoluteUrl === "function") ? resolveTrackAbsoluteUrl(track) : "";
      return u ? { url: u, title: track.title || "" } : null;
    } catch (e) { return null; }
  }
  function fireRockRound(roundIndex) {
    var pick = pickRockUrl();
    if (!pick) return;   // 록 곡이 하나도 없으면 조용히 넘어간다(소프트 유지)
    // 네이티브 오디오 엔진에게: 이 URL 을 최대 볼륨으로 갈아끼워라.
    try { postAlarmBridge({ action: "escalateWake", soundUrl: pick.url, volume: 0.8 }); } catch (e) { /* 무시 */ }
    // 웹 폴백(네이티브 없이 웹이 소리 내는 중)이면 소스를 록으로 갈아끼운다.
    // 볼륨은 4단계(0.40)에서 계단식으로 0.80까지만 — 놀라지 않게.
    if (webWakeAudio) {
      try {
        stopWebWakeAudio();
        webWakeAudio = new Audio(pick.url);
        webWakeAudio.loop = true;
        webWakeAudio.volume = rockRampVolume(0);
        webWakeAudio.play().catch(function () { /* 차단 시 조용히 */ });
        var rockStart = Date.now();
        webRockRampTimer = window.setInterval(function () {
          if (!webWakeAudio) { if (webRockRampTimer) { window.clearInterval(webRockRampTimer); webRockRampTimer = null; } return; }
          var rsec = (Date.now() - rockStart) / 1000;
          try { webWakeAudio.volume = rockRampVolume(rsec); } catch (e) { /* 무시 */ }
          // 2026-08-29 — 계단이 56초까지 이어지므로 32초에서 멈추면 0.24 에 갇힌다.
          if (rsec > 60 && webRockRampTimer) { window.clearInterval(webRockRampTimer); webRockRampTimer = null; }
        }, 1000);
      } catch (e) { /* 무시 */ }
    }
    // 히스토리에 남긴다(익살스럽게 — genWakeTimeline 이 rockRounds 를 읽어 렌더).
    try {
      var sess = loadWakeSession();
      if (sess && !sess.stop) {
        if (!Array.isArray(sess.rockRounds)) sess.rockRounds = [];
        sess.rockRounds.push({ t: Date.now(), title: pick.title, round: roundIndex + 1 });
        saveWakeSession(sess);
        renderWakeLog();
      }
    } catch (e) { /* 무시 */ }
  }
  function startRockEscalation() {
    clearRockTimers();
    var sess = loadWakeSession();
    if (!sess || !sess.start || sess.stop) return;
    var base = sess.start;
    for (var i = 0; i < ROCK_OFFSETS.length; i += 1) {
      (function (idx) {
        var due = base + ROCK_OFFSETS[idx] * 1000 - Date.now();
        if (due < 0) due = 0;   // 이미 지난 시점이면(JS가 잠깐 멈췄다 깨어남) 곧바로
        rockTimers.push(window.setTimeout(function () {
          var s2 = loadWakeSession();
          if (!s2 || s2.stop) return;   // 그새 해제됨 — 조용히
          fireRockRound(idx);
        }, due));
      })(i);
    }
    // 마지막 — 18분에 그냥 그만둔다.
    var giveUpDue = base + ROCK_GIVE_UP * 1000 - Date.now();
    if (giveUpDue < 0) giveUpDue = 0;
    rockTimers.push(window.setTimeout(function () {
      var s3 = loadWakeSession();
      if (!s3 || s3.stop) return;
      try { postAlarmBridge({ action: "stopWakeMusic" }); } catch (e) { /* 무시 */ }
      try { stopWebWakeAudio(); } catch (e) { /* 무시 */ }
      try { s3.stop = Date.now(); s3.gaveUp = true; saveWakeSession(s3); } catch (e) { /* 무시 */ }
      try { stopWakeLogTimer(); } catch (e) { /* 무시 */ }
      try { renderWakeLog(); } catch (e) { /* 무시 */ }
      try { renderSleepDuration(); } catch (e) { /* 무시 */ }
      try { setRingDismissed(true); } catch (e) { /* 무시 */ }
    }, giveUpDue));
  }
  function clearWakeLog() {
    webWakeArmed = false;
    try { localStorage.removeItem(WAKESESSION_KEY); } catch (e) { /* 무시 */ }
    [els && els.ringLog, els && els.sleepLog].forEach(function (cc) { if (cc) { cc.hidden = true; cc.innerHTML = ""; } });
  }
  // 깨우려고 한 모든 노력을 시간순으로 재구성한다. 네이티브 스케줄과 똑같은
  // 타임라인이라 JS가 잠깐 멈췄다 깨어나도 본 시각 기준으로 정확히 채워진다.
  function genWakeTimeline(session) {
    if (!session || !session.start) return [];
    var start = session.start;
    var title = session.title || t("settings.alarm.logUnknown", null, "\uc54c\ub78c \uc74c\uc545");
    var GIVE_UP = 1080;   // 18\ubd84 \u2014 \uc18c\ud504\ud2b8 3\ubd84 + \ub85d 3\ud68c(5\ubd84 \uac04\uaca9)
    var stopped = session.stop || null;
    var cap = start + GIVE_UP * 1000;
    var endMs = stopped ? Math.min(stopped, cap) : Math.min(Date.now(), cap);
    var elapsed = Math.max(0, (endMs - start) / 1000);
    var rounds = Array.isArray(session.rockRounds) ? session.rockRounds : [];
    var ev = [];
    ev.push({ t: start, text: title + " \u2014 " + t("settings.alarm.logStart", null, "\uc544\uc8fc \uc791\uc740 \uc18c\ub9ac\ub85c \uc0b4\uc0b4 \uc7ac\uc0dd \uc2dc\uc791") });
    if (elapsed >= 60)  ev.push({ t: start + 60 * 1000,  text: t("settings.alarm.logRise1", null, "\uc18c\ub9ac\ub97c \uc870\uae08\uc529 \ud0a4\uc6b0\ub294 \uc911 \u2014 \uc544\uc9c1 \ubd80\ub4dc\ub7fd\uac8c") });
    if (elapsed >= 120) ev.push({ t: start + 120 * 1000, text: t("settings.alarm.logRise2", null, "\uadf8\ub798\ub3c4 \uc790\uace0 \uc788\ub124\uc694 \u2014 \uc18c\ub9ac \uc870\uae08 \ub354") });
    var ROCK_OFF = [180, 480, 780];
    var QUIP = [
      t("settings.alarm.logRock1", null, "3\ubd84 \ub3d9\uc548 \uc548 \uae68\uc11c, \uc2dc\ub044\ub7ec\uc6b4 \ub77d \uc74c\uc545\uc73c\ub85c \uae68\uc6b0\uae30 \uc2dc\ub3c4\ud569\ub2c8\ub2e4"),
      t("settings.alarm.logRock2", null, "\uc544\uc9c1\ub3c4 \uafc8\ub098\ub77c\u2026 \ub77d \ud55c \uace1 \ub354 \uc138\uac8c \uac11\ub2c8\ub2e4"),
      t("settings.alarm.logRock3", null, "\ub9c8\uc9c0\ub9c9\uc774\uc5d0\uc694, \ud06c\uac8c \ud55c \ubc88 \ub354 \ud754\ub4e4\uc5b4 \uae68\uc6c1\ub2c8\ub2e4")];
    for (var i = 0; i < ROCK_OFF.length; i += 1) {
      if (elapsed < ROCK_OFF[i]) break;
      var rtitle = (rounds[i] && rounds[i].title) ? rounds[i].title : "";
      var rt = (rounds[i] && rounds[i].t) ? rounds[i].t : (start + ROCK_OFF[i] * 1000);
      ev.push({ t: rt, text: QUIP[i] + (rtitle ? (" \u2014 " + rtitle) : "") });
    }
    if (stopped && (stopped - start) / 1000 < GIVE_UP) {
      ev.push({ t: stopped, text: t("settings.alarm.logStopped", null, "\uc54c\ub78c \ud574\uc81c\ub428 \u2014 \uc798 \uc77c\uc5b4\ub0ac\uc5b4\uc694, \uc218\uace0\ud588\uc5b4\uc694") });
    } else if (elapsed >= GIVE_UP) {
      ev.push({ t: cap, text: t("settings.alarm.logGaveUp", null, "\uc5ec\uae30\uc11c \uba48\ucda5\ub2c8\ub2e4 \u2014 \uc790\ub294 \uac8c \uc544\ub2c8\ub77c \ub2e4\ub978 \uc77c \uc911\uc774\uac70\ub098 \uac00\ubc29 \uc18d\uc778\uac00 \ubd10\uc694") });
    }
    return ev;
  }
  function renderOneWakeLog(container, ev) {
    if (!container) return;
    if (!ev.length) { container.hidden = true; container.innerHTML = ""; return; }
    container.hidden = false;
    container.innerHTML = "";
    var head = document.createElement("p");
    head.className = "wake-ring-log-head";
    head.textContent = t("settings.alarm.logHead", null, "\uc774\ub807\uac8c \uae68\uc6b0\ub824\uace0 \ud588\uc5b4\uc694");
    container.appendChild(head);
    ev.forEach(function (e) {
      var d = new Date(e.t);
      var row = document.createElement("div");
      row.className = "wake-ring-log-row";
      var tm = document.createElement("span");
      tm.className = "wake-ring-log-time";
      tm.textContent = two(d.getHours()) + ":" + two(d.getMinutes()) + ":" + two(d.getSeconds());
      var ti = document.createElement("span");
      ti.className = "wake-ring-log-title";
      ti.textContent = e.text;
      row.appendChild(tm);
      row.appendChild(ti);
      container.appendChild(row);
    });
  }
  function renderWakeLog() {
    var ev = genWakeTimeline(loadWakeSession());
    renderOneWakeLog(els && els.ringLog, ev);
    renderOneWakeLog(els && els.sleepLog, ev);
  }
  var wakeLogTimer = null;
  function startWakeLogTimer() { stopWakeLogTimer(); try { wakeLogTimer = window.setInterval(renderWakeLog, 15000); } catch (e) { /* 무시 */ } }
  function stopWakeLogTimer() { if (wakeLogTimer) { window.clearInterval(wakeLogTimer); wakeLogTimer = null; } }
  // 네이티브가 부른다. 두 번째 인자로 곡 제목이 온다(구버전 대비 기본값 처리).
  window.__flipzenWakeRinging = function (ringing, title) {
    if (ringing) {
      var s = loadWakeSession();
      if (!s || s.stop || (Date.now() - (s.start || 0)) > 690000) {
        s = { start: Date.now(), title: title || "", stop: null };
        saveWakeSession(s);
      }
      renderWakeLog();
      startWakeLogTimer();
      showRingScreen();
      try { startRockEscalation(); } catch (e) { /* 무시 */ }
    } else {
      try { clearRockTimers(); } catch (e) { /* 무시 */ }
      var s3 = loadWakeSession();
      if (s3 && !s3.stop) { s3.stop = Date.now(); saveWakeSession(s3); }
      stopWakeLogTimer();
      renderWakeLog();
      // 2026-08-23 운영 지침: 소리가 멈춰도(사용자 해제/자동 종료) 화면은
      // 닫지 않는다. 울림 화면이 떠 있으면 '해제됨' 상태로 두어 수면시간·
      // 깨우기 내역·음악 변경하기를 계속 볼 수 있게 한다(iOS도 Android처럼).
      if (els && els.ring && !els.ring.hidden) {
        try { stopWebWakeAudio(); } catch (e) { /* 무시 */ }
        try { renderSleepDuration(); } catch (e) { /* 무시 */ }
        setRingDismissed(true);
      } else {
        hideRingScreen();
      }
    }
  };

  // ── 열기 ────────────────────────────────────────────────────────

  function openAlarmSettings() {
    try {
      if (typeof openSettings === "function") openSettings("alarm");
    } catch (error) { /* 무시 */ }
  }

  // 네이티브(위젯 탭 → longtime://alarms)가 부른다.
  // ── 2026-08-23 운영자: 밤(22~05시) 홈 플립시계 위 '기상 알람' 아이콘 ──────
  // 누르면: 다가오는 아침(다음날)에 기상 알람이 있으면 바로 취침 시작,
  // 없으면 기상 알람 설정 화면으로 보낸다.
  function wakeIconWindowNow() {
    var h = new Date().getHours();
    return (h >= 22 || h < 5);   // 22:00 ~ 04:59
  }
  function comingWakeWeekday() {
    var now = new Date();
    return (now.getHours() >= 22) ? ((now.getDay() + 1) % 7) : now.getDay();
  }
  function hasWakeForComingMorning() {
    var wd = comingWakeWeekday();
    return loadAlarms().some(function (a) {
      var d = a.weekdays || [];
      return !d.length || d.indexOf(wd) !== -1;   // 매일 또는 그 요일
    });
  }
  function onWakeIconTap() {
    if (hasWakeForComingMorning() && nextAlarm()) {
      enterBedtime();                 // 다음 기상시간에 맞춰 바로 취침 시작
    } else {
      openAlarmSettings();            // 기상시간 설정 화면으로
      try { openConfigScreen(false); } catch (e) { /* 무시 */ }
    }
  }
  function shouldShowWakeIcon() {
    // 2026-08-24 운영자: 시계와 동시에(문장박스보다 먼저) 뜨게 — supported 확정을
    // 기다리지 않는다. 알람이 확정적으로 미지원일 때만 숨긴다.
    if (wakeAlarmUnsupported) return false;
    if (!wakeIconWindowNow()) return false;
    if (bedtimeArmed()) return false;
    try { if (document.body.classList.contains("bedtime-mode")) return false; } catch (e) { /* 무시 */ }
    if (els.ring && !els.ring.hidden) return false;
    if (els.sleep && !els.sleep.hidden) return false;
    if (els.configScreen && !els.configScreen.hidden) return false;
    return true;
  }
  function ensureWakeIcon() {
    if (document.getElementById("wakeHomeIcon")) return;
    var stage = document.querySelector(".clock-stage");
    if (!stage) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "wakeHomeIcon";
    btn.className = "wake-home-icon";
    btn.hidden = true;
    btn.setAttribute("aria-label", t("settings.alarm.heading", null, "기상 알람"));
    btn.innerHTML =
      '<svg viewBox="0 0 42 34" width="36" height="29" fill="none" aria-hidden="true">'
      + '<path d="M16 6.5a11 11 0 1 0 10 16.5A9 9 0 0 1 16 6.5z" fill="currentColor"></path>'
      + '<circle cx="7.5" cy="10" r="0.9" fill="currentColor"></circle>'
      + '<path d="M26.5 4l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7z" fill="currentColor"></path>'
      + '<text x="28" y="31" font-size="7" font-weight="800" fill="currentColor" font-family="system-ui,-apple-system,sans-serif">z</text>'
      + '<text x="32.5" y="26" font-size="9" font-weight="800" fill="currentColor" font-family="system-ui,-apple-system,sans-serif">z</text>'
      + '<text x="37" y="20.5" font-size="11" font-weight="800" fill="currentColor" font-family="system-ui,-apple-system,sans-serif">z</text>'
      + '</svg>'
      + '<span class="wake-home-icon-label">' + t("settings.alarm.heading", null, "기상 알람") + '</span>';
    btn.addEventListener("click", function (e) { e.stopPropagation(); onWakeIconTap(); });
    stage.insertBefore(btn, stage.firstChild);
  }
  function updateWakeIcon() {
    var btn = document.getElementById("wakeHomeIcon");
    if (!btn) { ensureWakeIcon(); btn = document.getElementById("wakeHomeIcon"); }
    if (!btn) return;
    btn.hidden = !shouldShowWakeIcon();
  }

  window.__flipzenOpenWakeAlarm = openAlarmSettings;
  // 프리미엄 상태가 늦게 들어와도 설정을 열 때 다시 게이팅을 평가한다.
  window.__flipzenAlarmRefresh = function () { try { applyGating(); } catch (e) { /* 무시 */ } };

  // ── 플랫폼 판별 ─────────────────────────────────────────────────
  //
  // AlarmKit은 iOS 26부터다. 웹이 UA로 짐작하는 대신 네이티브에게 직접
  // 묻는다 — 구버전 앱은 이 질문에 답하지 않으므로 자연스럽게 숨겨진다.

  var NOTICE_ID = "wakeAlarmUnsupportedNotice";

  function showUnsupportedNotice() {
    if (!els.section || document.getElementById(NOTICE_ID)) return;
    // 알맹이는 감추고 안내만 남긴다 — 못 쓰는 조작부를 보여 줘 봐야
    // 눌러 보고 실망하는 자리만 만든다.
    ["time", "weekdays", "repeatNote", "soundTabs", "soundList",
     "confirm", "list", "bedtime"].forEach(function (key) {
      var node = els[key];
      if (node) node.style.display = "none";
    });
    var hint = els.section.querySelector(".alarm-standby-hint");
    if (hint) hint.style.display = "none";
    var subhead = els.section.querySelector(".alarm-subhead");
    if (subhead) subhead.style.display = "none";
    var fade = els.section.querySelector(".alarm-fade-guide");
    if (fade) fade.style.display = "none";
    var block = els.section.querySelector(".alarm-bedtime-block");
    if (block) block.style.display = "none";
    var option = els.section.querySelector(".field-option");
    if (option) option.style.display = "none";

    var note = document.createElement("p");
    note.id = NOTICE_ID;
    note.className = "settings-desc settings-desc-muted";
    note.textContent = t(
      "settings.alarm.unsupported", null,
      "기상 알람은 iOS 26 이상에서, 그리고 앱을 새로 설치한 뒤에 쓸 수 있습니다."
    );
    els.section.appendChild(note);

    // 같은 자리에서 두 번 막히지 않도록 진단 한 줄을 남긴다. 어디까지
    // 신호가 닿았는지 화면만 보고 알 수 있다.
    var diag = document.createElement("p");
    diag.className = "settings-desc settings-desc-muted";
    diag.style.fontSize = "11px";
    diag.style.opacity = "0.5";
    diag.textContent = "bridge " + (bridgeAvailable() ? "O" : "X")
      + " / injected " + (typeof window.__FLIPZEN_ALARM_SUPPORTED__ === "boolean"
          ? String(window.__FLIPZEN_ALARM_SUPPORTED__) : "none")
      + " / wrapper " + (typeof isNativeWrapper !== "undefined" && isNativeWrapper ? "O" : "X");
    els.section.appendChild(diag);
  }

  function clearUnsupportedNotice() {
    var note = document.getElementById(NOTICE_ID);
    if (note && note.parentNode) {
      var diag = note.nextSibling;
      note.parentNode.removeChild(note);
      if (diag && diag.parentNode) diag.parentNode.removeChild(diag);
    }
    ["time", "weekdays", "repeatNote", "soundTabs", "soundList",
     "confirm", "list", "bedtime"].forEach(function (key) {
      var node = els[key];
      if (node) node.style.display = "";
    });
    if (!els.section) return;
    [".alarm-standby-hint", ".alarm-subhead", ".alarm-fade-guide",
     ".alarm-bedtime-block", ".field-option"].forEach(function (sel) {
      var node = els.section.querySelector(sel);
      if (node) node.style.display = "";
    });
  }

  function bridgeAvailable() {
    try {
      if (window.webkit && window.webkit.messageHandlers
          && window.webkit.messageHandlers.flipzenApp) return true;
      if (window.AndroidNativeBridge) return true;
    } catch (error) { /* 무시 */ }
    return false;
  }

  // 브릿지에 직접 보낸다. postToNativeApp은 isNativeWrapper(=쿼리스트링
  // ?native=ios)에 기대는데, 그 값 하나가 어떤 이유로든 빠지면 알람이
  // 통째로 사라진다. 여기서는 브릿지 객체를 직접 붙잡는다.
  function postAlarmBridge(payload) {
    try {
      if (window.webkit && window.webkit.messageHandlers
          && window.webkit.messageHandlers.flipzenApp) {
        window.webkit.messageHandlers.flipzenApp.postMessage(payload);
        return true;
      }
      if (window.AndroidNativeBridge) {
        window.AndroidNativeBridge.postMessage("flipzenApp", JSON.stringify(payload));
        return true;
      }
    } catch (error) { /* 브릿지 미준비 — 조용히 넘어간다 */ }
    return false;
  }

  function bindAll() {
    bindRingButtons();
  }

  function askCapability() {
    // 1차 — 네이티브가 문서 시작 전에 심어 둔 값. 왕복이 없어 실패할
    // 여지가 없다(ContentView.swift의 atDocumentStart userScript).
    if (typeof window.__FLIPZEN_ALARM_SUPPORTED__ === "boolean") {
      supported = window.__FLIPZEN_ALARM_SUPPORTED__;
      wakeAlarmUnsupported = !supported;
      applyGating();
      return;
    }

    // 2차 — 값이 안 심긴 구버전 앱. 물어보는 옛 경로로 폴백한다.
    if (!bridgeAvailable()) { applyGating(); return; }
    var settled = false;
    window.__flipzenAlarmCapability = function (result) {
      if (settled) return;
      settled = true;
      supported = !!(result && result.supported);
      wakeAlarmUnsupported = !supported;
      applyGating();
    };
    // 한 번만 묻고 3초에 포기하면 브릿지가 늦게 붙는 순간을 놓친다.
    // 1초·3초에 한 번씩 더 두드리고 7초까지 기다린다.
    [0, 1000, 3000].forEach(function (delay) {
      window.setTimeout(function () {
        if (!settled) postAlarmBridge({ action: "alarmCapability" });
      }, delay);
    });
    window.setTimeout(function () {
      if (settled) return;
      settled = true;
      supported = false;
      wakeAlarmUnsupported = true;
      applyGating();
    }, 7000);
  }

  // 2026-08-23 — 기상 알람 프리미엄 게이트. 설치 후 14일은 무료 체험,
  // 이후에는 프리미엄(구독) 사용자만 쓸 수 있다. __FLIPZEN_PREMIUM__ 는
  // 네이티브가 무료 창까지 합쳐 내려주는 값이고, 스토리지 폴백
  // (flipzen_first_seen)은 영상 배경 게이트와 같은 키를 공유한다.
  var ALARM_PREMIUM_NOTICE_ID = "wakeAlarmPremiumNotice";
  function alarmPremiumOk() {
    try {
      if (window.__FLIPZEN_PREMIUM__ === true) return true;
      var v = localStorage.getItem("flipzen_first_seen");
      if (!v) { v = String(Date.now()); localStorage.setItem("flipzen_first_seen", v); }
      return (Date.now() - Number(v)) < (14 * 24 * 60 * 60 * 1000);
    } catch (e) { return false; }
  }
  var ALARM_HIDE_KEYS = ["time","weekdays","repeatNote","snooze","soundTabs","soundList","confirm","list","bedtime","openConfig","homeSummary","soundSummary","configBedtime"];
  var ALARM_HIDE_SEL = [".alarm-standby-hint",".alarm-subhead",".alarm-fade-guide",".alarm-bedtime-block",".field-option"];
  function showAlarmPremiumNotice() {
    if (!els.section || document.getElementById(ALARM_PREMIUM_NOTICE_ID)) return;
    ALARM_HIDE_KEYS.forEach(function (k) { var n = els[k]; if (n) n.style.display = "none"; });
    ALARM_HIDE_SEL.forEach(function (sel) { var n = els.section.querySelector(sel); if (n) n.style.display = "none"; });
    var note = document.createElement("p");
    note.id = ALARM_PREMIUM_NOTICE_ID;
    note.className = "settings-desc settings-desc-muted";
    note.textContent = t("settings.alarm.premiumOnly", null,
      "기상 알람은 프리미엄 기능입니다. 설치 후 첫 2주는 무료로 써 보실 수 있고, 이후에는 프리미엄에서 이용할 수 있어요.");
    els.section.appendChild(note);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = ALARM_PREMIUM_NOTICE_ID + "Btn";
    btn.className = "premium-upgrade-button";
    btn.textContent = t("settings.premium.cta", null, "프리미엄으로 업그레이드");
    btn.addEventListener("click", function () {
      try { postToNativeAd({ action: "openPaywall" }); } catch (e) { /* 무시 */ }
    });
    els.section.appendChild(btn);
  }
  function clearAlarmPremiumNotice() {
    var note = document.getElementById(ALARM_PREMIUM_NOTICE_ID);
    if (note && note.parentNode) note.parentNode.removeChild(note);
    var btn = document.getElementById(ALARM_PREMIUM_NOTICE_ID + "Btn");
    if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
    ALARM_HIDE_KEYS.forEach(function (k) { var n = els[k]; if (n) n.style.display = ""; });
    if (els.section) ALARM_HIDE_SEL.forEach(function (sel) { var n = els.section.querySelector(sel); if (n) n.style.display = ""; });
  }
  function applyGating() {
    if (!els || !els.section) return;

    // 2026-08-20 개정 — 예전엔 지원 안 되면 통째로 숨겼다. 그러면 왜
    // 안 보이는지 알 길이 없다. iOS 앱 안에서는 섹션을 보여 주되 이유를
    // 적는다.
    //
    // 다만 안드로이드는 예외다. 기상 알람은 AlarmKit(iOS 26+) 위에 지은
    // 기능이라 안드로이드에는 아직 대응물이 없는데, 그 사실을 "iOS 26
    // 이상이 필요합니다"라고 알리면 안드로이드 사용자에게는 폰을 바꾸라는
    // 말밖에 안 된다. 할 수 있는 일이 없는 안내는 안내가 아니다.
    // 브라우저와 똑같이 조용히 감춘다 — 나중에 안드로이드 AlarmManager로
    // 같은 기능을 지으면 그때 다시 연다.
    var onIOS = typeof nativePlatformKey !== "undefined" && nativePlatformKey === "ios";
    els.section.hidden = !supported && !onIOS;

    if (!supported) {
      if (els.bar) els.bar.hidden = true;
      document.body.classList.remove("bedtime-mode");
      if (onIOS) showUnsupportedNotice();
      return;
    }
    clearUnsupportedNotice();
    try { updateWakeIcon(); } catch (e) { /* 무시 */ }
    // 프리미엄 게이트 — 무료 체험(14일)이 지난 비구독자는 안내만 보여준다.
    if (!alarmPremiumOk()) {
      if (els.bar) els.bar.hidden = true;
      document.body.classList.remove("bedtime-mode");
      showAlarmPremiumNotice();
      return;
    }
    clearAlarmPremiumNotice();
    renderWeekdays();
    renderSoundTabs();
    renderSoundList();
    updateSoundSummary();
    renderList();
    restoreBedtimeUi();
  }

  // ── 배선 ────────────────────────────────────────────────────────

  // ── 2026-08-22 2depth 설정 페이지 · 수면 화면 · 홈 요약 ──────
  function setAlarmAdHidden(on) {
    window.__alarmHidesAd = !!on;
    try { if (typeof window.__flipzenReportAdLayout === "function") window.__flipzenReportAdLayout(); } catch (error) { /* 무시 */ }
  }
  function renderHomeSummary() {
    if (!els.homeSummary) return;
    var a = nextAlarm();
    if (!a) { els.homeSummary.hidden = true; return; }
    els.homeSummary.hidden = false;
    if (els.homeSummaryTime) els.homeSummaryTime.textContent = two(a.hour) + ":" + two(a.minute);
    if (els.homeSummaryMeta) els.homeSummaryMeta.textContent = alarmSubtitle(a);
  }
  function openConfigScreen(scrollToTime) {
    if (!els.configScreen) return;
    if (!alarmPremiumOk()) { try { postToNativeAd({ action: "openPaywall" }); } catch (e) { /* 무시 */ } return; }
    els.configScreen.hidden = false;
    setAlarmAdHidden(true);
    try { requestAlarmScreenStatus(); } catch (e) { /* 무시 */ }
    if (scrollToTime && els.time) {
      // 클릭 제스처 안에서 바로 시간 돌림판을 띄운다(showPicker는 사용자
      // 활성화가 필요해 setTimeout으로 미루면 안 먹는다).
      try { els.time.scrollIntoView({ behavior: "auto", block: "center" }); } catch (error) { /* 무시 */ }
      try { els.time.focus({ preventScroll: true }); } catch (error) { /* 무시 */ }
      try { if (typeof els.time.showPicker === "function") els.time.showPicker(); } catch (error) { /* 무시 */ }
    }
  }
  function closeConfigScreen() {
    if (els.configScreen) els.configScreen.hidden = true;
    stopPreview();
    renderHomeSummary();
    if (bedtimeArmed()) showSleepScreen();
    else setAlarmAdHidden(false);
    try { updateWakeIcon(); } catch (e) { /* 무시 */ }
  }
  var sleepClockTimer = null;
  // ── 2026-08-23 포그라운드 폴백 ──────────────────────────────────
  // 네이티브 알람이 안 뜬 안드로이드(및 만일의 경우)에서도, 앱이 켜져 있으면
  // 웹이 스스로 기상 시각을 감지해 깨운다. 네이티브가 먼저 울리면(링 화면이
  // 이미 떠 있으면) 절대 끼어들지 않는다 — 이중 재생을 막는다.
  var webWakeArmed = false;
  var webWakeAudio = null;
  var webWakeRampTimer = null;
  var webWakeStartedAt = 0;
  function stopWebWakeAudio() {
    if (webWakeRampTimer) { window.clearInterval(webWakeRampTimer); webWakeRampTimer = null; }
    if (webRockRampTimer) { window.clearInterval(webRockRampTimer); webRockRampTimer = null; }
    if (webWakeAudio) { try { webWakeAudio.pause(); } catch (e) { /* 무시 */ } webWakeAudio = null; }
  }
  function ringing() { return !!(els && els.ring && !els.ring.hidden); }
  function webFallbackRing(alarm) {
    if (ringing()) return;               // 네이티브가 먼저 울렸다 — 물러난다
    var track = (typeof findTrackByFile === "function") ? findTrackByFile(alarm && alarm.trackFile) : null;
    var url = "";
    if (track && typeof resolveTrackAbsoluteUrl === "function") {
      try { url = resolveTrackAbsoluteUrl(track); } catch (e) { url = ""; }
    }
    var title = (track && track.title) || (alarm && alarm.soundTitle) || "";
    // 네이티브 경로와 똑같이 세션을 세우고 링 화면·히스토리를 띄운다.
    saveWakeSession({ start: Date.now(), title: title, stop: null });
    renderWakeLog();
    startWakeLogTimer();
    showRingScreen();
    try { startRockEscalation(); } catch (e) { /* 무시 */ }
    if (!url) return;
    try {
      stopWebWakeAudio();
      webWakeAudio = new Audio(url);
      webWakeAudio.loop = true;
      webWakeAudio.volume = 0.012;      // 새벽에도 놀라지 않게 아주 작게 시작
      webWakeStartedAt = Date.now();
      webWakeAudio.play().catch(function () { /* 자동재생 차단 시 조용히 */ });
      // 정각부터 서서히 — iOS 네이티브 곡선과 같은 결.
      webWakeRampTimer = window.setInterval(function () {
        if (!webWakeAudio) return;
        var el = (Date.now() - webWakeStartedAt) / 1000;
        var v;
        if (el < 60) v = 0.012; else if (el < 95) v = 0.022;
        else if (el < 130) v = 0.04; else if (el < 170) v = 0.065;
        else if (el < 210) v = 0.10; else if (el < 255) v = 0.16;
        else if (el < 300) v = 0.26; else if (el < 350) v = 0.44;
        else if (el < 410) v = 0.70; else v = 1.0;
        try { webWakeAudio.volume = Math.max(0, Math.min(1, v)); } catch (e) { /* 무시 */ }
        if (el > 1080) stopWebWakeAudio();  // 18분에 자동 종료(록 3회 스케줄이 돌게)
      }, 500);
    } catch (e) { /* 무시 */ }
  }
  function checkWebWake(now) {
    if (!bedtimeArmed()) return;
    if (ringing()) return;               // 이미 울리는 중
    if (webWakeArmed) return;            // 이미 예약됨
    var alarm = nextAlarm();
    if (!alarm) return;
    // 오늘의 기상 시각을 초 단위로 만들어, 방금 지났는지 본다.
    var target = new Date(now);
    target.setHours(alarm.hour, alarm.minute, 0, 0);
    var passed = (now.getTime() - target.getTime()) / 1000; // 양수면 지났음
    if (passed >= 0 && passed < 120) {
      webWakeArmed = true;
      // 네이티브에 4초 양보. 그새 네이티브가 울리면 물러난다.
      window.setTimeout(function () {
        if (ringing()) return;
        webFallbackRing(alarm);
      }, 4000);
    }
  }
  function updateSleepNow() {
    if (!els.sleepNow) return;
    var d = new Date();
    // 2026-08-27 운영자 — "현재 시각 표시에서 콜론이 1초마다 깜빡이는 것도
    // 살아있는 느낌일 듯." 콜론만 제 span 에 두고 시·분만 갈아끼운다.
    // textContent 로 통째로 쓰면 매초 span 이 새로 생겨 CSS 호흡 애니메이션이
    // 1초마다 처음으로 되감긴다 — 깜빡이는 게 아니라 덜컥거리게 된다.
    if (!els.sleepNow.firstElementChild) {
      els.sleepNow.textContent = "";
      var _p = ["sn-h", "sn-c", "sn-m"];
      for (var _i = 0; _i < 3; _i += 1) {
        var _sp = document.createElement("span");
        _sp.className = _p[_i];
        if (_p[_i] === "sn-c") _sp.textContent = ":";
        els.sleepNow.appendChild(_sp);
      }
    }
    var _eh = els.sleepNow.querySelector(".sn-h");
    var _em = els.sleepNow.querySelector(".sn-m");
    var _hh = two(d.getHours());
    var _mm = two(d.getMinutes());
    if (_eh && _eh.textContent !== _hh) _eh.textContent = _hh;
    if (_em && _em.textContent !== _mm) _em.textContent = _mm;
    // 2026-08-23 운영자: 취침 시작 직후 15분은 "이제 잠자리에 듭니다.", 그 뒤 "수면 중".
    if (els.sleepLabel) {
      var _sa = 0;
      try { _sa = Number(localStorage.getItem("ezlong:bedtimeStartAt")) || 0; } catch (e) { _sa = 0; }
      // 2026-08-24 운영자: 시작 시각이 없으면(구세션·업그레이드로 비어 있으면) 지금을
      // 시작으로 잡아 15분 '이제 잠자리에 듭니다' 창을 연다 — 곧바로 '수면 중'이 뜨지 않게.
      if (!_sa) {
        _sa = Date.now();
        try { localStorage.setItem("ezlong:bedtimeStartAt", String(_sa)); } catch (e) { /* 무시 */ }
      }
      var _mins = (Date.now() - _sa) / 60000;
      els.sleepLabel.textContent = (_mins < 15)
        ? t("settings.alarm.bedtimeJustStarted", null, "이제 잠자리에 듭니다.")
        : t("settings.alarm.sleepLabel", null, "수면 중");
    }
    // 2026-08-24 운영자: 취침 중 '기상 시각' 표시를 현재 알람으로 항상 맞춘다.
    // 기상 시간을 수정하면 알람은 곧바로 바뀌는데 이 큰 숫자만 옛 값으로 남아
    // "두 번 고쳐야 반영"처럼 보였다. 매초 현재 알람으로 다시 그려 즉시 반영한다.
    if (els.sleepTime) {
      try {
        var _na = nextAlarm();
        if (_na) {
          var _txt = two(_na.hour) + ":" + two(_na.minute);
          if (els.sleepTime.textContent !== _txt) els.sleepTime.textContent = _txt;
        }
      } catch (e) { /* 무시 */ }
    }
    try { checkWebWake(d); } catch (e) { /* 무시 */ }
  }
  function startSleepClock() { stopSleepClock(); try { sleepClockTimer = window.setInterval(updateSleepNow, 1000); } catch (e) { /* 무시 */ } }
  function stopSleepClock() { if (sleepClockTimer) { window.clearInterval(sleepClockTimer); sleepClockTimer = null; } }
  function showSleepScreen(alarm) {
    if (!els.sleep) return;
    var a = alarm || nextAlarm();
    if (els.sleepTime && a) els.sleepTime.textContent = two(a.hour) + ":" + two(a.minute);
    updateSleepNow();
    startSleepClock();
    document.body.classList.add("bedtime-mode");
    els.sleep.hidden = false;
    setAlarmAdHidden(true);
  }
  function hideSleepScreen() {
    stopSleepClock();
    if (els.sleep) els.sleep.hidden = true;
    setAlarmAdHidden(false);
  }

  // 2026-08-23 — 음악 설정은 평소 접어두고(기본곱 하나), 시각 설정이 주인공.
  function updateSoundSummary() {
    if (els.soundSummaryTitle) {
      els.soundSummaryTitle.textContent = (selectedTrack && selectedTrack.title)
        ? selectedTrack.title
        : t("settings.alarm.soundDefault", null, "기본 음악");
    }
  }
  function setSoundDetailOpen(open) {
    if (els.soundDetail) els.soundDetail.hidden = !open;
    if (els.soundToggle) els.soundToggle.textContent = open
      ? t("settings.alarm.soundDone", null, "접기")
      : t("settings.alarm.soundChange", null, "변경");
  }

  function init() {
    els = {
      section:    document.getElementById("wakeAlarmSection"),
      time:       document.getElementById("wakeAlarmTime"),
      weekdays:   document.getElementById("wakeAlarmWeekdays"),
      repeatNote: document.getElementById("wakeAlarmRepeatNote"),
      snooze:     document.getElementById("wakeAlarmSnooze"),
      soundTabs:  document.getElementById("wakeAlarmSoundTabs"),
      soundList:  document.getElementById("wakeAlarmSoundList"),
      confirm:    document.getElementById("wakeAlarmConfirm"),
      list:       document.getElementById("wakeAlarmList"),
      bedtime:    document.getElementById("wakeAlarmBedtime"),
      bar:        document.getElementById("bedtimeBar"),
      barTime:    document.getElementById("bedtimeBarTime"),
      ring:       document.getElementById("wakeRingScreen"),
      ringClock:  document.getElementById("wakeRingClock"),
      ringSong:   document.getElementById("wakeRingSong"),
      ringStop:   document.getElementById("wakeRingStop"),
      ringSnooze: document.getElementById("wakeRingSnooze"),
      barExit:    document.getElementById("bedtimeExit"),
      openConfig: document.getElementById("wakeAlarmOpenConfig"),
      configScreen: document.getElementById("alarmConfigScreen"),
      configBack: document.getElementById("alarmConfigBack"),
      homeSummary: document.getElementById("alarmHomeSummary"),
      homeSummaryTime: document.getElementById("alarmHomeSummaryTime"),
      homeSummaryMeta: document.getElementById("alarmHomeSummaryMeta"),
      sleep:      document.getElementById("sleepScreen"),
      sleepLabel: document.getElementById("sleepScreenLabel"),
      sleepTime:  document.getElementById("sleepScreenTime"),
      sleepNow:   document.getElementById("sleepScreenNow"),
      sleepEdit:  document.getElementById("sleepEditTime"),
      sleepCancel: document.getElementById("sleepCancel"),
      ringLog:    document.getElementById("wakeRingLog"),
      sleepLog:   document.getElementById("wakeSleepLog"),
      sleepMusicChange: document.getElementById("sleepMusicChange"),
      ringMusicChange:  document.getElementById("ringMusicChange"),
      wakeInfo:         document.getElementById("wakeInfo"),
      wakeSleepDuration:document.getElementById("wakeSleepDuration"),
      wakeWeather:      document.getElementById("wakeWeather"),
      wakeWeatherDetail:document.getElementById("wakeWeatherDetail"),
      wakeDismissed:    document.getElementById("wakeDismissed"),
      wakeRingClose:    document.getElementById("wakeRingClose"),
      configBedtime: document.getElementById("wakeConfigBedtime"),
      soundSummary: document.getElementById("alarmSoundSummary"),
      soundSummaryTitle: document.getElementById("alarmSoundSummaryTitle"),
      soundToggle: document.getElementById("alarmSoundToggle"),
      soundDetail: document.getElementById("alarmSoundDetail")
    };
    if (!els.section) return;

    var savedFile = loadSavedSoundFile();
    if (savedFile) {
      var track = findTrackByFile(savedFile);
      if (track) { selectedTrack = track; soundTab = tabOf(track) || soundTab; }
    }
    // 아무 것도 고르지 않았으면 어쿠스틱의 첫 곡을 미리 골라 둔다 — 알람음이
    // 비어 있는 상태로 알람이 걸리는 일이 없게.
    if (!selectedTrack) {
      // 2026-08-23 운영자: 기본곡 = A Soft Place to Fall (Acoustic)
      selectedTrack = findTrackByFile("My Workspace/A Soft Place to Fall (Acoustic).m4a")
        || (alarmTracks().acoustic || [])[0] || null;
    }

    if (els.confirm) els.confirm.addEventListener("click", onConfirm);
    // 2026-08-24 운영자: 기상 시간을 "한 번에" 반영. iOS의 시각 입력(<input type=time>)은
    // 값이 한 박자 늦게 확정돼서, change 시점에 곧바로 읽으면 직전(옛) 값이 잡힌다.
    // 그래서 "같은 시각으로 한 번 더 고쳐야" 반영되던 문제가 있었다.
    // 대응 — 값이 실시간으로 반영되는 input 이벤트까지 듣고, 살짝(90ms) 뒤
    // 확정된 값으로 자동 저장한다. 편집 중(기존 알람)일 때만, '수정 확인' 없이 즉시.
    // 새 알람(editingId 없음)은 종전대로 '알람 걸기' 버튼으로 확정한다.
    if (els.time) {
      var alarmTimeCommitTimer = null;
      var commitEditedTimeSoon = function () {
        if (!editingId) return;              // 편집 중일 때만
        var keepId = editingId;
        if (alarmTimeCommitTimer) { try { window.clearTimeout(alarmTimeCommitTimer); } catch (e) { /* 무시 */ } }
        alarmTimeCommitTimer = window.setTimeout(function () {
          alarmTimeCommitTimer = null;
          try {
            // 편집 대상 알람이 아직 살아 있을 때만(도중에 지워졌을 수 있다).
            if (!loadAlarms().some(function (a) { return a.id === keepId; })) return;
            editingId = keepId;              // 값이 확정된 지금, 그 알람을 편집 상태로 잡고
            onConfirm();                     // 확정된 els.time.value 로 저장·재예약
            // 저장되면 onConfirm 이 editingId 를 비운다. 계속 조정할 수 있게 다시 잡아 준다.
            if (!editingId && loadAlarms().some(function (a) { return a.id === keepId; })) {
              editingId = keepId;
              updateConfirmLabel();
            }
          } catch (e) { /* 무시 */ }
        }, 90);
      };
      els.time.addEventListener("change", commitEditedTimeSoon);
      els.time.addEventListener("input", commitEditedTimeSoon);
    }
    if (els.bedtime) {
      els.bedtime.addEventListener("click", function () {
        if (bedtimeArmed()) exitBedtime();
        else enterBedtime();
      });
    }
    if (els.barExit) els.barExit.addEventListener("click", exitBedtime);
    if (els.configBedtime) els.configBedtime.addEventListener("click", function () { enterBedtime(); });
    if (els.soundToggle) els.soundToggle.addEventListener("click", function () {
      setSoundDetailOpen(!!(els.soundDetail && els.soundDetail.hidden));
    });
    updateSoundSummary();
    if (els.openConfig) els.openConfig.addEventListener("click", function () { openConfigScreen(false); });
    if (els.configBack) els.configBack.addEventListener("click", closeConfigScreen);
    if (els.sleepCancel) els.sleepCancel.addEventListener("click", exitBedtime);
    if (els.sleepEdit) els.sleepEdit.addEventListener("click", function () {
      if (els.sleep) els.sleep.hidden = true;
      try { if (typeof openSettings === "function") openSettings("alarm"); } catch (error) { /* 무시 */ }
      // 2026-08-23 운영자: '기상시간 수정하기'는 지금 걸린 알람을 '수정'해야 한다.
      // 예전엔 openConfigScreen(true)만 불러 editingId가 없던 탓에, 시간을 바꾸면
      // 기존 알람은 그대로 두고 새 알람이 하나 더 생겨 "반영 안 됨"으로 보였다.
      // 이제 현재 울릴 알람을 beginEdit로 폼에 싣고(editingId 설정) 돌림판을 연다.
      openConfigScreen(false);
      if (els.configScreen && els.configScreen.hidden) return; // 프리미엄 게이트 등으로 못 열면 중단
      var editAlarm = nextAlarm();
      if (editAlarm) beginEdit(editAlarm);
      else openConfigScreen(true);
    });

    // 운영 지침 — 스탠바이의 플립시계를 한 번 터치하면 기상 알람으로.
    var clock = document.querySelector(".flip-clock");
    if (clock) {
      clock.addEventListener("click", function () {
        // 2026-08-20 수정 — 예전엔 supported가 true여야만 열었다. 그런데
        // 지원 판정이 늦거나 실패하면 시계를 눌러도 아무 일이 없어서,
        // 사용자는 "고장났다"고 느낀다. 앱 안이기만 하면 일단 연다 —
        // 못 쓰는 상황이면 섹션 안에 이유가 적혀 있다.
        // 지원되는 기기에서만 연다. 안드로이드에서는 이 섹션 자체가
        // 없으므로 시계를 눌러도 아무 일이 없는 게 맞다.
        if (!supported) return;
        if (bedtimeArmed()) return;   // 취침 중에는 화면을 건드리지 않는다
        openAlarmSettings();
      });
      clock.style.cursor = "pointer";
    }

    ensureWakeIcon();
    updateWakeIcon();
    [0, 100, 250, 600, 1500, 3000].forEach(function (d) { try { window.setTimeout(updateWakeIcon, d); } catch (e) { /* 무시 */ } });
    try { window.setInterval(updateWakeIcon, 5000); } catch (e) { /* 무시 */ }

    bindAll();
    askCapability();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
