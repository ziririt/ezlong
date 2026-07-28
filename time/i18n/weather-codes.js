/**
 * weather-codes.js — 날씨 상태를 "언어와 무관한 코드"로 다루기 위한 계층
 * 2026-07-28 신설 (글로벌화 준비, 성동님 위임 야간 작업)
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 로딩 방식 주의 ★
 * index.html은 app.js를 `<script src>` 로 불러온다 (type="module" 아님).
 * 그래서 이 파일도 ES 모듈이 아니라 **클래식 스크립트**여야 하고,
 * 전역 네임스페이스에 붙는다 — investment-quotes.js 가 window.investmentQuotes
 * 를 만드는 것과 같은 방식이다.
 *
 * 동시에 node에서 테스트할 수 있어야 하므로 양쪽을 다 지원한다:
 *   브라우저 → window.FlipZenWeatherCodes
 *   node     → require() 또는 동적 import
 *
 * (package.json 의 "type": "module" 때문에 node에서 require 하려면
 *  확장자가 .cjs 여야 한다. 그래서 테스트는 이 파일을 문자열로 읽어
 *  vm 으로 평가하는 방식을 쓴다 — scripts/golden/test-weather-codes.mjs 참조.)
 *
 * ─────────────────────────────────────────────────────────────
 * 왜 이 파일이 먼저 필요한가 — 반드시 읽을 것
 * ─────────────────────────────────────────────────────────────
 * CLAUDE.md 36항 "우산 중심주의 헌법"의 방어막 절반이 지금
 * **한국어 문자열 비교** 위에 서 있다. 실제 코드 예:
 *
 *     app.js:932   if (/비|눈|천둥번개/.test(c.conditionsKo)) return "흐림";
 *     app.js:2938  const sanitizedKo = conditionsKo === "비" ? "흐림" : conditionsKo;
 *     app.js:3512  if (d.conditionsKo === "비") ...
 *     app.js:2900+ conditionsKo === "맑음" / "안개" / "눈" ... → 이모지 결정
 *     app.js:2915  /^(\d+)시/.exec(hourLabel)  ← "14시"를 정규식으로 파싱해 밤/낮 판정
 *
 * 이 상태에서 로케일을 하나라도 추가하면 conditionsKo 가 "Rain"이 되는 순간
 * 위 방어가 **전부 조용히 무력화**된다. 그 결과는 36항이 명시적으로 금지한
 * "강수량 0인데 🌧️ 도배" 2차 사고의 그대로 재발이다(2026-07-27 13:2x 실제 발생).
 *
 * 그래서 순서가 중요하다:
 *   (1) 먼저 이 코드 계층을 도입해 판정을 문자열에서 떼어낸다  ← 이 파일
 *   (2) 그 다음에 UI 문자열을 로케일 파일로 뺀다
 *   (3) 마지막에 백엔드가 코드를 내려주도록 바꾼다
 * 순서를 바꾸면 헌법이 깨진다.
 *
 * ─────────────────────────────────────────────────────────────
 * 이행 전략 (백엔드를 아직 못 고쳐도 오늘 쓸 수 있게)
 * ─────────────────────────────────────────────────────────────
 * 백엔드(weather-backend)는 당장 바꿀 수 없다 — 배포된 구버전 앱들이
 * 지금 스키마로 계속 호출하고 있기 때문이다. 그래서 이 파일은
 * **한국어 문자열을 코드로 되돌리는 역매핑**을 제공한다.
 *
 *     conditionsKo("비") → CONDITION.RAIN
 *
 * 프론트는 오늘부터 CONDITION.RAIN 으로 비교하도록 고치고,
 * 나중에 백엔드가 conditionCode 를 직접 내려주면 역매핑만 건너뛰면 된다.
 * 즉 프론트 코드는 두 번 고칠 필요가 없다.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;              // node (require / .cjs)
  } else {
    root.FlipZenWeatherCodes = api;    // 브라우저 전역
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /** 날씨 상태 코드. 백엔드 logic.ts:544-564 의 CONDITION_KO_RULES 와 1:1 대응. */
  var CONDITION = Object.freeze({
    CLEAR: "CLEAR",                 // 맑음
    PARTLY_CLOUDY: "PARTLY_CLOUDY", // 구름 조금
    MOSTLY_CLOUDY: "MOSTLY_CLOUDY", // 구름 많음
    CLOUDY: "CLOUDY",               // 흐림
    FOG: "FOG",                     // 안개
    RAIN: "RAIN",                   // 비
    SNOW: "SNOW",                   // 눈
    THUNDER: "THUNDER",             // 천둥번개
    UNKNOWN: "UNKNOWN",
  });

  /**
   * 한국어 상태어 → 코드 역매핑. **정확히 일치할 때만** 매핑한다.
   *
   * ─── 왜 정규식이 아니라 완전일치인가 (2026-07-28 수정) ───
   * 초안은 /비|소나기|이슬비/ 같은 정규식이었다. "더 관대해서 좋다"고
   * 생각했지만 두 가지 이유로 틀렸다.
   *
   * 1) **그런 값은 애초에 올 수 없다.** 백엔드 mapConditionsToKo()
   *    (logic.ts:559)는 CONDITION_KO_RULES 8개 중 하나로 반드시 접어서
   *    내려준다 — "소나기"·"이슬비"·"박무" 같은 변형은 생성되지 않는다.
   *    올 수 없는 입력에 대비한 관대함은 이득이 0이다.
   *
   * 2) **app.js 와 동작이 갈린다.** app.js 의 이모지 맵은 완전일치
   *    조회(map[ko] || "🌤️")다. 정규식으로 관대하게 받으면 app.js 가
   *    "알 수 없음(🌤️)"으로 처리하는 값을 이쪽만 구체적 아이콘으로 그린다.
   *    이번 이행의 대원칙은 "한국어 사용자 화면이 1픽셀도 안 바뀐다"이므로,
   *    더 나아 보이는 동작이라도 다르면 안 된다.
   *
   * 매칭되지 않는 값(예: 백엔드가 번역 못 해 그대로 흘려보낸 영문
   * "Hail")은 UNKNOWN → 🌤️ 로, app.js 와 정확히 같게 처리된다.
   *
   * scripts/test-emoji-parity.mjs 가 app.js 원본과 전 조합을 대조한다.
   */
  var KO_TO_CODE = {
    "천둥번개": CONDITION.THUNDER,
    "눈": CONDITION.SNOW,
    "비": CONDITION.RAIN,
    "안개": CONDITION.FOG,
    "흐림": CONDITION.CLOUDY,
    "구름 조금": CONDITION.PARTLY_CLOUDY,
    "구름 많음": CONDITION.MOSTLY_CLOUDY,
    "맑음": CONDITION.CLEAR,
  };

  /**
   * 백엔드 응답에서 상태 코드를 얻는다.
   * 백엔드가 conditionCode 를 내려주면 그걸 쓰고, 아직 안 주면 한국어를 역매핑한다.
   *
   * @param {{conditionCode?: string, conditionsKo?: string}} src
   * @returns {string} CONDITION.* 중 하나
   */
  function conditionCodeOf(src) {
    if (!src) return CONDITION.UNKNOWN;

    // 1순위: 백엔드가 코드를 직접 준 경우 (미래)
    if (src.conditionCode && CONDITION[src.conditionCode]) return src.conditionCode;

    // 2순위: 한국어 문자열 역매핑 (현재) — 완전일치만
    var ko = src.conditionsKo;
    if (typeof ko !== "string") return CONDITION.UNKNOWN;
    return Object.prototype.hasOwnProperty.call(KO_TO_CODE, ko)
      ? KO_TO_CODE[ko]
      : CONDITION.UNKNOWN;
  }

  /**
   * "비 계열"인가? — 36항 뒷문 봉쇄 규칙의 강등 대상 판정.
   *
   * ★ 천둥번개(THUNDER)와 눈(SNOW)은 포함하지 않는다 ★
   * 36항 원문: "천둥번개(⛈️)·눈(❄️)은 우산과 별개의 고유 신호라 강등하지 않는다."
   */
  function isRainLikeCondition(code) {
    return code === CONDITION.RAIN;
  }

  /**
   * 강등이 필요한지 판정한다.
   *
   * 36항 뒷문 봉쇄 규칙:
   *   "VC는 강수량 0인 시간에도 conditions 라벨을 Rain 으로 준다.
   *    비 계열 아이콘·문구는 오직 deriveRainDisplay ①/②의 결과로만 나올 수 있다."
   *
   * @param {string} code            conditionCodeOf() 결과
   * @param {boolean} rainDisplayOn  deriveRainDisplay 가 ① 또는 ②를 반환했는가
   * @returns {string} 화면에 쓸 최종 코드 (강등되면 CLOUDY)
   */
  function applyRainDowngrade(code, rainDisplayOn) {
    if (isRainLikeCondition(code) && !rainDisplayOn) return CONDITION.CLOUDY;
    return code;
  }

  /**
   * 상태 코드 → 이모지. 언어 무관이라 로케일 파일이 아니라 여기 둔다.
   * app.js 의 weatherEmojiFromKoCondition(2872) +
   * weatherEmojiFromHourCondition(2900) 을 코드 기반으로 옮긴 것이다.
   *
   * ★ 이 표는 app.js 와 **글자 단위로 같아야 한다** ★
   * scripts/test-weather-codes.mjs 가 app.js 원본 함수를 실제로 추출해
   * 전 조합을 대조한다. 값을 '보기 좋게' 바꾸면 그 대조가 실패한다.
   *
   * ── 실제로 겪은 함정 (2026-07-28) ──
   * 이 함수 초안은 MOSTLY_CLOUDY 를 ☁️ 로, 알 수 없음을 ☀️/🌙 로 뒀는데
   * app.js 는 각각 🌥️ 와 🌤️/☁️ 였다. 그런데 초안 테스트가 통과했다 —
   * 테스트를 같은 사람이 같은 착각으로 썼기 때문이다.
   * 그래서 지금은 기대값을 손으로 적지 않고 **app.js 에서 뽑아 쓴다.**
   */
  function conditionEmoji(code, isNight) {
    if (isNight) {
      // 밤: 맑음/안개/천둥/눈/비만 구분하고 나머지 구름 계열은 하나로 뭉친다.
      // (app.js weatherEmojiFromHourCondition 의 분기와 동일 — 기본값도 ☁️ 다)
      switch (code) {
        case CONDITION.CLEAR:   return "🌙";
        case CONDITION.FOG:     return "🌫️";
        case CONDITION.THUNDER: return "⛈️";
        case CONDITION.SNOW:    return "❄️";
        case CONDITION.RAIN:    return "🌧️";
        default:                return "☁️";
      }
    }
    switch (code) {
      case CONDITION.THUNDER:       return "⛈️";
      case CONDITION.SNOW:          return "❄️";
      case CONDITION.RAIN:          return "🌧️";
      case CONDITION.FOG:           return "🌫️";
      case CONDITION.CLOUDY:        return "☁️";
      case CONDITION.PARTLY_CLOUDY: return "⛅";
      case CONDITION.MOSTLY_CLOUDY: return "🌥️";
      case CONDITION.CLEAR:         return "☀️";
      default:                      return "🌤️";   // app.js map[ko] || "🌤️"
    }
  }

  /**
   * 시간대 항목에서 "몇 시인가"를 안전하게 얻는다.
   *
   * 지금 app.js:2915 는 백엔드가 준 "14시" 문자열을 /^(\d+)시/ 로 파싱한다.
   * 로케일이 바뀌면 이 정규식이 조용히 실패해 밤/낮 아이콘이 전부 틀어진다.
   * 백엔드가 hour 필드를 주기 전까지의 과도기 안전망.
   */
  function hourOf(item) {
    if (!item) return null;

    if (typeof item.hour === "number" && item.hour >= 0 && item.hour <= 23 && item.hour % 1 === 0) {
      return item.hour;                                   // 1순위: 숫자 필드 (미래)
    }
    if (typeof item.datetimeEpoch === "number" && isFinite(item.datetimeEpoch)) {
      // KST 고정. 타임존 일반화는 별도 트랙(dateUtil.ts 참조).
      var d = new Date(item.datetimeEpoch * 1000 + 9 * 3600 * 1000);
      return d.getUTCHours();                             // 2순위: epoch (미래)
    }
    var m = /^(\d{1,2})/.exec(String(item.hourLabel || "").trim());
    if (m) {                                              // 3순위: "14시" 파싱 (현재)
      var h = Number(m[1]);
      if (h >= 0 && h <= 23) return h;
    }
    if (item.isNow) return new Date().getHours();         // 4순위: "지금"
    return null;
  }

  /**
   * 밤인가? (일출/일몰을 모를 때의 단순 근사)
   *
   * ★ 경계값은 app.js:2918 과 동일해야 한다 — `hour >= 20 || hour < 6` ★
   * 초안에서 19시로 잘못 적었다가 app.js 원본 대조에서 잡혔다(2026-07-28).
   * 19시로 두면 저녁 7시대 아이콘이 전부 밤 아이콘으로 바뀐다.
   */
  function isNightHour(hour) {
    if (hour === null || hour === undefined) return false;
    return hour >= 20 || hour < 6;
  }

  return {
    CONDITION: CONDITION,
    conditionCodeOf: conditionCodeOf,
    isRainLikeCondition: isRainLikeCondition,
    applyRainDowngrade: applyRainDowngrade,
    conditionEmoji: conditionEmoji,
    hourOf: hourOf,
    isNightHour: isNightHour,
  };
});
