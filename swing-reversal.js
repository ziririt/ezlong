(function (root) {
  'use strict';
  /* 반등·반락 판별 엔진.
     원안: 외부 세션(Codex) 미리보기 `swing-reversal-beta-1` - 종목 하나를 고르는 형태였다.
     2026-09-13 개편: 이 자리는 **미국 시장**을 판정하는 자리다. 종목을 고르지 않는다.
       나스닥100(QQQ) · S&P500(VOO) · 반도체(SOXX) 셋을 함께 보고 하나의 판정을 낸다.
       개별 종목은 TOP9 집중분석이 본다 - 두 자리의 일이 섞이면 둘 다 흐려진다.
       S&P500 대표는 이 사이트 전체가 VOO 를 쓴다(수집 스크립트·라이브 차트 동일).

     함수가 둘인 이유.
       primitives(s)      가격 구조·모멘텀·거래·200일선. 두 함수가 같은 이 하나를 쓴다.
       evaluate(snap, t)  종목 하나의 판정. 원안 그대로다. 화면은 쓰지 않는다 -
                          원안 12건 기준선 시험(scripts/swing-reversal-selftest.js 1부)이
                          이 함수를 붙잡고 있어서, 개편이 원안의 판정을 바꾸지 않았음을 증명한다.
       evaluateMarket(snap) 세 지수 종합. 화면이 쓰는 것은 이쪽 하나뿐이다.

     ezlong 에서 더한 것.
       스냅샷이 몇 시간 전 것인지 숫자로 말한다.
       생성 시각은 마지막 체결 시각이 아니다. 화면이 '지금'처럼 보이면 안 된다.

     2026-09-13 두 번째 정리 - 화면에서 셋을 들어냈다(운영 피드백).
       1) '기존 판정과 견주면' 상자. 같은 탭 아래에 매수 점수 카드와 Gear 박스가
          제대로 있다. 여기서 숫자를 또 보여 주는 것은 중복이고, "견줄 근거가
          약합니다" 같은 문장은 독자에게 아무 행동도 주지 않는다(41항).
       2) '내 상황' 선택. 골라도 판정은 그대로고 맨 아래 문장 한 줄만 바뀌었다.
          선택지는 무엇을 볼지 정하지 못했다는 뜻이다 - 세 상황을 그냥 다 적는다.
       3) '다시 확인' 버튼. 스냅샷은 하루 한 번 갱신된다. 지금 눌러도 같은 파일이
          온다. 버튼이 있으면 "누르면 최신이 온다"고 읽힌다 - 그건 거짓말이다.

     모델을 부르지 않는다. 판정은 코드가 하고 문장도 코드가 쓴다. */
  const VERSION = 'reversal-beta-1+ez2-market';
  const STALE_HOURS = 96;          // 주말을 감싸는 문턱. 넘으면 판정하지 않는다
  const NOTICE_HOURS = 24;         // 넘으면 화면이 경과 시간을 눈에 띄게 말한다
  const AGREE = 2;                 // 셋 중 둘 이상이 같은 방향일 때만 시장을 판정한다
  const MARKET = [
    { t:'QQQ',  name:'나스닥100', etf:'QQQ'  },
    { t:'VOO',  name:'S&P500',   etf:'VOO'  },
    { t:'SOXX', name:'반도체',    etf:'SOXX' }
  ];
  const valid = v => typeof v === 'number' && Number.isFinite(v);
  const FIELDS = ['price','sma20','sma50','sma200','high20dExcl','low20dExcl'];

  /* 가격에서 바로 나오는 사실만 낸다. 판정은 하지 않는다.
     데이터가 모자라면 null - 부족을 0 으로 바꾸지 않는다(13절). */
  function primitives(s) {
    if (!s || !FIELDS.every(k => valid(s[k]) && s[k] > 0) || s.high20dExcl <= s.low20dExcl) return null;
    const momentumOK = [s.rsi, s.rsi5dAgo, s.macd?.histogram, s.hist5dAgo].every(valid);
    const volumeOK = valid(s.volRatio) && valid(s.changePct);
    return {
      above:     s.price > s.sma20 && s.price > s.sma50,
      below:     s.price < s.sma20 && s.price < s.sma50,
      breakout:  s.price > s.high20dExcl,
      breakdown: s.price < s.low20dExcl,
      trendUp:   s.price > s.sma200,
      momentumOK,
      up:   momentumOK && s.rsi > s.rsi5dAgo && s.macd.histogram > s.hist5dAgo,
      down: momentumOK && s.rsi < s.rsi5dAgo && s.macd.histogram < s.hist5dAgo,
      volumeOK,
      volRatio: volumeOK ? s.volRatio : null,
      volDir:   volumeOK && s.volRatio >= 1.2 ? Math.sign(s.changePct) : 0
    };
  }

  const freshness = (snapshot, now) => {
    const time = Date.parse(snapshot?.generatedAt);
    if (!Number.isFinite(time) || time > now + 300000 || now - time > STALE_HOURS * 3600000) return null;
    return time;
  };
  const STALE_MSG = '시세 스냅샷 시각을 확인할 수 없거나 ' + STALE_HOURS + '시간이 지났습니다.';

  /* ── 종목 하나의 판정 (원안. 화면은 쓰지 않는다 - 위 주석 참고) ───────────── */
  function evaluate(snapshot, ticker, now = Date.now()) {
    const s = snapshot?.symbols?.[ticker];
    const time = freshness(snapshot, now);
    const unavailable = reason => ({ state: '판정 보류', reason, ready: false, axes: [] });
    if (time === null) return unavailable(STALE_MSG);
    const p = primitives(s);
    if (!p) return unavailable('가격 구조를 판단할 데이터가 부족합니다.');
    const axes = [];
    axes.push({ name:'가격 구조', direction:p.breakout || p.above ? 1 : p.breakdown || p.below ? -1 : 0,
      text:p.breakout ? '직전 20일 고가를 웃돕니다. 지지 재확인은 아직 별도 확인이 필요합니다.' : p.breakdown ? '직전 20일 저가를 밑돕니다. 회복 여부를 확인해야 합니다.' : p.above ? '20일·50일 평균 위에 있습니다.' : p.below ? '20일·50일 평균 아래에 있습니다.' : '20일·50일 평균을 기준으로 방향이 엇갈립니다.' });
    axes.push({ name:'모멘텀', direction:p.up ? 1 : p.down ? -1 : 0,
      text:!p.momentumOK ? '비교 데이터가 부족합니다.' : p.up ? 'RSI와 MACD 히스토그램이 5거래일 전보다 함께 개선됐습니다.' : p.down ? 'RSI와 MACD 히스토그램이 5거래일 전보다 함께 약해졌습니다.' : 'RSI와 MACD 변화가 일치하지 않습니다. 둘은 하나의 근거 묶음으로 봅니다.' });
    axes.push({ name:'거래 참여', direction:p.volDir,
      text:!p.volumeOK ? '거래량 비교 데이터가 없습니다.' : `거래량 비율 ${p.volRatio.toFixed(2)}배. ${p.volRatio >= 1.2 ? '거래량 증가가 당일 가격 방향에 동반됩니다.' : '거래량 증가 확인 조건(1.2배)은 충족하지 않았습니다.'}` });
    const market = ['QQQ','VOO'].map(k => snapshot.symbols[k]).filter(x => x && [x.price,x.sma20,x.sma50].every(valid));
    const marketDir = market.length === 2 && market.every(x=>x.price>x.sma20 && x.price>x.sma50) ? 1 : market.length === 2 && market.every(x=>x.price<x.sma20 && x.price<x.sma50) ? -1 : 0;
    axes.push({name:'시장 환경', direction:marketDir, text:market.length !== 2 ? '시장 비교 데이터가 부족합니다.' : marketDir > 0 ? 'QQQ·VOO가 각각 20일·50일 평균 위에 있습니다.' : marketDir < 0 ? 'QQQ·VOO가 각각 20일·50일 평균 아래에 있습니다.' : 'QQQ·VOO의 추세가 일치하지 않습니다.'});
    // Price-derived indicators are not independent votes; structure gates the state.
    let state = '방향 혼재 · 관찰';
    if (p.breakdown) state = '하방 이탈 · 반락 경계';
    else if (p.breakout) state = p.up && marketDir >= 0 ? '상방 돌파 · 지지 확인 대기' : '상방 돌파 · 근거 충돌';
    else if (!p.trendUp && p.up) state = '하락 추세 속 반등 시도';
    else if (p.trendUp && p.below && p.down) state = '상승 추세 속 반락 경계';
    else if (p.above && p.up) state = '회복 우세 · 추세 관찰';
    else if (p.below && p.down) state = '약세 지속 · 회복 미확인';
    return {ready:true, state, axes, time, ageHours:(now - time) / 3600000,
      price:s.price, support:s.low20dExcl, resistance:s.high20dExcl,
      reason:'확률이나 매매 명령이 아닌 규칙 기반 관찰입니다. 돌파·이탈 실패의 확정 판정에는 시계열 검증이 추가로 필요합니다.'};
  }

  /* ── 세 지수 종합: 미국 시장 판정 (화면이 쓰는 것) ──────────────────────── */
  const dirOf = p => p.breakdown ? -1 : p.breakout ? 1 : p.above ? 1 : p.below ? -1 : 0;
  const wordOf = p => p.breakdown ? '20일 저가 이탈' : p.breakout ? '20일 고가 돌파'
                    : p.above ? '20일·50일 평균 위' : p.below ? '20일·50일 평균 아래' : '평균 사이 혼재';

  function evaluateMarket(snapshot, now = Date.now()) {
    const time = freshness(snapshot, now);
    const members = MARKET.map(m => {
      const s = snapshot?.symbols?.[m.t] || null;
      const p = primitives(s);
      return { ...m, ready: !!p, p,
        price: p ? s.price : null, support: p ? s.low20dExcl : null, resistance: p ? s.high20dExcl : null,
        trendUp: p ? p.trendUp : null,
        word: p ? wordOf(p) : '데이터 부족 - 판정에서 제외' };
    });
    const bail = reason => ({ state:'판정 보류', reason, ready:false, axes:[], members, counts:null, lead:null });
    if (time === null) return bail(STALE_MSG);
    const live = members.filter(m => m.ready);
    if (live.length < AGREE)
      return bail(`세 지수 중 판단 가능한 곳이 ${live.length}곳입니다. 한 지수만으로 시장을 판정하지 않습니다.`);

    const n = live.length;
    const c = f => live.filter(m => f(m.p)).length;
    const who = f => live.filter(m => f(m.p)).map(m => m.name).join('·') || '없음';
    const breakdownN = c(p=>p.breakdown), breakoutN = c(p=>p.breakout);
    const aboveN = c(p=>p.above), belowN = c(p=>p.below);
    const upN = c(p=>p.up), downN = c(p=>p.down), momN = c(p=>p.momentumOK);
    const trendN = c(p=>p.trendUp);
    const volUpN = c(p=>p.volDir > 0), volDownN = c(p=>p.volDir < 0);

    const structBits = [];
    if (breakdownN) structBits.push(`${who(p=>p.breakdown)}: 직전 20일 저가 아래`);
    if (breakoutN)  structBits.push(`${who(p=>p.breakout)}: 직전 20일 고가 위`);
    const mixedN = n - aboveN - belowN;
    structBits.push(`20일·50일 평균 위 ${aboveN}곳 / 아래 ${belowN}곳`
      + (mixedN ? ` / 두 평균 사이 ${mixedN}곳(${who(p=>!p.above && !p.below)})` : '')
      + ` (판정 대상 ${n}곳)`);
    const axes = [
      { name:'가격 구조',
        direction: breakdownN >= AGREE || belowN >= AGREE ? -1 : breakoutN >= AGREE || aboveN >= AGREE ? 1 : 0,
        text: structBits.join('. ') + '.' },
      { name:'모멘텀',
        direction: upN >= AGREE ? 1 : downN >= AGREE ? -1 : 0,
        text: (momN < n ? `RSI·MACD 비교 데이터가 있는 곳 ${momN}곳. ` : '')
            + `5거래일 전보다 함께 개선 ${upN}곳(${who(p=>p.up)}) / 함께 약화 ${downN}곳(${who(p=>p.down)}).`
            + (upN < AGREE && downN < AGREE ? ' 둘 이상이 같은 방향을 내지 못했습니다.' : '') },
      { name:'거래 참여',
        direction: volUpN >= AGREE ? 1 : volDownN >= AGREE ? -1 : 0,
        text: live.map(m => `${m.etf} ${m.p.volRatio == null ? '자료 없음' : m.p.volRatio.toFixed(2) + '배'}`).join(' · ')
            + `. 거래량 1.2배 조건을 당일 방향과 함께 충족한 곳: 상승 ${volUpN}곳 / 하락 ${volDownN}곳.` },
      { name:'추세 기반(200일선)',
        direction: trendN >= AGREE ? 1 : (n - trendN) >= AGREE ? -1 : 0,
        text: `200일 평균 위 ${trendN}곳(${who(p=>p.trendUp)}) / 아래 ${n - trendN}곳(${who(p=>!p.trendUp)}).` }
    ];

    /* 가격에서 나온 지표들은 서로 독립된 표가 아니다. 구조가 상태를 게이팅한다. */
    let state = '방향 혼재 · 관찰';
    if (breakdownN >= AGREE) state = '하방 이탈 · 반락 경계';
    else if (breakoutN >= AGREE) state = (upN >= AGREE && trendN >= AGREE) ? '상방 돌파 · 지지 확인 대기' : '상방 돌파 · 근거 충돌';
    else if (trendN < AGREE && upN >= AGREE) state = '하락 추세 속 반등 시도';
    else if (trendN >= AGREE && belowN >= AGREE && downN >= AGREE) state = '상승 추세 속 반락 경계';
    else if (aboveN >= AGREE && upN >= AGREE) state = '회복 우세 · 추세 관찰';
    else if (belowN >= AGREE && downN >= AGREE) state = '약세 지속 · 회복 미확인';

    /* 반도체만 갈라질 때. 변동이 큰 쪽이 먼저 움직이는 일은 잦다 -
       먼저 움직였다는 사실만으로 방향을 확정하지는 않는다(91항 기저율). */
    let lead = null;
    const soxx = live.find(m => m.t === 'SOXX');
    const core = live.filter(m => m.t !== 'SOXX');
    if (soxx && core.length >= AGREE && core.every(m => dirOf(m.p) === dirOf(core[0].p))
        && dirOf(soxx.p) !== dirOf(core[0].p)) {
      lead = dirOf(soxx.p) < 0
        ? '반도체가 지수보다 먼저 아래로 꺾였습니다. 반도체는 변동이 큰 쪽이라 먼저 움직이는 일이 잦습니다. 지수가 따라가는지를 확인하기 전까지 시장 전체의 방향으로 읽지 않습니다.'
        : '반도체만 위로 향합니다. 지수가 따라오는지를 확인하기 전까지 시장 전체의 방향으로 읽지 않습니다.';
    }

    return { ready:true, state, axes, members, lead,
      time, ageHours:(now - time) / 3600000,
      counts:{ n, breakdownN, breakoutN, aboveN, belowN, upN, downN, trendN, volUpN, volDownN, agree:AGREE },
      reason:'확률이나 매매 명령이 아닌 규칙 기반 관찰입니다. 나스닥100·S&P500·반도체 중 둘 이상이 같은 방향일 때만 시장을 판정합니다. 돌파·이탈 실패의 확정 판정에는 시계열 검증이 추가로 필요합니다.' };
  }

  /* ── 화면 머리: 판정을 한 줄 사실 + 한 줄 의미 + 다음 신호로 압축한다 ──────────
     2026-10-31 운영 피드백: "무슨 소린지, 어떻게 하라는 건지 모르겠다. 서두만 읽다가
     도망갈 듯." 이전 머리는 '하방 이탈 · 반락 경계' 같은 상태 이름 뒤에 면책 문장,
     지수 세 줄, 근거 네 칸, 가격표, 상황별 세 문단이 차례로 펼쳐졌다.
     이제 머리에는 셋만 둔다.
       head  지금 가격이 어디 있는지 - 상태 이름이 아니라 사실로 쓴다
       line  그게 무슨 뜻인지 - 명사형 한 줄
       next  무엇이 바뀌면 판정이 바뀌는지 - 지수별 기준 가격과 거리(%)
     근거 네 축·상황별 문장·한계는 '근거와 기준' 접힘 안으로 내렸다. 지운 것은 없다.
     판정(state)은 evaluateMarket 이 이미 정했다. 여기서는 말만 바꾼다(13절: 판정은 한 번). */
  function hero(r) {
    if (!r || !r.ready) return null;
    const live = r.members.filter(m => m.ready);
    const k = r.counts, A = k.agree;
    const group = f => {
      const hit = live.filter(m => f(m.p));
      return live.length === 3 && hit.length === 3 ? '세 지수 모두' : hit.map(m => m.name).join('·');
    };
    const UP = { key:'resistance', label:'돌파선' }, DN = { key:'support', label:'이탈선' };
    const S = {
      '하방 이탈 · 반락 경계': { tone:'down', badge:'반락 경계',
        head:`${group(p=>p.breakdown)} 20일 최저가 아래로`,
        line:'하락 흐름 진행 중: 반등 확인 전 구간',
        lvl:{ key:'support', label:'회복선' },
        next:`${A}곳 이상이 회복선 위로 돌아오면 이탈 해제` },
      '상방 돌파 · 지지 확인 대기': { tone:'up', badge:'돌파',
        head:`${group(p=>p.breakout)} 20일 최고가 위로`,
        line:'상승 흐름 확인: 돌파한 가격을 지키는지 확인 구간',
        lvl:{ key:'resistance', label:'지지선' },
        next:`${A}곳 이상이 지지선 아래로 밀리면 돌파 실패` },
      '상방 돌파 · 근거 충돌': { tone:'mixed', badge:'돌파·근거 부족',
        head:`${group(p=>p.breakout)} 20일 최고가 위로`,
        line:'가격은 돌파, 모멘텀·200일선은 아직 미동반 구간',
        lvl:{ key:'resistance', label:'지지선' },
        next:`${A}곳 이상이 지지선 아래로 밀리면 돌파 실패` },
      '하락 추세 속 반등 시도': { tone:'mixed', badge:'반등 시도',
        head:'200일선 아래에서 반등 시도',
        line:'단기 모멘텀 개선, 큰 추세는 아직 하락 구간',
        lvl:UP, next:`${A}곳 이상이 돌파선을 넘으면 상승 전환 확인` },
      '상승 추세 속 반락 경계': { tone:'mixed', badge:'눌림',
        head:'200일선 위, 단기 평균 아래로 밀림',
        line:'큰 추세는 상승, 단기 흐름은 약화 구간',
        lvl:DN, next:`${A}곳 이상이 이탈선 아래로 마감하면 하방 이탈` },
      '회복 우세 · 추세 관찰': { tone:'up', badge:'회복 우세',
        head:'20일·50일 평균 위로 회복',
        line:'단기 흐름 회복: 추세 지속 여부 관찰 구간',
        lvl:UP, next:`${A}곳 이상이 돌파선을 넘으면 상승 확인` },
      '약세 지속 · 회복 미확인': { tone:'down', badge:'약세',
        head:'20일·50일 평균 아래 약세 지속',
        line:'회복 신호 미확인 구간',
        lvl:DN, next:`${A}곳 이상이 이탈선 아래로 마감하면 하방 이탈` },
      '방향 혼재 · 관찰': { tone:'mixed', badge:'방향 혼재',
        head:'세 지수 방향 엇갈림',
        line:'한쪽으로 판정하지 않는 구간',
        lvl:null, next:`${A}곳 이상이 같은 쪽 기준선을 넘을 때 판정` }
    };
    const h = S[r.state];
    if (!h) return null;
    const pct = (lv, px) => { const v = (lv / px - 1) * 100; return (v > 0 ? '+' : '') + v.toFixed(1) + '%'; };
    const chips = live.map(m => {
      const lv = h.lvl ? [{ label:h.lvl.label, value:m[h.lvl.key] }]
                       : [{ label:'돌파선', value:m.resistance }, { label:'이탈선', value:m.support }];
      return { name:m.name, etf:m.etf, price:m.price, word:m.word,
               levels: lv.map(x => ({ ...x, dist: pct(x.value, m.price) })) };
    });
    return { tone:h.tone, badge:h.badge, head:h.head, line:h.line, next:h.next, chips };
  }

  if (typeof module !== 'undefined') module.exports = {evaluate, evaluateMarket, primitives, hero, VERSION, STALE_HOURS, NOTICE_HOURS, AGREE, MARKET};
  /* 여기서부터는 화면이다. 고르는 장치는 두지 않는다 - 이 패널은 읽는 곳이다. */
  if (!root.document) return;
  const host = document.getElementById('reversal-panel');
  if (!host) return;
  const escape = x => String(x).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let snapshot;
  /* 머리 위 작은 줄은 주어를 밝히는 자리다(53항). 바로 위 BUY·SELL·HOLD 는 매매 점수이고
     이 판은 가격의 자리다. 둘이 다른 말을 하는 날에도 무엇을 재는지가 갈리면 읽힌다. */
  host.innerHTML = `<p class="rv-scope">가격 흐름 · 나스닥100 QQQ · S&amp;P500 VOO · 반도체 SOXX</p><div id="rv-result" aria-live="polite"><p class="rv-line">시세 확인 중</p></div><p id="rv-time"></p><details class="rv-more"><summary>근거와 기준 보기</summary><div id="rv-plan"></div><p class="rv-note">일봉 지표 스냅샷을 이용합니다. 생성시각은 마지막 체결시각과 다릅니다. ${STALE_HOURS}시간 초과 또는 핵심 데이터 부족 시 판정을 보류하며, 판단 가능한 지수가 ${AGREE}곳 미만이면 판정하지 않습니다. S&amp;P500 대표는 이 사이트 전체가 VOO 를 씁니다. 세 지수가 갈릴 때는 갈렸다고 적고 한쪽으로 기울지 않습니다. 실적 일정·업종 비교·장중 확정 여부는 이번 판정에 포함하지 않습니다. 거래량 1.2배 같은 기준은 아직 적중률을 검증하지 않은 가정입니다. 확률이나 매매 명령이 아닌 규칙 기반 관찰입니다. 성공률·수익성 검증 전 베타이며 기존 Gear·매매점수와 별도로 봅니다.</p></details>`;
  const price = x => '$' + x.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  const WD = '일월화수목금토';
  function stamp(t) {
    /* 상대어(오늘·어제)를 쓰지 않는다(89항). 수집 시각을 KST 절대 시각으로 적는다. */
    const k = new Date(t + 9 * 3600000);
    const hh = String(k.getUTCHours()).padStart(2, '0'), mm = String(k.getUTCMinutes()).padStart(2, '0');
    return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일(${WD[k.getUTCDay()]}) ${hh}:${mm} KST`;
  }
  function paint() {
    const r = evaluateMarket(snapshot);
    const timeEl = document.getElementById('rv-time');
    const result = document.getElementById('rv-result');
    const plan = document.getElementById('rv-plan');
    host.classList.remove('rv-tone-up','rv-tone-down','rv-tone-mixed');
    const hv = hero(r);
    if (!r.ready || !hv) {
      result.innerHTML = `<h2 class="rv-headline">미국 시장 판정 보류</h2><p class="rv-line">${escape(r.reason)}</p>`;
      timeEl.textContent = r.ready ? '' : '최신 시세 확인 필요';
      timeEl.classList.remove('rv-old');
      plan.replaceChildren();
      return;
    }
    host.classList.add('rv-tone-' + hv.tone);
    const h = r.ageHours;
    const ago = h < 1 ? '1시간 이내' : h < 48 ? `${Math.round(h)}시간 전` : `${Math.floor(h / 24)}일 전`;
    timeEl.textContent = `시세 ${stamp(r.time)} 수집 (${ago}) · 일봉 기준`;
    timeEl.classList.toggle('rv-old', h > NOTICE_HOURS);
    result.innerHTML =
      `<div class="rv-top"><span class="rv-badge">${escape(hv.badge)}</span><h2 class="rv-headline">${escape(hv.head)}</h2></div>`
      + `<p class="rv-line">${escape(hv.line)}</p>`
      + `<div class="rv-members">${hv.chips.map(c => `<div class="rv-member"><span class="rv-m-name">${escape(c.name)} <b>${escape(c.etf)}</b></span><span class="rv-m-price">${escape(price(c.price))}</span><span class="rv-m-word">${escape(c.word)}</span>${c.levels.map(l => `<span class="rv-m-level">${escape(l.label)} ${escape(price(l.value))} <em>${escape(l.dist)}</em></span>`).join('')}</div>`).join('')}</div>`
      + `<p class="rv-next"><b>다음 신호</b> ${escape(hv.next)}</p>`
      + (r.lead ? `<p class="rv-lead">${escape(r.lead)}</p>` : '');
    plan.innerHTML =
      `<div class="rv-axes">${r.axes.map(a=>`<div><h4>${escape(a.name)} <span class="rv-dir">${a.direction>0?'상승 근거':a.direction<0?'하락 근거':'미확인·혼재'}</span></h4><p>${escape(a.text)}</p></div>`).join('')}</div>`
      + `<h3>지수별 기준 가격</h3><div class="rv-levels">${r.members.filter(m=>m.ready).map(m=>`<div class="rv-level"><span class="rv-l-name">${escape(m.name)} <b>${escape(m.etf)}</b></span><span class="rv-l-up">상방 ${escape(price(m.resistance))}</span><span class="rv-l-dn">하방 ${escape(price(m.support))}</span></div>`).join('')}</div>`
      + `<p>상방은 직전 20일 고가, 하방은 직전 20일 저가입니다. ${escape(String(r.counts.agree))}곳 이상이 같은 쪽을 넘어설 때 시장 판정이 바뀝니다.</p>`
      + `<p class="rv-cases"><b>미보유라면</b> 돌파 전 선진입과 돌파 후 지지 확인은 다른 계획입니다. 회복 조건을 충족하지 못하면 진입을 보류하는 선택도 남겨둡니다.<br><b>보유 중이라면</b> 감당할 손실을 먼저 점검합니다. 지지를 잃고 회복하지 못할 때 축소 계획을 재검토합니다.<br><b>추가매수를 본다면</b> 평균단가가 내려가는 것보다 더 떨어졌을 때의 계좌 손실을 먼저 비교합니다.</p>`
      + `<p class="rv-note">기준 가격은 관찰선이지 목표가·손절 권고가 아닙니다. 갭과 급변 시 원하는 가격에 거래하지 못할 수 있습니다.</p>`;
  }
  async function load() {
    try {
      const response = await fetch('/data/market-signals.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('HTTP');
      snapshot=await response.json();paint();
    } catch (_) {snapshot=null;paint();document.getElementById('rv-time').textContent='시세를 가져오지 못했습니다. 페이지를 새로고침해 주십시오.';}
  }
  load();
})(typeof window !== 'undefined' ? window : globalThis);
