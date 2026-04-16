import { useState, useCallback, useMemo } from 'react';
import { UploadCloud, Activity, DollarSign, Box } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  Line, Legend, ComposedChart, Brush, LineChart,
} from 'recharts';
import { parseZipLog, ParsedData } from './utils/parser';
import {
  classifyTraders, computeSharpe,
  computeRollingVolatility, computeTotalVolatility,
  computeMaxDrawdown, computeWinRate,
  TraderStats,
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

  return <Dashboard
    data={data}
    activeProduct={activeProduct}
    setActiveProduct={setActiveProduct}
    setData={setData}
  />;
}

// ── Dashboard (separate component to use hooks after data guard) ──────────────

interface DashboardProps {
  data: ParsedData;
  activeProduct: string;
  setActiveProduct: (p: string) => void;
  setData: (d: ParsedData | null) => void;
}

function Dashboard({ data, activeProduct, setActiveProduct, setData }: DashboardProps) {
  const baseActivities = data.activities[activeProduct] || [];
  const positions = data.positions[activeProduct] || [];
  const pnl = data.pnl[activeProduct] || [];
  const activeTrades = data.trades[activeProduct] || [];

  // Debug: log trade data to help diagnose Bot Analysis empty state
  console.log('[Prosperity] activeProduct:', activeProduct);
  console.log('[Prosperity] data.trades keys:', Object.keys(data.trades));
  console.log('[Prosperity] activeTrades.length:', activeTrades.length);
  if (activeTrades.length > 0) console.log('[Prosperity] sample trade:', activeTrades[0]);

  // Depth chart line visibility toggles
  const [showBids, setShowBids] = useState(true);
  const [showAsks, setShowAsks] = useState(true);
  const [showMid, setShowMid] = useState(true);
  const [showTrades, setShowTrades] = useState(true);

  // Trader classification (for BotAnalysis)
  const traderStatsMap = useMemo<Map<string, TraderStats>>(
    () => classifyTraders(activeTrades, baseActivities),
    [activeTrades, baseActivities]
  );

  // Metrics
  const metrics = useMemo(() => {
    const pnlValues = pnl.map(p => p.pnl);
    return {
      sharpe: computeSharpe(pnlValues),
      totalVol: computeTotalVolatility(pnlValues),
      maxDrawdown: computeMaxDrawdown(pnlValues),
      winRate: computeWinRate(pnlValues),
      rollingVol: computeRollingVolatility(pnlValues, 20),
    };
  }, [pnl]);

  const avgEdge = useMemo(
    () => traderStatsMap.get('SUBMISSION')?.avgEdge ?? 0,
    [traderStatsMap]
  );

  // Y-axis domain: true observed price range (excludes blank/zero rows) + small padding
  const priceDomain = useMemo((): [number, number] | ['auto', 'auto'] => {
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
    const pad = Math.max((max - min) * 0.1, 2);
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [baseActivities]);

  // Enriched activities: maker/taker split + Wall Mid + market trades
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

    // Market trades: all non-SUBMISSION crosses (always shown, vwap per timestep)
    const marketTrades = tradesAtTime.filter(
      t => t.buyer !== 'SUBMISSION' && t.seller !== 'SUBMISSION'
    );
    const market_trade_price = marketTrades.length > 0
      ? marketTrades.reduce((s, t) => s + t.price * t.quantity, 0) /
        marketTrades.reduce((s, t) => s + t.quantity, 0)
      : null;

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
      market_trade_price,
      rolling_vol: metrics.rollingVol[i] ?? null,
    };
  }), [baseActivities, activeTrades, metrics.rollingVol]);

  const lastActivity = activities[activities.length - 1];
  const lastState = lastActivity
    ? { mid: lastActivity.mid_price, pnl: lastActivity.profit_and_loss }
    : { mid: 0, pnl: 0 };
  const lastPos = positions[positions.length - 1]?.quantity || 0;

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

          {/* Depth chart visibility toggles */}
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Show:</span>
            <button
              className={`btn ${showBids ? 'active' : ''}`}
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', borderColor: showBids ? 'var(--emerald)' : undefined, background: showBids ? 'var(--emerald)' : undefined }}
              onClick={() => setShowBids(v => !v)}
            >Bids</button>
            <button
              className={`btn ${showAsks ? 'active' : ''}`}
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', borderColor: showAsks ? 'var(--tomato)' : undefined, background: showAsks ? 'var(--tomato)' : undefined }}
              onClick={() => setShowAsks(v => !v)}
            >Asks</button>
            <button
              className={`btn ${showMid ? 'active' : ''}`}
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
              onClick={() => setShowMid(v => !v)}
            >Mid</button>
            <button
              className={`btn ${showTrades ? 'active' : ''}`}
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
              onClick={() => setShowTrades(v => !v)}
            >Trades</button>
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
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Market Depth & Executions</h3>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={activities} syncId="prosperitySync">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="timestamp" stroke="var(--text-muted)" fontSize={12} scale="time" type="number" domain={['dataMin', 'dataMax']} />
                <YAxis domain={priceDomain} allowDataOverflow={true} stroke="var(--text-muted)" fontSize={12} width={70} />
                <RechartsTooltip content={<DepthTooltip />} />
                <Legend />

                {/* Ask levels */}
                {showAsks && <>
                  <Line type="stepAfter" dataKey="ask_price_3" stroke="rgba(239,68,68,0.4)" dot={false} strokeWidth={1} name="Ask 3" isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="ask_price_2" stroke="rgba(239,68,68,0.7)" dot={false} strokeWidth={1} name="Ask 2" isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="ask_price_1" stroke="var(--tomato)" dot={false} strokeWidth={2} name="Ask 1" isAnimationActive={false} />
                </>}

                {/* Mid price */}
                {showMid && (
                  <Line type="stepAfter" dataKey="mid_price" stroke="var(--accent)" dot={false} strokeWidth={2} name="Mid Price" isAnimationActive={false} />
                )}

                {/* Bid levels */}
                {showBids && <>
                  <Line type="stepAfter" dataKey="bid_price_1" stroke="var(--emerald)" dot={false} strokeWidth={2} name="Bid 1" isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="bid_price_2" stroke="rgba(16,185,129,0.7)" dot={false} strokeWidth={1} name="Bid 2" isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="bid_price_3" stroke="rgba(16,185,129,0.4)" dot={false} strokeWidth={1} name="Bid 3" isAnimationActive={false} />
                </>}

                {/* All trade markers toggled together */}
                {showTrades && <>
                  <Line type="monotone" dataKey="market_trade_price" stroke="none"
                    dot={<MarketTradeDot />} name="Market Trade (✕)" isAnimationActive={false} />
                  <Line type="monotone" dataKey="maker_buy_price" stroke="none"
                    dot={<MakerBuyDot />} name="Maker Buy (■)" isAnimationActive={false} />
                  <Line type="monotone" dataKey="taker_buy_price" stroke="none"
                    dot={<TakerBuyDot />} name="Taker Buy (▲)" isAnimationActive={false} />
                  <Line type="monotone" dataKey="maker_sell_price" stroke="none"
                    dot={<MakerSellDot />} name="Maker Sell (■)" isAnimationActive={false} />
                  <Line type="monotone" dataKey="taker_sell_price" stroke="none"
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
