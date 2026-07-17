/* =====================================================================
   FlipZen 스크롤 버그 — 실기기 자동 진단 v4 "절단 실험" (2026-07-18, Fable)

   확정된 사실 (v1~v3 + 격리 실험):
   - 이 앱 페이지에서는 내부 스크롤 영역이 무엇이든(새로 만든 것 포함)
     터치로 안 움직인다. 루트 문서 스크롤만 살아있다.
   - preventDefault 없음, CSS 정상, 코드 스크롤 정상.
   - 같은 기기·같은 사파리·같은 viewport의 무균실 페이지
     (scroll-test.html)에서는 내부 스크롤이 완벽 동작.
   → 결론: 이 페이지 안의 특정 요소가 페이지 전체의 터치 스크롤 인식을
     오염시킨다. 유력 용의자: transform:scale이 걸린 크로스오리진 iframe
     (.ezlong-frame, ezlong.com 전체를 2페이지에 상시 로드).

   v4: 클린 스크롤러(대조군)를 띄워두고 페이지 덩어리를 하나씩 제거하며
   어느 절단에서 스크롤이 살아나는지 이진탐색. 성공이 나오면 즉시 종료.
   ===================================================================== */
(async () => {
  if (window.__fzDiagRunning) return;
  window.__fzDiagRunning = true;

  const results = { v: 4, startedAt: new Date().toString(), phases: [] };
  const clockApp = document.querySelector(".clock-app");
  const pageTrack = document.getElementById("pageTrack") || document.querySelector(".page-track");
  const iframe = document.querySelector(".ezlong-frame");

  const ov = document.createElement("div");
  ov.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:2147483647;pointer-events:none;" +
    "background:rgba(190,20,20,0.92);color:#fff;padding:12px 14px;" +
    "font:700 15px/1.45 -apple-system,sans-serif;white-space:pre-line;text-align:center;";
  document.body.appendChild(ov);
  const show = t => { ov.textContent = t; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // 상시 떠 있는 클린 스크롤러 (대조군이자 측정 대상)
  const scroller = document.createElement("div");
  scroller.style.cssText =
    "position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483000;" +
    "background:#0d1f33;overflow-y:auto;";
  const content = document.createElement("div");
  content.style.cssText =
    "height:4000px;color:#fff;text-align:center;padding-top:240px;font:700 18px/1.5 -apple-system;" +
    "background:repeating-linear-gradient(#16324f, #16324f 120px, #1d436b 120px, #1d436b 240px);";
  content.textContent = "이 파란 화면을 계속 위아래로 문지르세요";
  scroller.appendChild(content);
  document.body.appendChild(scroller);

  let moveCount = 0, maxTop = 0;
  document.addEventListener("touchmove", () => { moveCount++; }, { passive: true, capture: true });
  const sampler = setInterval(() => {
    if (scroller.scrollTop > maxTop) maxTop = scroller.scrollTop;
  }, 80);

  const runPhase = async (name, apply, revert) => {
    moveCount = 0; maxTop = 0; scroller.scrollTop = 0;
    let applyErr = null;
    try { if (apply) apply(); } catch (e) { applyErr = String(e); }
    await sleep(600); // 제거가 네이티브 레이어에 반영될 시간
    const t0 = Date.now();
    while (moveCount === 0 && Date.now() - t0 < 30000) {
      show(name + "\n\n파란 화면을 위아래로\n문지르기 시작하면 측정 시작");
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

  // 0) 대조군 — 아무것도 안 자름 (v3에서 실패했던 그대로 재확인)
  {
    const rec = await runPhase("0) 대조군 (아무것도 안 자름)", null, null);
    if (rec.max > 30) winner = "대조군부터 성공?! (재현 실패)";
  }

  // 1) iframe(ezlong.com)만 제거
  if (!winner && iframe) {
    let parent = iframe.parentNode, next = iframe.nextSibling;
    const rec = await runPhase("1) ezlong iframe만 제거",
      () => iframe.remove(),
      () => { try { parent.insertBefore(iframe, next); } catch (e) {} });
    if (rec.max > 30) winner = rec.name;
  }

  // 2) pageTrack(시계+웹뷰 페이지 전체) 숨김
  if (!winner && pageTrack) {
    const rec = await runPhase("2) pageTrack 통째로 숨김",
      () => { pageTrack.style.display = "none"; },
      () => { pageTrack.style.display = ""; });
    if (rec.max > 30) winner = rec.name;
  }

  // 3) clock-app(앱 UI 전체) 숨김
  if (!winner && clockApp) {
    const rec = await runPhase("3) 앱 화면 전체 숨김",
      () => { clockApp.style.display = "none"; },
      () => { clockApp.style.display = ""; });
    if (rec.max > 30) winner = rec.name;
  }

  // 4) body의 모든 자식 숨김 (우리 도구 제외)
  if (!winner) {
    const hidden = [];
    const rec = await runPhase("4) 페이지의 모든 요소 숨김",
      () => {
        [...document.body.children].forEach(n => {
          if (n === ov || n === scroller) return;
          if (n.style && n.style.display !== "none") { hidden.push([n, n.style.display]); n.style.display = "none"; }
        });
      },
      () => { hidden.forEach(([n, d]) => { n.style.display = d; }); });
    if (rec.max > 30) winner = rec.name;
  }

  results.verdict = winner ? "스크롤 부활 지점: " + winner : "모든 절단에도 실패";

  clearInterval(sampler);
  ov.remove();
  scroller.remove();

  const ok = !!winner;
  const rep = document.createElement("div");
  rep.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;background:rgba(8,12,20,0.97);color:#fff;" +
    "padding:max(50px, env(safe-area-inset-top)) 18px 30px;overflow:auto;" +
    "font:600 14px/1.6 -apple-system,sans-serif;";
  let html =
    '<div style="font-size:17px;font-weight:800;color:' + (ok ? "#5dff9d" : "#ff7b7b") + ';margin-bottom:10px;">진단 v4: ' + results.verdict + "</div>";
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

  try { console.log("[FZ-DIAG] FINAL v4", JSON.stringify(results, null, 2)); } catch (e) {}
})();
