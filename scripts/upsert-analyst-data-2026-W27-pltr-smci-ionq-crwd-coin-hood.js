/**
 * upsert-analyst-data-2026-W27-pltr-smci-ionq-crwd-coin-hood.js
 *
 * PLTR + SMCI + IONQ + CRWD + COIN + HOOD
 * 컨센서스 스냅샷 + 애널리스트 뷰 Supabase upsert
 * 기준일: 2026-07-03 (2026-W27)
 *
 * 실행 방법:
 *   export SUPABASE_SERVICE_KEY="eyJ..."
 *   node scripts/upsert-analyst-data-2026-W27-pltr-smci-ionq-crwd-coin-hood.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://qefddgigiujosvormkyr.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ 환경변수 SUPABASE_SERVICE_KEY가 없습니다.');
  console.error('   실행: export SUPABASE_SERVICE_KEY="eyJ..." && node scripts/upsert-analyst-data-2026-W27-pltr-smci-ionq-crwd-coin-hood.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const AS_OF    = '2026-07-03';
const WEEK_KEY = '2026-W27';

// ============================================================
// 컨센서스 스냅샷 (6개)
// ============================================================
const SNAPSHOTS = [
  {
    ticker: 'PLTR',
    rating_consensus: 'Moderate Buy',
    analyst_count: 27,
    target_mean: 183.12,
    target_median: 190.85,
    target_high: 255.0,
    target_high_analyst: 'Top Street target (Wedbush 등)',
    target_low: 70.0,
    target_low_analyst: '극단 약세 하우스',
    upside_pct: 41.6,
  },
  {
    ticker: 'SMCI',
    rating_consensus: 'Hold / Mixed',
    analyst_count: 15,
    target_mean: 38.0,
    target_median: 38.0,
    target_high: 93.0,
    target_high_analyst: '강세 하우스 (Rosenblatt 등)',
    target_low: 15.0,
    target_low_analyst: '극단 보수적 하우스',
    upside_pct: 40.7,
  },
  {
    ticker: 'IONQ',
    rating_consensus: 'Buy',
    analyst_count: 7,
    target_mean: 22.0,
    target_median: 21.0,
    target_high: 30.0,
    target_high_analyst: '양자 컴퓨팅 강세 하우스',
    target_low: 12.0,
    target_low_analyst: '보수적 성장·밸류 하우스',
    upside_pct: 29.4,
  },
  {
    ticker: 'CRWD',
    rating_consensus: 'Strong Buy',
    analyst_count: 40,
    target_mean: 750.0,
    target_median: 780.0,
    target_high: 850.0,
    target_high_analyst: '최상단 강세 하우스',
    target_low: 413.0,
    target_low_analyst: '보수적 밸류 하우스',
    upside_pct: 0.3,
  },
  {
    ticker: 'COIN',
    rating_consensus: 'Buy',
    analyst_count: 33,
    target_mean: 269.14,
    target_median: 270.0,
    target_high: 417.0,
    target_high_analyst: '최상단 강세 하우스',
    target_low: 107.0,
    target_low_analyst: 'Barclays Underweight',
    upside_pct: 62.7,
  },
  {
    ticker: 'HOOD',
    rating_consensus: 'Strong Buy',
    analyst_count: 27,
    target_mean: 116.26,
    target_median: 122.67,
    target_high: 170.0,
    target_high_analyst: 'JMP Securities (Oct 2025)',
    target_low: 48.0,
    target_low_analyst: 'Redburn Atlantic (Jun 2025)',
    upside_pct: 3.8,
  },
];

// ============================================================
// 개별 애널리스트 뷰 (18개)
// ============================================================
const ANALYST_VIEWS = [
  // ── PLTR (4개) ──────────────────────────────────────────
  {
    ticker: 'PLTR',
    analyst_name: 'Team',
    house: 'DA Davidson',
    rating: 'Buy',
    target_price: 175.0,
    thesis_summary: 'AI 플랫폼·정부·상업 고객 기반 확장을 반영해 목표가를 165→175달러로 상향, 장기 성장률과 데이터 플랫폼의 전략적 위치를 강조.',
    report_date: '2026-07-02',
  },
  {
    ticker: 'PLTR',
    analyst_name: 'Team',
    house: 'Wedbush',
    rating: 'Buy',
    target_price: 230.0,
    thesis_summary: 'Palantir를 \'AI 소프트웨어 플랫폼 코어\'로 규정하며 230달러 상단 목표를 유지, 장기적으로 매출/FCF 레버리지가 크게 발생할 것으로 예상.',
    report_date: '2026-06-24',
  },
  {
    ticker: 'PLTR',
    analyst_name: 'Team',
    house: 'UBS',
    rating: 'Buy',
    target_price: 200.0,
    thesis_summary: '정부·상업 매출 가속과 AI 모듈 수요를 반영해 200달러 목표를 유지, 밸류 부담에도 불구하고 성장 모멘텀을 핵심으로 보는 강세 뷰.',
    report_date: '2026-06-16',
  },
  {
    ticker: 'PLTR',
    analyst_name: 'Team',
    house: 'Wolfe Research',
    rating: 'Hold',
    target_price: null, // 신규 커버리지 개시, 목표가 미제시
    thesis_summary: '새 커버리지에서 밸류에이션이 이미 상당 부분 성장 기대를 반영했다고 보고 중립 뷰를 제시, 멀티플 확장 여지는 제한적이라는 논리.',
    report_date: '2026-06-16',
  },

  // ── SMCI (3개) ──────────────────────────────────────────
  {
    ticker: 'SMCI',
    analyst_name: 'Team',
    house: 'Goldman Sachs',
    rating: 'Sell',
    target_price: 27.0,
    thesis_summary: '데이터센터 서버·AI 인프라 수요는 긍정적이지만 밸류에이션과 사이클 변동성을 감안해 27달러 Sell을 유지, 펀더멘털 대비 과열된 가격이라는 판단.',
    report_date: '2026-02-03',
  },
  {
    ticker: 'SMCI',
    analyst_name: 'Team',
    house: 'Rosenblatt',
    rating: 'Buy',
    target_price: 50.0,
    thesis_summary: 'AI 서버·고밀도 시스템 수요를 중심으로 강한 성장을 예상해 50달러 목표를 유지, 중장기 매출/마진 레버리지를 반영한 강세 뷰.',
    report_date: '2026-02-03',
  },
  {
    ticker: 'SMCI',
    analyst_name: 'Team',
    house: 'Barclays',
    rating: 'Equalweight',
    target_price: 38.0,
    thesis_summary: '성장 잠재력은 인정하지만 밸류와 경쟁·사이클 리스크를 감안해 43→38달러로 목표가를 하향, 중립 뷰를 유지.',
    report_date: '2026-02-03',
  },

  // ── IONQ (2개) ──────────────────────────────────────────
  {
    ticker: 'IONQ',
    analyst_name: 'Team',
    house: 'Needham',
    rating: 'Buy',
    target_price: 25.0,
    thesis_summary: '양자 컴퓨팅 상용화 초기 단계에서 클라우드·AI 워크로드와 연계된 성장 잠재력을 반영해 25달러 목표를 유지, 고위험/고수익 성장주로 평가.',
    report_date: '2026-06-20',
  },
  {
    ticker: 'IONQ',
    analyst_name: 'Team',
    house: 'BofA Securities',
    rating: 'Buy',
    target_price: 30.0,
    thesis_summary: '장기적으로 양자 컴퓨팅이 AI·시뮬레이션·금융·과학 연구 등에서 코어 인프라가 될 것이라는 가정 하에 30달러 상단 목표를 제시.',
    report_date: '2026-06-27',
  },

  // ── CRWD (1개) ──────────────────────────────────────────
  {
    ticker: 'CRWD',
    analyst_name: 'Mike Cikos',
    house: 'Needham',
    rating: 'Buy',
    target_price: 780.0,
    thesis_summary: '클라우드 보안·엔드포인트 플랫폼 성장을 반영해 목표가를 475→780달러로 상향, ARR·매출 성장률과 플랫폼 확장을 핵심 근거로 제시.',
    report_date: '2026-06-04',
  },

  // ── COIN (3개) ──────────────────────────────────────────
  {
    ticker: 'COIN',
    analyst_name: 'Ramsey El-Assal',
    house: 'Cantor Fitzgerald',
    rating: 'Overweight',
    target_price: 250.0,
    thesis_summary: '암호화폐 시장 변동성에도 불구하고 Coinbase의 플랫폼·수익 모델을 긍정적으로 보며 250달러 목표를 유지, 현재 가격 대비 의미 있는 업사이드가 있다고 평가.',
    report_date: '2026-06-17',
  },
  {
    ticker: 'COIN',
    analyst_name: 'Team',
    house: 'Needham',
    rating: 'Buy',
    target_price: 220.0,
    thesis_summary: '\'Everything Exchange\' 지향 신규 서비스 출시를 반영해 220달러 목표를 유지, 토큰화 주식·AI 투자 어드바이저·테마 인덱스 등 신제품이 수수료·거래를 늘릴 것으로 예상.',
    report_date: '2026-06-16',
  },
  {
    ticker: 'COIN',
    analyst_name: 'Team',
    house: 'BTIG',
    rating: 'Buy',
    target_price: 280.0,
    thesis_summary: '토큰화 주식·신규 상품 론칭을 계기로 Coinbase가 \'Everything Exchange\'에 근접한다고 평가, 280달러 목표를 유지하며 구조적 성장 기대를 반영.',
    report_date: '2026-06-16',
  },

  // ── HOOD (5개) ──────────────────────────────────────────
  {
    ticker: 'HOOD',
    analyst_name: 'Team',
    house: 'Mizuho',
    rating: 'Outperform',
    target_price: 130.0,
    thesis_summary: '플랫폼 성장·AUM 확대·수익 다변화를 반영해 115→130달러로 목표가를 상향, 현재 가격 대비 약 16% 업사이드가 남아있다고 평가.',
    report_date: '2026-07-02',
  },
  {
    ticker: 'HOOD',
    analyst_name: 'Team',
    house: 'BTIG',
    rating: 'Buy',
    target_price: 125.0,
    thesis_summary: '레코드급 6월 거래 활동과 제품 라인업 확장을 반영해 125달러 목표를 제시, 플랫폼 성장과 수수료 수익 가속에 베팅하는 강세 뷰.',
    report_date: '2026-06-28',
  },
  {
    ticker: 'HOOD',
    analyst_name: 'James Yaro',
    house: 'Goldman Sachs',
    rating: 'Buy',
    target_price: 121.0,
    thesis_summary: '레코드급 6월 거래 볼륨을 근거로 108→121달러로 목표가를 상향, 플랫폼 성장·제품 확장을 통해 중장기 수익성 개선을 기대하는 강세 의견.',
    report_date: '2026-06-28',
  },
  {
    ticker: 'HOOD',
    analyst_name: 'Team',
    house: 'Argus',
    rating: 'Buy',
    target_price: 110.0,
    thesis_summary: '비용 구조 개선(인력 감축)과 플랫폼 성장·AUM 증가를 반영해 90→110달러로 목표가를 상향, 구조적 수익성 개선을 강조.',
    report_date: '2026-06-16',
  },
  {
    ticker: 'HOOD',
    analyst_name: 'Team',
    house: 'Deutsche Bank',
    rating: 'Buy',
    target_price: 105.0,
    thesis_summary: '비용 절감·수수료 수익 성장·플랫폼 확장에 베팅하며 98→105달러로 목표가를 상향, 강한 펀더멘털 개선을 근거로 한 강세 뷰.',
    report_date: '2026-06-16',
  },
];

// stance_bucket 매핑
function stanceBucket(rating = '') {
  const r = rating.toLowerCase();
  if (/sell|underperform|underweight|reduce|avoid/.test(r)) return 'bear';
  if (/hold|neutral|equal|market perform|in-line|peer perform/.test(r)) return 'neutral';
  return 'bull'; // buy, outperform, overweight, strong buy, positive, etc.
}

// ============================================================
// 메인 실행
// ============================================================
async function main() {
  console.log(`\n🚀 Supabase upsert 시작 — ${AS_OF} (${WEEK_KEY})\n`);
  console.log('대상: PLTR + SMCI + IONQ + CRWD + COIN + HOOD\n');

  // 1. company_id 조회
  const tickers = [...new Set(SNAPSHOTS.map(s => s.ticker))];
  const { data: companies, error: cErr } = await supabase
    .from('companies')
    .select('id, ticker')
    .in('ticker', tickers);

  if (cErr) throw new Error(`companies 조회 실패: ${cErr.message}`);

  const companyMap = {};
  companies.forEach(c => { companyMap[c.ticker] = c.id; });
  console.log('✓ company_id 조회 완료:', Object.entries(companyMap).map(([t, id]) => `${t}=${id}`).join(', '), '\n');

  for (const tk of tickers) {
    if (!companyMap[tk]) {
      console.error(`❌ ${tk}가 companies 테이블에 없음. Supabase SQL Editor에서 먼저 INSERT 필요.`);
      process.exit(1);
    }
  }

  // 2. snapshot upsert
  const snapshotIdMap = {};

  for (const s of SNAPSHOTS) {
    const companyId = companyMap[s.ticker];

    const { data: existing } = await supabase
      .from('report_snapshots')
      .select('id')
      .eq('company_id', companyId)
      .eq('snapshot_date', AS_OF)
      .maybeSingle();

    if (existing) {
      const { error: uErr } = await supabase.from('report_snapshots').update({
        week_key: WEEK_KEY,
        consensus_rating: s.rating_consensus,
        analyst_count: s.analyst_count,
        pt_mean: s.target_mean,
        pt_median: s.target_median,
        pt_high: s.target_high,
        pt_high_analyst: s.target_high_analyst,
        pt_low: s.target_low,
        pt_low_analyst: s.target_low_analyst,
        upside_pct: s.upside_pct,
        is_latest: true,
      }).eq('id', existing.id);
      if (uErr) throw new Error(`${s.ticker} snapshot UPDATE 실패: ${uErr.message}`);
      snapshotIdMap[s.ticker] = existing.id;
      console.log(`↺ ${s.ticker} snapshot UPDATE (id: ${existing.id})`);
    } else {
      // 이전 is_latest 스냅샷의 텍스트 필드 보존
      const { data: prevSnap } = await supabase
        .from('report_snapshots')
        .select('valuation_frame, one_line_summary, report_markdown, source_note')
        .eq('company_id', companyId)
        .eq('is_latest', true)
        .maybeSingle();

      const { error: flagErr } = await supabase
        .from('report_snapshots')
        .update({ is_latest: false })
        .eq('company_id', companyId);
      if (flagErr) throw new Error(`${s.ticker} is_latest 해제 실패: ${flagErr.message}`);

      const { data: inserted, error: iErr } = await supabase
        .from('report_snapshots')
        .insert({
          company_id: companyId,
          snapshot_date: AS_OF,
          week_key: WEEK_KEY,
          consensus_rating: s.rating_consensus,
          analyst_count: s.analyst_count,
          pt_mean: s.target_mean,
          pt_median: s.target_median,
          pt_high: s.target_high,
          pt_high_analyst: s.target_high_analyst,
          pt_low: s.target_low,
          pt_low_analyst: s.target_low_analyst,
          upside_pct: s.upside_pct,
          is_latest: true,
          valuation_frame:   prevSnap?.valuation_frame   ?? null,
          one_line_summary:  prevSnap?.one_line_summary  ?? null,
          report_markdown:   prevSnap?.report_markdown   ?? null,
          source_note:       prevSnap?.source_note       ?? null,
        })
        .select('id')
        .single();
      if (iErr) throw new Error(`${s.ticker} snapshot INSERT 실패: ${iErr.message}`);
      snapshotIdMap[s.ticker] = inserted.id;
      console.log(`✓ ${s.ticker} snapshot INSERT (id: ${inserted.id})`);
    }
  }

  console.log('\n--- analyst_views 처리 ---\n');

  // 3. analyst_views upsert
  for (const v of ANALYST_VIEWS) {
    const snapId = snapshotIdMap[v.ticker];
    if (!snapId) { console.warn(`⚠️  ${v.ticker} snapshot_id 없음, 뷰 건너뜀`); continue; }

    const bucket = stanceBucket(v.rating);

    const { data: existing } = await supabase
      .from('analyst_views')
      .select('id')
      .eq('snapshot_id', snapId)
      .eq('analyst_name', v.analyst_name)
      .eq('house', v.house)
      .maybeSingle();

    if (existing) {
      const { error: uErr } = await supabase.from('analyst_views').update({
        rating: v.rating,
        target_price: v.target_price,
        thesis: v.thesis_summary,
        reference_date: v.report_date,
        stance_bucket: bucket,
      }).eq('id', existing.id);
      if (uErr) throw new Error(`${v.ticker}/${v.house} VIEW UPDATE 실패: ${uErr.message}`);
      console.log(`↺ ${v.ticker} | ${v.house} | ${v.analyst_name} → ${bucket} (UPDATE)`);
    } else {
      const { error: iErr } = await supabase.from('analyst_views').insert({
        snapshot_id: snapId,
        analyst_name: v.analyst_name,
        house: v.house,
        rating: v.rating,
        target_price: v.target_price,
        thesis: v.thesis_summary,
        reference_date: v.report_date,
        stance_bucket: bucket,
      });
      if (iErr) throw new Error(`${v.ticker}/${v.house} VIEW INSERT 실패: ${iErr.message}`);
      console.log(`✓ ${v.ticker} | ${v.house} | ${v.analyst_name} → ${bucket}`);
    }
  }

  console.log('\n✅ 전체 upsert 완료');
  console.log(`   스냅샷: ${Object.entries(snapshotIdMap).map(([t,id])=>`${t}(id:${id})`).join(', ')}`);
  console.log(`   뷰: ${ANALYST_VIEWS.length}개 처리 (PLTR 4개 + SMCI 3개 + IONQ 2개 + CRWD 1개 + COIN 3개 + HOOD 5개)`);
  console.log('\n📋 https://ezlong.com/analyst-reports.html 에서 확인');
}

main().catch(err => {
  console.error('\n❌ 오류 발생:', err.message);
  process.exit(1);
});
