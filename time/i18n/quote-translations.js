/**
 * quote-translations.js — 투자서 문장의 번역문 조회
 * 2026-07-29 신설 (글로벌화 — 비한국어 문장 번역)
 *
 * ★ 클래식 스크립트. 전역 window.FlipZenQuoteTranslations ★
 * i18n/index.js 다음, app.js 앞에 로드한다.
 *
 * ─────────────────────────────────────────────────────────────
 * 무엇을 하는가
 * ─────────────────────────────────────────────────────────────
 * 영문 원문을 주면 그 언어의 번역문과 서지를 돌려준다.
 *
 *   lookup("Risk means more things can happen than will happen.")
 *   → { text: "リスクとは、…", title: "投資で一番大切な20の教え", author: "ハワード・マークス" }
 *
 * ─────────────────────────────────────────────────────────────
 * 한국어에서는 아무 일도 하지 않는다
 * ─────────────────────────────────────────────────────────────
 * 한국어 화면은 이 파일이 없는 것처럼 동작해야 한다. `load("ko")` 는
 * 네트워크 요청조차 하지 않고 즉시 끝난다 — 한국어 사용자가 읽지도 않을
 * 60KB 를 내려받게 할 이유가 없고, 무엇보다 **한국어 화면의 동작에
 * 이 파일이 끼어들 여지 자체를 없애기 위해서**다.
 *
 * ─────────────────────────────────────────────────────────────
 * 실패하면 조용히 물러난다
 * ─────────────────────────────────────────────────────────────
 * 번역 파일을 못 받아오면(오프라인·배포 누락·JSON 깨짐) 그냥 빈 채로 둔다.
 * lookup 은 null 을 돌려주고, 앱은 영어 원문을 그대로 보여준다.
 * 번역이 없어서 영어가 나오는 것은 불편할 뿐이지만, 여기서 예외가 터지면
 * 문장 박스 전체가 멎는다 — 그쪽이 훨씬 나쁘다.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.FlipZenQuoteTranslations = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /**
   * FNV-1a 32bit → 8자리 16진수.
   *
   * ★ scripts/build-quote-runtime.mjs 의 fzQuoteHash 와 글자 그대로 같아야 한다 ★
   * 한쪽만 고치면 조회가 전부 빗나가고, 화면에는 "번역이 하나도 없는 것처럼"
   * 보인다 — 에러가 안 나서 원인을 찾기 어려운 종류의 고장이다.
   *
   * SHA-1 을 쓰지 않는 이유는 브라우저 구현이 비동기라서다. 문장 렌더는
   * 스와이프에 즉시 반응해야 하는 경로라 await 를 끼울 수 없다.
   */
  function hash(s) {
    var h = 0x811c9dc5;
    var t = String(s).trim();
    for (var i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i) & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    var hex = h.toString(16);
    while (hex.length < 8) hex = "0" + hex;
    return hex;
  }

  var table = null;      // { 해시: [본문, 제목, 저자] }
  var loadedLocale = null;
  var inflight = null;

  /**
   * 해당 언어의 번역 파일을 받아온다. 두 번 불러도 한 번만 받는다.
   * @returns {Promise<boolean>} 쓸 수 있는 번역이 생겼는가
   */
  function load(locale) {
    var lang = String(locale || "").split(/[-_]/)[0].toLowerCase();

    // 한국어는 번역이라는 개념 자체가 없다(원본이 한국어다).
    if (!lang || lang === "ko") {
      table = null;
      loadedLocale = "ko";
      return Promise.resolve(false);
    }
    if (loadedLocale === lang) return Promise.resolve(Boolean(table));
    if (inflight && inflight.lang === lang) return inflight.p;

    var url = "i18n/quotes/" + lang + ".runtime.json";
    var p = fetch(url, { cache: "default" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (json) {
        // 빈 객체({})는 "없는 것"으로 친다. 아직 번역을 시작하지 않은 언어의
        // 빈 파일이 배포에 섞여 들어오면, 200 응답을 받고도 조회는 전부
        // 실패한다 — 그 상태를 "준비됨"이라고 보고하면 화면을 괜히 한 번 더
        // 다시 그리게 되고, 나중에 원인을 가릴 때도 헷갈린다.
        var ok = json && typeof json === "object" && Object.keys(json).length > 0;
        table = ok ? json : null;
        loadedLocale = lang;
        inflight = null;
        return Boolean(table);
      })
      .catch(function (e) {
        // 영어처럼 번역 파일이 아예 없는 언어도 여기로 온다 — 정상 경로다.
        if (typeof console !== "undefined" && console.debug) {
          console.debug("[quote-i18n] " + url + " 없음/실패 — 영문 원문으로 표시", e && e.message);
        }
        table = null;
        loadedLocale = lang;
        inflight = null;
        return false;
      });

    inflight = { lang: lang, p: p };
    return p;
  }

  /**
   * @param {string} english 영문 원문 (investment-quotes.js 의 quote.english)
   * @returns {null | {text:string, title:string, author:string}}
   */
  function lookup(english) {
    try {
      if (!table || !english) return null;
      var row = table[hash(english)];
      if (!row || !row[0]) return null;
      return { text: row[0], title: row[1] || "", author: row[2] || "" };
    } catch (e) {
      return null;   // 문장 하나 때문에 화면이 멎지 않게
    }
  }

  function isReady() { return Boolean(table); }

  return {
    load: load,
    lookup: lookup,
    isReady: isReady,
    _hash: hash,        // 테스트용
  };
});
