/**
 * ez-app-banner.js — 앱 설치 배너 (2026-08-26 신설, CLAUDE.md 71항)
 *
 * 사파리는 <meta name="apple-itunes-app"> 한 줄이면 상단에 공식 배너를 그려 준다
 * (App Store로 보내거나, 이미 깔려 있으면 앱을 연다). 안드로이드 크롬에는 같은
 * 기능이 없어 같은 모양의 배너를 직접 그린다.
 *
 * 이 파일이 존재하는 진짜 이유는 배너를 '띄우는' 쪽이 아니라 '막는' 쪽이다 —
 * 앱 웹뷰 안에서 앱 설치 배너가 뜨면 이미 앱을 쓰는 사람에게 앱을 권하는 꼴이다.
 * 그래서 판정을 먼저 하고, 브라우저일 때만 배너를 만든다.
 *
 * 왜 <head>에서 동기로 부르는가 —
 *   사파리는 문서를 훑으며 apple-itunes-app 을 찾는다. body 끝(ez-nav.js 자리)에서
 *   메타를 꽂으면 이미 늦을 수 있다. head 안에서, 파싱 도중에 꽂아야 확실하다.
 *
 * 판정 단일 출처: window.ezInAppWebview 를 여기서 정의한다(59항). ez-nav.js·
 * ez-ads.js 가 같은 함수를 쓴다 — 앱 판별이 파일마다 갈리면 언젠가 어긋난다.
 */
(function () {
  'use strict';

  /* ── 앱 제원 ─────────────────────────────────────────────────────────── */
  var APP = {
    iosId:   '6793780938',                     // Long Time, Easy Life
    android: 'com.ezlong.flipzenweather',
    icon:    '/icons/pwa-180.png?v=20260809'
  };
  var CLOSED_KEY = 'ezlong:appBannerClosed';   // 애플 배너처럼 한 번 닫으면 끝

  /* ── 앱 웹뷰 판정 (3겹) ───────────────────────────────────────────────
     ① 앱이 첫 진입 URL에 붙이는 embed=app — 첫 로드에만 있으므로 세션에 새긴다
     ② 앱이 남기는 localStorage 열쇠 / native= 파라미터
     ③ 네이티브 브릿지가 이 프레임이나 상위 프레임에 보이면 그것만으로 확정
     하나라도 걸리면 앱으로 본다. 앱인데 브라우저로 잘못 보는 쪽이 더 나쁘다. */
  var EMBED_KEY = 'ezlong.embedApp';

  function findBridge() {
    var frames = [];
    try { frames.push(window); } catch (e) {}
    try { if (window.parent && window.parent !== window) frames.push(window.parent); } catch (e) {}
    try { if (window.top && frames.indexOf(window.top) < 0) frames.push(window.top); } catch (e) {}
    for (var i = 0; i < frames.length; i++) {
      var w = frames[i];
      try {
        if (w.webkit && w.webkit.messageHandlers && w.webkit.messageHandlers.flipzenNativeRadio) return true;
      } catch (e) {}
      try {
        if (w.AndroidNativeBridge && typeof w.AndroidNativeBridge.postMessage === 'function') return true;
      } catch (e) {}
    }
    return false;
  }

  function inAppWebview() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('embed') === 'app') {
        try { sessionStorage.setItem(EMBED_KEY, '1'); } catch (e) {}
        return true;
      }
      var native = q.get('native');
      if (native === 'ios' || native === 'android') return true;
    } catch (e) {}
    try { if (sessionStorage.getItem(EMBED_KEY) === '1') return true; } catch (e) {}
    try { if (localStorage.getItem('ezlong:inApp')) return true; } catch (e) {}
    return findBridge();
  }

  window.ezInAppWebview = inAppWebview;   // 59항 — 판정은 한 벌만 둔다

  /* ── 페이지가 이미 다른 앱을 선언했는가 ───────────────────────────────
     Skyblue Note 랜딩처럼 자기 앱 배너를 이미 가진 페이지가 있다. 남의 지면을
     빼앗지 않는다 — 선언이 있으면 그것을 존중하고, 안드로이드 배너도 그 앱이
     우리 앱일 때만 그린다. */
  function declaredMeta() {
    return document.querySelector('meta[name="apple-itunes-app"]');
  }

  var IN_APP = inAppWebview();

  /* ── 1) 앱 안이면 배너를 만들지 않고, 이미 박혀 있는 것도 걷어낸다 ──── */
  if (IN_APP) {
    var m = declaredMeta();
    if (m && m.parentNode) m.parentNode.removeChild(m);
    return;
  }

  /* ── 2) 사파리 스마트 앱 배너 — 메타 한 줄 ─────────────────────────────
     iOS 외 플랫폼은 이 메타를 무시하므로 조건 없이 넣어도 해가 없다.
     사파리는 기기·지역에서 앱을 못 받으면 알아서 배너를 안 띄운다. */
  var meta = declaredMeta();
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'apple-itunes-app');
    meta.setAttribute('content', 'app-id=' + APP.iosId);
    (document.head || document.documentElement).appendChild(meta);
  }

  /* ── 3) 어느 스토어의 자체 배너를 그릴 것인가 (79항, 2026-08-27) ────────
     스마트 앱 배너(위 2단계)는 **사파리 앱의 기능**이지 WebKit 엔진의 기능이
     아니다. 아이폰의 크롬·파이어폭스·엣지·웨일과 네이버·카카오 인앱 브라우저는
     전부 WebKit을 쓰지만 그 배너 UI를 구현하지 않아 아무것도 안 뜬다.
     안드로이드는 애초에 공식 기능이 없어 우리가 직접 그리고 있었으므로 모든
     브라우저에서 떴다 — 운영 제보로 확인된 이 비대칭을 여기서 없앤다.
     즉 **자체 배너는 '안드로이드' + 'iOS 비사파리'** 둘 다에서 그린다. */
  var UA = navigator.userAgent || '';
  var isAndroid = /Android/i.test(UA);
  var isIOS = /iPad|iPhone|iPod/i.test(UA) ||
              (/Macintosh/i.test(UA) && (navigator.maxTouchPoints || 0) > 1);  // iPadOS 13+

  // 사파리가 아닌 iOS 브라우저 — 이름을 대는 것들과, 'Version/'이 없는 웹뷰 계열.
  // 엣지는 Version/을 달고 오므로 이름으로도 함께 본다.
  var NOT_SAFARI = /CriOS|FxiOS|EdgiOS|OPT\/|Whale|DuckDuckGo|YaBrowser|Puffin|SamsungBrowser|NAVER|KAKAO|DaumApps|Line\/|FBAN|FBAV|Instagram|Snapchat|Twitter/i;
  var isSafariIOS = isIOS && /Version\/\d/.test(UA) && !NOT_SAFARI.test(UA);

  // 사파리는 위 메타 한 줄이 공식 배너를 그려 준다 — 우리가 겹쳐 그리지 않는다.
  var STORE = isAndroid ? 'android' : (isIOS && !isSafariIOS ? 'ios' : null);
  if (!STORE) return;

  // 이 페이지가 선언한 앱이 우리 앱이 아니면(예: Skyblue Note) 그리지 않는다
  var declared = meta.getAttribute('content') || '';
  if (declared.indexOf(APP.iosId) < 0) return;

  try { if (localStorage.getItem(CLOSED_KEY) === '1') return; } catch (e) {}

  var L = (function () {
    var m2 = /^\/(en|ja|zh|es|pt)\//.exec(location.pathname);
    var lang = m2 ? m2[1] : 'ko';
    // 부제는 스토어 이름이 들어가므로 둘로 나눈다(79항). 애플 배너와 같은 문구 계열.
    var T = {
      ko: { name: 'Long Time, Easy Life', by: 'ezlong.com',
            subG: '무료 · Google Play', subA: '무료 · App Store',
            cta: '받기', close: '배너 닫기' },
      en: { name: 'Long Time, Easy Life', by: 'ezlong.com',
            subG: 'FREE · On Google Play', subA: 'FREE · On the App Store',
            cta: 'GET', close: 'Dismiss banner' },
      ja: { name: 'Long Time, Easy Life', by: 'ezlong.com',
            subG: '無料 · Google Play', subA: '無料 · App Store',
            cta: '入手', close: 'バナーを閉じる' },
      zh: { name: 'Long Time, Easy Life', by: 'ezlong.com',
            subG: '免费 · Google Play', subA: '免费 · App Store',
            cta: '获取', close: '关闭横幅' },
      es: { name: 'Long Time, Easy Life', by: 'ezlong.com',
            subG: 'Gratis · Google Play', subA: 'Gratis · App Store',
            cta: 'OBTENER', close: 'Cerrar banner' },
      pt: { name: 'Long Time, Easy Life', by: 'ezlong.com',
            subG: 'Grátis · Google Play', subA: 'Grátis · App Store',
            cta: 'OBTER', close: 'Fechar banner' }
    };
    return T[lang] || T.ko;
  })();

  var CSS = [
    '.ezab{display:flex;align-items:center;gap:12px;padding:10px 12px;',
      'background:var(--ez-card2,#F2F2F7);border-bottom:1px solid var(--ez-border,rgba(120,120,128,.28));',
      'font-family:var(--ez-font,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif)}',
    '.ezab-x{flex:0 0 auto;width:26px;height:26px;border:0;background:none;cursor:pointer;',
      'color:var(--ez-text3,#86868B);font-size:19px;line-height:1;padding:0}',
    '.ezab-ic{flex:0 0 auto;width:54px;height:54px;border-radius:12px;',
      'box-shadow:0 1px 3px rgba(0,0,0,.18)}',
    '.ezab-b{flex:1 1 auto;min-width:0}',
    '.ezab-n{font-size:15px;font-weight:700;color:var(--ez-text,#1D1D1F);',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.ezab-p{font-size:13px;color:var(--ez-text3,#86868B);line-height:1.45}',
    '.ezab-s{font-size:12px;color:var(--ez-text3,#86868B);letter-spacing:.02em}',
    '.ezab-cta{flex:0 0 auto;font-size:15px;font-weight:700;color:var(--ez-blue,#0071E3);',
      'text-decoration:none;padding:8px 14px;border-radius:999px;min-height:44px;',
      'display:flex;align-items:center}',
    '.ezab-cta:active{opacity:.55}'
  ].join('');

  function paint() {
    if (!document.body || document.querySelector('.ezab')) return;
    var st = document.createElement('style');
    st.setAttribute('data-ez-app-banner', '1');
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);

    var bar = document.createElement('div');
    bar.className = 'ezab';
    bar.setAttribute('role', 'complementary');

    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'ezab-x';
    x.setAttribute('aria-label', L.close);
    x.textContent = '×';
    x.addEventListener('click', function () {
      try { localStorage.setItem(CLOSED_KEY, '1'); } catch (e) {}
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    });

    var ic = document.createElement('img');
    ic.className = 'ezab-ic';
    ic.src = APP.icon;
    ic.alt = '';
    ic.width = 54; ic.height = 54;

    var body = document.createElement('div');
    body.className = 'ezab-b';
    var n = document.createElement('div'); n.className = 'ezab-n'; n.textContent = L.name;
    var p = document.createElement('div'); p.className = 'ezab-p'; p.textContent = L.by;
    var s = document.createElement('div'); s.className = 'ezab-s';
    s.textContent = (STORE === 'ios') ? L.subA : L.subG;
    body.appendChild(n); body.appendChild(p); body.appendChild(s);

    var cta = document.createElement('a');
    cta.className = 'ezab-cta';
    cta.href = (STORE === 'ios')
      ? 'https://apps.apple.com/app/id' + APP.iosId
      : 'https://play.google.com/store/apps/details?id=' + APP.android;
    cta.rel = 'nofollow noopener';
    cta.textContent = L.cta;

    bar.appendChild(x); bar.appendChild(ic); bar.appendChild(body); bar.appendChild(cta);
    document.body.insertBefore(bar, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', paint);
  } else {
    paint();
  }
})();
