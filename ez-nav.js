/**
 * ez-nav.js — EZLONG 글로벌 네비게이션 공유 스크립트
 * 사용법: <script src="/ez-nav.js"></script>
 * - ez-design.css 가 먼저 로드되어 있어야 합니다.
 * - PC: 수평 스크롤 칩 메뉴
 * - 모바일: 현재 페이지 칩 탭 → 풀스크린 오버레이 전체 메뉴
 *
 * [2026-06-14 수정] ez-mob-menu를 document.body.appendChild()로 주입
 * 이유: <nav>에 backdrop-filter가 있으면 iOS Safari 등에서
 *       position:fixed 자식이 viewport가 아닌 부모 크기로 갇히는 버그 발생.
 *       body 직계 자식으로 주입하면 containing block 문제 원천 차단.
 */
(function () {
  /* [href, 짧은 이름(PC칩), 긴 이름(모바일 오버레이)] */
  var links = [
    ['/atmr-dashboard.html',        '스윙 시그널',    "스윙 트레이더를 위한 '스윙 시그널'"],
    ['/chart-analysis.html',        'AI 차트분석',    'AI 차트 분석'],
    ['/analyst-reports.html',       '월가 목표주가',  '월가 목표주가'],
    ['/market-cycle.html',          '마켓 사이클',    '마켓 사이클 모니터'],
    ['/dca-simulator.html',         'DCA 시뮬레이터', 'DCA 복리 시뮬레이터'],
    ['/portfolio-manager.html',     'AI 포트폴리오',  '투자성향별 AI 포트폴리오'],
    ['/tax-account-simulator.html', '절세 계좌',      '절세 계좌 시뮬레이터'],
    ['/compound-calculator.html',   '복리 계산기',    '복리 계산기'],
    ['/retirement-calculator.html', '은퇴 계산기',    '은퇴목표역산 투자액 시뮬레이터'],
    ['/backtest.html',              '백테스트',       '몬테카를로 포트폴리오 백테스트'],
    ['/risk-diagnostic.html',       '투자성향 진단',  '투자성향 자가진단'],
    ['/auto-dca-guide.html',        '자동화 가이드',  '투자 자동화 가이드']
  ];

  var p = window.location.pathname;
  var activeShort = '메뉴';
  var desktopLinks = '';
  var mobileItems  = '';

  for (var i = 0; i < links.length; i++) {
    var href      = links[i][0];
    var shortLbl  = links[i][1];
    var fullLbl   = links[i][2];
    var isActive  = (p === href) || (p === href.slice(1));

    if (isActive) activeShort = shortLbl;

    desktopLinks +=
      '<a href="' + href + '" class="ez-nav-svc-link' + (isActive ? ' active' : '') + '">' +
        shortLbl +
      '</a>';

    mobileItems +=
      '<a href="' + href + '" class="ez-mob-item' + (isActive ? ' active' : '') + '">' +
        fullLbl +
      '</a>';
  }

  /* ── 1. nav HTML만 document.write ── */
  document.write(
    '<nav class="ez-nav" id="ez-nav" aria-label="글로벌 네비게이션">' +
      '<div class="ez-nav-inner">' +
        '<a href="/" class="ez-nav-logo" aria-label="EZLONG 홈">' +
          '<picture>' +
            '<source srcset="/logo-darkmode.png" media="(prefers-color-scheme: dark)">' +
            '<img src="/logo.png" alt="EZLONG">' +
          '</picture>' +
        '</a>' +
        '<div class="ez-nav-svc-links">' + desktopLinks + '</div>' +
        '<button class="ez-mob-toggle" id="ez-mob-toggle" ' +
               'onclick="ezNavToggle()" aria-expanded="false" aria-haspopup="true">' +
          '<span class="ez-mob-toggle-label">' + activeShort + '</span>' +
          '<span class="ez-mob-toggle-arrow">&#9662;</span>' +
        '</button>' +
      '</div>' +
    '</nav>'
  );

  /* ── 2. 모바일 오버레이 메뉴는 document.body에 직접 appendChild ──
     backdrop-filter를 가진 <nav> 의 자식이 되지 않도록 body 직계로 주입.
     position:fixed 가 항상 viewport 기준으로 동작하게 됨. */
  function injectMobileMenu() {
    if (document.getElementById('ez-mob-menu')) return;
    var el = document.createElement('div');
    el.className = 'ez-mob-menu';
    el.id = 'ez-mob-menu';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = mobileItems;
    document.body.appendChild(el);
  }

  /* ez-nav.js는 <body> 직후에 로드되므로 document.body는 이미 존재.
     즉시 실행하되, 혹시 모를 타이밍 문제를 DOMContentLoaded로 보완. */
  if (document.body) {
    injectMobileMenu();
  } else {
    document.addEventListener('DOMContentLoaded', injectMobileMenu);
  }

  /* ── 3. 토글 함수 — 전역 등록 ── */
  window.ezNavToggle = function () {
    var menu = document.getElementById('ez-mob-menu');
    var btn  = document.getElementById('ez-mob-toggle');
    if (!menu || !btn) return;
    var opening = !menu.classList.contains('open');
    menu.classList.toggle('open', opening);
    btn.classList.toggle('open', opening);
    btn.setAttribute('aria-expanded', opening ? 'true' : 'false');
    document.body.style.overflow = opening ? 'hidden' : '';
  };
})();
