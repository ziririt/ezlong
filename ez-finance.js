/*!
 * ez-finance.js — 계산기 공용 금융 함수 (단일 진실값)
 *
 * 왜 이 파일이 생겼나
 *   증상(2026-09-13 점검): 같은 사이트의 네 계산기가 "연 수익률 -> 월 이율"을
 *   서로 다른 규칙으로 바꾸고 있었다.
 *     · 포트폴리오 복리 : Math.pow(1+r, 1/12)-1   (기하환산)
 *     · DCA / 은퇴      : r / 12                   (산술환산)
 *     · 복리 계산기     : r / 12                   (명목이율, 단위 선택식)
 *   앞의 둘은 화면에 "CAGR"이라고 적어 놓고 계산은 산술환산이었다. CAGR 은
 *   기하 정의이므로 라벨과 계산이 어긋난 것이다. 오차는 기간에 비례해 벌어진다 —
 *   연 14% 기준으로 10년 8.5%, 20년 17.7%, 30년 27.7% 과대.
 *
 *   개별 파일을 각각 고치면 같은 일이 다음에 또 난다. 그래서 규칙을 한 곳에 둔다.
 *   계산기를 새로 만들 때도 여기 있는 함수만 쓴다. 파일 안에서 직접 나누지 않는다.
 *
 * 쓰는 곳
 *   dca-simulator / retirement-calculator / portfolio-manager / compound-calculator
 *   (한국어 + en · ja · zh · es · pt)
 *
 * 단위 약속 — 어기면 100배 틀린다
 *   · 이율은 전부 **소수**로 받는다. 연 14% 는 0.14 이지 14 가 아니다.
 *   · 기간은 **개월 수**로 받는다. 20년은 240 이다.
 *   · 금액의 단위(원·달러·만원)는 이 파일이 모른다. 넣은 단위 그대로 나온다.
 *
 * 기하환산과 산술환산 중 무엇을 쓰나
 *   · CAGR(연평균 복리 수익률)로 적힌 값     -> monthlyFromCAGR
 *   · 명목 연이율(예금 이자처럼 "연 몇 %"를 12로 나눠 매달 붙이는 방식) -> monthlyFromNominal
 *   화면 라벨이 "CAGR"이면 반드시 전자다. 라벨과 계산이 같아야 한다.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;  // node 테스트용
  root.EZFin = api;                                                        // 브라우저 전역
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var EPS = 1e-12;

  /* 숫자가 아니면 대체값. 계산기 입력은 빈칸·문자열·NaN 이 흔하다. */
  function num(v, fb) {
    var n = Number(v);
    return (isNaN(n) || !isFinite(n)) ? (fb === undefined ? 0 : fb) : n;
  }

  /* 개월 수는 정수여야 한다. 음수는 0 으로 본다. */
  function months(v) {
    var n = Math.round(num(v, 0));
    return n > 0 ? n : 0;
  }

  /* ── 이율 환산 ─────────────────────────────────────────────────── */

  /**
   * 연 CAGR -> 월 복리 이율.  (1+r)^(1/12) - 1
   * 12개월 굴리면 정확히 원래 연 수익률이 된다. 화면이 CAGR 이라 말하면 이것을 쓴다.
   * @param {number} annual 연 수익률(소수). 0.14 = 연 14%
   */
  function monthlyFromCAGR(annual) {
    var r = num(annual, 0);
    // 연 -100% 이하는 월이율이 실수 범위에서 정의되지 않는다(음수의 12제곱근).
    // 입력창이나 슬라이더로 들어올 수 있으므로 -99.99% 에서 자른다.
    if (r <= -1) r = -0.9999;
    return Math.pow(1 + r, 1 / 12) - 1;
  }

  /**
   * 명목 연이율 -> 월 이율.  r / 12
   * 예금·대출처럼 "연 몇 %"를 12로 나눠 매달 붙이는 상품에만 쓴다.
   * 이 방식은 실효 연수익률이 표기값보다 높아진다(연 14% -> 실효 14.93%).
   */
  function monthlyFromNominal(annual) {
    return num(annual, 0) / 12;
  }

  /**
   * 명목 연이율 -> 실효 연수익률.  (1 + r/p)^p - 1
   * 화면에 "연 14%"라고 적었는데 월 복리로 굴리면 실제로는 몇 %인지 보여줄 때 쓴다.
   * @param {number} nominal 명목 연이율(소수)
   * @param {number} perYear 연간 복리 횟수(월 12, 일 365)
   */
  function effectiveAnnual(nominal, perYear) {
    var r = num(nominal, 0), p = num(perYear, 12);
    if (p <= 0) return r;
    var base = 1 + r / p;
    if (base <= 0) return -1;
    return Math.pow(base, p) - 1;
  }

  /* ── 미래가치 ──────────────────────────────────────────────────── */

  /**
   * 목돈의 미래가치.  pv * (1+mr)^n
   * @param {number} pv 현재 금액
   * @param {number} mr 월 이율(소수) — monthlyFromCAGR 등으로 만든 값
   * @param {number} n  개월 수
   */
  function fvLump(pv, mr, n) {
    var p = num(pv, 0), r = num(mr, 0), m = months(n);
    if (m === 0) return p;
    return p * Math.pow(1 + r, m);
  }

  /**
   * 적립의 미래가치.
   * 기본은 기말납입(ordinary annuity) — 그달 말에 넣고 다음 달부터 이자가 붙는다.
   * due=true 면 기초납입(annuity due) — 그달 초에 넣어 한 달치 이자를 더 받는다.
   * @param {number} pmt 매달 납입액
   * @param {number} mr  월 이율(소수)
   * @param {number} n   개월 수
   * @param {boolean} due 기초납입 여부
   */
  function fvAnnuity(pmt, mr, n, due) {
    var p = num(pmt, 0), r = num(mr, 0), m = months(n);
    if (m === 0) return 0;
    if (Math.abs(r) < EPS) return p * m;             // 0% 에서 0 나눗셈을 피한다
    var fv = p * (Math.pow(1 + r, m) - 1) / r;
    return due ? fv * (1 + r) : fv;
  }

  /* ── 역산 ─────────────────────────────────────────────────────── */

  /**
   * 목표 금액에 닿기 위한 월 납입액.
   * 현재 자산만으로 이미 목표를 넘으면 음수가 나온다 — 이 값을 어떻게 보여줄지는
   * 화면의 판단이다. 여기서 0 으로 자르지 않는다(계산과 표시를 섞지 않는다).
   * @param {number} target 목표 금액
   * @param {number} pv     현재 자산
   * @param {number} mr     월 이율(소수)
   * @param {number} n      개월 수
   * @param {boolean} due   기초납입 여부
   */
  function pmtForTarget(target, pv, mr, n, due) {
    var fv = num(target, 0), p = num(pv, 0), r = num(mr, 0), m = months(n);
    if (m === 0) return 0;
    var need = fv - p * Math.pow(1 + r, m);          // 적립으로 채워야 할 몫
    if (Math.abs(r) < EPS) return need / m;
    var factor = (Math.pow(1 + r, m) - 1) / r;
    if (due) factor *= (1 + r);
    return need / factor;
  }

  /* ── 물가 ─────────────────────────────────────────────────────── */

  /**
   * 명목 금액 -> 오늘 구매력 기준 실질 금액.  nominal / (1+i)^years
   * "20년 뒤의 월 300만원"이 지금 얼마어치인지 보여줄 때 쓴다.
   */
  function realValue(nominal, inflation, years) {
    var v = num(nominal, 0), i = num(inflation, 0), y = num(years, 0);
    if (i <= -1) return v;
    return v / Math.pow(1 + i, y);
  }

  /**
   * 물가를 태운 인출액.  nominal * (1+i)^years
   * 4% 룰은 첫해 인출액을 해마다 물가만큼 올리는 것이 정의다. 명목 고정으로 굴리면
   * 같은 이름을 붙일 수 없다.
   */
  function inflatedWithdrawal(base, inflation, years) {
    var v = num(base, 0), i = num(inflation, 0), y = num(years, 0);
    if (i <= -1) return v;
    return v * Math.pow(1 + i, y);
  }

  return {
    VERSION: '2026-09-13',

    /* 원/달러 환율 — 계산기들이 달러로 계산하고 원화로 보여 줄 때 쓴다.
       증상: 이 값이 계산기마다 파일 안에 따로 박혀 있었고, 기준일 표기가 넉 달 묵어
       있었다(1,380원 · 2026-05 기준). 값이 한 곳에만 있어야 같이 늙지 않는다.
       갱신할 때는 ASOF 도 같이 고친다. 고치지 않은 ASOF 는 거짓말이 된다. */
    USD_KRW: 1342,
    USD_KRW_ASOF: '2026-09-13',

    monthlyFromCAGR: monthlyFromCAGR,
    monthlyFromNominal: monthlyFromNominal,
    effectiveAnnual: effectiveAnnual,
    fvLump: fvLump,
    fvAnnuity: fvAnnuity,
    pmtForTarget: pmtForTarget,
    realValue: realValue,
    inflatedWithdrawal: inflatedWithdrawal
  };
}));
