(function () {
  'use strict';
  /* 다음 장 체크포인트 (2026-10-18).
     data/swing-checkpoints.json 을 읽어 두 자리에 그린다.
       #checkpoint-panel       시장 탭: 나스닥100 · S&P500 · 반도체
       #checkpoint-panel-top9  TOP9 탭: 아홉 종목
     기준선 · 기저율 · 채점은 전부 scripts/generate-swing-checkpoints.py 가 계산한다.
     이 파일은 그리기만 한다. 모델을 부르지 않는다.

     시장 판정이 바뀌는 기준은 '반등·반락 판별' 패널의 상방·하방이다(상위 판정).
     여기 가격선은 그 사이에서 하루 단위로 보는 관찰선이라 이름을 달리 쓴다:
     '상방/하방'이 아니라 '위 가격선/아래 가격선'. */
  var URL = '/data/swing-checkpoints.json';
  var STALE_HOURS = 110;   // 사흘 연휴(금·월 휴장) + 실행 지연을 감싼다
  var WD = ['일', '월', '화', '수', '목', '금', '토'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function px(v) {
    if (typeof v !== 'number' || !isFinite(v)) return '-';
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function pct(v) { return (typeof v === 'number' && isFinite(v)) ? (v > 0 ? '+' : '') + v.toFixed(1) + '%' : ''; }
  function dayLabel(iso, withWd) {
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    var p = iso.split('-').map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return p[1] + '월 ' + p[2] + '일' + (withWd ? '(' + WD[d.getUTCDay()] + ', 뉴욕)' : '');
  }
  function baseText(lv) {
    if (lv.base == null) return '';
    var b = lv.base < 1 ? '1% 미만' : lv.base + '%';
    return '하루 만에 이 거리를 ' + (lv.side === 'support' ? '내려간' : '올라간') + ' 날: 평소 ' + b;
  }
  var RESULT = {
    held: ['지킴', 'ok'], held_wick: ['지킴(장중 이탈 후 회복)', 'ok'],
    broken_support: ['이탈', 'dn'],
    capped: ['막힘', 'ok'], capped_wick: ['막힘(장중 돌파 후 밀림)', 'ok'],
    broken_resistance: ['돌파', 'up']
  };
  function resultChip(lv) {
    var key = lv.result === 'broken' ? 'broken_' + lv.side : lv.result;
    var r = RESULT[key];
    if (!r) return '';
    return '<span class="cp-res cp-res-' + r[1] + '">' + esc(r[0]) + '</span>';
  }

  function levelRow(lv, i) {
    var role = lv.side === 'resistance' ? '위 가격선' : (i === 0 ? '아래 가격선' : '그 아래');
    return '<li class="cp-lv cp-' + (lv.side === 'resistance' ? 'resistance' : 'support') + '"><span class="cp-role">' + role + '</span>' +
      '<span class="cp-v">' + px(lv.v) + '</span>' +
      '<span class="cp-name">' + esc(lv.name) + ' · ' + pct(lv.dist) + '</span>' +
      '<span class="cp-base">' + esc(baseText(lv)) + '</span></li>';
  }

  function lastRow(sym, D) {
    var it = D.last && D.last.items && D.last.items[sym];
    if (!it || !it.levels || !it.levels.length || !it.next) return '';
    return '<div class="cp-last"><span class="cp-last-h">' + esc(dayLabel(D.last.session)) +
      ' 가격선 → ' + esc(dayLabel(it.next.session || D.last.scoredWith)) + ' 종가 ' + px(it.next.close) + '</span>' +
      it.levels.map(function (lv) {
        return '<span class="cp-last-i">' + px(lv.v) + ' ' + resultChip(lv) + '</span>';
      }).join('') + '</div>';
  }

  function recordBlock(D, group) {
    var r = D.record && D.record[group];
    if (!r || !r.sessions) return '';
    var s = r.support || {}, t = r.resistance || {};
    var from = r.from ? dayLabel(r.from) : '', to = r.to ? dayLabel(r.to) : '';
    var bf = r.bfSessions ? ' · 이 가운데 ' + r.bfSessions + '장은 같은 규칙으로 소급 계산' : '';
    var gapS = (s.rate != null && s.expRate != null) ? s.rate - s.expRate : null;
    var gapT = (t.rate != null && t.expRate != null) ? t.rate - t.expRate : null;
    var verdict = '';
    if (gapS != null && gapT != null) {
      verdict = (Math.abs(gapS) <= 3 && Math.abs(gapT) <= 3)
        ? '선 자체의 힘: 거리만으로 본 평소 비율과 차이 3%p 이내. 가격선은 거리를 재는 눈금으로 읽는 편이 정확.'
        : '선 자체의 힘: 지지 ' + (gapS >= 0 ? '+' : '') + gapS + '%p · 저항 ' + (gapT >= 0 ? '+' : '') + gapT +
          '%p(거리만으로 본 평소 비율 대비).';
    }
    return '<div class="cp-record"><h3>채점 누적</h3><ul>' +
      '<li>' + esc(from) + '~' + esc(to) + ' · ' + esc(r.sessions) + '장' + esc(bf) + '</li>' +
      (s.n ? '<li>아래 가격선 ' + esc(s.n) + '개 중 다음 장 종가로 지킨 비율 <b>' + esc(s.rate) + '%</b> · 같은 거리의 평소 비율 ' + esc(s.expRate) + '%</li>' : '') +
      (t.n ? '<li>위 가격선 ' + esc(t.n) + '개 중 다음 장 종가로 막힌 비율 <b>' + esc(t.rate) + '%</b> · 같은 거리의 평소 비율 ' + esc(t.expRate) + '%</li>' : '') +
      (verdict ? '<li>' + esc(verdict) + '</li>' : '') +
      '</ul></div>';
  }

  function render(el, group, D, title, scope) {
    var list = (D.groups && D.groups[group]) || [];
    if (!list.length) { el.innerHTML = ''; return; }
    var ageH = (Date.now() - Date.parse(D.generatedAt)) / 3600000;
    var stale = !(ageH < STALE_HOURS);
    el.innerHTML =
      '<div class="cp-head"><h2>' + esc(title) + '</h2>' +
      '<span class="cp-time' + (stale ? ' cp-old' : '') + '">' + esc(dayLabel(D.session, true)) + ' 종가 기준' +
      (stale ? ' · 갱신 지연' : '') + '</span></div>' +
      '<p class="cp-scope">' + esc(scope) + '</p>' +
      '<div class="cp-list">' + list.map(function (it) {
        return '<section class="cp-item"><div class="cp-item-h"><span class="cp-item-n">' + esc(it.name) +
          ' <b translate="no">' + esc(it.sym) + '</b></span><span class="cp-item-c">' + px(it.close) + '</span></div>' +
          '<ul class="cp-lvs">' + (it.levels || []).map(function (lv, i) {
            var supIdx = it.levels.filter(function (x, j) { return j < i && x.side === 'support'; }).length;
            return levelRow(lv, lv.side === 'support' ? supIdx : 0);
          }).join('') + '</ul>' + lastRow(it.sym, D) + '</section>';
      }).join('') + '</div>' +
      recordBlock(D, group) +
      '<p class="cp-note">가격선: 20·50·200일 이동평균, 최근 60거래일의 전환점 고가·저가, 52주 고가·저가 중 종가에서 0.5% 이상 떨어진 가장 가까운 선. ' +
      '평소 비율: 그 종목 최근 500거래일 하루 등락률 분포. 채점: 다음 장 종가 기준. ' +
      '관찰 기준이지 목표가·손절 권고가 아니며 과거 비율이 앞으로를 보장하지 않음.</p>';
  }

  function boot() {
    var a = document.getElementById('checkpoint-panel');
    var b = document.getElementById('checkpoint-panel-top9');
    if (!a && !b) return;
    var bucket = Math.floor(Date.now() / 600000);   // 10분 단위: 갱신 직후 옛 파일을 한 시간씩 붙잡지 않게
    fetch(URL + '?t=' + bucket).then(function (r) { return r.ok ? r.json() : null; }).then(function (D) {
      if (!D || !D.groups) return;
      if (a) try { render(a, 'market', D, '다음 장 체크포인트',
        '세 지수의 위아래 가장 가까운 가격선과, 그 거리를 하루에 넘은 날이 평소 몇 %였는지. ' +
        '시장 판정이 바뀌는 기준은 위 반등·반락 판별의 상방·하방이고, 여기 가격선은 그 사이의 하루 단위 관찰선.'); } catch (e) { a.innerHTML = ''; }
      if (b) try { render(b, 'top9', D, 'TOP9 다음 장 체크포인트',
        '아홉 종목의 위아래 가장 가까운 가격선과, 그 거리를 하루에 넘은 날이 평소 몇 %였는지. 다음 장이 끝나면 지킴·이탈을 채점.'); } catch (e) { b.innerHTML = ''; }
    }).catch(function () { /* 없으면 자리를 비워 둔다 */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
