/* =====================================================================
   FlipZen 스크롤 버그 — 실기기 자동 진단 v2 (2026-07-18, Fable)

   v1 결과(아이폰 사파리 실측)로 확인된 것:
   - 코드 스크롤 명령은 150px 완벽 반영 → 스크롤러 자체는 정상.
   - 터치가 실제 있었던 단계(내부 래퍼/fixed/문서 스크롤 여지)는 전부 실패.
   - 버그는 WKWebView 전용이 아니라 아이폰 사파리에서도 재현 → iOS 터치
     제스처 계층 문제.
   - 다만 최우선 용의자였던 1단계(touch-action 해제)가 "터치 0회"로
     실제 검증이 안 됐다.

   v2 개선:
   - 각 단계는 손가락이 화면에 닿아 움직이기 시작해야만 측정을 시작한다
     (단계를 놓치는 일 원천 차단).
   - 용의자 3개(touch-action / -webkit-overflow-scrolling /
     overscroll-behavior)를 하나씩 분리 테스트 — 최소 수정이 앞 순서.
   - 성공(30px 이상 스크롤)이 나오면 즉시 종료하고 결과 표시.
   ===================================================================== */
(async () => {
  if (window.__fzDiagRunning) return;
  window.__fzDiagRunning = true;

  const results = { v: 2, startedAt: new Date().toString(), info: {}, phases: [] };
  const el = document.getElementById("quoteSettings");
  if (!el) { alert("진단 실패: #quoteSettings 없음"); return; }

  if (!el.classList.contains("is-open")) {
    const btn = document.getElementById("settingsOpen");
    if (btn) btn.click(); else el.classList.add("is-open");
    await new Promise(r => setTimeout(r, 700));
  }

  const ov = document.createElement("div");
  ov.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:2147483647;pointer-events:none;" +
    "background:rgba(190,20,20,0.92);color:#fff;padding:12px 14px;" +
    "font:700 15px/1.45 -apple-system,sans-serif;white-space:pre-line;text-align:center;";
  document.body.appendChild(ov);
  const show = t => { ov.textContent = t; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  show("진단 준비 중…");

  results.info.metrics = { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
  results.info.isNativeApp = /[?&]native=ios/.test(location.search);
  el.scrollTop = 150;
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 300)));
  results.info.programmaticScroll = el.scrollTop;
  el.scrollTop = 0;

  let curScroller = el;
  let moveCount = 0, maxTop = 0;
  const onTM = () => { moveCount++; };
  document.addEventListener("touchmove", onTM, { passive: true, capture: true });
  const sampler = setInterval(() => {
    const st = curScroller ? curScroller.scrollTop : 0;
    if (st > maxTop) maxTop = st;
  }, 80);

  const addCss = css => {
    const s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
    return () => s.remove();
  };

  const runPhase = async (name, apply, revert) => {
    moveCount = 0; maxTop = 0; curScroller = el;
    el.scrollTop = 0;
    let applyErr = null;
    try { if (apply) { const ret = apply(); if (ret && ret.scroller) curScroller = ret.scroller; } }
    catch (e) { applyErr = String(e); }

    // 손가락이 실제로 움직이기 시작할 때까지 대기 (최대 30초)
    const t0 = Date.now();
    while (moveCount === 0 && Date.now() - t0 < 30000) {
      show(name + "\n\n화면에 손가락을 대고 위아래로\n문지르기 시작하면 측정이 시작됩니다");
      await sleep(200);
    }
    let skipped = false;
    if (moveCount === 0) {
      skipped = true;
    } else {
      for (let s = 7; s > 0; s--) {
        show(name + "\n계속 위아래로 문지르세요!\n남은 " + s + "초 · 스크롤 " + Math.round(maxTop) + "px · 터치 " + moveCount + "회");
        await sleep(1000);
      }
    }
    try { if (revert) revert(); } catch (e) {}
    const rec = { name, maxScrollTop: Math.round(maxTop), touchmoves: moveCount, skipped, applyErr };
    results.phases.push(rec);
    await sleep(400);
    return rec;
  };

  const CSS_TA = "#quoteSettings, #quoteSettings * { touch-action: auto !important; }";
  const CSS_WOS = "#quoteSettings, #quoteSettings * { -webkit-overflow-scrolling: auto !important; }";
  const CSS_OB = "#quoteSettings, #quoteSettings * { overscroll-behavior: auto !important; }";

  const plan = [
    ["0) 기준선 (수정 없음)", null, null],
    ["1) touch-action만 해제", () => addCss(CSS_TA), r => r()],
    ["2) -webkit-overflow-scrolling만 제거", () => addCss(CSS_WOS), r => r()],
    ["3) overscroll-behavior만 해제", () => addCss(CSS_OB), r => r()],
    ["4) 셋 다 해제", () => addCss(CSS_TA + CSS_WOS + CSS_OB), r => r()],
  ];

  let winner = null, baselineWorked = false;
  for (let i = 0; i < plan.length; i++) {
    const [name, applyFactory, revertWith] = plan[i];
    let removed = null;
    const rec = await runPhase(
      name,
      applyFactory ? () => { removed = applyFactory(); } : null,
      removed || revertWith ? () => { if (removed && revertWith) revertWith(removed); } : null
    );
    if (rec.maxScrollTop > 30) {
      if (i === 0) { baselineWorked = true; } else { winner = rec.name; }
      break;
    }
  }

  // 위 4개가 다 실패하면 마지막으로: 셋 다 해제 + 내부 래퍼
  if (!winner && !baselineWorked) {
    let rmAll = null, wrap = null;
    const rec = await runPhase(
      "5) 셋 다 해제 + 내부 래퍼",
      () => {
        rmAll = addCss(CSS_TA + CSS_WOS + CSS_OB);
        wrap = document.createElement("div");
        wrap.style.cssText = "height:100%;overflow-y:auto;";
        while (el.firstChild) wrap.appendChild(el.firstChild);
        el.appendChild(wrap);
        el.style.overflow = "hidden";
        return { scroller: wrap };
      },
      () => {
        while (wrap.firstChild) el.appendChild(wrap.firstChild);
        wrap.remove(); el.style.overflow = "";
        if (rmAll) rmAll();
      });
    if (rec.maxScrollTop > 30) winner = rec.name;
  }

  results.verdict = baselineWorked
    ? "이 환경에서는 스크롤이 정상 (버그 미재현)"
    : winner ? "성공 처방 발견: " + winner : "전 단계 실패";

  clearInterval(sampler);
  document.removeEventListener("touchmove", onTM, { capture: true });
  ov.remove();

  const ok = !!winner || baselineWorked;
  const rep = document.createElement("div");
  rep.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;background:rgba(8,12,20,0.97);color:#fff;" +
    "padding:max(50px, env(safe-area-inset-top)) 18px 30px;overflow:auto;" +
    "font:600 14px/1.6 -apple-system,sans-serif;";
  let html =
    '<div style="font-size:17px;font-weight:800;color:' + (ok ? "#5dff9d" : "#ff7b7b") + ';margin-bottom:10px;">진단 결과(v2): ' + results.verdict + "</div>" +
    '<div style="opacity:0.85;margin-bottom:4px;">환경: ' + (results.info.isNativeApp ? "앱(WKWebView)" : "브라우저") +
    " · 콘텐츠 " + results.info.metrics.scrollHeight + "px / 화면 " + results.info.metrics.clientHeight + "px</div>" +
    '<div style="opacity:0.85;margin-bottom:12px;">코드 스크롤 명령(150px 지시): ' + results.info.programmaticScroll + "px 반영</div>";
  for (const p of results.phases) {
    const good = p.maxScrollTop > 30;
    html += '<div style="padding:6px 0;border-top:1px solid rgba(255,255,255,0.14);">' +
      '<span style="color:' + (good ? "#5dff9d" : "#ff9d9d") + ';font-weight:800;">' + (good ? "성공 " : (p.skipped ? "건너뜀 " : "실패 ")) + "</span>" +
      p.name + " — 스크롤 " + p.maxScrollTop + "px · 터치 " + p.touchmoves + "회" +
      (p.applyErr ? '<div style="color:#ffb060;">오류: ' + p.applyErr + "</div>" : "") + "</div>";
  }
  html += '<div style="margin-top:16px;opacity:0.75;">이 화면을 스크린샷으로 찍어 Claude에게 보내주세요.</div>' +
    '<button id="fzDiagClose" style="margin-top:14px;width:100%;padding:14px;border:0;border-radius:12px;font:800 16px -apple-system;background:#2c7be5;color:#fff;">닫기</button>';
  rep.innerHTML = html;
  document.body.appendChild(rep);
  document.getElementById("fzDiagClose").addEventListener("click", () => {
    rep.remove();
    window.__fzDiagRunning = false;
  });

  try { console.log("[FZ-DIAG] FINAL v2", JSON.stringify(results, null, 2)); } catch (e) {}
})();
