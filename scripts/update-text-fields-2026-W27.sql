-- ============================================================
-- 2026-W27 추가 기업 valuation_frame + one_line_summary UPDATE
-- 스냅샷 id 116~132 (AMZN·SPCX·AMD·AVGO·ASML·TSM·PLTR·SMCI·IONQ·CRWD·COIN·HOOD·ARM·MRVL·MU·ORCL·DELL)
-- Supabase SQL Editor에서 실행
-- ============================================================

-- AMZN (id: 116)
UPDATE report_snapshots SET
  valuation_frame   = 'AWS 성장·광고 마진·AI 서비스 모듈이 상단 306달러를 지지하고, 소비 둔화·CAPEX 리스크를 반영한 보수 하우스가 230달러를 하단으로 제시.',
  one_line_summary  = 'AWS·광고·AI 인프라 성장이 이끄는 Buy 컨센서스, 상하단 레인지 넓음.'
WHERE id = 116;

-- SPCX (id: 117)
UPDATE report_snapshots SET
  valuation_frame   = 'Starlink·AI 인프라·발사 서비스 성장을 반영한 상단 310달러와, IPO 밸류에이션 과열을 주장하는 Morningstar의 63달러 하단이 극단적으로 벌어진 혼조 구조.',
  one_line_summary  = 'IPO 직후 강세와 극단 보수 Sell이 공존하는 고변동성 혼조 구간.'
WHERE id = 117;

-- AMD (id: 118)
UPDATE report_snapshots SET
  valuation_frame   = 'AI GPU·CPU 포트폴리오 확장과 데이터센터 수주를 반영해 상단 700달러(Cantor)까지 열려 있고, 밸류 부담을 의식한 하우스가 320달러 하단을 형성.',
  one_line_summary  = 'AI 가속기·데이터센터 모멘텀 기반 Strong Buy, 현재가 대비 업사이드 제한적.'
WHERE id = 118;

-- AVGO (id: 119)
UPDATE report_snapshots SET
  valuation_frame   = 'AI ASIC·네트워킹 포트폴리오 모멘텀이 상단 582달러를 지지하고, 사이클 변동성을 반영한 보수 하우스가 360달러 하단을 제시.',
  one_line_summary  = 'AI ASIC·광대역 네트워크 수요를 기반으로 한 Strong Buy 컨센서스.'
WHERE id = 119;

-- ASML (id: 120)
UPDATE report_snapshots SET
  valuation_frame   = '하이NA EUV 장기 수요와 450억달러 백로그가 상단 2,500달러를 지지하고, 규제·수출통제·사이클 리스크를 반영한 보수 하우스가 980달러 하단을 형성.',
  one_line_summary  = 'AI·첨단 공정 투자 사이클의 핵심 장비 독점 기업, 현재가 근접 Buy 컨센서스.'
WHERE id = 120;

-- TSM (id: 121)
UPDATE report_snapshots SET
  valuation_frame   = 'AI 반도체 파운드리 수요와 A16 등 첨단 공정 리더십이 상단 590달러(BofA)를 지지하고, 지정학·보조금 리스크를 반영한 하단 210달러가 레인지를 형성.',
  one_line_summary  = '글로벌 파운드리 독점 지위 기반 Strong Buy, 현재가 대비 업사이드는 거의 소진.'
WHERE id = 121;

-- PLTR (id: 122)
UPDATE report_snapshots SET
  valuation_frame   = 'AI 플랫폼·정부·상업 매출 확장을 반영해 상단 255달러(Wedbush 등)가 열려 있고, 밸류에이션 멀티플 부담을 경계하는 하우스가 70달러 극단 하단을 제시하는 넓은 레인지.',
  one_line_summary  = 'AI·정부 데이터 플랫폼 기반 Moderate Buy, 밸류 부담으로 컨센서스 분열.'
WHERE id = 122;

-- SMCI (id: 123)
UPDATE report_snapshots SET
  valuation_frame   = 'AI 서버·고밀도 시스템 수요를 반영한 상단 93달러(Rosenblatt)와, 밸류·사이클 리스크를 근거로 한 Goldman Sachs의 27달러 Sell이 공존하는 혼조 구조.',
  one_line_summary  = 'AI 서버 수요와 밸류·사이클 리스크가 맞붙은 Hold/Mixed 혼조 구간.'
WHERE id = 123;

-- IONQ (id: 124)
UPDATE report_snapshots SET
  valuation_frame   = '양자 컴퓨팅 상용화 초기 단계에서 AI·클라우드 연계 성장 기대가 상단 30달러(BofA)를 지지하고, 보수적 성장 가정이 12달러 하단을 형성하는 고위험 성장주 구조.',
  one_line_summary  = '양자 컴퓨팅 상용화 초기 수혜주, 소수 커버리지 기반 Buy 컨센서스.'
WHERE id = 124;

-- CRWD (id: 125)
UPDATE report_snapshots SET
  valuation_frame   = '클라우드 보안·엔드포인트 플랫폼 ARR 성장이 상단 850달러를 지지하고, 밸류에이션 부담을 반영한 보수 하우스가 413달러 하단을 제시. 현재가가 컨센서스 평균에 거의 도달.',
  one_line_summary  = '사이버보안 플랫폼 리더 Strong Buy, 현재가가 컨센서스 평균에 근접.'
WHERE id = 125;

-- COIN (id: 126)
UPDATE report_snapshots SET
  valuation_frame   = '''Everything Exchange'' 전략과 토큰화 주식·신규 서비스 확장이 상단 417달러를 지지하고, Barclays의 Underweight 107달러 하단이 크립토 변동성 리스크를 반영.',
  one_line_summary  = '크립토 플랫폼 확장 기반 Buy 컨센서스, 현재가 대비 업사이드 62%.'
WHERE id = 126;

-- HOOD (id: 127)
UPDATE report_snapshots SET
  valuation_frame   = '레코드급 거래 볼륨·AUM 확대·수익 다변화가 상단 170달러(JMP)를 지지하고, 비즈니스 모델 리스크를 경계한 48달러 하단(Redburn)이 레인지를 형성.',
  one_line_summary  = '플랫폼 성장·수익 다변화 기반 Strong Buy, 현재가가 컨센서스 평균에 근접.'
WHERE id = 127;

-- ARM (id: 128)
UPDATE report_snapshots SET
  valuation_frame   = 'AI·클라우드·엣지에서의 아키텍처 확산과 로열티 성장률이 상단 500달러(Bernstein)를 지지하고, 밸류 부담을 반영한 하단 170달러가 레인지를 형성. 현재가가 컨센서스 평균을 상회.',
  one_line_summary  = 'AI 아키텍처 확산 수혜 Buy 컨센서스, 현재가가 이미 평균 목표를 초과.'
WHERE id = 128;

-- MRVL (id: 129)
UPDATE report_snapshots SET
  valuation_frame   = 'AI 데이터센터·광학 인터커넥트·커스텀 실리콘 수요가 상단 385달러(KeyBanc)를 지지하고, 사이클 리스크를 반영한 하단 110달러가 레인지를 형성.',
  one_line_summary  = 'AI 연결성·커스텀 실리콘 수요 기반 Strong Buy 컨센서스.'
WHERE id = 129;

-- MU (id: 130)
UPDATE report_snapshots SET
  valuation_frame   = 'HBM·DRAM 가격 상승과 AI 메모리 수요 구조적 성장이 상단 2,000달러(Cantor)까지 열어두고, 메모리 사이클 반전 리스크를 반영한 500달러 하단이 레인지를 형성.',
  one_line_summary  = 'HBM·AI 메모리 수요가 이끄는 Strong Buy, 사이클 리레이팅 기대 포함.'
WHERE id = 130;

-- ORCL (id: 131)
UPDATE report_snapshots SET
  valuation_frame   = 'AI 클라우드·데이터베이스·애플리케이션 포트폴리오 성장이 상단 400달러를 지지하고, 밸류·성장 속도 리스크가 155달러 하단을 형성. 현재가 대비 업사이드가 대형주 중 두드러지게 크다.',
  one_line_summary  = 'AI 클라우드·데이터 기반 Buy, 현재가 대비 업사이드 79%로 대형주 중 최상위.'
WHERE id = 131;

-- DELL (id: 132)
UPDATE report_snapshots SET
  valuation_frame   = 'AI 서버 사업 확장과 엔터프라이즈 IT 수요가 상단 200달러를 지지하고, PC·서버 사이클 둔화와 경쟁 리스크가 101달러 하단을 형성.',
  one_line_summary  = 'AI 서버·엔터프라이즈 IT 수요 기반 Buy, 현재가 대비 33% 업사이드 존재.'
WHERE id = 132;
