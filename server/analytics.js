// "Merchant Brain" feature layer: turns raw txns into the Merchant-360 profile the agents reason over.
// In production this is the Kafka -> Spark/Delta -> Feast pipeline; here it is SQL + a short TTL cache
// (the cache interface is the Redis seam).
import { all, get } from './db.js';
import { clock, ymd, addDays, dowOf, roundTo } from './util.js';

const cache = new Map();
const TTL_MS = 20_000;
export const invalidate = (id) => cache.delete(id);

// Approximate dates for demo purposes.
const FESTIVALS = [
  { name: 'Ganesh Chaturthi', date: '2026-09-14' },
  { name: 'Navratri', date: '2026-10-11' },
  { name: 'Dussehra', date: '2026-10-20' },
  { name: 'Karwa Chauth', date: '2026-10-29' },
  { name: 'Dhanteras', date: '2026-11-06' },
  { name: 'Diwali', date: '2026-11-08' },
  { name: 'Eid-e-Milad', date: '2026-08-26' },
];
const FEST_LIFT = { kirana: 1.25, sweets: 1.8, apparel: 1.5, restaurant: 1.1, pharmacy: 1.0 };

export function merchant360(id) {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.v;
  const v = compute(id);
  cache.set(id, { at: Date.now(), v });
  return v;
}

function compute(id) {
  const m = get('SELECT * FROM merchants WHERE id=?', id);
  if (!m) return null;
  const now = clock.now();
  const today = ymd(now);
  const hour = now.getHours();
  const d = (n) => ymd(addDays(now, -n));

  // ---- sales series
  const rows = all('SELECT day, SUM(amount) amt, COUNT(*) n FROM txns WHERE merchant_id=? AND day>=? GROUP BY day', id, d(60));
  const byDay = Object.fromEntries(rows.map((r) => [r.day, r]));
  const series = [];
  for (let i = 29; i >= 0; i--) series.push({ day: d(i), dow: dowOf(d(i)), amount: byDay[d(i)]?.amt || 0, n: byDay[d(i)]?.n || 0 });
  const sum = (from, to) => { let s = 0; for (let i = from; i <= to; i++) s += byDay[d(i)]?.amt || 0; return s; };
  const todayRow = byDay[today] || { amt: 0, n: 0 };
  const sameDays = [7, 14, 21, 28].map(d);
  const expectedByNow = (get(`SELECT SUM(amount) s FROM txns WHERE merchant_id=? AND day IN (?,?,?,?) AND hour<=?`, id, ...sameDays, hour).s || 0) / 4;
  const week = sum(1, 7);
  const prevWeek = sum(8, 14);
  const monthGmv = sum(1, 30);

  // ---- weekday pattern (last 8 full weeks)
  const dSum = Array(7).fill(0);
  const dCnt = Array(7).fill(0);
  for (const r of rows) {
    if (r.day === today || r.day < d(56)) continue;
    const w = dowOf(r.day);
    dSum[w] += r.amt;
    dCnt[w]++;
  }
  const dowAvg = dSum.map((s, i) => (dCnt[i] ? s / dCnt[i] : 0));
  const active = dowAvg.filter(Boolean);
  const overall = active.length ? active.reduce((a, b) => a + b, 0) / active.length : 0;
  const dowIdx = dowAvg.map((a) => (overall ? a / overall : 1));
  let weakDow = 0;
  dowIdx.forEach((x, i) => { if (dowAvg[i] && x < dowIdx[weakDow]) weakDow = i; });
  const bestDow = dowIdx.indexOf(Math.max(...dowIdx));
  const weakest = { dow: weakDow, idx: dowIdx[weakDow], dipPct: Math.round((1 - dowIdx[weakDow]) * 100), gapPerDay: overall * (1 - dowIdx[weakDow]) };

  // ---- festival & signals
  const fest = FESTIVALS.map((f) => ({ ...f, days: Math.round((new Date(f.date) - new Date(today)) / 864e5) })).filter((f) => f.days >= 0 && f.days <= 60).sort((a, b) => a.days - b.days)[0] || null;
  const festMult = fest && fest.days <= 14 ? FEST_LIFT[m.category] || 1 : 1;

  // ---- inventory
  const vel = Object.fromEntries(all('SELECT sku, SUM(qty) q FROM txn_items WHERE merchant_id=? AND day>=? AND day<? GROUP BY sku', id, d(14), today).map((r) => [r.sku, r.q / 14]));
  const inventory = all('SELECT * FROM products WHERE merchant_id=?', id)
    .map((p) => {
      const v = vel[p.sku] || 0;
      const need = v * festMult;
      const cover = need > 0 ? p.stock / need : 99;
      return {
        sku: p.sku, name: p.name, stock: p.stock, vel: v, cover, lead: p.lead_days, supplier: p.supplier, cost: p.cost, price: p.price,
        margin: (p.price - p.cost) / p.price, risk: v >= 0.3 && cover < p.lead_days + 3,
        reorderQty: Math.max(1, Math.ceil(need * 14) - p.stock),
      };
    })
    .sort((a, b) => a.cover - b.cover);

  // ---- customers
  const seg = (where, ...p) => get(`SELECT COUNT(*) n FROM customers WHERE merchant_id=? AND ${where}`, id, ...p).n;
  const customers = {
    loyal: seg('last_seen>=? AND visits>=8', d(14)),
    fresh: seg('first_seen>=?', d(14)),
    lapsed: seg('last_seen<=? AND last_seen>=? AND visits>=3', d(30), d(90)),
    lapsedConsented: seg('last_seen<=? AND last_seen>=? AND visits>=3 AND consent=1', d(30), d(90)),
    total: seg('1=1'),
  };
  const tk = get('SELECT SUM(amount) s, COUNT(*) n FROM txns WHERE merchant_id=? AND day>=? AND day<?', id, d(30), today);
  const avgTicket = tk.n ? tk.s / tk.n : 0;

  // ---- money
  const mg = get(`SELECT SUM(i.qty*(p.price-p.cost)) g, SUM(i.qty*p.price) s FROM txn_items i JOIN products p ON p.merchant_id=i.merchant_id AND p.sku=i.sku WHERE i.merchant_id=? AND i.day>=?`, id, d(30));
  const margin = mg.s ? mg.g / mg.s : 0.15;
  const netMonthly = monthGmv * margin * 0.55; // after assumed opex
  const limit = Math.min(500000, roundTo(monthGmv * 0.4, 5000));
  const months = 12;
  const rate = 0.18 / 12;
  // recommended principal = largest amount whose EMI stays within 25% of monthly surplus
  const affordable = ((0.25 * netMonthly) * (1 - Math.pow(1 + rate, -months))) / rate;
  const amount = Math.max(0, Math.min(limit, roundTo(monthGmv * 0.25, 5000), roundTo(affordable, 5000)));
  const emi = amount ? Math.round((amount * rate) / (1 - Math.pow(1 + rate, -months))) : 0;
  const emiShare = netMonthly ? emi / netMonthly : 1;
  const pendingSettle = get(`SELECT SUM(txn_total-fee) s FROM settlements WHERE merchant_id=? AND status='pending'`, id).s || 0;
  const projected30 = Array.from({ length: 30 }, (_, i) => dowAvg[addDays(now, i + 1).getDay()]).reduce((a, b) => a + b, 0);
  const cash = { monthGmv, avgDaily: monthGmv / 30, margin, netMonthly, limit, amount, months, apr: 18, emi, emiShare, eligible: amount >= 25000 && emiShare <= 0.3, pendingSettle, projected30 };

  // ---- compliance
  const monthStart = today.slice(0, 8) + '01';
  const gst = get(`SELECT SUM(i.qty*p.price) t, SUM(i.qty*p.price*p.gst_rate/(100+p.gst_rate)) g FROM txn_items i JOIN products p ON p.merchant_id=i.merchant_id AND p.sku=i.sku WHERE i.merchant_id=? AND i.day>=?`, id, monthStart);
  const pendingInv = all(`SELECT * FROM invoices WHERE merchant_id=? AND status='pending'`, id);
  const mismatch = get(`SELECT COUNT(*) n, SUM(txn_total-fee-settled) s FROM settlements WHERE merchant_id=? AND status='settled' AND ABS(txn_total-fee-settled)>1`, id);
  const dueDate = now.getDate() <= 20 ? new Date(now.getFullYear(), now.getMonth(), 20) : new Date(now.getFullYear(), now.getMonth() + 1, 20);
  const compliance = {
    turnover: gst.t || 0, gstPayable: gst.g || 0, pendingInvoices: pendingInv, pendingAmount: pendingInv.reduce((a, b) => a + b.amount, 0),
    reconDays: mismatch.n || 0, reconShort: mismatch.s || 0, dueDay: 20, daysToDue: Math.round((dueDate - new Date(today)) / 864e5),
  };

  return {
    merchant: m, today, hour,
    sales: {
      today: todayRow.amt, todayCount: todayRow.n, expectedByNow, deltaPct: expectedByNow ? Math.round(((todayRow.amt - expectedByNow) / expectedByNow) * 100) : 0,
      yesterday: byDay[d(1)]?.amt || 0, yesterdayCount: byDay[d(1)]?.n || 0, week, prevWeek, weekDeltaPct: prevWeek ? Math.round(((week - prevWeek) / prevWeek) * 100) : 0,
      series, overallDaily: overall, dowIdx, bestDow,
    },
    weakest, festival: fest, festMult, inventory, customers, avgTicket, cash, compliance,
    signals: { footfall: m.footfall_idx, competitors: m.competitors_2km, consumers: m.consumers_2km },
  };
}

