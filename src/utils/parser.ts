import JSZip from 'jszip';
import Papa from 'papaparse';

export interface Trade {
  timestamp: number;
  buyer: string;
  seller: string;
  symbol: string;
  currency: string;
  price: number;
  quantity: number;
}

export interface ActivityRow {
  day: number;
  timestamp: number;
  product: string;
  bid_price_1?: number;
  bid_volume_1?: number;
  bid_price_2?: number;
  bid_volume_2?: number;
  bid_price_3?: number;
  bid_volume_3?: number;
  ask_price_1?: number;
  ask_volume_1?: number;
  ask_price_2?: number;
  ask_volume_2?: number;
  ask_price_3?: number;
  ask_volume_3?: number;
  mid_price?: number;
  profit_and_loss?: number;
}

export interface ParsedData {
  activities: { [product: string]: ActivityRow[] };
  positions: { [product: string]: { timestamp: number, quantity: number }[] };
  pnl: { [product: string]: { timestamp: number, pnl: number }[] };
  trades: { [product: string]: Trade[] };
  products: string[];
}

export async function parseZipLog(file: File): Promise<ParsedData> {
  const zip = new JSZip();
  const contents = await zip.loadAsync(file);
  
  let logFileContent = "";
  
  for (const [filename, fileData] of Object.entries(contents.files)) {
    if (filename.endsWith('.log') || filename.endsWith('.json')) {
      logFileContent = await fileData.async("text");
      break;
    }
  }
  
  if (!logFileContent) {
    throw new Error("Could not find a .log or .json file in the uploaded zip.");
  }

  // Parse root level JSON
  const parsedRoot = JSON.parse(logFileContent);
  
  let activitiesData = parsedRoot.activitiesLog || "";
  let tradeHistory = parsedRoot.tradeHistory || [];
  
  // Fast parse CSV with papaparse
  const parsedCsv = Papa.parse(activitiesData, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    delimiter: ";"
  });

  const allRows: ActivityRow[] = parsedCsv.data as ActivityRow[];
  
  const activities: { [product: string]: ActivityRow[] } = {};
  const productsSet = new Set<string>();
  
  for (const row of allRows) {
    if (!row.product) continue;
    productsSet.add(row.product);
    if (!activities[row.product]) {
      activities[row.product] = [];
    }
    activities[row.product].push(row);
  }
  
  const products = Array.from(productsSet);
  
  // Build Arrays for state
  const tradesMap: { [product: string]: Trade[] } = {};
  for (const p of products) tradesMap[p] = [];
  
  // Inject new products found only in trades
  for (const t of tradeHistory) {
    if (!productsSet.has(t.symbol)) {
      productsSet.add(t.symbol);
      products.push(t.symbol);
      tradesMap[t.symbol] = [];
    }
    if (!tradesMap[t.symbol]) tradesMap[t.symbol] = [];
    tradesMap[t.symbol].push(t);
  }
  
  const positions: { [product: string]: { timestamp: number, quantity: number }[] } = {};
  for (const p of products) {
    tradesMap[p].sort((a, b) => a.timestamp - b.timestamp);
    positions[p] = [];
    let currentQty = 0;
    
    positions[p].push({ timestamp: 0, quantity: 0 });
    
    for (const t of tradesMap[p]) {
      if (t.seller === "SUBMISSION") currentQty -= t.quantity;
      if (t.buyer === "SUBMISSION") currentQty += t.quantity;
      positions[p].push({ timestamp: t.timestamp, quantity: currentQty });
    }
  }

  const pnl: { [product: string]: { timestamp: number, pnl: number }[] } = {};
  for (const p of products) {
    pnl[p] = activities[p]?.map(r => ({ timestamp: r.timestamp, pnl: r.profit_and_loss || 0 })) || [];
  }

  return { activities, positions, pnl, trades: tradesMap, products };
}
