// Outbound channels + the 8 AM daily brief. WhatsApp sends go through the Cloud API when
// WHATSAPP_TOKEN / WHATSAPP_PHONE_ID are set; otherwise they are queued in the `outbound` table
// (visible via /api/me/outbound) so the flow is testable without a Meta account.
import { all, get, run } from './db.js';
import { config } from './config.js';
import { clock, ymd } from './util.js';
import { dailyBrief } from './chat.js';

export async function sendWhatsApp(m, text) {
  let status = 'queued';
  if (config.whatsapp.token && config.whatsapp.phoneId) {
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${config.whatsapp.phoneId}/messages`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${config.whatsapp.token}` },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: m.phone, type: 'text', text: { body: text } }), signal: AbortSignal.timeout(8000),
      });
      status = res.ok ? 'sent' : `failed_${res.status}`;
    } catch { status = 'failed_network'; }
  }
  run('INSERT INTO outbound(merchant_id,channel,text,status,ts) VALUES(?,?,?,?,?)', m.id, 'whatsapp', text, status, Date.now());
  return status;
}

let lastRun = '';
export async function runDailyBrief() {
  for (const m of all('SELECT * FROM merchants')) await sendWhatsApp(m, dailyBrief(m).text);
}

/** Checks once a minute; fires once per day at BRIEF_HOUR:00. Single-instance MVP: run it on one replica only (or a cron job). */
export function startScheduler() {
  setInterval(() => {
    const now = clock.now();
    const key = ymd(now);
    if (now.getHours() === config.briefHour && lastRun !== key) {
      lastRun = key;
      runDailyBrief().catch((e) => console.error('daily brief failed', e));
    }
  }, 60_000).unref();
}

export const lastOutbound = (merchantId) => all('SELECT channel,text,status,ts FROM outbound WHERE merchant_id=? ORDER BY id DESC LIMIT 10', merchantId);
export const outboundCount = () => get('SELECT COUNT(*) n FROM outbound').n;
