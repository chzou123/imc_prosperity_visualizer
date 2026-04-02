import { useState, useCallback } from 'react';
import { UploadCloud, Activity, DollarSign, Box } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Line, Legend, ComposedChart, Scatter, ReferenceArea } from 'recharts';
import { parseZipLog, ParsedData } from './utils/parser';

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

        {(data.buy_exec_vol > 0 || data.sell_exec_vol > 0) && (
          <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
             <div style={{ fontWeight: 'bold' }}>Trade Fills</div>
             {data.buy_exec_vol > 0 && <div className="tooltip-row" style={{ color: 'var(--emerald)' }}><span>Bought:</span> <span>{data.buy_exec_vol} @ {data.buy_exec_price.toFixed(2)}</span></div>}
             {data.sell_exec_vol > 0 && <div className="tooltip-row" style={{ color: 'var(--tomato)' }}><span>Sold:</span> <span>{data.sell_exec_vol} @ {data.sell_exec_price.toFixed(2)}</span></div>}
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

  // Zoom bindings
  const [leftBounds, setLeftBounds] = useState<number | 'dataMin'>('dataMin');
  const [rightBounds, setRightBounds] = useState<number | 'dataMax'>('dataMax');
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null);

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

  const zoom = () => {
    let left = refAreaLeft;
    let right = refAreaRight;

    if (left === right || left == null || right == null) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }

    if (left > right) {
      [left, right] = [right, left];
    }

    setRefAreaLeft(null);
    setRefAreaRight(null);
    setLeftBounds(left);
    setRightBounds(right);
  };

  const zoomOut = () => {
    setLeftBounds('dataMin');
    setRightBounds('dataMax');
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

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
    let buyVol = 0, buyCost = 0, sellVol = 0, sellCost = 0;
    
    for (const t of tradesAtTime) {
      if (t.buyer === "SUBMISSION") {
          buyVol += t.quantity;
          buyCost += t.quantity * t.price;
      }
      if (t.seller === "SUBMISSION") {
          sellVol += t.quantity;
          sellCost += t.quantity * t.price;
      }
    }
    
    return {
      ...act,
      buy_exec_vol: buyVol,
      buy_exec_price: buyVol > 0 ? buyCost / buyVol : null,
      sell_exec_vol: sellVol,
      sell_exec_price: sellVol > 0 ? sellCost / sellVol : null,
    };
  });

  const lastActivity = activities[activities.length - 1];
  const lastState = lastActivity ? { mid: lastActivity.mid_price, pnl: lastActivity.profit_and_loss } : { mid: 0, pnl: 0 };
  const lastPos = positions[positions.length - 1]?.quantity || 0;

  return (
    <div className="app-container">
      <div className="header" style={{ textAlign: 'left', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem' }}>Prosperity Dashboard</h1>
        <p style={{ color: 'var(--text-muted)' }}>Drag to highlight and zoom into specific areas. Double click on any chart to reset zoom.</p>
      </div>

      <div className="dashboard">
        <div className="glass-panel toolbar">
           <div className="product-selector">
             {data.products.map(p => (
               <button 
                 key={p} 
                 className={`btn ${activeProduct === p ? 'active' : ''}`}
                 onClick={() => {
                   setActiveProduct(p);
                   zoomOut();
                 }}
               >
                 {p}
               </button>
             ))}
           </div>
           <button className="btn" onClick={zoomOut} style={{ marginLeft: "auto", marginRight: "1rem" }}>Reset Zoom</button>
           <button className="btn" onClick={() => setData(null)}>Upload New Run</button>
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
           <div className="glass-panel chart-container">
             <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Market Depth & Executions</h3>
             <ResponsiveContainer width="100%" height="100%">
               <ComposedChart 
                  data={activities} 
                  syncId="prosperitySync"
                  onMouseDown={(e: any) => e && setRefAreaLeft(e.activeLabel)}
                  onMouseMove={(e: any) => refAreaLeft && e && setRefAreaRight(e.activeLabel)}
                  onMouseUp={zoom}
                  onDoubleClick={zoomOut}
               >
                 <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                 <XAxis dataKey="timestamp" stroke="var(--text-muted)" fontSize={12} scale="time" type="number" domain={[leftBounds, rightBounds]} />
                 <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" fontSize={12} width={60} />
                 <RechartsTooltip content={<DepthTooltip />} />
                 <Legend />
                 
                 <Line type="stepAfter" dataKey="ask_price_3" stroke="rgba(239, 68, 68, 0.4)" dot={false} strokeWidth={1} name="Ask 3" />
                 <Line type="stepAfter" dataKey="ask_price_2" stroke="rgba(239, 68, 68, 0.7)" dot={false} strokeWidth={1} name="Ask 2" />
                 <Line type="stepAfter" dataKey="ask_price_1" stroke="var(--tomato)" dot={false} strokeWidth={2} name="Ask 1" />
                 
                 <Line type="stepAfter" dataKey="mid_price" stroke="var(--accent)" dot={false} strokeWidth={2} name="Mid Price" />
                 
                 <Line type="stepAfter" dataKey="bid_price_1" stroke="var(--emerald)" dot={false} strokeWidth={2} name="Bid 1" />
                 <Line type="stepAfter" dataKey="bid_price_2" stroke="rgba(16, 185, 129, 0.7)" dot={false} strokeWidth={1} name="Bid 2" />
                 <Line type="stepAfter" dataKey="bid_price_3" stroke="rgba(16, 185, 129, 0.4)" dot={false} strokeWidth={1} name="Bid 3" />

                 <Scatter dataKey="buy_exec_price" fill="var(--emerald)" shape="star" name="Buy Fill" />
                 <Scatter dataKey="sell_exec_price" fill="var(--tomato)" shape="star" name="Sell Fill" />

                 {refAreaLeft != null && refAreaRight != null ? (
                   <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="var(--accent)" fillOpacity={0.3} />
                 ) : null}
               </ComposedChart>
             </ResponsiveContainer>
           </div>

           <div className="glass-panel chart-container">
             <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Profit & Loss Tracker</h3>
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart 
                  data={pnl} 
                  syncId="prosperitySync"
                  onMouseDown={(e: any) => e && setRefAreaLeft(e.activeLabel)}
                  onMouseMove={(e: any) => refAreaLeft && e && setRefAreaRight(e.activeLabel)}
                  onMouseUp={zoom}
                  onDoubleClick={zoomOut}
               >
                 <defs>
                   <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="var(--emerald)" stopOpacity={0.3}/>
                     <stop offset="95%" stopColor="var(--emerald)" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                 <XAxis dataKey="timestamp" stroke="var(--text-muted)" fontSize={12} scale="time" type="number" domain={[leftBounds, rightBounds]} />
                 <YAxis stroke="var(--text-muted)" fontSize={12} width={60} />
                 <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                 <Area type="stepAfter" dataKey="pnl" stroke="var(--emerald)" fillOpacity={1} fill="url(#colorPnl)" name="PnL" />
                 
                 {refAreaLeft != null && refAreaRight != null ? (
                   <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="var(--accent)" fillOpacity={0.3} />
                 ) : null}
               </AreaChart>
             </ResponsiveContainer>
           </div>
           
           <div className="glass-panel chart-container">
             <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Inventory Allocations</h3>
             <ResponsiveContainer width="100%" height="100%">
               <ComposedChart 
                  data={positions} 
                  syncId="prosperitySync"
                  onMouseDown={(e: any) => e && setRefAreaLeft(e.activeLabel)}
                  onMouseMove={(e: any) => refAreaLeft && e && setRefAreaRight(e.activeLabel)}
                  onMouseUp={zoom}
                  onDoubleClick={zoomOut}
               >
                 <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                 <XAxis dataKey="timestamp" stroke="var(--text-muted)" fontSize={12} scale="time" type="number" domain={[leftBounds, rightBounds]} />
                 <YAxis stroke="var(--text-muted)" fontSize={12} width={60} />
                 <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                 <Area type="stepAfter" dataKey="quantity" fill="var(--accent)" stroke="var(--accent)" fillOpacity={0.2} name="Position" />
                 
                 {refAreaLeft != null && refAreaRight != null ? (
                   <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="var(--accent)" fillOpacity={0.3} />
                 ) : null}
               </ComposedChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>
    </div>
  );
}

export default App;
