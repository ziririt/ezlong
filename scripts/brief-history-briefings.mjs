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
const CACHE_DIR = join(DATA, '.cache');
const CACHE = join(CACHE_DIR, 'brief-history-briefings.json');

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const LIMIT = parseInt(argOf('--limit', '400'), 10);
const MAX_ARTICLES_PER_DAY = 2;   // 토큰·요청 상한. 그날 첫 글(아침 시황)이 본론이다
const MIN_BODY = 400;             // 이보다 짧으면 브리핑을 만들지 않는다
const MAX_BODY = 6000;

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

// ── Gemini ──────────────────────────────────────────────────────────────
function httpPost(host, path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({ host, path, method: 'POST', timeout: 120000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
      (res) => { let b = ''; res.on('data', (c) => { b += c; });
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
const PROMPT = (dateStr, body) => `아래는 한국 필자가 쓴 미국 증시 마감 기록이다. 이것을 카드용 브리핑으로 압축하라.

[형식]
- 소제목 2~3개. 각 소제목 아래 닷블릿 2~3개.
- 모든 문장은 **명사형으로 끝낸다**. '~했다/~이다/~습니다/~하세요' 금지.
- 숫자·티커·지표명은 원문 그대로. 반올림하거나 바꾸지 않는다.
- 원문에 없는 사실·해석·전망을 만들지 않는다. 고르고 줄이기만 한다.
- 면책 문구, 투자 권유, 인사말을 붙이지 않는다.
- 소제목은 그날의 원인을 가리킨다. '시장 요약' 같은 빈 제목 금지.

[예시 — 형식만 참고]
{"summaryGroups":[
 {"heading":"유가·장기금리가 위를 막은 하루","points":["브렌트유 83달러대 재진입, 호르무즈 통행 합의 기대가 배경","10년물 4.67%·30년물 5.21%로 박스 상단 재확장 시도"]},
 {"heading":"AI 설비투자 논쟁 재점화","points":["아폴로 리서치, AI 설비투자의 GDP 비중이 과거 통신·주택 버블 대비 크고 상승 속도도 빠름","메모리·스토리지·소프트웨어 밸류에이션까지 파급"]},
 {"heading":"고용은 견조, 그래서 금리가 눌림","points":["주간 실업수당 청구 199K로 예상 203K 하회, 챌린저 해고 2년 만에 최저","노동 약세 공포가 아니라 강세에 따른 고금리 장기화 우려로 소화"]}]}

[출력]
JSON 하나만. {"summaryGroups":[{"heading":"...","points":["...","..."]}]}

[대상 날짜] ${dateStr}
[원문]
${body}`;

// ── 본체 ────────────────────────────────────────────────────────────────
async function main() {
  const events = loadJSON(EVENTS, null);
  if (!Array.isArray(events)) { console.error('::error::brief-history.json 을 읽지 못했다'); return 1; }
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  const cache = loadJSON(CACHE, {});

  // 기계가 얹은 기록만 대상. 손으로 쓴 소사는 건드리지 않는다.
  const targets = events.filter((e) => e.source === 'own_archive' && e.articles && e.articles.length);
  console.log(`대상 ${targets.length}일`);

  let made = 0, reused = 0, skipped = 0, fetched = 0;

  for (const e of targets) {
    const arts = e.articles.slice(0, MAX_ARTICLES_PER_DAY);
    const key = sha(arts.map((a) => a.u).join('|'));
    let brief = cache[key];

    if (!brief) {
      if (made >= LIMIT) { skipped++; continue; }
      if (!GEMINI_KEY) { skipped++; continue; }
      const bodies = [];
      for (const a of arts) {
        try {
          const html = await httpGet(a.u);
          fetched++;
          const paras = extractBody(html);
          if (paras.length) bodies.push(paras.join('\n'));
          await sleep(600);   // 남의 서버다 — 몰아치지 않는다
        } catch (err) {
          console.warn(`  본문 실패 ${a.u}: ${err.message}`);
        }
      }
      const body = bodies.join('\n\n').slice(0, MAX_BODY);
      if (body.length < MIN_BODY) {
        console.warn(`  ${e.date} 본문이 짧다(${body.length}자) — 제목만 남긴다`);
        skipped++;
        continue;
      }
      const out = await gemini(PROMPT(e.date, body));
      const groups = out && Array.isArray(out.summaryGroups) ? out.summaryGroups : null;
      if (!groups || !groups.length || !groups.every((g) => g.heading && Array.isArray(g.points) && g.points.length)) {
        console.warn(`  ${e.date} 브리핑 형식 불량 — 건너뜀`);
        skipped++;
        continue;
      }
      brief = { summaryGroups: groups.slice(0, 3).map((g) => ({
        heading: String(g.heading).trim(),
        points: g.points.slice(0, 4).map((p) => String(p).trim()).filter(Boolean),
      })) };
      cache[key] = brief;
      writeFileSync(CACHE, JSON.stringify(cache), 'utf8');
      made++;
      console.log(`  ${e.date} 브리핑 생성 (${brief.summaryGroups.length}묶음)`);
    } else {
      reused++;
    }

    /* 카드 모양을 손으로 쓴 소사와 맞춘다 — 제목은 그날 첫 글의 헤드라인,
       본문은 브리핑, 나머지 글은 '이 날의 다른 글'로 내린다. */
    const primary = e.articles[0];
    e.title = primary.t;
    e.link = primary.u;
    e.summaryGroups = brief.summaryGroups;
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
