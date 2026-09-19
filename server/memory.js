// Merchant Brain long-term memory. Always writes locally (source of truth, works offline) and, when
// COGNEE_URL is set, mirrors into Cognee (one dataset per merchant = per-merchant isolation) so the
// knowledge graph can answer richer questions. Cognee is best-effort: failures never block the merchant.
import { all, run } from './db.js';
import { config } from './config.js';

const enabled = () => Boolean(config.cognee.url);
const headers = () => (config.cognee.token ? { Authorization: `Bearer ${config.cognee.token}` } : {});
const dataset = (id) => `merchant_${id}`;
const timers = new Map();
export const stats = { cogneeOk: 0, cogneeFail: 0 };

async function cogneeAdd(merchantId, text) {
  const form = new FormData();
  form.append('data', new Blob([text], { type: 'text/plain' }), `note_${Date.now()}.txt`);
  form.append('datasetName', dataset(merchantId));
  const res = await fetch(`${config.cognee.url}/api/v1/add`, { method: 'POST', headers: headers(), body: form, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`cognee add ${res.status}`);
  // build the graph at most once every 10s per merchant
  clearTimeout(timers.get(merchantId));
  timers.set(merchantId, setTimeout(() => {
    fetch(`${config.cognee.url}/api/v1/cognify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ datasets: [dataset(merchantId)] }), signal: AbortSignal.timeout(60000),
    }).catch(() => {});
  }, 10_000).unref());
}

export function remember(merchantId, kind, text) {
  run('INSERT INTO memories(merchant_id,kind,text,ts) VALUES(?,?,?,?)', merchantId, kind, text, Date.now());
  if (enabled()) cogneeAdd(merchantId, text).then(() => stats.cogneeOk++).catch(() => stats.cogneeFail++);
}

function localRecall(merchantId, query, k) {
  const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const rows = all('SELECT kind,text,ts FROM memories WHERE merchant_id=? ORDER BY ts DESC LIMIT 200', merchantId);
  return rows
    .map((r) => ({ ...r, score: words.reduce((s, w) => s + (r.text.toLowerCase().includes(w) ? 1 : 0), 0) }))
    .filter((r) => r.score > 0 || !words.length)
    .sort((a, b) => b.score - a.score || b.ts - a.ts)
    .slice(0, k);
}

export async function recall(merchantId, query, k = 4) {
  if (enabled()) {
    try {
      const res = await fetch(`${config.cognee.url}/api/v1/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify({ query, search_type: 'GRAPH_COMPLETION', datasets: [dataset(merchantId)] }), signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        const items = (Array.isArray(data) ? data : [data]).map((x) => (typeof x === 'string' ? x : x?.text || x?.search_result || JSON.stringify(x))).flat().slice(0, k);
        if (items.length) return { source: 'cognee', items: items.map((text) => ({ text: String(text) })) };
      }
    } catch { /* fall through to local */ }
  }
  return { source: 'local', items: localRecall(merchantId, query, k) };
}

export async function health() {
  if (!enabled()) return { enabled: false, status: 'off' };
  try {
    const r = await fetch(`${config.cognee.url}/health`, { signal: AbortSignal.timeout(1500) });
    return { enabled: true, status: r.ok ? 'up' : 'down', ...stats };
  } catch {
    return { enabled: true, status: 'down', ...stats };
  }
}
