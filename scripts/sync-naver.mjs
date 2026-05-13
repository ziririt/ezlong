/**
 * Naver Premium Content 스크래퍼
 * 실행: node scripts/sync-naver.mjs
 *
 * 채널 홈 HTML에서 __NEXT_DATA__ JSON을 추출해 최근 글 5개를 파싱합니다.
 * API 응답 구조가 바뀌면 이 파일의 extractArticles() 함수만 수정하면 됩니다.
 */

import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, '../data/naver-content.json');

// ── 설정 ──────────────────────────────────────────────────────────────────────
const NAVER_UID = 'unis';
const NAVER_CHANNEL = 'something';
const CHANNEL_BASE = `https://contents.premium.naver.com/${NAVER_UID}/${NAVER_CHANNEL}`;
const AUTHOR_URL = `${CHANNEL_BASE}/authors/192d7ba6b7bltz`;
const MAX_ARTICLES = 5;

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
};
// ─────────────────────────────────────────────────────────────────────────────

async function fetchPage(url) {
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/**
 * HTML 안의 __NEXT_DATA__ 스크립트 태그에서 JSON을 추출합니다.
 */
function parseNextData(html) {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/**
 * __NEXT_DATA__ 객체에서 글 목록 배열을 찾습니다.
 * Naver의 응답 구조가 바뀌면 여기에 경로를 추가하세요.
 */
function findArticleList(data) {
  const pp = data?.props?.pageProps ?? {};

  // 알려진 경로들을 순서대로 시도
  const candidates = [
    pp.articleList,
    pp.articles,
    pp.contents,
    pp.contentList,
    pp.data?.articleList,
    pp.data?.articles,
    pp.data?.contentList,
    pp.channelInfo?.articleList,
    pp.channelInfo?.articles,
    pp.authorInfo?.articleList,
    pp.authorInfo?.contents,
    pp.initialData?.articleList,
    pp.initialData?.contents,
  ];

  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }

  // 후보를 못 찾으면 구조를 로그로 출력 (디버깅용)
  console.log(
    '[sync] pageProps keys:',
    JSON.stringify(Object.keys(pp), null, 2)
  );
  if (pp.data) {
    console.log(
      '[sync] pageProps.data keys:',
      JSON.stringify(Object.keys(pp.data), null, 2)
    );
  }
  return null;
}

/**
 * 글 배열 항목을 정규화된 형태로 변환합니다.
 */
function normalizeArticle(item) {
  const id =
    item.id ?? item.contentId ?? item.articleId ?? item.no ?? '';
  const title = item.title ?? item.subject ?? item.name ?? '';
  const url =
    item.url ??
    item.link ??
    item.contentsUrl ??
    (id ? `${CHANNEL_BASE}/contents/${id}` : '');
  const publishedAt =
    item.publishedAt ??
    item.createTime ??
    item.regTime ??
    item.publishTime ??
    item.date ??
    '';
  return { id: String(id), title, url, publishedAt };
}

/**
 * HTML에서 직접 글 링크를 정규식으로 뽑는 최후 수단 방법.
 */
function extractLinksFromHTML(html) {
  const pattern = new RegExp(
    `href="(/${NAVER_UID}/${NAVER_CHANNEL}/contents/[^"]+)"`,
    'g'
  );
  const seen = new Set();
  const results = [];
  let m;
  while ((m = pattern.exec(html)) !== null) {
    const path = m[1];
    if (!seen.has(path)) {
      seen.add(path);
      const id = path.split('/').pop() ?? '';
      results.push({
        id,
        title: '', // 제목은 가져올 수 없음
        url: `https://contents.premium.naver.com${path}`,
        publishedAt: '',
      });
    }
  }
  return results.slice(0, MAX_ARTICLES);
}

async function sync() {
  console.log(`[sync] ${new Date().toISOString()} 시작`);

  // 기존 데이터 로드 (실패 시 빈 데이터로 시작)
  let existing = { articles: [], updatedAt: null };
  try {
    existing = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    console.log('[sync] 기존 데이터 없음, 새로 시작합니다.');
  }

  let articles = null;

  // 1차 시도: 채널 저자 페이지
  for (const url of [AUTHOR_URL, CHANNEL_BASE]) {
    try {
      console.log(`[sync] 페이지 요청: ${url}`);
      const html = await fetchPage(url);

      const nextData = parseNextData(html);
      if (nextData) {
        const list = findArticleList(nextData);
        if (list && list.length > 0) {
          articles = list
            .map(normalizeArticle)
            .filter((a) => a.title && a.url)
            .slice(0, MAX_ARTICLES);

          if (articles.length > 0) {
            console.log(`[sync] __NEXT_DATA__ 에서 ${articles.length}개 추출`);
            break;
          }
        }
      }

      // 2차 수단: HTML 링크 직접 추출
      const fallback = extractLinksFromHTML(html);
      if (fallback.length > 0) {
        articles = fallback;
        console.log(`[sync] HTML 파싱으로 ${articles.length}개 추출 (제목 없음)`);
        break;
      }
    } catch (err) {
      console.error(`[sync] 오류 (${url}):`, err.message);
    }
  }

  if (!articles || articles.length === 0) {
    console.log('[sync] 글을 가져오지 못했습니다. 기존 데이터를 유지합니다.');
    process.exit(0);
  }

  const output = {
    articles,
    updatedAt: new Date().toISOString(),
  };

  writeFileSync(DATA_FILE, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`[sync] 완료: ${articles.length}개 저장`);
}

sync().catch((err) => {
  console.error('[sync] 치명적 오류:', err);
  process.exit(1);
});
