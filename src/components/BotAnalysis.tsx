import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { Trade, ActivityRow } from '../utils/parser';
import { TraderStats, TraderClass, computeAutocorrelations } from '../utils/analytics';

interface BotAnalysisProps {
  trades: Trade[];
  activities: ActivityRow[];
  traderStats: Map<string, TraderStats>;
}

const CLASS_COLORS: Record<TraderClass, string> = {
  F: '#38bdf8',
  M: '#10b981',
  B: '#8b5cf6',
  I: '#f59e0b',
  S: '#94a3b8',
};

const CLASS_LABELS: Record<TraderClass, string> = {
  F: 'Firm (Us)',
  M: 'Market Maker',
  B: 'Big Taker',
  I: 'Informed',
  S: 'Small Taker',
};

export function BotAnalysis({ trades, activities, traderStats }: BotAnalysisProps) {
  // Panel 1 & 2: all non-SUBMISSION traders sorted by volume
  const traderRows = useMemo(() => {
    return Array.from(traderStats.values())
      .filter(s => s.traderId !== 'SUBMISSION')
      .sort((a, b) => b.totalVolume - a.totalVolume);
  }, [traderStats]);

  // Panel 3: Return autocorrelation
  const acfData = useMemo(() => {
    const midPrices = activities
      .map(a => a.mid_price)
      .filter((v): v is number => v != null);
    return computeAutocorrelations(midPrices, 10);
  }, [activities]);

  const lag1Acf = acfData[0]?.acf ?? 0;
  const marketStructureLabel = lag1Acf < -0.05
    ? 'Mean-Reverting structure (negative Lag-1 ACF)'
    : lag1Acf > 0.05
    ? 'Momentum structure (positive Lag-1 ACF)'
    : 'No strong autocorrelation structure';

  // Panel 4: Bot quoting patterns
  const quotingPatterns = useMemo(() => {
    return traderRows.map(s => {
      const traderTrades = trades.filter(
        t => t.buyer === s.traderId || t.seller === s.traderId
      );
      const freq = new Map<number, number>();
      for (const t of traderTrades) {
        freq.set(t.price, (freq.get(t.price) ?? 0) + 1);
      }
      const top5 = Array.from(freq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      const roundNumberQuoter = top5.some(([p]) => p % 5 === 0);
      return { traderId: s.traderId, traderClass: s.traderClass, top5, roundNumberQuoter };
    });
  }, [traderRows, trades]);

  if (traderRows.length === 0 && acfData.length === 0) {
    return (
      <div className="glass-panel" style={{ marginTop: '1.5rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
        No market participant data available for analysis.
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ marginTop: '1.5rem' }}>
      <h2 style={{ marginBottom: '0.5rem' }}>Bot Analysis</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
        Statistical breakdown of all market participants for this product.
      </p>

      {/* ── Panel 1: Trader Behavior Table ── */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Trader Behavior
        </h3>
        {traderRows.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No other traders found in trade history.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="analysis-table">
              <thead>
                <tr>
                  <th>Trader</th>
                  <th>Class</th>
                  <th>Volume</th>
                  <th>Trades</th>
                  <th>Avg Size</th>
                  <th>Buy %</th>
                  <th>Avg Edge</th>
                </tr>
              </thead>
              <tbody>
                {traderRows.map(row => (
                  <tr key={row.traderId}>
                    <td style={{ fontFamily: 'monospace' }}>{row.traderId}</td>
                    <td>
                      <span style={{
                        color: CLASS_COLORS[row.traderClass],
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        background: `${CLASS_COLORS[row.traderClass]}22`,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                      }}>
                        {row.traderClass} — {CLASS_LABELS[row.traderClass]}
                      </span>
                    </td>
                    <td>{row.totalVolume.toLocaleString()}</td>
                    <td>{row.tradeCount}</td>
                    <td>{row.avgSize.toFixed(1)}</td>
                    <td>{(row.buySellRatio * 100).toFixed(0)}%</td>
                    <td style={{ color: row.avgEdge >= 0 ? 'var(--tomato)' : 'var(--emerald)', fontFamily: 'monospace' }}>
                      {row.avgEdge >= 0 ? '+' : ''}{row.avgEdge.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
          Avg Edge: positive = paid above mid (aggressive buyer); negative = received above mid (passive seller).
        </p>
      </section>

      {/* ── Panel 2: Informed Trader Detection ── */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Informed Trader Detection
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
          Flagged if &gt;60% of buys occurred in the bottom 20% of the day's price range, or &gt;60% of sells in the top 20%.
        </p>
        {traderRows.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No data.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="analysis-table">
              <thead>
                <tr>
                  <th>Trader</th>
                  <th>Buys in Bottom 20%</th>
                  <th>Sells in Top 20%</th>
                  <th>Suspected Informed</th>
                </tr>
              </thead>
              <tbody>
                {traderRows.map(row => {
                  const suspected = row.fracBuysLow > 0.6 || row.fracSellsHigh > 0.6;
                  return (
                    <tr key={row.traderId}>
                      <td style={{ fontFamily: 'monospace' }}>{row.traderId}</td>
                      <td style={{ color: row.fracBuysLow > 0.6 ? 'var(--yellow)' : 'var(--text)' }}>
                        {(row.fracBuysLow * 100).toFixed(1)}%
                      </td>
                      <td style={{ color: row.fracSellsHigh > 0.6 ? 'var(--yellow)' : 'var(--text)' }}>
                        {(row.fracSellsHigh * 100).toFixed(1)}%
                      </td>
                      <td>
                        {suspected
                          ? <span style={{ color: 'var(--yellow)', fontWeight: 700 }}>YES ⚑</span>
                          : <span style={{ color: 'var(--text-muted)' }}>No</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Panel 3: Return Autocorrelation ── */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Mid-Price Return Autocorrelation (Lags 1–10)
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
          Negative autocorrelation → mean reversion. Positive → momentum. Dashed lines = 95% CI.
        </p>
        {acfData.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Not enough data to compute autocorrelation.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={acfData} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="lag"
                  stroke="var(--text-muted)"
                  fontSize={12}
                  tickFormatter={v => `Lag ${v}`}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  fontSize={12}
                  domain={[-1, 1]}
                  tickFormatter={v => v.toFixed(2)}
                  width={50}
                />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                  formatter={(val: number) => [val.toFixed(4), 'ACF']}
                  labelFormatter={l => `Lag ${l}`}
                />
                {acfData[0] && (
                  <>
                    <ReferenceLine y={acfData[0].ciUpper} stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5} />
                    <ReferenceLine y={acfData[0].ciLower} stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5} />
                    <ReferenceLine y={0} stroke="var(--border)" />
                  </>
                )}
                <Bar dataKey="acf" name="ACF" radius={[3, 3, 0, 0]}>
                  {acfData.map((entry, i) => (
                    <Cell key={i} fill={entry.acf >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p style={{ color: 'var(--accent)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
              Lag-1 ACF = {lag1Acf.toFixed(4)} — <strong>{marketStructureLabel}</strong>
            </p>
          </>
        )}
      </section>

      {/* ── Panel 4: Bot Quoting Patterns ── */}
      <section>
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Bot Quoting Patterns
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
          Most frequent trade prices per participant. "Round Quoter" flag = top prices are multiples of 5.
        </p>
        {quotingPatterns.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No data.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {quotingPatterns.map(p => (
              <div key={p.traderId} className="glass-panel" style={{ padding: '1rem' }}>
                <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem' }}>{p.traderId}</span>
                  <span style={{
                    color: CLASS_COLORS[p.traderClass],
                    fontSize: '0.7rem',
                    background: `${CLASS_COLORS[p.traderClass]}22`,
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                  }}>{p.traderClass}</span>
                  {p.roundNumberQuoter && (
                    <span style={{
                      color: 'var(--yellow)', fontSize: '0.7rem',
                      background: 'rgba(245,158,11,0.15)',
                      padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700,
                    }}>ROUND QUOTER</span>
                  )}
                </div>
                {p.top5.map(([price, count]) => (
                  <div key={price} className="tooltip-row" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{price}</span>
                    <span>{count}×</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
