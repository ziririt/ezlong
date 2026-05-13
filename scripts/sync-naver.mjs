/**
 * Naver Premium Content 스크래퍼 v4
 * content_text 구조 기반 제목 추출
 */

import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, '../data/naver-content.json');
const DEBUG_FILE = join(__dirname, '../data/debug-html.txt');

const NAVER_UID = 'unis';
const NAVER_CHANNEL = 'something';
const CHANNEL_BASE = `https://contents.premium.naver.com/${NAVER_UID}/${NAVER_CHANNEL}`;
const AUTHOR_URL = `${CHANNEL_BASE}/authors/192d7ba6b7bltz`;
const MAX_ARTICLES = 5;

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
};

async function fetchPage(url) {
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function extractFromHTML(html) {
  const seen = new Set();
  const results = [];

  // 디버그: content_list 시작부터 4000자 저장
  const listIdx = html.indexOf('content_list');
  if (listIdx > 0) {
    const snippet = html.substring(listIdx, listIdx + 4000);
    writeFileSync(DEBUG_FILE, snippet, 'utf-8');
    console.log('[sync] 디버그 저장 (content_list~): ' + snippet.length + 'chars');
  }

  // 구조: content_item > content_thumb(a[href]) + content_text(strong/a[title])
  // content_item 블록 전체를 캡처
  const itemRegex = new RegExp(
    'class="content_item[^"]*"[\\s\\S]{0,50}' +
    'href="(/unis/something/contents/([^"]+))"[\\s\\S]{0,2000}?' +
    'class="content_text"[\\s\\S]{0,600}?' +
    '(?:<strong[^>]*>([^<]{3,200})<\\/strong>' +
    '|<a[^>]*title="([^"]{3,200})"' +
    '|<a[^>]*>([^<]{3,200})<\\/a>' +
    '|<p[^>]*>([^<]{3,200})<\\/p>)',
    'g'
  );

  let m;
  while ((m = itemRegex.exec(html)) !== null && results.length < MAX_ARTICLES) {
    const path = m[1], id = m[2];
    if (seen.has(path)) continue;
    seen.add(path);
    const title = (m[3] || m[4] || m[5] || m[6] || '').trim()
      .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
    console.log(`[sync] item ${results.length+1}: "${title.substring(0,40) || '(없음)'}"`);
    results.push({ id, title, url: `https://contents.premium.naver.com${path}`, publishedAt: '' });
  }

  // fallback: 제목 없이 링크만
  if (results.length === 0) {
    const linkRegex = new RegExp(`href="(/${NAVER_UID}/${NAVER_CHANNEL}/contents/([^"]+))"`, 'g');
    let lm;
    while ((lm = linkRegex.exec(html)) !== null && results.length < MAX_ARTICLES) {
      const path = lm[1], id = lm[2];
      if (seen.has(path)) continue;
      seen.add(path);
      results.push({ id, title: '', url: `https://contents.premium.naver.com${path}`, publishedAt: '' });
    }
    console.log(`[sync] fallback: ${results.length}개 (제목 없음)`);
  }

  return results;
}

async function sync() {
  console.log(`[sync] ${new Date().toISOString()} 시작`);
  let existing = { articles: [], updatedAt: null };
  try { existing = JSON.parse(readFileSync(DATA_FILE, 'utf-8')); } catch {}

  let articles = null;

  for (const url of [AUTHOR_URL, CHANNEL_BASE]) {
    try {
      console.log(`[sync] 요청: ${url}`);
      const html = await fetchPage(url);
      console.log(`[sync] HTML 길이: ${html.length}`);

      const fallback = extractFromHTML(html);
      if (fallback.length) {
        const prevMap = new Map((existing.articles || []).map(a => [a.url, a]));
        articles = fallback.map(a => {
          const prev = prevMap.get(a.url);
          return (prev?.title && !a.title) ? { ...a, title: prev.title, publishedAt: prev.publishedAt } : a;
        });
        console.log(`[sync] 최종: ${articles.length}개, 제목: ${articles.filter(a=>a.title).length}개`);
        break;
      }
    } catch (err) {
      console.error(`[sync] 오류:`, err.message);
    }
  }

  if (!articles?.length) { console.log('[sync] 글 없음'); process.exit(0); }

  writeFileSync(DATA_FILE, JSON.stringify({ articles, updatedAt: new Date().toISOString() }, null, 2));
  console.log('[sync] 완료');
}

sync().catch(err => { console.error('[sync] 오류:', err); process.exit(1); });
