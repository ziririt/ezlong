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
  var scriptEl = document.currentScript;

  /* ── 다국어 감지 (2026-08-04) — 같은 스크립트가 경로에 따라 해당 언어 메뉴를 그린다.
     메뉴 단일 출처 원칙을 en·ja·zh·es·pt 전 서브사이트로 확장. 각 언어 폴더에
     **실존하는 페이지만** 나열한다(없는 페이지로 보내면 404). 절세 계좌 등 한국
     전용 도구는 en에서만 제외가 아니라 전 언어에서 제외. */
  var LANG = (function () {
    var m = /^\/(en|ja|zh|es|pt)\//.exec(window.location.pathname);
    return m ? m[1] : 'ko';
  })();
  var IS_EN = LANG !== 'ko';   /* 비한국어 = 로컬라이즈 메뉴 경로 */

  /* 언어별 실존 도구 8종(계산기류) + 랜딩 페이지. ja만 자동화 가이드·절세 계좌 보유. */
  function _localLinks(lang, L) {
    var p = '/' + lang + '/';
    var a = [
      [p + 'atmr-dashboard.html', L.swing,    L.swing],
      /* 2026-08-04(성동님 지적): 한국어·영문과 달리 스윙이 한 덩어리로 남아 있었다.
         다만 ja/zh/es/pt의 /{lang}/atmr-dashboard.html은 탭이 없는 SEO 랜딩 페이지라
         #swing-strategy·#top9 해시가 아무 동작도 하지 않는다. 그래서 이 둘만은 실제로
         동작하는 영문 대시보드로 보낸다 — 성동님 원칙("외국인이 굳이 한국어 웹을 볼
         필요가 없잖아")에 따라 한국어판이 아니라 영문판이 목적지다.
         나중에 해당 언어 대시보드가 실제로 생기면 p + '...#top9' 로 되돌릴 것. */
      ['/en/atmr-dashboard.html#swing-strategy', L.strategy, L.strategy],
      ['/en/atmr-dashboard.html#top9',           L.top9,     L.top9],
      [p + 'market-vs.html',      L.vs,       L.vs],
      [p + 'stocks.html',         L.prices,   L.prices],
      [p + 'chart-analysis.html', L.chart,    L.chart],
      [p + 'analyst-reports.html', L.targets, L.targets],
      [p + 'market-cycle.html',   L.cycle,    L.cycle],
      [p + 'dca-simulator.html',  L.dca,      L.dca],
      [p + 'portfolio-manager.html', L.folio, L.folio],
      [p + 'compound-calculator.html', L.compound, L.compound],
      [p + 'retirement-calculator.html', L.retire, L.retire],
      [p + 'backtest.html',       L.backtest, L.backtest],
      [p + 'risk-diagnostic.html', L.risk,    L.risk],
      [p + 'stock-personality-quiz.html', L.quiz, L.quiz],
      [p + 'life-balance-game.html', L.game,  L.game]
    ];
    if (lang === 'ja') a.push([p + 'auto-dca-guide.html', L.autoGuide, L.autoGuide]);
    return a;
  }

  var LANG_LABELS = {
    ja: { swing: 'スイングシグナル', strategy: 'スイング戦略', top9: 'TOP9集中分析', vs: '強気vs弱気', prices: '株価情報', chart: 'AIチャート分析',
          targets: '目標株価', cycle: 'マーケットサイクル', dca: 'DCAシミュレーター',
          folio: 'AIポートフォリオ', compound: '複利計算機', retire: '退職計算機',
          backtest: 'バックテスト', risk: '投資性向診断', quiz: '投資タイプ診断',
          game: 'バランスゲーム', autoGuide: '自動積立ガイド' },
    zh: { swing: '波段信号', strategy: '波段策略', top9: 'TOP9集中分析', vs: '多空对比', prices: '股价信息', chart: 'AI图表分析',
          targets: '目标股价', cycle: '市场周期', dca: '定投模拟器',
          folio: 'AI投资组合', compound: '复利计算器', retire: '退休计算器',
          backtest: '回测', risk: '风险偏好测评', quiz: '投资类型测试', game: '平衡游戏' },
    es: { swing: 'Señal de Swing', strategy: 'Estrategia Swing', top9: 'TOP9 a Fondo', vs: 'Alcista vs Bajista', prices: 'Precios', chart: 'Análisis IA',
          targets: 'Precio Objetivo', cycle: 'Ciclo de Mercado', dca: 'Simulador DCA',
          folio: 'Cartera IA', compound: 'Interés Compuesto', retire: 'Calc. Jubilación',
          backtest: 'Backtest', risk: 'Perfil de Riesgo', quiz: 'Tipo de Inversor',
          game: 'Juego de Equilibrio' },
    pt: { swing: 'Sinal de Swing', strategy: 'Estratégia Swing', top9: 'TOP9 a Fundo', vs: 'Alta vs Baixa', prices: 'Preços', chart: 'Análise IA',
          targets: 'Preço-Alvo', cycle: 'Ciclo de Mercado', dca: 'Simulador DCA',
          folio: 'Carteira IA', compound: 'Juros Compostos', retire: 'Calc. Aposentadoria',
          backtest: 'Backtest', risk: 'Perfil de Risco', quiz: 'Tipo de Investidor',
          game: 'Jogo de Equilíbrio' }
  };

  var linksEN = [
    ['/en/atmr-dashboard.html',        'Swing Signal',    'Swing Signal Dashboard'],
    ['/en/atmr-dashboard.html#swing-strategy', 'Swing Strategy', 'Swing Strategy — 3-3-4 Rule'],
    ['/en/atmr-dashboard.html#top9',   'TOP9 Deep Dive',  'TOP9 Deep Dive — Big Tech'],
    ['/en/market-vs.html',             'Bull vs Bear',    'Bull vs Bear — AI Market Read'],
    ['/en/stocks.html',                'Live Prices',     'Simple Live Prices'],
    ['/en/chart-analysis.html',        'AI Chart Analysis', 'AI Chart Analysis'],
    ['/en/analyst-reports.html',       'Price Targets',   'Wall Street Price Targets'],
    ['/en/market-cycle.html',          'Market Cycle',    'Market Cycle Monitor'],
    ['/en/today-chart.html',           "Today's Chart",   "Today's Chart"],
    ['/en/dca-simulator.html',         'DCA Simulator',   'DCA Compound Simulator'],
    ['/en/portfolio-manager.html',     'AI Portfolio',    'AI Portfolio by Risk Profile'],
    ['/en/compound-calculator.html',   'Compound Calc',   'Compound Interest Calculator'],
    ['/en/retirement-calculator.html', 'Retirement Calc', 'Retirement Target Calculator'],
    ['/en/backtest.html',              'Backtest',        'Monte Carlo Portfolio Backtest'],
    ['/en/risk-diagnostic.html',       'Risk Profile',    'Investor Risk Self-Check'],
    ['/en/stock-personality-quiz.html','Investor Type',   'Investor Type by MBTI'],
    ['/en/auto-dca-guide.html',        'Automation Guide','Investing Automation Guide'],
    ['/en/life-balance-game.html',     'Balance Game',    'Balance Game: My Life']
  ];

  /* [href, 짧은 이름(PC칩), 긴 이름(모바일 오버레이)]
     2026-08-04: 첫 항목을 3개로 분리 (성동님 지시) — 스윙 시그널 대시보드의
     3개 탭(시그널/전략/TOP9)에 해시 딥링크로 각각 직접 진입. 활성 판정은
     아래 루프에서 pathname+hash 조합으로 처리한다. */
  var linksKR = [
    ['/atmr-dashboard.html',        '스윙 시그널',    "스윙 트레이더를 위한 '스윙 시그널'"],
    ['/atmr-dashboard.html#swing-strategy', '스윙 전략', '스윙 전략 — 3-3-4 원칙 · 레버리지 가이드'],
    ['/atmr-dashboard.html#top9',   'TOP9 집중분석',  'TOP9 집중분석 — 테슬라·엔비디아 등 빅테크 9종 <span style="display:inline-block;background:#ff3b30;color:#fff;font-size:14px;font-weight:800;border-radius:6px;padding:0 6px;margin-left:4px;vertical-align:middle;">NEW</span>'],
    ['/market-vs.html',             '긍정vs부정',     '긍정 vs 부정 몇대몇 — AI 시황 분석'],
    ['/stocks.html',                '심플 주가',      '심플 주가 정보'],
    ['/chart-analysis.html',        'AI 차트분석',    'AI 차트 분석'],
    ['/analyst-reports.html',       '월가 목표주가',  '월가 목표주가'],
    ['/market-cycle.html',          '마켓 사이클',    '하락장 변곡점 감시'],
    ['/dca-simulator.html',         'DCA 시뮬레이터', 'DCA 복리 시뮬레이터'],
    ['/portfolio-manager.html',     'AI 포트폴리오',  '투자성향별 AI 포트폴리오'],
    ['/tax-account-simulator.html', '절세 계좌',      '절세 계좌 시뮬레이터'],
    ['/compound-calculator.html',   '복리 계산기',    '복리 계산기'],
    ['/retirement-calculator.html', '은퇴 계산기',    '은퇴목표역산 투자액 시뮬레이터'],
    ['/backtest.html',              '백테스트',       '몬테카를로 포트폴리오 백테스트'],
    ['/risk-diagnostic.html',       '투자성향 진단',  '투자성향 자가진단'],
    ['/stock-personality-quiz.html','투자유형 진단',  'MBTI로 찾는 맞춤 투자 포트폴리오'],
    ['/auto-dca-guide.html',        '자동화 가이드',  '투자 자동화 가이드'],
    ['/life-balance-game.html',     '밸런스게임:마이 라이프', "밸런스게임: 마이 라이프"]
  ];

  var p = window.location.pathname;
  var links = LANG === 'ko' ? linksKR
            : LANG === 'en' ? linksEN
            : _localLinks(LANG, LANG_LABELS[LANG]);
  var MENU_WORD = { ko: '메뉴', en: 'Menu', ja: 'メニュー', zh: '菜单', es: 'Menú', pt: 'Menu' };
  var activeShort = MENU_WORD[LANG] || 'Menu';
  var desktopLinksHTML = '';
  var mobileItemsHTML  = '';

  /* 스윙 대시보드 탭 해시들 — 이 중 하나가 떠 있으면 '스윙 시그널' 기본 항목이
     아니라 해당 탭 항목을 활성으로 표시 (#tsla-nvda는 #top9의 구 별칭) */
  var swingTabHashes = ['#swing-strategy', '#top9', '#tsla-nvda', '#kings', '#tesla-nvidia'];
  var curHash = window.location.hash || '';

  for (var i = 0; i < links.length; i++) {
    var href     = links[i][0];
    var shortLbl = links[i][1];
    var fullLbl  = links[i][2];
    var hashIdx  = href.indexOf('#');
    var hrefPath = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
    var hrefHash = hashIdx >= 0 ? href.slice(hashIdx) : '';
    var onPath   = (p === hrefPath) || (p === hrefPath.slice(1));
    var active;
    if (hrefHash) {
      /* 해시 항목: 경로 + 해시가 모두 일치할 때만 (구 별칭 #tsla-nvda → #top9 취급) */
      active = onPath && (curHash === hrefHash ||
               (hrefHash === '#top9' && (curHash === '#tsla-nvda' || curHash === '#kings' || curHash === '#tesla-nvidia')));
    } else if (hrefPath === '/atmr-dashboard.html') {
      /* 기본 '스윙 시그널' 항목: 대시보드에 있되 다른 탭 해시가 아닐 때만 */
      active = onPath && swingTabHashes.indexOf(curHash) < 0;
    } else {
      active = onPath;
    }

    if (active) activeShort = shortLbl;

    desktopLinksHTML +=
      '<a href="' + href + '" class="ez-nav-svc-link' + (active ? ' active' : '') + '">' +
        shortLbl +
      '</a>';

    /* 모바일 타일 메뉴는 짧은 이름 사용 (2026-08-04, 성동님 지시 — 긴 설명형
       메뉴명 폐지, 2열 타일로 스크롤 없이 한 화면). NEW 딱지는 TOP9에만 별도 부착. */
    var mobLbl = shortLbl +
      (href.indexOf('#top9') >= 0
        ? ' <span style="display:inline-block;background:#ff3b30;color:#fff;font-size:14px;font-weight:800;border-radius:6px;padding:0 5px;margin-left:2px;vertical-align:middle;">NEW</span>'
        : '');
    mobileItemsHTML +=
      '<a href="' + href + '" class="ez-mob-item' + (active ? ' active' : '') + '">' +
        mobLbl +
      '</a>';
  }

  /* ── 모바일 메뉴 타일화 — 1열 리스트(스크롤 압박) → 2열 타일 그리드 ──
     ez-design.css의 기존 규칙보다 id 셀렉터로 우선 적용 (CSS 파일 캐시 무관) */
  (function mobTileStyle() {
    var st = document.createElement('style');
    st.textContent =
      '@media (max-width: 768px) {' +
      '#ez-mob-menu { grid-template-columns: 1fr 1fr; gap: 10px;' +
        'padding: 64px 14px 24px; align-content: start; }' +
      '#ez-mob-menu.open { display: grid; }' +
      '#ez-mob-menu .ez-mob-item { display: flex; align-items: center; justify-content: center;' +
        'text-align: center; padding: 15px 8px; min-height: 56px; line-height: 1.35; word-break: keep-all;' +
        'border: 1px solid var(--ez-border); border-radius: 14px;' +
        'background: var(--ez-surface); }' +
      '#ez-mob-menu .ez-mob-item.active { border: 2px solid var(--ez-blue);' +
        'padding-left: 8px; background: var(--ez-blue-dim); color: var(--ez-blue); }' +
      '}';
    document.head.appendChild(st);
  })();

  /* ── 0. 메뉴 전용 모드 (data-menu-only="1") — 커스텀 헤더 페이지용 ──
     index.html처럼 자체 헤더를 가진 페이지는 nav를 새로 만들지 않고,
     페이지에 이미 있는 #ez-mob-menu 컨테이너에 위 links 배열로 만든
     타일 항목만 채운다. 메뉴 목록의 출처가 이 파일 하나로 통일된다
     (2026-08-04 하드코딩 사본 수개월 방치 사고의 구조적 재발 방지). */
  if (scriptEl && scriptEl.getAttribute('data-menu-only') === '1') {
    var fillMenu = function () {
      var h = document.getElementById('ez-mob-menu');
      if (h) h.innerHTML = mobileItemsHTML;
    };
    if (document.getElementById('ez-mob-menu')) fillMenu();
    else document.addEventListener('DOMContentLoaded', fillMenu);
    return;
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
  var parent   = scriptEl ? scriptEl.parentNode : document.body;
  var ref      = scriptEl ? scriptEl.nextSibling : null;

  parent.insertBefore(nav, ref);
  parent.insertBefore(mobMenu, ref);  /* nav 다음에, 페이지 본문보다 앞에 */


  /* ── 4. 모바일 메뉴 padding-top 동적 조정 ──
     각 페이지마다 nav 실제 높이가 다를 수 있으므로
     메뉴 열기 직전에 getBoundingClientRect()로 실측 후 적용. */
  function syncMenuTop() {
    var navEl  = document.getElementById('ez-nav');
    var menuEl = document.getElementById('ez-mob-menu');
    if (navEl && menuEl) {
      menuEl.style.paddingTop = navEl.getBoundingClientRect().height + 'px';
    }
  }

  /* ── 4-B. PC 칩 메뉴 "우측/좌측에 더 있음" 표시기 (2026-08-04, 성동님 지시) ──
     칩이 화면보다 길면: ①우측 가장자리 그라디언트+맥동하는 ❯ 버튼 표시(클릭 시
     한 화면만큼 스크롤), ②첫 로드 때 칩 줄을 살짝 밀었다 되돌리는 1회 힌트 모션,
     ③오른쪽으로 스크롤한 상태에선 좌측에도 맞대응 ❮ 버튼 표시(클릭 시 왼쪽으로 복귀).
     끝까지 스크롤하면 해당 방향 표시기 자동 숨김. 모바일(768px 이하)은 칩 자체가 숨겨지므로 제외. */
  (function navMoreHint() {
    var linksEl = nav.querySelector('.ez-nav-svc-links');
    if (!linksEl) return;

    var style = document.createElement('style');
    style.textContent =
      '.ez-nav-inner { position: relative; }' +
      '.ez-nav-more, .ez-nav-more-left { position: absolute; top: 0; bottom: 0; width: 72px;' +
        'display: none; align-items: center; border: 0; cursor: pointer; z-index: 3; pointer-events: none; }' +
      '.ez-nav-more { right: 0; justify-content: flex-end; padding-right: 10px;' +
        'background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 62%); }' +
      '.ez-nav-more-left { left: 0; justify-content: flex-start; padding-left: 10px;' +
        'background: linear-gradient(90deg, rgba(255,255,255,0.95) 38%, rgba(255,255,255,0) 100%); }' +
      '.ez-nav-more.show, .ez-nav-more-left.show { display: flex; pointer-events: auto; }' +
      '.ez-nav-more .ez-nav-more-ico, .ez-nav-more-left .ez-nav-more-ico {' +
        'font-size: 16px; font-weight: 800; color: var(--ez-text); }' +
      '.ez-nav-more .ez-nav-more-ico { animation: ezNavNudge 1.4s ease-in-out infinite; }' +
      '.ez-nav-more-left .ez-nav-more-ico { animation: ezNavNudgeL 1.4s ease-in-out infinite; }' +
      '@keyframes ezNavNudge { 0%,100% { transform: translateX(0); opacity: .55; }' +
        '50% { transform: translateX(5px); opacity: 1; } }' +
      '@keyframes ezNavNudgeL { 0%,100% { transform: translateX(0); opacity: .55; }' +
        '50% { transform: translateX(-5px); opacity: 1; } }' +
      '@media (prefers-color-scheme: dark) {' +
        '.ez-nav-more { background: linear-gradient(90deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.95) 62%); }' +
        '.ez-nav-more-left { background: linear-gradient(90deg, rgba(10,10,10,0.95) 38%, rgba(10,10,10,0) 100%); } }' +
      '@media (max-width: 768px) { .ez-nav-more, .ez-nav-more-left { display: none !important; } }' +
      '@media (prefers-reduced-motion: reduce) {' +
        '.ez-nav-more .ez-nav-more-ico, .ez-nav-more-left .ez-nav-more-ico { animation: none; } }';
    document.head.appendChild(style);

    /* 자체 rAF 애니메이션 — behavior:'smooth' 프로그래매틱 스크롤은 TV 위젯 iframe이
       많은 페이지(스윙 대시보드)에서 브라우저가 조용히 무시/취소하는 게 실측 확인됨
       (2026-08-04 라이브 검증: scrollBy smooth 호출 후 scrollLeft 변화 0).
       scrollLeft 직접 대입은 항상 동작하므로 rAF로 직접 애니메이션한다. */
    function glide(delta) {
      var start  = linksEl.scrollLeft;
      var target = Math.max(0, Math.min(start + delta, linksEl.scrollWidth - linksEl.clientWidth));
      var t0 = null, DUR = 320;
      function step(ts) {
        if (t0 === null) t0 = ts;
        var k = Math.min(1, (ts - t0) / DUR);
        var e = 1 - Math.pow(1 - k, 3);          /* ease-out cubic */
        linksEl.scrollLeft = start + (target - start) * e;
        update();                                 /* scroll 이벤트 미발화 대비 직접 갱신 */
        if (k < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    var more = document.createElement('button');
    more.type = 'button';
    more.className = 'ez-nav-more';
    more.setAttribute('aria-label', '오른쪽으로 스크롤하면 메뉴가 더 있습니다');
    more.innerHTML = '<span class="ez-nav-more-ico">&#10095;</span>';
    more.addEventListener('click', function () {
      glide(Math.max(200, linksEl.clientWidth * 0.7));
    });
    var moreL = document.createElement('button');
    moreL.type = 'button';
    moreL.className = 'ez-nav-more-left';
    moreL.setAttribute('aria-label', '왼쪽으로 스크롤하면 이전 메뉴가 있습니다');
    moreL.innerHTML = '<span class="ez-nav-more-ico">&#10094;</span>';
    moreL.addEventListener('click', function () {
      glide(-Math.max(200, linksEl.clientWidth * 0.7));
    });
    var inner = nav.querySelector('.ez-nav-inner');
    if (inner) { inner.appendChild(more); inner.appendChild(moreL); }

    /* 버튼을 칩 줄 높이에만 정렬 — nav가 로고줄+칩줄 2줄로 랩되는 레이아웃에서
       버튼이 로고 클릭 영역까지 덮지 않도록 실측으로 top/height 지정 */
    function alignToChips() {
      if (!inner) return;
      var ir = inner.getBoundingClientRect();
      var lr = linksEl.getBoundingClientRect();
      var t = (lr.top - ir.top) + 'px', h = lr.height + 'px';
      more.style.top = t;  more.style.height = h;  more.style.bottom = 'auto';
      moreL.style.top = t; moreL.style.height = h; moreL.style.bottom = 'auto';
    }

    function update() {
      var remain = linksEl.scrollWidth - linksEl.clientWidth - linksEl.scrollLeft;
      more.classList.toggle('show', remain > 12);
      moreL.classList.toggle('show', linksEl.scrollLeft > 12);
      alignToChips();
    }
    linksEl.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();

    /* 첫 로드 힌트 모션 — 오버플로가 있고 사용자가 아직 스크롤 안 했을 때 1회
       (smooth 스크롤 무시 이슈로 glide 사용) */
    setTimeout(function () {
      if (linksEl.scrollWidth - linksEl.clientWidth > 12 && linksEl.scrollLeft === 0) {
        glide(84);
        setTimeout(function () {
          if (linksEl.scrollLeft <= 100) glide(-linksEl.scrollLeft);
        }, 700);
      }
      update();
    }, 900);
  })();

  /* ── 5. 토글 함수 — 전역 등록 ── */
  window.ezNavToggle = function () {
    var menu = document.getElementById('ez-mob-menu');
    var btn  = document.getElementById('ez-mob-toggle');
    if (!menu || !btn) return;
    var opening = !menu.classList.contains('open');
    if (opening) syncMenuTop();   /* 열기 직전에 nav 높이 재측정 */
    menu.classList.toggle('open', opening);
    btn.classList.toggle('open', opening);
    btn.setAttribute('aria-expanded', opening ? 'true' : 'false');
    document.body.style.overflow = opening ? 'hidden' : '';
  };

  /* ── 6. FlipZen 앱(ezlong.com/time)이 iframe으로 이 페이지를 감싸고 있을 때,
     최상단 그래버 탭 제스처로 이 페이지를 맨 위로 스크롤시키기 위한 메시지
     수신기. [2026-07-22 신설] postMessage는 parent가 진짜 크로스오리진이어도
     항상 안전하게 동작하는 방식이라, 부모(FlipZen)가 iframe.contentWindow에
     직접 접근하지 않고 이 메시지만 보낸다 — 이 페이지 쪽에서 스크롤을
     실행하는 구조라 SOP(동일출처 정책) 우려가 없다. 이 리스너는 FlipZen
     앱 밖(일반 브라우저로 ezlong.com 직접 방문)에서는 그냥 아무 메시지도
     안 와서 조용히 미사용 상태로 남는다 — 부작용 없음. */
  window.addEventListener('message', function (event) {
    if (!event || !event.data || event.data.source !== 'flipzen-app') return;
    if (event.data.action !== 'scrollToTop') return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
