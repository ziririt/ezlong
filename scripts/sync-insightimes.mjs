/**
 * Insight Times 최신 글 수집.
 *   https://insightimes.com/rss.xml  ->  data/insightimes.json
 *
 * 메인(index.html)의 '인사이트 타임즈' 코너가 이 파일을 읽는다.
 * 네이버 프리미엄 수집(sync-naver.mjs)과 같은 자리·같은 서식이다 -
 * 그쪽은 HTML 을 긁지만 이쪽은 RSS 가 있어 훨씬 덜 깨진다.
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
const MAX = 10;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
              + '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
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

const res = await fetch(FEED, { headers: HEADERS }).catch(e => { keepOld(`가져오기 실패: ${e.message}`); });
if (!res || !res.ok) keepOld(`HTTP ${res ? res.status : '없음'}`);
const xml = await res.text();
const articles = parse(xml, loadExcluded());
if (!articles.length) keepOld('피드에서 글을 하나도 읽지 못했다.');

writeFileSync(OUT, JSON.stringify({
  updatedAt: new Date().toISOString(),
  source: FEED,
  site: SITE,
  articles,
}, null, 2) + '\n');
console.log(`[insightimes] ${articles.length}건 저장 -> ${OUT}`);
console.log(articles.map((a, i) => `  ${i + 1}. ${a.title.slice(0, 46)}`).join('\n'));
