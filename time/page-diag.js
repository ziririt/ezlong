/* =====================================================================
   FlipZen — 페이지2(ezlong iframe) 스크롤 자가보고식 진단 (2026-07-20, Fable)

   발동: index.html 로더가 ?pagediag=1 일 때만 로드 (일반 방문자 노출 없음).
   iframe은 크로스오리진이라 부모에서 scrollTop을 읽을 수 없으므로,
   유저가 문지른 뒤 화면 상단 [움직인다]/[안 움직인다] 버튼으로 답하는
   방식으로 진행한다. 후보 처방 2개를 순서대로 임시 적용:

   1단계: 기준선 (아무 수정 없음)
   2단계: "정지 상태 커밋" — pageTrack transform/will-change 제거 +
          시계 화면(display:none) 숨김 → 조상의 상시 transform과
          숨은 overflow를 동시에 제거 (스크롤 사건 범인 1·2의 조합 검증)
   3단계: "완전 이주" — ezlong 섹션을 body 직속 fixed로 재부착
          (iframe이 다시 로드되므로 몇 초 대기 필요)

   성공이 나오면 즉시 종료. 모든 조작은 새로고침하면 사라진다.
   ===================================================================== */
(async () => {
  if (window.__fzPageDiag) return;
  window.__fzPageDiag = true;

  const pageTrack = document.getElementById("pageTrack") || document.querySelector(".page-track");
  const skyRoom = document.querySelector(".sky-room");
  const ezlong = document.querySelector(".ezlong-webview");
  const iframe = document.querySelector(".ezlong-frame");
  if (!pageTrack || !skyRoom || !ezlong) { alert("진단 실패: 요소 없음"); return; }

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const results = [];

  // ---------- UI: 상단 배너 + 응답 버튼 ----------
  const ui = document.createElement("div");
  ui.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:2147483647;" +
    "background:rgba(190,20,20,0.94);color:#fff;padding:10px 12px 12px;" +
    "font:700 15px/1.45 -apple-system,sans-serif;text-align:center;";
  ui.innerHTML =
    '<div id="fzMsg" style="white-space:pre-line;margin-bottom:8px;">준비 중…</div>' +
    '<div id="fzBtns" style="display:none;gap:10px;justify-content:center;">' +
    '<button id="fzYes" style="flex:1;max-width:170px;padding:12px;border:0;border-radius:10px;font:800 15px -apple-system;background:#1f9d55;color:#fff;">움직인다</button>' +
    '<button id="fzNo" style="flex:1;max-width:170px;padding:12px;border:0;border-radius:10px;font:800 15px -apple-system;background:#333;color:#fff;">안 움직인다</button>' +
    "</div>";
  document.body.appendChild(ui);
  const msg = ui.querySelector("#fzMsg");
  const btns = ui.querySelector("#fzBtns");
  btns.style.display = "none";

  const ask = text => new Promise(resolve => {
    msg.textContent = text;
    btns.style.display = "flex";
    const yes = ui.querySelector("#fzYes");
    const no = ui.querySelector("#fzNo");
    const done = v => { btns.style.display = "none"; yes.onclick = no.onclick = null; resolve(v); };
    yes.onclick = () => done(true);
    no.onclick = () => done(false);
  });

  // ---------- 페이지 2로 이동 ----------
  msg.textContent = "ezlong 페이지로 이동 중…";
  try { if (typeof goToPage === "function") goToPage(1); } catch (e) {}
  await sleep(900);

  // ---------- 1단계: 기준선 ----------
  const base = await ask("1단계 (기준선)\nezlong 페이지를 위아래로 문질러보세요.\n화면이 스크롤됩니까?");
  results.push(["1) 기준선", base]);

  let winner = base ? "1) 기준선(버그 재현 안 됨?)" : null;

  // ---------- 2단계: 정지 상태 커밋 ----------
  let p1 = null;
  if (!winner) {
    p1 = {
      transition: pageTrack.style.transition,
      transform: pageTrack.style.transform,
      willChange: pageTrack.style.willChange,
      sky: skyRoom.style.display
    };
    pageTrack.style.transition = "none";
    pageTrack.style.transform = "none";
    pageTrack.style.willChange = "auto";
    skyRoom.style.display = "none";
    await sleep(700);
    const ok = await ask("2단계 (정지 상태 커밋)\n다시 위아래로 문질러보세요.\n이제 스크롤됩니까?");
    results.push(["2) 정지 상태 커밋", ok]);
    if (ok) winner = "2) 정지 상태 커밋";
  }

  // ---------- 3단계: 완전 이주 ----------
  if (!winner) {
    // 2단계 상태 원복
    skyRoom.style.display = p1.sky;
    pageTrack.style.willChange = p1.willChange;
    pageTrack.style.transform = p1.transform;
    void pageTrack.offsetHeight;
    pageTrack.style.transition = p1.transition;

    const ph = document.createComment("fz-ezlong-home");
    ezlong.parentNode.insertBefore(ph, ezlong);
    document.body.appendChild(ezlong);
    ezlong.style.position = "fixed";
    ezlong.style.inset = "0";
    ezlong.style.zIndex = "40";
    msg.textContent = "3단계 준비 중 — ezlong을 다시 불러오는 중입니다.\n화면에 ezlong이 다시 보일 때까지 기다려주세요…";
    // iframe이 재로드된다 — load 이벤트 또는 최대 10초 대기
    await new Promise(resolve => {
      let settled = false;
      const finish = () => { if (!settled) { settled = true; resolve(); } };
      if (iframe) iframe.addEventListener("load", () => setTimeout(finish, 800), { once: true });
      setTimeout(finish, 10000);
    });
    const ok = await ask("3단계 (완전 이주)\nezlong 페이지를 위아래로 문질러보세요.\n이제 스크롤됩니까?");
    results.push(["3) 완전 이주(body 직속)", ok]);
    if (ok) winner = "3) 완전 이주(body 직속)";
  }

  // ---------- 결과 ----------
  ui.style.background = winner && !winner.startsWith("1)") ? "rgba(20,140,60,0.94)" : (winner ? "rgba(180,120,20,0.94)" : "rgba(190,20,20,0.94)");
  msg.textContent =
    (winner ? "결론: " + winner + " 에서 스크롤 성공" : "결론: 전 단계 실패") +
    "\n\n" + results.map(r => (r[1] ? "성공 " : "실패 ") + r[0]).join("\n") +
    "\n\n이 화면을 스크린샷으로 찍어 Claude에게 보내주세요.\n(새로고침하면 원래 상태로 돌아갑니다)";
  try { console.log("[FZ-PAGEDIAG]", JSON.stringify(results)); } catch (e) {}
})();
