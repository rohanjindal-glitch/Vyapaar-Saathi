import { motion } from 'motion/react';
import { AnimatedGroup } from '../components/motion.jsx';
import { api } from '../api.js';

function Switch({ on, onChange, label }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={onChange} className="relative h-7 w-12 shrink-0 rounded-full transition-colors" style={{ background: on ? 'var(--good)' : 'var(--line)' }}>
      <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="absolute top-0.5 size-6 rounded-full bg-white shadow" style={{ left: on ? 22 : 2 }} />
    </button>
  );
}
const Pill = ({ ok, children }) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface2 px-3 py-1 text-sm">
    <i className="size-2 rounded-full" style={{ background: ok === true ? 'var(--good)' : ok === false ? 'var(--bad)' : 'var(--muted)' }} />{children}
  </span>
);

export default function Settings({ d, t, L, refresh }) {
  const cons = Object.fromEntries(d.consent.map((c) => [c.scope, c.granted]));
  const s = d.status;
  const toggle = async (scope) => { await api('/api/me/consent', { method: 'POST', body: { scope, granted: !cons[scope] } }); refresh(); };
  return (
    <AnimatedGroup className="grid gap-4 lg:grid-cols-2" itemClassName="min-w-0" stagger={0.08}>
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-xl font-bold">{t('privacy')}</h2>
        {['marketing', 'lending'].map((sc) => (
          <div key={sc} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
            <span className="wrap-any">{t(sc)} <small className="block text-muted">{cons[sc] ? t('consentOn') : t('consentOff')}</small></span>
            <Switch on={!!cons[sc]} onChange={() => toggle(sc)} label={t(sc)} />
          </div>
        ))}
        <p className="mt-2 text-xs text-muted">One tap revokes; Saathi stops the related actions immediately.</p>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-xl font-bold">{t('system')}</h2>
        <div className="flex flex-wrap gap-2">
          <Pill ok>API</Pill>
          <Pill ok>{L('executor')}: {s.executor.mode === 'mock' ? L('mock') : L('mixed')}</Pill>
          <Pill ok={s.cognee.status === 'up' ? true : s.cognee.status === 'down' ? false : null}>Cognee · {s.cognee.status}</Pill>
          <Pill ok={s.llm.enabled ? true : null}>LLM · {s.llm.enabled ? s.llm.tiering : 'rules + templates'}</Pill>
          <Pill ok={s.executor.whatsapp ? true : null}>{L('whatsapp')} · {s.executor.whatsapp ? L('connected') : L('queued')}</Pill>
          <Pill>{s.db.merchants} merchants · {s.db.txns.toLocaleString('en-IN')} txns</Pill>
        </div>
        <h3 className="mb-2 mt-5 font-bold">{L('outbox')}</h3>
        <ul className="grid gap-2 text-sm">
          {d.outbound.length ? d.outbound.slice(0, 3).map((m, i) => <li key={i} className="rounded-lg bg-surface2 p-2.5 wrap-any"><b>{m.channel}</b> · {m.status}<br />{m.text}</li>) : <li className="text-muted">—</li>}
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 lg:col-span-2">
        <h2 className="mb-3 text-xl font-bold">{L('audit')}</h2>
        <ul className="grid gap-1.5 text-sm">
          {d.audit.slice(0, 10).map((a, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-2 rounded-lg bg-surface2 px-3 py-2"><b>{a.event}</b><span className="tabular text-muted">{new Date(a.ts).toLocaleTimeString()}</span></li>
          ))}
        </ul>
      </section>
    </AnimatedGroup>
  );
}
