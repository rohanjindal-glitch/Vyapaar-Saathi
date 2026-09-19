// Voice Saathi / conversational entry point. Same brain for the web app, WhatsApp (via n8n) and
// Soundbox voice: text in (already transcribed) -> intent -> grounded reply + optional pending action.
import { all, get, run } from './db.js';
import { merchant360 } from './analytics.js';
import { t } from './i18n.js';
import { HttpError, dayName, inr } from './util.js';
import { approve, reject, listProposals } from './actions.js';
import { recall } from './memory.js';
import { askGrounded, llmEnabled } from './llm.js';

// Roman + Devanagari + Marathi/Gujarati/Tamil/Bengali keywords. Rules first = zero-cost routine intents.
const RX = {
  yes: /(^|\s)(haan|han|ha|haa|yes|yep|ok|okay|kar do|karo|theek hai|thik hai|हाँ|हां|हा|हो|ठीक है|कर दो|करो|હા|ஆம்|হ্যাঁ|হ্যা)(\s|$)/i,
  no: /(^|\s)(nahi|nahin|no|nope|mat karo|cancel|rehne do|नहीं|नही|नको|ना|ના|இல்லை|না)(\s|$)/i,
  plan: /(aaj kya|kya karun|kya karu|what should|suggest|salah|sujhav|plan|kya karna|आज क्या|क्या करूँ|क्या करू|सलाह|आज काय|આજે શું|இன்று என்ன|আজ কী)/i,
  today: /(aaj|today|आज|இன்று|இன்றைய|આજ|আজ).*(sale|sales|bikri|bikri|becha|kamai|kitni|kitna|बिक्री|सेल|कमाई|कितनी|किती|विक्री|વેચાણ|விற்பனை|বিক্রি)|(sale|sales|बिक्री|विक्री).*(aaj|today|आज)/i,
  yesterday: /(kal|yesterday|कल|काल|ગઈકાલ|நேற்று|গতকাল).*(sale|sales|bikri|बिक्री|विक्री|વેચાણ|விற்பனை|বিক্রি|hui|हुई)/i,
  week: /(week|hafta|hafte|हफ्ते|हफ्ता|आठवडा|અઠવાડિયા|வாரம்|সপ্তাহ)/i,
  stock: /(stock|maal|inventory|khatam|reorder|स्टॉक|माल|साठा|સ્ટોક|ஸ்டாக்|স্টক)/i,
  customers: /(customer|grahak|grahakon|lapsed|purane|ग्राहक|ग्राहकां|ગ્રાહક|வாடிக்கையாளர்|গ্রাহক)/i,
  loan: /(loan|karz|udhaar|udhar|working capital|लोन|कर्ज|कर्ज़|ઉધાર|લોન|கடன்|লোন)/i,
  gst: /(gst|invoice|tax|hisab|जीएसटी|इनवॉइस|ઇન્વૉઇસ|இன்வாய்ஸ்|ইনভয়েস)/i,
  memory: /(yaad|remember|last time|pichli baar|history|याद|पिछली बार)/i,
};

const delta = (pct) => `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}%`;

function log(m, role, text, channel) {
  run('INSERT INTO messages(merchant_id,role,text,channel,ts) VALUES(?,?,?,?,?)', m.id, role, text, channel, Date.now());
}
const setPending = (mid, id) => run('INSERT INTO chat_state(merchant_id,pending_action_id) VALUES(?,?) ON CONFLICT(merchant_id) DO UPDATE SET pending_action_id=excluded.pending_action_id', mid, id);
const getPending = (mid) => get('SELECT pending_action_id p FROM chat_state WHERE merchant_id=?', mid)?.p;

export async function handleChat(m, rawText, { lang = m.lang, channel = 'app' } = {}) {
  const text = String(rawText || '').trim().slice(0, 500);
  if (!text) throw new HttpError(400, 'empty');
  log(m, 'user', text, channel);
  const reply = await route(m, text, lang);
  log(m, 'saathi', reply.text, channel);
  return reply;
}

async function route(m, text, lang) {
  const f = merchant360(m.id);
  const s = f.sales;
  const pendingId = getPending(m.id);

  // 1. confirmation of the last thing we offered ("haan" / "nahi")
  if (pendingId && RX.yes.test(` ${text} `) && text.length < 30) {
    const a = get('SELECT * FROM actions WHERE id=? AND merchant_id=?', pendingId, m.id);
    setPending(m.id, null);
    if (a?.status === 'proposed') {
      try {
        const act = await approve(m, pendingId, 'voice');
        return { text: t(lang, act.status === 'holdout_logged' ? 'approve_holdout' : 'approve_ok', { title: act.title }), actionId: act.id, action: act };
      } catch (e) {
        if (e.code === 'consent_required') return { text: t(lang, 'consent_block') };
        throw e;
      }
    }
  }
  if (pendingId && RX.no.test(` ${text} `) && text.length < 30) {
    setPending(m.id, null);
    reject(m, pendingId);
    return { text: t(lang, 'reject_ok') };
  }
  if ((RX.yes.test(` ${text} `) || RX.no.test(` ${text} `)) && text.length < 30) return { text: t(lang, 'nothing_pending') };

  // 2. routine intents (rules)
  if (RX.plan.test(text)) {
    const props = listProposals(m, lang).slice(0, 3);
    if (!props.length) return { text: t(lang, 'nothing_pending') };
    setPending(m.id, props[0].id);
    const lines = props.map((p, i) => `${i + 1}. ${p.title} — ~${inr(p.impact)}`);
    let intro = t(lang, 'plan_intro');
    if (llmEnabled()) {
      const facts = props.map((p) => ({ title: p.title, why: p.why, impact: Math.round(p.impact) }));
      const narrative = await askGrounded({ tier: 'large', lang, question: 'Explain in 3 sentences why these are the right things to do today.', facts, maxTokens: 350 });
      if (narrative) intro = narrative;
    }
    return { text: [intro, ...lines, t(lang, 'ask_confirm', { title: props[0].title })].join('\n'), actionId: props[0].id, proposals: props };
  }
  if (RX.yesterday.test(text)) return { text: t(lang, 'sales_yesterday', { yesterday: inr(s.yesterday), count: s.yesterdayCount }) };
  if (RX.today.test(text)) return { text: t(lang, 'sales_today', { today: inr(s.today), count: s.todayCount, expected: inr(s.expectedByNow), delta: delta(s.deltaPct) }) };
  if (RX.week.test(text)) return { text: t(lang, 'sales_week', { week: inr(s.week), delta: delta(s.weekDeltaPct), best: dayName(s.bestDow, lang) }) };
  if (RX.stock.test(text)) {
    const risky = f.inventory.filter((x) => x.risk);
    if (!risky.length) return { text: t(lang, 'stock_ok') };
    const props = listProposals(m, lang);
    const po = props.find((p) => p.type === 'reorder_stock');
    if (po) setPending(m.id, po.id);
    const list = risky.slice(0, 4).map((x) => `${x.name} (~${Math.max(1, Math.round(x.cover))}d)`).join(', ');
    return { text: [t(lang, 'stock_risk', { list }), po ? t(lang, 'ask_one', { title: po.title }) : ''].filter(Boolean).join('\n'), actionId: po?.id };
  }
  if (RX.customers.test(text)) {
    const props = listProposals(m, lang);
    const wb = props.find((p) => p.type === 'winback_campaign');
    if (wb) setPending(m.id, wb.id);
    return { text: t(lang, 'customers', { loyal: f.customers.loyal, lapsed: f.customers.lapsed, fresh: f.customers.fresh, impact: inr(wb?.impact || 0) }), actionId: wb?.id };
  }
  if (RX.loan.test(text)) {
    const c = f.cash;
    if (!c.eligible) return { text: t(lang, 'loan_no') };
    const ln = listProposals(m, lang).find((p) => p.type === 'apply_loan');
    if (ln) setPending(m.id, ln.id);
    return { text: [t(lang, 'loan', { limit: inr(c.limit), amount: inr(c.amount), months: c.months, emi: inr(c.emi) }), ln ? t(lang, 'ask_one', { title: ln.title }) : ''].filter(Boolean).join('\n'), actionId: ln?.id };
  }
  if (RX.gst.test(text)) {
    const c = f.compliance;
    const recon = c.reconDays ? t(lang, 'recon', { n: c.reconDays, short: inr(c.reconShort) }) : '';
    const inv = listProposals(m, lang).find((p) => p.type === 'raise_gst_invoices');
    if (inv) setPending(m.id, inv.id);
    return { text: [t(lang, 'gst', { turnover: inr(c.turnover), gst: inr(c.gstPayable), pending: c.pendingInvoices.length, due: c.dueDay, recon }), inv ? t(lang, 'ask_one', { title: inv.title }) : ''].filter(Boolean).join('\n'), actionId: inv?.id };
  }
  if (RX.memory.test(text)) {
    const r = await recall(m.id, text, 3);
    return { text: [t(lang, 'memory'), ...r.items.map((i) => `• ${i.text}`)].join('\n'), memorySource: r.source };
  }

  // 3. free text -> small model, grounded on the merchant's own numbers; otherwise help
  if (llmEnabled()) {
    const mem = await recall(m.id, text, 3);
    const facts = { today: Math.round(s.today), yesterday: Math.round(s.yesterday), week: Math.round(s.week), lapsedCustomers: f.customers.lapsed, stockRisk: f.inventory.filter((x) => x.risk).map((x) => x.name), memories: mem.items.map((i) => i.text) };
    const ans = await askGrounded({ tier: 'small', lang, question: text, facts, maxTokens: 250 });
    if (ans) return { text: ans };
  }
  if (/^(hi|hello|hey|namaste|namaskar|नमस्ते|नमस्कार|வணக்கம்|নমস্কার|નમસ્તે)/i.test(text)) return { text: t(lang, 'greet', { owner: m.owner.split(' ')[0] }) };
  return { text: t(lang, 'help') };
}

export const dailyBrief = (m, lang = m.lang) => {
  const f = merchant360(m.id);
  const top = listProposals(m, lang)[0];
  if (top) setPending(m.id, top.id);
  return {
    to: m.phone,
    text: top ? t(lang, 'brief', { owner: m.owner.split(' ')[0], yesterday: inr(f.sales.yesterday), title: top.title, impact: inr(top.impact) }) : t(lang, 'greet', { owner: m.owner.split(' ')[0] }),
    actionId: top?.id,
  };
};

export const recentMessages = (m, limit = 30) => all('SELECT role,text,channel,ts FROM messages WHERE merchant_id=? ORDER BY id DESC LIMIT ?', m.id, limit).reverse();


