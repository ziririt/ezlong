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
 * 실행: node scripts/sync-insightimes.mjs [--out <경로>]
 */
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const argOut = process.argv.indexOf('--out');
const OUT = argOut > -1 ? process.argv[argOut + 1] : join(__dirname, '../data/insightimes.json');

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
const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? unescapeXml(m[1]) : '';
};

function parse(xml) {
  const all = [];
  const items = xml.match(/<item\b[\s\S]*?<\/item>/g) || [];
  for (const it of items) {
    const url = tag(it, 'link') || tag(it, 'guid');
    const title = tag(it, 'title');
    if (!url || !title) continue;
    if (!/^https:\/\/insightimes\.com\//.test(url)) continue;   // 남의 링크를 싣지 않는다
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
const articles = parse(xml);
if (!articles.length) keepOld('피드에서 글을 하나도 읽지 못했다.');

writeFileSync(OUT, JSON.stringify({
  updatedAt: new Date().toISOString(),
  source: FEED,
  site: SITE,
  articles,
}, null, 2) + '\n');
console.log(`[insightimes] ${articles.length}건 저장 -> ${OUT}`);
console.log(articles.map((a, i) => `  ${i + 1}. ${a.title.slice(0, 46)}`).join('\n'));
