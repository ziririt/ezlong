/**
 * 이슈(A Brief History) 브리핑 생성 — 제목만 따오지 않는다
 *
 * 무엇이 문제였나
 *   기계가 얹은 기록(own_archive)은 글 제목과 그날 지수 등락만 담고 있었다.
 *   코너 이름이 '그날 무슨 일이 있었나'인데 카드에는 헤드라인 한 줄뿐이라,
 *   손으로 쓴 소사(소제목 + 닷블릿 브리핑)와 나란히 놓으면 8월분만 빈껍데기로
 *   보였다. 유료 콘텐츠라 본문을 못 읽는다고 지레 단정한 게 원인이다 —
 *   실제로는 본문 2,000~4,000자가 공개로 열려 있다.
 *
 * 무엇을 하는가
 *   그날 글의 공개 본문을 읽어 소제목 + 닷블릿 브리핑으로 압축한다. 원문이
 *   이미 명사형 개조식이라 새로 쓰는 게 아니라 **고르고 줄이는** 일에 가깝다.
 *   숫자는 원문 그대로 옮기고, 원문에 없는 말은 한 글자도 만들지 않는다.
 *
 * 무엇을 하지 않는가
 *   손으로 쓴 소사(importance 2·3)는 건드리지 않는다. 본문을 못 읽었거나
 *   너무 짧으면 그 날은 건너뛴다 — 지어내느니 제목만 남기는 게 낫다.
 *
 * 멱등성
 *   결과를 data/.cache/brief-history-briefings.json 에 글 id 기준으로 캐시한다.
 *   merge-naver-archive.py 가 매번 own_archive 를 새로 만들어도, 이 스크립트가
 *   뒤에서 캐시로 다시 채운다. 하루에 새로 도는 건 한 건이다.
 *
 * 사용
 *   GEMINI_API_KEY=... node scripts/brief-history-briefings.mjs
 *   node scripts/brief-history-briefings.mjs --limit 20
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');
const EVENTS = join(DATA, 'brief-history.json');
const CHART = join(DATA, 'brief-history-chart.json');
const CACHE_DIR = join(DATA, '.cache');
const CACHE = join(CACHE_DIR, 'brief-history-briefings.json');

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const LIMIT = parseInt(argOf('--limit', '400'), 10);
/* 그날 글 중 몇 편까지 읽나. 오래 2편이었는데, 그날 지수를 설명한 시황이
   세 번째·네 번째 글인 날이 흔해서(2025-11-20 은 세 번째였다) 앞에서 자르면
   방향을 설명할 재료를 통째로 놓친다. 다섯 편까지 읽고, 그중 시황을 골라
   맨 앞에 놓는다(orderBodies). 하루 글이 다섯 편 넘는 날은 22일뿐이다. */
const MAX_ARTICLES_PER_DAY = 5;
const MIN_BODY = 400;             // 이보다 짧으면 브리핑을 만들지 않는다
const MAX_BODY = 6000;
/* 프롬프트를 고치면 캐시도 갈아야 한다 — 안 그러면 옛 요약이 영원히 산다.
   이 값을 올리면 다음 실행에서 전부 다시 만든다. */
const PROMPT_VERSION = 'v4-direction';

/* 분류 어휘는 새로 만들지 않는다 — 스코어카드 파이프라인이 쓰는 목록을 그대로
   쓴다(CLAUDE.md 20항 FACTOR_CATEGORIES). 어휘가 갈라지면 나중에 두 코너의
   집계를 나란히 놓을 수 없다. 목록 밖 값은 'other' 로 강등한다. */
const CATS = ['fed_policy', 'geopolitics', 'trade_tariff', 'macro_data',
  'earnings_bellwether', 'vix_risk_sentiment', 'oil_energy', 'dollar_fx',
  'rates_treasury', 'ai_tech_valuation', 'supply_chain', 'company_specific', 'other'];
const CAT_HINT = `fed_policy(연준·FOMC·파월) geopolitics(전쟁·제재·지정학) trade_tariff(관세·무역)
macro_data(CPI·고용·GDP·PMI) earnings_bellwether(벨웨더 실적) vix_risk_sentiment(VIX·리스크온오프)
oil_energy(유가·에너지) dollar_fx(달러·환율) rates_treasury(국채금리·커브)
ai_tech_valuation(AI·반도체 밸류에이션) supply_chain(공급망) company_specific(개별 기업) other`;

const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 16);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function loadJSON(p, d) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return d; } }

// ── 본문 가져오기 ────────────────────────────────────────────────────────
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, timeout: 30000 }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { buf += c; });
      res.on('end', () => resolve(buf));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

/* 네이버 스마트에디터는 문단을 se-text-paragraph 로 감싼다. 이 안의 글자만
   가져온다 — 사이드바·추천글·푸터가 섞이면 브리핑이 엉뚱해진다. */
function extractBody(html) {
  const out = [];
  const re = /<p[^>]*class="[^"]*se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    let t = m[1].replace(/<[^>]+>/g, '');
    t = t.replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e] || ' ');
    t = t.replace(/​|ㅤ/g, '').replace(/\s+/g, ' ').trim();
    if (!t || t.startsWith('http')) continue;
    out.push(t);
  }
  return out;
}

/* 그날이 어떤 날이었나 — 차트에서 직접 잰다.
   변곡점(바닥·꼭대기·급락·급등)에 사람들의 관심이 몰린다. 모델에게 '평범한
   하루'와 '바닥을 친 날'을 같은 무게로 요약하게 두면 정작 중요한 날이
   밋밋해진다. 앞으로의 수익률은 알려주지 않는다 — 알려주면 결과를 알고
   쓴 사후 서술이 섞인다. */
const WIN = 20;
function dayContext(chart, idxMap, date) {
  const i = idxMap[date];
  if (i == null || i < 1) return null;
  const q = chart.QQQ;
  const cur = q[i];
  const move = (cur / q[i - 1] - 1) * 100;
  const from = Math.max(0, i - WIN), to = Math.min(q.length - 1, i + WIN);
  const win = q.slice(from, to + 1);
  const lo = Math.min(...win), hi = Math.max(...win);
  const back5 = i >= 5 ? (cur / q[i - 5] - 1) * 100 : null;
  const lines = [`QQQ 당일 ${move >= 0 ? '+' : ''}${move.toFixed(2)}%` +
    (back5 == null ? '' : ` (직전 5거래일 누적 ${back5 >= 0 ? '+' : ''}${back5.toFixed(2)}%)`)];
  let kind = 'normal';
  if (cur === lo) { kind = 'bottom'; lines.push(`전후 ${win.length}거래일 중 **최저 종가 — 바닥**`); }
  else if (cur === hi) { kind = 'top'; lines.push(`전후 ${win.length}거래일 중 **최고 종가 — 꼭대기**`); }
  if (kind === 'normal' && move <= -2) kind = 'plunge';
  if (kind === 'normal' && move >= 2) kind = 'surge';
  if (kind === 'normal' && move >= 1.2 && back5 != null && back5 <= -3) kind = 'rebound';
  return { kind, lines, move };
}

function pickArticles(arts) {
  return (arts || []).slice(0, MAX_ARTICLES_PER_DAY);
}

/* 어느 글이 '그날 장 마감 정리'인가 — 제목으로 맞히려다 두 번 틀렸다.

   제목만 보면 시황인지 분석인지 갈리지 않는다("엔비디아 서프라이즈도 못 막은
   하루"는 시황이고 "애플은 AI 캐펙스를 피했지만…"은 분석인데, 둘 다 기업명이
   앞에 온다). 발행 순서로도 안 된다 — 시황 뒤에 후속 분석이 여러 편 붙는 날이
   있어서 '맨 끝'도 시황이 아니다.

   본문을 보면 확실하다. 시황에는 그날 4대 지수가 함께 등장한다. 그걸 세서
   가장 많이 나온 글을 앞으로 올린다. 앞에 둬야 하는 이유는 본문이 MAX_BODY 로
   잘리기 때문이다 — 뒤에 있으면 잘려 나가고, 그러면 모델은 그날 방향을 설명할
   재료를 못 본 채로 답한다(2025-11-20 이 그랬다: QQQ -2.37% 인 날이 긍정
   재료로만 채워졌다). */
const INDEX_WORDS = ['나스닥', 'S&P500', 'S&P 500', '다우', '러셀2000', '러셀 2000'];
function wrapScore(text) {
  return INDEX_WORDS.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);
}
function orderBodies(docs) {
  if (!docs.length) return { text: '', hasWrap: false };
  const scored = docs.map((d, i) => ({ ...d, i, s: wrapScore(d.body) }));
  const best = scored.reduce((a, b) => (b.s > a.s ? b : a), scored[0]);
  const isWrap = best.s >= 2;
  const rest = scored.filter((d) => d !== best || !isWrap);
  const head = isWrap ? [`[그날 장 마감 정리]\n${best.body}`] : [];
  const text = head.concat(rest.map((d) => `[같은 날 글] ${d.t || ''}\n${d.body}`)).join('\n\n');
  return { text, hasWrap: isWrap };
}

/* 방향과 톤이 어긋났는지 — 내린 날인데 재료에 부정이 하나도 없거나, 오른 날인데
   긍정이 하나도 없는 경우. 실제로 254장 중 3장이 이 상태였다(2025-11-20 은
   QQQ -2.37% 인 날이 긍정 재료 세 묶음이었다). 원인은 모델이 아니라 입력이었고
   위 orderBodies 로 고쳤지만, 화면에 틀린 카드가 걸리는 건 여기서 한 번 더 막는다. */
const DIR_THRESHOLD = 1.0;
function directionOK(groups, move, hasWrap) {
  if (move == null || Math.abs(move) < DIR_THRESHOLD) return true;
  /* 그날 시황이 본문에 없으면 검사하지 않는다. 그런 날의 카드는 기업 분석
     한 편이 전부라, 지수가 왜 움직였는지 말할 재료 자체가 없다. 없는 걸
     내놓으라고 다그치면 지어내게 된다 — 그건 더 나쁘다. 등락 수치는 카드
     상단에 이미 따로 붙어 있으므로 독자가 오해할 자리도 아니다. */
  if (!hasWrap) return true;
  const tones = new Set(groups.map((g) => String(g.tone || '').trim()));
  /* '전부 pos' 만 잡으면 pos·mix·pos 가 빠져나간다 — 실제로 그렇게 새어나갔다.
     크게 내린 날에 부정 재료가 **하나도 없으면** 그 카드는 그날을 설명하지
     못한 것이다(반대도 같다). 설명할 재료가 정말 없으면 다시 물었을 때
     mix 로만 채워져 돌아오고, 그건 정직한 답이라 통과시킨다. */
  if (move <= -DIR_THRESHOLD && !tones.has('neg')) return false;
  if (move >= DIR_THRESHOLD && !tones.has('pos')) return false;
  return true;
}

const KIND_ORDER = {
  bottom: '이 날은 **바닥**이다. 투매를 멈추게 한 것이 무엇인지, 반등의 방아쇠가 된 재료를 첫 묶음에 놓아라.',
  top:    '이 날은 **꼭대기**다. 여기까지 밀어올린 재료와, 위를 막은 재료를 나눠서 놓아라.',
  plunge: '**급락일**이다. 무엇이 팔게 만들었는지 — 부정 재료를 첫 묶음에 놓아라.',
  surge:  '**급등일**이다. 무엇이 사게 만들었는지 — 긍정 재료를 첫 묶음에 놓아라.',
  rebound:'**반등일**이다. 직전 하락을 멈춰 세운 재료를 첫 묶음에 놓아라.',
  normal: '평범한 하루다. 그래도 가격을 움직인 재료만 고른다.',
};

/* 글자가 깨진 채 통과하지 않게 — U+FFFD 는 응답 청크 경계에서 한 글자가
   잘려 나갔다는 신호다. 에러가 안 나므로 사람이 화면에서 보기 전엔 모른다.
   실제로 37일치 브리핑에 이 문자가 섞인 채 배포됐다. */
function looksClean(obj) {
  return !JSON.stringify(obj).includes('�');
}

// ── Gemini ──────────────────────────────────────────────────────────────
function httpPost(host, path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({ host, path, method: 'POST', timeout: 120000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
      (res) => { let b = ''; res.setEncoding('utf8'); res.on('data', (c) => { b += c; });
        res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(new Error('JSON 파싱 실패')); } }); });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.write(payload); req.end();
  });
}

async function gemini(prompt, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await httpPost('generativelanguage.googleapis.com',
        `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
        { contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096,
            responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } } });
      const parts = r?.candidates?.[0]?.content?.parts || [];
      const text = parts.filter((p) => !p.thought).map((p) => p.text || '').join('');
      if (!text) throw new Error(r?.error?.message || r?.candidates?.[0]?.finishReason || '빈 응답');
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('JSON 미포함');
      return JSON.parse(m[0]);
    } catch (e) {
      if (i === tries) { console.error('  Gemini 실패:', e.message); return null; }
      await sleep(i * 4000);
    }
  }
  return null;
}

/* 원문이 이미 명사형 개조식이라 새로 쓰는 게 아니라 고르고 줄이는 일이다.
   예시를 하나 붙여 형식을 못박는다 — 설명만으로는 문장이 길어지고 서술어가 붙는다. */
const PROMPT = (dateStr, body, ctx) => `아래는 한국 필자가 쓴 미국 증시 기록이다. 카드용 브리핑으로 압축하라.
읽는 사람은 원문을 열지 않는다. 이 카드만 보고 "그날 왜 그렇게 움직였나"를 알아야 한다.

[무엇을 담나 — 이게 전부다]
- **그날 주가를 움직인 재료만** 담는다. 긍정 재료(올린 것)와 부정 재료(내린 것).
- 각 묶음에 tone 을 붙인다: "pos"(올린 재료) / "neg"(내린 재료) / "mix"(양쪽이 상쇄).
- 각 묶음에 cat 을 붙인다. **아래 목록의 값만** 쓴다(새로 만들지 않는다):
  ${CAT_HINT}
- 필자의 전략·대응·관전 포인트·다음 일정·개인 판단은 **넣지 않는다**. 재료가 아니다.
- 앞으로의 기대·전망·수혜 예상도 재료가 아니다("~ 가속화 전망", "~ 신뢰 상승 효과 예상").
  그날 가격에 반영된 사실만 쓴다.
- 차트 지표 판독(RSI·MACD·스토캐스틱·볼린저·이동평균·옵션 미결제·풋콜 비율)도 재료가 아니다.
  그건 가격의 결과이지 원인이 아니다.
- 본문에 재료가 하나도 없으면(지표 판독·기업 소개·개인 회고뿐이면) 빈 배열을 돌려라:
  {"summaryGroups":[]}. 억지로 채우지 않는다.
- 지수 등락률만 나열하는 묶음도 넣지 않는다 — 카드에 이미 숫자가 따로 붙는다.
  등락률은 재료를 설명할 때 근거로만 쓴다.

[방향이 맞아야 한다 — 가장 중요]
- 원문에 **[그날 장 마감 정리]** 로 시작하는 대목이 있으면 그게 그날을 설명하는 글이다.
  거기서 재료를 먼저 고른다. [같은 날 글] 은 배경·기업 분석이라 그날 방향과 무관할 수 있다.
- 아래 [이 날의 성격]에 그날 지수가 오른 날인지 내린 날인지 적혀 있다.
  **내린 날의 재료를 전부 pos 로, 오른 날의 재료를 전부 neg 로 채우지 마라.**
- 본문이 강세 일색인데 그날 지수가 내렸다면, 그건 그 재료가 지수를 못 움직였다는 뜻이다.
  그럴 때는 지어내지 말고 **tone 을 "mix" 로 두고** 소제목을 '그날 나온 재료' 성격으로 쓴다.
  본문 안에 하락을 설명하는 대목(금리·매크로·차익실현 등)이 있으면 그걸 첫 묶음으로 올린다.
- 반대도 같다. 오른 날에 본문이 우려 일색이면 mix 로 두고 사실만 남긴다.

[이 날의 성격]
${ctx ? ctx.lines.map((l) => '- ' + l).join('\n') : '- 차트 데이터 없음'}
${ctx ? KIND_ORDER[ctx.kind] : ''}

[형식]
- 묶음 2~3개. 각 묶음 아래 닷블릿 2~3개.
- 모든 문장은 **명사형으로 끝낸다**. '~했다/~이다/~습니다/~하세요' 금지.
- 숫자·티커·지표명은 원문 그대로. 반올림하거나 바꾸지 않는다.
- 원문에 없는 사실·해석·전망을 만들지 않는다. 고르고 줄이기만 한다.
- 소제목은 원인을 가리킨다. '시장 요약'·'주요 지수' 같은 빈 제목 금지.
- 면책 문구, 투자 권유, 인사말 금지.

[예시 — 형식만 참고]
{"summaryGroups":[
 {"heading":"유가·장기금리가 위를 막음","tone":"neg","cat":"oil_energy","points":["브렌트유 83달러대 재진입, 호르무즈 통행 합의 기대가 배경","10년물 4.67%·30년물 5.21%로 박스 상단 재확장 시도"]},
 {"heading":"AI 설비투자 고점 논쟁 재점화","tone":"neg","cat":"ai_tech_valuation","points":["아폴로 리서치, AI 설비투자의 GDP 비중이 과거 통신·주택 버블 대비 크고 상승 속도도 빠름","메모리·스토리지·소프트웨어 밸류에이션까지 파급"]},
 {"heading":"고용 지표는 견조","tone":"mix","cat":"macro_data","points":["주간 실업수당 청구 199K로 예상 203K 하회, 챌린저 해고 2년 만에 최저","노동 약세 공포가 아니라 강세에 따른 고금리 장기화 우려로 소화"]}]}

[출력]
JSON 하나만. {"summaryGroups":[{"heading":"...","tone":"pos|neg|mix","cat":"위 목록 중 하나","points":["...","..."]}]}

[대상 날짜] ${dateStr}
[원문]
${body}`;

// ── 본체 ────────────────────────────────────────────────────────────────
async function main() {
  const events = loadJSON(EVENTS, null);
  if (!Array.isArray(events)) { console.error('::error::brief-history.json 을 읽지 못했다'); return 1; }
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  const cache = loadJSON(CACHE, {});
  const chart = loadJSON(CHART, null);
  const idxMap = {};
  if (chart) chart.dates.forEach((d, i) => { idxMap[d] = i; });

  // 기계가 얹은 기록만 대상. 손으로 쓴 소사는 건드리지 않는다.
  /* 최신 날짜부터 채운다. 한 번에 LIMIT 일까지만 만들므로, 오래된 쪽부터
     채우면 밀린 만큼 **오늘 아침 글이 맨 뒤로 밀린다** — 실제로 8월 글이
     제목만 걸린 채 며칠을 기다렸다. 사람들이 먼저 보는 건 최근이다. */
  const targets = events
    .filter((e) => e.source === 'own_archive' && e.articles && e.articles.length)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  console.log(`대상 ${targets.length}일 (최신순)`);

  let made = 0, reused = 0, skipped = 0, fetched = 0;

  for (const e of targets) {
    const arts = pickArticles(e.articles);
    const key = sha(PROMPT_VERSION + '|' + arts.map((a) => a.u).join('|'));
    let brief = cache[key];
    /* 캐시를 읽을 때도 검사한다 — 한 번 깨진 채 담긴 것이 영원히 살면 안 된다.
       U+FFFD 는 응답 청크 경계에서 한 글자가 잘려 나갔다는 뜻이다. */
    if (brief && !looksClean(brief)) { delete cache[key]; brief = null; }
    // 재료 없음으로 확정된 날 — 다시 묻지 않고 제목만 둔다
    if (brief && Array.isArray(brief.summaryGroups) && brief.summaryGroups.length === 0) {
      reused++;
      continue;
    }

    if (!brief) {
      if (made >= LIMIT) { skipped++; continue; }
      if (!GEMINI_KEY) { skipped++; continue; }
      const docs = [];
      for (const a of arts) {
        try {
          const html = await httpGet(a.u);
          fetched++;
          const paras = extractBody(html);
          if (paras.length) docs.push({ t: a.t, body: paras.join('\n') });
          await sleep(350);   // 남의 서버다 — 몰아치지 않는다
        } catch (err) {
          console.warn(`  본문 실패 ${a.u}: ${err.message}`);
        }
      }
      const ordered = orderBodies(docs);
      const body = ordered.text.slice(0, MAX_BODY);
      if (body.length < MIN_BODY) {
        console.warn(`  ${e.date} 본문이 짧다(${body.length}자) — 제목만 남긴다`);
        skipped++;
        continue;
      }
      const ctx = chart ? dayContext(chart, idxMap, e.date) : null;
      let out = await gemini(PROMPT(e.date, body, ctx));
      let groups = out && Array.isArray(out.summaryGroups) ? out.summaryGroups : null;
      /* 방향이 어긋나면 한 번만 다시 묻는다. 지시를 더 얹는 게 아니라, 어긋난
         사실 자체를 알려준다 — 모델은 자기 출력을 못 보고 답했기 때문이다. */
      if (groups && ctx && !directionOK(groups, ctx.move, ordered.hasWrap)) {
        const dir = ctx.move <= 0 ? '내린' : '오른';
        const want = ctx.move <= 0 ? 'pos' : 'neg';
        console.warn(`  ${e.date} 방향 불일치(QQQ ${ctx.move.toFixed(2)}%, 전부 ${want}) — 다시 요청`);
        const retry = await gemini(PROMPT(e.date, body, ctx) +
          `\n\n[다시 쓴다]\n방금 만든 답이 ${dir} 날의 재료를 전부 "${want}" 로 채웠다. ` +
          '본문에서 그날 지수 방향을 설명하는 대목을 먼저 찾아 첫 묶음으로 올리고, ' +
          '없으면 tone 을 "mix" 로 두고 그날 나온 재료로만 서술하라. 지어내지 마라.');
        const rg = retry && Array.isArray(retry.summaryGroups) ? retry.summaryGroups : null;
        if (rg && rg.length) { out = retry; groups = rg; }
      }
      /* 빈 배열은 실패가 아니라 답이다 — 본문에 재료가 없다는 뜻(지표 판독·
         기업 소개뿐인 날). 그 사실을 캐시에 남겨야 매 실행마다 같은 글을 다시
         묻지 않는다. 카드는 제목만으로 남는다. */
      if (groups && groups.length === 0) {
        cache[key] = { summaryGroups: [] };
        writeFileSync(CACHE, JSON.stringify(cache), 'utf8');
        made++;
        console.log(`  ${e.date} 그날 재료 없음 — 제목만 남긴다`);
        continue;
      }
      if (!groups || !groups.length || !groups.every((g) => g.heading && Array.isArray(g.points) && g.points.length)) {
        console.warn(`  ${e.date} 브리핑 형식 불량 — 건너뜀`);
        skipped++;
        continue;
      }
      if (!looksClean({ summaryGroups: groups })) {
        console.warn(`  ${e.date} 응답에 깨진 글자 — 건너뜀`);
        skipped++;
        continue;
      }
      const TONES = { pos: 'pos', neg: 'neg', mix: 'mix' };
      brief = { summaryGroups: groups.slice(0, 3).map((g) => ({
        heading: String(g.heading).trim(),
        tone: TONES[String(g.tone || '').trim()] || 'mix',
        // 목록 밖 값은 'other' 로 강등 — 어휘가 늘어나면 집계가 흩어진다
        cat: CATS.includes(String(g.cat || '').trim()) ? String(g.cat).trim() : 'other',
        points: g.points.slice(0, 4).map((p) => String(p).trim()).filter(Boolean),
      })) };
      cache[key] = brief;
      writeFileSync(CACHE, JSON.stringify(cache), 'utf8');
      made++;
      console.log(`  ${e.date} 브리핑 생성 (${brief.summaryGroups.length}묶음, ${ctx ? ctx.kind : 'no-chart'})`);
    } else {
      reused++;
    }

    /* 카드 모양을 손으로 쓴 소사와 맞춘다 — 제목은 그날 첫 글의 헤드라인,
       본문은 브리핑, 나머지 글은 '이 날의 다른 글'로 내린다. */
    const primary = e.articles[0];
    e.title = primary.t;
    e.link = primary.u;
    e.summaryGroups = brief.summaryGroups;
    // 카드 필터가 쓰는 요약 — 그날 등장한 분류를 중복 없이 모아 둔다
    const cats = [...new Set(brief.summaryGroups.map((g) => g.cat).filter((c) => c && c !== 'other'))];
    if (cats.length) e.cats = cats; else delete e.cats;
    const rest = e.articles.slice(1);
    if (rest.length) e.moreArticles = (e.moreArticles || []).concat(rest);
    delete e.articles;
  }

  console.log(`생성 ${made} · 캐시 재사용 ${reused} · 건너뜀 ${skipped} · 본문 요청 ${fetched}`);
  if (made || reused) {
    writeFileSync(EVENTS, JSON.stringify(events, null, 1), 'utf8');
  }
  return 0;
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(1); });
