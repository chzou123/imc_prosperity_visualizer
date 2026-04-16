import { useState, useCallback, useMemo } from 'react';
import { UploadCloud, Activity, DollarSign, Box } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  Line, Legend, ComposedChart, Brush, LineChart, BarChart, Bar,
} from 'recharts';
import { parseZipLog, ParsedData } from './utils/parser';
import {
  computeWallMid, classifyTraders, computeSharpe,
  computeRollingVolatility, computeTotalVolatility,
  computeMaxDrawdown, computeWinRate, buildPnlHistogram,
  TraderClass, TraderStats,
} from './utils/analytics';
import { BotAnalysis } from './components/BotAnalysis';

// ── Custom dot components ─────────────────────────────────────────────────────

const MakerBuyDot = (props: any) => {
  const { cx, cy, payload, dataKey } = props;
  if (cx == null || cy == null || payload[dataKey] == null) return null;
  return (
    <rect x={cx - 6} y={cy - 6} width={12} height={12}
      fill="#10b981" stroke="#ffffff" strokeWidth={1}
      style={{ filter: 'drop-shadow(0px 0px 5px #10b981)' }} />
  );
};

const MakerSellDot = (props: any) => {
  const { cx, cy, payload, dataKey } = props;
  if (cx == null || cy == null || payload[dataKey] == null) return null;
  return (
    <rect x={cx - 6} y={cy - 6} width={12} height={12}
      fill="#ef4444" stroke="#ffffff" strokeWidth={1}
      style={{ filter: 'drop-shadow(0px 0px 5px #ef4444)' }} />
  );
};

const TakerBuyDot = (props: any) => {
  const { cx, cy, payload, dataKey } = props;
  if (cx == null || cy == null || payload[dataKey] == null) return null;
  return (
    <svg x={cx - 10} y={cy - 12} width={20} height={20}
      fill="#10b981" stroke="#ffffff" strokeWidth={0.5}
      style={{ filter: 'drop-shadow(0px 0px 5px #10b981)' }} viewBox="0 0 24 24">
      <path d="M12 2L2 22h20L12 2z" />
    </svg>
  );
};

const TakerSellDot = (props: any) => {
  const { cx, cy, payload, dataKey } = props;
  if (cx == null || cy == null || payload[dataKey] == null) return null;
  return (
    <svg x={cx - 10} y={cy - 8} width={20} height={20}
      fill="#ef4444" stroke="#ffffff" strokeWidth={0.5}
      style={{ filter: 'drop-shadow(0px 0px 5px #ef4444)' }} viewBox="0 0 24 24">
      <path d="M12 22L22 2H2L12 22z" />
    </svg>
  );
};

const MarketTradeDot = (props: any) => {
  const { cx, cy, payload, dataKey } = props;
  if (cx == null || cy == null || payload[dataKey] == null) return null;
  const s = 6;
  return (
    <path
      d={`M${cx - s},${cy - s}L${cx + s},${cy + s}M${cx + s},${cy - s}L${cx - s},${cy + s}`}
      stroke="#94a3b8" strokeWidth={2.5}
      style={{ filter: 'drop-shadow(0px 0px 4px #94a3b8)' }}
    />
  );
};

// ── Tooltip ───────────────────────────────────────────────────────────────────

const DepthTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="tooltip-container">
      <div className="tooltip-header">Timestamp: {data.timestamp}</div>

      <div style={{ color: 'var(--tomato)', marginBottom: '8px' }}>
        {data.ask_price_3 != null && <div className="tooltip-row"><span>Ask 3: {data.ask_price_3}</span><span>Vol: {data.ask_volume_3}</span></div>}
        {data.ask_price_2 != null && <div className="tooltip-row"><span>Ask 2: {data.ask_price_2}</span><span>Vol: {data.ask_volume_2}</span></div>}
        {data.ask_price_1 != null && <div className="tooltip-row"><span>Ask 1: {data.ask_price_1}</span><span>Vol: {data.ask_volume_1}</span></div>}
      </div>

      <div style={{ color: 'var(--accent)', margin: '8px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '4px 0' }}>
        <div className="tooltip-row"><span>Mid Price: {data.mid_price}</span></div>
        {data.wall_mid != null && (
          <div className="tooltip-row" style={{ color: '#f97316' }}><span>Wall Mid: {typeof data.wall_mid === 'number' ? data.wall_mid.toFixed(2) : data.wall_mid}</span></div>
        )}
      </div>

      <div style={{ color: 'var(--emerald)', marginTop: '8px' }}>
        {data.bid_price_1 != null && <div className="tooltip-row"><span>Bid 1: {data.bid_price_1}</span><span>Vol: {data.bid_volume_1}</span></div>}
        {data.bid_price_2 != null && <div className="tooltip-row"><span>Bid 2: {data.bid_price_2}</span><span>Vol: {data.bid_volume_2}</span></div>}
        {data.bid_price_3 != null && <div className="tooltip-row"><span>Bid 3: {data.bid_price_3}</span><span>Vol: {data.bid_volume_3}</span></div>}
      </div>

      {(data.maker_buy_vol > 0 || data.taker_buy_vol > 0 || data.maker_sell_vol > 0 || data.taker_sell_vol > 0) && (
        <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Our Executions</div>
          {data.taker_buy_vol > 0 && <div className="tooltip-row" style={{ color: '#10b981' }}><span>Taker Buy (▲):</span><span>{data.taker_buy_vol} @ {data.taker_buy_price?.toFixed(2)}</span></div>}
          {data.maker_buy_vol > 0 && <div className="tooltip-row" style={{ color: '#10b981' }}><span>Maker Buy (■):</span><span>{data.maker_buy_vol} @ {data.maker_buy_price?.toFixed(2)}</span></div>}
          {data.taker_sell_vol > 0 && <div className="tooltip-row" style={{ color: '#ef4444' }}><span>Taker Sell (▼):</span><span>{data.taker_sell_vol} @ {data.taker_sell_price?.toFixed(2)}</span></div>}
          {data.maker_sell_vol > 0 && <div className="tooltip-row" style={{ color: '#ef4444' }}><span>Maker Sell (■):</span><span>{data.maker_sell_vol} @ {data.maker_sell_price?.toFixed(2)}</span></div>}
        </div>
      )}
    </div>
  );
};

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const [data, setData] = useState<ParsedData | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [activeProduct, setActiveProduct] = useState<string>('');

  // New feature state
  const [normalizeMode, setNormalizeMode] = useState<'none' | 'wallmid' | 'midprice'>('none');
  const [activeClasses, setActiveClasses] = useState<Set<TraderClass>>(new Set(['F', 'M', 'S', 'B', 'I']));
  const [qtyMax, setQtyMax] = useState<number>(Infinity);

  const onDrop = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const parsed = await parseZipLog(file);
      setData(parsed);
      if (parsed.products.length > 0) setActiveProduct(parsed.products[0]);
    } catch (err: any) {
      setError(err.message || 'Failed to parse file.');
    } finally {
      setLoading(false);
    }
  }, []);

  if (!data) {
    return (
      <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center', display: 'flex', minHeight: '100vh', margin: 0 }}>
        <div className="glass-panel" style={{ maxWidth: '600px', width: '100%', textAlign: 'center' }}>
          <div className="header">
            <h1>Prosperity Visualizer</h1>
            <p style={{ color: 'var(--text-muted)' }}>Drop your submission zip file to instantly visualize algorithm performance.</p>
          </div>
          <label className="upload-zone" htmlFor="file-upload">
            <UploadCloud className="upload-icon" size={48} />
            <div className="upload-text">{loading ? 'Parsing...' : 'Click to Upload .zip Archive'}</div>
            <div className="upload-subtext">Reads logs securely right in the browser</div>
            <input disabled={loading} id="file-upload" type="file" accept=".zip" style={{ display: 'none' }} onChange={onDrop} />
          </label>
          {error && <div style={{ color: 'var(--tomato)', marginTop: '1rem' }}>{error}</div>}
        </div>
      </div>
    );
  }

  // ── Per-product data ────────────────────────────────────────────────────────
  return <Dashboard
    data={data}
    activeProduct={activeProduct}
    setActiveProduct={setActiveProduct}
    setData={setData}
    normalizeMode={normalizeMode}
    setNormalizeMode={setNormalizeMode}
    activeClasses={activeClasses}
    setActiveClasses={setActiveClasses}
    qtyMax={qtyMax}
    setQtyMax={setQtyMax}
  />;
}

// ── Dashboard (separate component to use hooks after data guard) ──────────────

interface DashboardProps {
  data: ParsedData;
  activeProduct: string;
  setActiveProduct: (p: string) => void;
  setData: (d: ParsedData | null) => void;
  normalizeMode: 'none' | 'wallmid' | 'midprice';
  setNormalizeMode: (m: 'none' | 'wallmid' | 'midprice') => void;
  activeClasses: Set<TraderClass>;
  setActiveClasses: (s: Set<TraderClass>) => void;
  qtyMax: number;
  setQtyMax: (n: number) => void;
}

function Dashboard({
  data, activeProduct, setActiveProduct, setData,
  normalizeMode, setNormalizeMode, activeClasses, setActiveClasses,
  qtyMax, setQtyMax,
}: DashboardProps) {
  const baseActivities = data.activities[activeProduct] || [];
  const positions = data.positions[activeProduct] || [];
  const pnl = data.pnl[activeProduct] || [];
  const activeTrades = data.trades[activeProduct] || [];

  // Trader classification
  const traderStatsMap = useMemo<Map<string, TraderStats>>(
    () => classifyTraders(activeTrades, baseActivities),
    [activeTrades, baseActivities]
  );

  // Max qty for slider
  const dataMaxQty = useMemo(
    () => activeTrades.length ? Math.max(...activeTrades.map(t => t.quantity)) : 100,
    [activeTrades]
  );
  const effectiveQtyMax = Math.min(qtyMax, dataMaxQty);

  // Metrics
  const metrics = useMemo(() => {
    const pnlValues = pnl.map(p => p.pnl);
    return {
      sharpe: computeSharpe(pnlValues),
      totalVol: computeTotalVolatility(pnlValues),
      maxDrawdown: computeMaxDrawdown(pnlValues),
      winRate: computeWinRate(pnlValues),
      rollingVol: computeRollingVolatility(pnlValues, 20),
      histogram: buildPnlHistogram(pnlValues),
    };
  }, [pnl]);

  const avgEdge = useMemo(
    () => traderStatsMap.get('SUBMISSION')?.avgEdge ?? 0,
    [traderStatsMap]
  );

  // Y-axis domain for the price chart — excludes zero-price rows (blank order book snapshots)
  const priceDomain = useMemo((): [number, number] | ['auto', 'auto'] => {
    if (normalizeMode !== 'none') return ['auto', 'auto'];
    let min = Infinity, max = -Infinity;
    for (const row of baseActivities) {
      for (const p of [
        row.bid_price_1, row.bid_price_2, row.bid_price_3,
        row.ask_price_1, row.ask_price_2, row.ask_price_3,
      ]) {
        if (p != null && typeof p === 'number' && p > 0) {
          if (p < min) min = p;
          if (p > max) max = p;
        }
      }
    }
    if (!isFinite(min)) return ['auto', 'auto'];
    const pad = Math.max((max - min) * 0.08, 5);
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [baseActivities, normalizeMode]);

  // Enriched activities with Wall Mid, market trades, normalization
  const activities = useMemo(() => baseActivities.map((act, i) => {
    const tradesAtTime = activeTrades.filter(t => t.timestamp === act.timestamp);

    // SUBMISSION trades: maker/taker split
    let makerBuyVol = 0, makerBuyCost = 0;
    let takerBuyVol = 0, takerBuyCost = 0;
    let makerSellVol = 0, makerSellCost = 0;
    let takerSellVol = 0, takerSellCost = 0;

    const ask1 = act.ask_price_1 ?? Infinity;
    const bid1 = act.bid_price_1 ?? 0;

    for (const t of tradesAtTime) {
      if (t.buyer === 'SUBMISSION') {
        if (t.price >= ask1) { takerBuyVol += t.quantity; takerBuyCost += t.quantity * t.price; }
        else { makerBuyVol += t.quantity; makerBuyCost += t.quantity * t.price; }
      }
      if (t.seller === 'SUBMISSION') {
        if (t.price <= bid1) { takerSellVol += t.quantity; takerSellCost += t.quantity * t.price; }
        else { makerSellVol += t.quantity; makerSellCost += t.quantity * t.price; }
      }
    }

    const makerBuyPrice = makerBuyVol > 0 ? makerBuyCost / makerBuyVol : null;
    const takerBuyPrice = takerBuyVol > 0 ? takerBuyCost / takerBuyVol : null;
    const makerSellPrice = makerSellVol > 0 ? makerSellCost / makerSellVol : null;
    const takerSellPrice = takerSellVol > 0 ? takerSellCost / takerSellVol : null;

    // Wall Mid
    const { wall_mid } = computeWallMid(act);

    // Market trades (non-SUBMISSION both sides), filtered by class + qty
    const marketTrades = tradesAtTime.filter(t => {
      if (t.buyer === 'SUBMISSION' || t.seller === 'SUBMISSION') return false;
      const stats = traderStatsMap.get(t.buyer) ?? traderStatsMap.get(t.seller);
      const cls: TraderClass = stats?.traderClass ?? 'S';
      return activeClasses.has(cls) && t.quantity <= effectiveQtyMax;
    });
    const market_trade_price = marketTrades.length > 0
      ? marketTrades.reduce((s, t) => s + t.price * t.quantity, 0) /
        marketTrades.reduce((s, t) => s + t.quantity, 0)
      : null;

    // Normalization
    const ref = normalizeMode === 'wallmid' ? (wall_mid ?? act.mid_price ?? 0)
              : normalizeMode === 'midprice' ? (act.mid_price ?? 0)
              : 0;
    const norm = (v: number | null | undefined): number | null => v != null ? v - ref : null;

    // Rolling vol for chart
    const rollingVolAtPoint = metrics.rollingVol[i] ?? null;

    return {
      ...act,
      maker_buy_vol: makerBuyVol,
      maker_buy_price: makerBuyPrice,
      taker_buy_vol: takerBuyVol,
      taker_buy_price: takerBuyPrice,
      maker_sell_vol: makerSellVol,
      maker_sell_price: makerSellPrice,
      taker_sell_vol: takerSellVol,
      taker_sell_price: takerSellPrice,
      wall_mid,
      market_trade_price,
      rolling_vol: rollingVolAtPoint,
      // Normalized variants
      n_ask_price_3: norm(act.ask_price_3),
      n_ask_price_2: norm(act.ask_price_2),
      n_ask_price_1: norm(act.ask_price_1),
      n_mid_price: norm(act.mid_price),
      n_bid_price_1: norm(act.bid_price_1),
      n_bid_price_2: norm(act.bid_price_2),
      n_bid_price_3: norm(act.bid_price_3),
      n_wall_mid: norm(wall_mid),
      n_maker_buy_price: norm(makerBuyPrice),
      n_taker_buy_price: norm(takerBuyPrice),
      n_maker_sell_price: norm(makerSellPrice),
      n_taker_sell_price: norm(takerSellPrice),
      n_market_trade_price: norm(market_trade_price),
    };
  }), [baseActivities, activeTrades, traderStatsMap, normalizeMode, activeClasses, effectiveQtyMax, metrics.rollingVol]);

  // Helper: pick normalized or raw dataKey
  const pk = (key: string) => normalizeMode !== 'none' ? `n_${key}` : key;

  const lastActivity = activities[activities.length - 1];
  const lastState = lastActivity
    ? { mid: lastActivity.mid_price, pnl: lastActivity.profit_and_loss }
    : { mid: 0, pnl: 0 };
  const lastPos = positions[positions.length - 1]?.quantity || 0;

  const toggleClass = (cls: TraderClass) => {
    const next = new Set(activeClasses);
    next.has(cls) ? next.delete(cls) : next.add(cls);
    setActiveClasses(next);
  };

  const CLASS_LABELS: Record<TraderClass, string> = { F: 'F (Us)', M: 'M (MM)', S: 'S (Small)', B: 'B (Big)', I: 'I (Informed)' };

  return (
    <div className="app-container">
      <div className="header" style={{ textAlign: 'left', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem' }}>Prosperity Dashboard</h1>
        <p style={{ color: 'var(--text-muted)' }}>Use the Global Timeline bar to slide and select the time period you wish to inspect.</p>
      </div>

      <div className="dashboard">
        {/* ── Toolbar ── */}
        <div className="glass-panel toolbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Product selector */}
          <div className="product-selector">
            {data.products.map(p => (
              <button key={p} className={`btn ${activeProduct === p ? 'active' : ''}`} onClick={() => setActiveProduct(p)}>{p}</button>
            ))}
          </div>

          {/* Normalize dropdown */}
          <select
            value={normalizeMode}
            onChange={e => setNormalizeMode(e.target.value as 'none' | 'wallmid' | 'midprice')}
            className="btn"
            style={{ background: 'var(--bg-card)', color: normalizeMode !== 'none' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', borderColor: normalizeMode !== 'none' ? 'var(--accent)' : undefined }}
          >
            <option value="none">No Normalization</option>
            <option value="wallmid">Normalize: Wall Mid</option>
            <option value="midprice">Normalize: Mid Price</option>
          </select>

          {/* Trader class filter */}
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Show:</span>
            {(['F', 'M', 'S', 'B', 'I'] as TraderClass[]).map(cls => (
              <button
                key={cls}
                className={`btn ${activeClasses.has(cls) ? 'active' : ''}`}
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                onClick={() => toggleClass(cls)}
                title={CLASS_LABELS[cls]}
              >
                {cls}
              </button>
            ))}
          </div>

          {/* Quantity filter slider */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Max Qty:</span>
            <input
              type="range" min={1} max={dataMaxQty} step={1}
              value={effectiveQtyMax}
              onChange={e => setQtyMax(Number(e.target.value))}
              style={{ width: '90px' }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: '2rem' }}>{effectiveQtyMax}</span>
          </div>

          <button className="btn" onClick={() => setData(null)} style={{ marginLeft: 'auto' }}>Upload New Run</button>
        </div>

        {/* ── Stats grid ── */}
        <div className="stats-grid">
          <div className="glass-panel stat-card">
            <div className="stat-title"><DollarSign size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Current PnL</div>
            <div className={`stat-value ${(lastState.pnl ?? 0) >= 0 ? 'up' : 'down'}`}>{lastState.pnl?.toFixed(2) || '0.00'}</div>
          </div>
          <div className="glass-panel stat-card">
            <div className="stat-title"><Activity size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Mid Price</div>
            <div className="stat-value">{lastState.mid?.toFixed(2) || '0.00'}</div>
          </div>
          <div className="glass-panel stat-card">
            <div className="stat-title"><Box size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Final Position</div>
            <div className={`stat-value ${(lastPos || 0) >= 0 ? 'up' : 'down'}`}>{lastPos}</div>
          </div>
          <div className="glass-panel stat-card">
            <div className="stat-title">Sharpe (Ann.)</div>
            <div className={`stat-value ${isNaN(metrics.sharpe) ? '' : metrics.sharpe >= 0 ? 'up' : 'down'}`}>
              {isNaN(metrics.sharpe) ? 'N/A' : metrics.sharpe.toFixed(3)}
            </div>
          </div>
          <div className="glass-panel stat-card">
            <div className="stat-title">Max Drawdown</div>
            <div className="stat-value down">{metrics.maxDrawdown.toFixed(2)}</div>
          </div>
          <div className="glass-panel stat-card">
            <div className="stat-title">Win Rate</div>
            <div className={`stat-value ${metrics.winRate >= 0.5 ? 'up' : 'down'}`}>{(metrics.winRate * 100).toFixed(1)}%</div>
          </div>
          <div className="glass-panel stat-card">
            <div className="stat-title">Avg Edge / Trade</div>
            <div className={`stat-value ${avgEdge <= 0 ? 'up' : 'down'}`}>{avgEdge.toFixed(3)}</div>
          </div>
          <div className="glass-panel stat-card">
            <div className="stat-title">Total Volatility</div>
            <div className="stat-value">{metrics.totalVol.toFixed(3)}</div>
          </div>
        </div>

        <div className="chart-grid">
          {/* Global Timeline Selector */}
          <div className="glass-panel" style={{ height: '100px', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Global Timeline Selector</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activities} syncId="prosperitySync">
                <XAxis dataKey="timestamp" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Line type="monotone" dataKey="mid_price" stroke="var(--accent)" strokeWidth={1} dot={false} isAnimationActive={false} />
                <Brush dataKey="timestamp" height={30} stroke="var(--accent)" fill="var(--bg-card)" tickFormatter={() => ''} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Market Depth & Executions */}
          <div className="glass-panel chart-container">
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
              Market Depth & Executions
              {normalizeMode !== 'none' && <span style={{ color: 'var(--accent)', fontSize: '0.8rem', marginLeft: '0.75rem' }}>
                (Normalized by {normalizeMode === 'wallmid' ? 'Wall Mid' : 'Mid Price'})
              </span>}
            </h3>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={activities} syncId="prosperitySync">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="timestamp" stroke="var(--text-muted)" fontSize={12} scale="time" type="number" domain={['dataMin', 'dataMax']} />
                <YAxis domain={priceDomain} stroke="var(--text-muted)" fontSize={12} width={70} />
                <RechartsTooltip content={<DepthTooltip />} />
                <Legend />

                {/* Bid/Ask levels */}
                <Line type="stepAfter" dataKey={pk('ask_price_3')} stroke="rgba(239,68,68,0.4)" dot={false} strokeWidth={1} name="Ask 3" isAnimationActive={false} />
                <Line type="stepAfter" dataKey={pk('ask_price_2')} stroke="rgba(239,68,68,0.7)" dot={false} strokeWidth={1} name="Ask 2" isAnimationActive={false} />
                <Line type="stepAfter" dataKey={pk('ask_price_1')} stroke="var(--tomato)" dot={false} strokeWidth={2} name="Ask 1" isAnimationActive={false} />

                <Line type="stepAfter" dataKey={pk('mid_price')} stroke="var(--accent)" dot={false} strokeWidth={2} name="Mid Price" isAnimationActive={false} />

                {/* Wall Mid — always shown in raw coordinates since it's a price itself */}
                <Line type="stepAfter" dataKey={pk('wall_mid')} stroke="#f97316" dot={false} strokeWidth={1.5} strokeDasharray="5 3" name="Wall Mid" isAnimationActive={false} />

                <Line type="stepAfter" dataKey={pk('bid_price_1')} stroke="var(--emerald)" dot={false} strokeWidth={2} name="Bid 1" isAnimationActive={false} />
                <Line type="stepAfter" dataKey={pk('bid_price_2')} stroke="rgba(16,185,129,0.7)" dot={false} strokeWidth={1} name="Bid 2" isAnimationActive={false} />
                <Line type="stepAfter" dataKey={pk('bid_price_3')} stroke="rgba(16,185,129,0.4)" dot={false} strokeWidth={1} name="Bid 3" isAnimationActive={false} />

                {/* Market trades (non-SUBMISSION) */}
                <Line type="monotone" dataKey={pk('market_trade_price')} stroke="none"
                  dot={<MarketTradeDot />} name="Market Trade (✕)" isAnimationActive={false} />

                {/* SUBMISSION trades — conditionally shown */}
                {activeClasses.has('F') && <>
                  <Line type="monotone" dataKey={pk('maker_buy_price')} stroke="none"
                    dot={<MakerBuyDot />} name="Maker Buy (■)" isAnimationActive={false} />
                  <Line type="monotone" dataKey={pk('taker_buy_price')} stroke="none"
                    dot={<TakerBuyDot />} name="Taker Buy (▲)" isAnimationActive={false} />
                  <Line type="monotone" dataKey={pk('maker_sell_price')} stroke="none"
                    dot={<MakerSellDot />} name="Maker Sell (■)" isAnimationActive={false} />
                  <Line type="monotone" dataKey={pk('taker_sell_price')} stroke="none"
                    dot={<TakerSellDot />} name="Taker Sell (▼)" isAnimationActive={false} />
                </>}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Profit & Loss */}
          <div className="glass-panel chart-container">
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Profit & Loss Tracker</h3>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pnl} syncId="prosperitySync">
                <defs>
                  <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--emerald)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--emerald)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="timestamp" stroke="var(--text-muted)" fontSize={12} scale="time" type="number" domain={['dataMin', 'dataMax']} />
                <YAxis stroke="var(--text-muted)" fontSize={12} width={65} />
                <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                <Area type="stepAfter" dataKey="pnl" stroke="var(--emerald)" fillOpacity={1} fill="url(#colorPnl)" name="PnL" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Inventory Allocations */}
          <div className="glass-panel chart-container">
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Inventory Allocations</h3>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={positions} syncId="prosperitySync">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="timestamp" stroke="var(--text-muted)" fontSize={12} scale="time" type="number" domain={['dataMin', 'dataMax']} />
                <YAxis stroke="var(--text-muted)" fontSize={12} width={65} />
                <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                <Area type="stepAfter" dataKey="quantity" fill="var(--accent)" stroke="var(--accent)" fillOpacity={0.2} name="Position" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Rolling Volatility */}
          <div className="glass-panel chart-container">
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Rolling PnL Volatility <span style={{ fontSize: '0.8rem' }}>(window = 20 steps)</span></h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={activities.map(a => ({ timestamp: a.timestamp, vol: a.rolling_vol }))}
                syncId="prosperitySync"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="timestamp" stroke="var(--text-muted)" fontSize={12} scale="time" type="number" domain={['dataMin', 'dataMax']} />
                <YAxis stroke="var(--text-muted)" fontSize={12} width={65} />
                <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} formatter={(v: any) => [typeof v === 'number' ? v.toFixed(4) : 'N/A', 'Vol']} />
                <Line type="monotone" dataKey="vol" stroke="#f97316" dot={false} strokeWidth={2} name="Rolling Vol" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* PnL per Timestep Histogram */}
          <div className="glass-panel chart-container">
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>PnL per Timestep Distribution</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.histogram} margin={{ top: 5, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="range" stroke="var(--text-muted)" fontSize={10} angle={-45} textAnchor="end" />
                <YAxis stroke="var(--text-muted)" fontSize={12} width={40} />
                <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                <Bar dataKey="count" fill="var(--accent)" name="Count" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Bot Analysis ── */}
        <BotAnalysis
          trades={activeTrades}
          activities={baseActivities}
          traderStats={traderStatsMap}
        />
      </div>
    </div>
  );
}

export default App;
