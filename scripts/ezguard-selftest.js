#!/usr/bin/env node
/* ezGuard 단위 시험 (90항 규칙 3): 검문 규칙을 고치기 전에 이 표를 먼저 돌린다.
   atmr-dashboard.html 안의 EZ_THRESH·ezGuard 를 그대로 잘라 와서 실행한다(재구현 금지, 91항 규칙 1과 같은 이유).
   실행: node scripts/ezguard-selftest.js
   규칙을 새로 쓸 때는 '통과해야 할 참말'을 먼저 적고 그것이 통과하는지 본 다음 배포한다. */
'use strict';
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'atmr-dashboard.html'), 'utf8');

function slice(startRe, endRe) {
  const a = html.search(startRe);
  if (a < 0) throw new Error('시작 패턴 없음: ' + startRe);
  const b = html.slice(a).search(endRe);
  if (b < 0) throw new Error('끝 패턴 없음: ' + endRe);
  return html.slice(a, a + b);
}
const threshSrc = slice(/const EZ_THRESH = Object\.freeze\(\{/, /\}\);\n/) + '});\n';
const guardSrc  = slice(/function ezGuard\(text, facts, fallback\) \{/, /\n\}\n/) + '\n}\n';
const sandbox = { window: {}, console: { warn() {} } };
const fn = new Function('window', 'console', threshSrc + guardSrc + '\nreturn ezGuard;');
const ezGuard = fn(sandbox.window, sandbox.console);

const G1   = { rsi: 51, buy: 49, gear: 1, phase: 'closed', entryBlocked: true };   // 9/7 TSLA 실측
const G3   = { rsi: 60, buy: 66, gear: 3, phase: 'open',   entryBlocked: false };
const HOLI = { rsi: 53, buy: 60, gear: 3, phase: 'closed', entryBlocked: true };  // 노동절, 최상단 관망

const mustBlock = [
  [G1,   '지표는 매수 자리: 차트 패턴 미성숙, 1차는 절반으로'],
  [G1,   '분할 진입 검토 유효 구간: 매수점수 80 이상 극단 과매도 발동. 1회차는 소량(30% 이내) 전제.'],
  [G1,   '반등 3일째라 이미 1차는 들어가 있어야 할 시점: 비어 있다면 지금이라도.'],
  [G1,   '판단이 갈릴 때는 크기로 답한다: 1차 30%가 아니라 15% 선에서 시작하고, 차트가 매수로 돌아서면 나머지를 채운다.'],
  [G3,   'RSI 60으로 현재 과매도 구간이다. 분할 매수 적합.'],
  [HOLI, '오늘 장중 -5.9% 급락 진행 중'],
  [HOLI, 'TQQQ 1차 30% 진입 가능'],
  [HOLI, '레버리지 신규 진입 가능 구간'],
  [{ ...G3, rr: 0.1 }, '진입 353.92 · 손절 337.24 · 목표 355.39 플랜'],
];
const mustPass = [
  [G1,   '레버리지 ETF 즉시 청산: 하락 추세에서 레버리지는 손실 2~3배 증폭. 200일선 재돌파 확인 전까지 신규 매수 금지'],
  [G1,   '신규 진입 자제 구간: 상승 추세가 아니다. 신호 강화 대기 권고.'],
  [G1,   '이 분석의 1차 정찰대 조건은 "과매도에서 방향을 트는 순간" 하나이고 지금은 그 조건이 아니다.'],
  [G1,   '기다리는 트리거 둘: 과매도 탈출 반전(1차 30%), 200일선 회복(2차 30%).'],
  [G3,   'RSI 52.3→60.4 상승으로 과매도 구간 탈출 확인. MACD 히스토그램 개선.'],
  [G3,   '유효 매수 신호는 RSI 30 미만 극단 과매도 하나. 표본 34일.'],
  [HOLI, '9월 4일 장중 저점 712달러를 지켰다.'],
  [HOLI, '보유자는 유지, 신규 진입 대기: 최상단 판정 우선.'],
  [HOLI, '아래는 직전 장(9월 4일) 마감 시점의 판단이다.'],
  [G1,   'RSI가 54.5로 중립 구간을 유지. 주봉 ADX 14.7로 추세 약화 국면 진입 가능성.'],   // 2026-09-12 실측 오탐
  [G1,   "직전 4거래일 연속 '관망' 판독 유지. 5일 전 대비 RSI 하락으로 관망 유지 근거 강화."],
];

let fail = 0;
for (const [f, t] of mustBlock) {
  const r = ezGuard(t, f, '');
  if (r !== '') { fail++; console.log('미탐(막아야 함):', JSON.stringify(t)); }
}
for (const [f, t] of mustPass) {
  const r = ezGuard(t, f, '');
  if (r === '') { fail++; console.log('오탐(통과해야 함):', JSON.stringify(t)); }
}
console.log(`ezGuard selftest: 차단 ${mustBlock.length} · 통과 ${mustPass.length} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
