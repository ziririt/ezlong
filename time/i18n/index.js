/**
 * i18n/index.js — 로케일 런타임
 * 2026-07-28 신설 (글로벌화)
 *
 * ★ 클래식 스크립트다 (ES 모듈 아님) ★
 * index.html 은 type="module" 을 쓰지 않는다. 이 파일은 전역
 * window.FlipZenI18n 을 만들고, app.js 보다 **먼저** 로드돼야 한다.
 *
 *   <script src="i18n/weather-codes.js"></script>
 *   <script src="i18n/locale-bundle.js"></script>   ← 카탈로그 (자동 생성)
 *   <script src="i18n/index.js"></script>           ← 이 파일
 *   <script src="app.js"></script>
 *
 * ─────────────────────────────────────────────────────────────
 * 헌법 규칙 GLOBAL-locale-default (scripts/golden/rule-code-map.json)
 * ─────────────────────────────────────────────────────────────
 * 로케일 판정에 실패하거나 값이 이상하면 **무조건 한국어**로 떨어진다.
 * 한국 사용자가 실수로 영어 화면을 보는 일이 절대 없어야 한다.
 *
 * 이 규칙이 "복사본 프로젝트를 만들지 않고 로케일 게이트로 간다"는
 * 이번 글로벌화 전략 전체의 안전을 떠받치는 기둥이다. 폴백을 영어로
 * 바꾸면 그 순간 전략의 근거가 무너진다 — DEFAULT_LOCALE 을 건드리지 말 것.
 *
 * ─────────────────────────────────────────────────────────────
 * 왜 fetch 가 아니라 번들인가
 * ─────────────────────────────────────────────────────────────
 * 카탈로그를 fetch 로 비동기 로드하면 첫 페인트 전에 문자열이 없어서
 * "빈 라벨이 잠깐 보였다가 채워지는" 깜빡임이 생기고, WKWebView/
 * Android WebView 에서 로컬 파일 CORS 문제까지 얹힌다.
 * 지금 로케일이 2개(ko/en)뿐이라 전체 번들이 수십 KB 수준이므로
 * **동기 로드가 압도적으로 단순하고 안전하다**. 로케일이 5개를 넘어
 * 번들이 무거워지면 그때 "활성 로케일만 주입" 방식으로 바꾼다
 * (그때도 app.js 는 t() 만 쓰므로 고칠 필요가 없다).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.FlipZenI18n = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /** ★ 절대 바꾸지 말 것 — 규칙 GLOBAL-locale-default ★ */
  var DEFAULT_LOCALE = "ko";

  /**
   * 지원 로케일. 여기 없는 언어는 전부 baseLocale 로 접힌다.
   * 성동님 결정(2026-07-28): "영어 하나로 시작"한다.
   * 새 언어를 추가할 때는 이 목록 + locales/<code>.json + parity 테스트 통과가 세트다.
   */
  var SUPPORTED = ["ko", "en"];

  /**
   * 폴백 사슬. 어떤 키를 못 찾으면 순서대로 뒤진다.
   * en 조차 없으면 ko 로 — 즉 최악의 경우에도 화면에 한국어가 뜨지
   * 빈칸이나 키 문자열(settings.title 같은)이 뜨지는 않는다.
   */
  var FALLBACK_CHAIN = { en: ["en", "ko"], ko: ["ko"] };

  var catalogs = Object.create(null);   // { ko: {...}, en: {...} }
  var current = DEFAULT_LOCALE;
  var missing = Object.create(null);    // 개발용: 못 찾은 키 수집

  // ─────────────────────────────────────────────────────────
  // 로케일 판정
  // ─────────────────────────────────────────────────────────

  /**
   * BCP-47 태그를 지원 로케일로 접는다. "en-US" → "en", "ko-KR" → "ko".
   * 판정 불가면 null (호출자가 다음 후보로 넘어감).
   */
  function foldTag(tag) {
    if (!tag || typeof tag !== "string") return null;
    var base = tag.toLowerCase().split(/[-_]/)[0];
    return SUPPORTED.indexOf(base) >= 0 ? base : null;
  }

  /**
   * 이 기기에서 쓸 로케일을 정한다.
   *
   * 우선순위:
   *   1) 사용자가 설정에서 직접 고른 값 (localStorage)   ← 나중에 UI 붙일 자리
   *   2) 네이티브 래퍼가 알려준 OS 언어 (window.__FLIPZEN_OS_LOCALE__)
   *   3) navigator.languages / navigator.language
   *   4) DEFAULT_LOCALE (= ko)
   *
   * 어느 단계에서도 예외가 나면 조용히 다음으로 넘어가고,
   * 전부 실패하면 ko 다. 절대 throw 하지 않는다 —
   * 로케일 판정 실패가 앱 전체를 죽이면 안 된다.
   */
  function resolveLocale(opts) {
    opts = opts || {};

    // 1) 명시적 사용자 선택
    try {
      var stored = (opts.storage || (typeof localStorage !== "undefined" ? localStorage : null));
      if (stored) {
        var picked = foldTag(stored.getItem("flipzen.locale"));
        if (picked) return picked;
      }
    } catch (e) { /* Safari 프라이빗 모드 등 — 무시하고 진행 */ }

    // 2) 네이티브 래퍼가 주입한 OS 언어
    var fromNative = foldTag(opts.osLocale || (typeof self !== "undefined" ? self.__FLIPZEN_OS_LOCALE__ : null));
    if (fromNative) return fromNative;

    // 3) 브라우저 언어
    try {
      var nav = opts.navigator || (typeof navigator !== "undefined" ? navigator : null);
      if (nav) {
        var list = nav.languages && nav.languages.length ? nav.languages : [nav.language];
        for (var i = 0; i < list.length; i++) {
          var f = foldTag(list[i]);
          if (f) return f;
        }
      }
    } catch (e) { /* 무시 */ }

    // 4) 최후의 보루
    return DEFAULT_LOCALE;
  }

  // ─────────────────────────────────────────────────────────
  // 문자열 조회
  // ─────────────────────────────────────────────────────────

  function lookup(catalog, key) {
    if (!catalog) return undefined;
    var parts = key.split(".");
    var node = catalog;
    for (var i = 0; i < parts.length; i++) {
      if (node === null || typeof node !== "object") return undefined;
      node = node[parts[i]];
    }
    return typeof node === "string" ? node : undefined;
  }

  /**
   * ICU MessageFormat 의 아주 작은 부분집합.
   *   "{name}"                                        → 단순 치환
   *   "{count, plural, one {# item} other {# items}}"  → 복수형
   *
   * 전체 ICU 를 구현하지 않는 이유: 지금 필요한 건 이 두 가지뿐이고,
   * 라이브러리를 하나 더 들이면 번들과 유지보수 부담이 실익보다 크다.
   * 나중에 성/격 변화가 필요한 언어(러시아어·아랍어 등)를 넣게 되면
   * 그때 intl-messageformat 도입을 재검토한다.
   */
  function format(template, params, locale) {
    if (!params || typeof template !== "string") return template;
    if (template.indexOf("{") < 0) return template;   // 빠른 탈출

    // ★ 정규식이 아니라 중괄호 균형 스캐너를 쓰는 이유 ★
    // "{count, plural, one {# minute} other {# minutes}}" 처럼 중첩된
    // 중괄호는 정규식으로 안정적으로 못 자른다(초안이 실제로 여기서
    // 깨졌다 — 안쪽 } 에서 먼저 끊겨 "other {...}}" 가 그대로 남았다).
    // 짧은 스캐너 하나가 더 정확하고 읽기도 쉽다.
    var out = "";
    var i = 0;
    while (i < template.length) {
      var open = template.indexOf("{", i);
      if (open < 0) { out += template.slice(i); break; }

      out += template.slice(i, open);

      var close = matchBrace(template, open);
      if (close < 0) { out += template.slice(open); break; }  // 짝 없는 { → 원문 유지

      out += renderArg(template.slice(open + 1, close), params, locale);
      i = close + 1;
    }
    return out;
  }

  /** open 위치의 '{' 와 짝을 이루는 '}' 인덱스. 없으면 -1. */
  function matchBrace(s, open) {
    var depth = 0;
    for (var i = open; i < s.length; i++) {
      if (s[i] === "{") depth++;
      else if (s[i] === "}") { depth--; if (depth === 0) return i; }
    }
    return -1;
  }

  /** 중괄호 안쪽 내용(바깥 중괄호 제외)을 렌더한다. */
  function renderArg(inner, params, locale) {
    var comma = inner.indexOf(",");

    // 단순 치환: {name}
    if (comma < 0) {
      var name = inner.trim();
      return Object.prototype.hasOwnProperty.call(params, name)
        ? String(params[name])
        : "{" + inner + "}";
    }

    var argName = inner.slice(0, comma).trim();
    var rest = inner.slice(comma + 1);
    var comma2 = rest.indexOf(",");
    var type = (comma2 < 0 ? rest : rest.slice(0, comma2)).trim();

    if (type !== "plural" || comma2 < 0) return "{" + inner + "}";  // 미지원 타입은 원문 유지

    var n = Number(params[argName]);
    if (!isFinite(n)) return "{" + inner + "}";

    var branches = parseBranches(rest.slice(comma2 + 1));
    var chosen = branches["=" + n];
    if (chosen === undefined) chosen = branches[pluralCategory(n, locale)];
    if (chosen === undefined) chosen = branches.other;
    if (chosen === undefined) return "";

    // '#' 는 숫자 자리. 분기 안의 {name} 도 마저 치환한다.
    return format(chosen.replace(/#/g, String(n)), params, locale);
  }

  /** "one {…} other {…}" → { one: "…", other: "…" } (중첩 중괄호 안전) */
  function parseBranches(body) {
    var out = Object.create(null);
    var i = 0;
    while (i < body.length) {
      while (i < body.length && /\s/.test(body[i])) i++;
      var start = i;
      while (i < body.length && body[i] !== "{" && !/\s/.test(body[i])) i++;
      var key = body.slice(start, i).trim();
      while (i < body.length && /\s/.test(body[i])) i++;
      if (body[i] !== "{") break;
      var close = matchBrace(body, i);
      if (close < 0) break;
      if (key) out[key] = body.slice(i + 1, close);
      i = close + 1;
    }
    return out;
  }

  /** Intl.PluralRules 가 있으면 쓰고, 없으면 영어 규칙으로 근사. */
  function pluralCategory(n, locale) {
    try {
      if (typeof Intl !== "undefined" && Intl.PluralRules) {
        return new Intl.PluralRules(locale || current).select(n);
      }
    } catch (e) { /* 무시 */ }
    return n === 1 ? "one" : "other";
  }

  /**
   * 번역 조회. **절대 throw 하지 않는다.**
   * 못 찾으면 폴백 사슬 → 그래도 없으면 키 자체를 돌려주고 missing 에 기록한다.
   * 화면이 빈칸이 되는 것보다 키라도 보이는 편이 디버깅에 낫다.
   */
  function t(key, params) {
    var chain = FALLBACK_CHAIN[current] || [current, DEFAULT_LOCALE];
    for (var i = 0; i < chain.length; i++) {
      var s = lookup(catalogs[chain[i]], key);
      if (s !== undefined) return format(s, params, chain[i]);
    }
    missing[key] = (missing[key] || 0) + 1;
    return key;
  }

  /** 키가 실제로 존재하는가 (폴백 포함). 조건부 렌더링용. */
  function has(key) {
    var chain = FALLBACK_CHAIN[current] || [current, DEFAULT_LOCALE];
    for (var i = 0; i < chain.length; i++) {
      if (lookup(catalogs[chain[i]], key) !== undefined) return true;
    }
    return false;
  }

  // ─────────────────────────────────────────────────────────
  // 초기화 / 조회 API
  // ─────────────────────────────────────────────────────────

  function register(locale, catalog) {
    if (!locale || !catalog) return;
    catalogs[locale] = catalog;
  }

  /**
   * 앱 시작 시 한 번 호출. locale-bundle.js 가 만든 전역 카탈로그를 등록하고
   * 로케일을 확정한다.
   *
   * @param {{catalogs?: object, locale?: string, osLocale?: string}} opts
   */
  function init(opts) {
    opts = opts || {};

    var src = opts.catalogs ||
      (typeof self !== "undefined" ? self.FLIPZEN_LOCALE_CATALOGS : null) ||
      {};
    for (var k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k)) register(k, src[k]);
    }

    // ko 카탈로그가 없으면 뭔가 크게 잘못된 것이다. 그래도 죽지는 않는다
    // (t() 가 키를 돌려주므로 화면은 뜬다). 콘솔에만 경고한다.
    if (!catalogs[DEFAULT_LOCALE] && typeof console !== "undefined") {
      console.warn("[i18n] 기본 카탈로그(" + DEFAULT_LOCALE + ")가 없습니다. locale-bundle.js 로드를 확인하세요.");
    }

    current = foldTag(opts.locale) || resolveLocale(opts);
    return current;
  }

  function setLocale(locale, persist) {
    var f = foldTag(locale);
    if (!f) return current;
    current = f;
    if (persist) {
      try { localStorage.setItem("flipzen.locale", f); } catch (e) { /* 무시 */ }
    }
    return current;
  }

  function getLocale() { return current; }

  /** 한국어 사용자인가? — 알라딘/아마존 분기 등 "한국 한정" 기능의 단일 판정처. */
  function isKorean() { return current === "ko"; }

  /** 개발용: 런타임에 못 찾은 키 목록. 프로덕션에서 호출하지 않아도 무해. */
  function missingKeys() { return Object.assign({}, missing); }

  return {
    DEFAULT_LOCALE: DEFAULT_LOCALE,
    SUPPORTED: SUPPORTED.slice(),
    init: init,
    register: register,
    resolveLocale: resolveLocale,
    setLocale: setLocale,
    getLocale: getLocale,
    isKorean: isKorean,
    t: t,
    has: has,
    format: format,
    missingKeys: missingKeys,
  };
});
