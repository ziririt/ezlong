/* =====================================================================
   FlipZen 스크롤 버그 — 실기기 자동 진단 (2026-07-18, Fable)

   이 파일은 평소에는 절대 로드되지 않는다. index.html의 로더가
   (a) 주소에 ?scrolldiag=1 이 있을 때, 또는 (b) 화면 하단 ver 라벨을
   3초 안에 5번 연속 탭했을 때만 이 파일을 불러온다.

   실행되면 설정 화면을 자동으로 열고, 화면 상단 배너의 지시대로
   유저가 단계마다 위아래로 스와이프하는 동안 어떤 CSS/DOM 처방이
   스크롤을 살리는지 자동 측정한다. 모든 조작은 단계 종료 시 원상복구
   되며, 새로고침하면 완전히 사라진다. 결과는 화면에 표로 표시된다
   (콘솔 없이 스크린샷만으로 전달 가능).
   ===================================================================== */
(async () => {
  if (window.__fzDiagRunning) return;
  window.__fzDiagRunning = true;

  const results = { startedAt: new Date().toString(), info: {}, phases: [] };
  const el = document.getElementById("quoteSettings");
  if (!el) { alert("진단 실패: #quoteSettings 없음"); return; }

  // ---------- 설정 화면 열기 ----------
  if (!el.classList.contains("is-open")) {
    const btn = document.getElementById("settingsOpen");
    if (btn) btn.click(); else el.classList.add("is-open");
    await new Promise(r => setTimeout(r, 700));
  }

  // ---------- 안내 배너 ----------
  const ov = document.createElement("div");
  ov.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:2147483647;pointer-events:none;" +
    "background:rgba(190,20,20,0.92);color:#fff;padding:12px 14px;" +
    "font:700 15px/1.45 -apple-system,sans-serif;white-space:pre-line;text-align:center;";
  document.body.appendChild(ov);
  const show = t => { ov.textContent = t; };
  show("진단 준비 중…");

  const ident = n => {
    if (!n || !n.tagName) return String(n);
    const cls = typeof n.className === "string" && n.className.trim()
      ? "." + n.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    return n.tagName + (n.id ? "#" + n.id : "") + cls;
  };

  // ---------- 정적 진단 ----------
  results.info.metrics = {
    scrollHeight: el.scrollHeight, clientHeight: el.clientHeight
  };
  const cx = Math.floor(innerWidth / 2), cy = Math.floor(innerHeight / 2);
  const hit = document.elementFromPoint(cx, cy);
  results.info.hitTest = { hit: ident(hit), insidePanel: !!(hit && (hit === el || el.contains(hit))) };
  results.info.isNativeApp = /[?&]native=ios/.test(location.search);

  // ---------- 프로그램적 스크롤 생존 테스트 ----------
  el.scrollTop = 150;
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 400)));
  results.info.programmaticScroll = el.scrollTop; // 150 근처면 정상
  el.scrollTop = 0;

  // ---------- 관측 인프라 ----------
  let curScroller = el;
  let moveCount = 0, maxTop = 0, scrollEvents = 0, touchTargets = new Set();
  const onTS = e => { touchTargets.add(ident(e.target)); };
  const onTM = () => { moveCount++; };
  const onSC = () => { scrollEvents++; };
  document.addEventListener("touchstart", onTS, { passive: true, capture: true });
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

  const runPhase = async (name, secs, apply, revert) => {
    moveCount = 0; maxTop = 0; scrollEvents = 0; touchTargets = new Set();
    curScroller = el;
    el.scrollTop = 0;
    let applyErr = null;
    try { if (apply) { const ret = apply(); if (ret && ret.scroller) curScroller = ret.scroller; } }
    catch (e) { applyErr = String(e); }
    curScroller.addEventListener("scroll", onSC, { passive: true });
    for (let s = secs; s > 0; s--) {
      show(name + "\n지금 화면을 위아래로 계속 스와이프!\n남은 " + s + "초 · 스크롤 " + Math.round(maxTop) + "px · 터치 " + moveCount + "회");
      await new Promise(r => setTimeout(r, 1000));
    }
    curScroller.removeEventListener("scroll", onSC);
    try { if (revert) revert(); } catch (e) {}
    const rec = { name, maxScrollTop: Math.round(maxTop), touchmoves: moveCount, scrollEvents, touchTargets: [...touchTargets].slice(0, 4), applyErr };
    results.phases.push(rec);
    return rec;
  };

  // ---------- 단계 실행 ----------
  const baseline = await runPhase("0) 기준선 (수정 없음)", 8, null, null);

  if (baseline.maxScrollTop > 60) {
    // 이 환경에서는 버그 자체가 재현되지 않음 → 나머지 단계 생략
    results.verdict = "이 환경에서는 스크롤이 정상 (버그 미재현)";
  } else {
    let rm;
    await runPhase("1) touch-action·overscroll 해제", 9,
      () => { rm = addCss("#quoteSettings, #quoteSettings * { touch-action: auto !important; overscroll-behavior: auto !important; -webkit-overflow-scrolling: auto !important; }"); },
      () => rm && rm());

    await runPhase("2) 스크롤러 재등록 (reflow)", 9,
      () => {
        el.style.overflowY = "hidden"; void el.offsetHeight;
        el.style.overflowY = "auto"; void el.scrollHeight;
      },
      () => { el.style.overflowY = ""; });

    let wrap;
    await runPhase("3) 내부 래퍼 스크롤러 분리", 10,
      () => {
        wrap = document.createElement("div");
        wrap.style.cssText = "height:100%;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;";
        while (el.firstChild) wrap.appendChild(el.firstChild);
        el.appendChild(wrap);
        el.style.overflow = "hidden";
        return { scroller: wrap };
      },
      () => {
        while (wrap.firstChild) el.appendChild(wrap.firstChild);
        wrap.remove(); el.style.overflow = "";
      });

    let rm4;
    await runPhase("4) position:fixed 전환", 9,
      () => { rm4 = addCss("#quoteSettings.is-open { position: fixed !important; inset: 0 !important; }"); },
      () => rm4 && rm4());

    let rm5;
    await runPhase("5) pageTrack 컴포지팅 해제", 9,
      () => { rm5 = addCss(".page-track { will-change: auto !important; transition: none !important; }"); },
      () => rm5 && rm5());

    let rm6;
    await runPhase("6) 문서에 스크롤 여지 부여", 9,
      () => { rm6 = addCss("body { min-height: 100.7vh !important; }"); },
      () => rm6 && rm6());

    const winners = results.phases.filter(p => p.maxScrollTop > 30);
    results.verdict = winners.length
      ? "성공 처방: " + winners.map(p => p.name).join(" / ")
      : "전 단계 실패";
  }

  // ---------- 마무리 ----------
  clearInterval(sampler);
  document.removeEventListener("touchstart", onTS, { capture: true });
  document.removeEventListener("touchmove", onTM, { capture: true });
  ov.remove();

  // ---------- 화면 결과 리포트 (스크린샷으로 전달 가능) ----------
  const ok = /성공|정상/.test(results.verdict);
  const rep = document.createElement("div");
  rep.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;background:rgba(8,12,20,0.97);color:#fff;" +
    "padding:max(50px, env(safe-area-inset-top)) 18px 30px;overflow:auto;" +
    "font:600 14px/1.6 -apple-system,sans-serif;-webkit-overflow-scrolling:touch;";
  let html =
    '<div style="font-size:17px;font-weight:800;color:' + (ok ? "#5dff9d" : "#ff7b7b") + ';margin-bottom:10px;">진단 결과: ' + results.verdict + "</div>" +
    '<div style="opacity:0.85;margin-bottom:4px;">환경: ' + (results.info.isNativeApp ? "앱(WKWebView)" : "브라우저") +
    " · 콘텐츠 " + results.info.metrics.scrollHeight + "px / 화면 " + results.info.metrics.clientHeight + "px</div>" +
    '<div style="opacity:0.85;margin-bottom:4px;">코드 스크롤 명령(150px 지시): ' + results.info.programmaticScroll + "px 반영</div>" +
    '<div style="opacity:0.85;margin-bottom:12px;">화면 중앙 터치 대상: ' + results.info.hitTest.hit + (results.info.hitTest.insidePanel ? " (설정화면 내부 O)" : " (설정화면 내부 X ← 문제!)") + "</div>";
  for (const p of results.phases) {
    const good = p.maxScrollTop > 30;
    html += '<div style="padding:6px 0;border-top:1px solid rgba(255,255,255,0.14);">' +
      '<span style="color:' + (good ? "#5dff9d" : "#ff9d9d") + ';font-weight:800;">' + (good ? "성공 " : "실패 ") + "</span>" +
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

  try { console.log("[FZ-DIAG] FINAL", JSON.stringify(results, null, 2)); } catch (e) {}
})();
