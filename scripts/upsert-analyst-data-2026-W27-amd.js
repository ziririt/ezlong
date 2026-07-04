/**
 * upsert-analyst-data-2026-W27-amd.js
 *
 * AMD 컨센서스 스냅샷 + 애널리스트 뷰 Supabase upsert
 * 기준일: 2026-07-03 (2026-W27)
 *
 * 실행 방법:
 *   SUPABASE_SERVICE_KEY="your_service_role_key" node scripts/upsert-analyst-data-2026-W27-amd.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://qefddgigiujosvormkyr.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ 환경변수 SUPABASE_SERVICE_KEY가 없습니다.');
  console.error('   실행: SUPABASE_SERVICE_KEY="eyJ..." node scripts/upsert-analyst-data-2026-W27-amd.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const AS_OF    = '2026-07-03';
const WEEK_KEY = '2026-W27';

// ============================================================
// 컨센서스 스냅샷
// ============================================================
const SNAPSHOTS = [
  {
    ticker: 'AMD',
    rating_consensus: 'Strong Buy',
    analyst_count: 48,
    target_mean: 508.31,
    target_median: 500.0,
    target_high: 700.0,
    target_high_analyst: 'Cantor Fitzgerald (Jun 29, 2026)',
    target_low: 320.0,
    target_low_analyst: '보수적 밸류/사이클 하우스',
    upside_pct: -1.8,
  },
];

// ============================================================
// 개별 애널리스트 뷰 (5개)
// analyst_name이 없는 팀 뷰는 'Team'으로 표기
// ============================================================
const ANALYST_VIEWS = [
  {
    ticker: 'AMD',
    analyst_name: 'Team',
    house: 'Wells Fargo',
    rating: 'Buy',
    target_price: 615.0,
    thesis_summary: 'AI 가속기·데이터센터 모멘텀을 반영해 AMD를 2026년 톱픽으로 유지, 목표가를 505→615달러로 상향하며 AI GPU·CPU 포트폴리오 확장을 핵심으로 본다.',
    report_date: '2026-06-30',
  },
  {
    ticker: 'AMD',
    analyst_name: 'Team',
    house: 'Cantor Fitzgerald',
    rating: 'Buy',
    target_price: 700.0,
    thesis_summary: 'AI 칩 수주와 데이터센터 성장률을 적극 반영해 목표가를 500→700달러로 상향, Street 최고 수준 상단을 제시하며 35%+ 업사이드 가능성을 언급.',
    report_date: '2026-06-29',
  },
  {
    ticker: 'AMD',
    analyst_name: 'Team',
    house: 'UBS',
    rating: 'Buy',
    target_price: 670.0,
    thesis_summary: 'AI GPU·CPU 펀더멘털 강세를 바탕으로 목표가를 455→670달러로 상향, 경쟁사(NVDA·AVGO)에 비해 밸류·성장 조합이 매력적이라는 논리.',
    report_date: '2026-06-24',
  },
  {
    ticker: 'AMD',
    analyst_name: 'Team',
    house: 'Bernstein SocGen Group',
    rating: 'Buy',
    target_price: 600.0,
    thesis_summary: 'AI 계약·데이터센터 매출 가속을 반영해 목표가를 525→600달러로 상향, 장기 EPS·FCF 상향 조정과 함께 강한 모멘텀을 강조.',
    report_date: '2026-06-17',
  },
  {
    ticker: 'AMD',
    analyst_name: 'Team',
    house: 'Wolfe Research',
    rating: 'Buy',
    target_price: 450.0,
    thesis_summary: '기본 펀더멘털은 긍정적이나 현재 밸류에이션이 상단에 있다고 보고 450달러 목표를 유지, 단기 조정 가능성을 염두에 둔 신중한 강세 뷰.',
    report_date: '2026-06-15',
  },
];

// stance_bucket 매핑
function stanceBucket(rating = '') {
  const r = rating.toLowerCase();
  if (/sell|underperform|underweight|reduce|avoid/.test(r)) return 'bear';
  if (/hold|neutral|equal|market perform|in-line|peer perform/.test(r)) return 'neutral';
  return 'bull';
}

// ============================================================
// 메인 실행
// ============================================================
async function main() {
  console.log(`\n🚀 Supabase upsert 시작 — ${AS_OF} (${WEEK_KEY})\n`);
  console.log('대상: AMD\n');

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

  if (!companyMap['AMD']) {
    console.error('❌ AMD가 companies 테이블에 없음. Supabase SQL Editor에서 먼저 INSERT 필요.');
    process.exit(1);
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
      console.log(`↺ ${v.ticker} | ${v.house} → ${bucket} (UPDATE)`);
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
      console.log(`✓ ${v.ticker} | ${v.house} → ${bucket}`);
    }
  }

  console.log('\n✅ 전체 upsert 완료');
  console.log(`   스냅샷: AMD (id: ${snapshotIdMap['AMD']})`);
  console.log(`   뷰: ${ANALYST_VIEWS.length}개 처리`);
  console.log('\n📋 https://ezlong.com/analyst-reports.html 에서 AMD 확인');
}

main().catch(err => {
  console.error('\n❌ 오류 발생:', err.message);
  process.exit(1);
});
