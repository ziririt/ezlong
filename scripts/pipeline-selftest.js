#!/usr/bin/env node
/* 파이프라인 실패 처리 단위 시험 — "실패를 실패라고 말하는가"를 본다.
   실행: node scripts/pipeline-selftest.js

   배경(2026-09-13 점검): 세 곳이 같은 병을 앓고 있었다.
     · market-cycle    데이터 전멸에도 초록 '정상: SMA 위'
     · 차트분석        생성 실패로 옛 분석을 보존하면서 시각만 새로 찍음
     · 모델 포트폴리오  종목 수집 실패인데 문서 기준일은 최신
   재료가 없는 것과 시장이 건강한 것은 다르다. 그 구분이 코드에 있는지 본다.

   generate-chart-analysis.js 는 통째로 require 하면 네트워크를 타므로,
   ezguard-selftest.js 와 같은 방식으로 함수만 잘라 와 돌린다(재구현 금지). */
'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const vm   = require('vm');

const ROOT = path.join(__dirname, '..');
let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? '  — ' + d : ''));

function cutFunction(src, name) {
  const a = src.search(new RegExp('function\\s+' + name + '\\s*\\('));
  if (a < 0) throw new Error('함수를 찾지 못했다: ' + name);
  let depth = 0;
  for (let j = src.indexOf('{', a); j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(a, j + 1); }
  }
  throw new Error('함수 끝을 찾지 못했다: ' + name);
}

/* ── 1) pickAnalysis — 보존 시 '분석 시각'이 옛것으로 남는가 ────────── */
console.log('\n[1] 차트분석: 시세 시각과 분석 시각 분리');
{
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'generate-chart-analysis.js'), 'utf8');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ezpipe-'));
  const ctx = {
    DATA_DIR: tmp, fs, path, console: { warn() {}, log() {} },
    round: (v, d) => v == null ? null : Number(v.toFixed(d)),
    Math, Number, JSON, Date,
  };
  vm.createContext(ctx);
  vm.runInContext(cutFunction(src, 'pickAnalysis'), ctx);

  const NOW = '2026-09-13T00:00:00.000Z';
  const OLD = '2026-06-03T12:00:00.000Z';
  const swing = { support: 100, resistance: 200 };

  // (1) 생성 성공 -> 새 분석, 시각은 지금
  {
    const r = ctx.pickAnalysis({ narrative: '새 분석', action: '매수' }, 'TSLA', 'TSLA', swing, NOW);
    ok('성공: 새 분석을 쓴다', r.analysis.narrative === '새 분석');
    ok('성공: 분석 시각은 지금', r.at === NOW, r.at);
    ok('성공: 보존 표시 없음', r.preserved === false);
  }

  // (2) 실패 + 기존 분석 있음 -> 보존, 시각도 옛것 그대로  ← 이번 수정의 핵심
  {
    fs.writeFileSync(path.join(tmp, 'analysis-TSLA.json'), JSON.stringify({
      updatedAt: OLD, analysisAt: OLD,
      analysis: { narrative: '6월에 만들어 둔 분석 문장이다. 보존 문턱인 30자를 넉넉히 넘기도록 길게 쓴다.', action: '관망' },
    }));
    const r = ctx.pickAnalysis(null, 'TSLA', 'TSLA', swing, NOW);
    ok('실패: 기존 분석을 보존한다', r.analysis.narrative.startsWith('6월에 만들어 둔'));
    ok('실패: 분석 시각이 옛것으로 남는다 (핵심)', r.at === OLD, `얻은 값 ${r.at} / 기대 ${OLD}`);
    ok('실패: 보존 표시가 붙는다', r.preserved === true);
  }

  // (3) analysisAt 이 없는 옛 산출물 -> updatedAt 으로 대신한다
  {
    fs.writeFileSync(path.join(tmp, 'analysis-OLDFMT.json'), JSON.stringify({
      updatedAt: OLD,
      analysis: { narrative: '이 필드를 도입하기 전에 만들어진 분석 문장이다. 보존 문턱인 30자를 넉넉히 넘긴다.', action: '관망' },
    }));
    const r = ctx.pickAnalysis(null, 'OLDFMT', 'OLDFMT', swing, NOW);
    ok('옛 산출물: updatedAt 을 분석 시각으로 쓴다', r.at === OLD, r.at);
  }

  // (4) 실패 + 기존도 없음 -> 폴백, 시각은 지금
  {
    const r = ctx.pickAnalysis(null, 'NOFILE', 'NOFILE', swing, NOW);
    ok('폴백: 플레이스홀더 문구', r.analysis.narrative.includes('불러오는 중'));
    ok('폴백: 분석 시각은 지금', r.at === NOW);
    ok('폴백: 지지/저항은 스윙 레벨로 채운다', r.analysis.support === 100 && r.analysis.resistance === 200);
  }

  // (5) 플레이스홀더는 보존 대상이 아니다 (덮어써야 한다)
  {
    fs.writeFileSync(path.join(tmp, 'analysis-PH.json'), JSON.stringify({
      updatedAt: OLD, analysisAt: OLD,
      analysis: { narrative: 'AI 분석 데이터를 불러오는 중입니다.' },
    }));
    const r = ctx.pickAnalysis(null, 'PH', 'PH', swing, NOW);
    ok('플레이스홀더는 보존하지 않는다', r.preserved === false && r.at === NOW);
  }

  fs.rmSync(tmp, { recursive: true, force: true });

  // 산출물에 실제로 필드가 실리는지 (소스 수준 확인)
  ok('analysisOut 에 analysisAt 이 실린다', /analysisAt:\s*picked\.at/.test(src));
  ok('analysisOut 에 보존 표시가 실린다', /analysisPreserved:\s*picked\.preserved/.test(src));
  ok('updatedAt 은 여전히 파일 기록 시각', /updatedAt:\s*nowISO/.test(src));
}

/* ── 2) 화면이 분석 시각을 읽는가 ──────────────────────────────────── */
console.log('[2] 차트분석 화면: 두 시각을 나눠 말하는가');
{
  const html = fs.readFileSync(path.join(ROOT, 'chart-analysis.html'), 'utf8');
  const ctx = { Date, Math, fmtKST: iso => iso.slice(0, 16).replace('T', ' ') };
  vm.createContext(ctx);
  vm.runInContext(cutFunction(html, 'updatedLine'), ctx);

  const same = ctx.updatedLine({ updatedAt: '2026-09-13T00:00:00.000Z', analysisAt: '2026-09-13T00:00:00.000Z' });
  ok('같은 날이면 시세 기준만 말한다', !same.includes('AI 분석:'), same);

  const gap = ctx.updatedLine({ updatedAt: '2026-09-13T00:00:00.000Z', analysisAt: '2026-06-03T00:00:00.000Z' });
  ok('시각이 벌어지면 분석 시각을 따로 말한다', gap.includes('AI 분석:'), gap);
  ok('며칠 전 판단인지 숫자로 말한다', /\d+일 전 판단/.test(gap), gap);

  const legacy = ctx.updatedLine({ updatedAt: '2026-09-13T00:00:00.000Z' });   // analysisAt 없음
  ok('옛 산출물에서도 깨지지 않는다', legacy.startsWith('시세 기준:'), legacy);

  ok('화면이 updatedLine 을 쓴다', /\$\{updatedLine\(analysis\)\}/.test(html));
}

/* ── 3) market-cycle: 실패를 정상으로 읽던 자리 ────────────────────── */
console.log('[3] market-cycle: 판정불가 상태');
{
  const html = fs.readFileSync(path.join(ROOT, 'market-cycle.html'), 'utf8');

  ok('allAbove=true 로 시작하던 코드가 사라졌다', !/let allAbove = true/.test(html));
  ok('성공 종목 수를 센다', /let okCount = 0, aboveCount = 0/.test(html));
  ok('판정 불가 배지가 있다', /판정 불가: 데이터 없음/.test(html));
  ok('접속 시각을 그대로 찍지 않는다', !/const kst = new Date\(Date\.now\(\) \+ 9 \* 3600 \* 1000\);\n  const p = n/.test(html));
  ok('데이터 기준시각을 모은다', /const dataStamps = \[\]/.test(html));
  ok('마지막 주봉 날짜를 말한다', /마지막 주봉/.test(html));
  ok('갱신 지연 경고가 있다', /갱신 지연/.test(html));

  // commentSma 가드 — 실제로 호출해 본다
  const ctx = { Math, Number };
  vm.createContext(ctx);
  vm.runInContext(cutFunction(html, 'commentSma'), ctx);

  const none = ctx.commentSma([null, null, null]);
  ok('전멸: "3개 지수 모두" 문장이 나오지 않는다', !none.includes('3개 지수 모두'), none.slice(0, 60));
  ok('전멸: 재료가 없다고 말한다', /받지 못했|판정할 재료/.test(none), none.slice(0, 60));

  const partial = ctx.commentSma([{ sym: 'SPY', pct: 3.1 }, null, null]);
  ok('일부: 몇 개만 들어왔다고 말한다', /1개만 데이터가 들어왔/.test(partial), partial.slice(0, 60));

  const all = ctx.commentSma([{ sym: 'SPY', pct: 3 }, { sym: 'QQQ', pct: 4 }, { sym: 'SOXX', pct: 5 }]);
  ok('정상: 전부 있으면 원래 문장이 나온다', all.includes('3개 지수 모두'), all.slice(0, 60));

  // 브레드스 날짜 정렬
  ok('브레드스가 공통 주봉을 찾는다', /const spyByT = new Map/.test(html));
  ok('공통 주봉이 없으면 판정하지 않는다', /공통 주봉 부족/.test(html));
}

/* ── 4) 모델 포트폴리오: 종목별 기준일 ─────────────────────────────── */
console.log('[4] 모델 포트폴리오: 종목별 기준일');
{
  const py   = fs.readFileSync(path.join(ROOT, 'scripts', 'fetch-model-portfolio.py'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'model-portfolio.html'), 'utf8');

  ok('성공한 종목에만 asOf 를 찍는다', /h\['asOf'\] = NOW_KST\.strftime/.test(py));
  ok('기준일이 뒤처진 종목을 로그로 남긴다', /기준일 뒤처진 종목/.test(py));
  ok('NOW_KST 를 한 번만 정한다', /NOW_KST = datetime\.now\(KST\)/.test(py));

  ok('화면이 종목별 기준일을 읽는다', /function lagDays\(h\)/.test(html));
  ok('지연 표시를 붙인다', /lagNote\(h\)/.test(html));
  ok('지연 배지 글자가 14px 이상', /\.lag \{[^}]*font-size:14px/.test(html));

  // lagDays 를 실제로 돌려 본다
  const ctx = { Date, Math, isNaN, D: { generatedAt: '2026-09-13T00:00:00Z' } };
  vm.createContext(ctx);
  vm.runInContext(cutFunction(html, 'lagDays') + '\n' + cutFunction(html, 'lagNote'), ctx);

  ok('같은 날이면 지연 없음', ctx.lagNote({ asOf: '2026-09-13' }) === '');
  ok('이틀 차이는 표시하지 않는다 (주간 파이프라인)', ctx.lagNote({ asOf: '2026-09-11' }) === '');
  ok('사흘부터 표시한다', /3일 전 값/.test(ctx.lagNote({ asOf: '2026-09-10' })), ctx.lagNote({ asOf: '2026-09-10' }));
  ok('asOf 가 없으면 조용히 넘어간다', ctx.lagNote({}) === '');
  ok('망가진 날짜에도 죽지 않는다', ctx.lagNote({ asOf: 'not-a-date' }) === '');
}

/* ── 5) 매매 레벨 검문 (배치 04) ───────────────────────────────────── */
console.log('[5] 차트분석: 매매 레벨 실행가능성 검문');
{
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'generate-chart-analysis.js'), 'utf8');
  const ctx = { Math, Number, isFinite, console: { warn() {} },
                round: (v, d) => v == null ? null : Number(v.toFixed(d)) };
  vm.createContext(ctx);
  vm.runInContext(
    src.slice(src.indexOf('function priceDecimals'), src.indexOf('function validateTradeLevels'))
    + '\n' + cutFunction(src, 'validateTradeLevels')
    + '\n' + cutFunction(src, 'deriveDisplayTargets'), ctx);

  const swing = { support: 95, resistance: 115 }, pivot = { s1: 97, r1: 112 };

  // 쓸 만한 레벨은 손대지 않는다
  {
    const r = ctx.validateTradeLevels(
      { action: '매수', entry: 100, stop: 96, target: 110 }, 100, 3, swing, pivot, 'OK');
    ok('통과: 조건을 만족하면 손대지 않는다', !r.levelsAdjusted, JSON.stringify(r).slice(0, 80));
  }

  // 손절폭이 ATR 1배 미만 -> 재산출
  {
    const r = ctx.validateTradeLevels(
      { action: '관망', entry: 100, stop: 99.7, target: 100.3 }, 100, 3, swing, pivot, 'TSLA');
    ok('좁은 손절: 재산출된다', r.levelsAdjusted === true);
    ok('좁은 손절: 손절폭이 ATR 1배 이상', Math.abs(r.entry - r.stop) >= 3,
       `${Math.abs(r.entry - r.stop)}`);
    ok('좁은 손절: 손익비 1.5 이상',
       Math.abs(r.target - r.entry) / Math.abs(r.entry - r.stop) >= 1.5);
  }

  // 손익비 미달 -> 재산출 ('매수'인데 목표가 손절보다 가까운 경우)
  {
    const r = ctx.validateTradeLevels(
      { action: '매수', entry: 100, stop: 90, target: 103 }, 100, 5, swing, pivot, 'COHR');
    ok('손익비 미달: 재산출된다', r.levelsAdjusted === true, r.levelsAdjustedReason);
    ok('손익비 미달: 고친 뒤 1.5 이상',
       Math.abs(r.target - r.entry) / Math.abs(r.entry - r.stop) >= 1.5);
  }

  // 방향 불일치 (매도인데 목표가 위)
  {
    const r = ctx.validateTradeLevels(
      { action: '매도', entry: 100, stop: 95, target: 110 }, 100, 4, swing, pivot, 'X');
    ok('매도 방향 불일치: 재산출된다', r.levelsAdjusted === true);
    ok('매도: 목표 < 진입 < 손절', r.target < r.entry && r.entry < r.stop,
       `${r.target} / ${r.entry} / ${r.stop}`);
  }

  // 목표 = 진입
  {
    const r = ctx.validateTradeLevels(
      { action: '관망', entry: 100, stop: 96, target: 100 }, 100, 3, swing, pivot, 'AMZN');
    ok('목표=진입: 재산출된다', r.levelsAdjusted === true, r.levelsAdjustedReason);
  }

  // 저가 자산 — 소수점 2자리로 뭉개지지 않는다
  {
    const r = ctx.validateTradeLevels(
      { action: '관망', entry: 0.0851, stop: 0.0850, target: 0.0852 }, 0.0851, 0.004, null, null, 'DOGE-USD');
    ok('저가 자산: 레벨이 뭉개지지 않는다', r.stop !== r.target && r.entry !== r.stop,
       `${r.entry} / ${r.stop} / ${r.target}`);
    ok('저가 자산: 손익비 1.5 이상',
       Math.abs(r.target - r.entry) / Math.abs(r.entry - r.stop) >= 1.5);
  }

  // ATR 이 없어도 죽지 않는다
  {
    const r = ctx.validateTradeLevels(
      { action: '매수', entry: 100, stop: 99.9, target: 100.1 }, 100, null, null, null, 'NEW');
    ok('ATR 없음: 폴백으로 재산출', r.levelsAdjusted === true);
    ok('ATR 없음: 손익비 1.5 이상',
       Math.abs(r.target - r.entry) / Math.abs(r.entry - r.stop) >= 1.5);
  }

  // 표시값 파생 — 두 세트가 언제나 일치한다
  {
    const base = { action: '매수', entry: 100, stop: 96, target: 110,
                   profitTarget1: 999, profitTarget2: 1, stopLoss: 500 };
    const r = ctx.deriveDisplayTargets(base, 100);
    ok('파생: 손절 표시 = stop', r.stopLoss === 96, String(r.stopLoss));
    ok('파생: 1차 익절 = target', r.profitTarget1 === 110, String(r.profitTarget1));
    ok('파생: 2차 익절이 1차보다 멀다', r.profitTarget2 > r.profitTarget1, String(r.profitTarget2));
    ok('파생: 모델이 낸 엉뚱한 값을 덮는다', r.profitTarget1 !== 999 && r.stopLoss !== 500);
  }

  // 매도 방향 파생
  {
    const r = ctx.deriveDisplayTargets({ action: '매도', entry: 100, stop: 104, target: 92 }, 100);
    ok('매도 파생: 2차 익절이 1차보다 아래', r.profitTarget2 < r.profitTarget1,
       `${r.profitTarget1} / ${r.profitTarget2}`);
  }

  ok('산출물에 ATR 이 실린다', /atr:\s*round\(indicators\.atr/.test(src));
  ok('프롬프트 규칙 8 이 ATR 기준으로 바뀌었다', /손절폭\*\* \|entry - stop\| 은 ATR/.test(src));
  ok('"가장 가까운 값을 그대로 가져다" 지시가 사라졌다',
     !/현재가에 가장 가까운 값을 그대로 가져다\n\s*채워라/.test(src));

  const html = fs.readFileSync(path.join(ROOT, 'chart-analysis.html'), 'utf8');
  ok('화면에 진입 기준 칸이 있다', /진입 기준/.test(html));
  ok('화면이 진입가 기준 손익비를 말한다', /진입가 기준 손익비/.test(html));
  ok('화면이 보정 사실을 밝힌다', /변동성\(ATR\) 기준으로 보정/.test(html));
  ok('그리드가 네 칸이다', /grid-template-columns: repeat\(4, 1fr\)/.test(html));
  ok('폰에서는 두 칸으로 접는다', /\.ca-targets-grid \{ grid-template-columns: repeat\(2, 1fr\)/.test(html));
  ok('안내 글자가 14px 이상', /\.ca-level-note \{[^}]*font-size: 14px/.test(html));
  ok('손익비 1.5 미만이면 경고한다', /손익비가 1\.5 미만이라 이 플랜은 실행 가치가 낮습니다/.test(html));
}

console.log(`\n통과 ${pass} / 실패 ${fails.length}`);
if (fails.length) { console.log('\n실패'); fails.forEach(f => console.log('  · ' + f)); process.exit(1); }
console.log('전부 통과.');
