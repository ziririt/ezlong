/* =====================================================================
   FlipZen 스크롤 버그 — 실기기 자동 진단 v3 (2026-07-18, Fable)

   v2 결과(아이폰 사파리 실측, 전 단계 터치 확보)로 확정된 것:
   - touch-action / -webkit-overflow-scrolling / overscroll-behavior를
     패널 서브트리 전체에서 제거해도 실패 → 요소 CSS 속성 계열 소거.
   - 완전히 새로 만든 내부 래퍼 div도 실패 → 요소 구조 계열 소거.
   - 코드 스크롤(scrollTop 대입)은 항상 완벽 동작.
   - 우리 JS 4개 파일에는 preventDefault 터치 리스너가 없음(정적 확인).

   v3가 답할 3가지 질문:
   Q1. 그래도 "누군가"(사파리 확장 등 포함) preventDefault를 하는가?
       → 이벤트의 defaultPrevented 플래그를 직접 센다.
   Q2. 터치 스크롤이 죽어있는 범위가 어디까지인가?
       → 앱과 무관한 새 스크롤 영역(클린룸)을 body 직속 / .clock-app 안 /
         설정 패널 안 3곳에 차례로 심어 이진탐색.
   Q3. 문서(루트) 스크롤러 자체는 터치로 움직이는가?
   + 보너스: html/body/.clock-app/pageTrack/패널의 실제 computed 스타일을
     결과 화면에 그대로 표시(기기에서만 보이는 값 확보).
   ===================================================================== */
(async () => {
  if (window.__fzDiagRunning) return;
  window.__fzDiagRunning = true;

  const results = { v: 3, startedAt: new Date().toString(), info: {}, phases: [] };
  const el = document.getElementById("quoteSettings");
  const clockApp = document.querySelector(".clock-app");
  if (!el || !clockApp) { alert("진단 실패: 필수 요소 없음"); return; }

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

  // ---------- 조상 체인 computed style 채집 (결과 화면에 표시) ----------
  const styleOf = n => {
    if (!n) return null;
    const cs = getComputedStyle(n);
    return {
      ta: cs.touchAction, ovf: cs.overflowY,
      osb: cs.overscrollBehaviorY || cs.overscrollBehavior || "-",
      wos: cs.webkitOverflowScrolling || "-",
      tf: cs.transform, wc: cs.willChange, persp: cs.perspective
    };
  };
  results.info.styles = {
    html: styleOf(document.documentElement),
    body: styleOf(document.body),
    clockApp: styleOf(clockApp),
    pageTrack: styleOf(document.getElementById("pageTrack") || document.querySelector(".page-track")),
    panel: styleOf(el)
  };
  el.scrollTop = 150;
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 300)));
  results.info.programmaticScroll = el.scrollTop;
  el.scrollTop = 0;

  // ---------- 관측 인프라 ----------
  let moveCount = 0, dpStart = 0, dpMove = 0, maxVal = 0, curGet = () => el.scrollTop;
  document.addEventListener("touchmove", e => {
    moveCount++;
    if (e.defaultPrevented) dpMove++;
  }, { passive: true }); // 버블 단계 — 앞서 누가 preventDefault 했는지 감지
  document.addEventListener("touchstart", e => {
    if (e.defaultPrevented) dpStart++;
  }, { passive: true });
  const sampler = setInterval(() => {
    try { const v = curGet(); if (v > maxVal) maxVal = v; } catch (e) {}
  }, 80);

  const addCss = css => {
    const s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
    return () => s.remove();
  };

  const makeCleanScroller = label => {
    const d = document.createElement("div");
    d.style.cssText =
      "position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483000;" +
      "background:#0d1f33;color:#fff;overflow-y:auto;";
    const inner = document.createElement("div");
    inner.style.cssText =
      "height:3000px;background:repeating-linear-gradient(#16324f, #16324f 120px, #1d436b 120px, #1d436b 240px);" +
      "padding:120px 20px 0;font:700 18px/1.5 -apple-system;text-align:center;";
    inner.textContent = label + " — 이 파란 화면을 위아래로 문지르세요";
    d.appendChild(inner);
    return d;
  };

  const runPhase = async (name, getter, apply, revert) => {
    moveCount = 0; dpStart = 0; dpMove = 0; maxVal = 0;
    curGet = getter || (() => el.scrollTop);
    el.scrollTop = 0;
    let applyErr = null;
    try { if (apply) apply(); } catch (e) { applyErr = String(e); }
    const t0 = Date.now();
    while (moveCount === 0 && Date.now() - t0 < 30000) {
      show(name + "\n\n화면에 손가락을 대고 위아래로\n문지르기 시작하면 측정이 시작됩니다");
      await sleep(200);
    }
    let skipped = moveCount === 0;
    if (!skipped) {
      for (let s = 7; s > 0; s--) {
        show(name + "\n계속 위아래로 문지르세요!\n남은 " + s + "초 · 스크롤 " + Math.round(maxVal) + "px · 터치 " + moveCount + "회");
        await sleep(1000);
      }
    }
    try { if (revert) revert(); } catch (e) {}
    const rec = { name, max: Math.round(maxVal), touchmoves: moveCount, dpStart, dpMove, skipped, applyErr };
    results.phases.push(rec);
    await sleep(400);
    return rec;
  };

  // ---------- 단계 실행 ----------

  // 0) 기준선 — preventDefault 감지 겸용
  await runPhase("0) 기준선 (설정 화면 그대로)", () => el.scrollTop, null, null);

  // 1) 클린룸 스크롤러 — body 직속
  { let d;
    await runPhase("1) 파란 테스트 화면 (body 직속)", () => (d ? d.scrollTop : 0),
      () => { d = makeCleanScroller("테스트 1"); document.body.appendChild(d); },
      () => d && d.remove()); }

  // 2) 클린룸 스크롤러 — .clock-app 안
  { let d;
    await runPhase("2) 파란 테스트 화면 (clock-app 안)", () => (d ? d.scrollTop : 0),
      () => { d = makeCleanScroller("테스트 2"); clockApp.appendChild(d); },
      () => d && d.remove()); }

  // 3) 클린룸 스크롤러 — 설정 패널 안
  { let d;
    await runPhase("3) 파란 테스트 화면 (설정 패널 안)", () => (d ? d.scrollTop : 0),
      () => { d = makeCleanScroller("테스트 3"); el.appendChild(d); },
      () => d && d.remove()); }

  // 4) 3D/컴포지팅 전면 무력화 + 원래 설정 화면
  { let rm;
    await runPhase("4) 3D·컴포지팅 전부 끄고 설정 화면", () => el.scrollTop,
      () => {
        rm = addCss(
          ".page-track, .sky-room, .flip-clock, .clock-app { will-change: auto !important; transition: none !important; transform: none !important; perspective: none !important; transform-style: flat !important; }"
        );
      },
      () => rm && rm()); }

  // 5) 문서(루트) 스크롤러 — 설정 닫고 body를 길게
  { let rm, closeBtn;
    await runPhase("5) 문서 자체 스크롤 (시계 화면을 문지르세요)",
      () => Math.max(window.scrollY || 0, window.pageYOffset || 0, document.documentElement.scrollTop || 0, (window.visualViewport && visualViewport.pageTop) || 0),
      () => {
        closeBtn = el.querySelector("[data-settings-close]");
        if (closeBtn) closeBtn.click(); else el.classList.remove("is-open");
        rm = addCss("body { min-height: 250vh !important; } .clock-app { overflow: visible !important; }");
      },
      () => { if (rm) rm(); window.scrollTo(0, 0); }); }

  // ---------- 판정 ----------
  const winners = results.phases.filter(p => p.max > 30);
  const totalDP = results.phases.reduce((a, p) => a + p.dpStart + p.dpMove, 0);
  results.verdict = winners.length
    ? "터치 스크롤 성공 위치: " + winners.map(p => p.name).join(" / ")
    : "전 위치에서 터치 스크롤 사망" + (totalDP > 0 ? " (preventDefault 감지됨!)" : " (preventDefault 없음)");

  clearInterval(sampler);
  ov.remove();

  // ---------- 결과 화면 ----------
  const ok = winners.length > 0;
  const rep = document.createElement("div");
  rep.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;background:rgba(8,12,20,0.97);color:#fff;" +
    "padding:max(46px, env(safe-area-inset-top)) 16px 30px;overflow:auto;" +
    "font:600 13px/1.55 -apple-system,sans-serif;";
  const st = results.info.styles;
  const fmt = (label, s) => s
    ? '<div style="opacity:0.8;">' + label + ": ta=" + s.ta + " · ovf=" + s.ovf + " · osb=" + s.osb +
      " · tf=" + (s.tf === "none" ? "none" : "있음") + " · wc=" + s.wc + " · persp=" + s.persp + "</div>"
    : "";
  let html =
    '<div style="font-size:16px;font-weight:800;color:' + (ok ? "#5dff9d" : "#ff7b7b") + ';margin-bottom:8px;">진단 v3: ' + results.verdict + "</div>" +
    '<div style="opacity:0.85;margin-bottom:8px;">코드 스크롤: 150px 지시 → ' + results.info.programmaticScroll + "px</div>";
  for (const p of results.phases) {
    const good = p.max > 30;
    html += '<div style="padding:5px 0;border-top:1px solid rgba(255,255,255,0.14);">' +
      '<span style="color:' + (good ? "#5dff9d" : "#ff9d9d") + ';font-weight:800;">' + (good ? "성공 " : (p.skipped ? "건너뜀 " : "실패 ")) + "</span>" +
      p.name + " — " + p.max + "px · 터치 " + p.touchmoves + "회 · PD(start/move) " + p.dpStart + "/" + p.dpMove +
      (p.applyErr ? '<div style="color:#ffb060;">오류: ' + p.applyErr + "</div>" : "") + "</div>";
  }
  html += '<div style="margin-top:10px;font-weight:800;">computed 스타일 (기기 실측):</div>' +
    fmt("html", st.html) + fmt("body", st.body) + fmt("clockApp", st.clockApp) +
    fmt("pageTrack", st.pageTrack) + fmt("panel", st.panel) +
    '<div style="margin-top:14px;opacity:0.75;">이 화면을 스크린샷(글자가 잘리면 위/아래 두 장)으로 찍어 Claude에게 보내주세요.</div>' +
    '<button id="fzDiagClose" style="margin-top:12px;width:100%;padding:14px;border:0;border-radius:12px;font:800 16px -apple-system;background:#2c7be5;color:#fff;">닫기</button>';
  rep.innerHTML = html;
  document.body.appendChild(rep);
  document.getElementById("fzDiagClose").addEventListener("click", () => {
    rep.remove();
    window.__fzDiagRunning = false;
  });

  try { console.log("[FZ-DIAG] FINAL v3", JSON.stringify(results, null, 2)); } catch (e) {}
})();
