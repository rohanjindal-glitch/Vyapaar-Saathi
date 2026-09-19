import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Disclosure, SpotlightCard } from '../components/motion.jsx';
import { inr } from './Overview.jsx';

export const AGENT_HUE = { growth: 38, inventory: 18, customer: 142, money: 100, compliance: 350, voice: 199 };
export const AgentTag = ({ agent, t }) => (
  <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: `hsl(${AGENT_HUE[agent]} 70% 92%)`, color: `hsl(${AGENT_HUE[agent]} 70% 26%)` }}>
    {t('ag_' + agent)}
  </span>
);

const dotColor = { executing: 'var(--warn)', done: 'var(--good)', failed: 'var(--bad)', reverted: 'var(--muted)', holdout_logged: 'var(--primary)', rejected: 'var(--muted)' };

function OppCard({ o, t, onAct, busy }) {
  return (
    <motion.article layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }} transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}>
      <SpotlightCard className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AgentTag agent={o.agent} t={t} />
          {o.moneyMoving && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-warn">{t('needsOk')}</span>}
        </div>
        <h3 className="text-lg font-bold leading-snug wrap-any">{o.title}</h3>
        <p className="text-sm text-muted wrap-any">{o.why}</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-bold text-good tabular" style={{ fontFamily: 'var(--font-display)' }}>~{inr(o.impact)} <small className="font-normal text-muted">{t('perMonth')}</small></span>
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => onAct(o.id, 'approve')} className="min-h-11 rounded-xl bg-primary px-5 font-semibold text-on-primary transition active:scale-95 disabled:opacity-50">{t('approve')}</button>
            <button disabled={busy} onClick={() => onAct(o.id, 'reject')} className="min-h-11 rounded-xl border border-primary px-4 font-semibold text-primary transition active:scale-95 disabled:opacity-50">{t('notNow')}</button>
          </div>
        </div>
        <Disclosure summary={t('agentsAgreed')}>
          <ul className="mt-1 grid gap-1 pb-1 text-sm text-muted">
            {o.trace.map((x, i) => <li key={i}><b className="text-ink">{x.agent}</b> — {x.note}</li>)}
          </ul>
        </Disclosure>
      </SpotlightCard>
    </motion.article>
  );
}

export default function Actions({ d, t, L, act }) {
  const [busy, setBusy] = useState(false);
  const isHold = d.overview.merchant.cohort === 'holdout';
  const onAct = async (id, kind) => { setBusy(true); try { await act(id, kind); } finally { setBusy(false); } };
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] xl:items-start">
      <section className="grid gap-3">
        <div><h2 className="text-2xl font-bold">{t('doToday')}</h2><p className="text-sm text-muted">{t('doTodaySub')}</p></div>
        {isHold && <p className="rounded-xl bg-primary-soft p-3 text-sm">{t('controlNote')}</p>}
        <AnimatePresence mode="popLayout">
          {d.opps.length ? d.opps.map((o) => <OppCard key={o.id} o={o} t={t} onAct={onAct} busy={busy} />) : <p key="none" className="py-6 text-muted">{t('noOpps')}</p>}
        </AnimatePresence>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5 xl:sticky xl:top-24">
        <h2 className="mb-3 text-xl font-bold">{t('activity')}</h2>
        <ul className="grid gap-2">
          <AnimatePresence initial={false}>
            {d.actions.length ? d.actions.map((a) => (
              <motion.li layout key={a.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="grid gap-1 rounded-xl border border-line bg-surface2 p-3 text-sm">
                <span className="font-medium wrap-any">{a.title}</span>
                <span className="flex flex-wrap items-center gap-2 text-muted">
                  <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: dotColor[a.status] }}>
                    <motion.i className="inline-block size-2 rounded-full" style={{ background: dotColor[a.status] }} animate={a.status === 'executing' ? { opacity: [1, 0.25, 1] } : {}} transition={{ repeat: Infinity, duration: 1 }} />
                    {t(a.status)}
                  </span>
                  {a.result?.via && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">{a.result.via}</span>}
                  {a.reversible && <button onClick={() => act(a.id, 'revert')} className="min-h-8 rounded-lg border border-primary px-3 text-xs font-semibold text-primary">{t('revert')}</button>}
                </span>
              </motion.li>
            )) : <li className="text-muted">—</li>}
          </AnimatePresence>
        </ul>
      </section>
    </div>
  );
}
