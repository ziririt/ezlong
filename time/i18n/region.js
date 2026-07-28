/**
 * region.js — 지역 기반 기능 게이팅 + 로케일 의존 포맷
 * 2026-07-28 신설 (글로벌화 W3)
 *
 * ★ 클래식 스크립트. 전역 window.FlipZenRegion ★
 *
 * ─────────────────────────────────────────────────────────────
 * 이 파일이 다루는 것
 * ─────────────────────────────────────────────────────────────
 * 1. 한국 전용 3기능(미세먼지·기상특보·평년비교)을 언제 보여줄 것인가
 * 2. 역지오코딩 언어 (지금 accept-language=ko 로 하드코딩돼 있다)
 * 3. 날짜·요일 포맷 (지금 Intl.DateTimeFormat("ko-KR") 로 하드코딩돼 있다)
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 게이팅은 언어가 아니라 좌표로 한다 ★
 * ─────────────────────────────────────────────────────────────
 * 언어로 판정하면 두 경우가 모두 틀린다:
 *   · 한국에 사는 영어 사용자 → 미세먼지를 볼 수 있어야 하는데 못 본다
 *   · 해외에 있는 한국어 사용자 → 없는 데이터를 부른다(엉뚱한 서울 값)
 *
 * weather-backend/src/i18n.ts 의 isKoreaCoordinate() 와 **같은 경계**를
 * 쓴다 — 프론트와 백엔드가 다른 판정을 하면 "카드는 떴는데 내용이 없음"
 * 같은 상태가 된다. 한쪽을 고치면 반드시 다른 쪽도 고칠 것.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.FlipZenRegion = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /**
   * 대한민국 본토 + 제주 + 울릉/독도를 여유 있게 감싸는 사각형.
   * ★ weather-backend/src/i18n.ts 의 isKoreaCoordinate 와 값이 같아야 한다 ★
   * (scripts/test-region.mjs 가 두 파일의 숫자를 실제로 대조한다)
   */
  var KOREA_BOUNDS = { latMin: 33.0, latMax: 38.7, lngMin: 124.5, lngMax: 132.0 };

  function isKoreaCoordinate(lat, lng) {
    if (typeof lat !== "number" || typeof lng !== "number") return false;
    if (!isFinite(lat) || !isFinite(lng)) return false;
    return lat >= KOREA_BOUNDS.latMin && lat <= KOREA_BOUNDS.latMax
        && lng >= KOREA_BOUNDS.lngMin && lng <= KOREA_BOUNDS.lngMax;
  }

  /**
   * 한국 전용 기능을 보여줄 것인가.
   *
   * ★ 좌표를 아직 모를 때는 true ★
   * 측위 전이나 권한 거부 상태에서 false 를 반환하면, 한국 사용자가 앱을 열
   * 때마다 카드가 잠깐 사라졌다 나타나는 깜빡임이 생긴다. 그리고 무엇보다
   * 현행 동작(항상 표시)과 달라진다. 좌표를 확실히 알고 그게 한국 밖일 때만
   * 숨긴다 — "확신이 없으면 지금까지 하던 대로"가 이 이행 전체의 원칙이다.
   */
  function showKoreaOnlyFeatures(lat, lng) {
    if (typeof lat !== "number" || typeof lng !== "number") return true;
    if (!isFinite(lat) || !isFinite(lng)) return true;
    return isKoreaCoordinate(lat, lng);
  }

  /**
   * 역지오코딩(Nominatim) 언어 — 화면 상단에 뜨는 지명("서울"/"Tokyo"/"東京")을
   * 어느 언어로 받을지 정한다.
   *
   * 현행 app.js:1749 는 accept-language=ko 로 고정돼 있었다.
   * ko 일 때 정확히 같은 값을 돌려주므로 한국어 사용자에게는 변화가 없다.
   *
   * 2026-07-29 확장: SUPPORTED 가 6개로 늘면서 여기도 함께 늘렸다.
   * ★ 이 함수를 빠뜨리면 일본어 화면에 "도쿄"가 한국어로 뜬다 ★ —
   * 카탈로그(locales/*.json)에는 지명이 없어서 test-i18n 이 못 잡는
   * 사각지대라, i18n/index.js 의 SUPPORTED 주석에 체크리스트로 박아뒀다.
   *
   * Nominatim 은 BCP-47 을 그대로 받으므로 코드를 그대로 넘기면 된다.
   * 목록에 없는 값이 들어오면 ko 로 떨어진다(현행 동작 보존).
   */
  var GEOCODE_LANGS = ["ko", "en", "ja", "zh", "es", "pt"];
  function geocodeLanguage(locale) {
    return GEOCODE_LANGS.indexOf(locale) >= 0 ? locale : "ko";
  }

  /**
   * 좌표에서 대략적인 국가 코드를 얻는다 — 온도 단위·주 시작요일 결정용.
   *
   * 정밀한 역지오코딩은 네트워크가 필요하고 실패할 수 있으므로, 단위 결정처럼
   * "틀려도 치명적이지 않은" 용도에는 좌표 사각형으로 근사한다.
   * 여기 없는 지역은 null 을 반환하고, 호출부는 안전한 기본값(섭씨·일요일)을 쓴다.
   *
   * ★ 화씨를 쓰는 나라는 사실상 미국뿐이라 미국만 정확히 잡으면 충분하다 ★
   */
  var REGION_BOXES = [
    // 미국 본토 (알래스카·하와이 별도)
    // 서부: 국경이 북위 49도 직선이라 사각형으로 정확히 잘린다
    { code: "US", latMin: 24.5, latMax: 49.0, lngMin: -125.0, lngMax: -95.2 },
    // 동부: 온타리오 남부가 미시간과 뉴욕 사이로 내려와 있어 사각형으로는
    // 캐나다와 분리할 수 없다. 이 구간의 정확도는 deviceRegion() 이 책임진다.
    { code: "US", latMin: 24.5, latMax: 49.4, lngMin: -95.2, lngMax: -66.9 },
    { code: "US", latMin: 51.2, latMax: 71.4, lngMin: -168.0, lngMax: -129.0 },  // 알래스카
    { code: "US", latMin: 18.9, latMax: 22.3, lngMin: -160.3, lngMax: -154.8 },  // 하와이
    { code: "KR", latMin: 33.0, latMax: 38.7, lngMin: 124.5, lngMax: 132.0 },
    { code: "JP", latMin: 24.0, latMax: 45.6, lngMin: 122.9, lngMax: 146.0 },
    { code: "GB", latMin: 49.9, latMax: 60.9, lngMin: -8.7, lngMax: 1.8 },
    { code: "AU", latMin: -43.7, latMax: -10.0, lngMin: 112.9, lngMax: 153.7 },
    { code: "NZ", latMin: -47.3, latMax: -34.0, lngMin: 166.3, lngMax: 178.6 },
    { code: "CA", latMin: 41.7, latMax: 83.1, lngMin: -141.0, lngMax: -52.6 },
  ];

  /**
   * 기기가 스스로 밝힌 지역 코드. 예: "en-CA" → "CA"
   * 2026-07-28 신설 (글로벌화 W6)
   *
   * ─────────────────────────────────────────────────────────────
   * 왜 좌표보다 이걸 먼저 보는가
   * ─────────────────────────────────────────────────────────────
   * 온도 단위를 좌표로만 정하려다 실제로 부딪힌 문제: **토론토가 미국
   * 사각형 안에 들어간다.** 온타리오 남부는 미시간과 뉴욕 사이로 내려와
   * 있어서, 사각형으로는 두 나라를 가를 방법이 없다(캐나다 최남단 41.7°N은
   * 미네소타 최북단 49.4°N보다 한참 아래다). 캐나다는 영어권 1차 출시
   * 대상이면서 섭씨를 쓰는 나라라, 여기서 틀리면 그대로 오답이 나간다.
   *
   * 기기 로케일("en-CA")은 사용자가 직접 설정한 값이라 추측이 아니다.
   * 좌표는 그 값이 없을 때의 폴백으로만 쓴다.
   *
   * ★ 지역만 본다. 언어는 보지 않는다 ★
   * 언어 판정은 i18n/index.js 의 몫이고, 여기는 "어느 나라 관습을 따를까"만
   * 답한다 — 미국에 사는 한국어 사용자의 "ko-US" 도 지역은 US 로 읽힌다
   * (다만 temperatureUnit 이 ko 를 무조건 섭씨로 처리하므로 결과는 섭씨다).
   *
   * @param {{language?: string, languages?: string[]}} [nav] 테스트용 주입
   * @returns {string|null} 대문자 2글자 지역 코드, 모르면 null
   */
  function deviceRegion(nav) {
    var n = nav || (typeof navigator !== "undefined" ? navigator : null);
    if (!n) return null;

    var tags = [];
    if (typeof n.language === "string") tags.push(n.language);
    if (n.languages && typeof n.languages.length === "number") {
      for (var i = 0; i < n.languages.length; i++) tags.push(n.languages[i]);
    }
    for (var j = 0; j < tags.length; j++) {
      // "en-CA" / "en_CA" / "zh-Hant-TW" 전부에서 마지막 2글자 지역만 뽑는다
      var m = /^[A-Za-z]{2,3}(?:[-_][A-Za-z]{4})?[-_]([A-Za-z]{2})\b/.exec(String(tags[j] || ""));
      if (m) return m[1].toUpperCase();
    }
    return null;
  }

  function regionFromCoordinate(lat, lng) {
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    if (!isFinite(lat) || !isFinite(lng)) return null;
    for (var i = 0; i < REGION_BOXES.length; i++) {
      var b = REGION_BOXES[i];
      if (lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax) return b.code;
    }
    return null;
  }

  /* ────────────────────────────────────────────────────────
   * 날짜 포맷
   * ──────────────────────────────────────────────────────── */

  /** Intl 로케일 태그. ko 는 반드시 "ko-KR" — 현행 동작 고정. */
  function intlLocale(locale, region) {
    if (locale === "ko") return "ko-KR";
    return region ? locale + "-" + region : locale;
  }

  /**
   * 메인 화면 상단 날짜 라벨.
   * 현행 app.js:1383-1390 은 `${월일} (${요일})` 형태로,
   * Intl "ko-KR" 의 "7월 6일" + short weekday 에서 "요일"을 떼어낸 "월" 을 쓴다.
   *
   * ko 는 그 결과와 **글자 그대로 같아야** 한다(scripts/test-region.mjs 가 대조).
   * en 은 "Jul 6 (Mon)" 처럼 그 언어의 자연스러운 형태를 쓴다.
   */
  function formatDateLabel(date, locale, region) {
    var d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
    var tag = intlLocale(locale, region);

    try {
      var monthDay = new Intl.DateTimeFormat(tag, { month: "long", day: "numeric" }).format(d);
      var weekday = new Intl.DateTimeFormat(tag, { weekday: "short" }).format(d);
      // 한국어 short weekday 는 "월요일" 이 아니라 "월" 이지만, 일부 런타임은
      // "월요일" 을 준다 — 현행 코드가 하던 replace 를 그대로 유지한다.
      if (locale === "ko") weekday = weekday.replace("요일", "");
      return monthDay + " (" + weekday + ")";
    } catch (e) {
      // Intl 실패는 사실상 없지만, 여기서 터지면 상단 날짜가 통째로 사라진다.
      return "";
    }
  }

  return {
    KOREA_BOUNDS: KOREA_BOUNDS,
    isKoreaCoordinate: isKoreaCoordinate,
    deviceRegion: deviceRegion,
    showKoreaOnlyFeatures: showKoreaOnlyFeatures,
    geocodeLanguage: geocodeLanguage,
    regionFromCoordinate: regionFromCoordinate,
    intlLocale: intlLocale,
    formatDateLabel: formatDateLabel,
  };
});
