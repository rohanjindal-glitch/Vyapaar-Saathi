process.env.DB_PATH = ':memory:';
process.env.SAATHI_NOW = '2026-09-22T11:30:00'; // a Tuesday
process.env.EXEC_DELAY_MS = '0';
process.env.ANTHROPIC_API_KEY = '';
process.env.COGNEE_URL = '';

import test from 'node:test';
import assert from 'node:assert/strict';
const { seed } = await import('../server/seed.js');
const { get, all, run } = await import('../server/db.js');
const { merchant360, invalidate } = await import('../server/analytics.js');
const A = await import('../server/actions.js');
const { handleChat } = await import('../server/chat.js');
const { t } = await import('../server/i18n.js');
const { grounded } = await import('../server/llm.js');

seed();
const M = (id) => get('SELECT * FROM merchants WHERE id=?', id);

test('Merchant-360 finds the Tuesday dip (deck example: ~22%)', () => {
  const f = merchant360('m_sharma');
  assert.equal(f.weakest.dow, 2);
  assert.ok(f.weakest.dipPct >= 15 && f.weakest.dipPct <= 30, `dip ${f.weakest.dipPct}`);
  assert.ok(f.customers.lapsedConsented > 100);
  assert.ok(f.inventory.some((x) => x.risk));
});

test('opportunities are ranked and cover multiple agents', () => {
  const o = A.rankOpportunities('m_sharma');
  const agents = new Set(o.map((x) => x.agent));
  for (const a of ['growth', 'inventory', 'customer', 'compliance']) assert.ok(agents.has(a), a);
  for (let i = 1; i < o.length; i++) assert.ok(o[i - 1].score >= o[i].score);
  const g = o.find((x) => x.agent === 'growth');
  assert.deepEqual(g.trace.map((x) => x.agent), ['growth', 'inventory', 'customer']); // agent negotiation
  assert.ok(g.payload.spendCap <= 500);
});

test('approve -> executes asynchronously through the built-in rail, then can be reverted', async () => {
  const m = M('m_sharma');
  const p = A.listProposals(m, 'en').find((x) => x.type === 'launch_offer');
  assert.ok(p.title.includes('Tuesday'));
  const started = await A.approve(m, p.id, 'tap');
  assert.equal(started.status, 'executing'); // async execution
  await A.settle(p.id);
  const done = A.history(m, 'en').find((x) => x.id === p.id);
  assert.equal(done.status, 'done');
  assert.equal(done.result.via, 'rail:mock');
  const rev = await A.revert(m, p.id);
  assert.equal(rev.status, 'reverted');
  // cooldown: same opportunity is not immediately re-proposed
  assert.ok(!A.listProposals(m, 'en').some((x) => x.type === 'launch_offer'));
});

test('holdout merchants are logged, not executed', async () => {
  const m = M('m_deshmukh');
  const p = A.listProposals(m, 'mr')[0];
  const r = await A.approve(m, p.id, 'tap');
  assert.equal(r.status, 'holdout_logged');
});

test('consent revocation blocks customer messaging; money actions are gated', async () => {
  const m = M('m_sharma');
  run('UPDATE consents SET granted=0 WHERE merchant_id=? AND scope=?', m.id, 'marketing');
  const wb = A.listProposals(m, 'en').find((x) => x.type === 'winback_campaign');
  await assert.rejects(() => A.approve(m, wb.id, 'tap'), (e) => e.code === 'consent_required');
  run('UPDATE consents SET granted=1 WHERE merchant_id=? AND scope=?', m.id, 'marketing');
  const loan = A.listProposals(m, 'en').find((x) => x.type === 'apply_loan');
  assert.ok(loan.moneyMoving);
  run(`UPDATE actions SET payload=? WHERE id=?`, JSON.stringify({ ...loan.payload, amount: 9_999_999 }), loan.id);
  await assert.rejects(() => A.approve(m, loan.id, 'tap'), (e) => e.code === 'above_eligibility');
});

test('a failing rail marks the action failed instead of hanging', async () => {
  const m = M('m_patel');
  const p = A.listProposals(m, 'en').find((x) => x.type === 'launch_offer');
  run('UPDATE actions SET payload=? WHERE id=?', JSON.stringify({ ...p.payload, discount: 90 }), p.id); // rail re-checks guardrails
  await A.approve(m, p.id, 'tap');
  await A.settle(p.id);
  const a = A.history(m, 'en').find((x) => x.id === p.id);
  assert.equal(a.status, 'failed');
  assert.match(a.result.error, /guardrail/);
});

test('voice chat: Hinglish sales query, plan, then "haan" approves', async () => {
  const m = M('m_iyer');
  const r1 = await handleChat(m, 'aaj ki sale kitni hui?', { lang: 'hinglish' });
  assert.match(r1.text, /₹/);
  const r2 = await handleChat(m, 'aaj kya karun', { lang: 'hinglish' });
  assert.ok(r2.actionId);
  const r3 = await handleChat(m, 'haan', { lang: 'hinglish' });
  assert.match(r3.text, /shuru kar diya/);
  await A.settleAll();
  assert.equal(get('SELECT status FROM actions WHERE id=?', r2.actionId).status, 'done');
});

test('Devanagari and Tamil intents work; unknown text falls back to help', async () => {
  const m = M('m_khan');
  assert.match((await handleChat(m, 'आज की बिक्री कितनी हुई', { lang: 'hi' })).text, /आज अब तक/);
  assert.match((await handleChat(m, 'இன்றைய விற்பனை', { lang: 'ta' })).text, /இன்று இதுவரை/);
  assert.match((await handleChat(m, 'blah blah', { lang: 'en' })).text, /Try:/);
});

test('i18n falls back gracefully; grounding guardrail rejects invented numbers', () => {
  assert.match(t('ta', 'stock_ok'), /Stock looks fine/); // ta has no stock_ok -> English
  assert.ok(grounded('Sales were 1200 today', { today: 1200 }));
  assert.ok(!grounded('Sales were 9999 today', { today: 1200 }));
});


