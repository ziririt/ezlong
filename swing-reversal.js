(function (root) {
  'use strict';
  /* 반등·반락 판별 엔진.
     원안: 외부 세션(Codex) 미리보기 `swing-reversal-beta-1`.
     ezlong 반영 시 두 가지를 더했다.
       1) 기존 판정(매수 점수·Gear)과 어긋날 때 그 사실을 말한다.
          두 엔진은 철학이 다르다. 이 사이트의 S-CORE 는 FEAR 50% 라 공포가 클수록
          점수가 오르고(36항), 이 엔진은 구조가 깨지면 기다리라고 한다.
          실측(2026-09-13, IWM): 여기선 '하방 이탈 · 반락 경계' 인데 매수 점수는 72 였다.
          어긋남을 숨기면 같은 화면에 다른 말이 남는다(13절). 숨기지 말고 설명한다.
       2) 스냅샷이 몇 시간 전 것인지 숫자로 말한다.
          생성 시각은 마지막 체결 시각이 아니다. 화면이 '지금'처럼 보이면 안 된다.

     모델을 부르지 않는다. 판정은 코드가 하고 문장도 코드가 쓴다. */
  const VERSION = 'reversal-beta-1+ez1';
  const STALE_HOURS = 96;          // 주말을 감싸는 문턱. 넘으면 판정하지 않는다
  const NOTICE_HOURS = 24;         // 넘으면 화면이 경과 시간을 눈에 띄게 말한다
  const valid = v => typeof v === 'number' && Number.isFinite(v);

  /* 기존 판정과의 관계. 어느 쪽이 옳다고 정하지 않는다 - 다른 것을 보고 있다고 말한다. */
  function alignmentOf(state, s) {
    if (!s || !valid(s.buyScore)) return null;
    const bullish = /돌파|회복 우세|반등 시도/.test(state);
    const bearish = /이탈|반락|약세/.test(state);
    const high = s.buyScore >= 60, low = s.buyScore < 45;
    let note = '';
    if (bearish && high) {
      note = '구조는 아래로 꺾였는데 매수 점수는 높습니다. 이 사이트의 점수는 '
           + '공포가 클수록 올라가는 설계라(FEAR 50%), "떨어지는 중"과 "매수 매력이 크다"가 '
           + '동시에 참일 수 있습니다. 이 패널은 지금 구조를, 점수는 심리를 봅니다.';
    } else if (bullish && low) {
      note = '구조는 위로 향하는데 매수 점수는 낮습니다. 이미 오른 뒤라 공포 지표가 '
           + '식었다는 뜻일 수 있습니다. 추격 진입인지 아닌지를 먼저 가르십시오.';
    } else if (bullish && high) {
      note = '구조와 매수 점수가 같은 방향을 가리킵니다. 다만 같은 가격에서 나온 '
           + '두 시선이라 서로를 증명하지는 않습니다.';
    } else if (bearish && !high) {
      note = '구조와 매수 점수가 모두 신중한 쪽입니다.';
    } else {
      note = '구조가 한쪽으로 기울지 않아 점수와 견줄 근거가 약합니다.';
    }
    return { buyScore: s.buyScore, sellScore: valid(s.sellScore) ? s.sellScore : null,
             gear: valid(s.gear) ? s.gear : null, conflict: (bearish && high) || (bullish && low), note };
  }

  function evaluate(snapshot, ticker, now = Date.now()) {
    const s = snapshot?.symbols?.[ticker];
    const time = Date.parse(snapshot?.generatedAt);
    const unavailable = reason => ({ state: '판정 보류', reason, ready: false, axes: [] });
    if (!Number.isFinite(time) || time > now + 300000 || now - time > STALE_HOURS * 3600000)
      return unavailable('시세 스냅샷 시각을 확인할 수 없거나 ' + STALE_HOURS + '시간이 지났습니다.');
    if (!s || !['price','sma20','sma50','sma200','high20dExcl','low20dExcl'].every(k => valid(s[k]) && s[k] > 0) || s.high20dExcl <= s.low20dExcl)
      return unavailable('가격 구조를 판단할 데이터가 부족합니다.');
    const axes = [];
    const above = s.price > s.sma20 && s.price > s.sma50;
    const below = s.price < s.sma20 && s.price < s.sma50;
    const breakout = s.price > s.high20dExcl, breakdown = s.price < s.low20dExcl;
    axes.push({ name:'가격 구조', direction:breakout || above ? 1 : breakdown || below ? -1 : 0,
      text:breakout ? '직전 20일 고가를 웃돕니다. 지지 재확인은 아직 별도 확인이 필요합니다.' : breakdown ? '직전 20일 저가를 밑돕니다. 회복 여부를 확인해야 합니다.' : above ? '20일·50일 평균 위에 있습니다.' : below ? '20일·50일 평균 아래에 있습니다.' : '20일·50일 평균을 기준으로 방향이 엇갈립니다.' });
    const momentumOK = [s.rsi,s.rsi5dAgo,s.macd?.histogram,s.hist5dAgo].every(valid);
    const up = momentumOK && s.rsi > s.rsi5dAgo && s.macd.histogram > s.hist5dAgo;
    const down = momentumOK && s.rsi < s.rsi5dAgo && s.macd.histogram < s.hist5dAgo;
    axes.push({ name:'모멘텀', direction:up ? 1 : down ? -1 : 0,
      text:!momentumOK ? '비교 데이터가 부족합니다.' : up ? 'RSI와 MACD 히스토그램이 5거래일 전보다 함께 개선됐습니다.' : down ? 'RSI와 MACD 히스토그램이 5거래일 전보다 함께 약해졌습니다.' : 'RSI와 MACD 변화가 일치하지 않습니다. 둘은 하나의 근거 묶음으로 봅니다.' });
    const volumeOK = valid(s.volRatio) && valid(s.changePct);
    axes.push({ name:'거래 참여', direction:volumeOK && s.volRatio >= 1.2 ? Math.sign(s.changePct) : 0,
      text:!volumeOK ? '거래량 비교 데이터가 없습니다.' : `거래량 비율 ${s.volRatio.toFixed(2)}배. ${s.volRatio >= 1.2 ? '거래량 증가가 당일 가격 방향에 동반됩니다.' : '거래량 증가 확인 조건(1.2배)은 충족하지 않았습니다.'}` });
    const market = ['QQQ','VOO'].map(k => snapshot.symbols[k]).filter(x => x && [x.price,x.sma20,x.sma50].every(valid));
    const marketDir = market.length === 2 && market.every(x=>x.price>x.sma20 && x.price>x.sma50) ? 1 : market.length === 2 && market.every(x=>x.price<x.sma20 && x.price<x.sma50) ? -1 : 0;
    axes.push({name:'시장 환경', direction:marketDir, text:market.length !== 2 ? '시장 비교 데이터가 부족합니다.' : marketDir > 0 ? 'QQQ·VOO가 각각 20일·50일 평균 위에 있습니다.' : marketDir < 0 ? 'QQQ·VOO가 각각 20일·50일 평균 아래에 있습니다.' : 'QQQ·VOO의 추세가 일치하지 않습니다.'});
    // Price-derived indicators are not independent votes; structure gates the state.
    let state = '방향 혼재 · 관찰';
    if (breakdown) state = '하방 이탈 · 반락 경계';
    else if (breakout) state = up && marketDir >= 0 ? '상방 돌파 · 지지 확인 대기' : '상방 돌파 · 근거 충돌';
    else if (s.price < s.sma200 && up) state = '하락 추세 속 반등 시도';
    else if (s.price > s.sma200 && below && down) state = '상승 추세 속 반락 경계';
    else if (above && up) state = '회복 우세 · 추세 관찰';
    else if (below && down) state = '약세 지속 · 회복 미확인';
    return {ready:true, state, axes, time, ageHours:(now - time) / 3600000,
      price:s.price, support:s.low20dExcl, resistance:s.high20dExcl,
      alignment: alignmentOf(state, s),
      reason:'확률이나 매매 명령이 아닌 규칙 기반 관찰입니다. 돌파·이탈 실패의 확정 판정에는 시계열 검증이 추가로 필요합니다.'};
  }
  if (typeof module !== 'undefined') module.exports = {evaluate, VERSION, STALE_HOURS, NOTICE_HOURS};
  if (!root.document) return;
  const host = document.getElementById('reversal-panel');
  if (!host) return;
  const escape = x => String(x).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let snapshot, ticker = 'QQQ', mode = 'watch';
  host.innerHTML = `<div class="rv-head"><div><p class="rv-kicker">스윙 시그널 · 베타</p><h2>반등·반락 판별과 대응 계획</h2></div><label>종목 <select id="rv-ticker"><option>QQQ</option><option>VOO</option><option>SOXX</option><option>TSLA</option><option>NVDA</option></select></label></div><p id="rv-time">시세 스냅샷 확인 중…</p><div id="rv-result" aria-live="polite"></div><div class="rv-controls"><label>내 상황 <select id="rv-mode"><option value="watch">미보유 · 진입 검토</option><option value="hold">보유 · 유지/축소 검토</option><option value="add">보유 · 추가매수 검토</option></select></label><button type="button" id="rv-retry">다시 확인</button></div><div id="rv-plan"></div><details><summary>판정 기준과 한계</summary><p>일봉 지표 스냅샷을 이용합니다. 생성시각은 마지막 체결시각과 다릅니다. ${STALE_HOURS}시간 초과 또는 핵심 데이터 부족 시 판정을 보류합니다. 실적 일정·업종 비교·장중 확정 여부는 이번 판정에 포함하지 않습니다. QQQ·VOO 판정에서는 시장 근거가 종목과 겹칩니다. 거래량 1.2배 같은 기준은 아직 적중률을 검증하지 않은 가정입니다. 성공률·수익성 검증 전 베타이며 기존 Gear·매매점수와 별도로 봅니다.</p></details>`;
  function paint() {
    const r = evaluate(snapshot,ticker);
    const timeEl = document.getElementById('rv-time');
    if (r.ready) {
      /* 생성 시각만 적으면 '지금'처럼 읽힌다. 몇 시간 전인지 숫자로 같이 말한다. */
      const h = r.ageHours;
      const ago = h < 1 ? '1시간 이내' : h < 48 ? `${Math.round(h)}시간 전` : `${Math.floor(h / 24)}일 전`;
      timeEl.textContent = `스냅샷 생성: ${new Date(r.time).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST (${ago}) · 일봉 관찰`;
      timeEl.classList.toggle('rv-old', h > NOTICE_HOURS);
    } else {
      timeEl.textContent = '최신 시세 확인 필요';
      timeEl.classList.remove('rv-old');
    }
    const result = document.getElementById('rv-result');
    result.innerHTML = `<h3>${escape(r.state)}</h3><p>${escape(r.reason)}</p>`;
    const plan = document.getElementById('rv-plan');
    if (!r.ready) {plan.replaceChildren();return;}
    result.innerHTML += `<div class="rv-axes">${r.axes.map(a=>`<div><h4>${escape(a.name)} <span class="rv-dir">${a.direction>0?'상승 근거':a.direction<0?'하락 근거':'미확인·혼재'}</span></h4><p>${escape(a.text)}</p></div>`).join('')}</div>`;
    if (r.alignment) {
      const a = r.alignment;
      const nums = [`매수 점수 ${a.buyScore}`, a.sellScore != null ? `매도 압력 ${a.sellScore}` : '', a.gear != null ? `Gear ${a.gear}` : '']
        .filter(Boolean).join(' · ');
      result.innerHTML += `<div class="rv-align${a.conflict ? ' rv-align-conflict' : ''}"><h4>이 사이트의 기존 판정과 견주면</h4><p class="rv-align-nums">${escape(nums)}</p><p>${escape(a.note)}</p></div>`;
    }
    const price = x => '$'+x.toLocaleString('en-US',{maximumFractionDigits:2});
    const action = mode==='hold' ? '보유 규모와 감당할 손실을 먼저 점검하고, 지지 이탈 후 회복하지 못할 때 축소 계획을 재검토합니다.' : mode==='add' ? '추가매수로 종목 집중도가 커집니다. 평균단가 하락보다 추가 하락 시 계좌 손실을 먼저 비교합니다.' : '돌파 전 선진입과 돌파 후 지지 확인은 다른 계획입니다. 가격이 회복 조건을 충족하지 못하면 진입을 보류하는 선택도 남겨둡니다.';
    plan.innerHTML = `<h3>다음에 확인할 조건</h3><div class="rv-conditions"><p><strong>상방 기준 ${price(r.resistance)}</strong><br>직전 20일 고가 위 종가와 이후 지지 유지 여부. 이미 돌파했다면 재이탈을 관찰합니다.</p><p><strong>하방 기준 ${price(r.support)}</strong><br>직전 20일 저가 아래 종가와 이후 회복 여부. 이미 이탈했다면 회복 실패를 관찰합니다.</p></div><p>${action}</p><p class="rv-note">두 가격은 관찰 기준이지 목표가·손절 권고가 아닙니다. 갭과 급변 시 원하는 가격에 거래하지 못할 수 있습니다.</p>`;
  }
  async function load() {
    const button = document.getElementById('rv-retry');button.disabled=true;
    try {
      const response = await fetch('/data/market-signals.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('HTTP');
      snapshot=await response.json();paint();
    } catch (_) {snapshot=null;paint();document.getElementById('rv-time').textContent='시세를 가져오지 못했습니다. 다시 확인해 주세요.';}
    finally {button.disabled=false;}
  }
  document.getElementById('rv-ticker').addEventListener('change', e=>{ticker=e.target.value;paint();});
  document.getElementById('rv-mode').addEventListener('change', e=>{mode=e.target.value;paint();});
  document.getElementById('rv-retry').addEventListener('click',load);
  load();
})(typeof window !== 'undefined' ? window : globalThis);
