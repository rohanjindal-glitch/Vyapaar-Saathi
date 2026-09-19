import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from './config.js';
import { all, get, run, audit } from './db.js';
import { ensureSeeded } from './seed.js';
import { merchant360 } from './analytics.js';
import { agentTiles } from './agents.js';
import { approve, reject, revert, listProposals, history, impactReport } from './actions.js';
import { handleChat, recentMessages } from './chat.js';
import { recall, remember, health as cogneeHealth } from './memory.js';
import { usage as llmUsage, llmEnabled } from './llm.js';
import { mode as railMode } from './executor.js';
import { startScheduler, sendWhatsApp, lastOutbound } from './channels.js';
import { normLang, LANGS } from './i18n.js';
import { HttpError, clock } from './util.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// ---- demo session tokens (production: Paytm for Business OAuth / device-bound auth) -------------
const sign = (p) => createHmac('sha256', config.sessionSecret).update(p).digest('base64url');
const issue = (mid) => {
  const p = Buffer.from(JSON.stringify({ mid, exp: Date.now() + 12 * 3600e3 })).toString('base64url');
  return `${p}.${sign(p)}`;
};
function verify(tok = '') {
  const [p, s] = tok.split('.');
  if (!p || !s) return null;
  const a = Buffer.from(sign(p));
  const b = Buffer.from(s);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const d = JSON.parse(Buffer.from(p, 'base64url').toString());
  return d.exp > Date.now() ? d.mid : null;
}

// ---- tiny in-memory rate limiter (production: gateway / Redis) ----------------------------------
const hits = new Map();
app.use('/api', (req, res, next) => {
  const k = req.ip;
  const now = Date.now();
  const h = hits.get(k);
  if (!h || h.reset < now) hits.set(k, { n: 1, reset: now + 60_000 });
  else if (++h.n > config.rateLimitPerMin) return res.status(429).json({ error: 'rate_limited' });
  next();
});

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const auth = (req, _res, next) => {
  const mid = verify((req.get('authorization') || '').replace(/^Bearer /, ''));
  const m = mid && get('SELECT * FROM merchants WHERE id=?', mid);
  if (!m) throw new HttpError(401, 'unauthorized');
  req.m = m;
  req.lang = normLang(req.query.lang || req.get('x-lang') || m.lang);
  next();
};
// ---- public ---------------------------------------------------------------------------------------
app.get('/api/health', (_req, res) => res.json({ ok: true, now: clock.now().toISOString() }));

app.get('/api/merchants', (_req, res) => res.json({ merchants: all('SELECT id,name,owner,city,locality,category,lang,cohort FROM merchants ORDER BY id'), languages: LANGS }));

app.post('/api/session', (req, res) => {
  const m = get('SELECT * FROM merchants WHERE id=?', req.body?.merchantId);
  if (!m) throw new HttpError(404, 'merchant_not_found');
  audit(m.id, 'session_started', {});
  res.json({ token: issue(m.id), merchant: { id: m.id, name: m.name, lang: m.lang } });
});

app.get('/api/status', wrap(async (_req, res) => {
  const cogH = await cogneeHealth();
  res.json({
    api: 'up', db: { merchants: get('SELECT COUNT(*) n FROM merchants').n, txns: get('SELECT COUNT(*) n FROM txns').n },
    executor: { mode: railMode(), whatsapp: Boolean(config.whatsapp.token), briefHour: config.briefHour }, cognee: cogH, llm: { enabled: llmEnabled(), usage: llmUsage, tiering: 'rules → small → large' },
    guardrails: config.guardrails,
  });
}));

// ---- merchant (authenticated) ---------------------------------------------------------------------
const me = express.Router();
me.use(auth);

me.get('/overview', (req, res) => {
  const f = merchant360(req.m.id);
  const { merchant: m, sales, weakest, inventory, customers, cash, compliance, signals, festival, avgTicket } = f;
  res.json({
    merchant: { id: m.id, name: m.name, owner: m.owner, city: m.city, locality: m.locality, category: m.category, lang: m.lang, device: m.device, plan: m.plan, cohort: m.cohort },
    lang: req.lang, sales, weakest, festival, avgTicket, customers, signals,
    inventory: inventory.slice(0, 6).map((x) => ({ sku: x.sku, name: x.name, stock: x.stock, cover: x.cover, risk: x.risk })),
    cash: { ...cash }, compliance: { ...compliance, pendingInvoices: compliance.pendingInvoices.length },
    agents: agentTiles(f),
  });
});

me.get('/opportunities', (req, res) => res.json({ opportunities: listProposals(req.m, req.lang) }));
me.get('/actions', (req, res) => res.json({ actions: history(req.m, req.lang, 30) }));
me.post('/actions/:id/approve', wrap(async (req, res) => res.json({ action: await approve(req.m, req.params.id, req.body?.method) })));
me.post('/actions/:id/reject', (req, res) => res.json({ action: reject(req.m, req.params.id) }));
me.post('/actions/:id/revert', wrap(async (req, res) => res.json({ action: await revert(req.m, req.params.id) })));

me.post('/chat', wrap(async (req, res) => res.json(await handleChat(req.m, req.body?.text, { lang: req.lang, channel: req.body?.channel || 'app' }))));
me.get('/chat/history', (req, res) => res.json({ messages: recentMessages(req.m) }));

me.get('/consent', (req, res) => res.json({ consents: all('SELECT scope, granted FROM consents WHERE merchant_id=?', req.m.id) }));
me.post('/consent', (req, res) => {
  const { scope, granted } = req.body || {};
  if (!['marketing', 'lending'].includes(scope)) throw new HttpError(400, 'bad_scope');
  run('INSERT INTO consents VALUES(?,?,?,?) ON CONFLICT(merchant_id,scope) DO UPDATE SET granted=excluded.granted, ts=excluded.ts', req.m.id, scope, granted ? 1 : 0, Date.now());
  audit(req.m.id, granted ? 'consent_granted' : 'consent_revoked', { scope });
  remember(req.m.id, 'consent', `Merchant ${granted ? 'granted' : 'revoked'} ${scope} consent.`);
  res.json({ consents: all('SELECT scope, granted FROM consents WHERE merchant_id=?', req.m.id) });
});

me.get('/audit', (req, res) => res.json({ audit: all('SELECT event, detail, ts FROM audit WHERE merchant_id=? ORDER BY id DESC LIMIT 25', req.m.id).map((r) => ({ ...r, detail: JSON.parse(r.detail) })) }));
me.get('/memory', wrap(async (req, res) => res.json(await recall(req.m.id, String(req.query.q || ''), 6))));
me.get('/impact', (_req, res) => res.json(impactReport()));
me.get('/outbound', (req, res) => res.json({ outbound: lastOutbound(req.m.id) }));
app.use('/api/me', me);

// ---- channels: WhatsApp Cloud API webhook (Saathi chat over WhatsApp) ------------------------------
app.get('/api/channels/whatsapp', (req, res) =>
  req.query['hub.verify_token'] === config.whatsapp.verifyToken ? res.send(req.query['hub.challenge']) : res.sendStatus(403));
app.post('/api/channels/whatsapp', wrap(async (req, res) => {
  res.sendStatus(200); // ack fast, reply asynchronously
  const msg = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg || msg.type !== 'text') return; // voice notes: add an ASR step here
  const m = get('SELECT * FROM merchants WHERE phone=?', String(msg.from));
  if (!m) return;
  const r = await handleChat(m, msg.text.body, { lang: m.lang, channel: 'whatsapp' });
  await sendWhatsApp(m, r.text);
}));
// ---- static + errors -------------------------------------------------------------------------------
const here = dirname(fileURLToPath(import.meta.url));
app.use(express.static(join(here, '..', 'public')));
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, ...err.extra });
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

export { app };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.env.SEED_ON_BOOT !== 'false' && ensureSeeded()) console.log('Seeded synthetic merchants');
  startScheduler();
  app.listen(config.port, () => {
    console.log(`Vyapaar Saathi  → http://localhost:${config.port}`);
    console.log(`Rails ${railMode()} | Cognee ${config.cognee.url || 'off (local memory)'} | LLM ${llmEnabled() ? 'on' : 'off (rules + templates)'}`);
  });
}


