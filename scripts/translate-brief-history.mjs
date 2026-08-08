/**
 * 이슈(A Brief History) 다국어 번역 — data/brief-history.json → data/brief-history-{lang}.json
 *
 * 왜 필요한가
 *   이 코너는 매일 새 항목이 붙는다. 사람이 손으로 번역하면 반드시 밀리고,
 *   밀려도 아무 신호가 없다(페이지는 멀쩡히 뜨고 내용만 옛날 것). 그래서
 *   한국어가 갱신되는 그 자리에서 같이 굽는다.
 *
 * 비용을 어떻게 누르나
 *   번역 결과를 data/.cache/brief-history-i18n.json 에 원문 해시로 캐시한다.
 *   하루에 새로 붙는 건 두세 건이라, 첫 실행 뒤로는 호출이 거의 없다.
 *   캐시 파일이 사라져도 결과가 달라지지 않는다 — 다시 굽는 비용만 든다.
 *
 * 네이버 링크는 한국어에서만
 *   비한국어 판에는 링크(link·articles[].u)를 아예 싣지 않는다. 유료 구독
 *   한국어 콘텐츠라 링크를 눌러봐야 읽을 수 없다. 제목은 그날 무슨 일이
 *   있었는지 말해주므로 문장으로만 남긴다.
 *
 * 실패에 대한 태도
 *   한 덩어리가 실패해도 나머지는 굽는다. 실패한 항목은 이전 번역이 있으면
 *   그걸 쓰고, 없으면 그 항목만 빠진다 — 통째로 실패한 파일을 내보내지 않는다.
 *
 * 사용
 *   GEMINI_API_KEY=... node scripts/translate-brief-history.mjs
 *   node scripts/translate-brief-history.mjs --langs en,ja
 *   node scripts/translate-brief-history.mjs --limit 40    # 한 번에 번역할 최대 항목
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');
const SRC = join(DATA, 'brief-history.json');
const CACHE_DIR = join(DATA, '.cache');
const CACHE = join(CACHE_DIR, 'brief-history-i18n.json');

const ALL_LANGS = ['en', 'ja', 'zh', 'es', 'pt'];
const LANG_NAME = {
  en: 'English', ja: 'Japanese (日本語)', zh: 'Simplified Chinese (简体中文)',
  es: 'Spanish (Español)', pt: 'Brazilian Portuguese (Português)',
};

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash-lite';   // 번역은 판단이 아니다 — 가장 싼 모델로 충분
const BATCH = 12;            // 한 번에 보낼 항목 수. 너무 크면 출력이 잘린다
const MAX_TRIES = 3;

const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const LANGS = argOf('--langs', ALL_LANGS.join(',')).split(',').filter(Boolean);
const LIMIT = parseInt(argOf('--limit', '600'), 10);

// ── 유틸 ────────────────────────────────────────────────────────────────
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 16);

function loadJSON(p, dflt) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return dflt; }
}

function httpPost(host, path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      { host, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }, timeout: 120000 },
      (res) => {
        let buf = '';
        res.on('data', (c) => { buf += c; });
        res.on('end', () => { try { resolve(JSON.parse(buf)); } catch (e) { reject(new Error('JSON 파싱 실패: ' + buf.slice(0, 200))); } });
      }
    );
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function gemini(prompt) {
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    try {
      const resp = await httpPost(
        'generativelanguage.googleapis.com',
        `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1, maxOutputTokens: 16384,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 },
          },
        }
      );
      const parts = resp?.candidates?.[0]?.content?.parts || [];
      const text = parts.filter((p) => !p.thought).map((p) => p.text || '').join('');
      if (!text) throw new Error(resp?.error?.message || resp?.candidates?.[0]?.finishReason || '빈 응답');
      const m = text.match(/[[{][\s\S]*[\]}]/);
      if (!m) throw new Error('JSON 미포함');
      return JSON.parse(m[0]);
    } catch (e) {
      if (attempt === MAX_TRIES) { console.error('  Gemini 실패:', e.message); return null; }
      await new Promise((r) => setTimeout(r, attempt * 4000));
    }
  }
  return null;
}

// ── 번역 단위 ───────────────────────────────────────────────────────────
/* 한 이벤트에서 번역이 필요한 문자열만 뽑아 하나의 덩어리로 만든다.
   해시는 이 덩어리 기준이라, 본문이 그대로면 다시 번역하지 않는다. */
function unitOf(e) {
  return {
    title: e.title || '',
    summary: e.summary || '',
    groups: (e.summaryGroups || []).map((g) => ({ h: g.heading || '', p: g.points || [] })),
    arts: (e.articles || []).map((a) => a.t),
    more: (e.moreArticles || []).map((a) => a.t),
  };
}

const PROMPT_HEAD = (lang) => `You translate Korean US-stock market notes into ${LANG_NAME[lang]}.

Rules:
- Translate naturally for retail investors who follow US markets. Not word-for-word.
- Keep tickers, index names, company names and all numbers exactly as they are (QQQ, SOXX, S&P 500, FOMC, +2.78%, 30-year yield 5.2%).
- Korean company nicknames must become the standard English-market name, then localized: 마소 = Microsoft, 엔비디아 = NVIDIA, 애플 = Apple, 구글 = Google/Alphabet, 테슬라 = Tesla, 아마존 = Amazon, 연준 = the Fed.
- Keep each string about as short as the Korean. These are headlines and bullet points, not paragraphs.
- Do not add commentary, disclaimers, or anything not in the source.
- EVERY output string must be written in ${LANG_NAME[lang]}. Never answer in English unless ${LANG_NAME[lang]} IS English. This is the most common failure — check each string before returning it.
- Return ONLY a JSON array. Same length and same order as the input array. Each element must have exactly the same shape as its input element.

Input is a JSON array of objects shaped {title, summary, groups:[{h, p:[...]}], arts:[...], more:[...]}.
Translate every string value. Keep empty strings and empty arrays as they are.
Target language, once more: ${LANG_NAME[lang]}.

Input:
`;

/* 정말 그 언어로 왔는가.
   실측(2026-08-09 첫 실행): 일본어 요청의 67%가 영어로 돌아왔다. 모델이
   목표 언어를 조용히 무시하는 일이 있고, 그대로 저장하면 일본어 페이지가
   영어로 채워진 채 아무도 모른다. 캐시를 읽을 때도 같은 검사를 걸어서,
   한 번 잘못 담긴 것도 다음 실행에서 저절로 다시 번역되게 한다. */
const HANGUL = /[가-힣]/;
const SCRIPT_OF = {
  ja: /[ぁ-んァ-ヴ一-鿿]/,     // 가나 또는 한자
  zh: /[一-鿿]/,
};
function looksTranslated(lang, t) {
  if (!t || typeof t !== 'object') return false;
  const sample = [t.title, t.summary, ...(t.arts || []), ...((t.groups || [])[0]?.p || [])]
    .filter(Boolean).join(' ');
  if (!sample) return true;                 // 번역할 글자가 없던 항목
  if (HANGUL.test(sample)) return false;    // 한국어가 그대로 남았다
  const need = SCRIPT_OF[lang];
  return need ? need.test(sample) : true;
}

async function translateBatch(units, lang) {
  const out = await gemini(PROMPT_HEAD(lang) + JSON.stringify(units, null, 0));
  if (!Array.isArray(out) || out.length !== units.length) {
    console.warn(`  [${lang}] 응답 길이 불일치 — 이 묶음 건너뜀 (기대 ${units.length}, 받음 ${Array.isArray(out) ? out.length : 'non-array'})`);
    return null;
  }
  const bad = out.filter((t) => !looksTranslated(lang, t)).length;
  if (bad > out.length / 3) {
    console.warn(`  [${lang}] ${bad}/${out.length} 이 목표 언어가 아니다 — 이 묶음 버림(다음 실행에서 재시도)`);
    return null;
  }
  return out;
}

/* 번역 결과를 원래 이벤트 구조에 다시 끼운다. 링크는 싣지 않는다. */
function applyUnit(e, t) {
  const out = {
    date: e.date,
    title: t.title || e.title,
    importance: e.importance,
    moves: e.moves,
    source: e.source,
  };
  if (t.summary) out.summary = t.summary;
  if (e.summaryGroups && e.summaryGroups.length) {
    out.summaryGroups = e.summaryGroups.map((g, i) => ({
      heading: (t.groups && t.groups[i] && t.groups[i].h) || g.heading,
      points: (t.groups && t.groups[i] && t.groups[i].p) || g.points,
    }));
  }
  // 링크 없이 제목만 — 유료 한국어 원문이라 눌러도 읽을 수 없다
  if (e.articles && e.articles.length) {
    out.articles = e.articles.map((a, i) => ({ t: (t.arts && t.arts[i]) || a.t }));
  }
  if (e.moreArticles && e.moreArticles.length) {
    out.moreArticles = e.moreArticles.map((a, i) => ({ t: (t.more && t.more[i]) || a.t }));
  }
  return out;
}

// ── 본체 ────────────────────────────────────────────────────────────────
async function main() {
  const events = loadJSON(SRC, null);
  if (!Array.isArray(events)) {
    console.error('::error::data/brief-history.json 을 읽지 못했다');
    return 1;
  }
  if (!GEMINI_KEY) {
    console.warn('::warning::GEMINI_API_KEY 없음 — 번역 건너뜀(기존 번역본 유지)');
    return 0;
  }

  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  const cache = loadJSON(CACHE, {});
  let calls = 0;

  for (const lang of LANGS) {
    const units = events.map(unitOf);
    const keys = units.map((u) => sha(JSON.stringify(u)));
    const todo = [];
    keys.forEach((k, i) => {
      const hit = cache[lang] && cache[lang][k];
      if (!hit || !looksTranslated(lang, hit)) todo.push(i);
    });

    console.log(`[${lang}] 전체 ${events.length}건 · 새로 번역할 것 ${todo.length}건`);
    const slice = todo.slice(0, LIMIT);
    if (todo.length > slice.length) {
      console.warn(`::warning::[${lang}] ${todo.length - slice.length}건은 이번 실행에서 제외(--limit ${LIMIT}) — 다음 실행에서 이어서 번역된다`);
    }

    cache[lang] = cache[lang] || {};
    for (let s = 0; s < slice.length; s += BATCH) {
      const idxs = slice.slice(s, s + BATCH);
      const res = await translateBatch(idxs.map((i) => units[i]), lang);
      calls++;
      if (!res) continue;
      idxs.forEach((i, j) => { cache[lang][keys[i]] = res[j]; });
      writeFileSync(CACHE, JSON.stringify(cache), 'utf8');   // 중간에 죽어도 지금까지는 남는다
      process.stdout.write(`  [${lang}] ${Math.min(s + BATCH, slice.length)}/${slice.length}\r`);
    }
    if (slice.length) process.stdout.write('\n');

    // 번역이 있는 것만 싣는다 — 한국어가 섞여 나가는 것보다 빠지는 게 낫다
    const translated = [];
    let missing = 0;
    events.forEach((e, i) => {
      const t = cache[lang][keys[i]];
      if (!t || !looksTranslated(lang, t)) { missing++; return; }
      translated.push(applyUnit(e, t));
    });
    if (!translated.length) {
      console.error(`::error::[${lang}] 번역된 항목이 하나도 없다 — 파일을 쓰지 않는다`);
      continue;
    }
    writeFileSync(join(DATA, `brief-history-${lang}.json`),
      JSON.stringify(translated, null, 1), 'utf8');
    console.log(`[${lang}] 저장 ${translated.length}건${missing ? ` (미번역 ${missing}건 제외)` : ''}`);
  }

  console.log(`Gemini 호출 ${calls}회`);
  return 0;
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(1); });
