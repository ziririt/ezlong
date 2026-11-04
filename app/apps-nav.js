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
  var APPS = [
    { id: 'insightimes', name: 'Insight Times', href: 'https://insightimes.com/',
      icon: '/app/icons/icon-it.jpg', here: ['insightimes.com'] },
    { id: 'longtime', name: 'Long Time', href: '/longtime/',
      icon: '/app/icons/icon-lt.jpg', here: ['/longtime'] },
    { id: 'skybluenote', name: 'Skyblue Note', href: '/skybluenote/',
      icon: '/app/icons/icon-sn.jpg', here: ['/skybluenote'] },
    { id: 'batterylife', name: '배터리 라이프', href: 'https://ziririt.github.io/batterylife-site/',
      icon: '/app/icons/icon-bl.jpg', here: ['ziririt.github.io/batterylife-site'] },
    { id: 'phototime', name: '포토 타임', href: 'https://ziririt.github.io/phototime-site/',
      icon: '/app/icons/icon-pt.jpg', here: ['ziririt.github.io/phototime-site'] },
    { id: 'longlong', name: 'LongLong', href: '/app/#longlong',
      icon: '/app/icons/icon-ll.jpg', here: [] },
    { id: 'send', name: '초간단 파일공유', href: 'https://send.ezlong.com/',
      icon: '/app/icons/icon-sd.svg', here: ['send.ezlong.com'] }
  ];

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
  var css = [
    '.ezapps{position:relative;z-index:60;',
    '  --ea-ink:#1b222c;--ea-sub:#4a5563;--ea-line:rgba(15,23,42,.10);',
    '  --ea-bg:rgba(255,255,255,.78);--ea-on:rgba(37,99,235,.11);--ea-on-ink:#1d4ed8;--ea-brand:#2563EB;',
    '  background:var(--ea-bg);',
    '  -webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);',
    '  border-bottom:1px solid var(--ea-line);',
    '  font:600 14px/1 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Noto Sans KR",system-ui,sans-serif;',
    '  letter-spacing:0;-webkit-font-smoothing:antialiased}',
    '@media (prefers-color-scheme:dark){.ezapps{',
    '  --ea-ink:#e9eef5;--ea-sub:#aab4c2;--ea-line:rgba(255,255,255,.09);',
    '  --ea-bg:rgba(14,18,26,.80);--ea-on:rgba(79,195,247,.16);--ea-on-ink:#8fd8fb;--ea-brand:#3B82F6}}',
    '.ezapps.ezapps-sticky{position:sticky;top:0}',
    '.ezapps-in{max-width:1080px;margin:0 auto;padding:0 12px 0 16px;display:flex;align-items:center;gap:6px;height:52px}',
    '.ezapps a{color:inherit;text-decoration:none;-webkit-tap-highlight-color:transparent}',
    '.ezapps-home{flex:none;display:flex;align-items:center;gap:7px;padding:8px 10px 8px 2px;',
    '  color:var(--ea-ink);font-weight:800;letter-spacing:-.01em;border-radius:10px;white-space:nowrap}',
    '.ezapps-home b{color:var(--ea-brand);font-weight:800}',
    '.ezapps-home[aria-current]{color:var(--ea-ink)}',
    '.ezapps-sep{flex:none;width:1px;height:20px;background:var(--ea-line);margin:0 4px}',
    '.ezapps-scroll{flex:1;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;',
    '  -webkit-mask-image:linear-gradient(to right,#000 calc(100% - 28px),transparent);',
    '          mask-image:linear-gradient(to right,#000 calc(100% - 28px),transparent)}',
    '.ezapps-scroll::-webkit-scrollbar{display:none}',
    '.ezapps ul{list-style:none;margin:0;padding:0 24px 0 0;display:flex;gap:2px;width:max-content}',
    '.ezapps li{margin:0;padding:0}',
    '.ezapps-a{display:flex;align-items:center;gap:7px;height:36px;padding:0 11px 0 6px;border-radius:999px;',
    '  color:var(--ea-sub);white-space:nowrap;transition:background-color .15s ease,color .15s ease,transform .1s ease}',
    '.ezapps-a img{width:24px;height:24px;border-radius:6px;display:block;flex:none;',
    '  box-shadow:0 0 0 1px rgba(0,0,0,.06)}',
    '@media (hover:hover){.ezapps-a:hover{color:var(--ea-ink);background:var(--ea-on)}}',
    '.ezapps-a:active,.ezapps-home:active{transform:scale(.97)}',
    '.ezapps-a[aria-current]{color:var(--ea-on-ink);background:var(--ea-on)}',
    '.ezapps a:focus-visible{outline:2px solid var(--ea-brand);outline-offset:2px}',
    '@media (prefers-reduced-motion:reduce){.ezapps-a{transition:none}.ezapps-a:active,.ezapps-home:active{transform:none}}',
    '@media (prefers-reduced-transparency:reduce){.ezapps{background:#fff;-webkit-backdrop-filter:none;backdrop-filter:none}}',
    '@media (prefers-reduced-transparency:reduce) and (prefers-color-scheme:dark){.ezapps{background:#0e121a}}',
    '@media print{.ezapps{display:none}}'
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  /* ── 그리기 ─────────────────────────────────────────────────────────── */
  var nav = document.createElement('nav');
  nav.className = 'ezapps' + (me.getAttribute('data-sticky') === '1' ? ' ezapps-sticky' : '');
  nav.setAttribute('aria-label', 'EZLONG 앱');

  var inner = document.createElement('div');
  inner.className = 'ezapps-in';

  var home = document.createElement('a');
  home.className = 'ezapps-home';
  home.href = sameSite ? '/app/' : BASE + '/app/';
  home.innerHTML = '<b>EZLONG</b> 앱';
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
    span.textContent = app.name;
    a.appendChild(img);
    a.appendChild(span);
    if (app.id === current) { a.setAttribute('aria-current', 'page'); activeEl = a; }
    li.appendChild(a);
    ul.appendChild(li);
  }
  scroll.appendChild(ul);
  inner.appendChild(scroll);
  nav.appendChild(inner);

  // 스크립트가 놓인 자리(=body 맨 앞)에 그대로 꽂는다. 다 읽은 뒤 끼우면 화면이 한 번 밀린다.
  me.parentNode.insertBefore(nav, me);

  // 지금 앱이 줄 밖에 있으면 가운데로 당겨 둔다(움직임 없이).
  if (activeEl) {
    var left = activeEl.offsetLeft - (scroll.clientWidth - activeEl.offsetWidth) / 2;
    if (left > 0) scroll.scrollLeft = left;
  }
})();
