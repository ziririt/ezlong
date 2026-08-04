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
  /* [href, 짧은 이름(PC칩), 긴 이름(모바일 오버레이)]
     2026-08-04: 첫 항목을 3개로 분리 (성동님 지시) — 스윙 시그널 대시보드의
     3개 탭(시그널/전략/TOP9)에 해시 딥링크로 각각 직접 진입. 활성 판정은
     아래 루프에서 pathname+hash 조합으로 처리한다. */
  var links = [
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
  var activeShort = '메뉴';
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
