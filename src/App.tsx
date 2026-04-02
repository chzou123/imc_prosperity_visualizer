import { useState, useCallback } from 'react';
import { UploadCloud, Activity, DollarSign, Box } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Line, Legend, ComposedChart, Brush, LineChart } from 'recharts';
import { parseZipLog, ParsedData } from './utils/parser';

const MakerDot = (props: any) => {
  const { cx, cy, fill, payload, dataKey } = props;
  if (!cx || !cy || payload[dataKey] == null) return null;
  return (
    <circle cx={cx} cy={cy} r={6} fill={fill} stroke="#ffffff" strokeWidth={1} style={{ filter: `drop-shadow(0px 0px 4px ${fill})` }} />
  );
};

const TakerBuyDot = (props: any) => {
  const { cx, cy, fill, payload, dataKey } = props;
  if (!cx || !cy || payload[dataKey] == null) return null;
  return (
    <svg x={cx - 10} y={cy - 12} width={20} height={20} fill={fill} stroke="#ffffff" strokeWidth={0.5} style={{ filter: `drop-shadow(0px 0px 4px ${fill})` }} viewBox="0 0 24 24">
      <path d="M12 2L2 22h20L12 2z" />
    </svg>
  );
};

const TakerSellDot = (props: any) => {
  const { cx, cy, fill, payload, dataKey } = props;
  if (!cx || !cy || payload[dataKey] == null) return null;
  return (
    <svg x={cx - 10} y={cy - 8} width={20} height={20} fill={fill} stroke="#ffffff" strokeWidth={0.5} style={{ filter: `drop-shadow(0px 0px 4px ${fill})` }} viewBox="0 0 24 24">
      <path d="M12 22L22 2H2L12 22z" />
    </svg>
  );
};

const DepthTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
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
        </div>
        
        <div style={{ color: 'var(--emerald)', marginTop: '8px' }}>
          {data.bid_price_1 != null && <div className="tooltip-row"><span>Bid 1: {data.bid_price_1}</span><span>Vol: {data.bid_volume_1}</span></div>}
          {data.bid_price_2 != null && <div className="tooltip-row"><span>Bid 2: {data.bid_price_2}</span><span>Vol: {data.bid_volume_2}</span></div>}
          {data.bid_price_3 != null && <div className="tooltip-row"><span>Bid 3: {data.bid_price_3}</span><span>Vol: {data.bid_volume_3}</span></div>}
        </div>

        {(data.maker_buy_vol > 0 || data.taker_buy_vol > 0 || data.maker_sell_vol > 0 || data.taker_sell_vol > 0) && (
          <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
             <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Execution Logic</div>
             
             {data.taker_buy_vol > 0 && <div className="tooltip-row" style={{ color: '#00ffcc' }}><span>Taker Buy (▲):</span> <span>{data.taker_buy_vol} @ {data.taker_buy_price.toFixed(2)}</span></div>}
             {data.maker_buy_vol > 0 && <div className="tooltip-row" style={{ color: 'var(--emerald)' }}><span>Maker Buy (●):</span> <span>{data.maker_buy_vol} @ {data.maker_buy_price.toFixed(2)}</span></div>}
             
             {data.taker_sell_vol > 0 && <div className="tooltip-row" style={{ color: '#ff00ff' }}><span>Taker Sell (▼):</span> <span>{data.taker_sell_vol} @ {data.taker_sell_price.toFixed(2)}</span></div>}
             {data.maker_sell_vol > 0 && <div className="tooltip-row" style={{ color: 'var(--tomato)' }}><span>Maker Sell (●):</span> <span>{data.maker_sell_vol} @ {data.maker_sell_price.toFixed(2)}</span></div>}
          </div>
        )}
      </div>
    );
  }
  return null;
}

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
      if (parsed.products.length > 0) {
        setActiveProduct(parsed.products[0]);
      }
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

  const baseActivities = data.activities[activeProduct] || [];
  const positions = data.positions[activeProduct] || [];
  const pnl = data.pnl[activeProduct] || [];
  const activeTrades = data.trades[activeProduct] || [];

  const activities = baseActivities.map(act => {
    const tradesAtTime = activeTrades.filter(t => t.timestamp === act.timestamp);
    let makerBuyVol = 0, makerBuyCost = 0;
    let takerBuyVol = 0, takerBuyCost = 0;
    let makerSellVol = 0, makerSellCost = 0;
    let takerSellVol = 0, takerSellCost = 0;
    
    // Natively track Ask 1 and Bid 1 for thresholding, assuming standard values
    const ask1 = act.ask_price_1 ?? Infinity;
    const bid1 = act.bid_price_1 ?? 0;

    for (const t of tradesAtTime) {
      if (t.buyer === "SUBMISSION") {
          if (t.price >= ask1) {
             takerBuyVol += t.quantity;
             takerBuyCost += t.quantity * t.price;
          } else {
             makerBuyVol += t.quantity;
             makerBuyCost += t.quantity * t.price;
          }
      }
      if (t.seller === "SUBMISSION") {
          if (t.price <= bid1) {
             takerSellVol += t.quantity;
             takerSellCost += t.quantity * t.price;
          } else {
             makerSellVol += t.quantity;
             makerSellCost += t.quantity * t.price;
          }
      }
    }
    
    return {
      ...act,
      maker_buy_vol: makerBuyVol,
      maker_buy_price: makerBuyVol > 0 ? makerBuyCost / makerBuyVol : null,
      taker_buy_vol: takerBuyVol,
      taker_buy_price: takerBuyVol > 0 ? takerBuyCost / takerBuyVol : null,
      maker_sell_vol: makerSellVol,
      maker_sell_price: makerSellVol > 0 ? makerSellCost / makerSellVol : null,
      taker_sell_vol: takerSellVol,
      taker_sell_price: takerSellVol > 0 ? takerSellCost / takerSellVol : null,
    };
  });

  const lastActivity = activities[activities.length - 1];
  const lastState = lastActivity ? { mid: lastActivity.mid_price, pnl: lastActivity.profit_and_loss } : { mid: 0, pnl: 0 };
  const lastPos = positions[positions.length - 1]?.quantity || 0;

  return (
    <div className="app-container">
      <div className="header" style={{ textAlign: 'left', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem' }}>Prosperity Dashboard</h1>
        <p style={{ color: 'var(--text-muted)' }}>Use the Global Timeline bar below to slide, narrow, and select exactly the time period you wish to see.</p>
      </div>

      <div className="dashboard">
        <div className="glass-panel toolbar">
           <div className="product-selector">
             {data.products.map(p => (
               <button 
                 key={p} 
                 className={`btn ${activeProduct === p ? 'active' : ''}`}
                 onClick={() => setActiveProduct(p)}
               >
                 {p}
               </button>
             ))}
           </div>
           <button className="btn" onClick={() => setData(null)} style={{ marginLeft: "auto" }}>Upload New Run</button>
        </div>

        <div className="stats-grid">
           <div className="glass-panel stat-card">
              <div className="stat-title"><DollarSign size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Current PnL</div>
              <div className={`stat-value ${(lastState.pnl ?? 0) >= 0 ? 'up' : 'down'}`}>
                {lastState.pnl?.toFixed(2) || '0.00'}
              </div>
           </div>
           <div className="glass-panel stat-card">
              <div className="stat-title"><Activity size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Mid Price</div>
              <div className="stat-value">{lastState.mid?.toFixed(2) || '0.00'}</div>
           </div>
           <div className="glass-panel stat-card">
              <div className="stat-title"><Box size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Final Position</div>
              <div className={`stat-value ${(lastPos || 0) >= 0 ? 'up' : 'down'}`}>{lastPos}</div>
           </div>
        </div>

        <div className="chart-grid">
           {/* Global Timeline Control Bar */}
           <div className="glass-panel" style={{ height: '100px', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
             <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Global Timeline Selector</h3>
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={activities} syncId="prosperitySync">
                 <XAxis dataKey="timestamp" hide />
                 <YAxis domain={['auto', 'auto']} hide />
                 <Line type="monotone" dataKey="mid_price" stroke="var(--accent)" strokeWidth={1} dot={false} isAnimationActive={false} />
                 {/* This Brush controls the zoom for all linked charts! */}
                 <Brush dataKey="timestamp" height={30} stroke="var(--accent)" fill="var(--bg-card)" tickFormatter={() => ''} />
               </LineChart>
             </ResponsiveContainer>
           </div>

           <div className="glass-panel chart-container">
             <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Market Depth & Executions</h3>
             <ResponsiveContainer width="100%" height="100%">
               <ComposedChart data={activities} syncId="prosperitySync">
                 <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                 <XAxis dataKey="timestamp" stroke="var(--text-muted)" fontSize={12} scale="time" type="number" domain={['dataMin', 'dataMax']} />
                 <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" fontSize={12} width={60} />
                 <RechartsTooltip content={<DepthTooltip />} />
                 <Legend />
                 
                 <Line type="stepAfter" dataKey="ask_price_3" stroke="rgba(239, 68, 68, 0.4)" dot={false} strokeWidth={1} name="Ask 3" isAnimationActive={false} />
                 <Line type="stepAfter" dataKey="ask_price_2" stroke="rgba(239, 68, 68, 0.7)" dot={false} strokeWidth={1} name="Ask 2" isAnimationActive={false} />
                 <Line type="stepAfter" dataKey="ask_price_1" stroke="var(--tomato)" dot={false} strokeWidth={2} name="Ask 1" isAnimationActive={false} />
                 
                 <Line type="stepAfter" dataKey="mid_price" stroke="var(--accent)" dot={false} strokeWidth={2} name="Mid Price" isAnimationActive={false} />
                 
                 <Line type="stepAfter" dataKey="bid_price_1" stroke="var(--emerald)" dot={false} strokeWidth={2} name="Bid 1" isAnimationActive={false} />
                 <Line type="stepAfter" dataKey="bid_price_2" stroke="rgba(16, 185, 129, 0.7)" dot={false} strokeWidth={1} name="Bid 2" isAnimationActive={false} />
                 <Line type="stepAfter" dataKey="bid_price_3" stroke="rgba(16, 185, 129, 0.4)" dot={false} strokeWidth={1} name="Bid 3" isAnimationActive={false} />

                 {/* Custom shapes for Taker / Maker markers seamlessly integrated into lines */}
                 <Line type="monotone" dataKey="taker_buy_price" stroke="none" dot={<TakerBuyDot fill="#00ffcc" />} name="Taker Buy (▲)" isAnimationActive={false} />
                 <Line type="monotone" dataKey="maker_buy_price" stroke="none" dot={<MakerDot fill="var(--emerald)" />} name="Maker Buy (●)" isAnimationActive={false} />
                 
                 <Line type="monotone" dataKey="taker_sell_price" stroke="none" dot={<TakerSellDot fill="#ff00ff" />} name="Taker Sell (▼)" isAnimationActive={false} />
                 <Line type="monotone" dataKey="maker_sell_price" stroke="none" dot={<MakerDot fill="var(--tomato)" />} name="Maker Sell (●)" isAnimationActive={false} />
               </ComposedChart>
             </ResponsiveContainer>
           </div>

           <div className="glass-panel chart-container">
             <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Profit & Loss Tracker</h3>
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={pnl} syncId="prosperitySync">
                 <defs>
                   <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="var(--emerald)" stopOpacity={0.3}/>
                     <stop offset="95%" stopColor="var(--emerald)" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                 <XAxis dataKey="timestamp" stroke="var(--text-muted)" fontSize={12} scale="time" type="number" domain={['dataMin', 'dataMax']} />
                 <YAxis stroke="var(--text-muted)" fontSize={12} width={60} />
                 <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                 <Area type="stepAfter" dataKey="pnl" stroke="var(--emerald)" fillOpacity={1} fill="url(#colorPnl)" name="PnL" isAnimationActive={false} />
               </AreaChart>
             </ResponsiveContainer>
           </div>
           
           <div className="glass-panel chart-container">
             <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Inventory Allocations</h3>
             <ResponsiveContainer width="100%" height="100%">
               <ComposedChart data={positions} syncId="prosperitySync">
                 <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                 <XAxis dataKey="timestamp" stroke="var(--text-muted)" fontSize={12} scale="time" type="number" domain={['dataMin', 'dataMax']} />
                 <YAxis stroke="var(--text-muted)" fontSize={12} width={60} />
                 <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                 <Area type="stepAfter" dataKey="quantity" fill="var(--accent)" stroke="var(--accent)" fillOpacity={0.2} name="Position" isAnimationActive={false} />
               </ComposedChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>
    </div>
  );
}

export default App;
