/**
 * Naver Premium Content 스크래퍼 v2
 * HTML 구조 디버깅 + 제목 추출 개선
 */

import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, '../data/naver-content.json');

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

function parseNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function deepFindArray(obj, depth = 0) {
  if (depth > 5) return null;
  if (Array.isArray(obj) && obj.length > 0) {
    const first = obj[0];
    if (first && typeof first === 'object' && (first.title || first.subject || first.name || first.contentId || first.articleId)) {
      return obj;
    }
  }
  if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      const found = deepFindArray(obj[key], depth + 1);
      if (found) { console.log(`[sync] 글 목록 발견 경로: ${key}`); return found; }
    }
  }
  return null;
}

function normalizeArticle(item) {
  const id = item.id ?? item.contentId ?? item.articleId ?? item.no ?? '';
  const title = item.title ?? item.subject ?? item.name ?? '';
  const url = item.url ?? item.link ?? item.contentsUrl ?? (id ? `${CHANNEL_BASE}/contents/${id}` : '');
  const publishedAt = item.publishedAt ?? item.createTime ?? item.regTime ?? item.publishTime ?? item.date ?? '';
  return { id: String(id), title, url, publishedAt };
}

function extractFromHTML(html) {
  const seen = new Set();
  const results = [];

  // 첫 번째 링크 주변 HTML 덤프 (디버깅용)
  const firstLinkIdx = html.indexOf(`/${NAVER_UID}/${NAVER_CHANNEL}/contents/`);
  if (firstLinkIdx > 0) {
    const snippet = html.substring(Math.max(0, firstLinkIdx - 300), firstLinkIdx + 300);
    console.log('[sync] 첫 링크 주변 HTML:\n' + snippet);
  }

  const linkRegex = new RegExp(`href="(/${NAVER_UID}/${NAVER_CHANNEL}/contents/([^"]+))"`, 'g');
  let match;

  while ((match = linkRegex.exec(html)) !== null && results.length < MAX_ARTICLES) {
    const path = match[1];
    const id = match[2];
    if (seen.has(path)) continue;
    seen.add(path);

    // 링크 앞뒤 1000자에서 제목 추출 시도
    const start = Math.max(0, match.index - 1000);
    const end = Math.min(html.length, match.index + 500);
    const ctx = html.substring(start, end);

    let title = '';
    const patterns = [
      /class="[^"]*title[^"]*"[^>]*>\s*([^<]{4,200})\s*</i,
      /class="[^"]*subject[^"]*"[^>]*>\s*([^<]{4,200})\s*</i,
      /class="[^"]*headline[^"]*"[^>]*>\s*([^<]{4,200})\s*</i,
      /class="[^"]*name[^"]*"[^>]*>\s*([^<]{4,200})\s*</i,
      /<strong[^>]*>\s*([^<]{4,200})\s*<\/strong>/i,
      /<h[1-4][^>]*>\s*([^<]{4,200})\s*<\/h[1-4]>/i,
      /title="([^"]{4,200})"/i,
      /alt="([^"]{4,200})"/i,
    ];

    for (const pat of patterns) {
      const m2 = ctx.match(pat);
      if (m2 && m2[1].trim().length > 3) {
        title = m2[1].trim()
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
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

      // __NEXT_DATA__ 시도
      const nd = parseNextData(html);
      if (nd) {
        const pp = nd?.props?.pageProps ?? {};
        console.log('[sync] pageProps 키:', Object.keys(pp).join(', '));
        const list = deepFindArray(pp);
        if (list?.length) {
          const arts = list.map(normalizeArticle).filter(a => a.title && a.url).slice(0, MAX_ARTICLES);
          if (arts.length) { articles = arts; console.log(`[sync] __NEXT_DATA__에서 ${arts.length}개 추출`); break; }
        }
      } else {
        console.log('[sync] __NEXT_DATA__ 없음');
      }

      // HTML 직접 추출
      const fallback = extractFromHTML(html);
      if (fallback.length) {
        // 기존 제목 병합 (이미 제목 있으면 유지)
        const prevMap = new Map((existing.articles || []).map(a => [a.url, a]));
        articles = fallback.map(a => {
          const prev = prevMap.get(a.url);
          return (prev?.title && !a.title) ? { ...a, title: prev.title, publishedAt: prev.publishedAt } : a;
        });
        const withTitle = articles.filter(a => a.title).length;
        console.log(`[sync] HTML 파싱 ${articles.length}개, 제목 있음: ${withTitle}개`);
        break;
      }
    } catch (err) {
      console.error(`[sync] 오류 (${url}):`, err.message);
    }
  }

  if (!articles?.length) {
    console.log('[sync] 글 없음, 기존 유지');
    process.exit(0);
  }

  articles.forEach((a, i) => console.log(`  ${i+1}. "${a.title || '(없음)'}" ${a.url}`));
  writeFileSync(DATA_FILE, JSON.stringify({ articles, updatedAt: new Date().toISOString() }, null, 2));
  console.log('[sync] 완료');
}

sync().catch(err => { console.error('[sync] 오류:', err); process.exit(1); });
