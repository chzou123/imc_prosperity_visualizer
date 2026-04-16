import { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { ActivityRow } from '../utils/parser';

interface BotAnalysisProps {
  activities: ActivityRow[];
}

interface InferredTrade {
  timestamp: number;
  price: number;
  side: 'buy' | 'sell';
  quantity: number;
}

function buildLevelMap(
  p1: number | undefined, v1: number | undefined,
  p2: number | undefined, v2: number | undefined,
  p3: number | undefined, v3: number | undefined,
): Map<number, number> {
  const m = new Map<number, number>();
  const pairs: [number | undefined, number | undefined][] = [[p1, v1], [p2, v2], [p3, v3]];
  for (const [p, v] of pairs) {
    if (p != null && p > 0 && v != null && v > 0) m.set(p, v);
  }
  return m;
}

const TooltipContent = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const x: number = payload[0]?.payload?.x;
  if (x == null) return null;
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: '8px', padding: '0.4rem 0.75rem', fontSize: '0.8rem',
    }}>
      {x.toFixed(1)}th percentile
    </div>
  );
};

export function BotAnalysis({ activities }: BotAnalysisProps) {
  const result = useMemo(() => {
    if (activities.length < 2) return null;

    // ── Step 1: Infer trades from order book deltas ───────────────────────────
    const inferredTrades: InferredTrade[] = [];

    for (let i = 1; i < activities.length; i++) {
      const prev = activities[i - 1];
      const curr = activities[i];

      const prevBids = buildLevelMap(
        prev.bid_price_1, prev.bid_volume_1,
        prev.bid_price_2, prev.bid_volume_2,
        prev.bid_price_3, prev.bid_volume_3,
      );
      const currBids = buildLevelMap(
        curr.bid_price_1, curr.bid_volume_1,
        curr.bid_price_2, curr.bid_volume_2,
        curr.bid_price_3, curr.bid_volume_3,
      );
      const prevAsks = buildLevelMap(
        prev.ask_price_1, prev.ask_volume_1,
        prev.ask_price_2, prev.ask_volume_2,
        prev.ask_price_3, prev.ask_volume_3,
      );
      const currAsks = buildLevelMap(
        curr.ask_price_1, curr.ask_volume_1,
        curr.ask_price_2, curr.ask_volume_2,
        curr.ask_price_3, curr.ask_volume_3,
      );

      // Lifted asks → inferred aggressive buy
      for (const [price, prevVol] of prevAsks) {
        const currVol = currAsks.get(price) ?? 0;
        if (currVol < prevVol) {
          inferredTrades.push({ timestamp: curr.timestamp, price, side: 'buy', quantity: prevVol - currVol });
        }
      }

      // Hit bids → inferred aggressive sell
      for (const [price, prevVol] of prevBids) {
        const currVol = currBids.get(price) ?? 0;
        if (currVol < prevVol) {
          inferredTrades.push({ timestamp: curr.timestamp, price, side: 'sell', quantity: prevVol - currVol });
        }
      }
    }

    // ── Step 2: Running min/max per day (detect day by timestamp reset) ───────
    const runningStats = new Map<number, { min: number; max: number }>();
    let runningMin = Infinity;
    let runningMax = -Infinity;
    let prevTs = -Infinity;

    for (const row of activities) {
      if (row.timestamp < prevTs) {
        // New day — reset
        runningMin = Infinity;
        runningMax = -Infinity;
      }
      prevTs = row.timestamp;
      const mid = row.mid_price;
      if (mid != null && mid > 0) {
        if (mid < runningMin) runningMin = mid;
        if (mid > runningMax) runningMax = mid;
      }
      runningStats.set(row.timestamp, { min: runningMin, max: runningMax });
    }

    // ── Step 3: Compute percentiles and aggregate ─────────────────────────────
    const toPercentile = (price: number, timestamp: number): number => {
      const stats = runningStats.get(timestamp);
      if (!stats || !isFinite(stats.min) || stats.min === stats.max) return 50;
      return Math.max(0, Math.min(100, (price - stats.min) / (stats.max - stats.min) * 100));
    };

    const buys: { x: number; y: number }[] = [];
    const sells: { x: number; y: number }[] = [];

    for (const t of inferredTrades) {
      const x = toPercentile(t.price, t.timestamp);
      const y = Math.random() * 0.5;
      if (t.side === 'buy') buys.push({ x, y });
      else sells.push({ x, y });
    }

    const avgBuyPct = buys.length > 0 ? buys.reduce((s, p) => s + p.x, 0) / buys.length : 50;
    const avgSellPct = sells.length > 0 ? sells.reduce((s, p) => s + p.x, 0) / sells.length : 50;
    const informedScore = avgSellPct - avgBuyPct;

    return { buys, sells, avgBuyPct, avgSellPct, informedScore, totalCount: inferredTrades.length };
  }, [activities]);

  const scoreColor = !result || result.informedScore > 40
    ? 'var(--emerald)'
    : result.informedScore < -40
    ? 'var(--tomato)'
    : 'var(--text-muted)';

  return (
    <div className="glass-panel" style={{ marginTop: '1.5rem' }}>
      <h2 style={{ marginBottom: '0.5rem' }}>Informed Trader Detection</h2>
      <details style={{ marginBottom: '1.5rem' }}>
        <summary style={{ color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}>
          How to read this chart ▾
        </summary>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.75rem', lineHeight: 1.6 }}>
          <p style={{ marginBottom: '0.5rem' }}>
            Each dot represents an aggressive order inferred from the order book —
            when an ask level disappears between timesteps, a bot aggressively bought there (green dot).
            When a bid level disappears, a bot aggressively sold there (red dot).
          </p>
          <p style={{ marginBottom: '0.5rem' }}>
            The x-axis shows WHERE in that day's price range the order happened:
          </p>
          <ul style={{ marginLeft: '1.25rem', marginBottom: '0.5rem' }}>
            <li>0% = the day's lowest price</li>
            <li>100% = the day's highest price</li>
            <li>50% = exactly the middle of the day's range</li>
          </ul>
          <p style={{ marginBottom: '0.25rem' }}>What patterns mean:</p>
          <ul style={{ marginLeft: '1.25rem' }}>
            <li>Green dots clustered LEFT + red dots clustered RIGHT → buy low, sell high → informed/directional trader (like "Olivia" from Frankfurt's writeup)</li>
            <li>Green dots clustered RIGHT + red dots clustered LEFT → buy high, sell low → mean reversion bot enforcing fair value</li>
            <li>Dots spread evenly across both colors → no pattern → passive market maker</li>
          </ul>
        </div>
      </details>

      {!result || result.totalCount < 20 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0', fontSize: '0.9rem' }}>
          Not enough order book activity to detect patterns
          {result ? ` (${result.totalCount} inferred trades, need at least 20)` : ''}.
        </p>
      ) : (
        <>
          {/* Stat chips */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', overflow: 'visible' }}>
            <div className="glass-panel" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Avg Buy Percentile</span>
              <span style={{ marginLeft: '0.5rem', fontWeight: 700, color: 'var(--emerald)' }}>
                {result.avgBuyPct.toFixed(0)}th
              </span>
            </div>
            <div className="glass-panel" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Avg Sell Percentile</span>
              <span style={{ marginLeft: '0.5rem', fontWeight: 700, color: 'var(--tomato)' }}>
                {result.avgSellPct.toFixed(0)}th
              </span>
            </div>
            <div className="glass-panel" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Informed Score</span>
              <span style={{ marginLeft: '0.5rem', fontWeight: 700, color: scoreColor }}>
                {result.informedScore.toFixed(1)}
              </span>
            </div>
            <div className="glass-panel" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Inferred Trades</span>
              <span style={{ marginLeft: '0.5rem', fontWeight: 700 }}>
                {result.buys.length}B / {result.sells.length}S
              </span>
            </div>
          </div>

          {/* Scatter plot */}
          <div style={{ paddingTop: '2rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
          <ResponsiveContainer width="100%" height={250}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 35, left: 0 }}>
              <XAxis
                dataKey="x"
                type="number"
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={v => `${v}%`}
                fontSize={11}
                stroke="var(--text-muted)"
                label={{
                  value: '0 = day low  →  100 = day high',
                  position: 'insideBottom',
                  offset: -20,
                  fontSize: 11,
                  fill: 'var(--text-muted)',
                }}
              />
              <YAxis dataKey="y" type="number" domain={[0, 0.6]} hide />
              <RechartsTooltip content={<TooltipContent />} cursor={false} />

              {/* 50% midpoint reference */}
              <ReferenceLine x={50} stroke="var(--border)" strokeWidth={1.5} />

              {/* Avg buy percentile */}
              {result.buys.length > 0 && (
                <ReferenceLine
                  x={result.avgBuyPct}
                  stroke="#10b981"
                  strokeDasharray="4 2"
                  strokeWidth={1.5}
                  label={{ value: `↑${result.avgBuyPct.toFixed(0)}%`, position: 'top', fontSize: 10, fill: '#10b981' }}
                />
              )}

              {/* Avg sell percentile */}
              {result.sells.length > 0 && (
                <ReferenceLine
                  x={result.avgSellPct}
                  stroke="#ef4444"
                  strokeDasharray="4 2"
                  strokeWidth={1.5}
                  label={{ value: `↓${result.avgSellPct.toFixed(0)}%`, position: 'top', fontSize: 10, fill: '#ef4444' }}
                />
              )}

              <Scatter name="Inferred Buys" data={result.buys} fill="#10b981" opacity={0.6} r={3} />
              <Scatter name="Inferred Sells" data={result.sells} fill="#ef4444" opacity={0.6} r={3} />
            </ScatterChart>
          </ResponsiveContainer>
          </div>

          {/* Summary */}
          <p style={{ fontSize: '0.9rem', marginTop: '1rem', color: scoreColor }}>
            {result.informedScore > 40
              ? <>Aggressive orders cluster low for buys and high for sells — <strong>informed/directional trader pattern detected</strong></>
              : result.informedScore < -40
              ? <>Aggressive orders cluster high for buys and low for sells — <strong>possible mean-reversion bot</strong></>
              : <>Aggressive orders spread evenly across the price range — <strong>no clear informed pattern</strong></>
            }
          </p>
        </>
      )}
    </div>
  );
}
