// Built-in action executor (replaces the external workflow engine).
// Each action type maps to a "rail" adapter. By default rails are mocks that return realistic results;
// set RAIL_<TYPE>_URL (e.g. RAIL_LAUNCH_OFFER_URL) to POST the payload to a real service instead and use
// its JSON response. Execution is asynchronous (approve returns "executing", completion lands moments later)
// and every rail re-checks the guardrails, so a bug upstream can't push a bad action to a partner API.
import { config } from './config.js';

const code = (p) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const ENV_KEY = { launch_offer: 'LAUNCH_OFFER', winback_campaign: 'WINBACK', reorder_stock: 'REORDER', raise_gst_invoices: 'GST_INVOICE', apply_loan: 'LOAN', revert: 'REVERT' };

const RAILS = {
  launch_offer(p) {
    if (p.spendCap > config.guardrails.maxOfferSpend) throw new Error('guardrail: spend cap above limit');
    if (p.discount > 30) throw new Error('guardrail: discount above 30');
    return { offerId: code('OFR'), liveAt: new Date().toISOString(), reach: p.reach, spendCap: p.spendCap, radiusKm: p.radiusKm };
  },
  winback_campaign(p) {
    if (p.audience > config.guardrails.maxWinbackRecipients) throw new Error('guardrail: audience above limit');
    return { campaignId: code('CMP'), channel: p.channel, sent: p.audience, code: p.code };
  },
  reorder_stock: (p) => ({ poNumber: code('PO'), supplier: p.supplier, lines: p.lines.length, total: p.total, etaDays: p.etaDays }),
  raise_gst_invoices: (p) => ({ invoices: p.invoices.map((i) => ({ buyer: i.buyer, irn: code('IRN') })) }),
  apply_loan(p) {
    if (p.amount > p.limit) throw new Error('guardrail: amount above eligibility');
    return { applicationId: code('LN'), status: 'submitted', amount: p.amount, emi: p.emi };
  },
  revert: () => ({ reverted: true }),
};

export const mode = () => (Object.values(ENV_KEY).some((k) => process.env[`RAIL_${k}_URL`]) ? 'mixed' : 'mock');

export async function execute(type, payload, ctx = {}) {
  const url = process.env[`RAIL_${ENV_KEY[type]}_URL`];
  await new Promise((r) => setTimeout(r, config.execDelayMs));
  if (url) {
    const res = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json', ...(process.env.RAIL_AUTH ? { authorization: process.env.RAIL_AUTH } : {}) },
      body: JSON.stringify({ type, payload, ...ctx }), signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`rail ${type} responded ${res.status}`);
    return { ...(await res.json()), via: 'rail:http' };
  }
  return { ...RAILS[type](payload), via: 'rail:mock' };
}
