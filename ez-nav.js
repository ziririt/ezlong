/**
 * ez-nav.js — EZLONG 글로벌 네비게이션 공유 스크립트
 * 사용법: <body> 직후 <script src="/ez-nav.js"></script>
 * - ez-design.css 가 먼저 로드되어 있어야 합니다.
 * - PC: 수평 스크롤 칩 메뉴
 * - 모바일: 현재 페이지 칩 탭 → 풀스크린 오버레이 전체 메뉴
 *
 * [2026-06-14 v3] document.write 완전 제거 — DOM API 전용
 * document.write + appendChild 혼용 시 HTML 파서가 </nav>를
 * 처리하기 전에 appendChild가 실행되어 menu가 nav 안으로 삽입되는
 * 파서 버그 확인. createElement + insertBefore 방식으로 교체.
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
  var desktopLinksHTML = '';
  var mobileItemsHTML  = '';

  for (var i = 0; i < links.length; i++) {
    var href     = links[i][0];
    var shortLbl = links[i][1];
    var fullLbl  = links[i][2];
    var active   = (p === href) || (p === href.slice(1));

    if (active) activeShort = shortLbl;

    desktopLinksHTML +=
      '<a href="' + href + '" class="ez-nav-svc-link' + (active ? ' active' : '') + '">' +
        shortLbl +
      '</a>';

    mobileItemsHTML +=
      '<a href="' + href + '" class="ez-mob-item' + (active ? ' active' : '') + '">' +
        fullLbl +
      '</a>';
  }

  /* ── 1. <nav> 생성 ── */
  var nav = document.createElement('nav');
  nav.className = 'ez-nav';
  nav.id = 'ez-nav';
  nav.setAttribute('aria-label', '글로벌 네비게이션');
  nav.innerHTML =
    '<div class="ez-nav-inner">' +
      '<a href="/" class="ez-nav-logo" aria-label="EZLONG 홈">' +
        '<picture>' +
          '<source srcset="/logo-darkmode.png" media="(prefers-color-scheme: dark)">' +
          '<img src="/logo.png" alt="EZLONG">' +
        '</picture>' +
      '</a>' +
      '<div class="ez-nav-svc-links">' + desktopLinksHTML + '</div>' +
      '<button class="ez-mob-toggle" id="ez-mob-toggle" ' +
             'onclick="ezNavToggle()" aria-expanded="false" aria-haspopup="true">' +
        '<span class="ez-mob-toggle-label">' + activeShort + '</span>' +
        '<span class="ez-mob-toggle-arrow">&#9662;</span>' +
      '</button>' +
    '</div>';

  /* ── 2. <div class="ez-mob-menu"> 생성 — nav와 완전 분리 ── */
  var mobMenu = document.createElement('div');
  mobMenu.className = 'ez-mob-menu';
  mobMenu.id = 'ez-mob-menu';
  mobMenu.setAttribute('aria-hidden', 'true');
  mobMenu.innerHTML = mobileItemsHTML;

  /* ── 3. 현재 스크립트 태그 바로 앞에 nav, 그 다음 mobMenu 삽입 ──
     document.write 없이 현재 스크립트 위치(currentScript)를
     기준점으로 삼아 insertBefore로 정확한 위치에 배치. */
  var scriptEl = document.currentScript;
  var parent   = scriptEl ? scriptEl.parentNode : document.body;
  var ref      = scriptEl ? scriptEl.nextSibling : null;

  parent.insertBefore(nav, ref);
  parent.insertBefore(mobMenu, ref);  /* nav 다음에, 페이지 본문보다 앞에 */

  /* ── 4. 토글 함수 — 전역 등록 ── */
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
