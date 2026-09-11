/* OG 카드 3종을 1200x630 PNG 로 굽는다.
   ─────────────────────────────────────────────────────────────────────────
   실행:  node scripts/og-cards/render.mjs        (저장소 루트에서)

   왜 HTML 로 굽나
     디자인 도구 없이 문구·색·배치를 고칠 수 있고, 결과가 결정론적이라
     다음 사람이 같은 그림을 다시 만들 수 있다. 이미지 편집기로 만든
     카드는 원본이 사라지면 손댈 수 없다.

   왜 절반 크기로 한 번 더 보나
     OG 카드는 타임라인에서 500~600px 폭으로 축소돼 보인다. 1200px 로만
     확인하면 축소 후 안 읽히는 글자를 못 잡는다. small-*.png 를 함께
     내보내는 이유가 그것이다 - 판정은 그 파일로 한다.

   자산을 바꿀 때
     기기 화면은 세로 비율이 폰과 같은 것을 쓴다. 화면 아래가 비어 있는
     스크린샷(shots/shot-1.png 류)을 그대로 넣으면 카드 아래 절반이
     통째로 빈다. sn-android.png 를 쓰는 이유다.
   ───────────────────────────────────────────────────────────────────────── */
import { createRequire } from 'node:module';

/* playwright 는 이 저장소의 의존성이 아니다(배포에 필요 없는 개발 도구다).
   전역 설치든 로컬 설치든 있는 곳에서 찾아 쓴다 - 못 찾으면 설치법을 알린다. */
const _req = createRequire(import.meta.url);
function loadPlaywright() {
  const tries = ['playwright', process.env.EZ_PLAYWRIGHT,
    '/home/claude/.npm-global/lib/node_modules/playwright',
    '/opt/homebrew/lib/node_modules/playwright',
    '/usr/local/lib/node_modules/playwright'].filter(Boolean);
  for (const t of tries) { try { return _req(t); } catch (e) { /* 다음 후보 */ } }
  throw new Error('playwright 를 찾지 못했다. npm i -g playwright && npx playwright install chromium');
}
const { chromium } = loadPlaywright();
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT  = path.resolve(HERE, '../../og');
const CARDS = [
  ['site.html',        'og-1200x630.png'],        // 사이트 공통 - 149개 페이지가 쓴다
  ['app.html',         'og-app-1200x630.png'],
  ['longtime.html',    'og-longtime-1200x630.png'],
  ['skybluenote.html', 'og-skybluenote-1200x630.png'],
];

const b = await chromium.launch({ args: ['--no-sandbox', '--allow-file-access-from-files'] });
const ctx = await b.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, locale: 'ko-KR' });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));

for (const [src, out] of CARDS) {
  await page.goto('file://' + path.join(HERE, src), { waitUntil: 'load' });
  await page.waitForTimeout(700);
  // 이미지 하나라도 못 불러왔으면 굽지 않는다 - 빈 자리가 박힌 카드가 배포되면
  // 캐시까지 타고 한참 남는다.
  const broken = await page.evaluate(() =>
    [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src));
  if (broken.length) throw new Error(`${src}: 이미지 로드 실패 ${broken.join(', ')}`);
  await page.screenshot({ path: path.join(OUT, out) });
  console.log('굽기 완료', out);
}
if (errs.length) console.warn('페이지 오류', errs);
await b.close();
