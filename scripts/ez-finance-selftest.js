#!/usr/bin/env node
/* ez-finance 단위 시험 — 공용 금융 함수를 고치기 전에 이 표를 먼저 돌린다.
   실행: node scripts/ez-finance-selftest.js

   두 층으로 본다.
     1층  ez-finance.js 자체가 정의대로 동작하는가
     2층  계산기 HTML 안의 함수를 **그대로 잘라 와** 돌렸을 때 왕복이 맞는가
          (재구현 금지 — ezguard-selftest.js 와 같은 이유다. 재구현하면
           시험은 통과하는데 화면은 틀린 상태가 만들어진다)

   통과해야 할 참말을 먼저 적고, 그것이 통과하는지 본 다음 배포한다. */
'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT  = path.join(__dirname, '..');
const EZFin = require(path.join(ROOT, 'ez-finance.js'));

let pass = 0, fail = 0;
const fails = [];

function ok(label, cond, detail) {
  if (cond) { pass++; }
  else { fail++; fails.push(label + (detail ? '  — ' + detail : '')); }
}
function near(label, got, want, tol) {
  const t = tol === undefined ? 1e-9 : tol;
  const d = Math.abs(got - want);
  ok(label, d <= t, `얻은 값 ${got} / 기대 ${want} / 차이 ${d.toExponential(2)}`);
}

/* ══════════════════════════════════════════════════════════════════
   1층 — ez-finance.js 정의 검증
══════════════════════════════════════════════════════════════════ */
console.log('\n[1층] ez-finance.js 정의');

// CAGR 의 정의: 월이율로 12번 굴리면 정확히 연 수익률이 된다.
[0.14, 0.07, 0.21, 0.04, 0.30, -0.20].forEach(r => {
  const m = EZFin.monthlyFromCAGR(r);
  near(`monthlyFromCAGR(${r}) 12개월 복리 = ${r}`, Math.pow(1 + m, 12) - 1, r, 1e-12);
});

// 명목환산은 정의상 r/12 이고, 실효는 그보다 높다.
near('monthlyFromNominal(0.14) = 0.14/12', EZFin.monthlyFromNominal(0.14), 0.14 / 12);
near('effectiveAnnual(0.14, 12) = 14.93%', EZFin.effectiveAnnual(0.14, 12), Math.pow(1 + 0.14 / 12, 12) - 1);
ok('명목 월환산은 CAGR 월환산보다 크다',
   EZFin.monthlyFromNominal(0.14) > EZFin.monthlyFromCAGR(0.14));

// 이번 수정이 겨냥한 오차 크기가 실제로 그만큼인지 못박아 둔다.
[[10, 0.085], [20, 0.177], [30, 0.277]].forEach(([yrs, expected]) => {
  const wrong = Math.pow(1 + 0.14 / 12, 12 * yrs);
  const right = Math.pow(1 + 0.14, yrs);
  near(`연 14% ${yrs}년 산술환산 과대율 ≈ ${(expected * 100).toFixed(1)}%`,
       wrong / right - 1, expected, 0.001);
});

// 목돈 미래가치
near('fvLump(1억, 14%CAGR, 240개월) = 1억×1.14^20',
     EZFin.fvLump(1e8, EZFin.monthlyFromCAGR(0.14), 240), 1e8 * Math.pow(1.14, 20), 1);

// 적립 미래가치 — 기말/기초
{
  const mr = EZFin.monthlyFromCAGR(0.14);
  const end = EZFin.fvAnnuity(100, mr, 240, false);
  const due = EZFin.fvAnnuity(100, mr, 240, true);
  near('기초납입 = 기말납입 × (1+월이율)', due, end * (1 + mr), 1e-6);
  ok('기초납입이 기말납입보다 크다', due > end);
}

// 역산 ↔ 순방향 왕복. 이 표가 이 파일의 존재 이유다.
[
  { target: 15e4, pv: 0,     yrs: 20, r: 0.14 },
  { target: 15e4, pv: 3e4,   yrs: 20, r: 0.14 },
  { target: 30e4, pv: 5e4,   yrs: 30, r: 0.07 },
  { target: 10e4, pv: 1e4,   yrs: 10, r: 0.21 },
  { target: 10e4, pv: 0,     yrs: 25, r: 0.04 },
  { target: 10e4, pv: 0,     yrs: 15, r: 0    },   // 0% 경계
].forEach(c => {
  const mr  = EZFin.monthlyFromCAGR(c.r);
  const n   = c.yrs * 12;
  const pmt = EZFin.pmtForTarget(c.target, c.pv, mr, n);
  const fv  = EZFin.fvLump(c.pv, mr, n) + EZFin.fvAnnuity(pmt, mr, n);
  const rel = Math.abs(fv - c.target) / c.target;
  ok(`왕복 일치: 목표 ${c.target} / 현재 ${c.pv} / ${c.yrs}년 / 연 ${c.r * 100}%`,
     rel < 1e-9, `되돌린 값 ${fv.toFixed(4)} (상대오차 ${rel.toExponential(2)})`);
});

// 이미 목표를 넘긴 경우 — 음수를 그대로 돌려준다(0 으로 자르지 않는 것이 약속이다)
ok('현재 자산만으로 목표 초과 시 음수 반환',
   EZFin.pmtForTarget(1e4, 1e5, EZFin.monthlyFromCAGR(0.14), 240) < 0);

// 경계·쓰레기 입력
near('월이율 0% 적립 = 납입액 × 개월수', EZFin.fvAnnuity(50, 0, 240), 50 * 240);
near('개월수 0 이면 적립은 0', EZFin.fvAnnuity(50, 0.01, 0), 0);
near('개월수 0 이면 목돈은 그대로', EZFin.fvLump(1000, 0.01, 0), 1000);
near('개월수 음수는 0 으로 본다', EZFin.fvAnnuity(50, 0.01, -12), 0);
ok('NaN 입력이 NaN 을 뱉지 않는다', isFinite(EZFin.fvAnnuity(NaN, NaN, NaN)));
ok('연 -100% 이하도 유한값', isFinite(EZFin.monthlyFromCAGR(-1)) && isFinite(EZFin.monthlyFromCAGR(-5)));
ok('음수 수익률에서 자산이 줄어든다', EZFin.fvLump(1000, EZFin.monthlyFromCAGR(-0.2), 12) < 1000);
near('음수 수익률도 12개월이면 정확히 -20%',
     EZFin.fvLump(1000, EZFin.monthlyFromCAGR(-0.2), 12), 800, 1e-9);

// 물가
near('realValue: 연 2.5% 20년', EZFin.realValue(300, 0.025, 20), 300 / Math.pow(1.025, 20), 1e-9);
near('inflatedWithdrawal 은 realValue 의 역',
     EZFin.realValue(EZFin.inflatedWithdrawal(300, 0.025, 20), 0.025, 20), 300, 1e-9);

/* ══════════════════════════════════════════════════════════════════
   2층 — 계산기 HTML 안의 함수를 잘라 와 실행
══════════════════════════════════════════════════════════════════ */
console.log('[2층] 계산기 HTML 실측');

/* HTML 에서 함수 본문을 이름으로 잘라 온다. 중괄호 균형으로 끝을 찾는다. */
function cutFunction(src, name) {
  const head = new RegExp('function\\s+' + name + '\\s*\\(');
  const a = src.search(head);
  if (a < 0) throw new Error(`함수를 찾지 못했다: ${name}`);
  let i = src.indexOf('{', a), depth = 0;
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return src.slice(a, j + 1); }
  }
  throw new Error(`함수 끝을 찾지 못했다: ${name}`);
}

function loadCalc(file, names, extra) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const code = (extra || '') + '\n' + names.map(n => cutFunction(src, n)).join('\n');
  const ctx = { EZFin, Math, Number, isNaN, isFinite, console };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: file });
  return ctx;
}

/* 은퇴 계산기 — 역산과 순방향이 같은 규칙을 쓰는지가 핵심이다. */
try {
  const helpers = `
    const EX_RATE = 1430;
    function sN(v, fb=0){ const n=Number(v); return isNaN(n)||!isFinite(n)?fb:n; }
  `;
  const R = loadCalc('retirement-calculator.html',
    ['calcReverseDCA', 'calcForwardAsset'], helpers);

  [
    { target: 150000, age: 40, ret: 60, asset: 0,     rate: 14 },
    { target: 150000, age: 40, ret: 60, asset: 30000, rate: 14 },
    { target: 300000, age: 35, ret: 65, asset: 50000, rate: 7  },
    { target: 100000, age: 45, ret: 55, asset: 10000, rate: 21 },
  ].forEach(c => {
    const pmt  = R.calcReverseDCA(c.target, c.age, c.ret, c.asset, c.rate);
    const back = R.calcForwardAsset(c.asset, pmt, c.ret - c.age, c.rate);
    const rel  = Math.abs(back - c.target) / c.target;
    // 두 함수 모두 만원 단위로 반올림하므로 완전 일치는 불가능하다. 0.5% 를 문턱으로 둔다.
    ok(`은퇴 왕복: 목표 ${c.target}만 / 자산 ${c.asset}만 / ${c.ret - c.age}년 / 연 ${c.rate}%`,
       rel < 0.005, `역산 월 ${pmt}만 -> 되돌린 자산 ${back}만 (오차 ${(rel * 100).toFixed(3)}%)`);
  });

  // 라벨이 CAGR 이면 12개월 굴려 정확히 그 값이 나와야 한다.
  const oneYear = R.calcForwardAsset(10000, 0, 1, 14);
  ok('은퇴 계산기: 현재자산 1억을 연 14% 로 1년 -> 1.14억 (CAGR 정의)',
     Math.abs(oneYear - 11400) <= 1, `얻은 값 ${oneYear}만원`);
} catch (e) {
  fail++; fails.push('은퇴 계산기 절단 실패 — ' + e.message);
}

/* DCA 시뮬레이터 — 추가 납입 없이 1년이면 정확히 표기 수익률이어야 한다. */
try {
  const helpers = `function sN(v, fb=0){ const n=Number(v); return isNaN(n)||!isFinite(n)?fb:n; }`;
  const D = loadCalc('dca-simulator.html', ['calcDCA'], helpers);
  const rows = D.calcDCA(100000, 0, 14, 0, 1, 1, null);   // 10만달러, 월납 0, 연 14%, 1년
  const v = rows[rows.length - 1].totalValue;
  ok('DCA: 10만을 연 14% 로 1년 -> 114,000 (CAGR 정의)',
     Math.abs(v - 114000) <= 1, `얻은 값 ${v}`);

  const rows20 = D.calcDCA(100000, 0, 14, 0, 20, 1, null);
  const v20 = rows20[rows20.length - 1].totalValue;
  const want20 = Math.round(100000 * Math.pow(1.14, 20));
  ok('DCA: 20년 결과가 1.14^20 배',
     Math.abs(v20 - want20) <= 2, `얻은 값 ${v20} / 기대 ${want20}`);
} catch (e) {
  fail++; fails.push('DCA 절단 실패 — ' + e.message);
}

/* 포트폴리오 복리 — 원래 맞던 곳이다. 치환 뒤에도 값이 그대로인지 지킨다. */
try {
  const P = loadCalc('portfolio-manager.html', ['calculatePortfolioReturn'], '');
  const wr = P.calculatePortfolioReturn([
    { weight: 50, annualReturn: 20 },
    { weight: 50, annualReturn: 10 },
  ]);
  near('포트폴리오 가중 수익률 = 15%', wr, 15, 1e-9);
  near('그 월환산은 기하환산과 같다',
       EZFin.monthlyFromCAGR(wr / 100), Math.pow(1.15, 1 / 12) - 1, 1e-15);
} catch (e) {
  fail++; fails.push('포트폴리오 절단 실패 — ' + e.message);
}

/* 네 계산기가 같은 조건에서 같은 답을 내는가 — 단일 진실값(13절) */
try {
  const mr = EZFin.monthlyFromCAGR(0.14);
  const byShared = EZFin.fvLump(1e8, mr, 240);

  const helpersD = `function sN(v, fb=0){ const n=Number(v); return isNaN(n)||!isFinite(n)?fb:n; }`;
  const D = loadCalc('dca-simulator.html', ['calcDCA'], helpersD);
  const byDCA = D.calcDCA(1e8, 0, 14, 0, 20, 1, null).slice(-1)[0].totalValue;

  const helpersR = `
    const EX_RATE = 1430;
    function sN(v, fb=0){ const n=Number(v); return isNaN(n)||!isFinite(n)?fb:n; }
  `;
  const R = loadCalc('retirement-calculator.html', ['calcForwardAsset'], helpersR);
  const byRet = R.calcForwardAsset(1e8 / 1e4, 0, 20, 14) * 1e4;   // 만원 단위 -> 원

  ok('DCA 와 공용함수가 같은 값', Math.abs(byDCA - byShared) / byShared < 1e-6,
     `DCA ${byDCA} / 공용 ${byShared}`);
  ok('은퇴와 공용함수가 같은 값', Math.abs(byRet - byShared) / byShared < 1e-4,
     `은퇴 ${byRet} / 공용 ${byShared}`);
} catch (e) {
  fail++; fails.push('계산기 간 일치 검사 실패 — ' + e.message);
}

/* 물가 연동 인출 — 4% 룰은 해마다 인출액을 물가만큼 올리는 것이 정의다. */
try {
  const helpers = `
    const EX_RATE = 1342;
    function sN(v, fb=0){ const n=Number(v); return isNaN(n)||!isFinite(n)?fb:n; }
  `;
  const W = loadCalc('retirement-calculator.html', ['calcWithdrawalSim'], helpers);

  // 자산 15억, 월 500만 인출, 연 4% 수익, 30년
  const flat = W.calcWithdrawalSim(150000, 500, 4, 30, 0);
  const infl = W.calcWithdrawalSim(150000, 500, 4, 30, 0.025);

  ok('물가를 태우면 남는 자산이 더 적다',
     infl.rows.slice(-1)[0].assetMan < flat.rows.slice(-1)[0].assetMan,
     `명목고정 ${flat.rows.slice(-1)[0].assetMan}만 / 물가연동 ${infl.rows.slice(-1)[0].assetMan}만`);

  ok('물가연동 0 이면 예전 동작과 같다',
     JSON.stringify(flat.rows) === JSON.stringify(W.calcWithdrawalSim(150000, 500, 4, 30).rows));

  // 30년째 인출액은 첫해의 (1.025)^29 배여야 한다
  const want = Math.round(500 * Math.pow(1.025, 29));
  ok(`30년째 월 인출액이 물가만큼 올라 있다 (${want}만원)`,
     Math.abs(infl.lastWithdrawalMan - want) <= 1,
     `얻은 값 ${infl.lastWithdrawalMan}만원`);

  // 자산 0 이면 루프에 들어가지 않는다
  const zero = W.calcWithdrawalSim(0, 500, 4, 30, 0.025);
  ok('자산 0 이면 소진 판정 없음', zero.exhaustedYear === null);
} catch (e) {
  fail++; fails.push('물가 연동 인출 검사 실패 — ' + e.message);
}

/* 복리 계산기 — 명목이율이 의도된 설계다. 실효값을 화면이 말해 주는지까지 본다. */
try {
  const C = loadCalc('compound-calculator.html', ['calcCompound', 'rateNote'], '');
  const yearly  = C.calcCompound(1e8, 0, 20, 14, '연');
  const monthly = C.calcCompound(1e8, 0, 240, 14, '월');

  near('복리 계산기 연 단위(unit=연) = 1.14^20', yearly.slice(-1)[0].total, 1e8 * Math.pow(1.14, 20), 1);
  ok('복리 계산기 월 단위는 명목이율이라 더 크다',
     monthly.slice(-1)[0].total > yearly.slice(-1)[0].total);

  const note = C.rateNote(14, '월');
  ok('월 단위에서 실효 14.93% 를 화면이 말한다', note.indexOf('14.93%') >= 0, note.slice(0, 120));
  ok('연 단위에서는 안내를 띄우지 않는다', C.rateNote(14, '연') === '');
  ok('수익률 0 에서는 안내를 띄우지 않는다', C.rateNote(0, '월') === '');
  const noteDay = C.rateNote(14, '일');
  ok('일 단위에서 실효 15.02% 를 화면이 말한다', noteDay.indexOf('15.02%') >= 0, noteDay.slice(0, 120));
} catch (e) {
  fail++; fails.push('복리 계산기 검사 실패 — ' + e.message);
}

/* 환율이 한 곳에서만 산다 — 파일마다 따로 박혀 같이 늙는 것을 막는다. */
try {
  const roots = ['dca-simulator.html', 'retirement-calculator.html'];
  roots.forEach(f => {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    ok(`${f}: 환율 하드코딩 없음`, !/EX_RATE\s*=\s*1[0-9]{3}/.test(src));
    ok(`${f}: 공용 환율을 쓴다`, src.indexOf('EZFin.USD_KRW') >= 0);
  });
  ok('공용 환율에 기준일이 붙어 있다', /^\d{4}-\d{2}-\d{2}$/.test(EZFin.USD_KRW_ASOF));
  ok('공용 환율이 현실적 범위', EZFin.USD_KRW > 800 && EZFin.USD_KRW < 2500);
} catch (e) {
  fail++; fails.push('환율 단일 출처 검사 실패 — ' + e.message);
}

/* ══════════════════════════════════════════════════════════════════ */
console.log(`\n통과 ${pass} / 실패 ${fail}`);
if (fail) {
  console.log('\n실패한 항목');
  fails.forEach(f => console.log('  · ' + f));
  process.exit(1);
}
console.log('전부 통과.');
