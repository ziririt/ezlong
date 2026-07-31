/* v2 베타 스트립 (v2 베타 페이지 전용)
 * data/swing-view.json(swing-view.yml 파이프라인 산출)을 읽어
 * 페이지 최상단에 오늘의 스탠스 + 논평 요약을 표시한다.
 * 원본 페이지에는 삽입하지 않는다 — _v2 페이지에서만 로드할 것.
 */
(function () {
  'use strict';
  var URL = 'https://raw.githubusercontent.com/ziririt/ezlong/main/data/swing-view.json';

  var css = [
    '.chief-strip{max-width:1080px;margin:10px auto 4px;padding:14px 16px 10px;border-radius:12px;',
    'border:1px solid rgba(120,120,128,0.25);border-left:4px solid #0071E3;background:#fff;color:#1C1C1E;',
    'font-size:16px;line-height:1.7;}',
    '.chief-strip .cs-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;}',
    '.chief-strip .cs-badge{background:#0071E3;color:#fff;border-radius:6px;padding:2px 8px;font-size:14px;font-weight:700;}',
    '.chief-strip .cs-stance{font-weight:800;font-size:16px;}',
    '.chief-strip .cs-meta{color:#6e6e73;font-size:14px;margin-top:4px;}',
    '.chief-strip a{color:#0071E3;text-decoration:none;font-weight:700;}',
    '@media (prefers-color-scheme: dark){',
    '.chief-strip .cs-badge,.v2-entry a{--noop:0;}',
    '.chief-strip{background:#1A1A1A;color:#F2F2F7;border-color:rgba(120,120,128,0.35);}',
    '.chief-strip .cs-meta{color:#98989F;}',
    '.chief-strip a{color:#0A84FF;}',
    '.chief-strip{border-left-color:#0A84FF;}',
    '.chief-strip .cs-badge{background:#0A84FF;}',
    '}'
  ].join('');

  function insert(view) {
    if (!view || !view.comp) return;
    var c = view.comp;
    var first = (c.commentary && c.commentary[0]) || '';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    var div = document.createElement('div');
    div.className = 'chief-strip';
    div.innerHTML =
      '<div class="cs-head">' +
      '<span class="cs-badge">v2 베타</span>' +
      '<span class="cs-stance">' + c.stanceLabel + '</span>' +
      '</div>' +
      (view.stanceChangedToday ? '<div style="font-weight:700;margin-bottom:4px;">오늘 스탠스가 바뀌었습니다.</div>' : '') +
      (view.flow ? '<div style="margin-bottom:4px;">판단 흐름 · ' + view.flow + '</div>' : '') +
      '<div>' + first + '</div>' +
      '<div class="cs-meta">' + view.generatedAtKST + ' 기준 · ' +
      '<a href="/atmr-dashboard_v2.html">전체 판단 보기</a> · ' +
      '<a href="' + location.pathname.replace('_v2', '') + '">기존 버전으로</a></div>';
    var nav = document.getElementById('ez-nav') || document.querySelector('nav');
    if (nav && nav.parentNode) {
      nav.parentNode.insertBefore(div, nav.nextSibling);
    } else {
      document.body.insertBefore(div, document.body.firstChild);
    }
  }

  function boot() {
    fetch(URL + '?t=' + Math.floor(Date.now() / 300000))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(insert)
      .catch(function () {});
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
