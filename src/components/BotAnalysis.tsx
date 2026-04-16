import { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Trade, ActivityRow } from '../utils/parser';
import { TraderStats } from '../utils/analytics';

interface BotAnalysisProps {
  trades: Trade[];
  activities: ActivityRow[];
  traderStats: Map<string, TraderStats>;
}

const CLASS_COLORS: Record<string, string> = {
  F: '#38bdf8', M: '#10b981', B: '#8b5cf6', I: '#f59e0b', S: '#94a3b8',
};
const CLASS_LABELS: Record<string, string> = {
  F: 'Firm', M: 'Market Maker', B: 'Big Taker', I: 'Informed', S: 'Small',
};

// Golden-ratio deterministic jitter: maps index i to a value in [-1, 1]
function goldenJitter(i: number): number {
  return ((i * 0.618033988749895) % 1) * 2 - 1;
}

export function BotAnalysis({ trades, traderStats }: BotAnalysisProps) {
  const traderCharts = useMemo(() => {
    if (trades.length === 0) return [];

    const allPrices = trades.map(t => t.price);
    const minP = Math.min(...allPrices);
    const maxP = Math.max(...allPrices);
    const pRange = maxP - minP;

    const toPercentile = (price: number) =>
      pRange > 0 ? ((price - minP) / pRange) * 100 : 50;

    return Array.from(traderStats.values())
      .filter(s => s.traderId !== 'SUBMISSION')
      .map(s => {
        const traderTrades = trades.filter(
          t => t.buyer === s.traderId || t.seller === s.traderId
        );

        const buys: { x: number; y: number }[] = [];
        const sells: { x: number; y: number }[] = [];

        let buyIdx = 0;
        let sellIdx = 0;
        for (const t of traderTrades) {
          const x = toPercentile(t.price);
          if (t.buyer === s.traderId) {
            buys.push({ x, y: goldenJitter(buyIdx++) });
          }
          if (t.seller === s.traderId) {
            sells.push({ x, y: goldenJitter(sellIdx++) });
          }
        }

        const avgBuyPct =
          buys.length > 0
            ? buys.reduce((acc, p) => acc + p.x, 0) / buys.length
            : 50;
        const avgSellPct =
          sells.length > 0
            ? sells.reduce((acc, p) => acc + p.x, 0) / sells.length
            : 50;

        let label: string;
        let summaryColor: string;
        if (avgBuyPct < 35 && avgSellPct > 65) {
          label = 'likely informed';
          summaryColor = 'var(--yellow)';
        } else if (
          Math.abs(avgBuyPct - 50) < 20 &&
          Math.abs(avgSellPct - 50) < 20
        ) {
          label = 'likely market maker';
          summaryColor = 'var(--accent)';
        } else {
          label = 'no clear pattern';
          summaryColor = 'var(--text-muted)';
        }

        const summary = `Buys avg at ${avgBuyPct.toFixed(0)}th percentile, sells avg at ${avgSellPct.toFixed(0)}th percentile — ${label}`;

        return {
          traderId: s.traderId,
          traderClass: s.traderClass,
          buys,
          sells,
          avgBuyPct,
          avgSellPct,
          summary,
          summaryColor,
          informedScore: avgSellPct - avgBuyPct,
        };
      })
      .sort((a, b) => b.informedScore - a.informedScore);
  }, [trades, traderStats]);

  if (traderCharts.length === 0) {
    return (
      <div
        className="glass-panel"
        style={{
          marginTop: '1.5rem',
          color: 'var(--text-muted)',
          textAlign: 'center',
          padding: '2rem',
        }}
      >
        No market participant data available for analysis.
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ marginTop: '1.5rem' }}>
      <h2 style={{ marginBottom: '0.5rem' }}>Informed Trader Detection</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
        Does this bot buy near daily lows and sell near daily highs? Each strip shows where each
        trader's buys (green) and sells (red) land across the day's price range (0% = daily low,
        100% = daily high). Sorted by most informed-looking first.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {traderCharts.map(trader => (
          <div key={trader.traderId} className="glass-panel" style={{ padding: '1rem' }}>
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem' }}>
                {trader.traderId}
              </span>
              <span
                style={{
                  color: CLASS_COLORS[trader.traderClass] ?? '#94a3b8',
                  fontSize: '0.75rem',
                  background: `${CLASS_COLORS[trader.traderClass] ?? '#94a3b8'}22`,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  fontWeight: 600,
                }}
              >
                {trader.traderClass} — {CLASS_LABELS[trader.traderClass] ?? trader.traderClass}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: 'auto' }}>
                {trader.buys.length}B / {trader.sells.length}S trades
              </span>
            </div>

            {/* Scatter strip chart */}
            <ResponsiveContainer width="100%" height={120}>
              <ScatterChart margin={{ top: 5, right: 15, bottom: 20, left: 0 }}>
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={v => `${v}%`}
                  fontSize={11}
                  stroke="var(--text-muted)"
                  label={{
                    value: 'Price percentile (0% = daily low, 100% = daily high)',
                    position: 'insideBottom',
                    offset: -12,
                    fontSize: 10,
                    fill: 'var(--text-muted)',
                  }}
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  domain={[-1.2, 1.2]}
                  hide
                />
                <RechartsTooltip
                  cursor={false}
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                  }}
                  formatter={(val: number, name: string) =>
                    name === 'x' ? [`${val.toFixed(1)}th percentile`, 'Price'] : [null, null]
                  }
                  labelFormatter={() => ''}
                />
                {/* Avg buy line */}
                {trader.buys.length > 0 && (
                  <ReferenceLine
                    x={trader.avgBuyPct}
                    stroke="#10b981"
                    strokeDasharray="3 2"
                    strokeWidth={1.5}
                    label={{
                      value: `↑${trader.avgBuyPct.toFixed(0)}%`,
                      position: 'top',
                      fontSize: 10,
                      fill: '#10b981',
                    }}
                  />
                )}
                {/* Avg sell line */}
                {trader.sells.length > 0 && (
                  <ReferenceLine
                    x={trader.avgSellPct}
                    stroke="#ef4444"
                    strokeDasharray="3 2"
                    strokeWidth={1.5}
                    label={{
                      value: `↓${trader.avgSellPct.toFixed(0)}%`,
                      position: 'top',
                      fontSize: 10,
                      fill: '#ef4444',
                    }}
                  />
                )}
                <Scatter
                  name="Buys"
                  data={trader.buys}
                  fill="#10b981"
                  opacity={0.65}
                  r={3}
                />
                <Scatter
                  name="Sells"
                  data={trader.sells}
                  fill="#ef4444"
                  opacity={0.65}
                  r={3}
                />
              </ScatterChart>
            </ResponsiveContainer>

            {/* Summary line */}
            <p
              style={{
                fontSize: '0.8rem',
                color: trader.summaryColor,
                marginTop: '0.25rem',
                marginBottom: 0,
              }}
            >
              {trader.summary}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
