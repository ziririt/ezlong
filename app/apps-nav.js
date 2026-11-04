/**
 * apps-nav.js: EZLONG 앱 글로벌 헤더 (2026-11-04 신설)
 *
 * 앱 소개 페이지 맨 위에 얇은 띠를 하나 얹는다. 왼쪽은 앱 모음(/app/)으로 가는
 * 이름표, 오른쪽은 앱 아이콘 줄. 지금 보고 있는 앱은 칠해서 보여 준다.
 *
 * 앱을 새로 더할 때는 아래 APPS 에 한 줄만 더한다. 이 파일을 부르는 모든 페이지
 * (앱 모음, 각 앱 소개 페이지)의 헤더가 함께 바뀐다. 앱 모음 페이지(/app/)의
 * 카드는 검색엔진이 읽어야 하므로 HTML 에 따로 적는다 — 카드도 같이 더할 것.
 *
 * 쓰는 법: <body> 바로 다음 줄에
 *   <script src="/app/apps-nav.js"></script>
 * 다른 도메인(깃허브 페이지 등)에서는
 *   <script src="https://ezlong.com/app/apps-nav.js"></script>
 * 언어: 문서의 lang 을 보고 한국어·영어·일본어·중국어 이름을 쓴다(그 밖은 영어). 페이지가
 * 나중에 lang 을 바꾸면(send.ezlong.com 의 언어 고르기) 이름도 따라 바뀐다.
 * 앱 모음 페이지처럼 자기 머리띠가 없는 페이지는 data-sticky="1" 을 붙여 위에 고정한다.
 * 자기 머리띠(.nav)가 위에 붙는 소개 페이지는 고정하지 않는다 — 애플 사이트처럼
 * 전체 띠는 스크롤과 함께 올라가고, 그 앱의 띠만 위에 남는다. 둘 다 고정하면 겹친다.
 *
 * ezlong.com 본체의 ez-nav.js(투자 도구 헤더)와는 다른 파일이다. 섞지 않는다.
 */
(function () {
  'use strict';
  if (window.__ezAppsNav) return;
  window.__ezAppsNav = true;

  var me = document.currentScript;
  if (!me || !me.parentNode) return;

  // 앱 웹뷰 안에서는 띄우지 않는다. 판정은 ez-app-banner.js 한 곳에만 있다(59항).
  try {
    if (typeof window.ezInAppWebview === 'function' && window.ezInAppWebview()) return;
  } catch (e) {}

  // 이 파일이 놓인 곳을 기준으로 아이콘 주소를 만든다. 다른 도메인에서 불러도 깨지지 않는다.
  var BASE = 'https://ezlong.com';
  try { BASE = new URL(me.src, location.href).origin; } catch (e) {}

  /* ── 앱 목록 — 여기에 한 줄 더하면 모든 헤더에 나타난다 ─────────────────
     here: 이 앱의 페이지로 볼 주소 조각(호스트+경로 앞부분). 지금 칸을 칠할 때 쓴다. */
  // name: 한국어 이름. t: 다른 언어 이름(없으면 name). 앱 이름은 스토어 등록명을 따른다.
  var APPS = [
    { id: 'insightimes', name: 'Insight Times', href: 'https://insightimes.com/',
      icon: '/app/icons/icon-it.jpg', here: ['insightimes.com'] },
    { id: 'longtime', name: 'Long Time', href: '/longtime/',
      icon: '/app/icons/icon-lt.jpg', here: ['/longtime'] },
    { id: 'skybluenote', name: 'Skyblue Note', href: '/skybluenote/',
      icon: '/app/icons/icon-sn.jpg', here: ['/skybluenote'] },
    { id: 'batterylife', name: '배터리 라이프', t: { en: 'Battery Life', ja: 'Battery Life', zh: 'Battery Life' }, href: 'https://ziririt.github.io/batterylife-site/',
      icon: '/app/icons/icon-bl.jpg', here: ['ziririt.github.io/batterylife-site'] },
    { id: 'phototime', name: '포토 타임', t: { en: 'Photo Time', ja: 'Photo Time', zh: 'Photo Time' }, href: 'https://ziririt.github.io/phototime-site/',
      icon: '/app/icons/icon-pt.jpg', here: ['ziririt.github.io/phototime-site'] },
    { id: 'longlong', name: 'LongLong', href: '/app/#longlong',
      icon: '/app/icons/icon-ll.jpg', here: [] },
    { id: 'send', name: '초간단 파일공유', t: { en: 'Quick File Share', ja: 'かんたんファイル共有', zh: '极简文件分享' }, href: 'https://send.ezlong.com/',
      icon: '/app/icons/icon-sd.svg', here: ['send.ezlong.com'] }
  ];

  var HOME = { ko: 'EZLONG</b> 앱', en: 'EZLONG</b> Apps', ja: 'EZLONG</b> アプリ', zh: 'EZLONG</b> 应用' };
  var LABEL = { ko: 'EZLONG 앱', en: 'EZLONG Apps', ja: 'EZLONG アプリ', zh: 'EZLONG 应用' };
  function lang() {
    // 깃허브 소개 사이트는 lang 은 en 으로 두고 #ko 같은 해시로 언어를 고른다. 해시를 먼저 본다.
    var h = (location.hash || '').slice(1).toLowerCase();
    if (HOME[h]) return h;
    var l = (document.documentElement.getAttribute('lang') || 'ko').slice(0, 2).toLowerCase();
    return HOME[l] ? l : 'en';
  }
  function nameOf(app, l) {
    return (l !== 'ko' && app.t && app.t[l]) || app.name;
  }

  function abs(u) {
    return /^https?:/.test(u) ? u : BASE + u;
  }

  // 지금 어느 앱 페이지인가. 앱 모음(/app/)이면 이름표를 칠한다.
  var spot = location.host + location.pathname;
  var onHub = /(^|\.)ezlong\.com$|web\.app$|^localhost|^127\./.test(location.hostname) &&
              /^\/app(\/|$)/.test(location.pathname);
  var current = '';
  if (!onHub) {
    for (var i = 0; i < APPS.length && !current; i++) {
      for (var j = 0; j < APPS[i].here.length; j++) {
        var h = APPS[i].here[j];
        if (h.charAt(0) === '/' ? location.pathname.indexOf(h) === 0 : spot.indexOf(h) === 0) {
          current = APPS[i].id; break;
        }
      }
    }
  }
  // 같은 사이트 안 링크는 상대 주소로 둔다(ezlong.com·web.app 어느 쪽에서 열어도 그 자리에서 움직이게).
  var sameSite = location.origin === BASE;

  /* ── 모양 ───────────────────────────────────────────────────────────────
     글자는 14px 아래로 내리지 않는다(CLAUDE.md 5절). 색은 소개 페이지마다 바탕이
     달라도 어울리게 무채색 반투명 + 흐림으로 깐다. */
  // 남의 지면(깃허브 페이지, 웹진, 파일공유)에 얹히므로 그쪽 CSS 가 새어 들지 않게
  // 모든 선택자를 div.ezapps 로 묶고(구체성 0,2,1 이상) 글자·여백·배경을 하나하나 못박는다.
  // 2026-11-04 사고: 파일공유의 a{font-size}, 포토 타임 사이트의 nav a{배경} 이 그대로 묻어났다.
  // 틀을 <nav> 가 아니라 <div role="navigation"> 으로 만드는 것도 같은 까닭이다 — 배터리 라이프
  // 사이트의 언어 고르기가 document.querySelectorAll("nav a") 로 aria-current 를 지워 버렸다.
  var R = 'div.ezapps';
  var css = [
    R + ',' + R + ' *{box-sizing:border-box;margin:0;padding:0;border:0;background:none;float:none;' +
      'max-width:none;min-height:0;text-transform:none;text-decoration:none;text-shadow:none;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Noto Sans KR",system-ui,sans-serif;' +
      'font-style:normal;line-height:1;letter-spacing:0;-webkit-font-smoothing:antialiased}',
    R + '{display:block;position:relative;z-index:60;width:100%;' +
      '--ea-ink:#1b222c;--ea-sub:#4a5563;--ea-line:rgba(15,23,42,.10);' +
      '--ea-bg:rgba(255,255,255,.78);--ea-on:rgba(37,99,235,.11);--ea-on-ink:#1d4ed8;--ea-brand:#2563EB;' +
      'background:var(--ea-bg);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);' +
      'border-bottom:1px solid var(--ea-line);font-size:14px;font-weight:600;color:var(--ea-ink)}',
    '@media (prefers-color-scheme:dark){' + R + '{' +
      '--ea-ink:#e9eef5;--ea-sub:#aab4c2;--ea-line:rgba(255,255,255,.09);' +
      '--ea-bg:rgba(14,18,26,.80);--ea-on:rgba(79,195,247,.16);--ea-on-ink:#8fd8fb;--ea-brand:#3B82F6}}',
    R + '.ezapps-sticky{position:sticky;top:0}',
    R + ' .ezapps-in{max-width:1200px;margin:0 auto;padding:0 12px 0 16px;display:flex;align-items:center;gap:6px;height:52px}',
    R + ' a{color:inherit;-webkit-tap-highlight-color:transparent;font-size:14px;font-weight:600;border-radius:999px;box-shadow:none}',
    R + ' .ezapps-home{flex:none;display:flex;align-items:center;gap:6px;height:36px;padding:0 10px 0 2px;' +
      'color:var(--ea-ink);font-size:15px;font-weight:800;letter-spacing:-.01em;border-radius:10px;white-space:nowrap;background:none}',
    R + ' .ezapps-home b{color:var(--ea-brand);font-size:15px;font-weight:800}',
    R + ' .ezapps-sep{display:block;flex:none;width:1px;height:20px;background:var(--ea-line);margin:0 4px}',
    R + ' .ezapps-scroll{display:block;flex:1;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;' +
      '-webkit-mask-image:linear-gradient(to right,#000 calc(100% - 28px),transparent);' +
      'mask-image:linear-gradient(to right,#000 calc(100% - 28px),transparent)}',
    R + ' .ezapps-scroll::-webkit-scrollbar{display:none}',
    R + ' ul{list-style:none;padding:0 24px 0 0;display:flex;gap:2px;width:max-content}',
    R + ' li{display:block;list-style:none}',
    R + ' li::before,' + R + ' li::marker{content:none;display:none}',
    R + ' a.ezapps-a{display:flex;align-items:center;gap:7px;height:36px;padding:0 11px 0 6px;' +
      'color:var(--ea-sub);background:none;white-space:nowrap;transition:background-color .15s ease,color .15s ease,transform .1s ease}',
    R + ' a.ezapps-a img{display:block;flex:none;width:24px;height:24px;min-width:24px;max-width:24px;border-radius:6px;' +
      'box-shadow:0 0 0 1px rgba(0,0,0,.06);opacity:1;visibility:visible}',
    R + ' a.ezapps-a span{display:inline;font-size:14px;font-weight:600;color:inherit}',
    '@media (hover:hover){' + R + ' a.ezapps-a:hover{color:var(--ea-ink);background:var(--ea-on)}}',
    R + ' a.ezapps-a:active,' + R + ' a.ezapps-home:active{transform:scale(.97)}',
    R + ' a.ezapps-a[aria-current]{color:var(--ea-on-ink);background:var(--ea-on)}',
    R + ' a:focus-visible{outline:2px solid var(--ea-brand);outline-offset:2px}',
    '@media (prefers-reduced-motion:reduce){' + R + ' a.ezapps-a{transition:none}' + R + ' a.ezapps-a:active,' + R + ' a.ezapps-home:active{transform:none}}',
    '@media (prefers-reduced-transparency:reduce){' + R + '{background:#fff;-webkit-backdrop-filter:none;backdrop-filter:none}}',
    '@media (prefers-reduced-transparency:reduce) and (prefers-color-scheme:dark){' + R + '{background:#0e121a}}',
    '@media print{' + R + '{display:none}}'
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  /* ── 그리기 ─────────────────────────────────────────────────────────── */
  var nav = document.createElement('div');
  nav.className = 'ezapps' + (me.getAttribute('data-sticky') === '1' ? ' ezapps-sticky' : '');
  var L = lang();
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', LABEL[L]);

  var inner = document.createElement('div');
  inner.className = 'ezapps-in';

  var home = document.createElement('a');
  home.className = 'ezapps-home';
  home.href = sameSite ? '/app/' : BASE + '/app/';
  home.innerHTML = '<b>' + HOME[L];
  if (onHub) home.setAttribute('aria-current', 'page');
  inner.appendChild(home);

  var sep = document.createElement('span');
  sep.className = 'ezapps-sep';
  sep.setAttribute('aria-hidden', 'true');
  inner.appendChild(sep);

  var scroll = document.createElement('div');
  scroll.className = 'ezapps-scroll';
  var ul = document.createElement('ul');
  var activeEl = null;
  var spans = [];

  for (var k = 0; k < APPS.length; k++) {
    var app = APPS[k];
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.className = 'ezapps-a';
    a.href = (sameSite && app.href.charAt(0) === '/') ? app.href : abs(app.href);
    var img = document.createElement('img');
    img.src = abs(app.icon);
    img.alt = '';
    img.width = 24; img.height = 24;
    img.decoding = 'async';
    var span = document.createElement('span');
    span.textContent = nameOf(app, L);
    spans.push([span, app]);
    a.appendChild(img);
    a.appendChild(span);
    if (app.id === current) { a.setAttribute('aria-current', 'page'); activeEl = a; }
    li.appendChild(a);
    ul.appendChild(li);
  }
  scroll.appendChild(ul);
  inner.appendChild(scroll);
  nav.appendChild(inner);

  function center() {
    // 지금 앱이 줄 밖에 있으면 가운데로 당겨 둔다(움직임 없이).
    if (!activeEl) return;
    // 이미 다 보이면 그대로 둔다. 넓은 화면에서 줄이 괜히 밀려 첫 앱이 잘리지 않게.
    var x = activeEl.getBoundingClientRect().left - scroll.getBoundingClientRect().left + scroll.scrollLeft;
    if (x + activeEl.offsetWidth <= scroll.clientWidth - 28) return;
    var left = x - (scroll.clientWidth - activeEl.offsetWidth) / 2;
    if (left > 0) scroll.scrollLeft = left;
  }

  // 스크립트가 body 안(맨 앞)에 있으면 그 자리에 그대로 꽂는다 — 다 읽은 뒤 끼우면 화면이
  // 한 번 밀린다. head 에서 불렸으면 body 가 생기는 대로 맨 앞에 꽂는다.
  if (me.parentNode && me.parentNode !== document.head && document.body && document.body.contains(me)) {
    me.parentNode.insertBefore(nav, me);
    center();
  } else {
    var mount = function () {
      if (!document.body) return;
      document.body.insertBefore(nav, document.body.firstChild);
      center();
    };
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  }

  // 페이지가 나중에 언어를 바꾸면 이름도 바꾼다.
  function relabel() {
      var n = lang();
      if (n === L) return;
      L = n;
      nav.setAttribute('aria-label', LABEL[L]);
      home.innerHTML = '<b>' + HOME[L];
      for (var q = 0; q < spans.length; q++) spans[q][0].textContent = nameOf(spans[q][1], L);
  }
  window.addEventListener('hashchange', relabel);
  try {
    new MutationObserver(relabel)
      .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  } catch (e) {}
})();
