import { ActivityRow, Trade } from './parser';

// ── Statistical helpers ───────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function diff(arr: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < arr.length; i++) out.push(arr[i] - arr[i - 1]);
  return out;
}

// ── Metrics ───────────────────────────────────────────────────────────────────

export function computeSharpe(pnlSeries: number[], periodsPerYear = 1000): number {
  const returns = diff(pnlSeries);
  if (returns.length < 2) return NaN;
  const m = mean(returns);
  const s = std(returns);
  if (s === 0) return NaN;
  return (m / s) * Math.sqrt(periodsPerYear);
}

export function computeRollingVolatility(pnlSeries: number[], window = 20): (number | null)[] {
  const returns = diff(pnlSeries);
  const result: (number | null)[] = new Array(pnlSeries.length).fill(null);
  for (let i = window - 1; i < returns.length; i++) {
    const slice = returns.slice(i - window + 1, i + 1);
    result[i + 1] = std(slice);
  }
  return result;
}

export function computeTotalVolatility(pnlSeries: number[]): number {
  return std(diff(pnlSeries));
}

export function computeMaxDrawdown(pnlSeries: number[]): number {
  let peak = -Infinity;
  let maxDD = 0;
  for (const v of pnlSeries) {
    if (v > peak) peak = v;
    const dd = peak - v;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

export function computeWinRate(pnlSeries: number[]): number {
  const returns = diff(pnlSeries);
  if (returns.length === 0) return 0;
  return returns.filter(r => r > 0).length / returns.length;
}

// ── Wall Mid ──────────────────────────────────────────────────────────────────

export function computeWallMid(row: ActivityRow): { wall_mid: number | null } {
  // Find max-volume bid and ask levels
  const bids: [number, number][] = [
    [row.bid_price_1 ?? -1, row.bid_volume_1 ?? 0],
    [row.bid_price_2 ?? -1, row.bid_volume_2 ?? 0],
    [row.bid_price_3 ?? -1, row.bid_volume_3 ?? 0],
  ].filter(([p]) => p > 0) as [number, number][];

  const asks: [number, number][] = [
    [row.ask_price_1 ?? -1, row.ask_volume_1 ?? 0],
    [row.ask_price_2 ?? -1, row.ask_volume_2 ?? 0],
    [row.ask_price_3 ?? -1, row.ask_volume_3 ?? 0],
  ].filter(([p]) => p > 0) as [number, number][];

  if (bids.length === 0 || asks.length === 0) return { wall_mid: null };

  const dominantBid = bids.reduce((best, cur) => cur[1] > best[1] ? cur : best)[0];
  const dominantAsk = asks.reduce((best, cur) => cur[1] > best[1] ? cur : best)[0];

  return { wall_mid: (dominantBid + dominantAsk) / 2 };
}

// ── Trader Classification ─────────────────────────────────────────────────────

export type TraderClass = 'F' | 'M' | 'B' | 'I' | 'S';

export interface TraderStats {
  traderId: string;
  traderClass: TraderClass;
  totalVolume: number;
  tradeCount: number;
  avgSize: number;
  buySellRatio: number;   // buyCount / (buyCount + sellCount), 0..1
  avgEdge: number;        // avg(price - mid_at_time); neg = received spread (maker)
  fracBuysLow: number;    // fraction of buys in bottom 20% of product price range
  fracSellsHigh: number;  // fraction of sells in top 20% of product price range
}

export function classifyTraders(
  trades: Trade[],
  activities: ActivityRow[]
): Map<string, TraderStats> {
  if (trades.length === 0) return new Map();

  // Build O(1) mid lookup
  const midByTimestamp = new Map<number, number>();
  for (const row of activities) {
    if (row.mid_price != null) midByTimestamp.set(row.timestamp, row.mid_price);
  }

  // Price range for the product
  const allPrices = trades.map(t => t.price);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice;
  const low20 = minPrice + priceRange * 0.2;
  const high80 = minPrice + priceRange * 0.8;

  // Gather per-trader raw stats
  const raw = new Map<string, {
    buyVol: number; sellVol: number;
    buyCount: number; sellCount: number;
    edgeSum: number; edgeCount: number;
    buysLow: number; sellsHigh: number;
    sizes: number[];
  }>();

  const ensure = (id: string) => {
    if (!raw.has(id)) raw.set(id, { buyVol: 0, sellVol: 0, buyCount: 0, sellCount: 0, edgeSum: 0, edgeCount: 0, buysLow: 0, sellsHigh: 0, sizes: [] });
    return raw.get(id)!;
  };

  for (const t of trades) {
    const mid = midByTimestamp.get(t.timestamp) ?? null;

    if (t.buyer) {
      const r = ensure(t.buyer);
      r.buyVol += t.quantity;
      r.buyCount++;
      r.sizes.push(t.quantity);
      if (mid != null) { r.edgeSum += t.price - mid; r.edgeCount++; }
      if (t.price <= low20) r.buysLow++;
    }
    if (t.seller && t.seller !== t.buyer) {
      const r = ensure(t.seller);
      r.sellVol += t.quantity;
      r.sellCount++;
      r.sizes.push(t.quantity);
      if (mid != null) { r.edgeSum += t.price - mid; r.edgeCount++; }
      if (t.price >= high80) r.sellsHigh++;
    }
  }

  // Compute derived stats for all traders
  const statsArr: (TraderStats & { sizes: number[] })[] = [];
  for (const [traderId, r] of raw.entries()) {
    const totalCount = r.buyCount + r.sellCount;
    const totalVolume = r.buyVol + r.sellVol;
    const avgSize = totalCount > 0 ? totalVolume / totalCount : 0;
    const buySellRatio = totalCount > 0 ? r.buyCount / totalCount : 0.5;
    const avgEdge = r.edgeCount > 0 ? r.edgeSum / r.edgeCount : 0;
    const fracBuysLow = r.buyCount > 0 ? r.buysLow / r.buyCount : 0;
    const fracSellsHigh = r.sellCount > 0 ? r.sellsHigh / r.sellCount : 0;
    statsArr.push({
      traderId, traderClass: 'S', totalVolume, tradeCount: totalCount,
      avgSize, buySellRatio, avgEdge, fracBuysLow, fracSellsHigh, sizes: r.sizes,
    });
  }

  // Classification thresholds
  const sortedByCount = [...statsArr].sort((a, b) => b.tradeCount - a.tradeCount);
  const top33CountThreshold = sortedByCount[Math.floor(sortedByCount.length * 0.33)]?.tradeCount ?? 0;

  const allAvgSizes = statsArr.map(s => s.avgSize).sort((a, b) => a - b);
  const medianSize = allAvgSizes[Math.floor(allAvgSizes.length / 2)] ?? 0;
  const top25SizeThreshold = allAvgSizes[Math.floor(allAvgSizes.length * 0.75)] ?? 0;

  const result = new Map<string, TraderStats>();
  for (const s of statsArr) {
    let cls: TraderClass;
    if (s.traderId === 'SUBMISSION') {
      cls = 'F';
    } else if (s.fracBuysLow > 0.6 || s.fracSellsHigh > 0.6) {
      cls = 'I';
    } else if (s.avgSize >= top25SizeThreshold && top25SizeThreshold > 0) {
      cls = 'B';
    } else if (
      s.tradeCount >= top33CountThreshold &&
      Math.abs(s.buySellRatio - 0.5) < 0.15 &&
      s.avgSize < medianSize
    ) {
      cls = 'M';
    } else {
      cls = 'S';
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sizes: _sizes, ...rest } = s;
    result.set(s.traderId, { ...rest, traderClass: cls });
  }

  return result;
}

// ── Autocorrelation ───────────────────────────────────────────────────────────

export function computeAutocorrelations(
  midPriceSeries: number[],
  maxLag = 10
): { lag: number; acf: number; ciUpper: number; ciLower: number }[] {
  const returns = diff(midPriceSeries);
  const n = returns.length;
  if (n < maxLag + 2) return [];

  const m = mean(returns);
  const centered = returns.map(r => r - m);
  const varSum = centered.reduce((s, v) => s + v * v, 0);

  const ci = 1.96 / Math.sqrt(n);

  const out: { lag: number; acf: number; ciUpper: number; ciLower: number }[] = [];
  for (let k = 1; k <= maxLag; k++) {
    let covSum = 0;
    for (let i = k; i < n; i++) covSum += centered[i] * centered[i - k];
    const acf = varSum > 0 ? covSum / varSum : 0;
    out.push({ lag: k, acf, ciUpper: ci, ciLower: -ci });
  }
  return out;
}

// ── PnL Histogram ─────────────────────────────────────────────────────────────

export function buildPnlHistogram(
  pnlSeries: number[],
  numBins = 20
): { range: string; count: number }[] {
  const returns = diff(pnlSeries);
  if (returns.length === 0) return [];

  const minR = Math.min(...returns);
  const maxR = Math.max(...returns);
  if (minR === maxR) return [{ range: minR.toFixed(1), count: returns.length }];

  const binSize = (maxR - minR) / numBins;
  const counts = new Array<number>(numBins).fill(0);
  for (const r of returns) {
    const idx = Math.min(Math.floor((r - minR) / binSize), numBins - 1);
    counts[idx]++;
  }

  return counts.map((count, i) => ({
    range: (minR + i * binSize).toFixed(1),
    count,
  }));
}
