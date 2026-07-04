/**
 * upsert-analyst-data-2026-W27-avgo-asml-tsm.js
 *
 * AVGO + ASML + TSM 컨센서스 스냅샷 + 애널리스트 뷰 Supabase upsert
 * 기준일: 2026-07-03 (2026-W27)
 *
 * 실행 방법:
 *   export SUPABASE_SERVICE_KEY="eyJ..."
 *   node scripts/upsert-analyst-data-2026-W27-avgo-asml-tsm.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://qefddgigiujosvormkyr.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ 환경변수 SUPABASE_SERVICE_KEY가 없습니다.');
  console.error('   실행: export SUPABASE_SERVICE_KEY="eyJ..." && node scripts/upsert-analyst-data-2026-W27-avgo-asml-tsm.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const AS_OF    = '2026-07-03';
const WEEK_KEY = '2026-W27';

// ============================================================
// 컨센서스 스냅샷 (3개)
// ============================================================
const SNAPSHOTS = [
  {
    ticker: 'AVGO',
    rating_consensus: 'Strong Buy',
    analyst_count: 33,
    target_mean: 493.24,
    target_median: 485.0,
    target_high: 582.0,
    target_high_analyst: '상단 강세 하우스 (Susquehanna·UBS 등)',
    target_low: 360.0,
    target_low_analyst: '보수적 밸류·사이클 하우스',
    upside_pct: 12.6,
  },
  {
    ticker: 'ASML',
    rating_consensus: 'Buy',
    analyst_count: 35,
    target_mean: 1695.96,
    target_median: 1700.0,
    target_high: 2500.0,
    target_high_analyst: '최상단 강세 하우스 (Susquehanna 등)',
    target_low: 980.0,
    target_low_analyst: '보수적 규제·사이클 하우스',
    upside_pct: 3.8,
  },
  {
    ticker: 'TSM',
    rating_consensus: 'Strong Buy',
    analyst_count: 8,
    target_mean: 434.38,
    target_median: 490.0,
    target_high: 590.0,
    target_high_analyst: 'BofA Securities (Jun 24, 2026)',
    target_low: 210.0,
    target_low_analyst: 'Freedom Broker (Apr 25, 2025)',
    upside_pct: -0.8,
  },
];

// ============================================================
// 개별 애널리스트 뷰 (10개)
// ============================================================
const ANALYST_VIEWS = [
  // ── AVGO (2개) ──────────────────────────────────────────
  {
    ticker: 'AVGO',
    analyst_name: 'Christopher Rolland',
    house: 'Susquehanna',
    rating: 'Buy',
    target_price: 490.0,
    thesis_summary: 'AI ASIC과 네트워킹 포트폴리오 모멘텀을 반영해 목표가를 450→490달러로 상향, Q2 FY26 실적을 앞두고 AI 칩 수요를 핵심 드라이버로 본다.',
    report_date: '2026-05-28',
  },
  {
    ticker: 'AVGO',
    analyst_name: 'Team',
    house: 'Morgan Stanley',
    rating: 'Overweight',
    target_price: 485.0,
    thesis_summary: '최근 AI 칩 매출·솔루션 매출 가속을 반영해 목표가를 470→485달러로 소폭 상향, 밸류 부담은 일부 인정하되 강한 실적 모멘텀에 베팅.',
    report_date: '2026-06-01',
  },

  // ── ASML (5개) ──────────────────────────────────────────
  {
    ticker: 'ASML',
    analyst_name: 'Team',
    house: '24/7 Wall St.',
    rating: 'Buy',
    target_price: 1996.77,
    thesis_summary: '백로그 450억달러와 가이던스 상향을 반영해 1,996.77달러 목표를 제시, AI 인프라·첨단 공정 투자 사이클의 핵심 수혜주로 평가.',
    report_date: '2026-06-16',
  },
  {
    ticker: 'ASML',
    analyst_name: 'Team',
    house: 'BofA Securities',
    rating: 'Buy',
    target_price: 2345.0,
    thesis_summary: '캘린더 2027·2028 EPS 전망 상향(각 +1%, +5%)과 하이NA EUV 장기 수요를 반영해 목표가를 2,268→2,345유로로 상향, 강한 장기 모멘텀을 강조.',
    report_date: '2026-06-22',
  },
  {
    ticker: 'ASML',
    analyst_name: 'Joe Quatrochi',
    house: 'Wells Fargo',
    rating: 'Overweight',
    target_price: 2200.0,
    thesis_summary: '하이NA EUV 도입과 글로벌 고객사(삼성·TSMC·인텔)의 첨단 공정 투자 확대를 반영해 1,750→2,200유로로 목표가를 상향, ASML을 AI 인프라 필수 장비 공급자로 규정.',
    report_date: '2026-06-22',
  },
  {
    ticker: 'ASML',
    analyst_name: 'Team',
    house: 'JPMorgan',
    rating: 'Overweight',
    target_price: 2200.0,
    thesis_summary: 'EUV·하이NA 장비 수요와 장기 공정 전환 속도를 반영해 1,813→2,200유로로 목표가를 상향, AI·고대역폭 메모리·첨단 로직 수요를 핵심 드라이버로 본다.',
    report_date: '2026-06-20',
  },
  {
    ticker: 'ASML',
    analyst_name: 'Team',
    house: 'Goldman Sachs',
    rating: 'Buy',
    target_price: 2000.0,
    thesis_summary: '최근 주가 조정 이후에도 구조적 성장주로 평가하며 2,000유로 목표를 유지, 첨단 공정 고객사들의 장기 투자 계획에 베팅.',
    report_date: '2026-07-02',
  },

  // ── TSM (3개) ──────────────────────────────────────────
  {
    ticker: 'TSM',
    analyst_name: 'Team',
    house: 'BofA Securities',
    rating: 'Buy',
    target_price: 590.0,
    thesis_summary: 'AI 반도체·첨단 공정 수요를 반영해 목표가를 490→590달러로 상향, 글로벌 파운드리 시장에서 TSMC의 구조적 리더십을 강조.',
    report_date: '2026-06-24',
  },
  {
    ticker: 'TSM',
    analyst_name: 'Team',
    house: 'Susquehanna',
    rating: 'Positive',
    target_price: 500.0,
    thesis_summary: 'AI·고대역폭 메모리·첨단 로직 수요에 따른 주문 증가를 반영해 약 500달러 목표를 제시, A16 등 첨단 공정에서의 기술 우위를 핵심 가설로 본다.',
    report_date: '2026-06-22',
  },
  {
    ticker: 'TSM',
    analyst_name: 'Team',
    house: 'Barclays',
    rating: 'Overweight',
    target_price: 490.0,
    thesis_summary: '4월 리포트에서 목표가를 430→490달러로 상향, 이후 6월 컨센서스에서 상단·중앙값 기준으로 반복 인용되는 벤치마크 역할을 수행.',
    report_date: '2026-04-22',
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
  console.log('대상: AVGO + ASML + TSM\n');

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
  console.log(`   뷰: ${ANALYST_VIEWS.length}개 처리 (AVGO 2개 + ASML 5개 + TSM 3개)`);
  console.log('\n📋 https://ezlong.com/analyst-reports.html 에서 AVGO·ASML·TSM 확인');
}

main().catch(err => {
  console.error('\n❌ 오류 발생:', err.message);
  process.exit(1);
});
