/**
 * 인사이트 타임스 전체 글 목록 - '차트: 그날 무슨 일이 있었나'의 근거 글 원천.
 *
 * 2026-10-16 신설. 이 코너의 근거 글은 그동안 네이버 프리미엄 채널이었다.
 * 같은 필자가 운영하는 인사이트 타임스(insightimes.com)에 2026-09-01 부터 글이
 * 쌓였고, 2026-09-14 부터는 매일 장 마감 정리(분류 '시황')가 올라온다.
 * 그날 카드의 근거를 인사이트 타임스로 옮기기 위해 전체 목록을 여기 모은다.
 *
 * 무엇을 읽나
 *   ① https://insightimes.com/search.json - 사이트 검색이 쓰는 전체 목록(한국어판).
 *      제목·분류·편집 날짜는 있지만 발행 '시각'이 없다.
 *   ② 새 글만 기사 페이지를 한 번 열어 JSON-LD datePublished(UTC)를 읽는다.
 *      글을 어느 장에 매달지는 발행 시각을 뉴욕 시간으로 옮겨 정한다
 *      (merge-naver-archive.py 의 market_date 와 같은 규칙). 편집 날짜만 쓰면
 *      아침 시황이 '오늘' 장에 붙는다 - 실제로는 전날 장 이야기다.
 *   ③ 매일 아침 편지의 음성 브리핑 페이지(/listen/YYYY-MM-DD). 그 페이지가
 *      어떤 글을 묶었는지 적어 두면, 그 편지가 다룬 장의 카드에 '그날 브리핑
 *      듣기'를 붙일 수 있다. 어느 장인지는 merge 단계가 '시황' 글로 정한다.
 *
 * 실패하면 기존 파일을 그대로 둔다(빈 목록을 써서 카드를 지우지 않는다).
 * 사이트에서 내린 글은 search.json 에서 빠지므로 여기서도 빠진다. 그 밖에
 * scripts/insightimes-exclude.json 으로도 거른다(sync-insightimes.mjs 와 같은 목록).
 *
 * 실행: node scripts/sync-insightimes-archive.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '../data/insightimes-archive.json');
const EXCLUDE_FILE = join(HERE, 'insightimes-exclude.json');
const ORIGIN = 'https://insightimes.com';
const LISTEN_FROM = '2026-09-14';        // 시황 시작일. 그 전엔 음성 브리핑도 없다(실측 404)
const MAX_FETCH = 400;                    // 첫 실행에서 전량(약 300편)을 채울 수 있게
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
              + '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
  'Cache-Control': 'no-cache',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function load(p, d) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return d; } }

function slugOf(x) {
  const raw = String(x || '').trim();
  if (!raw) return '';
  let p = raw;
  try { p = new URL(raw, ORIGIN).pathname; } catch { /* 슬러그 그대로 */ }
  p = p.replace(/\/+$/, '');
  let last = p.slice(p.lastIndexOf('/') + 1);
  try { last = decodeURIComponent(last); } catch { /* 깨진 인코딩은 그대로 */ }
  return last.toLowerCase();
}

function loadExcluded() {
  if (!existsSync(EXCLUDE_FILE)) return new Set();
  const raw = load(EXCLUDE_FILE, null);
  if (!raw) { console.error('[it-archive] 제외 목록을 읽지 못했다 - 이번 회차는 거르지 않는다'); return new Set(); }
  const list = Array.isArray(raw) ? raw : (raw.excluded || []);
  return new Set(list.map((e) => slugOf(typeof e === 'string' ? e : e.url)).filter(Boolean));
}

async function get(url, asJson = false) {
  // 시간 제한이 없으면 응답 없는 연결 하나가 실행 전체를 붙잡는다
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return asJson ? res.json() : res.text();
}

const articleUrl = (slug) => `${ORIGIN}/articles/${encodeURIComponent(slug)}`;

function kstDate(d = new Date()) {
  return new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
}
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const prev = load(OUT, { articles: [], listen: {} });
  const prevBySlug = new Map((prev.articles || []).map((a) => [a.slug, a]));
  const excluded = loadExcluded();

  let idx;
  try {
    idx = await get(`${ORIGIN}/search.json`, true);
  } catch (e) {
    console.error(`::warning::search.json 을 읽지 못했다(${e.message}) - 기존 파일 유지`);
    return 0;
  }
  const rows = (idx && Array.isArray(idx.rows)) ? idx.rows : null;
  if (!rows || rows.length < 10) {
    console.error(`::warning::search.json 형식이 낯설다(rows ${rows ? rows.length : '없음'}) - 기존 파일 유지`);
    return 0;
  }

  const out = [];
  let fetched = 0, failed = 0;
  for (const r of rows) {
    const slug = String(r.s || '').trim();
    if (!slug || excluded.has(slug.toLowerCase())) continue;
    const old = prevBySlug.get(slug);
    let published = old && old.published;
    if (!published && fetched < MAX_FETCH) {
      try {
        const html = await get(articleUrl(slug));
        fetched++;
        const m = html && html.match(/"datePublished"\s*:\s*"([^"]+)"/);
        if (m) published = m[1];
        if (fetched % 50 === 0) console.log(`  기사 ${fetched}편 읽음`);
        await sleep(250);              // 남의 서버가 아니라도 몰아치지 않는다
      } catch (e) {
        failed++;
        console.warn(`  발행 시각 실패 ${slug}: ${e.message}`);
      }
    }
    out.push({
      slug,
      url: articleUrl(slug),
      title: String(r.t || '').trim(),
      cat: String(r.c || '').trim(),
      day: String(r.p || '').trim(),           // 사이트의 편집 날짜(달력에 쓰는 날)
      // 그 글이 나올 때 마지막으로 끝난 미국 장(ET). 인사이트 타임스가 직접 계산해 싣는다
      // (2026-10-16 search.json 에 m 칸 신설). 장 날짜는 이 값이 정답이다 - 발행 시각은
      // 일괄 이관한 글에서 이관 시각이라 실제 날짜와 다르다(9월 5일 하루에 8월 글이 몰려 있다).
      market: /^\d{4}-\d{2}-\d{2}$/.test(String(r.m || '')) ? String(r.m) : null,
      published: published || null,            // UTC ISO - 장 날짜 판정에 쓴다
    });
  }
  if (!out.length) {
    console.error('::warning::거른 뒤 남은 글이 없다 - 기존 파일 유지');
    return 0;
  }

  // ── 아침 편지의 음성 브리핑 페이지 ───────────────────────────────────
  // 날짜마다 한 번만 확인한다. 없던 날(404)도 적어 두되, 최근 사흘은 다시 본다
  // (편지가 늦게 올라오는 날이 있다).
  const listen = { ...(prev.listen || {}) };
  const today = kstDate();
  for (let d = LISTEN_FROM; d <= today; d = addDays(d, 1)) {
    const known = listen[d];
    const recent = d >= addDays(today, -3);
    if (known && (known.length || !recent)) continue;
    try {
      const html = await get(`${ORIGIN}/listen/${d}`);
      if (html == null) { listen[d] = []; continue; }
      const slugs = [...new Set([...html.matchAll(/href="(?:https:\/\/insightimes\.com)?\/articles\/([^"?#]+)/g)]
        .map((m) => slugOf(m[1])))].filter(Boolean);
      listen[d] = slugs;
      await sleep(250);
    } catch (e) {
      console.warn(`  음성 브리핑 ${d} 실패: ${e.message}`);
    }
  }

  const doc = {
    _설명: '인사이트 타임스 한국어판 전체 글 - 그날 무슨 일이 있었나의 근거 글 원천. scripts/sync-insightimes-archive.mjs 가 만든다.',
    source: `${ORIGIN}/search.json`,
    articles: out,
    listen,
  };
  const same = JSON.stringify({ a: prev.articles, l: prev.listen }) === JSON.stringify({ a: doc.articles, l: doc.listen });
  if (same) {
    console.log(`변경 없음 - 글 ${out.length}편`);
    return 0;
  }
  doc.updatedAt = new Date().toISOString();
  writeFileSync(OUT, JSON.stringify(doc, null, 1) + '\n', 'utf8');
  const withTime = out.filter((a) => a.published).length;
  console.log(`글 ${out.length}편(발행 시각 ${withTime}) · 새로 연 기사 ${fetched} · 실패 ${failed} · `
    + `음성 브리핑 ${Object.values(listen).filter((v) => v.length).length}일`);
  return 0;
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(1); });
