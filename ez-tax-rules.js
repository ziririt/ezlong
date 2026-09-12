/*!
 * ez-tax-rules.js — 절세 계좌 세율·한도의 단일 출처
 *
 * 왜 이 파일이 생겼나
 *   증상(2026-09-13 점검): 세율과 한도가 계산 함수 세 곳에 흩어져 박혀 있었다.
 *   개정이 있을 때마다 어디를 고쳐야 하는지 코드를 뒤져야 했고, 실제로 빠뜨린 자리가
 *   있었다 — 중도해지 경로에서는 과세제외 원금을 빼면서 정상 수령 경로에서는 안 뺐다.
 *   같은 파일 안에서 규칙이 엇갈린 것이다.
 *
 *   그래서 숫자를 한 곳에 모으고 **적용일과 근거**를 함께 적는다.
 *   기준일 없는 세율은 시간이 지나면 조용히 거짓말이 된다.
 *
 * 쓰는 곳
 *   tax-account-simulator.html
 *
 * 단위 약속
 *   · 금액은 **만원**. 2000 은 2,000만원이다.
 *   · 세율은 소수. 0.154 는 15.4% 다.
 *
 * 고칠 때
 *   숫자를 바꾸면 ASOF 와 SOURCE 도 같이 고친다. 둘 중 하나만 고친 것이 가장 나쁘다.
 *   그리고 scripts/tax-selftest.js 를 돌린다 — 공식 예시가 통과해야 한다.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.EZTax = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────────────
     현행 규칙 — 지금 계산에 쓰는 값
     ───────────────────────────────────────────────────────────────────── */
  var CURRENT = {
    ASOF:   '2026-09-13',
    SOURCE: '조세특례제한법 · 소득세법. 2026년 세제개편 최종안(2026-09-01 확정)에서 '
          + 'ISA 혜택 축소안이 철회되어 기존 한도가 그대로 유지된다.',

    ISA: {
      연납입한도:   2000,    // 만원
      누적한도:    10000,    // 만원 (총 1억)
      비과세_일반:   200,
      비과세_서민:   400,    // 총급여 5,000만원 이하 등 요건 충족 시
      분리과세율:  0.099,    // 비과세 한도 초과분
      의무가입년:      3,
      // 만기 시 연금계좌로 이전하면 이전액의 10%(최대 300만원)를 추가 세액공제받는다.
      // 이 시뮬레이터는 아직 그 경로를 계산하지 않는다 — 화면에 그렇게 적어 둔다.
      연금전환_추가공제율:  0.10,
      연금전환_추가공제한도: 300,
    },

    연금계좌: {   // 연금저축 + IRP
      세액공제율_저소득: 0.165,   // 총급여 5,500만원(종합소득 4,500만원) 이하
      세액공제율_고소득: 0.132,
      세액공제한도:       900,    // 연금저축 600 + IRP 추가 300
      연금저축_공제한도:  600,
      // 납입한도는 세액공제한도와 다른 값이다. 1,800만원까지 넣을 수 있고,
      // 공제를 못 받은 초과분은 '과세제외 원금' 이라 나중에 비과세로 찾는다.
      납입한도:          1800,
      수령개시연령:        55,
      // 연금소득세는 나이가 들수록 낮아진다. 한 값으로 뭉개면 장기 수령이 과대 과세된다.
      연금소득세율: [
        { 최소나이: 80, 세율: 0.033 },
        { 최소나이: 70, 세율: 0.044 },
        { 최소나이: 55, 세율: 0.055 },
      ],
      // 연간 연금소득이 이 금액을 넘으면 전액이 분리과세(16.5%) 또는 종합과세 대상이다.
      // '초과분만' 이 아니라 전액이라는 점이 중요하다.
      분리과세_기준:     1500,
      분리과세_세율:    0.165,
      중도해지_기타소득세: 0.165,
    },

    직접투자: {   // 해외 주식 직접 투자
      양도소득세:   0.22,    // 지방소득세 포함
      기본공제:      250,    // 연 250만원
      // 미국 배당은 현지에서 15% 원천징수되고 국내 세율 15.4% 와의 차액만 추가된다.
      // 결과적으로 15.4% 다.
      배당소득세:  0.154,
      금융소득종합과세_기준: 2000,
    },
  };

  /* ─────────────────────────────────────────────────────────────────────
     시행 예정 — 계산에는 아직 넣지 않는다
     국회를 통과해야 확정된다. 통과 전에 숫자를 바꾸면
     "틀린 법으로 틀린 법을 대체" 하는 셈이 된다.
     ───────────────────────────────────────────────────────────────────── */
  var PENDING = {
    생산적금융ISA: {
      시행예정:  '2027-01-01',
      상태:      '국회 심사 중 (2026-09-03 제출, 정기국회 처리 예정)',
      확인시점:  '2026-12',
      요지: '국내 주식·국내 주식형 펀드·ETF·BDC 전용 ISA. 이자·배당소득 전액 비과세, '
          + '연 납입 2,000만원·최대 10년(총 2억). 기존 중개형 ISA 와 중복 가입 가능. '
          + '국내 상장 해외 ETF 는 담을 수 없다. 청년형(34세 이하·총급여 7,500만원 이하)은 '
          + '납입액의 10%(최대 200만원) 소득공제.',
      계산반영: false,
    },
  };

  /* ─────────────────────────────────────────────────────────────────────
     계산 도우미
     ───────────────────────────────────────────────────────────────────── */

  function num(v, fb) {
    var n = Number(v);
    return (isNaN(n) || !isFinite(n)) ? (fb === undefined ? 0 : fb) : n;
  }

  /** 총급여 구간 -> 세액공제율. 'low' 는 5,500만원 이하. */
  function creditRate(incomeBand) {
    return incomeBand === 'low'
      ? CURRENT.연금계좌.세액공제율_저소득
      : CURRENT.연금계좌.세액공제율_고소득;
  }

  /** 그 나이에 적용되는 연금소득세율. */
  function pensionRateAt(age) {
    var t = CURRENT.연금계좌.연금소득세율;
    for (var i = 0; i < t.length; i++) if (age >= t[i].최소나이) return t[i].세율;
    return CURRENT.연금계좌.연금소득세율[CURRENT.연금계좌.연금소득세율.length - 1].세율;
  }

  /**
   * 분할 수령 기간 전체의 평균 연금소득세율.
   * 55세에 시작해 20년 받으면 앞 15년은 5.5%, 뒤 5년은 4.4% 다.
   * 한 값으로 뭉개면 장기 수령자가 실제보다 세금을 더 내는 그림이 된다.
   */
  function pensionRateOver(startAge, years) {
    var n = Math.max(1, Math.round(num(years, 1)));
    var s = 0;
    for (var i = 0; i < n; i++) s += pensionRateAt(num(startAge, 55) + i);
    return s / n;
  }

  /**
   * 연금 수령 세금.
   * @param {number} value        수령 개시 시점의 계좌 평가액 (만원)
   * @param {number} untaxedBasis 과세제외 원금 — 세액공제를 받지 않은 납입액 (만원)
   * @param {number} startAge     수령 개시 나이
   * @param {number} years        분할 수령 기간(년)
   * @returns {{tax:number, rate:number, separated:boolean, annual:number, taxable:number}}
   *
   * 두 가지가 빠져 있었다.
   *   1) 과세 대상은 '평가액 전체' 가 아니라 '평가액 - 과세제외 원금' 이다.
   *   2) 연 수령액이 1,500만원을 넘으면 5.5% 가 아니라 16.5% 분리과세(또는 종합과세)다.
   *      은퇴 자산이 클수록 이 분기에 걸리는데, 그 구간에서 세금이 3분의 1로 축소돼 있었다.
   */
  function pensionWithdrawalTax(value, untaxedBasis, startAge, years) {
    var V = num(value), U = Math.max(0, num(untaxedBasis));
    var n = Math.max(1, Math.round(num(years, 20)));
    var taxable = Math.max(0, V - U);           // 과세 대상 = 공제받은 원금 + 운용수익
    var annual  = taxable / n;                  // 연 수령액(과세 대상 기준)

    var P = CURRENT.연금계좌;
    if (annual > P.분리과세_기준) {
      // 초과분만이 아니라 전액이 대상이다.
      return { tax: taxable * P.분리과세_세율, rate: P.분리과세_세율,
               separated: true, annual: annual, taxable: taxable };
    }
    var r = pensionRateOver(startAge, n);
    return { tax: taxable * r, rate: r, separated: false, annual: annual, taxable: taxable };
  }

  /** 중도 해지 세금. 공제받지 않은 원금은 과세 대상에서 빠진다. */
  function earlyExitTax(value, untaxedBasis) {
    var taxable = Math.max(0, num(value) - Math.max(0, num(untaxedBasis)));
    return taxable * CURRENT.연금계좌.중도해지_기타소득세;
  }

  /**
   * ISA 세금. 비과세 한도는 만기 시 1회, 초과분은 9.9% 분리과세.
   * @param {number} gain    손익통산 후 이익 (만원)
   * @param {boolean} isSeomin 서민형 여부
   */
  function isaTax(gain, isSeomin) {
    var I = CURRENT.ISA;
    var free = isSeomin ? I.비과세_서민 : I.비과세_일반;
    return Math.max(0, num(gain) - free) * I.분리과세율;
  }

  /** 해외 직투 양도소득세. 연 250만원 기본공제 후 22%. */
  function overseasCapitalGainTax(gain) {
    var D = CURRENT.직접투자;
    return Math.max(0, num(gain) - D.기본공제) * D.양도소득세;
  }

  return {
    VERSION: '2026-09-13',
    ASOF:    CURRENT.ASOF,
    SOURCE:  CURRENT.SOURCE,
    RULES:   CURRENT,
    PENDING: PENDING,

    creditRate: creditRate,
    pensionRateAt: pensionRateAt,
    pensionRateOver: pensionRateOver,
    pensionWithdrawalTax: pensionWithdrawalTax,
    earlyExitTax: earlyExitTax,
    isaTax: isaTax,
    overseasCapitalGainTax: overseasCapitalGainTax,
  };
}));
