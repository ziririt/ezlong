#!/usr/bin/env node
/* 절세 계좌 세법 단위 시험 — 숫자는 기억이 아니라 고시된 값이 정답이다.
   실행: node scripts/tax-selftest.js

   배경(2026-09-13 점검): 세율이 계산 함수 세 곳에 흩어져 있었고 빠뜨린 규칙이 넷이었다.
     · 연금 수령 시 과세제외 원금을 안 뺐다 (중도해지 경로에서는 뺐다 - 규칙이 엇갈렸다)
     · 연 1,500만원 초과 분리과세(16.5%)를 몰랐다 - 고액 구간에서 세금이 3분의 1로 축소
     · 연금소득세를 일괄 5.5% 로 봤다 (70대 4.4% · 80대 3.3%)
     · ISA 누적 1억 한도를 안 봤다 - 6년 넣으면 1억 2,000만원이 전부 ISA 로 계산됐다

   두 층으로 본다.
     1층  ez-tax-rules.js 가 규칙대로 계산하는가
     2층  tax-account-simulator.html 안의 함수를 잘라 와 돌린 결과가 맞는가 */
'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT  = path.join(__dirname, '..');
const EZTax = require(path.join(ROOT, 'ez-tax-rules.js'));

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? '  — ' + d : ''));
const near = (l, got, want, tol) => ok(l, Math.abs(got - want) <= (tol === undefined ? 1e-6 : tol),
  `얻은 값 ${got} / 기대 ${want}`);

/* ══════════════════════════════════════════════════════════════════
   1층 — 규칙표
══════════════════════════════════════════════════════════════════ */
console.log('\n[1층] ez-tax-rules.js');

// 기준일과 근거가 반드시 붙어 있어야 한다. 기준일 없는 세율은 조용히 거짓말이 된다.
ok('적용 기준일이 있다', /^\d{4}-\d{2}-\d{2}$/.test(EZTax.ASOF), EZTax.ASOF);
ok('근거 출처가 있다', typeof EZTax.SOURCE === 'string' && EZTax.SOURCE.length > 20);

// 현행 한도 — 2026 세제개편 최종안에서 ISA 축소안이 철회되어 기존 값이 유지된다
const I = EZTax.RULES.ISA, P = EZTax.RULES.연금계좌, D = EZTax.RULES.직접투자;
ok('ISA 연 납입한도 2,000만원', I.연납입한도 === 2000, String(I.연납입한도));
ok('ISA 누적한도 1억',          I.누적한도 === 10000, String(I.누적한도));
ok('ISA 비과세 일반 200만원',   I.비과세_일반 === 200);
ok('ISA 비과세 서민 400만원',   I.비과세_서민 === 400);
ok('ISA 분리과세 9.9%',         I.분리과세율 === 0.099);
ok('연금 세액공제 한도 900만원', P.세액공제한도 === 900);
ok('연금 납입한도 1,800만원 (세액공제 한도와 다른 값)', P.납입한도 === 1800);
ok('세액공제율 16.5% / 13.2%',  EZTax.creditRate('low') === 0.165 && EZTax.creditRate('high') === 0.132);
ok('직투 양도세 22% · 공제 250만원', D.양도소득세 === 0.22 && D.기본공제 === 250);
ok('배당소득세 15.4%',          D.배당소득세 === 0.154);

// 시행 예정은 계산에 반영하지 않는다 — 국회를 통과해야 확정이다
ok('생산적금융 ISA 는 계산 미반영', EZTax.PENDING.생산적금융ISA.계산반영 === false);
ok('시행 예정 규칙에 확인 시점이 있다', !!EZTax.PENDING.생산적금융ISA.확인시점);

// 연령별 연금소득세
ok('55세 5.5%', EZTax.pensionRateAt(55) === 0.055);
ok('69세 5.5%', EZTax.pensionRateAt(69) === 0.055);
ok('70세 4.4%', EZTax.pensionRateAt(70) === 0.044);
ok('79세 4.4%', EZTax.pensionRateAt(79) === 0.044);
ok('80세 3.3%', EZTax.pensionRateAt(80) === 0.033);

// 55세에 20년 받으면 앞 15년 5.5%, 뒤 5년 4.4%
near('55세 20년 평균세율 5.225%', EZTax.pensionRateOver(55, 20), (15 * 0.055 + 5 * 0.044) / 20, 1e-9);
ok('장기 수령일수록 평균세율이 낮다',
   EZTax.pensionRateOver(55, 30) < EZTax.pensionRateOver(55, 10));

/* 중도해지 — 페이지 FAQ 가 드는 예시와 맞아야 한다.
   "1,000만원을 납입해 세액공제를 받았고 수익이 200만원이면 1,200만원에 16.5% 인 198만원" */
near('중도해지 FAQ 예시: 1,200만원 × 16.5% = 198만원',
     EZTax.earlyExitTax(1200, 0), 198, 1e-9);
near('공제 안 받은 원금은 중도해지에서도 빠진다',
     EZTax.earlyExitTax(1200, 300), (1200 - 300) * 0.165, 1e-9);

/* 연금 수령 — 이번 수정의 핵심 둘 */
{
  // (1) 과세 대상은 평가액 전체가 아니라 '평가액 - 과세제외 원금'
  const a = EZTax.pensionWithdrawalTax(2000, 900, 55, 20);
  near('과세제외 원금 900만원을 뺀 1,100만원만 과세', a.taxable, 1100, 1e-9);
  ok('한도 안이면 연금소득세율 적용', a.separated === false);
  near('세금 = 1,100 × 5.225%', a.tax, 1100 * ((15 * 0.055 + 5 * 0.044) / 20), 1e-6);

  const b = EZTax.pensionWithdrawalTax(2000, 0, 55, 20);
  ok('과세제외 원금이 있으면 세금이 더 적다', a.tax < b.tax, `${a.tax} / ${b.tax}`);

  // (2) 연 수령액 1,500만원 초과 -> 전액 16.5% (초과분만이 아니다)
  const c = EZTax.pensionWithdrawalTax(40000, 0, 55, 20);   // 4억을 20년 -> 연 2,000만원
  ok('연 2,000만원이면 분리과세로 넘어간다', c.separated === true, `연 ${c.annual}만원`);
  near('분리과세는 전액 16.5%', c.tax, 40000 * 0.165, 1e-6);
  ok('분리과세 세금이 연금소득세보다 3배 가까이 크다',
     c.tax / (40000 * 0.055) > 2.9, String(c.tax / (40000 * 0.055)));

  // 경계 — 정확히 1,500만원이면 아직 연금소득세
  const d = EZTax.pensionWithdrawalTax(1500 * 20, 0, 55, 20);
  ok('연 1,500만원 정확히면 분리과세 아님', d.separated === false, `연 ${d.annual}만원`);
  const e = EZTax.pensionWithdrawalTax(1500 * 20 + 20, 0, 55, 20);
  ok('1,500만원을 넘기면 분리과세', e.separated === true, `연 ${e.annual.toFixed(1)}만원`);
}

/* ISA */
near('ISA 일반형: 이익 500만원 -> (500-200)×9.9%', EZTax.isaTax(500, false), 300 * 0.099, 1e-9);
near('ISA 서민형: 이익 500만원 -> (500-400)×9.9%', EZTax.isaTax(500, true), 100 * 0.099, 1e-9);
near('비과세 한도 안이면 세금 0', EZTax.isaTax(150, false), 0, 1e-12);
near('손실이면 세금 0', EZTax.isaTax(-100, false), 0, 1e-12);

/* 직투 */
near('직투: 이익 1,000만원 -> (1000-250)×22%', EZTax.overseasCapitalGainTax(1000), 750 * 0.22, 1e-9);
near('기본공제 안이면 세금 0', EZTax.overseasCapitalGainTax(200), 0, 1e-12);

/* ══════════════════════════════════════════════════════════════════
   2층 — 시뮬레이터 안의 함수를 잘라 와 실행
══════════════════════════════════════════════════════════════════ */
console.log('[2층] tax-account-simulator.html 실측');

function cutFunction(src, name) {
  const a = src.search(new RegExp('function\\s+' + name + '\\s*\\('));
  if (a < 0) throw new Error('함수를 찾지 못했다: ' + name);
  let depth = 0;
  for (let j = src.indexOf('{', a); j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(a, j + 1); }
  }
  throw new Error('함수 끝을 찾지 못했다: ' + name);
}

const html = fs.readFileSync(path.join(ROOT, 'tax-account-simulator.html'), 'utf8');
const ctx = { EZTax, Math, Number, isNaN, isFinite, console };
vm.createContext(ctx);
vm.runInContext(
  'const PENSION_WITHDRAW_YEARS = 20;\n'
  + ['splitIsaSchedule', 'simulateIsa', 'simulateDirect', 'simulatePension', 'getAllocation']
      .map(n => cutFunction(html, n)).join('\n'), ctx);

/* ISA 누적 한도 — 이번 수정으로 처음 지켜지는 규칙 */
{
  const sch = [2000, 2000, 2000, 2000, 2000, 2000];   // 6년 × 2,000 = 1억 2,000
  const r = ctx.splitIsaSchedule(sch);
  const into = r.inIsa.reduce((a, b) => a + b, 0);
  const rest = r.rest.reduce((a, b) => a + b, 0);
  near('ISA 에 들어가는 총액은 1억에서 멈춘다', into, 10000, 1e-9);
  near('나머지 2,000만원은 계좌 밖으로', rest, 2000, 1e-9);
  ok('6년차에는 더 못 넣는다', r.inIsa[5] === 0, JSON.stringify(r.inIsa));
  ok('5년차는 정확히 한도까지만', r.inIsa[4] === 2000);
}
{
  // 연 한도 초과분도 걷어낸다
  const r = ctx.splitIsaSchedule([3000, 3000]);
  ok('연 2,000만원을 넘는 몫은 밖으로', r.inIsa[0] === 2000 && r.rest[0] === 1000,
     JSON.stringify(r));
}

/* 연금 — 과세제외 원금과 분리과세가 실제 시뮬레이션에 반영되는가 */
{
  // 연 1,800만원(공제는 900만원까지) × 10년, 수익 0% 로 두어 세금만 본다
  const rows = ctx.simulatePension([1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800],
    50, 0.132, 0, 0, 'low');
  const last = rows[rows.length - 1];
  // 납입 18,000 + 환급 900×10×0.132 = 1,188 -> 평가액 19,188
  // 과세제외 원금 = 18,000 - 9,000 = 9,000
  near('10년 뒤 평가액', last.gross, 18000 + 900 * 10 * 0.132, 1e-6);
  const untaxed = 18000 - 9000;
  const expect = EZTax.pensionWithdrawalTax(last.gross, untaxed, 60, 20);
  near('세금이 과세제외 원금을 반영한다', last.tax, expect.tax, 1e-6);
  ok('평가액 전체에 세율을 매기지 않는다', last.tax < last.gross * 0.055,
     `세금 ${last.tax.toFixed(1)} / 평가액×5.5% ${(last.gross * 0.055).toFixed(1)}`);
}
{
  // 큰 금액 -> 분리과세 구간으로 넘어가는지
  const sch = new Array(20).fill(1800);
  const rows = ctx.simulatePension(sch, 35, 0.132, 0.08, 0, 'low');
  const last = rows[rows.length - 1];
  const untaxed = 20 * 1800 - 20 * 900;
  const r = EZTax.pensionWithdrawalTax(last.gross, untaxed, 55, 20);
  ok('자산이 커지면 분리과세 구간에 들어간다', r.separated === true,
     `연 수령 ${r.annual.toFixed(0)}만원`);
  near('시뮬레이터 세금이 규칙표와 일치', last.tax, r.tax, 1e-6);
}
{
  // 중도해지 경로는 여전히 기타소득세
  const rows = ctx.simulatePension([1000], 30, 0.165, 0, 0, 'normal');   // 31세 -> 55세 전
  const last = rows[0];
  // 1,000만원 중 세액공제는 900만원까지. 남는 100만원이 과세제외 원금이다.
  const untaxed = 1000 - 900;
  near('중도해지는 기타소득세 16.5%', last.tax, (last.gross - untaxed) * 0.165, 1e-6);
  near('공제 한도 초과 납입분이 과세제외 원금이 된다',
       last.gross - last.tax / 0.165, untaxed, 1e-6);
  ok('중도해지로 표시된다', last.taxKind === 'early', last.taxKind);
}

/* 직투 */
{
  const rows = ctx.simulateDirect([1000], 0.10, 0);
  const last = rows[0];
  near('직투 평가액 = 1,000 × 1.10', last.gross, 1100, 1e-9);
  near('세금 = (100 - 250) 이하라 0', last.tax, 0, 1e-9);

  const big = ctx.simulateDirect([10000], 0.20, 0);
  near('이익 2,000만원 -> (2000-250)×22%', big[0].tax, 1750 * 0.22, 1e-6);
}

/* 배분 */
{
  const a = ctx.getAllocation(5000, 'low');
  near('유동성 낮음: 연금 600', a.pension, 600);
  near('유동성 낮음: IRP 300',  a.irp, 300);
  near('유동성 낮음: ISA 2,000', a.isa, 2000);
  near('나머지는 직투',          a.direct, 5000 - 600 - 300 - 2000);
  const b = ctx.getAllocation(1000, 'high');
  near('유동성 높음: ISA 우선',  b.isa, 1000);
  near('유동성 높음: 연금 0',    b.pension, 0);
}

/* 화면이 가정을 밝히는가 */
{
  ok('수령 기간 가정이 코드에 있다', /PENSION_WITHDRAW_YEARS = 20/.test(html));
  ok('세율표 파일을 불러온다', /ez-tax-rules\.js/.test(html));
  ok('하드코딩 세율이 남아 있지 않다',
     !/tax = value \* 0\.055/.test(html) && !/const divTax = 0\.154/.test(html));
}

console.log(`\n통과 ${pass} / 실패 ${fails.length}`);
if (fails.length) { console.log('\n실패'); fails.forEach(f => console.log('  · ' + f)); process.exit(1); }
console.log('전부 통과.');
