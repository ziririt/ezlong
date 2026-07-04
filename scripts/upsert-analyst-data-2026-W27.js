/**
 * upsert-analyst-data-2026-W27.js
 *
 * 2026-07-03 기준 컨센서스 스냅샷 + 애널리스트 뷰 Supabase upsert
 *
 * 실행 방법:
 *   SUPABASE_SERVICE_KEY="your_service_role_key" node scripts/upsert-analyst-data-2026-W27.js
 *
 * service_role key 위치:
 *   Supabase 대시보드 → Settings → API → service_role (secret)
 *
 * 안전 보장:
 *   - 같은 snapshot_date가 이미 있으면 UPDATE (INSERT 아님)
 *   - is_latest=false 처리는 해당 ticker만 (다른 ticker 건드리지 않음)
 *   - GOOGL "AI 강세 하우스" 플레이스홀더 항목 자동 스킵
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://qefddgigiujosvormkyr.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ 환경변수 SUPABASE_SERVICE_KEY가 없습니다.');
  console.error('   실행: SUPABASE_SERVICE_KEY="eyJ..." node scripts/upsert-analyst-data-2026-W27.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const AS_OF = '2026-07-03';
const WEEK_KEY = '2026-W27';

// ============================================================
// 컨센서스 스냅샷 (6개 티커)
// ============================================================
const SNAPSHOTS = [
  {
    ticker: 'TSLA',
    rating_consensus: 'Buy',
    analyst_count: 47,
    target_mean: 423.35,
    target_median: 450.0,
    target_high: 600.0,
    target_high_analyst: 'New Street, Wedbush 등',
    target_low: 123.0,
    target_low_analyst: 'HSBC 등',
    upside_pct: 7.60,
  },
  {
    ticker: 'NVDA',
    rating_consensus: 'Strong Buy',
    analyst_count: 38,
    target_mean: 298.87,
    target_median: 308.56,
    target_high: 500.0,
    target_high_analyst: 'Baird 등 상단 강세',
    target_low: 215.0,
    target_low_analyst: 'Deutsche Bank 등 보수적',
    upside_pct: 37.20,
  },
  {
    ticker: 'MSFT',
    rating_consensus: 'Strong Buy',
    analyst_count: 47,
    target_mean: 560.86,
    target_median: 555.0,
    target_high: 870.0,
    target_high_analyst: 'AI·클라우드 극강세',
    target_low: 400.0,
    target_low_analyst: 'Stifel 등 밸류 보수적',
    upside_pct: 36.80,
  },
  {
    ticker: 'AAPL',
    rating_consensus: 'Buy',
    analyst_count: 109,
    target_mean: 303.0,
    target_median: 315.0,
    target_high: 400.0,
    target_high_analyst: 'Wedbush 등 AI 슈퍼사이클 강세',
    target_low: 220.0,
    target_low_analyst: '보수적 가치',
    upside_pct: 11.0,
  },
  {
    ticker: 'META',
    rating_consensus: 'Strong Buy',
    analyst_count: 50,
    target_mean: 800.0,
    target_median: 825.0,
    target_high: 1015.0,
    target_high_analyst: 'Rosenblatt 등 상단 강세',
    target_low: 700.0,
    target_low_analyst: '보수적 AI CAPEX·밸류 프레임',
    upside_pct: 34.0,
  },
  {
    ticker: 'GOOGL',
    rating_consensus: 'Buy',
    analyst_count: 35,
    target_mean: 445.0,
    target_median: 450.0,
    target_high: 515.0,
    target_high_analyst: 'AI 강세 하우스',
    target_low: 350.0,
    target_low_analyst: '보수적 성장·밸류',
    upside_pct: 18.7,
  },
];

// ============================================================
// 개별 애널리스트 뷰 (19개 — GOOGL 플레이스홀더 1개 제외)
// ============================================================
const ANALYST_VIEWS = [
  // TSLA
  {
    ticker: 'TSLA',
    analyst_name: 'Dan Levy',
    house: 'Barclays',
    rating: 'Hold (Equalweight)',
    target_price: 360.0,
    thesis_summary: 'EV 수요 둔화와 마진 압박, 경쟁 심화를 반영해 리스크/보상이 균형적이라는 중립 뷰를 유지.',
    report_date: '2026-06-25',
    is_reiterate: true,
  },
  {
    ticker: 'TSLA',
    analyst_name: 'Team',
    house: 'Truist Securities',
    rating: 'Hold',
    target_price: 430.0,
    thesis_summary: '목표가를 400→430달러로 상향, 밸류에이션 상단을 넓히되 여전히 중립적 리스크/리워드로 판단.',
    report_date: '2026-07-02',
    is_reiterate: false,
  },
  {
    ticker: 'TSLA',
    analyst_name: 'Team',
    house: 'TD Cowen',
    rating: 'Buy',
    target_price: 490.0,
    thesis_summary: 'EV 제조 리스크에도 불구하고 AI·FSD·로보택시 옵션을 강하게 반영해 의미 있는 업사이드를 제시.',
    report_date: '2026-06-29',
    is_reiterate: true,
  },
  {
    ticker: 'TSLA',
    analyst_name: 'Alexander Potter',
    house: 'Piper Sandler',
    rating: 'Buy',
    target_price: 500.0,
    thesis_summary: '2026년 회사 목표의 절반만 달성해도 주가 업사이드가 크다는 가정 하에 AI·소프트웨어 수익에 초점을 둔 강세 뷰.',
    report_date: '2026-05-11',
    is_reiterate: true,
  },
  // NVDA
  {
    ticker: 'NVDA',
    analyst_name: 'Timothy Arcuri',
    house: 'UBS',
    rating: 'Buy',
    target_price: 245.0,
    thesis_summary: 'AI 가속기·데이터센터 수요가 예상보다 오래 지속될 것으로 보고, 12개월 목표가를 245달러로 설정.',
    report_date: '2026-05-12',
    is_reiterate: true,
  },
  {
    ticker: 'NVDA',
    analyst_name: 'Team',
    house: 'China Renaissance',
    rating: 'Buy',
    target_price: 319.0,
    thesis_summary: '12개월 목표가를 319달러로 제시하며, AI 서버 및 Blackwell 수요에 따른 장기 성장 모멘텀을 강조.',
    report_date: '2026-06-05',
    is_reiterate: true,
  },
  {
    ticker: 'NVDA',
    analyst_name: 'Team',
    house: 'Baird',
    rating: 'Buy',
    target_price: 500.0,
    thesis_summary: 'AI 인프라 투자 사이클이 장기적으로 이어질 것이라는 전제 하에 프리미엄 밸류에이션을 정당화하며 500달러 상단 목표를 제시.',
    report_date: '2026-05-21',
    is_reiterate: true,
  },
  // MSFT
  {
    ticker: 'MSFT',
    analyst_name: 'Michael Turrin',
    house: 'Wells Fargo',
    rating: 'Buy',
    target_price: 650.0,
    thesis_summary: 'Azure·AI 워크로드·Copilot 확산을 핵심 성장축으로 보고, AI·클라우드 듀얼 코어로서 장기 FCF 레버리지를 반영해 650달러 목표를 제시.',
    report_date: '2026-06-12',
    is_reiterate: true,
  },
  {
    ticker: 'MSFT',
    analyst_name: 'Mark Moerdler',
    house: 'Bernstein',
    rating: 'Buy',
    target_price: 646.0,
    thesis_summary: 'AI·클라우드·오피스 스택 결합으로 EPS·FCF 성장률이 높게 유지될 것으로 보고, 프리미엄 멀티플을 반영해 646달러 목표를 유지.',
    report_date: '2026-06-11',
    is_reiterate: true,
  },
  {
    ticker: 'MSFT',
    analyst_name: 'Tyler Radke',
    house: 'Citi',
    rating: 'Buy',
    target_price: 620.0,
    thesis_summary: 'Copilot 및 AI 기능 탑재로 엔터프라이즈 소프트웨어 ARPU 상향 여지를 크게 보고, AI 모듈 가치가 밸류에이션 확장을 이끌 것이라는 논리.',
    report_date: '2026-06-05',
    is_reiterate: true,
  },
  {
    ticker: 'MSFT',
    analyst_name: 'Thomas Blakey',
    house: 'Cantor Fitzgerald',
    rating: 'Buy',
    target_price: 502.0,
    thesis_summary: 'AI·클라우드 성장률은 긍정적이지만 밸류에이션과 변동성을 고려해 500달러대 보수적 목표를 유지하는 강세이면서도 신중한 뷰.',
    report_date: '2026-06-04',
    is_reiterate: true,
  },
  {
    ticker: 'MSFT',
    analyst_name: 'Brad Reback',
    house: 'Stifel',
    rating: 'Hold',
    target_price: 400.0,
    thesis_summary: '밸류에이션 부담을 이유로 400달러 목표에 머물며, AI·클라우드 성장에도 불구하고 현재 수준에서 리스크/리워드가 중립적이라고 판단.',
    report_date: '2026-06-24',
    is_reiterate: true,
  },
  // AAPL
  {
    ticker: 'AAPL',
    analyst_name: 'Team',
    house: 'Evercore ISI',
    rating: 'Outperform',
    target_price: 365.0,
    thesis_summary: '온디바이스 AI와 서비스 매출 확장으로 EPS·FCF 성장률이 다시 가속할 것으로 보고, 365달러 목표로 대형주 최상급 퀄리티를 강조.',
    report_date: '2026-06-25',
    is_reiterate: true,
  },
  {
    ticker: 'AAPL',
    analyst_name: 'Dan Ives',
    house: 'Wedbush',
    rating: 'Buy',
    target_price: 400.0,
    thesis_summary: "'AI iPhone 슈퍼사이클' 시나리오를 전제로 밸류 리레이팅을 가정하며, 400달러 목표로 상단 업사이드를 열어둔 강세 프레임.",
    report_date: '2026-06-05',
    is_reiterate: true,
  },
  {
    ticker: 'AAPL',
    analyst_name: 'Team',
    house: 'BofA Securities',
    rating: 'Buy',
    target_price: 350.0,
    thesis_summary: '서비스·웨어러블·AI 기능 결합으로 마진과 ARPU가 개선될 것으로 보고, 350달러 목표로 밸류 상단에서도 추가 업사이드가 남아있다고 판단.',
    report_date: '2026-04-10',
    is_reiterate: true,
  },
  // META
  {
    ticker: 'META',
    analyst_name: 'Team',
    house: '24/7 Wall St.',
    rating: 'Buy',
    target_price: 868.05,
    thesis_summary: 'AI 기반 광고 플랫폼·Reels·메신저·비즈니스 메시징 성장에 베팅하며, 45% 이상 업사이드 가능성을 제시하는 강한 매수 의견.',
    report_date: '2026-06-02',
    is_reiterate: true,
  },
  {
    ticker: 'META',
    analyst_name: 'Team',
    house: 'Rosenblatt',
    rating: 'Buy',
    target_price: 1015.0,
    thesis_summary: 'AI 광고 효율·메타버스 옵션·인프라 CAPEX 효과까지 반영해 Street 최상단 1,015달러 목표를 제시하는 극강세 뷰.',
    report_date: '2026-06-01',
    is_reiterate: true,
  },
  {
    ticker: 'META',
    analyst_name: 'Team',
    house: 'RBC Capital Markets',
    rating: 'Outperform',
    target_price: 810.0,
    thesis_summary: '광고·플랫폼 모멘텀과 AI/인프라 CAPEX의 생산성 향상을 동시에 반영해 810달러 목표를 제시, CAPEX 증가에도 FCF 개선 여지를 강조.',
    report_date: '2026-06-15',
    is_reiterate: true,
  },
  // GOOGL — "AI 강세 하우스" 플레이스홀더는 제외, 실명만 포함
  {
    ticker: 'GOOGL',
    analyst_name: 'Laura Martin',
    house: 'Needham',
    rating: 'Buy',
    target_price: 450.0,
    thesis_summary: '검색·YouTube·클라우드의 결합된 성장과 AI 모델 도입에 따른 광고 효율·클라우드 경쟁력 강화를 반영해 450달러 목표와 Buy를 재확인.',
    report_date: '2026-06-03',
    is_reiterate: true,
  },
  // GOOGL "AI 강세 하우스" → 스킵 (플레이스홀더, 실명 아님)
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
      // UPDATE — 같은 날짜가 있으면 덮어쓰기
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
      // 이전 is_latest 스냅샷의 텍스트 필드 보존 (valuation_frame, one_line_summary, report_markdown, source_note)
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
          // 텍스트 필드 이전 스냅샷에서 이어받기 (없으면 null)
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
  console.log(`   뷰: ${ANALYST_VIEWS.length}개 처리`);
  console.log('\n📋 다음 단계: https://ezlong.com/analyst-reports.html 에서 6개 티커 확인');
}

main().catch(err => {
  console.error('\n❌ 오류 발생:', err.message);
  process.exit(1);
});
