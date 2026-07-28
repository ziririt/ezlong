/**
 * quote-source.js — 문장 출처(책) 구매 링크 결정
 * 2026-07-28 신설 (글로벌화)
 *
 * ★ 클래식 스크립트. 전역 window.FlipZenQuoteSource ★
 * i18n/index.js 다음, app.js 앞에 로드한다.
 *
 * ─────────────────────────────────────────────────────────────
 * 무엇을 결정하는가
 * ─────────────────────────────────────────────────────────────
 * 문장 하나가 주어지면 "이 책을 어디서 살 수 있는가"의 링크와 라벨을 만든다.
 *
 *   한국어 로케일 → 알라딘 (기존 그대로, 제휴 partner=friends327)
 *   그 외         → 아마존 검색 (제휴 태그는 발급 후 주입)
 *
 * 성동님 결정(2026-07-28): "글로벌 버전에서 알라딘은 완전히 뺀다."
 * 이유 — 알라딘은 한국 배송 전용이라 해외 사용자에겐 링크가 있어봤자
 * 살 수가 없고, 오히려 "왜 한국어 사이트가 뜨지?" 하는 혼란만 준다.
 *
 * ─────────────────────────────────────────────────────────────
 * 왜 ASIN 이 아니라 검색 URL 인가
 * ─────────────────────────────────────────────────────────────
 * 아마존 상품 ID(ASIN)는 판형(하드커버/페이퍼백/킨들)마다 다르고
 * 나라(.com/.co.uk/.de…)마다 또 다르며, 절판되면 죽는다.
 * 187권 × 여러 나라 × 여러 판형의 ASIN 을 손으로 관리하는 건
 * 유지가 불가능하다 — 첫 절판이 나는 순간 깨진 링크가 된다.
 *
 * 검색 URL 은 그 전부를 아마존의 검색엔진에 위임한다. 사용자는
 * 자기 나라 아마존에서 재고 있는 판형을 직접 고르게 된다.
 * 제휴 수수료도 검색 경유 구매에 정상 적용된다.
 *
 * ─────────────────────────────────────────────────────────────
 * 제휴 태그 (성동님이 이틀 안에 가입 예정)
 * ─────────────────────────────────────────────────────────────
 * 태그가 아직 없으면 tag 파라미터 없이 링크만 만든다 —
 * 즉 **가입 전에도 기능은 완전히 정상 동작**하고, 수수료만 안 붙는다.
 * 태그를 받으면 아래 AMAZON_ASSOCIATE_TAGS 만 채우면 되고
 * 앱 코드는 한 줄도 고칠 필요가 없다.
 *
 * 주의: 아마존 제휴는 **나라별로 별도 가입·별도 태그**다.
 * 미국(.com) 태그를 영국(.co.uk) 링크에 붙이면 수수료가 안 잡힌다.
 * 그래서 태그를 나라별 맵으로 둔다 — 우선 .com 하나로 시작하고,
 * 필요해지면 OneLink 도입을 검토한다.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.FlipZenQuoteSource = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ALADIN_PARTNER_ID = "friends327";

  /**
   * 나라별 아마존 제휴 태그. 발급받는 대로 채운다.
   * 비어 있으면 tag 파라미터를 빼고 링크만 만든다(기능 정상, 수수료 없음).
   */
  var AMAZON_ASSOCIATE_TAGS = {
    "com": "",      // 미국 — 성동님 가입 예정
    "co.uk": "",
    "de": "",
    "co.jp": "",
    "ca": "",
    "com.au": "",
  };

  /**
   * 지역 → 아마존 도메인.
   * 로케일이 아니라 **지역(region)** 으로 고르는 게 맞다 — 캐나다 사람이
   * 영어를 쓴다고 amazon.com 으로 보내면 배송이 안 되거나 비싸진다.
   * region 을 모르면 .com (가장 넓은 배송망)으로 간다.
   */
  var REGION_TO_TLD = {
    US: "com", CA: "ca", GB: "co.uk", UK: "co.uk",
    DE: "de", FR: "fr", IT: "it", ES: "es", NL: "nl", SE: "se", PL: "pl",
    JP: "co.jp", AU: "com.au", SG: "sg", IN: "in", MX: "com.mx", BR: "com.br",
  };
  var DEFAULT_TLD = "com";

  /** 브라우저/OS 힌트에서 국가 코드를 뽑는다. 실패하면 null. */
  function detectRegion(hint) {
    var tags = [];
    if (hint) tags.push(hint);
    try {
      if (typeof navigator !== "undefined") {
        if (navigator.languages) tags = tags.concat(navigator.languages);
        if (navigator.language) tags.push(navigator.language);
      }
    } catch (e) { /* 무시 */ }

    for (var i = 0; i < tags.length; i++) {
      var m = /[-_]([A-Za-z]{2})$/.exec(String(tags[i] || ""));
      if (m) {
        var cc = m[1].toUpperCase();
        if (REGION_TO_TLD[cc]) return cc;
      }
    }
    return null;
  }

  function amazonTld(region) {
    return (region && REGION_TO_TLD[region]) || DEFAULT_TLD;
  }

  /** 알라딘 URL 에 제휴 파라미터를 보장한다 (app.js withAladinPartnerParam 과 동일 규칙). */
  function withAladinPartner(url) {
    if (!url) return url;
    if (url.indexOf("partner=") >= 0) return url;
    return url + (url.indexOf("?") >= 0 ? "&" : "?") + "partner=" + ALADIN_PARTNER_ID;
  }

  function amazonSearchUrl(query, region) {
    var tld = amazonTld(region);
    var url = "https://www.amazon." + tld + "/s?k=" + encodeURIComponent(query);
    var tag = AMAZON_ASSOCIATE_TAGS[tld];
    if (tag) url += "&tag=" + encodeURIComponent(tag);
    return url;
  }

  /**
   * 이 문장의 책 링크를 결정한다.
   *
   * @param {object} quote  { title, author, amazonQuery?, _ko? }
   * @param {object} opts   { locale, aladinLinks, region }
   * @returns {null | {kind:"aladin"|"amazon", url:string, labelKey:string, external:boolean}}
   *          링크를 만들 수 없으면 null → 호출자는 버튼을 숨긴다.
   *
   * ★ 절대 throw 하지 않는다 ★
   * 이 함수가 터지면 문장 렌더링 전체가 멎는다. 데이터가 어떻게 이상하든
   * 최악의 결과는 "링크 버튼이 안 보인다"여야 한다.
   */
  function resolve(quote, opts) {
    try {
      if (!quote) return null;
      opts = opts || {};

      var locale = opts.locale ||
        (typeof self !== "undefined" && self.FlipZenI18n ? self.FlipZenI18n.getLocale() : "ko");

      // ── 한국어: 알라딘 (기존 동작을 글자 그대로 보존) ──
      if (locale === "ko") {
        var links = opts.aladinLinks ||
          (typeof self !== "undefined" ? self.aladinLinks : null) || {};

        // 글로벌 풀의 문장은 title/author 가 영문이고 원래 한국어가 _ko 에 있다.
        // 한국어 모드에서는 한국어 표기로 조회해야 매칭된다.
        var ko = quote._ko || quote;
        var url = links[ko.title + "|" + ko.author];
        if (!url) return null;

        return {
          kind: "aladin",
          url: withAladinPartner(url),
          labelKey: "quote.buyOnAladin",
          external: true,
        };
      }

      // ── 그 외: 아마존 검색 ──
      // amazonQuery 는 build-global-quotes.mjs 가 book-i18n-map.json 에서
      // 미리 넣어준다. 없으면 영문 제목+저자로 즉석 조립한다.
      var q = quote.amazonQuery;
      if (!q) {
        var parts = [];
        if (quote.title) parts.push(quote.title);
        if (quote.author) parts.push(quote.author);
        q = parts.join(" ").trim();
      }
      if (!q) return null;

      // 영문 서지정보가 없는 책(= 한국 도서)은 글로벌에서 링크를 만들지 않는다.
      // 한글이 섞인 검색어를 아마존에 던져봐야 결과가 안 나온다.
      if (/[ㄱ-ㆎ가-힣]/.test(q)) return null;

      var region = opts.region || detectRegion(opts.regionHint);
      return {
        kind: "amazon",
        url: amazonSearchUrl(q, region),
        labelKey: "quote.buyOnAmazon",
        external: true,
      };
    } catch (e) {
      // 링크 하나 때문에 문장이 안 뜨는 일은 없어야 한다.
      if (typeof console !== "undefined") console.warn("[quote-source] resolve 실패", e);
      return null;
    }
  }

  /** 제휴 태그 주입 (발급 후 app 초기화 시 1회 호출하거나, 이 파일 상단을 직접 채워도 됨) */
  function setAssociateTags(tags) {
    if (!tags) return;
    for (var k in tags) {
      if (Object.prototype.hasOwnProperty.call(tags, k)) AMAZON_ASSOCIATE_TAGS[k] = tags[k];
    }
  }

  return {
    resolve: resolve,
    setAssociateTags: setAssociateTags,
    detectRegion: detectRegion,
    amazonSearchUrl: amazonSearchUrl,
    withAladinPartner: withAladinPartner,
    ALADIN_PARTNER_ID: ALADIN_PARTNER_ID,
    _REGION_TO_TLD: REGION_TO_TLD,
  };
});
