import { useState, useCallback } from 'react';
import { UploadCloud, Activity, DollarSign, Box } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, Legend, ComposedChart } from 'recharts';
import { parseZipLog, ParsedData } from './utils/parser';

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

  const activities = data.activities[activeProduct] || [];
  const positions = data.positions[activeProduct] || [];
  const pnl = data.pnl[activeProduct] || [];

  // Metrics
  const lastActivity = activities[activities.length - 1];
  const lastState = lastActivity ? { mid: lastActivity.mid_price, pnl: lastActivity.profit_and_loss } : { mid: 0, pnl: 0 };
  const lastPos = positions[positions.length - 1]?.quantity || 0;

  return (
    <div className="app-container">
      <div className="header" style={{ textAlign: 'left', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem' }}>Prosperity Dashboard</h1>
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

        <div className="chart-grid chart-grid-2">
           <div className="glass-panel chart-container">
             <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Order Book & Mid Price</h3>
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={activities}>
                 <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                 <XAxis dataKey="timestamp" stroke="var(--text-muted)" fontSize={12} />
                 <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" fontSize={12} width={60} />
                 <RechartsTooltip 
                   contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} 
                   itemStyle={{ color: 'var(--text)' }}
                 />
                 <Legend />
                 <Line type="stepAfter" dataKey="ask_price_1" stroke="var(--tomato)" dot={false} strokeWidth={2} name="Ask 1" />
                 <Line type="stepAfter" dataKey="mid_price" stroke="var(--accent)" dot={false} strokeWidth={2} name="Mid Price" />
                 <Line type="stepAfter" dataKey="bid_price_1" stroke="var(--emerald)" dot={false} strokeWidth={2} name="Bid 1" />
               </LineChart>
             </ResponsiveContainer>
           </div>

           <div className="glass-panel chart-container">
             <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Profit & Loss</h3>
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={pnl}>
                 <defs>
                   <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="var(--emerald)" stopOpacity={0.3}/>
                     <stop offset="95%" stopColor="var(--emerald)" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                 <XAxis dataKey="timestamp" stroke="var(--text-muted)" fontSize={12} />
                 <YAxis stroke="var(--text-muted)" fontSize={12} width={60} />
                 <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                 <Area type="monotone" dataKey="pnl" stroke="var(--emerald)" fillOpacity={1} fill="url(#colorPnl)" name="PnL" />
               </AreaChart>
             </ResponsiveContainer>
           </div>
           
           <div className="glass-panel chart-container" style={{ gridColumn: '1 / -1' }}>
             <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Holdings / Positions Over Time</h3>
             <ResponsiveContainer width="100%" height="100%">
               <ComposedChart data={positions}>
                 <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                 <XAxis dataKey="timestamp" stroke="var(--text-muted)" fontSize={12} />
                 <YAxis stroke="var(--text-muted)" fontSize={12} width={60} />
                 <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                 <Area type="stepAfter" dataKey="quantity" fill="var(--accent)" stroke="var(--accent)" fillOpacity={0.2} name="Position" />
               </ComposedChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>
    </div>
  );
}

export default App;
