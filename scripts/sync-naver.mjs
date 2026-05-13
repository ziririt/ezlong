/**
 * Naver Premium Content 스크래퍼 v3
 * HTML 구조 파일 저장으로 디버깅
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
  const contentsPath = `/${NAVER_UID}/${NAVER_CHANNEL}/contents/`;
  
  // 첫 번째 링크 위치 찾기
  const firstLinkIdx = html.indexOf(contentsPath);
  if (firstLinkIdx > 0) {
    // 앞뒤 1500자 디버그 파일에 저장
    const snippet = html.substring(Math.max(0, firstLinkIdx - 1500), firstLinkIdx + 500);
    writeFileSync(DEBUG_FILE, snippet, 'utf-8');
    console.log('[sync] 디버그 HTML 저장: data/debug-html.txt (' + snippet.length + 'chars)');
  }

  const linkRegex = new RegExp(`href="(/${NAVER_UID}/${NAVER_CHANNEL}/contents/([^"]+))"`, 'g');
  let match;
  while ((match = linkRegex.exec(html)) !== null && results.length < MAX_ARTICLES) {
    const path = match[1];
    const id = match[2];
    if (seen.has(path)) continue;
    seen.add(path);

    const start = Math.max(0, match.index - 1500);
    const end = Math.min(html.length, match.index + 500);
    const ctx = html.substring(start, end);

    let title = '';
    const patterns = [
      /class="[^"]*title[^"]*"[^>]*>\s*([^<]{4,200})\s*</i,
      /class="[^"]*subject[^"]*"[^>]*>\s*([^<]{4,200})\s*</i,
      /class="[^"]*headline[^"]*"[^>]*>\s*([^<]{4,200})\s*</i,
      /<strong[^>]*>\s*([^<]{4,200})\s*<\/strong>/i,
      /<h[1-4][^>]*>\s*([^<]{4,200})\s*<\/h[1-4]>/i,
      /title="([^"]{4,200})"/i,
    ];
    for (const pat of patterns) {
      const m2 = ctx.match(pat);
      if (m2 && m2[1].trim().length > 3) {
        title = m2[1].trim().replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
        break;
      }
    }
    results.push({ id, title, url: `https://contents.premium.naver.com${path}`, publishedAt: '' });
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

      // __NEXT_DATA__ 확인
      const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (m) {
        console.log('[sync] __NEXT_DATA__ 있음, 길이:', m[1].length);
      } else {
        console.log('[sync] __NEXT_DATA__ 없음');
      }

      // script 태그들 확인
      const scripts = [...html.matchAll(/<script[^>]*src="([^"]*)"[^>]*>/g)].map(s => s[1]);
      console.log('[sync] 외부 스크립트 수:', scripts.length);

      const fallback = extractFromHTML(html);
      if (fallback.length) {
        const prevMap = new Map((existing.articles || []).map(a => [a.url, a]));
        articles = fallback.map(a => {
          const prev = prevMap.get(a.url);
          return (prev?.title && !a.title) ? { ...a, title: prev.title, publishedAt: prev.publishedAt } : a;
        });
        console.log(`[sync] HTML 파싱 ${articles.length}개, 제목 있음: ${articles.filter(a=>a.title).length}개`);
        break;
      }
    } catch (err) {
      console.error(`[sync] 오류:`, err.message);
    }
  }

  if (!articles?.length) {
    console.log('[sync] 글 없음, 기존 유지');
    process.exit(0);
  }

  articles.forEach((a, i) => console.log(`  ${i+1}. "${a.title||'(없음)'}"`));
  writeFileSync(DATA_FILE, JSON.stringify({ articles, updatedAt: new Date().toISOString() }, null, 2));
  console.log('[sync] 완료');
}

sync().catch(err => { console.error('[sync] 오류:', err); process.exit(1); });
