/* v2 베타 입구 배지 (원본 페이지 전용)
 * 같은 이름의 _v2 베타 페이지가 있는 원본 페이지 상단에 "2.0 beta" 입구를 표시한다.
 * atmr-dashboard.html은 탭별 입구가 별도로 있으므로 이 스크립트를 넣지 않는다.
 */
(function () {
  'use strict';
  var page = location.pathname.replace(/^\//, '') || 'index.html';
  if (page.indexOf('_v2') !== -1) return;               // v2 페이지에서는 표시 안 함
  var HAS_V2 = ['chart-analysis.html', 'market-scorecard.html', 'stocks.html', 'market-cycle.html'];
  if (HAS_V2.indexOf(page) === -1) return;
  var target = '/' + page.replace('.html', '_v2.html');

  var css = [
    '.v2-entry{max-width:1080px;margin:8px auto 0;text-align:right;padding:0 12px;}',
    '.v2-entry a{display:inline-block;font-size:14px;font-weight:700;color:#0071E3;',
    'border:1px dashed #0071E3;border-radius:8px;padding:3px 12px;text-decoration:none;}',
    '@media (prefers-color-scheme: dark){.v2-entry a{color:#0A84FF;border-color:#0A84FF;}}'
  ].join('');

  function boot() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    var div = document.createElement('div');
    div.className = 'v2-entry';
    div.innerHTML = '<a href="' + target + '">2.0 beta — 시험 버전</a>';
    var nav = document.getElementById('ez-nav') || document.querySelector('nav');
    if (nav && nav.parentNode) {
      nav.parentNode.insertBefore(div, nav.nextSibling);
    } else {
      document.body.insertBefore(div, document.body.firstChild);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
