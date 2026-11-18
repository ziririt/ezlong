/* Skyblue Note 도구 페이지 공용 — 2026-11-19.
   정리 엔진은 앱과 같은 것(../tidy.js, 다트에서 옮긴 것)을 쓴다. 글은 브라우저 밖으로 나가지 않는다.
   페이지마다 <body data-lang="ko|en" data-mode="plain|tsv"> 로 다르게 군다. */
(function () {
  var W = {
    ko: { busy: '정리 엔진을 불러오는 중입니다…', fail: '정리 엔진을 불러오지 못했습니다. 새로고침해 주세요.',
      empty: '먼저 위 칸에 글을 붙여넣어 주세요.', copied: '복사했습니다', noTable: '표를 찾지 못했습니다. 표가 있는 답변을 붙여넣어 주세요.',
      same: '고칠 것이 없었습니다. 이미 깨끗한 글입니다.', done: '정리했습니다. 아래 결과를 복사해 쓰세요.',
      blocked: '복사가 막혔습니다. 결과 칸을 직접 선택해 복사해 주세요.' },
    en: { busy: 'Loading the cleanup engine…', fail: 'The cleanup engine did not load. Please refresh the page.',
      empty: 'Paste some text into the box above first.', copied: 'Copied', noTable: 'No table found. Paste an answer that contains a table.',
      same: 'Nothing to fix — the text is already clean.', done: 'Done. Copy the result below.',
      blocked: 'Copying was blocked. Select the result and copy it yourself.' }
  };
  var b = document.body, w = W[b.getAttribute('data-lang')] || W.ko, mode = b.getAttribute('data-mode') || 'plain';
  function $(id) { return document.getElementById(id); }
  var src = $('src'), out = $('out'), msg = $('msg'), last = null;
  function say(t) { msg.textContent = t; }
  function flash(btn) { var o = btn.textContent; btn.textContent = w.copied; setTimeout(function () { btn.textContent = o; }, 1400); }
  function copy(text, btn) {
    function legacy() {
      var t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); flash(btn); } catch (e) { say(w.blocked); }
      document.body.removeChild(t);
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { flash(btn); }, legacy);
    else legacy();
  }
  function preset() {
    try { var l = JSON.parse(window.SkyblueTidyPresets()); return l.length ? l[0].id : 'basic'; } catch (e) { return 'basic'; }
  }
  function run() {
    if (typeof window.SkyblueTidyRun !== 'function') { say(w.fail); return; }
    var raw = src.value;
    if (!raw.trim()) { say(w.empty); out.value = ''; last = null; return; }
    try { last = JSON.parse(window.SkyblueTidyRun(raw, preset())); } catch (e) { say(w.fail); return; }
    if (mode === 'tsv') {
      var t = (last.tsv || []).join('\n\n');
      out.value = t || last.text;
      say(t ? w.done : w.noTable);
    } else {
      out.value = last.text;
      say(last.text.trim() === raw.trim() ? w.same : w.done);
    }
    if (window.gtag) gtag('event', 'tool_tidy', { tool: location.pathname, chars: raw.length });
  }
  $('go').addEventListener('click', run);
  src.addEventListener('paste', function () { setTimeout(run, 0); });
  $('copy').addEventListener('click', function () { if (out.value) copy(out.value, $('copy')); else say(w.empty); });
  var ex = $('example');
  if (ex) ex.addEventListener('click', function () { src.value = ex.getAttribute('data-text').replace(/\\n/g, '\n'); run(); });
  var tries = 0;
  (function wait() {
    if (typeof window.SkyblueTidyRun === 'function') { say(''); return; }
    if (++tries > 60) { say(w.fail); return; }
    if (tries === 1) say(w.busy);
    setTimeout(wait, 100);
  })();
})();
