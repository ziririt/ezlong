/**
 * ez-nav.js - EZLONG 글로벌 네비게이션 공유 스크립트
 * 사용법: <body> 직후 <script src="/ez-nav.js"></script>
 * - ez-design.css 가 먼저 로드되어 있어야 합니다.
 * - PC: 수평 스크롤 칩 메뉴
 * - 모바일: 현재 페이지 칩 탭 → 풀스크린 오버레이 전체 메뉴
 *
 * [2026-06-14 v3] document.write 완전 제거 - DOM API 전용
 * document.write + appendChild 혼용 시 HTML 파서가 </nav>를
 * 처리하기 전에 appendChild가 실행되어 menu가 nav 안으로 삽입되는
 * 파서 버그 확인. createElement + insertBefore 방식으로 교체.
 */
(function () {
  var scriptEl = document.currentScript;

  /* ── 다국어 감지 (2026-08-04) - 같은 스크립트가 경로에 따라 해당 언어 메뉴를 그린다.
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
      /* 2026-08-04(운영 피드백): 한국어·영문과 달리 스윙이 한 덩어리로 남아 있었다.
         다만 ja/zh/es/pt의 /{lang}/atmr-dashboard.html은 탭이 없는 SEO 랜딩 페이지라
         #swing-strategy·#top9 해시가 아무 동작도 하지 않는다. 그래서 이 둘만은 실제로
         동작하는 영문 대시보드로 보낸다 - 사이트 원칙("외국인이 굳이 한국어 웹을 볼
         필요가 없잖아")에 따라 한국어판이 아니라 영문판이 목적지다.
         나중에 해당 언어 대시보드가 실제로 생기면 p + '...#top9' 로 되돌릴 것. */
      ['/en/atmr-dashboard.html#swing-strategy', L.strategy, L.strategy],
      ['/en/atmr-dashboard.html#top9',           L.top9,     L.top9],
      [p + 'market-vs.html',      L.vs,       L.vs],
      [p + 'brief-history.html',  L.events,   L.events],
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
    /* 2026-08-04: ja의 자동적립 가이드를 push하면 밸런스게임 뒤로 밀려
       "밸런스게임은 맨 끝" 원칙(운영자)이 깨진다. 밸런스게임 앞에 끼워넣는다. */
    if (lang === 'ja') a.splice(a.length - 1, 0, [p + 'auto-dca-guide.html', L.autoGuide, L.autoGuide]);
    return a;
  }

  var LANG_LABELS = {
    ja: { swing: 'スイングシグナル', strategy: 'スイング戦略', top9: 'TOP9集中分析', vs: '強気vs弱気', events: 'チャート：その日何が', prices: '株価情報', chart: 'AIチャート分析',
          targets: '目標株価', cycle: 'マーケットサイクル', dca: 'DCAシミュレーター',
          folio: 'AIポートフォリオ', compound: '複利計算機', retire: '退職計算機',
          backtest: 'バックテスト', risk: '投資性向診断', quiz: '投資タイプ診断',
          game: 'バランスゲーム', autoGuide: '自動積立ガイド' },
    zh: { swing: '波段信号', strategy: '波段策略', top9: 'TOP9集中分析', vs: '多空对比', events: '图表：那天发生了什么', prices: '股价信息', chart: 'AI图表分析',
          targets: '目标股价', cycle: '市场周期', dca: '定投模拟器',
          folio: 'AI投资组合', compound: '复利计算器', retire: '退休计算器',
          backtest: '回测', risk: '风险偏好测评', quiz: '投资类型测试', game: '平衡游戏' },
    es: { swing: 'Señal de Swing', strategy: 'Estrategia Swing', top9: 'TOP9 a Fondo', vs: 'Alcista vs Bajista', events: 'Gráfico: qué pasó', prices: 'Precios', chart: 'Análisis IA',
          targets: 'Precio Objetivo', cycle: 'Ciclo de Mercado', dca: 'Simulador DCA',
          folio: 'Cartera IA', compound: 'Interés Compuesto', retire: 'Calc. Jubilación',
          backtest: 'Backtest', risk: 'Perfil de Riesgo', quiz: 'Tipo de Inversor',
          game: 'Juego de Equilibrio' },
    pt: { swing: 'Sinal de Swing', strategy: 'Estratégia Swing', top9: 'TOP9 a Fundo', vs: 'Alta vs Baixa', events: 'Gráfico: o que houve', prices: 'Preços', chart: 'Análise IA',
          targets: 'Preço-Alvo', cycle: 'Ciclo de Mercado', dca: 'Simulador DCA',
          folio: 'Carteira IA', compound: 'Juros Compostos', retire: 'Calc. Aposentadoria',
          backtest: 'Backtest', risk: 'Perfil de Risco', quiz: 'Tipo de Investidor',
          game: 'Jogo de Equilíbrio' }
  };

  var linksEN = [
    ['/en/atmr-dashboard.html',        'Swing Signal',    'Swing Signal Dashboard'],
    ['/en/atmr-dashboard.html#swing-strategy', 'Swing Strategy', 'Swing Strategy - 3-3-4 Rule'],
    ['/en/atmr-dashboard.html#top9',   'TOP9 Deep Dive',  'TOP9 Deep Dive - Big Tech'],
    ['/en/market-vs.html',             'Bull vs Bear',    'Bull vs Bear - AI Market Read'],
    ['/en/brief-history.html',         'Chart: What Happened', 'Chart: What Happened That Day - US Market Events'],
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
     2026-08-04: 첫 항목을 3개로 분리 (운영 지침) - 스윙 시그널 대시보드의
     3개 탭(시그널/전략/TOP9)에 해시 딥링크로 각각 직접 진입. 활성 판정은
     아래 루프에서 pathname+hash 조합으로 처리한다. */
  var linksKR = [
    ['/atmr-dashboard.html',        '스윙 시그널',    "스윙 트레이더를 위한 '스윙 시그널'"],
    ['/atmr-dashboard.html#swing-strategy', '스윙 전략', '스윙 전략 - 3-3-4 원칙 · 레버리지 가이드'],
    ['/atmr-dashboard.html#top9',   'TOP9 집중분석',  'TOP9 집중분석 - 테슬라·엔비디아 등 빅테크 9종 <span style="display:inline-block;background:#ff3b30;color:#fff;font-size:14px;font-weight:800;border-radius:6px;padding:0 6px;margin-left:4px;vertical-align:middle;">NEW</span>'],
    ['/market-vs.html',             '긍정vs부정',     '긍정 vs 부정 몇대몇 - AI 시황 분석'],
    ['/brief-history.html',         '차트: 그날 무슨 일이 있었나<span style="display:inline-block;background:#ff3b30;color:#fff;font-size:11px;font-weight:800;border-radius:5px;padding:0 4px;margin-left:4px;vertical-align:middle;line-height:1.5;">NEW</span>', '차트: 그날 무슨 일이 있었나 - 날짜별 미국 증시 이슈 <span style="display:inline-block;background:#ff3b30;color:#fff;font-size:14px;font-weight:800;border-radius:6px;padding:0 6px;margin-left:4px;vertical-align:middle;">NEW</span>'],
    ['/stocks.html',                '심플 주가',      '심플 주가 정보'],
    ['/chart-analysis.html',        'AI 차트분석',    'AI 차트 분석'],
    ['/model-portfolio.html',       'AI포트폴리오 점검<span style="display:inline-block;background:#ff3b30;color:#fff;font-size:11px;font-weight:800;border-radius:5px;padding:0 4px;margin-left:4px;vertical-align:middle;line-height:1.5;">NEW</span>', 'AI포트폴리오 점검 - 공격형 AI 시대 26종목 <span style="display:inline-block;background:#ff3b30;color:#fff;font-size:14px;font-weight:800;border-radius:6px;padding:0 6px;margin-left:4px;vertical-align:middle;">NEW</span>'],
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
  /* 닫기 버튼도 언어를 따라야 한다 - 영문 화면에 '닫기'가 남아 있었다 */
  var CLOSE_LABEL = { ko: '닫기', en: 'Close', ja: '閉じる', zh: '关闭', es: 'Cerrar', pt: 'Fechar' };
  var CLOSE_WORD = CLOSE_LABEL[LANG] || 'Close';
  var activeShort = MENU_WORD[LANG] || 'Menu';
  var desktopLinksHTML = '';
  var mobileItemsHTML  = '';

  /* 스윙 대시보드 탭 해시들 - 이 중 하나가 떠 있으면 '스윙 시그널' 기본 항목이
     아니라 해당 탭 항목을 활성으로 표시 (#tsla-nvda는 #top9의 구 별칭) */
  var swingTabHashes = ['#swing-strategy', '#top9', '#tsla-nvda', '#kings', '#tesla-nvidia'];
  var curHash = window.location.hash || '';

  /* 활성 판정을 함수로 뽑아둔다 - 최초 렌더뿐 아니라 해시가 바뀔 때마다
     같은 규칙으로 다시 계산해야 하기 때문 (아래 syncActive 참조). */
  var TOP9_ALIASES = ['#tsla-nvda', '#kings', '#tesla-nvidia'];
  function isDashboardPath(hrefPath) {
    /* /atmr-dashboard.html, /en/..., /ja/... 전부 해당 - 로케일별로
       경로가 달라서 문자열 완전일치로 보면 en 이하에서 판정이 새어나간다. */
    return /(^|\/)atmr-dashboard\.html$/.test(hrefPath);
  }
  function computeActive(href, hash) {
    var hi   = href.indexOf('#');
    var hp   = hi >= 0 ? href.slice(0, hi) : href;
    var hh   = hi >= 0 ? href.slice(hi) : '';
    var onP  = (p === hp) || (p === hp.slice(1));
    if (hh) {
      return onP && (hash === hh ||
             (hh === '#top9' && TOP9_ALIASES.indexOf(hash) >= 0));
    }
    if (isDashboardPath(hp)) {
      return onP && swingTabHashes.indexOf(hash) < 0;
    }
    return onP;
  }

  for (var i = 0; i < links.length; i++) {
    var href     = links[i][0];
    var shortLbl = links[i][1];
    var fullLbl  = links[i][2];
    var active   = computeActive(href, curHash);

    /* 모바일 메뉴 버튼 라벨에는 칩에 붙인 NEW 배지를 빼고 글자만 쓴다 -
       버튼이 좁아 배지까지 들어가면 종목명이 잘린다. */
    if (active) activeShort = shortLbl.replace(/<span[^>]*>NEW<\/span>/, '');

    desktopLinksHTML +=
      '<a href="' + href + '" class="ez-nav-svc-link' + (active ? ' active' : '') + '">' +
        shortLbl +
      '</a>';

    /* 모바일 타일 메뉴는 짧은 이름 사용 (2026-08-04, 운영 지침 - 긴 설명형
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

  /* ── 메뉴 닫기 버튼 (2026-08-06 신설) ────────────────────────────────
     전면 메뉴를 닫는 방법이 헤더 우측 토글을 다시 누르는 것뿐이었다.
     메뉴가 화면을 꽉 채우고 있으면 그 버튼이 시야 밖 위쪽에 있어서,
     "어떻게 빠져나가지" 하는 순간이 생긴다. 목록 끝에 닫기를 둔다 -
     끝까지 훑고 원하는 게 없을 때 손가락이 이미 가 있는 자리다. */
  mobileItemsHTML +=
    '<button type="button" class="ez-mob-close" onclick="ezNavCloseMenu()">' +
      '<span class="ez-mob-close-x" aria-hidden="true">&#10005;</span> ' + CLOSE_WORD +
    '</button>';

  /* ── 모바일 메뉴 타일화 - 1열 리스트(스크롤 압박) → 2열 타일 그리드 ──
     ez-design.css의 기존 규칙보다 id 셀렉터로 우선 적용 (CSS 파일 캐시 무관) */
  (function mobTileStyle() {
    var st = document.createElement('style');
    st.textContent =
      '@media (max-width: 768px) {' +
      '#ez-mob-menu { grid-template-columns: 1fr 1fr; gap: 10px;' +
        'padding: 64px 14px calc(28px + env(safe-area-inset-bottom) + var(--ez-mob-bottom-bar, 0px));' +
        'align-content: start; }' +
      '#ez-mob-menu.open { display: grid; }' +
      /* 2026-08-07 - 안드로이드 크롬에서 마지막 줄(닫기)이 화면 밖으로 잘렸다.
         position:fixed + inset:0 의 기준은 주소창이 숨겨졌을 때의 큰 뷰포트라,
         주소창이 떠 있으면 요소 바닥이 화면 아래로 내려간다. 내용이 요소 안에는
         다 들어가 있으니 스크롤도 안 생겨서 그냥 잘려 보인다. dvh 는 지금 실제로
         보이는 높이를 따라가므로 이 어긋남이 사라진다. */
      '@supports (height: 100dvh) {' +
        '#ez-mob-menu { height: 100dvh; bottom: auto; }' +
      '}' +
      '#ez-mob-menu .ez-mob-item { display: flex; align-items: center; justify-content: center;' +
        'text-align: center; padding: 15px 8px; min-height: 56px; line-height: 1.35; word-break: keep-all;' +
        'border: 1px solid var(--ez-border); border-radius: 16px;' +
        'background: var(--ez-surface); }' +
      '#ez-mob-menu .ez-mob-item.active { border: 2px solid var(--ez-blue);' +
        'padding-left: 8px; background: var(--ez-blue-dim); color: var(--ez-blue); }' +
      /* 닫기 - 2열을 통째로 차지하되 버튼 자체는 가운데. 타일과 같은 색이면
         목록의 연장으로 읽히므로 톤을 낮춰 "이건 항목이 아니다"를 알린다. */
      '#ez-mob-menu .ez-mob-close { grid-column: 1 / -1; justify-self: center;' +
        'margin: 18px 0 calc(8px + env(safe-area-inset-bottom));' +
        'display: inline-flex; align-items: center; justify-content: center; gap: 7px;' +
        'min-height: 48px; padding: 0 30px;' +
        'font-family: inherit; font-size: 16px; font-weight: 700;' +
        'color: var(--ez-text3); background: var(--ez-card2);' +
        'border: 1px solid var(--ez-border); border-radius: 999px;' +
        'cursor: pointer; -webkit-tap-highlight-color: transparent;' +
        'transition: background .12s, color .12s; }' +
      '#ez-mob-menu .ez-mob-close:active { background: var(--ez-border);' +
        'color: var(--ez-text); }' +
      '#ez-mob-menu .ez-mob-close-x { font-size: 15px; line-height: 1; }' +
      '}';
    document.head.appendChild(st);
  })();

  /* ── 0-A. 같은 페이지 안에서의 메뉴 이동 처리 (2026-08-05, 이슈 제보) ──
     증상: '스윙 시그널 / 스윙 전략 / TOP9 집중분석' 세 메뉴는 전부
     atmr-dashboard.html 한 파일의 탭이라 서로 이동해도 페이지가 언로드되지
     않는다. 그래서 모바일 전면 메뉴가 열린 채로 남고, 사용자 눈에는
     "눌렀는데 아무 일도 안 일어남 = 고장"으로 보인다.
     해결: 메뉴 링크 클릭을 위임 처리해서 (1) 항상 메뉴를 먼저 닫고,
     (2) 같은 경로면 해시만 바꿔 탭 전환을 직접 트리거한다.
     다른 페이지로 가는 링크는 그대로 브라우저에 맡긴다(기존 동작 유지). */
  /* 메뉴 바닥 여백을 화면 아래 고정 배너 높이만큼 더 준다 (2026-08-07).
     증상: 목록 끝의 '닫기'가 언어 안내 배너(#ezlb-bar, position:fixed bottom:0)에
     덮여 반쯤 잘려 보였다. 배너는 메뉴보다 z-index 가 높아 항상 위에 뜬다.
     배너 높이는 문구·화면폭에 따라 달라지므로 CSS 상수로는 못 맞춘다 - 열 때
     실측해서 넣는다. 배너가 없으면 0 이라 평소엔 여백이 늘지 않는다. */
  function padMenuForBottomBar() {
    var menu = document.getElementById('ez-mob-menu');
    if (!menu) return;
    var bar = document.getElementById('ezlb-bar');
    var h = 0;
    if (bar) {
      /* offsetParent 로 노출 여부를 보면 안 된다 - position:fixed 요소는
         숨어 있지 않아도 offsetParent 가 null 이다(처음 이걸로 짰다가 배너
         높이를 0 으로 읽었다). 실제 상자 크기와 computed style 로 판정한다. */
      var cs = window.getComputedStyle(bar);
      var r  = bar.getBoundingClientRect();
      if (cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity || '1') > 0.05
          && r.height > 0 && r.bottom > window.innerHeight - 4) {
        h = Math.ceil(r.height);
      }
    }
    menu.style.setProperty('--ez-mob-bottom-bar', h + 'px');
  }
  window.ezNavPadMenuBottom = padMenuForBottomBar;
  window.addEventListener('resize', function () {
    var m = document.getElementById('ez-mob-menu');
    if (m && m.classList.contains('open')) padMenuForBottomBar();
  });

  function closeMobMenu() {
    var menu = document.getElementById('ez-mob-menu');
    var btn  = document.getElementById('ez-mob-toggle');
    if (!menu || !menu.classList.contains('open')) return false;
    menu.classList.remove('open');
    if (btn) {
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
    document.body.style.overflow = '';
    return true;
  }
  window.ezNavCloseMenu = closeMobMenu;

  function fireHashChange() {
    /* replaceState로 해시를 지우면 hashchange가 안 뜬다 - 직접 쏜다.
       HashChangeEvent 생성자를 못 쓰는 구형 브라우저 대비 폴백 포함. */
    var ev;
    try { ev = new HashChangeEvent('hashchange'); }
    catch (e) {
      try { ev = new Event('hashchange'); }
      catch (e2) {
        ev = document.createEvent('Event');
        ev.initEvent('hashchange', false, false);
      }
    }
    window.dispatchEvent(ev);
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var a = t.closest('a.ez-mob-item, a.ez-nav-svc-link');
    if (!a) return;
    /* 새 탭/다운로드 등 브라우저 기본 동작 의도는 건드리지 않는다 */
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (a.target && a.target !== '_self') return;

    var closed = closeMobMenu();

    /* a.pathname은 브라우저가 절대경로로 정규화해준 값이라 상대경로도 안전 */
    if (a.protocol !== location.protocol || a.host !== location.host) return;
    if (a.pathname !== location.pathname) return;   /* 진짜 이동 - 브라우저에 맡김 */

    e.preventDefault();
    var newHash = a.hash || '';
    var cur     = location.hash || '';
    if (newHash === cur) {
      /* 이미 그 탭에 있다 - 메뉴만 닫고 맨 위로 올려 "반응했다"를 보여준다 */
      window.scrollTo({ top: 0, behavior: closed ? 'auto' : 'smooth' });
      syncActive();
      return;
    }
    if (newHash) {
      location.hash = newHash;              /* hashchange 자동 발생 */
    } else {
      try {
        history.replaceState(null, '', location.pathname + location.search);
      } catch (err) { /* 미지원 브라우저 무시 */ }
      fireHashChange();
    }
    window.scrollTo({ top: 0 });
  }, false);

  /* 해시가 바뀌면 활성 표시와 토글 라벨을 다시 계산한다 - 같은 페이지 안에서
     탭만 바뀌면 스크립트가 재실행되지 않아 예전 탭이 계속 활성으로 남는다. */
  function syncActive() {
    var hash = window.location.hash || '';
    var label = MENU_WORD[LANG] || 'Menu';
    var apply = function (nodes) {
      for (var k = 0; k < nodes.length; k++) {
        var el = nodes[k];
        var raw = el.getAttribute('href') || '';
        var on  = computeActive(raw, hash);
        el.classList.toggle('active', on);
        if (on) {
          var idx = -1;
          for (var j = 0; j < links.length; j++) if (links[j][0] === raw) { idx = j; break; }
          if (idx >= 0) label = links[idx][1];
        }
      }
    };
    apply(document.querySelectorAll('a.ez-nav-svc-link'));
    apply(document.querySelectorAll('a.ez-mob-item'));
    var lbl = document.querySelector('#ez-mob-toggle .ez-mob-toggle-label');
    /* index.html처럼 라벨이 고정 문구('투자 AI 도구')인 커스텀 헤더는 건드리지
       않는다 - 그 페이지엔 ez-nav가 만든 토글이 없으므로 data 표식으로 구분 */
    if (lbl && lbl.getAttribute('data-ez-nav-label') === '1') lbl.textContent = label;
  }
  window.addEventListener('hashchange', syncActive);
  window.addEventListener('popstate', syncActive);

  /* ── 0. 메뉴 전용 모드 (data-menu-only="1") - 커스텀 헤더 페이지용 ──
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
          '<source srcset="/logo-darkmode.png?v=20260807c" media="(prefers-color-scheme: dark)">' +
          '<img src="/logo.png?v=20260809" alt="EZLONG">' +
        '</picture>' +
      '</a>' +
      '<div class="ez-nav-svc-links">' + desktopLinksHTML + '</div>' +
      '<button class="ez-mob-toggle" id="ez-mob-toggle" ' +
             'onclick="ezNavToggle()" aria-expanded="false" aria-haspopup="true">' +
        '<span class="ez-mob-toggle-label" data-ez-nav-label="1">' + activeShort + '</span>' +
        '<span class="ez-mob-toggle-arrow">&#9662;</span>' +
      '</button>' +
    '</div>';

  /* ── 2. <div class="ez-mob-menu"> 생성 - nav와 완전 분리 ── */
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

  /* ── 네비 실제 높이를 --ez-nav-h 로 노출 (2026-08-04) ─────────────────
     배경: retirement-calculator가 페이지 헤더를 top:48px에 고정하고 있었는데,
     그 48px은 지금 DOM에 존재하지도 않는 옛 #global-nav 높이였다. 실제
     .ez-nav는 모바일 54px·PC 73px이라 헤더가 네비 뒤로 밀려 들어가
     "덮인 것처럼" 보였다(이슈 제보). 숫자를 페이지마다 손으로 박으면
     네비가 바뀔 때마다 조용히 어긋난다 - 실측값을 변수로 내보낸다. */
  (function publishNavHeight() {
    var apply = function () {
      var h = Math.round(nav.getBoundingClientRect().height);
      if (h > 0) document.documentElement.style.setProperty('--ez-nav-h', h + 'px');
    };
    apply();
    if (window.ResizeObserver) { try { new ResizeObserver(apply).observe(nav); } catch (e) {} }
    window.addEventListener('resize', apply, { passive: true });
    window.addEventListener('load', apply, { passive: true });
  })();



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

  /* ── 4-B. PC 칩 메뉴 "우측/좌측에 더 있음" 표시기 (2026-08-04, 운영 지침) ──
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

    /* 자체 rAF 애니메이션 - behavior:'smooth' 프로그래매틱 스크롤은 TV 위젯 iframe이
       많은 페이지(스윙 대시보드)에서 브라우저가 조용히 무시/취소하는 게 실측 확인됨
       (2026-08-04 라이브 검증: scrollBy smooth 호출 후 scrollLeft 변화 0).
       scrollLeft 직접 대입은 항상 동작하므로 rAF로 직접 애니메이션한다. */
    /* 스프링 기반 글라이드 (apple-design §3·§4, 2026-08-04 개편)
       기존엔 320ms 고정 ease-out 큐빅이었다. 고정 시간 애니메이션은
       (a) 중간에 잡아서 되돌릴 수 없고 (b) 진행 중 다시 누르면 시작값이
       튄다. 스프링은 "현재 화면값"에서 출발하고 속도를 이어받으므로 둘 다
       자연히 해결된다.
       파라미터는 애플이 이동(reposition)에 쓰는 값 - 감쇠비 1.0(오버슈트
       없음), response 0.4s. 손가락이 던진 게 아니라 버튼을 누른 이동이므로
       튕김(bounce)을 주지 않는 게 맞다.
       움직임 저감 설정이면 스프링 없이 즉시 이동한다(§14). */
    var _spring = null;
    function glide(delta) {
      var target = Math.max(0, Math.min(linksEl.scrollLeft + delta,
                                        linksEl.scrollWidth - linksEl.clientWidth));

      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        linksEl.scrollLeft = target; update(); return;
      }

      /* 진행 중이면 새 애니메이션을 만들지 않고 목표만 갈아끼운다 -
         속도가 이어져 "벽에 부딪히는" 불연속이 생기지 않는다. */
      if (_spring) { _spring.target = target; return; }

      var RESPONSE = 0.4, DAMPING = 1.0;
      var w  = 2 * Math.PI / RESPONSE;            /* 고유 각진동수 */
      var st = { x: linksEl.scrollLeft, v: 0, target: target, last: null };
      _spring = st;

      function step(ts) {
        if (st.last === null) st.last = ts;
        var dt = Math.min((ts - st.last) / 1000, 1 / 30);  /* 탭 비활성 복귀 시 폭주 방지 */
        st.last = ts;

        /* 임계 감쇠 스프링 - 반해석적 적분(큰 dt에서도 발산하지 않는다) */
        var d  = st.x - st.target;
        var a  = -w * w * d - 2 * DAMPING * w * st.v;
        st.v  += a * dt;
        st.x  += st.v * dt;

        if (Math.abs(st.x - st.target) < 0.5 && Math.abs(st.v) < 8) {
          linksEl.scrollLeft = st.target; update(); _spring = null; return;
        }
        linksEl.scrollLeft = st.x;
        update();                                 /* scroll 이벤트 미발화 대비 직접 갱신 */
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    /* 사용자가 직접 손대면 즉시 양보한다 - 애니메이션이 입력을 가로막지 않는다(§3) */
    ['pointerdown', 'touchstart', 'wheel'].forEach(function (ev) {
      linksEl.addEventListener(ev, function () { _spring = null; }, { passive: true });
    });

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

    /* 버튼을 칩 줄 높이에만 정렬 - nav가 로고줄+칩줄 2줄로 랩되는 레이아웃에서
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

    /* 첫 로드 힌트 모션 - 오버플로가 있고 사용자가 아직 스크롤 안 했을 때 1회
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

  /* ── 5. 토글 함수 - 전역 등록 ── */
  window.ezNavToggle = function () {
    var menu = document.getElementById('ez-mob-menu');
    var btn  = document.getElementById('ez-mob-toggle');
    if (!menu || !btn) return;
    var opening = !menu.classList.contains('open');
    if (opening) { syncMenuTop(); padMenuForBottomBar(); }  /* 열기 직전에 nav 높이·하단 배너 재측정 */
    menu.classList.toggle('open', opening);
    btn.classList.toggle('open', opening);
    btn.setAttribute('aria-expanded', opening ? 'true' : 'false');
    document.body.style.overflow = opening ? 'hidden' : '';
  };

  /* ── 6. FlipZen 앱(ezlong.com/time)이 iframe으로 이 페이지를 감싸고 있을 때,
     최상단 그래버 탭 제스처로 이 페이지를 맨 위로 스크롤시키기 위한 메시지
     수신기. [2026-07-22 신설] postMessage는 parent가 진짜 크로스오리진이어도
     항상 안전하게 동작하는 방식이라, 부모(FlipZen)가 iframe.contentWindow에
     직접 접근하지 않고 이 메시지만 보낸다 - 이 페이지 쪽에서 스크롤을
     실행하는 구조라 SOP(동일출처 정책) 우려가 없다. 이 리스너는 FlipZen
     앱 밖(일반 브라우저로 ezlong.com 직접 방문)에서는 그냥 아무 메시지도
     안 와서 조용히 미사용 상태로 남는다 - 부작용 없음. */
  window.addEventListener('message', function (event) {
    if (!event || !event.data || event.data.source !== 'flipzen-app') return;
    if (event.data.action === 'scrollToTop') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    /* [2026-08-05 신설] 앱 하단바 왼쪽 '<' - 이 페이지 안에서 뒤로 간다.
       되돌아갈 곳이 없으면(앱이 방금 이 페이지를 처음 띄웠으면) 아무 일도
       일어나지 않는 것이 맞다 - 부모 창을 대신 되돌리면 사용자가 의도하지
       않은 화면 전환이 일어난다. */
    if (event.data.action === 'historyBack') {
      try {
        if (window.history.length > 1) window.history.back();
      } catch (e) { /* 무시 */ }
      return;
    }
  });
})();

/* ─────────────────────────────────────────────────────────────
   2026-08-06 - 당겨서 새로고침 (pull to refresh)

   모바일에서 페이지를 아래로 당겼다 놓으면 새로고침되게 한다.
   네이티브 앱 웹뷰에는 브라우저의 당겨서 새로고침이 없어서,
   시세 화면이 멈춘 줄 알고 앱을 껐다 켜는 일이 생긴다.

   ★ 왜 아무 데서나 켜지 않는가 ★
   모바일 브라우저(Safari·Chrome)는 페이지 최상단에서 당기면 이미 스스로
   새로고침한다. 거기에 우리 것을 얹으면 한 번의 제스처에 두 반응이 겹쳐
   화면이 두 번 튀거나, 브라우저 것이 먼저 먹어 우리 것이 죽는다.
   그래서 **브라우저가 해주지 않는 자리에서만** 켠다:
     · 앱 안의 웹뷰(iframe) - 부모가 스크롤을 쥐고 있어 기본 동작이 없다
     · 홈 화면에 추가한 PWA(standalone) - 브라우저 크롬이 없어 기본 동작이 없다
   일반 브라우저 탭에서는 아무것도 하지 않고 브라우저에게 맡긴다.

   ★ 손가락을 따라오게 만든다 ★
   당기는 동안 표시가 손가락과 1:1로 따라와야 "붙잡고 있다"는 느낌이 난다.
   다만 그대로 따라오면 한없이 늘어나므로 임계점을 넘어선 뒤로는 저항을
   키워(고무줄처럼) 점점 덜 따라오게 한다. 놓는 순간은 두 갈래다.
     · 임계점을 넘겼다 - 표시를 임계 위치에 세우고 새로고침한다
     · 못 넘겼다 - 튕김 없이 제자리로 되돌린다
   ───────────────────────────────────────────────────────────── */
(function setupPullToRefresh() {
  'use strict';

  function inIframe() {
    try { return window.self !== window.top; } catch (e) { return true; }
  }
  function isStandalone() {
    try {
      if (window.navigator.standalone === true) return true;
      return window.matchMedia('(display-mode: standalone)').matches;
    } catch (e) { return false; }
  }
  if (!('ontouchstart' in window)) return;
  if (!inIframe() && !isStandalone()) return;

  var THRESHOLD = 78;
  var MAX_PULL = 132;
  var RESIST = 0.55;

  var startY = 0, pulling = false, armed = false, refreshing = false, curDist = 0;

  var ind = document.createElement('div');
  ind.setAttribute('aria-hidden', 'true');
  ind.style.cssText = [
    'position:fixed', 'left:50%', 'top:0', 'z-index:2147483000',
    'width:36px', 'height:36px', 'margin-left:-18px',
    'border-radius:50%', 'pointer-events:none',
    'background:rgba(13,13,15,.92)',
    'box-shadow:0 6px 20px rgba(0,0,0,.28)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'transform:translate3d(0,-52px,0)', 'opacity:0'
  ].join(';');
  ind.innerHTML =
    '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" ' +
    'stroke="#4FC3F7" stroke-width="2.4" stroke-linecap="round" ' +
    'stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3.2-6.9"/>' +
    '<path d="M21 3v6h-6"/></svg>';
  var svg = ind.firstChild;

  function place(dist, animate) {
    curDist = dist;
    ind.style.transition = animate
      ? 'transform .34s cubic-bezier(.22,.9,.3,1), opacity .28s ease'
      : 'none';
    ind.style.transform = 'translate3d(0,' + (dist - 52) + 'px,0) rotate('
      + Math.min(360, dist * 3.2) + 'deg)';
    ind.style.opacity = dist > 6 ? String(Math.min(1, dist / 46)) : '0';
  }
  function attach() {
    if (!ind.parentNode && document.body) document.body.appendChild(ind);
  }

  /* 스크롤이 정말 맨 위인가. 문서뿐 아니라 손가락이 놓인 자리의 **안쪽
     스크롤 영역**까지 본다 - 안쪽을 읽는 중인데 페이지를 새로고침해
     버리면 읽던 자리를 통째로 잃는다. */
  function atTop(target) {
    var doc = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (doc > 0) return false;
    var el = target;
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.scrollHeight > el.clientHeight + 1) {
        var st = window.getComputedStyle(el).overflowY;
        if ((st === 'auto' || st === 'scroll') && el.scrollTop > 0) return false;
      }
      el = el.parentElement;
    }
    return true;
  }

  document.addEventListener('touchstart', function (e) {
    if (refreshing || e.touches.length !== 1) return;
    attach();
    startY = e.touches[0].clientY;
    armed = atTop(e.target);
    pulling = false;
    curDist = 0;
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!armed || refreshing || e.touches.length !== 1) return;
    var dy = e.touches[0].clientY - startY;
    if (dy <= 0) {
      if (pulling) { pulling = false; place(0, true); }
      return;
    }
    var dist = dy <= THRESHOLD ? dy : THRESHOLD + (dy - THRESHOLD) * RESIST;
    dist = Math.min(MAX_PULL, dist);
    if (dist > 4) {
      pulling = true;
      if (e.cancelable) e.preventDefault();
      place(dist, false);
    }
  }, { passive: false });

  function end() {
    if (!pulling || refreshing) { pulling = false; return; }
    var dist = curDist;
    pulling = false;
    if (dist >= THRESHOLD) {
      refreshing = true;
      place(THRESHOLD, true);
      svg.style.animation = 'ezPtrSpin .8s linear infinite';
      /* 표시가 제자리에 서는 것을 눈으로 확인할 짧은 틈을 준 뒤 새로고침한다.
         곧바로 reload 하면 흰 화면이 튀어 "눌리긴 한 건가" 싶어진다. */
      window.setTimeout(function () { window.location.reload(); }, 220);
    } else {
      place(0, true);
    }
  }
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', end, { passive: true });

  var ptrStyle = document.createElement('style');
  ptrStyle.textContent =
    '@keyframes ezPtrSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}';
  (document.head || document.documentElement).appendChild(ptrStyle);
})();

/* ─────────────────────────────────────────────────────────────
   주말 국면 판정 - 스윙 판단 카드가 "오늘"이라고 말할 수 있는 때인가
   (2026-08-08 신설)

   미국장은 금요일 마감 후 월요일까지 열리지 않는다. 그 사이에도 카드는
   금요일에 쓴 글을 "오늘의 스윙 판단"으로 걸고 있었다 - 구조적으로 거짓말이
   되는 구간이 매주 이틀씩 있었던 셈이다.

   토요일은 자연스럽다. 직전 장 마감 판단을 보는 게 맞다. 그런데 일요일
   오전을 넘기면 독자의 관심은 지난주가 아니라 다음 주로 옮겨간다.
   경계는 **보는 사람의 현지 시계**로 나눈다 - 서울의 일요일 오전과 뉴욕의
   일요일 오전은 같은 순간이 아니고, 각자 자기 일요일 아침에 다음 주를
   생각하기 때문이다.

   반환값
     'session'  평일 - 평소대로
     'weekend'  금 마감 ~ 현지 일요일 오전 - 직전 장 마감 판단
     'ahead'    현지 일요일 오전 이후 ~ 월요일 개장 전 - 새 주 전망

   ※ 같은 판정을 chief-strip.js 와 atmr-dashboard.html 이 함께 쓴다.
     여기 하나만 고치면 둘 다 따라온다 (공유 함수 동기화 원칙).
   ───────────────────────────────────────────────────────────── */
window.ezWeekPhase = function (now) {
  now = now || new Date();
  var et;
  try {
    et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  } catch (e) {
    et = now;
  }
  var ed = et.getDay(), em = et.getHours() * 60 + et.getMinutes();
  // 미국장이 안 열리는 주말 구간인가 - 금 20:00 ET(애프터마켓 종료) ~ 월 04:00 ET(프리마켓)
  // (58항) 이 구간을 화면 문구에서 '휴장'이라 부르지 않는다.
  var closed = (ed === 6) || (ed === 0) ||
               (ed === 5 && em >= 1200) || (ed === 1 && em < 240);
  if (!closed) return 'session';
  var d = now.getDay(), h = now.getHours();     // 여기부터는 보는 사람의 현지 시계
  if (d === 0 && h >= 9) return 'ahead';        // 현지 일요일 오전
  if (d === 1) return 'ahead';                  // 현지 월요일 - 개장 전
  return 'weekend';
};

/* ─────────────────────────────────────────────────────────────
   앱 웹뷰에서 외부 링크 열기 - 2026-08-08 에 index.html 에서 이리로 옮김.
   메인 페이지에만 있으면 새 코너를 만들 때마다 같은 먹통이 재발한다.
   ez-nav.js 는 모든 페이지가 로드하므로 여기 한 벌이면 전부 덮는다.
   (원래 주석은 아래 그대로 유지 - 왜 이 처리가 필요한지가 담겨 있다.)
   ───────────────────────────────────────────────────────────── */
/* ── 앱 웹뷰에서 외부 링크 열기 (2026-08-06 신설) ─────────────────────
   증상: Long Time, Easy Life 앱 안에서 네이버 프리미엄 글을 눌러도 아무
   일도 일어나지 않는다. 같은 링크가 사파리·크롬에서는 정상.
   책 구매 링크(알라딘·예스24·교보·리디·밀리)도 같은 원인으로 먹통.

   원인: 이 링크들은 target="_blank"인데, 앱 웹뷰에는 "새 탭"이라는 게
   없다. iOS WKWebView는 WKUIDelegate의 createWebViewWith 를 구현해야만
   새 창 요청을 처리하는데 이 앱은 구현하지 않았다 - 그래서 요청이 조용히
   버려진다. 에러도 안 나고 화면도 안 바뀌니 사용자에겐 "먹통"으로 보인다.
   (안드로이드는 shouldOverrideUrlLoading 이 외부 도메인을 Custom Tabs로
    넘기는 안전망이 이미 있어 대체로 열린다. 아래 처리를 거치면 양쪽이
    같은 경로를 타므로 동작이 통일된다.)

   해법: 앱이 이미 갖고 있는 네이티브 브릿지로 기기 브라우저를 연다.
   앱 재빌드 불필요 - 앱 웹뷰(ezlong.com/time/)와 이 페이지(ezlong.com)가
   동일 출처라, iframe 안에서도 상위 프레임의 브릿지에 접근할 수 있다.

   왜 인앱 시트가 아니라 기기 브라우저인가: 네이버 프리미엄은 로그인과
   구독 상태가 있어야 본문이 열리고, 서점은 로그인·장바구니·결제가 이어져야
   한다. 그 세션은 전부 평소 쓰는 브라우저에 있다. 과거 알라딘 로그인이
   인앱 시트 안에서 유지되지 않아 결국 기본 브라우저로 내보낸 전례와 같다.

   적용 범위: 이 페이지의 ezlong.com 바깥으로 나가는 모든 http(s) 링크.
   내부 이동은 건드리지 않고, mailto:·tel: 같은 다른 스킴도 제외한다. */
(function () {
  /* ezlong.com 밖으로 나가는 링크인가. 서브도메인·www 포함해서 자기
     사이트면 앱 웹뷰가 그대로 처리해야 하므로 가로채지 않는다.
     현재 호스트도 같이 본다 - 프리뷰 도메인(web.app)이나 로컬 테스트에서
     자기 사이트 링크가 "외부"로 오판돼 브라우저로 튕겨나가지 않게 한다. */
  function isSameSite(h) {
    if (h === String(location.hostname).toLowerCase()) return true;
    return h === 'ezlong.com' || h.slice(-11) === '.ezlong.com';
  }
  function isExternal(url) {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    return !isSameSite(url.hostname.toLowerCase());
  }

  /* 브릿지는 자기 프레임에 주입돼 있는 게 정상이지만, 주입 시점·프레임
     범위는 OS 버전에 따라 미묘하게 다르다. 자기 → 부모 → 최상위 순서로
     찾는다. 교차 출처면 접근 자체가 예외를 던지므로 전부 감싼다. */
  function findBridge() {
    var frames = [];
    try { frames.push(window); } catch (e) {}
    try { if (window.parent && window.parent !== window) frames.push(window.parent); } catch (e) {}
    try { if (window.top && frames.indexOf(window.top) < 0) frames.push(window.top); } catch (e) {}

    for (var i = 0; i < frames.length; i++) {
      var w = frames[i];
      try {
        var ios = w.webkit && w.webkit.messageHandlers && w.webkit.messageHandlers.flipzenNativeRadio;
        if (ios) {
          return function (url) { ios.postMessage({ action: 'openExternalSafari', url: url }); };
        }
      } catch (e) {}
      try {
        var aos = w.AndroidNativeBridge;
        if (aos && typeof aos.postMessage === 'function') {
          return function (url) {
            aos.postMessage('flipzenNativeRadio',
              JSON.stringify({ action: 'openExternalSafari', url: url }));
          };
        }
      } catch (e) {}
    }
    return null;
  }

  /* 앱 웹뷰 안인지 판정. 앱은 첫 진입 URL에 embed=app 을 붙이는데 이 값은
     첫 로드에만 있으므로 sessionStorage 에 새겨두고 이후 페이지에서 읽는다.
     상위 프레임에서 앱의 네이티브 브릿지가 보이면 그것만으로도 확정이다. */
  var EMBED_KEY = 'ezlong.embedApp';
  function inAppWebview() {
    try {
      if (new URLSearchParams(location.search).get('embed') === 'app') {
        try { sessionStorage.setItem(EMBED_KEY, '1'); } catch (e) {}
        return true;
      }
      if (sessionStorage.getItem(EMBED_KEY) === '1') return true;
    } catch (e) {}
    return !!findBridge();
  }

  /* 광고 게이트(ez-ads.js)가 같은 판정을 쓴다 - 59항. 앱이 남기는
     localStorage 열쇠 하나만 믿으면 딥링크·저장소 초기화로 열쇠 없는 앱
     화면이 생기고, 거기 광고가 뜨면 계정이 위험하다. 판정은 한 벌만 두고
     둘이 같이 본다(공유 함수 동기화 원칙). */
  /* 71항 - 판정 단일 출처는 head에서 먼저 로드되는 ez-app-banner.js 다.
     이미 정의돼 있으면 그것을 쓰고, 이 파일만 로드되는 경로를 위해 위 구현을
     폴백으로 남긴다. 아래 링크 처리도 같은 함수를 부른다(구현이 갈리지 않게). */
  window.ezInAppWebview = window.ezInAppWebview || inAppWebview;

  document.addEventListener('click', function (ev) {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey) return;

    var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a) return;

    var url;
    try { url = new URL(a.getAttribute('href'), location.href); } catch (e) { return; }
    if (!isExternal(url)) return;

    /* 1순위 - 네이티브 브릿지로 기기 브라우저 열기. 네이버 구독 세션도
       서점 로그인·장바구니도 전부 그쪽에 살아 있어야 끝까지 이어진다. */
    var send = findBridge();
    if (send) {
      ev.preventDefault();
      send(url.href);
      return;
    }

    /* 앱이 아니면(일반 브라우저) 손대지 않는다 - target="_blank"가 정상 동작. */
    if (!window.ezInAppWebview()) return;

    /* 2순위 - 앱인데 브릿지를 못 찾은 경우의 안전망. 여기서 그냥 두면
       화면에 아무 일도 안 일어나는 "먹통" 상태가 그대로 재현된다.
       진짜 새 탭을 한 번 시도해 보고, 웹뷰가 무시하면(null 반환) 이 프레임
       자체를 글로 이동시킨다. 앱 하단의 닫기·뒤로 버튼은 상위 프레임에
       있으므로 이 이동 뒤에도 그대로 남아 돌아올 수 있다. */
    var opened = null;
    try { opened = window.open(url.href, '_blank', 'noopener'); } catch (e) { opened = null; }
    if (opened) return;

    ev.preventDefault();
    location.href = url.href;
  }, true);
})();

/* ─────────────────────────────────────────────────────────────
   광고 게이트 로더 (2026-08-17 신설, 59항)

   ez-ads.js 는 평소에 아예 내려받지 않는다. 아직 송출하지 않는 기능 때문에
   전 페이지가 요청을 하나 더 지는 건 낭비다 - 필요할 때만 부른다.

   EZ_ADS_LIVE 가 이 사이트의 **유일한 송출 스위치**다. 스위치가 두 곳에
   있으면 반드시 한쪽이 뒤처지므로, 켤 때는 여기 한 줄만 true 로 바꾼다
   (그리고 ez-ads.js 의 PUB_ID 를 채운다).

   운영자 미리보기: 아무 페이지에나 ?ads=preview 를 한 번 붙이면 그 브라우저
   에서만 30일간 켜진다. ?ads=off 로 끈다. 미리보기 중에도 애드센스 스크립트는
   부르지 않고 자리와 판정만 그린다.
   ───────────────────────────────────────────────────────────── */
window.EZ_ADS_LIVE = false;
(function () {
  /* 어느 페이지에 광고를 두느냐는 페이지가 정한다 - <meta name="ez-ads" content="on">.
     스위치를 켜도 이 표시가 없는 페이지에는 아무것도 안 붙는다. 2026-08-17에
     11개 페이지의 하드코딩 애드센스를 전부 걷어냈으므로, 다시 켤 때는 원하는
     페이지에 이 한 줄을 넣는 것이 유일한 절차다. */
  var need = window.EZ_ADS_LIVE === true &&
             !!document.querySelector('meta[name="ez-ads"][content="on"]');
  if (!need) {
    try {
      var q = new URLSearchParams(location.search).get('ads');
      if (q === 'preview' || q === 'off') need = true;
      else if (localStorage.getItem('ezlong:adsPreview')) need = true;
    } catch (e) { /* 저장소 접근 불가 - 미리보기 없음 */ }
  }
  if (!need) return;
  var s = document.createElement('script');
  s.src = '/ez-ads.js?v=20260817a';
  s.defer = true;
  (document.head || document.documentElement).appendChild(s);
})();

/* ─────────────────────────────────────────────────────────────
   법적 고지 바 (2026-08-26 신설, CLAUDE.md 73항)

   애드센스 '가치 없는 콘텐츠' 판정의 원인 하나가 소개·방침·약관 부재였다.
   페이지가 141장인데 푸터 HTML은 제각각이라, 큰 푸터(ez-footer.js)를 쓰는
   36장에는 거기에 넣고, 나머지에는 여기서 최소한의 줄을 붙인다.
   두 번 붙지 않도록 큰 푸터가 있으면 건너뛴다.
   ───────────────────────────────────────────────────────────── */
(function () {
  var LINKS = [['/about.html', '소개'], ['/privacy.html', '개인정보처리방침'],
               ['/terms.html', '이용약관'], ['/disclaimer.html', '투자 유의사항'],
               ['/contact.html', '문의']];
  function paint() {
    if (document.querySelector('.ez-footer, .ez-legalbar')) return;   // 이미 있으면 끝
    if (document.querySelector('meta[name="robots"][content*="noindex"]')) return;
    var wrap = document.createElement('nav');
    wrap.className = 'ez-legalbar';
    wrap.setAttribute('aria-label', '사이트 정보');
    wrap.innerHTML = LINKS.map(function (l) {
      return '<a href="' + l[0] + '">' + l[1] + '</a>';
    }).join('') +
      '<span class="ez-legalbar-copy">© 2025–2026 유니아빠 · EZLONG</span>';
    document.body.appendChild(wrap);
  }
  if (document.readyState === 'complete') paint();
  else window.addEventListener('load', paint);
})();
