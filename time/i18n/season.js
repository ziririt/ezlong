/**
 * season.js — 반구를 고려한 계절 판정
 * 2026-07-28 신설 (글로벌화 W3)
 *
 * ★ 클래식 스크립트. 전역 window.FlipZenSeason ★
 *
 * ─────────────────────────────────────────────────────────────
 * 왜 필요한가 — 성동님이 발견한 문제
 * ─────────────────────────────────────────────────────────────
 * 현행 app.js getCurrentSeason() 은 **월만 본다**:
 *
 *     if (month >= 6 && month <= 8) return "summer";
 *
 * 그런데 7월은 호주·뉴질랜드·남아공·아르헨티나·칠레가 **한겨울**이다.
 * 시드니 사용자가 앱을 열면 한겨울에 여름 배경사진이 뜬다.
 * 호주·뉴질랜드는 영어권이라 1차 출시 타깃에 바로 들어간다 —
 * 즉 출시 첫날부터 눈에 띄는 버그다.
 *
 * 위도 부호로 6개월을 밀면 해결된다. GPS 좌표는 이미 받고 있다.
 *
 * ─────────────────────────────────────────────────────────────
 * 안전 원칙 — 위도를 모르면 북반구
 * ─────────────────────────────────────────────────────────────
 * 위치 권한 거부·측위 실패 등으로 위도를 모르는 경우가 실제로 흔하다.
 * 그때는 **북반구로 간주**한다 — 한국 사용자가 압도적 다수이고,
 * 무엇보다 현행 동작과 100% 같아지기 때문이다(회귀 0).
 *
 * i18n/index.js 의 DEFAULT_LOCALE = "ko" 와 같은 정신이다:
 * 판정에 실패하면 지금까지의 동작으로 떨어진다.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.FlipZenSeason = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /**
   * 북반구 기준 계절 — 현행 app.js getCurrentSeason() 과 **글자 그대로 동일**.
   *
   * ★ 이 함수는 절대 바꾸지 말 것 ★
   * scripts/test-season.mjs 가 app.js 원본을 잘라내 실행해 12개월 전부를
   * 대조한다. 여기서 한 달이라도 어긋나면 한국 사용자의 배경사진이 바뀐다.
   */
  function northernSeason(month) {
    if (month >= 3 && month <= 5) return "spring";
    if (month >= 6 && month <= 8) return "summer";
    if (month >= 9 && month <= 11) return "autumn";
    return "winter";
  }

  /** 남반구는 북반구를 정확히 6개월 민 것이다 */
  var SOUTHERN_SHIFT = {
    spring: "autumn",
    summer: "winter",
    autumn: "spring",
    winter: "summer",
  };

  /**
   * 위도가 남반구인가?
   *
   * 적도 부근(|lat| < 10도)은 건기·우기만 있고 사계절이 없다. 하지만 이 앱의
   * 배경사진은 사계절 태그로만 분류돼 있으므로 억지로라도 하나를 골라야 한다 —
   * 부호 그대로 따른다(싱가포르는 북위 1.35도라 북반구로 간주된다).
   * 열대 지역 전용 처리는 사진 데이터가 그만큼 쌓인 뒤에 검토할 일이다.
   */
  function isSouthernHemisphere(latitude) {
    return typeof latitude === "number" && isFinite(latitude) && latitude < 0;
  }

  /**
   * 이 좌표·이 시점의 계절.
   *
   * @param {Date}   date      기준 시각 (기본: 지금)
   * @param {number} latitude  위도. 모르면 undefined/null → 북반구로 간주
   * @returns {"spring"|"summer"|"autumn"|"winter"}
   */
  function resolveSeason(date, latitude) {
    var d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
    var base = northernSeason(d.getMonth() + 1);
    return isSouthernHemisphere(latitude) ? SOUTHERN_SHIFT[base] : base;
  }

  /**
   * 달력의 주 시작 요일 (0=일요일, 1=월요일).
   *
   * 한국·미국·일본·캐나다는 일요일 시작, 유럽 대부분과 호주는 월요일 시작이다.
   * 현행 app.js 는 일요일로 고정돼 있으므로, **한국어는 반드시 0을 유지**한다.
   *
   * Intl.Locale 의 weekInfo 를 쓸 수 있으면 그걸 신뢰하고(브라우저가 CLDR
   * 데이터를 갖고 있다), 없으면 보수적으로 일요일로 떨어진다.
   */
  function firstDayOfWeek(locale, region) {
    if (locale === "ko") return 0;   // 현행 동작 고정

    try {
      if (typeof Intl !== "undefined" && Intl.Locale) {
        var tag = region ? locale + "-" + region : locale;
        var info = new Intl.Locale(tag).weekInfo;
        // weekInfo.firstDay 는 1=월 … 7=일 (ISO). JS getDay() 는 0=일.
        if (info && typeof info.firstDay === "number") {
          return info.firstDay === 7 ? 0 : info.firstDay;
        }
      }
    } catch (e) { /* 미지원 브라우저 — 아래 폴백 */ }

    // 폴백: 일요일 시작 국가 목록(미국·캐나다·일본 등) 외에는 월요일
    var SUNDAY_FIRST = ["US", "CA", "JP", "KR", "TW", "HK", "IL", "PH", "BR", "MX", "ZA"];
    if (region && SUNDAY_FIRST.indexOf(region) >= 0) return 0;
    return region ? 1 : 0;   // 지역을 모르면 현행 동작(일요일)
  }

  /**
   * 온도 단위. 미국·라이베리아·미얀마만 화씨를 쓴다.
   * 한국어는 언제나 섭씨 — 현행 동작 고정.
   */
  function temperatureUnit(locale, region) {
    if (locale === "ko") return "C";
    return ["US", "LR", "MM"].indexOf(String(region || "").toUpperCase()) >= 0 ? "F" : "C";
  }

  function celsiusTo(unit, celsius) {
    if (typeof celsius !== "number" || !isFinite(celsius)) return celsius;
    return unit === "F" ? celsius * 9 / 5 + 32 : celsius;
  }

  return {
    resolveSeason: resolveSeason,
    northernSeason: northernSeason,
    isSouthernHemisphere: isSouthernHemisphere,
    firstDayOfWeek: firstDayOfWeek,
    temperatureUnit: temperatureUnit,
    celsiusTo: celsiusTo,
  };
});
