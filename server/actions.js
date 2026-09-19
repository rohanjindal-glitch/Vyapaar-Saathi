// Orchestrator + execution engine: ranks opportunities, persists them as proposals, runs the
// consent/guardrail checks, dispatches approved actions to n8n, and measures outcomes against a holdout.
import { randomUUID } from 'node:crypto';
import { all, get, run, audit } from './db.js';
import { config } from './config.js';
import { AGENTS } from './agents.js';
import { merchant360, invalidate } from './analytics.js';
import { t } from './i18n.js';
import { HttpError, dayName, inr, clock, ymd, addDays } from './util.js';
import { execute } from './executor.js';
import { remember } from './memory.js';

const DAY = 864e5;
const inflight = new Map();
const REVERSIBLE = new Set(['launch_offer']);
const CONSENT_SCOPE = { launch_offer: 'marketing', winback_campaign: 'marketing', apply_loan: 'lending' };
const ACCEPTED = "('approved','executing','done','holdout_logged','reverted')";

// ---- ranking ----------------------------------------------------------------------------------
// score = rupee impact x confidence x agent weight; the weight is learned from what this merchant
// actually accepts (closed loop: ignored agents fade, trusted agents rise).
function agentWeight(merchantId, agent) {
  const r = get(`SELECT COUNT(*) n, SUM(CASE WHEN status IN ${ACCEPTED} THEN 1 ELSE 0 END) a FROM actions WHERE merchant_id=? AND agent=? AND status<>'expired' AND status<>'proposed'`, merchantId, agent);
  return 0.5 + (((r.a || 0) + 1) / ((r.n || 0) + 2)); // 0.5 .. 1.5
}

export function rankOpportunities(merchantId) {
  const f = merchant360(merchantId);
  return AGENTS.flatMap((a) => a.run(f))
    .map((o) => ({ ...o, score: o.impact * o.confidence * agentWeight(merchantId, o.agent) }))
    .sort((a, b) => b.score - a.score);
}

// ---- proposals ---------------------------------------------------------------------------------
export function refreshProposals(m) {
  const ts = Date.now();
  const seen = new Set();
  for (const o of rankOpportunities(m.id)) {
    const recent = get(
      `SELECT 1 x FROM actions WHERE merchant_id=? AND dedupe_key=? AND ((status='rejected' AND updated_at>?) OR (status IN ('approved','executing','done','holdout_logged','reverted') AND updated_at>?))`,
      m.id, o.key, ts - 3 * DAY, ts - 7 * DAY,
    );
    if (recent) continue;
    seen.add(o.key);
    const open = get(`SELECT id FROM actions WHERE merchant_id=? AND dedupe_key=? AND status='proposed'`, m.id, o.key);
    if (open) {
      run('UPDATE actions SET copy=?, impact=?, confidence=?, payload=?, trace=?, updated_at=? WHERE id=?', JSON.stringify(o.copy), o.impact, o.confidence, JSON.stringify(o.payload), JSON.stringify(o.trace), ts, open.id);
    } else {
      run('INSERT INTO actions(id,merchant_id,dedupe_key,type,agent,copy,impact,confidence,money_moving,payload,trace,status,cohort,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        randomUUID(), m.id, o.key, o.kind, o.agent, JSON.stringify(o.copy), o.impact, o.confidence, o.money_moving ? 1 : 0, JSON.stringify(o.payload), JSON.stringify(o.trace), 'proposed', m.cohort, ts, ts);
    }
  }
  for (const r of all(`SELECT id, dedupe_key FROM actions WHERE merchant_id=? AND status='proposed'`, m.id))
    if (!seen.has(r.dedupe_key)) run(`UPDATE actions SET status='expired', updated_at=? WHERE id=?`, ts, r.id);
}

function expand(p, lang) {
  const out = { ...p };
  if (p.dow != null) out.day = dayName(p.dow, lang);
  if (p.festival) out.note = t(lang, 'note.festival', p.festival);
  else if ('festival' in p) out.note = '';
  for (const k of Object.keys(p)) if (k.startsWith('m_')) out[k] = inr(p[k]);
  return out;
}

export function serialize(row, lang) {
  const copy = JSON.parse(row.copy);
  const p = expand(copy.p, lang);
  return {
    id: row.id, type: row.type, agent: row.agent, status: row.status, impact: row.impact, confidence: row.confidence,
    moneyMoving: !!row.money_moving, reversible: REVERSIBLE.has(row.type) && row.status === 'done', cohort: row.cohort, method: row.method,
    title: t(lang, `opp.${copy.k}.title`, p), why: t(lang, `opp.${copy.k}.why`, p),
    payload: JSON.parse(row.payload), trace: JSON.parse(row.trace || '[]'), result: row.result ? JSON.parse(row.result) : null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function listProposals(m, lang) {
  refreshProposals(m);
  return all(`SELECT * FROM actions WHERE merchant_id=? AND status='proposed' ORDER BY impact*confidence DESC`, m.id).map((r) => serialize(r, lang));
}

export function history(m, lang, limit = 20) {
  return all(`SELECT * FROM actions WHERE merchant_id=? AND status NOT IN ('proposed','expired') ORDER BY updated_at DESC LIMIT ?`, m.id, limit).map((r) => serialize(r, lang));
}

// ---- guardrails --------------------------------------------------------------------------------
const consented = (merchantId, scope) => !!get('SELECT granted g FROM consents WHERE merchant_id=? AND scope=?', merchantId, scope)?.g;

function guardrails(m, a, payload) {
  const scope = CONSENT_SCOPE[a.type];
  if (scope && !consented(m.id, scope)) return { ok: false, code: 'consent_required', scope };
  if (a.type === 'launch_offer' && payload.spendCap > config.guardrails.maxOfferSpend) return { ok: false, code: 'spend_cap_exceeded' };
  if (a.type === 'winback_campaign' && payload.audience > config.guardrails.maxWinbackRecipients) return { ok: false, code: 'audience_cap_exceeded' };
  if (a.type === 'apply_loan') {
    const limit = merchant360(m.id).cash.limit;
    if (payload.amount > limit) return { ok: false, code: 'above_eligibility' };
  }
  return { ok: true };
}

// ---- lifecycle ---------------------------------------------------------------------------------
const load = (m, id) => {
  const a = get('SELECT * FROM actions WHERE id=? AND merchant_id=?', id, m.id);
  if (!a) throw new HttpError(404, 'action_not_found');
  return a;
};
const setStatus = (id, status, extra = {}) =>
  run('UPDATE actions SET status=?, method=COALESCE(?,method), result=COALESCE(?,result), updated_at=? WHERE id=?', status, extra.method ?? null, extra.result ? JSON.stringify(extra.result) : null, Date.now(), id);
const titleOf = (a) => serialize(a, 'en').title;

export async function approve(m, id, method = 'tap') {
  const a = load(m, id);
  if (a.status !== 'proposed') throw new HttpError(409, 'not_pending', { status: a.status });
  if (!['tap', 'voice'].includes(method)) throw new HttpError(400, 'bad_method');
  const payload = JSON.parse(a.payload);
  const g = guardrails(m, a, payload);
  if (!g.ok) {
    audit(m.id, 'action_blocked', { id, code: g.code });
    throw new HttpError(422, g.code, { scope: g.scope });
  }
  if (m.cohort === 'holdout') {
    setStatus(id, 'holdout_logged', { method });
    audit(m.id, 'action_holdout_logged', { id, type: a.type });
    remember(m.id, 'decision', `Approved "${titleOf(a)}" (control group, not executed).`);
    return serialize(load(m, id), m.lang);
  }
  run(`UPDATE actions SET status='executing', method=?, updated_at=? WHERE id=?`, method, Date.now(), id);
  audit(m.id, 'action_approved', { id, type: a.type, method, moneyMoving: !!a.money_moving });
  remember(m.id, 'decision', `Merchant approved "${titleOf(a)}" via ${method}.`);
  // asynchronous execution: the merchant sees "executing" first, then "done" (or "failed")
  const job = execute(a.type, payload, { actionId: id, merchantId: m.id })
    .then((result) => complete(id, result, 'done'))
    .catch((e) => complete(id, { error: e.message, via: 'rail' }, 'failed'))
    .finally(() => inflight.delete(id));
  inflight.set(id, job);
  if (config.execInline) await job;
  return serialize(load(m, id), m.lang);
}

export function reject(m, id) {
  const a = load(m, id);
  if (a.status !== 'proposed') throw new HttpError(409, 'not_pending');
  setStatus(id, 'rejected');
  audit(m.id, 'action_rejected', { id });
  remember(m.id, 'decision', `Merchant rejected "${titleOf(a)}".`);
  return serialize(load(m, id), m.lang);
}

export async function revert(m, id) {
  const a = load(m, id);
  if (!REVERSIBLE.has(a.type) || a.status !== 'done') throw new HttpError(409, 'not_reversible');
  const res = await execute('revert', {}, { actionId: id, merchantId: m.id });
  setStatus(id, 'reverted', { result: { ...JSON.parse(a.result || '{}'), revertedVia: res.via } });
  audit(m.id, 'action_reverted', { id });
  remember(m.id, 'decision', `Merchant reverted "${titleOf(a)}".`);
  return serialize(load(m, id), m.lang);
}

function complete(id, result, status) {
  const a = get('SELECT * FROM actions WHERE id=?', id);
  setStatus(id, status, { result });
  audit(a.merchant_id, `action_${status}`, { id, type: a.type, via: result.via });
  remember(a.merchant_id, 'outcome', `"${titleOf(a)}" ${status}: ${JSON.stringify(result)}`);
  invalidate(a.merchant_id);
}

/** Resolves when an in-flight execution finishes (used by tests and graceful shutdown). */
export const settle = (id) => inflight.get(id) ?? Promise.resolve();
export const settleAll = () => Promise.all([...inflight.values()]);

// ---- measurement: treatment vs holdout, 30d GMV vs previous 30d ---------------------------------
export function impactReport() {
  const now = clock.now();
  const d = (n) => ymd(addDays(now, -n));
  const rows = all('SELECT id, name, cohort FROM merchants').map((m) => {
    const cur = get('SELECT COALESCE(SUM(amount),0) s FROM txns WHERE merchant_id=? AND day>=? AND day<?', m.id, d(30), d(0)).s;
    const prev = get('SELECT COALESCE(SUM(amount),0) s FROM txns WHERE merchant_id=? AND day>=? AND day<?', m.id, d(60), d(30)).s;
    const acts = get(`SELECT COUNT(*) n, COALESCE(SUM(impact),0) i FROM actions WHERE merchant_id=? AND status='done'`, m.id);
    return { id: m.id, name: m.name, cohort: m.cohort, growthPct: prev ? ((cur - prev) / prev) * 100 : 0, executed: acts.n, estimatedImpact: acts.i };
  });
  const avg = (c) => { const x = rows.filter((r) => r.cohort === c); return x.length ? x.reduce((s, r) => s + r.growthPct, 0) / x.length : 0; };
  const treatment = avg('treatment');
  const holdout = avg('holdout');
  return { treatment, holdout, liftPts: treatment - holdout, merchants: rows, note: 'Measured on seeded synthetic data; needs post-action history in a real pilot.' };
}



