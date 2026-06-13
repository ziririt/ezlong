/**
 * ez-nav.js — EZLONG 글로벌 네비게이션 공유 스크립트
 * 사용법: <script src="/ez-nav.js"></script>
 * - ez-design.css 가 먼저 로드되어 있어야 합니다.
 * - 현재 페이지 URL을 기준으로 active 클래스를 자동 적용합니다.
 */
(function () {
  var links = [
    ['/atmr-dashboard.html',        '스윙 시그널'],
    ['/chart-analysis.html',        'AI 차트분석'],
    ['/analyst-reports.html',       '목표주가'],
    ['/market-cycle.html',          'Market Cycle'],
    ['/dca-simulator.html',         'DCA 시뮬레이터'],
    ['/portfolio-manager.html',     '포트폴리오'],
    ['/tax-account-simulator.html', '절세 계좌'],
    ['/compound-calculator.html',   '복리 계산기'],
    ['/retirement-calculator.html', '은퇴 계산기'],
    ['/backtest.html',              '백테스트'],
    ['/risk-diagnostic.html',       '투자성향'],
    ['/auto-dca-guide.html',        'DCA 가이드']
  ];

  var p = window.location.pathname;

  var navLinks = '';
  for (var i = 0; i < links.length; i++) {
    var href  = links[i][0];
    var label = links[i][1];
    var isActive = (p === href) || (p === href.slice(1));
    navLinks += '<a href="' + href + '" class="ez-nav-svc-link' + (isActive ? ' active' : '') + '">' + label + '</a>';
  }

  var html =
    '<nav class="ez-nav" aria-label="글로벌 네비게이션">' +
      '<div class="ez-nav-inner">' +
        '<a href="/" class="ez-nav-logo" aria-label="EZLONG 홈">' +
          '<picture>' +
            '<source srcset="logo-darkmode.png" media="(prefers-color-scheme: dark)">' +
            '<img src="logo.png" alt="EZLONG">' +
          '</picture>' +
        '</a>' +
        '<div class="ez-nav-svc-links">' + navLinks + '</div>' +
      '</div>' +
    '</nav>';

  document.write(html);
})();
