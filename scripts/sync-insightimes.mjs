/**
 * Insight Times 최신 글 수집.
 *   ① 지면(https://insightimes.com/) 을 먼저 읽는다 - **편집이 배치한 순서**와
 *      카드 썸네일·분류·날짜가 거기 있다. 목록의 순서 자체가 정보다.
 *   ② 지면을 못 읽으면 RSS(https://insightimes.com/rss.xml) 로 떨어진다.
 *      그때는 썸네일이 없다 - RSS 에 이미지 태그가 하나도 없기 때문이다(실측).
 *   결과는 data/insightimes.json. 메인(index.html)의 코너가 이 파일을 읽는다.
 *
 * 어디서 왔는지를 `via` 에 적는다. 지면 구조가 바뀌어 RSS 로 떨어져도 화면은
 * 계속 돌지만, 썸네일이 사라진 이유를 아무도 모르면 안 된다(13절).
 *
 * 실패하면 기존 파일을 그대로 둔다(13절: 실패를 정상으로 읽는 초기값 금지).
 * 빈 목록을 써 넣으면 화면이 "글이 없습니다"로 바뀐다 - 그건 거짓말이다.
 *
 * 내린 글은 scripts/insightimes-exclude.json 으로 거른다. 링크가 죽었는지로는
 * 못 거른다 - 2026-09-13 실측: 지면에서 내린 글이 HEAD 200 이었고 RSS 에도
 * 그대로 남아 있었다. 거른 만큼 뒤에서 채워 목록은 늘 열 건을 유지한다.
 *
 * 실행: node scripts/sync-insightimes.mjs [--out <경로>]
 */
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const argOut = process.argv.indexOf('--out');
const OUT = argOut > -1 ? process.argv[argOut + 1] : join(__dirname, '../data/insightimes.json');

const EXCLUDE_FILE = join(__dirname, 'insightimes-exclude.json');
const FEED = 'https://insightimes.com/rss.xml';
const SITE = 'https://insightimes.com/';
const ORIGIN = 'https://insightimes.com';
const MAX = 10;
/* 지면에서 이만큼도 못 읽으면 구조가 바뀐 것으로 보고 RSS 로 떨어진다.
   서너 건만 읽히는 쪽이 0건보다 위험하다 - 목록이 조용히 짧아진다. */
const PAGE_MIN = 8;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
              + '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/rss+xml,application/xml;q=0.9,*/*;q=0.8',
  'Cache-Control': 'no-cache',
};

/* XML 엔티티. RSS 제목에 &amp; &#39; 같은 것이 그대로 들어온다. */
function unescapeXml(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')          // 마지막에 - 먼저 풀면 &amp;lt; 가 꼬인다
    .replace(/\s+/g, ' ').trim();
}
/* 주소 비교는 마지막 슬러그로 한다. 퍼센트 인코딩이 섞여 문자열 그대로는 못 맞춘다. */
function slugOf(x) {
  const raw = String(x || '').trim();
  if (!raw) return '';
  let p = raw;
  try { p = new URL(raw).pathname; } catch { /* 주소가 아니면 통째로 슬러그로 본다 */ }
  p = p.replace(/\/+$/, '');
  const last = p.slice(p.lastIndexOf('/') + 1);
  let dec = last;
  try { dec = decodeURIComponent(last); } catch { /* 깨진 인코딩이면 원문 그대로 */ }
  return dec.toLowerCase();
}

/* 제외 목록. 파일이 없으면 아무것도 거르지 않는다 - 그게 정상 상태다. */
function loadExcluded() {
  if (!existsSync(EXCLUDE_FILE)) return new Set();
  try {
    const raw = JSON.parse(readFileSync(EXCLUDE_FILE, 'utf8'));
    const list = Array.isArray(raw) ? raw : (raw.excluded || []);
    return new Set(list.map(e => slugOf(typeof e === 'string' ? e : e.url)).filter(Boolean));
  } catch (e) {
    /* 목록을 못 읽었으면 조용히 넘어가지 않는다. 거를 것을 못 거른 채 도는 것이다. */
    console.error(`[insightimes] 제외 목록을 읽지 못했다: ${e.message}. 이번 회차는 거르지 않는다.`);
    return new Set();
  }
}

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? unescapeXml(m[1]) : '';
};

/* ── 지면 파서 ────────────────────────────────────────────────────────
   지면은 서버가 완성해 내려준다(실측: __NEXT_DATA__ 도 self.__next_f 도 없다).
   카드 하나가 <a class="card ..."> … </a> 한 덩이이고, 그 안에
   card-media > img(srcset 400/800/1600) · card-title · card-excerpt ·
   card-meta > time[datetime] 이 들어 있다. data-cat 은 분류, data-type 은 갈래.
   '<!--IT:TODAY-->' 는 오늘의 지면이 시작하는 자리다 - 헤더의 링크를 집지 않게
   거기서부터 읽는다. 마커가 없으면 문서 전체에서 읽되 카드 클래스로만 고른다. */
const stripTags = x => unescapeXml(String(x).replace(/<[^>]*>/g, ' '));
const pick = (b, re) => { const m = b.match(re); return m ? m[1] : ''; };
const absolutize = u => (!u ? '' : /^https?:\/\//i.test(u) ? u : ORIGIN + (u.startsWith('/') ? u : '/' + u));

/* srcset 에서 폭이 가장 작은 것을 고른다. 목록 썸네일에 1600w 를 내려받을 이유가 없다. */
function smallestFromSrcset(srcset, fallback) {
  const cands = [...String(srcset || '').matchAll(/([^\s,]+)\s+(\d+)w/g)]
    .map(m => ({ url: m[1], w: Number(m[2]) }))
    .filter(c => Number.isFinite(c.w) && c.w > 0)
    .sort((a, b) => a.w - b.w);
  return cands.length ? cands[0].url : fallback;
}

function parsePage(html, excluded = new Set()) {
  const marker = html.indexOf('<!--IT:TODAY-->');
  const body = marker >= 0 ? html.slice(marker) : html;
  const out = [];
  const byUrl = new Set(), byTitle = new Set();
  let dropped = 0;

  for (const chunk of body.split(/<a\s+class="card[\s"]/).slice(1)) {
    const end = chunk.indexOf('</a>');          // 카드 안에 또 다른 <a> 는 없다
    const b = end >= 0 ? chunk.slice(0, end) : chunk;
    const href = pick(b, /href="(\/articles\/[^"]+)"/);
    if (!href) continue;
    const url = ORIGIN + href;
    if (excluded.has(slugOf(url))) { dropped++; continue; }
    const title = stripTags(pick(b, /class="card-title"[^>]*>([\s\S]*?)<\/(?:h[1-6]|div|p|span)>/));
    if (!title) continue;
    const key = title.replace(/\s+/g, '').toLowerCase();
    if (byUrl.has(url) || byTitle.has(key)) continue;
    byUrl.add(url); byTitle.add(key);

    const imgTag = pick(b, /class="card-media"[\s\S]*?(<img[^>]*>)/) || pick(b, /(<img[^>]*>)/);
    const thumb = absolutize(smallestFromSrcset(pick(imgTag, /srcset="([^"]*)"/), pick(imgTag, /src="([^"]*)"/)));
    out.push({
      title,
      url,
      publishedAt: pick(b, /<time[^>]*datetime="([^"]+)"/),
      summary: stripTags(pick(b, /class="card-excerpt"[^>]*>([\s\S]*?)<\/p>/)).slice(0, 200),
      thumb,
      thumbAlt: unescapeXml(pick(imgTag, /alt="([^"]*)"/)),
      category: unescapeXml(pick(b, /data-cat="([^"]*)"/)),
      kind: unescapeXml(pick(b, /data-type="([^"]*)"/)),
    });
    if (out.length >= MAX) break;
  }
  /* 지면 순서를 다시 정렬하지 않는다. 그 순서가 곧 편집의 판단이다. */
  if (dropped) console.error(`[insightimes] 지면에서 제외 목록으로 ${dropped}건을 뺐다.`);
  return out;
}

/* ── RSS 파서 (대체 경로) ───────────────────────────────────────────── */
function parse(xml, excluded = new Set()) {
  const all = [];
  let dropped = 0;
  const items = xml.match(/<item\b[\s\S]*?<\/item>/g) || [];
  for (const it of items) {
    const url = tag(it, 'link') || tag(it, 'guid');
    const title = tag(it, 'title');
    if (!url || !title) continue;
    if (!/^https:\/\/insightimes\.com\//.test(url)) continue;   // 남의 링크를 싣지 않는다
    if (excluded.has(slugOf(url))) { dropped++; continue; }      // 지면에서 내린 글
    const when = Date.parse(tag(it, 'pubDate'));
    all.push({
      title,
      url,
      publishedAt: Number.isFinite(when) ? new Date(when).toISOString() : '',
      summary: tag(it, 'description').slice(0, 200),
      author: tag(it, 'dc:creator'),
    });
  }
  /* 피드가 시간순이 아닐 수 있다. 시각을 아는 것만 정렬하고 모르는 것은 뒤로. */
  all.sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));

  /* 중복은 주소만으로 걸러지지 않는다. 2026-09-13 실측: 같은 글이 슬러그만
     다른 두 주소로 피드에 올라와 목록에 제목이 두 번 찍혔다.
     제목으로도 거른다 - 정렬 뒤에 거르므로 더 최신 쪽이 남는다. */
  const byUrl = new Set(), byTitle = new Set(), out = [];
  for (const a of all) {
    const key = a.title.replace(/\s+/g, '').toLowerCase();
    if (byUrl.has(a.url) || byTitle.has(key)) continue;
    byUrl.add(a.url); byTitle.add(key);
    out.push(a);
    if (out.length >= MAX) break;
  }
  if (dropped) console.error(`[insightimes] 제외 목록으로 ${dropped}건을 뺐다.`);
  return out;
}

function keepOld(why) {
  console.error(`[insightimes] ${why}`);
  if (existsSync(OUT)) {
    const n = (JSON.parse(readFileSync(OUT, 'utf8')).articles || []).length;
    console.error(`[insightimes] 기존 파일을 그대로 둔다 (${n}건).`);
    process.exit(0);          // 워크플로를 죽이지 않는다. 화면은 옛 목록을 계속 보여준다
  }
  console.error('[insightimes] 기존 파일도 없다. 빈 파일을 만들지 않는다.');
  process.exit(1);
}

/* ── 흐름: 지면 먼저, 안 되면 RSS ───────────────────────────────────── */
async function get(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const excluded = loadExcluded();
let articles = [];
let via = 'page';

try {
  articles = parsePage(await get(SITE), excluded);
  if (articles.length < PAGE_MIN) {
    console.error(`[insightimes] 지면에서 ${articles.length}건만 읽혔다(기준 ${PAGE_MIN}). 구조가 바뀐 것으로 본다.`);
    articles = [];
  }
} catch (e) {
  console.error(`[insightimes] 지면을 읽지 못했다: ${e.message}`);
}

if (!articles.length) {
  via = 'rss';
  console.error('[insightimes] RSS 로 대체한다. 이 경로에는 썸네일이 없다.');
  try {
    articles = parse(await get(FEED), excluded);
  } catch (e) {
    keepOld(`RSS 도 실패했다: ${e.message}`);
  }
}
if (!articles.length) keepOld('지면·RSS 어느 쪽에서도 글을 읽지 못했다.');

writeFileSync(OUT, JSON.stringify({
  updatedAt: new Date().toISOString(),
  via,
  source: via === 'page' ? SITE : FEED,
  site: SITE,
  articles,
}, null, 2) + '\n');
const withThumb = articles.filter(a => a.thumb).length;
console.log(`[insightimes] ${articles.length}건 저장(${via === 'page' ? '지면 순서' : 'RSS 최신순'}`
  + `, 썸네일 ${withThumb}건) -> ${OUT}`);
console.log(articles.map((a, i) => `  ${i + 1}. ${a.title.slice(0, 42)}`).join('\n'));
