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
 * ── 2026-07-28 오후 정밀화 (규칙 폐기가 아니라 사각지대 보완) ──
 * 위 규칙은 아침에 "ko/en 두 개뿐"이던 시점에 쓰였고, 보호하려던 대상은
 * **한국 사용자**였다. 그런데 그 문장을 그대로 구현하면 일본어·독일어·
 * 프랑스어 기기까지 전부 한국어 화면을 받는다 — 보호가 아니라 사고다
 * (실제로 App Store 일본 출시 직전에 발견됐다).
 *
 * 그래서 "판정 실패"를 두 가지로 쪼갠다.
 *   (가) 기기 언어를 **아예 못 읽음**(값 없음·예외·쓰레기) → 여전히 ko.
 *   (나) 기기 언어를 **읽었는데 지원 목록 밖**(ja/de/fr …)     → en.
 * (가)가 원래 규칙이 지키려던 것이고, (나)는 규칙이 미처 상상하지 못한
 * 경우다. 한국어 기기가 영어를 받는 경로는 이 변경으로도 생기지 않는다 —
 * 그 성질이 이 규칙의 본체이고, 테스트로 계속 못박아 둔다.
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
   * 지원 로케일. 여기 없는 언어는 3.5단계에서 en 으로 접힌다.
   *
   * 2026-07-28 착수 시엔 "영어 하나로 시작"이었고, 2026-07-29 에 성동님
   * 결정으로 ja/zh/es/pt 를 추가했다 — ezlong.com 이 이미 번역 페이지를
   * 갖고 있는 5개 언어와 정렬시킨 것이다(앱 UI 와 사이트 언어가 어긋나면
   * "일본어로 소개받고 열었더니 영어" 같은 어긋남이 생긴다).
   *
   * ★ 새 언어를 추가할 때 반드시 세트로 할 것 ★
   *   1) 이 목록에 코드 추가
   *   2) locales/<code>.json 작성 (ko 와 키 1:1)
   *   3) 아래 FALLBACK_CHAIN 에 사슬 추가
   *   4) i18n/region.js 의 geocodeLanguage 에 추가 (역지오코딩 지명 언어)
   *   5) 네이티브 리소스 — ios/FlipZenClock/<code>.lproj/InfoPlist.strings,
   *      android/app/src/main/res/values-<code>/strings.xml
   *      (+ iOS 는 Info.plist CFBundleLocalizations 와 project.pbxproj 3곳 등록.
   *       간체 중국어 폴더명은 zh 가 아니라 zh-Hans — CLAUDE.md 41-3 참조)
   *   6) npm run i18n:build 로 locale-bundle.js 재생성
   *      ★ 이걸 빼먹으면 카탈로그를 만들어도 화면이 그대로다 ★
   *   7) npm run verify:i18n 전체 통과
   * (2)~(7) 중 하나만 빠져도 test-i18n.mjs 또는 test-native-strings.mjs 가
   * 잡아낸다 — 2026-07-29 에 전 로케일 자동 순회로 일반화해뒀다.
   *
   * ★ 그리고 이 파일 밖에서 하나 더 ★
   * weather-backend/src/i18n.ts 의 resolveLang() 이 같은 판정을 독립적으로
   * 한 벌 더 갖고 있다. 여기만 늘리면 프론트는 ?lang=ja 를 보내는데 백엔드가
   * 그걸 ko 로 떨어뜨려서, 일본어 화면 안에 한국어 우산 조언이 섞인다.
   * 두 파일은 항상 같이 본다 (CLAUDE.md 41-4).
   */
  var SUPPORTED = ["ko", "en", "ja", "zh", "es", "pt"];

  /**
   * 폴백 사슬. 어떤 키를 못 찾으면 순서대로 뒤진다.
   *
   * 비한국어는 전부 "자기 언어 → en → ko" 다. en 을 중간에 두는 이유는,
   * 새 키가 추가됐는데 그 언어 번역이 아직 없을 때 **한국어보다 영어가
   * 읽힐 확률이 훨씬 높기** 때문이다. 마지막 ko 는 최후의 보루 —
   * 최악의 경우에도 빈칸이나 키 문자열(settings.title 같은)이 뜨지 않는다.
   */
  var FALLBACK_CHAIN = {
    ko: ["ko"],
    en: ["en", "ko"],
    ja: ["ja", "en", "ko"],
    zh: ["zh", "en", "ko"],
    es: ["es", "en", "ko"],
    pt: ["pt", "en", "ko"]
  };

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
   * "언어를 읽기는 했다"고 인정할 수 있는 태그인가.
   *
   * foldTag 는 미지원 언어를 전부 null 로 뭉개기 때문에, 그것만으로는
   * "일본어 기기"와 "언어를 못 읽은 기기"를 구분할 수 없다. 그 둘을
   * 가르는 것이 이 함수다 — 앞의 2~3글자가 ASCII 알파벳이면(ja, de,
   * fr, zh, xx …) 언어 서브태그로 인정한다. BCP-47 의 primary language
   * subtag 규격이 그렇다.
   *
   * 반대로 "", "  ", "!!!", "-", 123, {} 같은 값은 언어가 아니다 —
   * 이런 건 여전히 ko 로 떨어져야 한다(규칙 GLOBAL-locale-default 의 (가)).
   */
  var LANG_SUBTAG = /^[A-Za-z]{2,3}(?:[-_]|$)/;
  function looksLikeLanguageTag(tag) {
    return typeof tag === "string" && LANG_SUBTAG.test(tag);
  }

  /**
   * 이 기기에서 쓸 로케일을 정한다.
   *
   * 우선순위:
   *   1) 사용자가 설정에서 직접 고른 값 (localStorage)   ← 나중에 UI 붙일 자리
   *   2) 네이티브 래퍼가 알려준 OS 언어 (window.__FLIPZEN_OS_LOCALE__)
   *   3) navigator.languages / navigator.language
   *   3.5) 위에서 읽힌 언어가 지원 목록 밖이면 en   ← 2026-07-28 신설
   *   4) DEFAULT_LOCALE (= ko)
   *
   * 어느 단계에서도 예외가 나면 조용히 다음으로 넘어가고,
   * 아무것도 못 읽으면 ko 다. 절대 throw 하지 않는다 —
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

    // 기기가 알려준 언어 태그를 순서대로 모은다.
    // (foldTag 이전의 원본이 있어야 3.5 단계에서 "일본어 기기"를 알아본다)
    var tags = [];
    var osTag = opts.osLocale || (typeof self !== "undefined" ? self.__FLIPZEN_OS_LOCALE__ : null);
    if (osTag) tags.push(osTag);
    try {
      var nav = opts.navigator || (typeof navigator !== "undefined" ? navigator : null);
      if (nav) {
        var list = nav.languages && nav.languages.length ? nav.languages : [nav.language];
        for (var i = 0; i < list.length; i++) {
          if (list[i]) tags.push(list[i]);
        }
      }
    } catch (e) { /* 무시 */ }

    // 2~3) 지원 목록 안이면 그대로 (네이티브 주입값이 브라우저 값보다 앞선다)
    for (var j = 0; j < tags.length; j++) {
      var f = foldTag(tags[j]);
      if (f) return f;
    }

    // 3.5) 2026-07-28 신설 — 언어를 읽었는데 우리가 지원하지 않는 언어다.
    //   일본어·독일어·프랑스어 기기가 여기 온다. 예전엔 그대로 4) 로 떨어져
    //   **한국어 화면**을 받았는데, 이건 규칙이 의도한 보호가 아니라 사고다
    //   (App Store 일본 출시 직전 발견). 영어가 그나마 읽힐 확률이 높다.
    //   ★ 한국어 기기는 위 2~3) 에서 이미 ko 로 확정되므로 여기 오지 않는다 ★
    for (var k = 0; k < tags.length; k++) {
      if (looksLikeLanguageTag(tags[k])) return "en";
    }

    // 4) 최후의 보루 — 언어를 아예 못 읽었다. 규칙대로 한국어.
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
