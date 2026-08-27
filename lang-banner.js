/* ═══════════════════════════════════════════════════════════════════════
   EZLONG: 브라우저 언어 감지 배너 (2026-07-29)
   목적: 방문자의 브라우저 언어와 현재 페이지 언어가 다르면 하단에 다른
   언어로 보기를 "제안"하는 배너를 띄운다. 자동 하드 리다이렉트는 하지
   않는다: 검색엔진 크롤러가 다른 언어판을 못 들어가는 문제를 피하기
   위함(구글 공식 권고). 이미 6개 언어 hreflang이 배선돼 있으므로 색인은
   그쪽에 맡기고, 이 배너는 순수 UX 편의 기능이다.

   전 페이지 공통 로드: <script src="/lang-banner.js"></script>
   (ez-nav.js/ez-footer.js와 동일하게 절대경로 1개 파일: 개별 페이지 수정 금지,
   이 파일 하나만 고칠 것)
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var LANGS = ['ko', 'en', 'ja', 'es', 'pt', 'zh'];

  // 6개 언어 전체에 존재하지 않는 예외 페이지만 명시. 목록에 없으면
  // "6개 언어 전부 존재"로 간주(기본값): 새 페이지를 6개 언어에 동시
  // 추가하는 한 이 매니페스트를 매번 갱신할 필요가 없다.
  var PAGE_LANGS = {
    'auto-dca-guide.html': ['ko', 'en', 'ja'],
    'tax-account-simulator.html': ['ko', 'en', 'ja'],
    'today-chart.html': ['ko', 'en'],
    'isa-irp-us-stock-tax-comparison.html': ['ko'],
    'market-scorecard.html': ['ko'],
    // 2026-08-08 신설: 아직 한국어판만 있다. 번역본이 올라가면 이 줄에
    // 언어를 추가한다. 여기 없으면 배너가 없는 페이지로 안내한다.
    'model-portfolio.html': ['ko']
  };

  function pageLangs(file) {
    return PAGE_LANGS.hasOwnProperty(file) ? PAGE_LANGS[file] : LANGS;
  }

  // ── 배너 문구 (타겟 언어로 표시: 방문자가 읽을 수 있는 언어로 안내) ──
  var TXT = {
    ko: { msg: '이 사이트를 한국어로 보시겠어요?', go: '한국어로 보기', stay: '괜찮아요' },
    en: { msg: 'Would you like to view this site in English?', go: 'View in English', stay: 'No thanks' },
    ja: { msg: 'このサイトを日本語で表示しますか?', go: '日本語で見る', stay: '結構です' },
    es: { msg: '¿Quieres ver este sitio en español?', go: 'Ver en español', stay: 'No, gracias' },
    pt: { msg: 'Deseja ver este site em português?', go: 'Ver em português', stay: 'Não, obrigado' },
    zh: { msg: '是否要以中文查看本网站?', go: '查看中文版', stay: '不用了' }
  };

  function currentLang() {
    var m = location.pathname.match(/^\/(en|ja|es|pt|zh)(\/|$)/);
    return m ? m[1] : 'ko';
  }

  function currentPageKey() {
    var parts = location.pathname.split('/').filter(function (s) { return s.length > 0; });
    if (parts.length && LANGS.indexOf(parts[0]) !== -1) parts.shift(); // 언어 접두 제거
    if (!parts.length) return 'index.html';
    var last = parts[parts.length - 1];
    return last.indexOf('.html') !== -1 ? last : 'index.html';
  }

  function detectPreferred() {
    var prefs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'en'];
    for (var i = 0; i < prefs.length; i++) {
      var code = String(prefs[i]).toLowerCase().split('-')[0];
      if (LANGS.indexOf(code) !== -1) return code;
    }
    return 'en'; // 미지원 언어 → 영문 기본
  }

  function buildUrl(lang, file) {
    var avail = pageLangs(file);
    var useFile = avail.indexOf(lang) !== -1 ? file : 'index.html';
    if (lang === 'ko') return useFile === 'index.html' ? '/' : '/' + useFile;
    return '/' + lang + '/' + (useFile === 'index.html' ? '' : useFile);
  }

  function getChoice() {
    try { return localStorage.getItem('ezlong_lang_choice'); } catch (e) { return null; }
  }
  function setChoice(lang) {
    try { localStorage.setItem('ezlong_lang_choice', lang); } catch (e) {}
  }

  function isEmbeddedApp() {
    try {
      var qp = new URLSearchParams(location.search).get('embed') === 'app';
      if (qp) { try { sessionStorage.setItem('ezlong_embed', '1'); } catch (e) {} }
      return qp || (sessionStorage.getItem('ezlong_embed') === '1');
    } catch (e) { return false; }
  }

  function injectStyle() {
    if (document.getElementById('ezlb-style')) return;
    var css = ''
      + '#ezlb-bar{position:fixed;left:0;right:0;bottom:0;z-index:99999;'
      + 'display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;'
      + 'padding:12px 20px;font-size:15px;line-height:1.4;'
      + 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;'
      + 'background:#FFFFFF;color:#1D1D1F;border-top:1px solid rgba(0,0,0,0.08);'
      + 'box-shadow:0 -2px 12px rgba(0,0,0,0.08);}'
      + '#ezlb-bar .ezlb-msg{font-weight:500;}'
      + '#ezlb-bar button{font-size:15px;font-weight:600;border-radius:8px;padding:8px 16px;'
      + 'cursor:pointer;border:none;font-family:inherit;line-height:1.2;}'
      + '#ezlb-bar .ezlb-go{background:#0071E3;color:#FFFFFF;}'
      + '#ezlb-bar .ezlb-stay{background:transparent;color:#3C3C3E;text-decoration:underline;padding:8px 6px;}'
      + '@media (prefers-color-scheme: dark){'
      + '#ezlb-bar{background:#111111;color:#FFFFFF;border-top:1px solid rgba(255,255,255,0.14);'
      + 'box-shadow:0 -2px 12px rgba(0,0,0,0.4);}'
      + '#ezlb-bar .ezlb-go{background:#0A84FF;}'
      + '#ezlb-bar .ezlb-stay{color:#C8C8CC;}'
      + '}'
      + '@media (max-width:480px){#ezlb-bar{font-size:14px;padding:10px 14px;}'
      + '#ezlb-bar button{font-size:14px;padding:7px 12px;}}';
    var style = document.createElement('style');
    style.id = 'ezlb-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function showBanner(targetLang, curLang) {
    if (document.getElementById('ezlb-bar')) return;
    injectStyle();

    var t = TXT[targetLang] || TXT.en;
    var url = buildUrl(targetLang, currentPageKey());

    var bar = document.createElement('div');
    bar.id = 'ezlb-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-live', 'polite');

    var msg = document.createElement('span');
    msg.className = 'ezlb-msg';
    msg.textContent = t.msg;

    var goBtn = document.createElement('button');
    goBtn.type = 'button';
    goBtn.className = 'ezlb-go';
    goBtn.textContent = t.go;
    goBtn.addEventListener('click', function () {
      setChoice(targetLang);
      location.href = url;
    });

    var stayBtn = document.createElement('button');
    stayBtn.type = 'button';
    stayBtn.className = 'ezlb-stay';
    stayBtn.textContent = t.stay;
    stayBtn.addEventListener('click', function () {
      setChoice(curLang);
      bar.remove();
    });

    bar.appendChild(msg);
    bar.appendChild(goBtn);
    bar.appendChild(stayBtn);
    document.body.appendChild(bar);
  }

  function init() {
    try {
      if (isEmbeddedApp()) return; // 네이티브 앱 웹뷰: 언어 전환은 앱이 담당

      var cur = currentLang();
      var choice = getChoice();
      if (choice === cur) return; // 이미 이 언어로 보기로 정한 적 있음

      var pref = detectPreferred();
      if (pref === cur) return; // 이미 선호 언어로 보는 중

      showBanner(pref, cur);
    } catch (e) { /* 배너 실패는 페이지 기능에 영향 없어야 함 */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 테스트/디버깅용 내부 함수 노출 (프로덕션 동작에는 영향 없음)
  window._ezlbTest = {
    currentLang: currentLang,
    currentPageKey: currentPageKey,
    detectPreferred: detectPreferred,
    buildUrl: buildUrl,
    pageLangs: pageLangs
  };
})();
