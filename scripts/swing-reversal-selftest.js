#!/usr/bin/env node
/* 반등·반락 판별 엔진 시험.
   실행: node scripts/swing-reversal-selftest.js

   1부는 외부 세션(Codex)이 미리보기와 함께 넘긴 12건을 **그대로** 옮긴 것이다.
   원안의 판정이 반영 과정에서 달라지지 않았는지 보는 기준선이다.
   2부는 ezlong 에서 더한 것 - 기존 판정과의 관계, 스냅샷 경과 시간.
   3부는 오늘 실제 데이터로 돌려 화면이 깨지지 않는지 본다. */
'use strict';

const assert = require('node:assert/strict');
const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { evaluate, VERSION, STALE_HOURS, NOTICE_HOURS } = require(path.join(ROOT, 'swing-reversal.js'));

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? '  — ' + d : ''));

/* ══════════════════════════════════════════════════════════════════
   1부 — 원안 12건 (기준선). 판정 문자열이 하나라도 달라지면 실패한다.
══════════════════════════════════════════════════════════════════ */
console.log('\n[1부] 원안 12건 기준선');
{
  const now = Date.parse('2026-09-13T00:00:00Z');
  const base = {price:110,sma20:105,sma50:100,sma200:90,high20dExcl:115,low20dExcl:95,
                rsi:55,rsi5dAgo:45,macd:{histogram:2},hist5dAgo:1,volRatio:1.3,changePct:1};
  const doc = s => ({generatedAt:new Date(now).toISOString(), symbols:{QQQ:{...base,...s}, VOO:base}});
  const T = [
    ['기본',                     doc(),                                          r => r.state === '회복 우세 · 추세 관찰'],
    ['20일 저가 이탈',            doc({price:94}),                                r => r.state === '하방 이탈 · 반락 경계'],
    ['20일 고가 돌파',            doc({price:120}),                               r => r.state === '상방 돌파 · 지지 확인 대기'],
    ['200일선 아래 + 모멘텀 개선', doc({sma200:120}),                              r => r.state === '하락 추세 속 반등 시도'],
    ['200일선 위 + 약세',         doc({price:99,rsi:30,macd:{histogram:-2}}),      r => r.state === '상승 추세 속 반락 경계'],
    ['가격 없음',                 doc({price:null}),                              r => r.ready === false],
    ['고가 <= 저가',              doc({low20dExcl:115}),                          r => r.ready === false],
    ['없는 종목',                 doc(),                                          r => r.ready === false, 'MISSING'],
    ['문턱 초과',                 doc(),                                          r => r.ready === false, 'QQQ', now + 97 * 3600000],
    ['미래 시각',                 doc(),                                          r => r.ready === false, 'QQQ', now - 3600000],
    ['RSI 없음 -> 모멘텀 중립',    doc({rsi:null}),                                r => r.axes[1].direction === 0],
    ['스냅샷 자체가 없음',         null,                                           r => r.ready === false],
  ];
  T.forEach(([label, snap, check, tk, at]) => {
    const r = evaluate(snap, tk || 'QQQ', at || now);
    ok(`원안: ${label}`, check(r), `얻은 값 state=${r.state} ready=${r.ready}`);
  });
  ok('버전에 원안 표기가 남아 있다', /^reversal-beta-1/.test(VERSION), VERSION);
}

/* ══════════════════════════════════════════════════════════════════
   2부 — ezlong 에서 더한 것
══════════════════════════════════════════════════════════════════ */
console.log('[2부] 기존 판정과의 관계 · 경과 시간');
{
  const now = Date.parse('2026-09-13T00:00:00Z');
  const base = {price:110,sma20:105,sma50:100,sma200:90,high20dExcl:115,low20dExcl:95,
                rsi:55,rsi5dAgo:45,macd:{histogram:2},hist5dAgo:1,volRatio:1.3,changePct:1};
  const doc = s => ({generatedAt:new Date(now).toISOString(), symbols:{QQQ:{...base,...s}, VOO:base}});

  /* 실측 재현(2026-09-13 IWM): 구조는 하방 이탈인데 매수 점수가 72 였다.
     이 조합에서 화면이 어긋남을 말하지 않으면 13절 위반이다. */
  {
    const r = evaluate(doc({price:94, buyScore:72, sellScore:11, gear:3}), 'QQQ', now);
    ok('하방 이탈 + 높은 매수 점수 -> 어긋남으로 표시', r.alignment && r.alignment.conflict === true);
    ok('어긋남 설명에 FEAR 설계를 밝힌다', /FEAR 50%/.test(r.alignment.note), r.alignment.note.slice(0, 50));
    ok('기존 숫자를 그대로 싣는다',
       r.alignment.buyScore === 72 && r.alignment.sellScore === 11 && r.alignment.gear === 3);
  }
  {
    const r = evaluate(doc({price:120, buyScore:30, gear:1}), 'QQQ', now);
    ok('돌파 + 낮은 매수 점수 -> 어긋남으로 표시', r.alignment.conflict === true);
    ok('추격 진입 여부를 먼저 가르라고 말한다', /추격 진입/.test(r.alignment.note));
  }
  {
    const r = evaluate(doc({price:120, buyScore:70, gear:3}), 'QQQ', now);
    ok('돌파 + 높은 매수 점수 -> 어긋남 아님', r.alignment.conflict === false);
    ok('같은 가격에서 나온 두 시선임을 밝힌다', /서로를 증명하지는/.test(r.alignment.note));
  }
  {
    const r = evaluate(doc(), 'QQQ', now);           // buyScore 없음
    ok('기존 점수가 없으면 견주지 않는다', r.alignment === null);
  }
  {
    const r = evaluate(doc({price:94}), 'QQQ', now); // 판정은 되지만 점수 없음
    ok('점수 없이도 본 판정은 나온다', r.ready === true && r.state === '하방 이탈 · 반락 경계');
  }

  /* 경과 시간 */
  {
    const r = evaluate(doc(), 'QQQ', now + 5 * 3600000);
    ok('경과 시간을 숫자로 돌려준다', Math.abs(r.ageHours - 5) < 1e-9, String(r.ageHours));
  }
  ok('문턱과 알림 기준이 노출된다', STALE_HOURS === 96 && NOTICE_HOURS === 24);
  ok('알림 기준이 문턱보다 작다', NOTICE_HOURS < STALE_HOURS);
  {
    const r = evaluate(doc(), 'QQQ', now + (STALE_HOURS - 1) * 3600000);
    ok('문턱 직전까지는 판정한다', r.ready === true);
    const r2 = evaluate(doc(), 'QQQ', now + (STALE_HOURS + 1) * 3600000);
    ok('문턱을 넘기면 보류한다', r2.ready === false);
  }

  /* 모델을 부르지 않는다 */
  const src = fs.readFileSync(path.join(ROOT, 'swing-reversal.js'), 'utf8');
  ok('모델 API 를 부르지 않는다', !/gemini|anthropic|openai|generativelanguage/i.test(src));
  ok('읽는 데이터는 market-signals 하나뿐',
     (src.match(/fetch\(/g) || []).length === 1 && src.includes('/data/market-signals.json'));
  ok('출력은 이스케이프한다', /function .*escape|const escape/.test(src));

  /* 화면 규칙 */
  const css = fs.readFileSync(path.join(ROOT, 'swing-reversal.css'), 'utf8');
  const small = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map(m => Number(m[1])).filter(v => v < 14);
  ok('14px 미만 글자가 없다', small.length === 0, JSON.stringify(small));
  ok('터치 대상 44px', /min-height:44px/.test(css));
  ok('포커스 표시가 있다', /:focus-visible/.test(css));
  ok('600px 에서 한 열로 접는다', /max-width:600px/.test(css));
  ok('라이트모드에서 노랑을 텍스트로 쓰지 않는다', /#B87900/.test(css));
}

/* ══════════════════════════════════════════════════════════════════
   3부 — 오늘 실제 데이터
══════════════════════════════════════════════════════════════════ */
console.log('[3부] 실제 데이터 전수');
{
  const snap = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'market-signals.json'), 'utf8'));
  const now = Date.parse(snap.generatedAt) + 3600000;   // 생성 1시간 뒤로 고정해 시각 의존을 없앤다
  const syms = Object.keys(snap.symbols);
  ok('종목이 열 개 이상', syms.length >= 10, String(syms.length));

  let ready = 0, withAlign = 0, conflicts = 0;
  syms.forEach(t => {
    const r = evaluate(snap, t, now);
    ok(`${t}: 판정이 문자열로 나온다`, typeof r.state === 'string' && r.state.length > 0);
    if (!r.ready) return;
    ready++;
    ok(`${t}: 축이 넷`, r.axes.length === 4, String(r.axes.length));
    ok(`${t}: 축 방향이 -1/0/1`, r.axes.every(a => [-1,0,1].includes(a.direction)));
    ok(`${t}: 지지 < 저항`, r.support < r.resistance, `${r.support} / ${r.resistance}`);
    ok(`${t}: 가격이 유한값`, Number.isFinite(r.price));
    if (r.alignment) { withAlign++; if (r.alignment.conflict) conflicts++; }
  });
  ok('절반 이상 판정된다', ready >= syms.length / 2, `${ready}/${syms.length}`);
  ok('판정된 종목은 기존 점수와 견줘진다', withAlign === ready, `${withAlign}/${ready}`);
  console.log(`   판정 ${ready}/${syms.length} · 기존 판정과 어긋남 ${conflicts}건`);
}

console.log(`\n통과 ${pass} / 실패 ${fails.length}`);
if (fails.length) { console.log('\n실패'); fails.forEach(f => console.log('  · ' + f)); process.exit(1); }
console.log('전부 통과.');
