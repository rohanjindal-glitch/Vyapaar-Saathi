// Specialist agents. Each is a pure function over the Merchant-360 profile and returns ranked-able
// opportunities. Growth negotiates with Inventory (stock check) and Customer (audience) before it
// proposes, and records that negotiation in `trace` so the merchant can see why.
import { config } from './config.js';
import { clock, ymd, addDays, inr } from './util.js';

const nextDay = (dow) => {
  const now = clock.now();
  for (let i = 1; i <= 7; i++) if (addDays(now, i).getDay() === dow) return ymd(addDays(now, i));
};

// ---- Inventory Agent -------------------------------------------------------------------------
export const inventory = {
  id: 'inventory',
  // used by Growth: can we promote this SKU without a stock-out?
  confirmStock(f, sku, promoLift = 1.4) {
    const p = f.inventory.find((x) => x.sku === sku);
    return p && p.vel > 0 && p.stock / (p.vel * promoLift) >= 3;
  },
  run(f) {
    const risky = f.inventory.filter((x) => x.risk);
    const bySupplier = Object.groupBy(risky, (x) => x.supplier);
    return Object.entries(bySupplier).map(([supplier, items]) => {
      const lines = items.map((x) => ({ sku: x.sku, name: x.name, qty: x.reorderQty, unitCost: x.cost }));
      const risk = items.reduce((s, x) => s + x.vel * x.price * Math.max(0, 7 - x.cover), 0);
      const days = Math.max(1, Math.round(Math.min(...items.map((x) => x.cover))));
      return {
        key: `inventory:${supplier}`, kind: 'reorder_stock', agent: 'inventory', money_moving: true, confidence: 0.8, impact: Math.round(risk),
        copy: {
          k: 'inventory',
          p: {
            n: items.length, supplier, list: items.slice(0, 3).map((x) => x.name).join(', '), days, m_risk: Math.round(risk),
            festival: f.festMult > 1 ? { name: f.festival.name, days: f.festival.days } : null,
          },
        },
        payload: { supplier, lines, total: lines.reduce((s, l) => s + l.qty * l.unitCost, 0), etaDays: Math.max(...items.map((x) => x.lead)) },
        trace: [{ agent: 'inventory', note: `${items.length} SKU(s) below lead-time cover; PO drafted for ${supplier}` }],
      };
    });
  },
};

// ---- Customer Agent --------------------------------------------------------------------------
export const customer = {
  id: 'customer',
  audience(f) {
    return { lapsed: f.customers.lapsedConsented, nearby: f.signals.consumers };
  },
  run(f) {
    const n = f.customers.lapsedConsented;
    if (n < 20) return [];
    const pct = 12;
    const back = Math.round((n * pct) / 100);
    return [{
      key: 'winback:lapsed', kind: 'winback_campaign', agent: 'customer', money_moving: false, confidence: 0.6, impact: Math.round(back * f.avgTicket * 2),
      copy: { k: 'winback', p: { n, pct, back } },
      payload: { segment: 'lapsed_30_90d', audience: Math.min(n, config.guardrails.maxWinbackRecipients), offer: '10% off your next visit', code: 'SAATHI10', channel: 'whatsapp' },
      trace: [{ agent: 'customer', note: `${n} lapsed customers with marketing consent (of ${f.customers.lapsed} lapsed)` }],
    }];
  },
};

// ---- Growth Agent ----------------------------------------------------------------------------
export const growth = {
  id: 'growth',
  run(f) {
    const w = f.weakest;
    if (!w || w.idx > 0.9 || !f.sales.overallDaily) return [];
    const trace = [{ agent: 'growth', note: `Weekday pattern: dow ${w.dow} runs ${w.dipPct}% below average` }];
    const candidates = f.inventory.filter((x) => x.margin >= 0.12 && x.vel >= 1).sort((a, b) => b.vel * b.margin - a.vel * a.margin);
    const ok = candidates.filter((x) => inventory.confirmStock(f, x.sku));
    trace.push({ agent: 'inventory', note: ok.length >= 2 ? `Stock covers a promo: ${ok[0].name}, ${ok[1].name}` : 'Not enough safe stock for a combo' });
    if (ok.length < 2) return [];
    const [a, b] = ok;
    const aud = customer.audience(f);
    trace.push({ agent: 'customer', note: `Audience: ${aud.lapsed} lapsed buyers + ${aud.nearby} shoppers within 2 km` });
    const off = 20;
    const recovered = w.gapPerDay * 0.35;
    const redemptions = Math.max(1, Math.round(recovered / (f.avgTicket || 1)));
    const spendCap = Math.min(config.guardrails.maxOfferSpend, Math.ceil(off * redemptions * 1.5));
    const impact = Math.round(recovered * 4.3 - off * redemptions * 4.3);
    return [{
      key: `growth_dip:${w.dow}`, kind: 'launch_offer', agent: 'growth', money_moving: false, confidence: 0.7, impact,
      copy: { k: 'growth_dip', p: { dow: w.dow, off, dip: w.dipPct, m_gap: Math.round(w.gapPerDay), a: a.name, b: b.name, reach: aud.nearby } },
      payload: {
        weekday: w.dow, startDay: nextDay(w.dow), name: `${a.name} + ${b.name}`, skus: [a.sku, b.sku], mrp: a.price + b.price,
        offerPrice: a.price + b.price - off, discount: off, radiusKm: 2, reach: aud.nearby, lapsedTargets: aud.lapsed, spendCap, expectedRedemptions: redemptions,
      },
      trace,
    }];
  },
};

// ---- Money Agent -----------------------------------------------------------------------------
export const money = {
  id: 'money',
  run(f) {
    const c = f.cash;
    if (!c.eligible) return [];
    return [{
      key: 'loan:working_capital', kind: 'apply_loan', agent: 'money', money_moving: true, confidence: 0.5, impact: Math.round(c.amount * 0.05),
      copy: { k: 'loan', p: { m_limit: c.limit, m_gmv: Math.round(c.monthGmv), m_emi: c.emi, share: Math.round(c.emiShare * 100) } },
      payload: { amount: c.amount, limit: c.limit, months: c.months, apr: c.apr, emi: c.emi },
      trace: [{ agent: 'money', note: `EMI ${inr(c.emi)} = ${Math.round(c.emiShare * 100)}% of est. monthly surplus (cap 30%)` }],
    }];
  },
};

// ---- Compliance Agent ------------------------------------------------------------------------
export const compliance = {
  id: 'compliance',
  run(f) {
    const c = f.compliance;
    if (!c.pendingInvoices.length) return [];
    return [{
      key: 'gst:pending_invoices', kind: 'raise_gst_invoices', agent: 'compliance', money_moving: false, confidence: 0.9,
      impact: 250 * c.pendingInvoices.length + (c.daysToDue <= 7 ? 1000 : 0),
      copy: { k: 'gst', p: { n: c.pendingInvoices.length, m_amount: Math.round(c.pendingAmount), due: c.dueDay } },
      payload: { invoices: c.pendingInvoices.map((i) => ({ id: i.id, buyer: i.buyer, gstin: i.gstin, amount: i.amount, gstRate: i.gst_rate })) },
      trace: [{ agent: 'compliance', note: `${c.pendingInvoices.length} unbilled B2B invoices; GSTR-3B due in ${c.daysToDue} days` }],
    }];
  },
};

export const AGENTS = [growth, inventory, customer, money, compliance];

// One-line status per agent for the dashboard tiles.
export function agentTiles(f) {
  const risky = f.inventory.filter((x) => x.risk).length;
  return [
    { id: 'growth', metric: f.weakest?.idx < 0.9 ? `−${f.weakest.dipPct}%` : 'OK', dow: f.weakest?.dow },
    { id: 'inventory', metric: `${risky}` },
    { id: 'customer', metric: `${f.customers.lapsedConsented}` },
    { id: 'money', metric: f.cash.eligible ? inr(f.cash.limit) : '—' },
    { id: 'compliance', metric: `${f.compliance.pendingInvoices.length}` },
    { id: 'voice', metric: 'ON' },
  ];
}

