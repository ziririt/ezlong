// NYSE 거래일 캘린더 (88항). 단일 출처는 data/nyse-calendar.json. 파이썬 쌍둥이는 ez_calendar.py.
// 둘이 어긋나면 사고다: 규칙을 바꾸면 양쪽을 같이 고친다.
'use strict';
const fs = require('fs');
const path = require('path');

let _cal = null;
function load() {
  if (_cal) return _cal;
  const p = path.join(__dirname, '..', 'data', 'nyse-calendar.json');
  _cal = JSON.parse(fs.readFileSync(p, 'utf8'));
  _cal._h = new Set(_cal.holidays || []);
  _cal._e = new Set(_cal.earlyClose || []);
  return _cal;
}

function etParts(now) {
  const d = now || new Date();
  const s = d.toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' });
  // "Mon, 09/07/2026, 11:31"
  const m = s.match(/(\w{3}), (\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2})/);
  const dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[m[1]];
  return { ymd: `${m[4]}-${m[2]}-${m[3]}`, dow, min: parseInt(m[5], 10) % 24 * 60 + parseInt(m[6], 10) };
}

function isTradingDay(ymd, dow) {
  if (dow === undefined) {
    const [y, mo, da] = ymd.split('-').map(Number);
    dow = new Date(Date.UTC(y, mo - 1, da)).getUTCDay();
  }
  return dow >= 1 && dow <= 5 && !load()._h.has(ymd);
}

// 'PRE' | 'REGULAR' | 'POST' | 'CLOSED'  (generate-chart-analysis.js 의 marketState 어휘)
function usMarketState(now) {
  const p = etParts(now);
  if (!isTradingDay(p.ymd, p.dow)) return 'CLOSED';
  const close = load()._e.has(p.ymd) ? 13 * 60 : 16 * 60;
  if (p.min >= 240 && p.min < 570) return 'PRE';
  if (p.min >= 570 && p.min < close) return 'REGULAR';
  if (p.min >= close && p.min < 1200) return 'POST';
  return 'CLOSED';
}

function closedReason(now) {
  const p = etParts(now);
  if (p.dow === 0 || p.dow === 6) return 'weekend';
  if (load()._h.has(p.ymd)) return 'holiday';
  return 'night';
}

function shiftYmd(ymd, days) {
  const [y, mo, da] = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1, da + days));
  return d.toISOString().slice(0, 10);
}

// 마지막 실제 거래일 (오늘이 거래일이고 개장 후면 오늘)
function lastTradingDay(now) {
  const p = etParts(now);
  let d = p.ymd;
  if (!(isTradingDay(d, p.dow) && p.min >= 570)) d = shiftYmd(d, -1);
  while (!isTradingDay(d)) d = shiftYmd(d, -1);
  return d;
}

function holidayName(ymd) { return (load().holidayNames || {})[ymd] || null; }

function calendarWarning(now) {
  const vu = load().validUntil; if (!vu) return null;
  const left = Math.round((Date.parse(vu) - Date.parse(etParts(now).ymd)) / 86400000);
  return left <= 60 ? `[ez-calendar] data/nyse-calendar.json 유효기간이 ${left}일 남았다(${vu}). 다음 해 휴장일을 채워라.` : null;
}

module.exports = { load, etParts, isTradingDay, usMarketState, closedReason, lastTradingDay, holidayName, calendarWarning };

if (require.main === module) {
  const p = etParts();
  console.log('ET now       :', p.ymd, 'dow', p.dow, 'min', p.min);
  console.log('trading day? :', isTradingDay(p.ymd, p.dow), holidayName(p.ymd) || '');
  console.log('marketState  :', usMarketState(), usMarketState() === 'CLOSED' ? '(' + closedReason() + ')' : '');
  console.log('lastTrading  :', lastTradingDay());
  const w = calendarWarning(); if (w) console.log(w);
  if (isTradingDay('2026-09-07')) throw new Error('노동절이 거래일로 잡힌다');
  if (!isTradingDay('2026-09-08')) throw new Error('09-08이 거래일이 아니다');
  if (lastTradingDay(new Date('2026-09-07T18:00:00Z')) !== '2026-09-04') throw new Error('lastTradingDay 오류');
  console.log('selftest OK');
}
