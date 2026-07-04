/**
 * upsert-analyst-data-2026-W27-amzn-spcx.js
 *
 * AMZN + SPCX 컨센서스 스냅샷 + 애널리스트 뷰 Supabase upsert
 * 기준일: 2026-07-03 (2026-W27)
 *
 * 실행 방법:
 *   SUPABASE_SERVICE_KEY="your_service_role_key" node scripts/upsert-analyst-data-2026-W27-amzn-spcx.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://qefddgigiujosvormkyr.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ 환경변수 SUPABASE_SERVICE_KEY가 없습니다.');
  console.error('   실행: SUPABASE_SERVICE_KEY="eyJ..." node scripts/upsert-analyst-data-2026-W27-amzn-spcx.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const AS_OF    = '2026-07-03';
const WEEK_KEY = '2026-W27';

// ============================================================
// 컨센서스 스냅샷 (2개)
// ============================================================
const SNAPSHOTS = [
  {
    ticker: 'AMZN',
    rating_consensus: 'Buy',
    analyst_count: 62,
    target_mean: 312.79,
    target_median: 270.0,
    target_high: 306.0,
    target_high_analyst: 'Top Street target (다수 대형 브로커 상단)',
    target_low: 230.0,
    target_low_analyst: '보수적 가치/리스크 하우스',
    upside_pct: 17.2,
  },
  {
    ticker: 'SPCX',
    rating_consensus: 'Buy / Outperform (Sell 혼재)',
    analyst_count: 7,
    target_mean: 188.57,
    target_median: 175.0,
    target_high: 310.0,
    target_high_analyst: 'Arete Research·KGI 등 상단 강세 하우스',
    target_low: 63.0,
    target_low_analyst: 'Morningstar (Sell)',
    upside_pct: 17.2,
  },
];

// ============================================================
// 개별 애널리스트 뷰 (11개)
// ============================================================
const ANALYST_VIEWS = [
  // AMZN — 3개
  {
    ticker: 'AMZN',
    analyst_name: 'Stephen Ju',
    house: 'UBS',
    rating: 'Buy',
    target_price: 271.0,
    thesis_summary: 'AI 관련 수요·광고·리테일 마진 개선을 반영해 목표가를 271달러로 상향, 이전의 보수적 추정을 일부 되돌리며 멀티 코어 성장 구조를 강조.',
    report_date: '2025-07-28',
  },
  {
    ticker: 'AMZN',
    analyst_name: 'Top Street Brokers',
    house: '다수 대형 브로커',
    rating: 'Buy',
    target_price: 306.0,
    thesis_summary: 'AWS·광고·리테일 효율화·AI 서비스 모듈을 모두 반영해 306달러 상단 목표를 제시, 장기 FCF 레버리지와 밸류 리레이팅 여지를 본 강세 뷰.',
    report_date: '2026-07-02',
  },
  {
    ticker: 'AMZN',
    analyst_name: 'Value-oriented House',
    house: '보수적 가치 하우스',
    rating: 'Hold',
    target_price: 230.0,
    thesis_summary: '경기·소비 둔화와 마진·CAPEX 리스크를 크게 반영해 밸류에이션 상단을 230달러 수준으로 제한, 성장 잠재력은 인정하되 리스크를 중시.',
    report_date: '2026-03-15',
  },
  // SPCX — 8개
  {
    ticker: 'SPCX',
    analyst_name: 'Tim Horan',
    house: 'Oppenheimer',
    rating: 'Buy',
    target_price: 250.0,
    thesis_summary: '발사 서비스·위성 통신·AI 인프라를 모두 포함한 수익 모델 확장을 반영해 250달러 목표를 유지, SpaceX를 유일한 수직 통합 AI 인프라 기업으로 평가.',
    report_date: '2026-06-22',
  },
  {
    ticker: 'SPCX',
    analyst_name: 'Dan Ives',
    house: 'Wedbush',
    rating: 'Outperform',
    target_price: 190.0,
    thesis_summary: 'SPCX를 향후 하이퍼스케일러급 인프라 플랫폼으로 규정, 연결·발사·AI 인프라에서의 장기 지위를 반영해 190달러 목표를 제시.',
    report_date: '2026-07-01',
  },
  {
    ticker: 'SPCX',
    analyst_name: 'KGI Securities',
    house: 'KGI Securities',
    rating: 'Outperform',
    target_price: 227.0,
    thesis_summary: 'Starlink·발사·AI/데이터 인프라가 결합된 성장 시나리오에 기반해 227달러 목표를 제시, IPO 이후 밸류 확장을 긍정적으로 평가.',
    report_date: '2026-06-16',
  },
  {
    ticker: 'SPCX',
    analyst_name: 'Arete Research',
    house: 'Arete Research',
    rating: 'Buy',
    target_price: 310.0,
    thesis_summary: 'Starlink·AI·위성 네트워크의 장기 확장을 전제로, 시장이 아직 반영하지 않은 성장 옵션을 프리미엄 멀티플로 가격에 반영하며 310달러 목표를 제시하는 극강세 뷰.',
    report_date: '2026-06-19',
  },
  {
    ticker: 'SPCX',
    analyst_name: 'Daiwa Capital',
    house: 'Daiwa Capital',
    rating: 'Hold',
    target_price: 175.0,
    thesis_summary: '현재 밸류에이션과 성장 모멘텀을 모두 감안해 175달러 목표를 제시, 약 8~9% 업사이드만 남아있다는 중립적 시각을 유지.',
    report_date: '2026-07-02',
  },
  {
    ticker: 'SPCX',
    analyst_name: 'Susquehanna',
    house: 'Susquehanna',
    rating: 'Hold',
    target_price: 170.0,
    thesis_summary: 'IPO 이후 단기간 급등과 밸류 확대를 감안해 170달러 목표로 상단을 제한, 우주/통신 성장 잠재력은 인정하되 밸류 리스크를 의식한 균형적 뷰.',
    report_date: '2026-06-23',
  },
  {
    ticker: 'SPCX',
    analyst_name: 'Keith Snyder',
    house: 'CFRA',
    rating: 'Sell',
    target_price: 115.0,
    thesis_summary: 'CAPEX·실행 리스크·밸류를 고려할 때 현재 주가가 과도한 성장 가정을 반영한다고 보고, 115달러 공정가치를 제시하는 보수적 DCF 기반 Sell 뷰.',
    report_date: '2026-06-16',
  },
  {
    ticker: 'SPCX',
    analyst_name: 'Morningstar',
    house: 'Morningstar',
    rating: 'Sell',
    target_price: 63.0,
    thesis_summary: '1.75T IPO 밸류에이션이 자사 DCF 기준 공정가치의 2배 이상이라고 주장하며, 63달러를 공정가치로 제시하는 극단 보수적 밸류에이션 뷰.',
    report_date: '2026-06-03',
  },
];

// stance_bucket 매핑
function stanceBucket(rating = '') {
  const r = rating.toLowerCase();
  if (/sell|underperform|underweight|reduce|avoid/.test(r)) return 'bear';
  if (/hold|neutral|equal|market perform|in-line|peer perform/.test(r)) return 'neutral';
  return 'bull'; // buy, outperform, overweight, strong buy, etc.
}

// ============================================================
// 메인 실행
// ============================================================
async function main() {
  console.log(`\n🚀 Supabase upsert 시작 — ${AS_OF} (${WEEK_KEY})\n`);
  console.log('대상: AMZN + SPCX\n');

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

  if (!companyMap['AMZN']) console.warn('⚠️  AMZN이 companies 테이블에 없음 — Supabase에서 INSERT 필요');
  if (!companyMap['SPCX']) console.warn('⚠️  SPCX가 companies 테이블에 없음 — Supabase에서 INSERT 필요');

  // 2. 각 ticker: snapshot upsert
  const snapshotIdMap = {};

  for (const s of SNAPSHOTS) {
    const companyId = companyMap[s.ticker];
    if (!companyId) { console.warn(`⚠️  ${s.ticker} company_id 없음, 건너뜀`); continue; }

    // 같은 날짜 스냅샷이 이미 있는지 확인
    const { data: existing } = await supabase
      .from('report_snapshots')
      .select('id')
      .eq('company_id', companyId)
      .eq('snapshot_date', AS_OF)
      .maybeSingle();

    if (existing) {
      // UPDATE
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

      // 기존 is_latest → false (이 ticker만)
      const { error: flagErr } = await supabase
        .from('report_snapshots')
        .update({ is_latest: false })
        .eq('company_id', companyId);
      if (flagErr) throw new Error(`${s.ticker} is_latest 해제 실패: ${flagErr.message}`);

      // INSERT — 텍스트 필드는 이전 스냅샷에서 이어받음
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

    // 중복 체크: (snapshot_id, analyst_name, house)
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
  console.log(`   스냅샷: ${Object.keys(snapshotIdMap).join(', ')}`);
  console.log(`   뷰: ${ANALYST_VIEWS.length}개 처리 (AMZN 3개 + SPCX 8개)`);
  console.log('\n📋 다음 단계: https://ezlong.com/analyst-reports.html 에서 AMZN·SPCX 확인');
}

main().catch(err => {
  console.error('\n❌ 오류 발생:', err.message);
  process.exit(1);
});
