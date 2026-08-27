/* 스윙 판단 스트립 (전 페이지 공통) (v2 베타 페이지 전용)
 * data/swing-view.json(swing-view.yml 파이프라인 산출)을 읽어
 * 페이지 최상단에 오늘의 스탠스 + 논평 요약을 표시한다.
 * 주가·기술분석 페이지 공통 상단 띠.
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
    '.chief-strip .cs-g{color:#1A7F37;font-weight:700;}',
    '.chief-strip .cs-r{color:#D92A2A;font-weight:700;}',
    '.chief-strip .cs-b{color:#0071E3;font-weight:700;}',
    '@media (prefers-color-scheme: dark){',
    '.chief-strip .cs-g{color:#30D158;}.chief-strip .cs-r{color:#FF453A;}.chief-strip .cs-b{color:#0A84FF;}',
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
    function colorize(t) {
      return String(t || '')
        .replace(/\[G\](.*?)\[\/G\]/g, '<strong class="cs-g">$1</strong>')
        .replace(/\[R\](.*?)\[\/R\]/g, '<strong class="cs-r">$1</strong>')
        .replace(/\[B\](.*?)\[\/B\]/g, '<strong class="cs-b">$1</strong>');
    }
    /* 주말 국면: 금 마감 후에는 "오늘의 판단"이라고 부를 수 없다.
       (58항) 토·일에 장이 안 열리는 것을 화면에서 '휴장'이라고 부르지 않는다.
       금요일 장이 끝나면 다음 장은 월요일: 독자가 이미 아는 사실이다.
       현지 일요일 오전을 넘기면 새 주 전망으로 갈아탄다 (ez-nav.js: ezWeekPhase). */
    var phase = (typeof window.ezWeekPhase === 'function') ? window.ezWeekPhase() : 'session';
    var wa = view.weekAhead;
    var useAhead = (phase === 'ahead' && wa && wa.headline);
    var badge = phase === 'session' ? '오늘의 스윙 판단'
              : useAhead ? '새 주 전망' : '직전 장 마감 판단';
    var first = colorize(
      useAhead ? wa.headline
               : ((view.desked && view.desked.headline) || (c.commentary && c.commentary[0]) || ''));
    var asOf = phase === 'session'
      ? view.generatedAtKST + ' 기준'
      : (useAhead ? '직전 장 ' + (view.dataDay || '') + '(미국장) 마감 자료 기준'
                  : view.generatedAtKST + ' 기준 · 직전 장 ' + (view.dataDay || '') + '(미국장) 마감');
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    var div = document.createElement('div');
    div.className = 'chief-strip';
    div.innerHTML =
      '<div class="cs-head">' +
      '<span class="cs-badge">' + badge + '</span>' +
      '<span class="cs-stance">' + c.stanceLabel + '</span>' +
      '</div>' +
      (phase === 'session' && view.stanceChangedToday && !view.flow ? '<div style="font-weight:700;margin-bottom:4px;">오늘 스탠스가 바뀌었습니다.</div>' : '') +
      (view.flow && !useAhead ? '<div style="margin-bottom:4px;">' + view.flow + '</div>' : '') +
      '<div>' + first + '</div>' +
      '<div class="cs-meta">' + asOf + ' · ' +
      '<a href="/atmr-dashboard.html">전체 판단 보기</a></div>';
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
