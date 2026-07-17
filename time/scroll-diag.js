/* =====================================================================
   FlipZen 스크롤 버그 — 실기기 자동 진단 v5 "수술 검증" (2026-07-18, Fable)

   v3 재실행(5:11)에서 잡힌 결정적 대조:
   - 동일한 클린 스크롤러가 body 직속이면 성공(2361px), .clock-app 안이면
     실패(0px). 요소가 아니라 "위치"가 생사를 갈랐다.

   병리 (확정 유력): .clock-app은 100dvh 상자 안에 2페이지 분량(~200svh)의
   #pageTrack을 넣고 overflow:hidden으로 잘라놓은 구조 → iOS WebKit이
   팬 제스처를 "가장 가까운 스크롤 가능 조상"인 .clock-app에 물리는데,
   overflow:hidden이라 유저 스크롤 불가 → 제스처 소멸. .clock-app 내부의
   모든 스크롤 영역(설정/날씨상세 포함)이 이래서 전멸한 것.

   v5: 실제 환자(#quoteSettings)를 body로 임시 이주시켜 스크롤이 살아나는지
   검증. 성공하면 그게 곧 본수술 설계도다.
   ===================================================================== */
(async () => {
  if (window.__fzDiagRunning) return;
  window.__fzDiagRunning = true;

  const results = { v: 5, startedAt: new Date().toString(), info: {}, phases: [] };
  const el = document.getElementById("quoteSettings");
  const clockApp = document.querySelector(".clock-app");
  const pageTrack = document.getElementById("pageTrack") || document.querySelector(".page-track");
  const iframe = document.querySelector(".ezlong-frame");
  if (!el || !clockApp) { alert("진단 실패: 필수 요소 없음"); return; }

  if (!el.classList.contains("is-open")) {
    const btn = document.getElementById("settingsOpen");
    if (btn) btn.click(); else el.classList.add("is-open");
    await new Promise(r => setTimeout(r, 700));
  }

  // 병리 근거 실측: clock-app의 숨은 overflow
  results.info.clockApp = {
    scrollHeight: clockApp.scrollHeight, clientHeight: clockApp.clientHeight,
    hiddenOverflow: clockApp.scrollHeight - clockApp.clientHeight
  };

  const ov = document.createElement("div");
  ov.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:2147483647;pointer-events:none;" +
    "background:rgba(190,20,20,0.92);color:#fff;padding:12px 14px;" +
    "font:700 15px/1.45 -apple-system,sans-serif;white-space:pre-line;text-align:center;";
  document.body.appendChild(ov);
  const show = t => { ov.textContent = t; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  let moveCount = 0, maxTop = 0;
  document.addEventListener("touchmove", () => { moveCount++; }, { passive: true, capture: true });
  const sampler = setInterval(() => {
    if (el.scrollTop > maxTop) maxTop = el.scrollTop;
  }, 80);

  // 패널을 body로 이주/원복하는 도구
  const ph = document.createComment("fz-panel-home");
  let moved = false;
  const movePanelToBody = () => {
    if (moved) return;
    el.parentNode.insertBefore(ph, el);
    document.body.appendChild(el);
    el.style.position = "fixed";
    el.style.inset = "0";
    moved = true;
  };
  const movePanelBack = () => {
    if (!moved) return;
    ph.parentNode.insertBefore(el, ph);
    ph.remove();
    el.style.position = "";
    el.style.inset = "";
    moved = false;
  };

  const runPhase = async (name, apply, revert) => {
    moveCount = 0; maxTop = 0; el.scrollTop = 0;
    let applyErr = null;
    try { if (apply) apply(); } catch (e) { applyErr = String(e); }
    await sleep(500);
    const t0 = Date.now();
    while (moveCount === 0 && Date.now() - t0 < 30000) {
      show(name + "\n\n설정 화면에 손가락을 대고 위아래로\n문지르기 시작하면 측정 시작");
      await sleep(200);
    }
    const skipped = moveCount === 0;
    if (!skipped) {
      for (let s = 7; s > 0; s--) {
        show(name + "\n계속 문지르세요!\n남은 " + s + "초 · 스크롤 " + Math.round(maxTop) + "px · 터치 " + moveCount + "회");
        await sleep(1000);
      }
    }
    const rec = { name, max: Math.round(maxTop), touchmoves: moveCount, skipped, applyErr };
    results.phases.push(rec);
    try { if (revert) revert(); } catch (e) {}
    await sleep(300);
    return rec;
  };

  let winner = null;
  const check = rec => { if (rec.max > 30) winner = rec.name; };

  // 0) 기준선
  check(await runPhase("0) 기준선 (패널 제자리)", null, null));

  // 1) 본명 수술 후보 — 패널을 body 직속으로 이주
  if (!winner) check(await runPhase("1) 패널을 body로 이주",
    movePanelToBody, movePanelBack));

  // 2) 이주 + ezlong iframe 제거
  if (!winner && iframe) {
    let parent = iframe.parentNode, next = iframe.nextSibling;
    check(await runPhase("2) 이주 + iframe 제거",
      () => { movePanelToBody(); iframe.remove(); },
      () => { try { parent.insertBefore(iframe, next); } catch (e) {} movePanelBack(); }));
  }

  // 3) 이주 + pageTrack 숨김
  if (!winner && pageTrack) {
    check(await runPhase("3) 이주 + pageTrack 숨김",
      () => { movePanelToBody(); pageTrack.style.display = "none"; },
      () => { pageTrack.style.display = ""; movePanelBack(); }));
  }

  // 4) 제자리 + iframe 제거만
  if (!winner && iframe) {
    let parent = iframe.parentNode, next = iframe.nextSibling;
    check(await runPhase("4) 제자리 + iframe 제거만",
      () => iframe.remove(),
      () => { try { parent.insertBefore(iframe, next); } catch (e) {} }));
  }

  // 5) 제자리 + pageTrack 숨김만
  if (!winner && pageTrack) {
    check(await runPhase("5) 제자리 + pageTrack 숨김만",
      () => { pageTrack.style.display = "none"; },
      () => { pageTrack.style.display = ""; }));
  }

  results.verdict = winner ? "성공: " + winner : "전 단계 실패";

  clearInterval(sampler);
  ov.remove();

  const ok = !!winner;
  const rep = document.createElement("div");
  rep.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;background:rgba(8,12,20,0.97);color:#fff;" +
    "padding:max(50px, env(safe-area-inset-top)) 18px 30px;overflow:auto;" +
    "font:600 14px/1.6 -apple-system,sans-serif;";
  let html =
    '<div style="font-size:17px;font-weight:800;color:' + (ok ? "#5dff9d" : "#ff7b7b") + ';margin-bottom:10px;">진단 v5: ' + results.verdict + "</div>" +
    '<div style="opacity:0.85;margin-bottom:12px;">clock-app 숨은 overflow: ' + results.info.clockApp.hiddenOverflow +
    "px (전체 " + results.info.clockApp.scrollHeight + " / 보이는 " + results.info.clockApp.clientHeight + ")</div>";
  for (const p of results.phases) {
    const good = p.max > 30;
    html += '<div style="padding:6px 0;border-top:1px solid rgba(255,255,255,0.14);">' +
      '<span style="color:' + (good ? "#5dff9d" : "#ff9d9d") + ';font-weight:800;">' + (good ? "성공 " : (p.skipped ? "건너뜀 " : "실패 ")) + "</span>" +
      p.name + " — " + p.max + "px · 터치 " + p.touchmoves + "회" +
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

  try { console.log("[FZ-DIAG] FINAL v5", JSON.stringify(results, null, 2)); } catch (e) {}
})();
