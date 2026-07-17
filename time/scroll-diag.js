/* =====================================================================
   FlipZen 스크롤 버그 — 실기기 자동 진단 v6 "방향별 계측" (2026-07-18, Fable)

   15차 수술(패널 body 이주) 후 스크롤이 부분 동작하기 시작했으나
   "한 방향만 되는 것 같다"는 증상 — 어느 방향이 얼마나 움직이는지
   손가락 제스처 단위로 자동 집계한다.

   측정 항목:
   - 패널 scrollHeight/clientHeight (넘침이 실재하는지)
   - 손가락 위로 쓸기(콘텐츠 아래로 파고들기): 횟수, 스크롤 변화량
   - 손가락 아래로 쓸기(위로 되돌아오기): 횟수, 스크롤 변화량
   - 제스처별 상세 기록 (최근 10개)
   ===================================================================== */
(async () => {
  if (window.__fzDiagRunning) return;
  window.__fzDiagRunning = true;

  const el = document.getElementById("quoteSettings");
  if (!el) { alert("진단 실패: #quoteSettings 없음"); return; }

  if (!el.classList.contains("is-open")) {
    const btn = document.getElementById("settingsOpen");
    if (btn) btn.click(); else el.classList.add("is-open");
    await new Promise(r => setTimeout(r, 700));
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const ov = document.createElement("div");
  ov.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:2147483647;pointer-events:none;" +
    "background:rgba(190,20,20,0.92);color:#fff;padding:12px 14px;" +
    "font:700 15px/1.45 -apple-system,sans-serif;white-space:pre-line;text-align:center;";
  document.body.appendChild(ov);
  const show = t => { ov.textContent = t; };

  const metrics = { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
  const gestures = [];
  let curY = null, startY = null, startTop = null;

  document.addEventListener("touchstart", e => {
    if (!e.touches[0]) return;
    startY = curY = e.touches[0].clientY;
    startTop = el.scrollTop;
  }, { passive: true, capture: true });
  document.addEventListener("touchmove", e => {
    if (e.touches[0]) curY = e.touches[0].clientY;
  }, { passive: true, capture: true });
  document.addEventListener("touchend", () => {
    if (startY === null || curY === null) return;
    const dy = curY - startY;               // 손가락 이동 (+ = 아래로 쓸기)
    const dScroll = el.scrollTop - startTop; // 스크롤 변화 (+ = 깊이 들어감)
    if (Math.abs(dy) > 25) {
      gestures.push({ finger: dy < 0 ? "위로쓸기" : "아래로쓸기", dy: Math.round(dy), dScroll: Math.round(dScroll), endTop: Math.round(el.scrollTop) });
    }
    startY = null;
  }, { passive: true, capture: true });

  // 25초 자유 스크롤 계측
  for (let s = 25; s > 0; s--) {
    show("설정 화면을 자유롭게 위아래로\n스크롤해 보세요 (남은 " + s + "초)\n" +
      "지금 위치 " + Math.round(el.scrollTop) + "px · 제스처 " + gestures.length + "회");
    await sleep(1000);
  }

  const up = gestures.filter(g => g.finger === "위로쓸기");
  const down = gestures.filter(g => g.finger === "아래로쓸기");
  const sum = a => a.reduce((x, g) => x + g.dScroll, 0);
  const fmtG = a => a.length
    ? a.length + "회 · 스크롤 합계 " + sum(a) + "px · 최대 " + Math.max(...a.map(g => Math.abs(g.dScroll))) + "px"
    : "0회";

  ov.remove();
  const rep = document.createElement("div");
  rep.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;background:rgba(8,12,20,0.97);color:#fff;" +
    "padding:max(50px, env(safe-area-inset-top)) 18px 30px;overflow:auto;" +
    "font:600 14px/1.6 -apple-system,sans-serif;";
  let html =
    '<div style="font-size:17px;font-weight:800;color:#7bc4ff;margin-bottom:10px;">진단 v6: 방향별 계측 결과</div>' +
    '<div style="opacity:0.85;">환경: ' + (/[?&]native=ios/.test(location.search) ? "앱(WKWebView)" : "브라우저") + "</div>" +
    '<div style="opacity:0.85;margin-bottom:10px;">콘텐츠 ' + metrics.scrollHeight + "px / 화면 " + metrics.clientHeight +
    "px → 스크롤 가능 범위 " + Math.max(0, metrics.scrollHeight - metrics.clientHeight) + "px</div>" +
    '<div style="padding:8px 0;border-top:1px solid rgba(255,255,255,0.2);font-weight:800;">손가락 위로 쓸기 (아래 내용 보기): <span style="color:#5dff9d">' + fmtG(up) + "</span></div>" +
    '<div style="padding:8px 0;border-top:1px solid rgba(255,255,255,0.2);font-weight:800;">손가락 아래로 쓸기 (위로 되돌아오기): <span style="color:#ffb060">' + fmtG(down) + "</span></div>" +
    '<div style="margin-top:10px;font-weight:800;">최근 제스처 상세 (손가락px → 스크롤px, 끝 위치):</div>';
  for (const g of gestures.slice(-10)) {
    html += '<div style="opacity:0.85;padding:2px 0;">' + g.finger + " " + g.dy + "px → 스크롤 " + g.dScroll + "px (위치 " + g.endTop + ")</div>";
  }
  html += '<div style="margin-top:16px;opacity:0.75;">이 화면을 스크린샷으로 찍어 Claude에게 보내주세요.</div>' +
    '<button id="fzDiagClose" style="margin-top:14px;width:100%;padding:14px;border:0;border-radius:12px;font:800 16px -apple-system;background:#2c7be5;color:#fff;">닫기</button>';
  rep.innerHTML = html;
  document.body.appendChild(rep);
  document.getElementById("fzDiagClose").addEventListener("click", () => {
    rep.remove();
    window.__fzDiagRunning = false;
  });

  try { console.log("[FZ-DIAG] FINAL v6", JSON.stringify({ metrics, gestures }, null, 2)); } catch (e) {}
})();
