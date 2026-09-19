// Smoke-test a RUNNING API: approves every action type for one merchant and prints how each was executed.
//   node scripts/e2e.js [merchantId] [apiBase]
const [merchantId = 'm_sharma', base = 'http://localhost:3000'] = process.argv.slice(2);
const call = async (path, opts = {}, token) => {
  const res = await fetch(base + path, {
    method: opts.method || 'GET',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { token } = await call('/api/session', { method: 'POST', body: { merchantId } });
const status = await call('/api/status');
console.log(`rails: ${status.executor.mode} | cognee: ${status.cognee.status} | llm: ${status.llm.enabled}`);

const { opportunities } = await call('/api/me/opportunities', {}, token);
let failed = 0;
for (const o of opportunities) {
  await call(`/api/me/actions/${o.id}/approve`, { method: 'POST', body: { method: 'tap' } }, token);
  let a;
  for (let i = 0; i < 10; i++) {
    await sleep(500);
    a = (await call('/api/me/actions', {}, token)).actions.find((x) => x.id === o.id);
    if (a.status !== 'executing') break;
  }
  const ok = a.status === 'done' || a.status === 'holdout_logged';
  if (!ok) failed++;
  console.log(`${ok ? 'OK ' : 'FAIL'} ${o.type.padEnd(20)} ${a.status.padEnd(15)} via=${a.result?.via ?? '-'} ${a.result?.note ? `(${a.result.note})` : ''}`);
}
const offer = (await call('/api/me/actions', {}, token)).actions.find((x) => x.type === 'launch_offer' && x.reversible);
if (offer) console.log('revert launch_offer ->', (await call(`/api/me/actions/${offer.id}/revert`, { method: 'POST' }, token)).action.status);

process.exit(failed ? 1 : 0);

