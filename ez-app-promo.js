/* ez-app-promo.js: 직접 만든 앱 홍보 배너 (2026-09-09 신설, 92항)
   ─────────────────────────────────────────────────────────────────────────
   왜 있나
     59항으로 애드센스 게이트(ez-ads.js)를 만들어 뒀지만 스위치는 꺼져 있다.
     방문자 수가 아직 광고를 달 만큼이 아니라서다. 그 자리를 비워 두느니
     이 사이트가 만든 앱 둘을 알린다: 팔 것이 없으면 내 것을 판다.

   애드센스와 섞지 않는다
     ez-ads.js 를 고쳐 쓰지 않고 새 파일로 뗀 이유는, 나중에 애드센스를 켤 때
     "이 자리에 뜬 게 광고인가 자사 배너인가"가 코드에서 갈라져 있어야 하기
     때문이다. 판정이 한 파일에서 두 갈래로 갈리면 반드시 한쪽이 뒤처진다.

   앱 화면에서는 뜨지 않는다
     Long Time, Easy Life 웹뷰 안에서 "이 앱을 받으세요"가 뜨면 이미 쓰는
     사람에게 앱을 권하는 꼴이다. 판정은 새로 만들지 않고 window.ezInAppWebview
     하나를 쓴다(59항·71항이 정한 단일 출처). 그 함수가 아직 없으면 최소한의
     자체 판정으로 대신한다 - 애매하면 안 그린다. 틀린 배너보다 빈 자리가 낫다.

   지면은 페이지가 선언한다
     <meta name="ez-promo" content="on"> 이 있는 페이지에만 붙는다. 스위치를
     켠다고 온 사이트에 번지지 않게 하는 구조다(59항과 같은 방식).
     자리를 직접 정하고 싶으면 <div data-ez-promo></div> 를 원하는 곳에 둔다.
     없으면 헤더 바로 아래에 스스로 만든다.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  if (window.__ezAppPromoLoaded) return;
  window.__ezAppPromoLoaded = true;

  var CLOSE_KEY = 'ezlong:promoClosed';
  var CLOSE_DAYS = 14;               // 닫으면 2주. 영구는 과하고, 매번 뜨면 성가시다

  var APPS = [
    {
      href: '/longtime/',
      icon: '/time/icons/pwa-512.png',
      name: 'Long Time, Easy Life',
      kind: '시계 앱',
      desc: '충전기에 꽂아 세워두면 큼직한 플립시계'
    },
    {
      href: '/skybluenote/',
      icon: '/skybluenote/web/icons/Icon-512.png',
      name: 'Skyblue Note',
      kind: '노트 앱',
      desc: 'AI 답변을 붙여넣으면 깨진 표가 다시 섭니다'
    }
  ];

  function lsGet(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 무시 */ } }

  /* 앱 화면 판정. 단일 출처(window.ezInAppWebview)가 있으면 그것만 믿는다.
     없을 때만 최소한으로 직접 본다 - 이 파일이 판정 규칙을 새로 만들지 않는다. */
  function inApp() {
    try {
      if (typeof window.ezInAppWebview === 'function') return !!window.ezInAppWebview();
    } catch (e) { /* 아래로 */ }
    try {
      if (lsGet('ezlong:inApp')) return true;
      var q = new URLSearchParams(location.search);
      if (q.get('embed') === 'app') return true;
      var n = q.get('native');
      if (n === 'ios' || n === 'android') return true;
      if (sessionStorage.getItem('ezlong:inAppSession')) return true;
    } catch (e) { /* 무시 */ }
    return false;
  }

  function closedUntil() {
    var raw = lsGet(CLOSE_KEY);
    if (!raw) return 0;
    var n = parseInt(raw, 10);
    if (!n || n < Date.now()) { try { localStorage.removeItem(CLOSE_KEY); } catch (e) {} return 0; }
    return n;
  }

  /* 2026-09-09 2차 — 한 앱씩, 높이 40%.
     첫 판은 두 앱을 나란히 세웠더니 폰에서 353px 였다. 첫 화면의 3분의 1이라
     "너무 높아서 다들 꺼버릴 듯"이라는 지적을 받았다. 배너가 본론을 밀어내면
     그건 배너가 아니라 통행세다(41항).
     그래서 둘 중 하나만 무작위로 세우고, 머리글을 없애 한 줄 카드로 눕혔다. */
  var CSS = [
    '.ezpromo{position:relative;margin:10px auto;max-width:var(--ez-max-w,1100px);',
    'padding:0 16px;box-sizing:border-box}',
    '.ezpromo-card{position:relative;display:flex;align-items:center;gap:13px;text-decoration:none;',
    'border:1px solid var(--ez-border,rgba(120,120,128,.24));border-radius:14px;',
    'background:var(--ez-card,rgba(120,120,128,.06));padding:13px 44px 13px 14px;',
    'transition:transform 120ms ease,border-color 120ms ease}',
    '.ezpromo-card:active{transform:scale(.99)}',
    '@media (hover:hover){.ezpromo-card:hover{border-color:var(--ez-blue,#2563EB)}}',
    /* 곡률 22.5%: 홈 화면 아이콘과 같은 모양 */
    '.ezpromo-ico{flex:0 0 auto;width:46px;height:46px;border-radius:10px;',
    'box-shadow:0 1px 4px rgba(0,0,0,.14)}',
    '.ezpromo-body{min-width:0;flex:1 1 auto}',
    '.ezpromo-name{margin:0 0 2px;font-size:16px;font-weight:800;letter-spacing:-.01em;',
    'word-break:keep-all;',
    'color:var(--ez-text,#1D1D1F);line-height:1.3}',
    /* 한 줄로 자른다. 넘치면 말줄임 - 자세한 건 소개 페이지에서 읽는다. */
    '.ezpromo-kind{font-size:14px;font-weight:600;color:var(--ez-text3,#86868B);letter-spacing:0}',
    /* keep-all: 한글은 기본값이 어절 중간에서 끊긴다. '큼직한 플립시 / 계' 로
       갈라진 실사고가 있었다 - 두 줄 안에 들어가도 낱말이 쪼개지면 실패다. */
    '.ezpromo-desc{margin:0;font-size:14px;line-height:1.45;color:var(--ez-text2,#515154);',
    'word-break:keep-all;overflow-wrap:break-word;',
    'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '@media (min-width:700px){.ezpromo-desc{-webkit-line-clamp:1}}',
    '.ezpromo-go{flex:0 0 auto;display:inline-flex;align-items:center;gap:3px;',
    'font-size:14px;font-weight:700;color:var(--ez-blue,#2563EB);white-space:nowrap}',
    '@media (max-width:479px){.ezpromo-go span{display:none}}',   /* 좁으면 화살표만 */
    '.ezpromo-x{position:absolute;top:50%;right:22px;transform:translateY(-50%);',
    'width:30px;height:30px;border:0;border-radius:8px;z-index:2;',
    'background:transparent;color:var(--ez-text3,#86868B);font-size:16px;line-height:1;cursor:pointer;',
    'display:flex;align-items:center;justify-content:center}',
    '@media (hover:hover){.ezpromo-x:hover{background:rgba(120,120,128,.14)}}',
    '@media (prefers-reduced-motion:reduce){.ezpromo-card{transition:none}.ezpromo-card:active{transform:none}}'
  ].join('');

  function injectCss() {
    /* 속성 이름을 자리(data-ez-promo)와 다르게 둔다. 같은 이름을 쓰면
       slot() 의 querySelector 가 이 style 태그를 자리로 착각해 배너 HTML 이
       스타일 시트 안의 텍스트로 들어간다(2026-09-09 실사고). */
    if (document.querySelector('style[data-ez-promo-css]')) return;
    var st = document.createElement('style');
    st.setAttribute('data-ez-promo-css', '1');
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"'
            + ' stroke-linecap="round" stroke-linejoin="round" width="13" height="13" aria-hidden="true">'
            + '<path d="M5 12h14M12 5l7 7-7 7"/></svg>';

  function cardHtml(a) {
    /* 머리글 줄('직접 만든 앱')을 없앤 대신 종류를 이름 옆에 흐린 글씨로 붙였다.
       줄을 하나 없애는 것이 높이를 가장 크게 줄이고, 맥락은 그대로 남는다.
       설명은 폰 두 줄에 말줄임 없이 떨어지는 길이로 쓴다 - 잘린 문장은 실패다. */
    return '<a class="ezpromo-card" href="' + a.href + '">'
      + '<img class="ezpromo-ico" src="' + a.icon + '" alt="" width="96" height="96" loading="lazy" decoding="async">'
      + '<div class="ezpromo-body">'
      + '<div class="ezpromo-name">' + a.name + '<span class="ezpromo-kind"> · ' + a.kind + '</span></div>'
      + '<p class="ezpromo-desc">' + a.desc + '</p>'
      + '</div>'
      + '<span class="ezpromo-go"><span>앱 소개</span>' + ARROW + '</span>'
      + '</a>';
  }

  function slot() {
    var el = document.querySelector('div[data-ez-promo]');   // 태그까지 못박는다
    if (el) return el;
    el = document.createElement('div');
    el.setAttribute('data-ez-promo', '');
    /* 광고 자리가 이미 선언된 페이지면 **그 자리**를 쓴다. 오너가 가리킨 자리가
       바로 거기다: 배너와 광고가 서로 다른 곳에 뜨면 나중에 광고를 켰을 때
       화면이 통째로 달라진다. 자리는 하나여야 한다. */
    var ad = document.querySelector('[data-ez-ad]');
    if (ad && ad.parentNode) { ad.parentNode.insertBefore(el, ad); return el; }
    var nav = document.querySelector('.ez-nav, .ez-nav-bar, header, .nav');
    if (nav && nav.parentNode) nav.parentNode.insertBefore(el, nav.nextSibling);
    else document.body.insertBefore(el, document.body.firstChild);
    return el;
  }

  function start() {
    if (!document.querySelector('meta[name="ez-promo"][content="on"]')) return;
    if (inApp()) return;                 // 앱 화면에서는 그리지 않는다
    if (closedUntil()) return;           // 닫아 둔 기간

    injectCss();
    var host = slot();
    host.className = (host.className ? host.className + ' ' : '') + 'ezpromo';
    /* 한 번에 하나만. 둘을 나란히 세우면 높이가 두 배가 되고, 읽는 사람은
       무엇을 먼저 볼지 정하느라 둘 다 안 본다. 페이지를 열 때마다 무작위로
       고르면 두 앱이 고르게 노출된다. */
    /* 95항 - 맨 위에 Long Time 설치 권유가 이미 떠 있으면 같은 앱을 또 권하지
       않는다. 한 화면에서 같은 앱을 두 번 권하면 배너가 둘 다 죽는다.
       설치 권유는 모바일에서만 뜨므로(사파리는 애플 배너, 그 외 iOS·안드로이드는
       자체 배너), PC 에서는 두 앱이 그대로 번갈아 나온다 - 거기엔 중복이 없다.
       판정은 ez-app-banner.js 가 내보내는 값 하나만 믿는다(단일 출처). */
    var pool = window.ezAppInstallShown
      ? APPS.filter(function (a) { return a.href !== '/longtime/'; })
      : APPS;
    if (!pool.length) return;                       // 걸러서 남는 게 없으면 안 그린다

    var pick = pool[Math.floor(Math.random() * pool.length)];
    host.innerHTML = cardHtml(pick)
      + '<button type="button" class="ezpromo-x" aria-label="배너 닫기">&times;</button>';
    host.querySelector('.ezpromo-x').addEventListener('click', function () {
      lsSet(CLOSE_KEY, String(Date.now() + CLOSE_DAYS * 864e5));
      host.remove();
    });
  }

  /* ez-app-banner.js 가 window.ezInAppWebview 를 정의하는데 그 파일은 head 에서
     먼저 돈다(71항). 그래도 순서를 보장할 수 없는 진입 경로가 있어 DOM 준비 뒤에
     시작한다 - 판정 함수가 이미 서 있을 때 묻는다. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
