/**
 * 네이버 프리미엄 콘텐츠 전체 목록 수집 (CDP)
 * 사용: node naver-archive.mjs <wsUrl> <출력경로>
 * 무한 스크롤 목록이라 서버 렌더 HTML로는 20개까지만 나온다 —
 * 실제 브라우저를 끝까지 스크롤시켜 전부 긁는다.
 */
const [wsUrl, outPath] = process.argv.slice(2);
import { writeFileSync } from 'fs';

const LIST_URL = 'https://contents.premium.naver.com/unis/something/contents';
const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();

function send(method, params = {}) {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params }));
  return new Promise((res, rej) => {
    pending.set(mid, { res, rej });
    setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error('timeout ' + method)); } }, 30000);
  });
}

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result);
  }
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result && r.result.value;
}

ws.onopen = async () => {
  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: LIST_URL });
    await sleep(4000);

    let prev = 0, stall = 0, rounds = 0;
    while (stall < 4 && rounds < 400) {
      rounds++;
      await evalJs('window.scrollTo(0, document.body.scrollHeight); true');
      // '더보기' 성격의 버튼이 있으면 같이 눌러준다
      await evalJs(`(function(){
        var b = document.querySelector('.btn_more, .more_btn, button[class*="more"]');
        if (b && b.offsetParent !== null) { b.click(); return true; }
        return false;
      })()`);
      await sleep(900);
      const n = await evalJs('document.querySelectorAll(\'a[href*="/unis/something/contents/"]\').length');
      if (n <= prev) stall++; else { stall = 0; prev = n; }
      if (rounds % 10 === 0) console.log('[scroll] round', rounds, 'links', n);
    }

    const items = await evalJs(`(function(){
      var out = {}, nodes = document.querySelectorAll('.content_item');
      nodes.forEach(function(el){
        var a = el.querySelector('a[href*="/unis/something/contents/"]');
        if (!a) return;
        var m = a.getAttribute('href').match(/contents\\/([0-9a-z]+)/);
        if (!m) return;
        var t = el.querySelector('.content_title');
        var d = el.querySelector('.content_date, .date, time');
        out[m[1]] = {
          id: m[1],
          title: t ? t.textContent.trim() : '',
          dateText: d ? d.textContent.trim() : '',
          url: 'https://contents.premium.naver.com' + a.getAttribute('href').split('?')[0]
        };
      });
      return Object.values(out);
    })()`);

    console.log('[done] 수집', items.length, '건');
    writeFileSync(outPath, JSON.stringify(items, null, 1), 'utf8');
    ws.close();
    process.exit(0);
  } catch (e) {
    console.error('[err]', e.message);
    process.exit(1);
  }
};
