/* ez-ads.js - 애드센스 게이트 (2026-08-17 신설, 59항)
   ─────────────────────────────────────────────────────────────────────────
   무엇을 하나
     이 파일은 "광고를 보여줄 자격이 있는 화면인가"를 한 곳에서 판정하고,
     통과한 경우에만 애드센스 스크립트를 **삽입**한다. 숨기지 않는다 -
     display:none 으로 가리는 것은 애드센스 정책 위반이고, 앱 웹뷰 안에서
     스크립트가 한 번이라도 뜨면 무효 트래픽으로 계정이 날아간다.
     그래서 순서가 전부다: 판정 → 통과한 경우에만 로드 → 슬롯 활성화.

   지금 상태 (가개발)
     EZ_ADS_LIVE = false. 실제 송출은 아무에게도 안 나간다. 운영자가
     주소 뒤에 ?ads=preview 를 한 번 붙이면 그 브라우저에서만 30일간
     '자리 미리보기'가 켜진다 - 이때도 애드센스 스크립트는 절대 안 부르고,
     점선 상자와 판정 진단만 그린다. ?ads=off 로 끈다.

   앱 웹뷰 판별을 왜 세 겹으로 하나
     앱 담당이 준 계약은 localStorage 'ezlong:inApp' 한 개다. 그런데 그 열쇠는
     앱이 /time/ 을 연 적이 있어야 생긴다. 앱이 딥링크로 루트 페이지를 바로
     열거나, 웹뷰 저장소가 비워졌거나, 저장소 접근이 막히면 열쇠가 없는
     앱 화면이 만들어진다 - 그 화면에 광고가 뜨면 계정이 위험하다.
     그래서 ez-nav.js 가 이미 쓰고 있는 판정(주소의 embed=app, 세션 표시,
     네이티브 브릿지 존재)을 같이 본다. 하나라도 걸리면 앱으로 본다.
     광고는 "확실할 때만 켠다" - 애매하면 끈다. 틀린 광고보다 빈 자리가 낫다.

   프리미엄(유료·구독) 처리
     앱은 유료 이용자에게 애드몹을 끈다. 그러니 같은 사람이 앱 안에서
     ezlong 페이지로 넘어왔을 때 우리 광고가 뜨면 돈 낸 사람이 광고를 보는
     셈이다. 지금은 앱 안이면 유료·무료 가리지 않고 전면 금지라 자동으로
     지켜지고, 나중에 앱이 WebView API for Ads 등록을 마쳐 앱 안이 열릴 때는
     'ezlong:premium' 미러로 유료 이용자만 계속 광고 없이 남는다.
     미러 값이 없거나 이상하면 유료로 취급한다(보수적 판정).
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* 두 번 실행 방지 - 실험실 페이지는 이 파일을 직접 부르고, ez-nav.js 의
     조건부 로더도 같은 파일을 부를 수 있다. 그대로 두면 칩과 자리가 두 벌 뜬다. */
  if (window.__ezAdsLoaded) return;
  window.__ezAdsLoaded = true;

  /* ── 스위치 ────────────────────────────────────────────────────────────
     EZ_ADS_LIVE(송출 시작 여부)는 ez-nav.js 한 곳에만 둔다. 이 파일을
     내려받을지 말지도 그 값이 정하므로, 스위치가 두 곳에 있으면 반드시
     한쪽이 뒤처진다. 아래 둘은 이 파일의 소관이다. */
  var WEBVIEW_ADS_REGISTERED = false;   // 앱이 WebView API for Ads 등록을 마쳤는가
  /* 게시자 ID - 이미 발급돼 있다. 2026-08-17 조사에서 index·스윙 대시보드 등
     11개 페이지가 이 ID로 애드센스 로더를 아무 조건 없이(앱 화면 포함) 부르고
     있는 것을 확인했고, 오너 판단으로 그 11개를 전부 걷어냈다. 지금 이 사이트에
     애드센스를 부르는 경로는 이 파일 하나뿐이며, 그마저 스위치가 꺼져 있다. */
  var PUB_ID = 'ca-pub-2336764115275414';

  var PREVIEW_KEY = 'ezlong:adsPreview';
  var PREVIEW_DAYS = 30;
  var IN_APP_KEY = 'ezlong:inApp';      // 앱이 기록 - 루트 사이트는 읽기만 한다
  var PREMIUM_KEY = 'ezlong:premium';   // 앱이 기록 - 루트 사이트는 읽기만 한다

  function lsGet(k) {
    try { return localStorage.getItem(k) || ''; } catch (e) { return ''; }
  }

  /* ── 1. 판정 ─────────────────────────────────────────────────────────── */

  /** 이 화면이 앱 웹뷰 안이라고 볼 근거들. 사람이 읽을 문장으로 돌려준다 -
      실험실 페이지가 "왜 그렇게 판정했는지"를 그대로 화면에 뿌린다. */
  function inAppSignals() {
    var out = [];
    var key = lsGet(IN_APP_KEY);
    if (key) out.push('앱이 남긴 열쇠 ezlong:inApp = "' + key + '"');
    try {
      var native = new URLSearchParams(location.search).get('native');
      if (native === 'android' || native === 'ios') out.push('주소에 native=' + native);
    } catch (e) { /* 무시 */ }
    try {
      if (typeof window.ezInAppWebview === 'function' && window.ezInAppWebview()) {
        out.push('앱 진입 표시(embed=app) 또는 네이티브 브릿지 감지');
      }
    } catch (e) { /* 무시 */ }
    return out;
  }

  /** 광고 허용 여부 판정 한 벌. 판정 지점을 여기 하나로 모아둔 이유는,
      정책이 풀릴 때 고칠 곳이 한 군데여야 하기 때문이다. */
  function decide() {
    var signals = inAppSignals();
    var premium = lsGet(PREMIUM_KEY);
    var d = { inApp: signals.length > 0, signals: signals, premium: premium };

    if (!d.inApp) {
      d.allowed = true;
      d.reason = '일반 브라우저 방문자 - 애드센스 정상 대상';
      return d;
    }
    if (!WEBVIEW_ADS_REGISTERED) {
      d.allowed = false;
      d.reason = '앱 화면 안 - 앱이 WebView API for Ads 등록 전이라 전면 금지';
      return d;
    }
    if (premium !== '0') {
      d.allowed = false;
      d.reason = premium === '1'
        ? '앱 화면 안 + 유료 이용자 - 돈 낸 사람에게 광고를 보이지 않는다'
        : '앱 화면 안 + 유료 여부 미확인 - 확실할 때만 켠다는 원칙에 따라 끈다';
      return d;
    }
    d.allowed = true;
    d.reason = '앱 화면 안 + 무료 이용자 - 등록 완료 상태라 허용';
    return d;
  }

  window.ezAdsDecide = decide;   // 실험실 페이지가 같은 함수를 쓴다

  /* ── 2. 미리보기 (운영자 전용) ───────────────────────────────────────── */

  function previewUntil() {
    var raw = lsGet(PREVIEW_KEY);
    if (!raw) return 0;
    var n = parseInt(raw, 10);
    if (!n || n < Date.now()) {
      try { localStorage.removeItem(PREVIEW_KEY); } catch (e) { /* 무시 */ }
      return 0;
    }
    return n;
  }

  function setPreview(on) {
    try {
      if (on) localStorage.setItem(PREVIEW_KEY, String(Date.now() + PREVIEW_DAYS * 864e5));
      else localStorage.removeItem(PREVIEW_KEY);
    } catch (e) { /* 무시 */ }
  }

  window.ezAdsPreview = { on: function () { setPreview(true); }, off: function () { setPreview(false); },
                          until: previewUntil };

  try {
    var q = new URLSearchParams(location.search).get('ads');
    if (q === 'preview') setPreview(true);
    else if (q === 'off') setPreview(false);
  } catch (e) { /* 무시 */ }

  var LIVE = window.EZ_ADS_LIVE === true;
  var PREVIEW = previewUntil() > 0;
  if (!LIVE && !PREVIEW) return;      // 평소에는 여기서 끝 - 아무것도 그리지 않는다

  var VERDICT = decide();

  /* ── 3. 자리(슬롯) ───────────────────────────────────────────────────
     자리 높이를 미리 잡아두면 광고가 늦게 떠도 본문이 밀리지 않는다(CLS).
     반대로 광고를 안 부르는 화면에서는 자리째 접어야 한다 - 빈 회색 상자를
     남기는 건 독자에게 아무 값이 없다. */
  var CSS = [
    '.ezad{margin:14px auto;max-width:var(--ez-max-w,760px);padding:0 16px;box-sizing:border-box}',
    '.ezad-box{border:1.5px dashed rgba(120,120,128,.55);border-radius:12px;min-height:100px;',
    'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;',
    'padding:14px 12px;text-align:center;background:rgba(120,120,128,.06)}',
    '.ezad-t1{font-size:14px;font-weight:800;color:var(--ez-text2,#515154)}',
    '.ezad-t2{font-size:14px;color:var(--ez-text3,#86868B);line-height:1.5}',
    '.ezad-live{min-height:100px}',
    '.ezad-chip{position:fixed;right:12px;bottom:12px;z-index:99999;max-width:calc(100vw - 24px);',
    'background:#1C1C1E;color:#F5F5F7;border-radius:14px;padding:10px 13px;font-size:14px;',
    'line-height:1.5;box-shadow:0 6px 22px rgba(0,0,0,.28);font-family:var(--ez-font,-apple-system,sans-serif)}',
    '.ezad-chip b{color:#FFD60A;font-weight:800}',
    '.ezad-chip .no{color:#FF9F9F;font-weight:800}',
    '.ezad-chip .yes{color:#7EE2A8;font-weight:800}',
    '.ezad-chip a{color:#7FBEFF;text-decoration:underline}',
    '.ezad-chip button{margin-left:8px;font-size:14px;font-family:inherit;background:#3A3A3C;',
    'color:#F5F5F7;border:0;border-radius:8px;padding:4px 10px;cursor:pointer}'
  ].join('');

  function injectCss() {
    var st = document.createElement('style');
    st.setAttribute('data-ez-ads', '1');
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function slots() {
    return Array.prototype.slice.call(document.querySelectorAll('[data-ez-ad]'));
  }

  /** 미리보기에서만: 선언된 자리가 하나도 없는 페이지에는 헤더 아래에 하나
      만들어 붙인다. 사이트를 돌아다니며 "여기 붙으면 이렇게 보인다"를
      확인하려는 용도라, 실제 송출 때는 이 자동 삽입을 쓰지 않는다. */
  function ensureDemoSlot() {
    if (slots().length) return;
    var host = document.createElement('div');
    host.setAttribute('data-ez-ad', 'header');
    host.setAttribute('data-ez-ad-demo', '1');
    var nav = document.querySelector('.ez-nav, .nav, header');
    if (nav && nav.parentNode) nav.parentNode.insertBefore(host, nav.nextSibling);
    else document.body.insertBefore(host, document.body.firstChild);
  }

  var SLOT_LABEL = {
    header: '헤더 아래 가로형 반응형',
    inline: '본문 중간 가로형',
    footer: '글 끝 가로형'
  };

  function paintPreview() {
    slots().forEach(function (el) {
      var kind = el.getAttribute('data-ez-ad') || 'header';
      el.className = (el.className ? el.className + ' ' : '') + 'ezad';
      el.innerHTML =
        '<div class="ezad-box">' +
          '<div class="ezad-t1">광고 자리 · ' + (SLOT_LABEL[kind] || kind) + '</div>' +
          '<div class="ezad-t2">' + (VERDICT.allowed
            ? '이 화면에서는 광고가 허용된다. 지금은 송출 전이라 스크립트를 부르지 않는다.'
            : '이 화면에서는 광고가 <b>차단</b>된다 - ' + VERDICT.reason) + '</div>' +
        '</div>';
    });
  }

  function paintChip() {
    var chip = document.createElement('div');
    chip.className = 'ezad-chip';
    chip.innerHTML =
      '<b>광고 게이트 미리보기</b><br>' +
      '판정 <span class="' + (VERDICT.allowed ? 'yes">허용' : 'no">차단') + '</span> · ' +
      (VERDICT.inApp ? '앱 화면' : '브라우저') +
      (VERDICT.premium ? ' · 유료 ' + (VERDICT.premium === '1' ? 'O' : 'X') : '') +
      '<br><a href="/labs-ads.html">실험실</a>' +
      '<button type="button">끄기</button>';
    chip.querySelector('button').addEventListener('click', function () {
      setPreview(false);
      chip.remove();
      slots().forEach(function (el) { el.remove(); });
    });
    document.body.appendChild(chip);
  }

  /* ── 4. 실제 송출 (심사 통과 후에만 도달) ────────────────────────────── */
  function goLive() {
    if (!PUB_ID) {
      if (window.console) console.warn('[ez-ads] PUB_ID 미설정 - 송출 보류');
      return;
    }
    /* 페이지가 스스로 광고 지면임을 선언해야 한다. 로더(ez-nav.js)에도 같은
       조건이 있지만, 이 파일을 직접 불러오는 경로(실험실 등)가 있으므로 여기서
       한 번 더 본다 - 광고는 두 번 확인해서 손해 볼 일이 없다. */
    if (!document.querySelector('meta[name="ez-ads"][content="on"]')) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + PUB_ID;
    s.crossOrigin = 'anonymous';
    document.head.appendChild(s);

    slots().forEach(function (el) {
      if (el.getAttribute('data-ez-ad-demo')) return;      // 미리보기용 자리는 제외
      var unit = el.getAttribute('data-ez-ad-unit') || '';
      if (!unit) return;
      el.className = (el.className ? el.className + ' ' : '') + 'ezad ezad-live';
      el.setAttribute('aria-label', 'advertisement');
      var ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', PUB_ID);
      ins.setAttribute('data-ad-slot', unit);
      ins.setAttribute('data-ad-format', 'horizontal');
      ins.setAttribute('data-full-width-responsive', 'true');
      el.appendChild(ins);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* 무시 */ }
    });
  }

  function start() {
    injectCss();
    if (PREVIEW) {
      ensureDemoSlot();
      paintPreview();
      paintChip();
      return;                       // 미리보기 중에는 실제 스크립트를 절대 안 부른다
    }
    if (LIVE && VERDICT.allowed) goLive();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
