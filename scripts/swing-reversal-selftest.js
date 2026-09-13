#!/usr/bin/env node
/* 반등·반락 판별 엔진 시험.
   실행: node scripts/swing-reversal-selftest.js

   1부는 외부 세션(Codex)이 미리보기와 함께 넘긴 12건을 **그대로** 옮긴 것이다.
   원안의 판정이 반영 과정에서 달라지지 않았는지 보는 기준선이다.
   2부는 ezlong 에서 더한 것 - 기존 판정과의 관계, 스냅샷 경과 시간.
   3부는 오늘 실제 데이터로 돌려 화면이 깨지지 않는지 본다.
   4부는 2026-09-13 개편 - 이 자리는 종목이 아니라 **미국 시장**을 판정한다.
   나스닥100·S&P500·반도체 셋을 종합하고, 둘 이상이 같은 방향일 때만 판정한다. */
'use strict';

const assert = require('node:assert/strict');
const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { evaluate, evaluateMarket, primitives, VERSION, STALE_HOURS, NOTICE_HOURS, AGREE, MARKET }
  = require(path.join(ROOT, 'swing-reversal.js'));

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

/* ══════════════════════════════════════════════════════════════════
   4부 — 세 지수 종합 시장 판정 (2026-09-13 개편)
══════════════════════════════════════════════════════════════════ */
console.log('[4부] 세 지수 종합 - 미국 시장 판정');
{
  const now = Date.parse('2026-09-13T00:00:00Z');
  /* 기준 지수: 20일·50일 평균 위, 200일선 위, 모멘텀 개선 */
  const B = {price:110,sma20:105,sma50:100,sma200:90,high20dExcl:115,low20dExcl:95,
             rsi:55,rsi5dAgo:45,macd:{histogram:2},hist5dAgo:1,volRatio:1.3,changePct:1};
  const mk = (over = {}) => ({
    generatedAt: new Date(now).toISOString(),
    symbols: { QQQ:{...B, ...(over.QQQ || {})}, VOO:{...B, ...(over.VOO || {})},
               SOXX:{...B, ...(over.SOXX || {})}, TSLA:{...B, price:1}, NVDA:{...B, price:1} }
  });

  /* ── 대상이 셋으로 고정돼 있다 ── */
  ok('판정 대상은 QQQ·VOO·SOXX 셋', MARKET.map(m => m.t).join(',') === 'QQQ,VOO,SOXX',
     MARKET.map(m => m.t).join(','));
  ok('둘 이상 합의 기준', AGREE === 2, String(AGREE));
  {
    const r = evaluateMarket(mk(), now);
    ok('members 는 늘 셋', r.members.length === 3, String(r.members.length));
    ok('TSLA·NVDA 는 시장 판정에 끼지 않는다',
       !r.members.some(m => m.t === 'TSLA' || m.t === 'NVDA'));
    ok('네 축을 낸다', r.axes.length === 4, String(r.axes.length));
    ok('축 이름에 200일선 축이 있다', r.axes.some(a => /200일선/.test(a.name)),
       r.axes.map(a => a.name).join('/'));
    ok('축 방향은 -1/0/1', r.axes.every(a => [-1,0,1].includes(a.direction)));
    ok('기본 상태는 회복 우세', r.state === '회복 우세 · 추세 관찰', r.state);
  }

  /* ── 구조가 상태를 게이팅한다: 둘 이상이어야 판정이 움직인다 ── */
  {
    const one = evaluateMarket(mk({SOXX:{price:94}}), now);
    ok('한 곳만 이탈하면 시장 판정은 이탈이 아니다', one.state !== '하방 이탈 · 반락 경계', one.state);
    ok('한 곳만 이탈해도 판정 자체는 나온다', one.ready === true);
    const two = evaluateMarket(mk({SOXX:{price:94}, VOO:{price:94}}), now);
    ok('두 곳이 이탈하면 하방 이탈', two.state === '하방 이탈 · 반락 경계', two.state);
    ok('이탈한 지수 이름을 가격 구조 축에 적는다',
       /S&P500|반도체/.test(two.axes[0].text), two.axes[0].text.slice(0, 60));
  }
  {
    const r = evaluateMarket(mk({QQQ:{price:120}, VOO:{price:120}}), now);
    ok('두 곳 돌파 + 모멘텀·추세 동반 -> 지지 확인 대기',
       r.state === '상방 돌파 · 지지 확인 대기', r.state);
    const r2 = evaluateMarket(mk({QQQ:{price:120, rsi:30, macd:{histogram:-2}},
                                 VOO:{price:120, rsi:30, macd:{histogram:-2}}}), now);
    ok('돌파했는데 모멘텀이 따라오지 않으면 근거 충돌',
       r2.state === '상방 돌파 · 근거 충돌', r2.state);
  }
  {
    const down = {price:99, rsi:30, rsi5dAgo:60, macd:{histogram:-2}, hist5dAgo:1};
    const r = evaluateMarket(mk({QQQ:down, VOO:down}), now);
    ok('200일선 위인데 둘이 평균 아래 + 약화 -> 상승 추세 속 반락 경계',
       r.state === '상승 추세 속 반락 경계', r.state);
  }
  {
    const r = evaluateMarket(mk({QQQ:{sma200:130}, VOO:{sma200:130}, SOXX:{sma200:130}}), now);
    ok('200일선 아래 + 모멘텀 개선 -> 하락 추세 속 반등 시도',
       r.state === '하락 추세 속 반등 시도', r.state);
    ok('추세 축이 하락을 가리킨다', r.axes[3].direction === -1, String(r.axes[3].direction));
  }

  /* ── 재료가 없으면 판정하지 않는다(13절) ── */
  {
    const snap = mk(); delete snap.symbols.VOO; delete snap.symbols.SOXX;
    const r = evaluateMarket(snap, now);
    ok('판단 가능한 지수가 하나면 판정 보류', r.ready === false, r.state);
    ok('보류 사유에 몇 곳인지 적는다', /1곳/.test(r.reason), r.reason);
    ok('보류해도 members 는 셋을 돌려준다', r.members.length === 3);
    ok('빠진 지수는 제외라고 적는다',
       r.members.filter(m => !m.ready).every(m => /제외/.test(m.word)));
  }
  {
    const snap = mk(); delete snap.symbols.SOXX;
    const r = evaluateMarket(snap, now);
    ok('둘만 있어도 판정한다', r.ready === true, r.state);
    ok('판정 대상 수를 축에 적는다', /판정 대상 2곳/.test(r.axes[0].text), r.axes[0].text);
  }
  {
    ok('문턱을 넘기면 보류', evaluateMarket(mk(), now + (STALE_HOURS + 1) * 3600000).ready === false);
    ok('문턱 직전까지는 판정', evaluateMarket(mk(), now + (STALE_HOURS - 1) * 3600000).ready === true);
    ok('미래 시각은 보류', evaluateMarket(mk(), now - 3600000).ready === false);
    ok('스냅샷이 없으면 보류', evaluateMarket(null, now).ready === false);
    ok('경과 시간을 숫자로 준다',
       Math.abs(evaluateMarket(mk(), now + 5 * 3600000).ageHours - 5) < 1e-9);
  }

  /* ── 반도체만 갈라질 때 ── */
  {
    const r = evaluateMarket(mk({SOXX:{price:94}}), now);
    ok('반도체만 아래로 꺾이면 그 사실을 적는다', typeof r.lead === 'string' && /반도체/.test(r.lead),
       String(r.lead).slice(0, 40));
    ok('먼저 움직였다고 방향을 확정하지 않는다', /확정|읽지 않습니다/.test(r.lead), r.lead.slice(0, 60));
    const same = evaluateMarket(mk(), now);
    ok('셋이 같은 방향이면 갈림 문장을 쓰지 않는다', same.lead === null, String(same.lead));
    const core = evaluateMarket(mk({QQQ:{price:94}}), now);
    ok('갈린 쪽이 지수면 반도체 선행 문장을 쓰지 않는다', core.lead === null, String(core.lead));
  }

  /* ── 기존 판정과 견주기: 세 지수 매수 점수 평균 ── */
  {
    const r = evaluateMarket(mk({QQQ:{buyScore:70, sellScore:11, gear:3},
                                 VOO:{buyScore:72, gear:3}, SOXX:{buyScore:74, gear:3}}), now);
    ok('매수 점수를 평균한다', r.alignment.avg === 72, String(r.alignment.avg));
    ok('지수별 점수를 그대로 싣는다', r.alignment.per.length === 3
       && r.alignment.per[0].etf === 'QQQ' && r.alignment.per[0].buyScore === 70);
    const conflict = evaluateMarket(mk({QQQ:{price:94, buyScore:72}, VOO:{price:94, buyScore:72},
                                        SOXX:{buyScore:72}}), now);
    ok('하방 이탈 + 높은 평균 점수 -> 어긋남', conflict.alignment.conflict === true);
    ok('어긋남 설명에 FEAR 설계를 밝힌다', /FEAR 50%/.test(conflict.alignment.note));
    const bare = mk();
    ['QQQ','VOO','SOXX'].forEach(t => { delete bare.symbols[t].buyScore; });
    ok('점수가 없으면 견주지 않는다', evaluateMarket(bare, now).alignment === null);
  }

  /* ── 지수별 상방·하방 기준 ── */
  {
    const r = evaluateMarket(mk(), now);
    ok('지수마다 상방·하방 기준을 준다',
       r.members.every(m => m.resistance > m.support && Number.isFinite(m.price)));
  }

  /* ── 종목 선택 화면이 남아 있지 않다 ── */
  {
    const src = fs.readFileSync(path.join(ROOT, 'swing-reversal.js'), 'utf8');
    ok('종목 선택 드롭다운이 없다', !/rv-ticker/.test(src));
    ok('화면은 evaluateMarket 을 부른다', /evaluateMarket\(snapshot\)/.test(src));
    ok('화면 상태에 종목 변수가 없다', !/ticker\s*=\s*'QQQ'/.test(src));
    ok('세 지수를 화면 안내에 적는다', /QQQ[\s\S]{0,40}VOO[\s\S]{0,40}SOXX/.test(src));
    const css = fs.readFileSync(path.join(ROOT, 'swing-reversal.css'), 'utf8');
    ok('지수 줄 서식이 있다', /\.rv-member\b/.test(css) && /\.rv-level\b/.test(css));
  }

  /* ── 대시보드에서 탭이 하나 줄었다 ── */
  ['atmr-dashboard.html', 'en/atmr-dashboard.html'].forEach(f => {
    const h = fs.readFileSync(path.join(ROOT, f), 'utf8');
    ok(`${f}: 탭 pane 이 둘`, (h.match(/class="tab-pane/g) || []).length === 2,
       String((h.match(/class="tab-pane/g) || []).length));
    ok(`${f}: 전략 탭 pane 이 없다`, !/id="tab-strategy"/.test(h));
    ok(`${f}: 전략 탭 버튼이 없다`, !/data-tab="strategy"/.test(h));
    ok(`${f}: 전략 본문은 남아 있다`, /strategy-section/.test(h));
    ok(`${f}: 탭 바가 2단`, /grid-template-columns: repeat\(2, 1fr\)/.test(h));
    ok(`${f}: 옛 해시는 스윙 시그널로 보낸다`,
       /'#swing-strategy' \|\| h === '#strategy'\)\s+return 'market'/.test(h));
    ok(`${f}: TAB_HASH 에 strategy 가 없다`, !/strategy: '#swing-strategy'/.test(h));
    ok(`${f}: 없는 탭 이름을 기본 탭으로 돌린다`, /if \(!document\.getElementById\(`tab-\$\{tab\}`\)\)/.test(h));
    ok(`${f}: 상담 위젯이 하나`, !/chat-strategy/.test(h));
  });
  ['ez-nav.js', 'ez-footer.js'].forEach(f => {
    const j = fs.readFileSync(path.join(ROOT, f), 'utf8');
    /* 주석에는 남아 있어도 된다(왜 뺐는지를 적었다). 실제 링크 문자열만 본다. */
    const links = j.split('\n').filter(l => /['"][^'"]*atmr-dashboard\.html#swing-strategy/.test(l));
    ok(`${f}: 메뉴에 스윙 전략 링크가 없다`, links.length === 0, links.join(' | ').slice(0, 80));
  });
  ['index.html','en/index.html','ja/index.html','zh/index.html','es/index.html','pt/index.html']
    .forEach(f => {
      const h = fs.readFileSync(path.join(ROOT, f), 'utf8');
      ok(`${f}: 첫 화면 카드에도 스윙 전략이 없다`, !/#swing-strategy/.test(h));
    });

  /* ── 실제 데이터 ── */
  {
    const snap = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'market-signals.json'), 'utf8'));
    const r = evaluateMarket(snap, Date.parse(snap.generatedAt) + 3600000);
    ok('실제 데이터로 판정된다', r.ready === true, r.state);
    ok('실제 데이터: 세 지수 모두 재료가 있다', r.members.every(m => m.ready),
       r.members.filter(m => !m.ready).map(m => m.t).join(','));
    ok('실제 데이터: 축 문장이 비지 않는다', r.axes.every(a => a.text.length > 10));
    ok('실제 데이터: 매수 점수 평균이 나온다', r.alignment && Number.isFinite(r.alignment.avg),
       String(r.alignment && r.alignment.avg));
    console.log(`   시장 판정: ${r.state} · 매수 점수 평균 ${r.alignment.avg}`
      + ` · 판정 대상 ${r.counts.n}곳 · 갈림 ${r.lead ? '있음' : '없음'}`);
  }

  /* primitives 는 두 함수가 같은 것을 쓴다 */
  {
    ok('primitives 는 재료가 없으면 null', primitives({price:1}) === null);
    ok('primitives 는 고가<=저가를 거른다',
       primitives({...B, high20dExcl:95, low20dExcl:115}) === null);
    const p = primitives(B);
    ok('primitives 가 네 묶음을 낸다', p.above === true && p.trendUp === true && p.up === true
       && p.volDir === 1);
  }
}

console.log(`\n통과 ${pass} / 실패 ${fails.length}`);
if (fails.length) { console.log('\n실패'); fails.forEach(f => console.log('  · ' + f)); process.exit(1); }
console.log('전부 통과.');
