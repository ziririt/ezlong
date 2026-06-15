/**
 * Naver Premium Content 스크래퍼 v5 (최종)
 * class="content_title" 기반 정확한 제목 추출
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
const MAX_ARTICLES = 10;

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

  // Naver 프리미엄 콘텐츠 구조 (디버깅으로 확인):
  // <div class="content_item as_thumb">
  //   <a href="/unis/something/contents/ID" class="content_thumb">...</a>
  //   <div class="content_text">
  //     <div class="content_text_link">
  //       <strong class="content_title">제목</strong>
  //     </div>
  //   </div>
  // </div>

  // content_item 블록에서 href + content_title 한번에 추출
  const itemRegex = new RegExp(
    'class="content_item[^"]*"[\\s\\S]{0,200}' +
    'href="(/unis/something/contents/([^"]+))"' +
    '[\\s\\S]{0,2500}?' +
    'class="content_title[^"]*"[^>]*>\\s*([^<]{2,300})\\s*<',
    'g'
  );

  let m;
  while ((m = itemRegex.exec(html)) !== null && results.length < MAX_ARTICLES) {
    const path = m[1], id = m[2];
    if (seen.has(path)) continue;
    seen.add(path);
    const title = m[3].trim()
      .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
    console.log(`[sync] ${results.length+1}. "${title}"`);
    results.push({ id, title, url: `https://contents.premium.naver.com${path}`, publishedAt: '' });
  }

  console.log(`[sync] content_title 추출: ${results.length}개`);

  // fallback: content_title 못 찾으면 링크만
  if (results.length === 0) {
    const linkRegex = new RegExp(`href="(/${NAVER_UID}/${NAVER_CHANNEL}/contents/([^"]+))"`, 'g');
    let lm;
    while ((lm = linkRegex.exec(html)) !== null && results.length < MAX_ARTICLES) {
      const path = lm[1], id = lm[2];
      if (seen.has(path)) continue;
      seen.add(path);
      results.push({ id, title: '', url: `https://contents.premium.naver.com${path}`, publishedAt: '' });
    }
    console.log(`[sync] fallback 링크 추출: ${results.length}개`);
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
      console.log(`[sync] HTML: ${html.length}자`);

      const extracted = extractFromHTML(html);
      if (extracted.length) {
        // 누적 병합: 새 기사 상단 + 기존 기사(새 목록에 없는 것) 하단 추가, MAX_ARTICLES 상한
        const prevArticles = existing.articles || [];
        const prevMap = new Map(prevArticles.map(a => [a.url, a]));
        const newUrls = new Set(extracted.map(a => a.url));

        // 새 기사: 기존에 제목/publishedAt 있으면 유지
        const mergedNew = extracted.map(a => {
          const prev = prevMap.get(a.url);
          return (prev?.title && !a.title)
            ? { ...a, title: prev.title, publishedAt: prev.publishedAt }
            : a;
        });

        // 기존 기사 중 이번 스크랩에 없는 것만 뒤에 붙임
        const prevOnly = prevArticles.filter(a => !newUrls.has(a.url));

        articles = [...mergedNew, ...prevOnly].slice(0, MAX_ARTICLES);
        console.log(`[sync] 최종 ${articles.length}개 (새 ${mergedNew.length}개 + 누적 ${prevOnly.length}개), 제목 있음: ${articles.filter(a=>a.title).length}개`);
        break;
      }
    } catch (err) {
      console.error(`[sync] 오류:`, err.message);
    }
  }

  if (!articles?.length) { console.log('[sync] 결과 없음, 기존 유지'); process.exit(0); }

  writeFileSync(DATA_FILE, JSON.stringify({ articles, updatedAt: new Date().toISOString() }, null, 2));
  console.log('[sync] 저장 완료');
}

sync().catch(err => { console.error('[sync] 오류:', err); process.exit(1); });
