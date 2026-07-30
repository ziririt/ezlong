'use client';

import { useEffect, useState, useCallback } from 'react';
import type { PositionsResponse, Position } from '@/lib/kis/types';

/* ── 숫자 포맷 헬퍼 ── */
function fmtKrw(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, '') + '억원';
  if (abs >= 1e4) return Math.round(n / 1e4).toLocaleString('ko-KR') + '만원';
  return n.toLocaleString('ko-KR') + '원';
}
function fmtUsd(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPrice(n: number, currency: string): string {
  return currency === 'KRW' ? n.toLocaleString('ko-KR') + '원' : fmtUsd(n);
}
function fmtValue(n: number, currency: string): string {
  return currency === 'KRW' ? fmtKrw(n) : fmtUsd(n);
}
function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}
function toKst(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

/* ── 스타일 상수 ── */
const S = {
  wrap: { maxWidth: 900, margin: '0 auto', padding: '20px 16px 60px' } as React.CSSProperties,
  header: {
    background: 'var(--surface)', borderBottom: '1px solid var(--border)',
    padding: '24px 20px',
  } as React.CSSProperties,
  headerInner: { maxWidth: 900, margin: '0 auto' } as React.CSSProperties,
  label: { fontSize: 14, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'var(--blue)', marginBottom: 6 },
  title: { fontSize: 'clamp(20px,4vw,30px)', fontWeight: 800, letterSpacing: '-.03em', color: 'var(--text)', marginBottom: 4 } as React.CSSProperties,
  sub: { fontSize: 15, color: 'var(--text2)' },
  card: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--r)', padding: '18px 20px', marginBottom: 16,
  } as React.CSSProperties,
  pillRow: { display: 'flex', gap: 10, flexWrap: 'wrap' as const, marginBottom: 20 },
  pill: { padding: '10px 16px', borderRadius: 10, flex: 1, minWidth: 110 } as React.CSSProperties,
  pillLbl: { fontSize: 14, color: 'var(--text2)', marginBottom: 2 },
  pillVal: { fontSize: 18, fontWeight: 800 },
  tblWrap: { overflowX: 'auto' as const },
  tbl: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 14 },
  th: {
    fontSize: 14, fontWeight: 600, color: 'var(--text2)',
    padding: '8px 10px', borderBottom: '1px solid var(--border)',
    textAlign: 'left' as const, whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  td: { padding: '11px 10px', borderBottom: '1px solid var(--border2)', verticalAlign: 'middle' as const } as React.CSSProperties,
  btnPrimary: {
    background: 'var(--blue)', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 20px', fontSize: 15, fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,
  errBox: {
    padding: '14px 16px', background: 'rgba(255,59,48,.08)',
    border: '1px solid rgba(255,59,48,.25)', borderRadius: 8,
    fontSize: 14, color: 'var(--red)', marginBottom: 16,
  } as React.CSSProperties,
  warnBox: {
    padding: '12px 16px', background: 'rgba(255,159,10,.1)',
    border: '1px solid rgba(255,159,10,.3)', borderRadius: 8,
    fontSize: 14, color: '#92400E', marginBottom: 16,
  } as React.CSSProperties,
  badge: {
    display: 'inline-block', padding: '2px 8px', borderRadius: 6,
    fontSize: 12, fontWeight: 700, marginRight: 4,
  } as React.CSSProperties,
  spinner: {
    display: 'inline-block', width: 20, height: 20,
    border: '2px solid var(--border)', borderTopColor: 'var(--blue)',
    borderRadius: '50%', animation: 'spin .8s linear infinite',
  } as React.CSSProperties,
};

/* ── 색상 헬퍼 ── */
function pnlColor(n: number): string {
  if (n > 0) return 'var(--green)';
  if (n < 0) return 'var(--red)';
  return 'var(--text2)';
}

/* ── 메인 컴포넌트 ── */
export default function PortfolioPage() {
  const [data, setData] = useState<PositionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'KR' | 'US'>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/kis/account/positions', { cache: 'no-store' });
      const json: PositionsResponse = await res.json();
      setData(json);
    } catch {
      setData({
        ok: false,
        account: '',
        fetchedAt: new Date().toISOString(),
        positions: [],
        error: 'API 호출 실패. 서버가 실행 중인지 확인해주세요.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── 필터링 ── */
  const positions: Position[] = data?.positions ?? [];
  const filtered = filter === 'ALL'
    ? positions
    : positions.filter((p) => p.market === filter);

  /* ── 합산 (KRW 기준은 원화만, USD는 달러만) ── */
  const totalKrwValue = positions
    .filter((p) => p.currency === 'KRW')
    .reduce((s, p) => s + p.marketValue, 0);
  const totalUsdValue = positions
    .filter((p) => p.currency === 'USD')
    .reduce((s, p) => s + p.marketValue, 0);
  const totalKrwPnl = positions
    .filter((p) => p.currency === 'KRW')
    .reduce((s, p) => s + p.profitLoss, 0);
  const totalUsdPnl = positions
    .filter((p) => p.currency === 'USD')
    .reduce((s, p) => s + p.profitLoss, 0);

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── 헤더 ── */}
      <div style={S.header}>
        <div style={S.headerInner}>
          <div style={S.label}>한국투자증권 Open API</div>
          <h1 style={S.title}>계좌 포트폴리오 현황</h1>
          <p style={S.sub}>
            {data?.account ? `계좌 ${data.account}` : '계좌번호 로딩 중…'}
            {data?.fetchedAt && (
              <span style={{ marginLeft: 10, color: 'var(--text3)', fontSize: 13 }}>
                조회 시각: {toKst(data.fetchedAt)}
              </span>
            )}
          </p>
        </div>
      </div>

      <div style={S.wrap}>
        {/* ── 에러 ── */}
        {data && !data.ok && (
          <div style={S.errBox}>오류: {data.error}</div>
        )}

        {/* ── 경고 ── */}
        {data?.warnings?.map((w, i) => (
          <div key={i} style={S.warnBox}>경고: {w}</div>
        ))}

        {/* ── 요약 카드 ── */}
        {data?.ok && (
          <div style={S.pillRow}>
            {totalKrwValue > 0 && (
              <>
                <div style={{ ...S.pill, background: 'var(--card2)' }}>
                  <div style={S.pillLbl}>국내주식 평가금액</div>
                  <div style={{ ...S.pillVal, color: 'var(--text)' }}>{fmtKrw(totalKrwValue)}</div>
                </div>
                <div style={{
                  ...S.pill,
                  background: totalKrwPnl >= 0 ? 'rgba(52,199,89,.1)' : 'rgba(255,59,48,.08)',
                }}>
                  <div style={S.pillLbl}>국내 평가손익</div>
                  <div style={{ ...S.pillVal, color: pnlColor(totalKrwPnl) }}>{fmtKrw(totalKrwPnl)}</div>
                </div>
              </>
            )}
            {totalUsdValue > 0 && (
              <>
                <div style={{ ...S.pill, background: 'var(--card2)' }}>
                  <div style={S.pillLbl}>해외주식 평가금액</div>
                  <div style={{ ...S.pillVal, color: 'var(--text)' }}>{fmtUsd(totalUsdValue)}</div>
                </div>
                <div style={{
                  ...S.pill,
                  background: totalUsdPnl >= 0 ? 'rgba(52,199,89,.1)' : 'rgba(255,59,48,.08)',
                }}>
                  <div style={S.pillLbl}>해외 평가손익</div>
                  <div style={{ ...S.pillVal, color: pnlColor(totalUsdPnl) }}>{fmtUsd(totalUsdPnl)}</div>
                </div>
              </>
            )}
            <div style={{ ...S.pill, background: 'var(--card2)' }}>
              <div style={S.pillLbl}>총 종목 수</div>
              <div style={{ ...S.pillVal, color: 'var(--text)' }}>{positions.length}종목</div>
            </div>
          </div>
        )}

        {/* ── 컨트롤 바 ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['ALL', 'KR', 'US'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', border: '1px solid var(--border)',
                background: filter === f ? 'var(--blue)' : 'var(--card2)',
                color: filter === f ? '#fff' : 'var(--text2)',
              }}
            >
              {f === 'ALL' ? '전체' : f === 'KR' ? '국내' : '해외'}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button
            onClick={load}
            disabled={loading}
            style={{ ...S.btnPrimary, opacity: loading ? .4 : 1 }}
          >
            {loading ? '조회 중…' : '새로고침'}
          </button>
        </div>

        {/* ── 로딩 ── */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text2)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span style={S.spinner} />
              한국투자증권 API 조회 중…
            </div>
          </div>
        )}

        {/* ── 보유 종목 테이블 ── */}
        {!loading && filtered.length > 0 && (
          <div style={S.card}>
            <div style={S.tblWrap}>
              <table style={S.tbl}>
                <thead>
                  <tr>
                    <th style={S.th}>종목</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>수량</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>평균매입가</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>현재가</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>평가금액</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>평가손익</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>수익률</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--card2)' }}>
                      <td style={S.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            ...S.badge,
                            background: p.market === 'KR' ? 'var(--blue)' : '#E05C00',
                            color: '#fff',
                          }}>
                            {p.market === 'KR' ? 'KR' : p.exchange}
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>
                              {p.symbol}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 1 }}>
                              {p.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...S.td, textAlign: 'right', color: 'var(--text2)' }}>
                        {p.quantity.toLocaleString('ko-KR')}
                      </td>
                      <td style={{ ...S.td, textAlign: 'right', color: 'var(--text2)' }}>
                        {fmtPrice(p.avgPrice, p.currency)}
                      </td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: 'var(--text)' }}>
                        {fmtPrice(p.currentPrice, p.currency)}
                      </td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>
                        {fmtValue(p.marketValue, p.currency)}
                      </td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: pnlColor(p.profitLoss) }}>
                        {p.profitLoss >= 0 ? '+' : ''}{fmtValue(p.profitLoss, p.currency)}
                      </td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: pnlColor(p.profitLossRate) }}>
                        {fmtPct(p.profitLossRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 빈 상태 ── */}
        {!loading && data?.ok && filtered.length === 0 && (
          <div style={{ ...S.card, textAlign: 'center', padding: '40px 20px', color: 'var(--text2)' }}>
            {filter === 'ALL' ? '보유 종목이 없습니다.' : `${filter === 'KR' ? '국내' : '해외'} 보유 종목이 없습니다.`}
          </div>
        )}

        {/* ── 주의사항 ── */}
        <div style={{
          marginTop: 20, padding: '14px 16px', background: 'var(--card2)',
          borderRadius: 8, fontSize: 14, color: 'var(--text2)', lineHeight: 1.7,
        }}>
          <strong style={{ color: 'var(--text)' }}>주의사항</strong><br />
          · 이 도구는 <strong style={{ color: 'var(--text)' }}>조회 전용</strong>입니다. 주문·매매 기능은 없습니다.<br />
          · 현재가는 한국투자증권 API 기준이며 15분 지연될 수 있습니다.<br />
          · 해외주식 손익은 달러 기준이며 원화 환산은 별도 계산이 필요합니다.<br />
          · 투자 판단의 책임은 투자자 본인에게 있습니다.
        </div>
      </div>
    </>
  );
}
