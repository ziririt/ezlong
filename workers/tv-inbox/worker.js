// ezlong tv-inbox 백엔드 (Cloudflare Worker)
// 목적: TradingView(또는 다른 소스) 리포트를 클로드가 다음 세션에서 읽을 수 있게
// GitHub 저장소(data/tv-inbox/)에 자동 커밋한다.
//
// 진입점 2개:
//   POST /submit    — tv-inbox.html 웹페이지에서 텍스트/파일 제출
//   POST /telegram  — 텔레그램 봇 웹훅(포워딩된 메시지 수신)
//
// 필수 Secrets (절대 코드에 하드코딩하지 말 것 — wrangler secret put 으로 등록):
//   GITHUB_PAT              ziririt/ezlong 저장소 Contents: Read and write 권한만 있는
//                            fine-grained PAT (다른 저장소·다른 권한 없이 최소 범위로 발급)
//   INBOX_PIN                웹페이지 제출 확인용 공유 비밀번호(사용자 본인만 아는 값)
//   TELEGRAM_WEBHOOK_SECRET   텔레그램 setWebhook 등록 시 쓴 secret_token과 동일 값 (선택, 나중에 추가 가능)

const REPO = 'ziririt/ezlong';
const BRANCH = 'main';
// 실제 배포 후 페이지에서 요청이 오는 도메인 — CORS 허용 목록
const ALLOWED_ORIGINS = ['https://ezlong.com', 'https://ezlong-541a8.web.app'];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function kstTimestamp() {
  const now = new Date();
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const y  = kst.getFullYear();
  const m  = String(kst.getMonth() + 1).padStart(2, '0');
  const d  = String(kst.getDate()).padStart(2, '0');
  const hh = String(kst.getHours()).padStart(2, '0');
  const mm = String(kst.getMinutes()).padStart(2, '0');
  const ss = String(kst.getSeconds()).padStart(2, '0');
  return `${y}${m}${d}-${hh}${mm}${ss}`;
}

async function commitToGithub(env, path, base64Content, message) {
  const url = `https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${env.GITHUB_PAT}`,
      'User-Agent': 'ezlong-tv-inbox-worker',
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, content: base64Content, branch: BRANCH }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub 커밋 실패 (${res.status}): ${errText.slice(0, 300)}`);
  }
  return res.json();
}

async function handleSubmit(request, env, origin) {
  const headers = { 'Content-Type': 'application/json', ...corsHeaders(origin) };
  let data;
  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: '요청 형식 오류' }), { status: 400, headers });
  }

  if (!env.INBOX_PIN || !data.pin || data.pin !== env.INBOX_PIN) {
    return new Response(JSON.stringify({ ok: false, error: '비밀번호가 틀렸습니다.' }), { status: 401, headers });
  }

  const text = (data.text || '').trim();
  const hasFile = data.fileName && data.fileBase64;
  if (!text && !hasFile) {
    return new Response(JSON.stringify({ ok: false, error: '텍스트나 파일 중 하나는 있어야 합니다.' }), { status: 400, headers });
  }

  const ts = kstTimestamp();
  const results = [];
  try {
    if (text) {
      const path = `data/tv-inbox/web-${ts}.md`;
      await commitToGithub(env, path, utf8ToBase64(text), `tv-inbox: 웹 제출 텍스트 ${ts}`);
      results.push(path);
    }
    if (hasFile) {
      // fileBase64는 클라이언트에서 이미 base64로 인코딩해서 보냄(이미지 등 바이너리 대응)
      const safeName = String(data.fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `data/tv-inbox/web-${ts}-${safeName}`;
      await commitToGithub(env, path, data.fileBase64, `tv-inbox: 웹 제출 파일 ${ts}`);
      results.push(path);
    }
    return new Response(JSON.stringify({ ok: true, paths: results }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e.message || e) }), { status: 500, headers });
  }
}

async function handleTelegram(request, env) {
  const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (!env.TELEGRAM_WEBHOOK_SECRET || secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 403 });
  }
  try {
    const update = await request.json();
    const msg = update.message || update.channel_post || update.edited_message;
    const text = (msg?.text || msg?.caption || '').trim();
    if (text) {
      const ts = kstTimestamp();
      const path = `data/tv-inbox/telegram-${ts}.md`;
      await commitToGithub(env, path, utf8ToBase64(text), `tv-inbox: 텔레그램 수신 ${ts}`);
    }
    // 텔레그램은 응답 본문을 보지 않는다 — 200만 반환하면 됨
    return new Response('ok');
  } catch (e) {
    return new Response('error: ' + String(e.message || e), { status: 500 });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (url.pathname === '/submit' && request.method === 'POST') {
      return handleSubmit(request, env, origin);
    }
    if (url.pathname === '/telegram' && request.method === 'POST') {
      return handleTelegram(request, env);
    }
    return new Response('Not found', { status: 404 });
  },
};
