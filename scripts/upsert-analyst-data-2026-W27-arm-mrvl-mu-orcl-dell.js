/**
 * upsert-analyst-data-2026-W27-arm-mrvl-mu-orcl-dell.js
 *
 * ARM + MRVL + MU + ORCL + DELL
 * 컨센서스 스냅샷 + 애널리스트 뷰 Supabase upsert
 * 기준일: 2026-07-03 (2026-W27)
 *
 * 실행 방법:
 *   export SUPABASE_SERVICE_KEY="eyJ..."
 *   node scripts/upsert-analyst-data-2026-W27-arm-mrvl-mu-orcl-dell.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://qefddgigiujosvormkyr.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ 환경변수 SUPABASE_SERVICE_KEY가 없습니다.');
  console.error('   실행: export SUPABASE_SERVICE_KEY="eyJ..." && node scripts/upsert-analyst-data-2026-W27-arm-mrvl-mu-orcl-dell.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const AS_OF    = '2026-07-03';
const WEEK_KEY = '2026-W27';

// ============================================================
// 컨센서스 스냅샷 (5개)
// ============================================================
const SNAPSHOTS = [
  {
    ticker: 'ARM',
    rating_consensus: 'Buy',
    analyst_count: 23,
    target_mean: 279.83,
    target_median: 280.0,
    target_high: 500.0,
    target_high_analyst: 'Bernstein (Jun 17, 2026)',
    target_low: 170.0,
    target_low_analyst: '보수적 성장·밸류 하우스',
    upside_pct: -8.2,
  },
  {
    ticker: 'MRVL',
    rating_consensus: 'Strong Buy',
    analyst_count: 30,
    target_mean: 249.33,
    target_median: 250.0,
    target_high: 385.0,
    target_high_analyst: 'KeyBanc 등 상단 강세 하우스',
    target_low: 110.0,
    target_low_analyst: '보수적 밸류·사이클 하우스',
    upside_pct: 21.6,
  },
  {
    ticker: 'MU',
    rating_consensus: 'Strong Buy',
    analyst_count: 29,
    target_mean: 1311.43,
    target_median: 1300.0,
    target_high: 2000.0,
    target_high_analyst: 'Cantor Fitzgerald (Jun 29, 2026)',
    target_low: 500.0,
    target_low_analyst: '보수적 메모리/사이클 하우스',
    upside_pct: 34.4,
  },
  {
    ticker: 'ORCL',
    rating_consensus: 'Buy',
    analyst_count: 40,
    target_mean: 251.85,
    target_median: 268.27,
    target_high: 400.0,
    target_high_analyst: '최상단 강세 하우스',
    target_low: 155.0,
    target_low_analyst: '보수적 가치 하우스',
    upside_pct: 79.5,
  },
  {
    ticker: 'DELL',
    rating_consensus: 'Buy',
    analyst_count: 42,
    target_mean: 164.45,
    target_median: 167.0,
    target_high: 200.0,
    target_high_analyst: '최상단 강세 하우스',
    target_low: 101.0,
    target_low_analyst: '보수적 하우스',
    upside_pct: 33.2,
  },
];

// ============================================================
// 개별 애널리스트 뷰 (18개)
// ============================================================
const ANALYST_VIEWS = [
  // ── ARM (4개) ──────────────────────────────────────────
  {
    ticker: 'ARM',
    analyst_name: 'David Dai',
    house: 'Bernstein',
    rating: 'Outperform',
    target_price: 500.0,
    thesis_summary: 'Arm을 \'AI·데이터센터 라이선스 구조의 구조적 수혜주\'로 보고, 목표가를 300→500달러로 상향, AI·클라우드·엣지에서의 아키텍처 확산을 핵심 근거로 제시.',
    report_date: '2026-06-17',
  },
  {
    ticker: 'ARM',
    analyst_name: 'John Vinh',
    house: 'KeyBanc Capital Markets',
    rating: 'Overweight',
    target_price: 300.0,
    thesis_summary: 'AI·데이터센터 수요 가속을 반영해 목표가를 170→300달러로 상향, Arm 리라이선싱과 로열티 성장률을 장기 성장축으로 보는 강세 뷰.',
    report_date: '2026-05-07',
  },
  {
    ticker: 'ARM',
    analyst_name: 'Team',
    house: 'TD Cowen',
    rating: 'Outperform',
    target_price: 475.0,
    thesis_summary: 'AI·모바일·엣지 디바이스에서 Arm 아키텍처의 채택 확대를 반영해 265→475달러로 목표가를 상향, 라이선스·로열티 매출의 장기 컴파운딩을 강조.',
    report_date: '2026-06-24',
  },
  {
    ticker: 'ARM',
    analyst_name: 'Team',
    house: 'UBS',
    rating: 'Buy',
    target_price: 410.0,
    thesis_summary: '데이터센터·자동차·IoT에서 Arm 기반 설계 확산을 반영해 약 410달러 목표를 제시, 밸류 부담에도 불구하고 구조적 성장주로 평가.',
    report_date: '2026-06-23',
  },

  // ── MRVL (5개) ──────────────────────────────────────────
  {
    ticker: 'MRVL',
    analyst_name: 'Team',
    house: 'KeyBanc Capital Markets',
    rating: 'Overweight',
    target_price: 385.0,
    thesis_summary: 'AI 데이터센터·광학 인터커넥트·커스텀 실리콘 수요를 반영해 목표가를 260→385달러로 상향, MRVL을 \'AI 연결성 코어\'로 규정.',
    report_date: '2026-06-18',
  },
  {
    ticker: 'MRVL',
    analyst_name: 'Team',
    house: 'BofA Securities',
    rating: 'Buy',
    target_price: 365.0,
    thesis_summary: 'AI 인프라·스토리지·네트워크 솔루션 성장률 상향을 반영해 PT를 240→365달러로 상향, 중장기 매출·마진 레버리지를 핵심 논리로 제시.',
    report_date: '2026-06-23',
  },
  {
    ticker: 'MRVL',
    analyst_name: 'Team',
    house: 'Jefferies',
    rating: 'Buy',
    target_price: 325.0,
    thesis_summary: '커스텀 컴퓨트와 네트워크 스위치 제품 포트폴리오의 확장을 반영해 235→325달러로 목표가를 상향, AI 서버 인프라 내 침투율 상승을 기대.',
    report_date: '2026-06-26',
  },
  {
    ticker: 'MRVL',
    analyst_name: 'Team',
    house: 'UBS',
    rating: 'Buy',
    target_price: 340.0,
    thesis_summary: '높은 순이익률(약 29%)과 AI 수요를 반영해 230→340달러로 목표가를 상향, 데이터센터·통신에서의 구조적 성장주로 평가.',
    report_date: '2026-06-29',
  },
  {
    ticker: 'MRVL',
    analyst_name: 'Team',
    house: 'Cantor Fitzgerald',
    rating: 'Hold',
    target_price: 300.0,
    thesis_summary: '성장 잠재력은 인정하지만 밸류에이션과 사이클 리스크를 감안해 220→300달러로 목표가를 상향하면서도 Hold를 유지하는 신중한 뷰.',
    report_date: '2026-06-29',
  },

  // ── MU (4개) ──────────────────────────────────────────
  {
    ticker: 'MU',
    analyst_name: 'Quinn Bolton',
    house: 'Needham',
    rating: 'Buy',
    target_price: 1550.0,
    thesis_summary: 'FY28 비GAAP EPS 155달러의 10배를 적용해 목표가를 500→1,550달러로 상향, HBM·DRAM 가격 상승과 AI 메모리 수요를 핵심 가정으로 삼음.',
    report_date: '2026-06-22',
  },
  {
    ticker: 'MU',
    analyst_name: 'Mark Li',
    house: 'Bernstein',
    rating: 'Buy',
    target_price: 1300.0,
    thesis_summary: 'HBM 가격·공급 타이트니스와 메모리 사이클 강세를 반영해 510→1,300달러로 목표가를 상향, 장기 가격·마진 레버리지를 강조.',
    report_date: '2026-06-22',
  },
  {
    ticker: 'MU',
    analyst_name: 'Team',
    house: 'Susquehanna',
    rating: 'Buy',
    target_price: 1750.0,
    thesis_summary: 'AI 메모리·HBM 수요가 예상보다 크게 확대될 것으로 보고 1,750달러까지 상단을 제시, 메모리 사이클의 구조적 리레이팅을 가정.',
    report_date: '2026-06-22',
  },
  {
    ticker: 'MU',
    analyst_name: 'Team',
    house: 'Cantor Fitzgerald',
    rating: 'Buy',
    target_price: 2000.0,
    thesis_summary: '최근 리포트에서 1,500→2,000달러로 목표가를 상향, MU를 메모리·AI 인프라 양쪽에서의 핵심 수혜주로 보며 100%+ 업사이드 가능성을 언급.',
    report_date: '2026-06-29',
  },

  // ── ORCL (2개) ──────────────────────────────────────────
  {
    ticker: 'ORCL',
    analyst_name: 'Keith Bachman',
    house: 'BMO Capital',
    rating: 'Market Perform',
    target_price: 240.0,
    thesis_summary: 'Q4 실적 이후 AI 클라우드·데이터베이스·애플리케이션 포트폴리오를 반영해 목표가를 상향, 현재 가격 대비 6%+ 업사이드가 있다고 평가하는 중립적 뷰.',
    report_date: '2026-06-11',
  },
  {
    ticker: 'ORCL',
    analyst_name: 'Team',
    house: 'POEMS',
    rating: 'Buy',
    target_price: 237.0,
    thesis_summary: 'AI 클라우드·데이터·애플리케이션에서의 성장 잠재력을 반영해 237달러 목표와 Buy를 유지, 현재 밸류는 성장 기대를 충분히 반영하지 못했다고 판단.',
    report_date: '2026-06-15',
  },

  // ── DELL (3개) ──────────────────────────────────────────
  {
    ticker: 'DELL',
    analyst_name: 'Team',
    house: 'Goldman Sachs',
    rating: 'Buy',
    target_price: 185.0,
    thesis_summary: 'AI 서버 사업 호조와 Q1 가이던스 상향을 반영해 PT를 175→185달러로 상향, Dell의 AI 서버 레버리지를 핵심 성장축으로 본다.',
    report_date: '2025-11-26',
  },
  {
    ticker: 'DELL',
    analyst_name: 'Team',
    house: 'Morgan Stanley',
    rating: 'Overweight',
    target_price: 113.0,
    thesis_summary: 'AI 서버 매출이 실적과 가이던스를 견인한다는 가정 하에 113달러 목표를 제시, 기존 PC·인프라 사업 대비 AI 서버의 성장 기여도를 강조.',
    report_date: '2026-05-31',
  },
  {
    ticker: 'DELL',
    analyst_name: 'Team',
    house: 'BofA Securities',
    rating: 'Buy',
    target_price: 163.0,
    thesis_summary: '향후 5년 EPS 연 15% 성장 가정을 반영해 163달러 목표를 제시, AI 서버·인프라·서비스 수익 확장을 핵심 논리로 삼는 강세 뷰.',
    report_date: '2026-05-31',
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
  console.log('대상: ARM + MRVL + MU + ORCL + DELL\n');

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
  console.log(`   뷰: ${ANALYST_VIEWS.length}개 처리 (ARM 4개 + MRVL 5개 + MU 4개 + ORCL 2개 + DELL 3개)`);
  console.log('\n📋 https://ezlong.com/analyst-reports.html 에서 ARM·MRVL·MU·ORCL·DELL 확인');
}

main().catch(err => {
  console.error('\n❌ 오류 발생:', err.message);
  process.exit(1);
});
