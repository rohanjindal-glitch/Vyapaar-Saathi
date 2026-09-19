import { motion } from 'motion/react';
import { AnimatedGroup, AnimatedNumber, SpotlightCard, TextEffect } from '../components/motion.jsx';
import { Blobs, Waves } from '../components/haikei.jsx';

export const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

function Bars({ series, weakDow, t }) {
  const max = Math.max(...series.map((d) => d.amount), 1);
  const dn = new Intl.DateTimeFormat(document.documentElement.lang, { weekday: 'narrow' });
  return (
    <div className="flex h-44 items-end gap-[3px]" role="img" aria-label={t('last30')}>
      {series.map((d, i) => {
        const last = i === series.length - 1;
        const dip = d.dow === weakDow;
        return (
          <div key={d.day} className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-1" title={`${d.day} · ${inr(d.amount)}`}>
            <motion.div
              className="w-full rounded-t-md"
              style={{ background: last ? 'var(--accent)' : dip ? 'var(--warn)' : 'var(--primary)', opacity: last || dip ? 1 : 0.55 }}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(3, (d.amount / max) * 100)}%` }}
              transition={{ type: 'spring', stiffness: 90, damping: 16, delay: i * 0.018 }}
              whileHover={{ opacity: 1 }}
            />
            <span className="text-center text-[9px] leading-none text-muted">{dn.format(new Date(d.day + 'T00:00:00'))}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Overview({ d, t, L, go }) {
  const o = d.overview;
  const s = o.sales;
  const top = d.opps[0];
  const kpis = [
    [L('avgTicket'), inr(o.avgTicket), 'var(--primary)'],
    [L('winPool'), o.customers.lapsedConsented, 'var(--accent)'],
    [L('stockRisk'), o.agents.find((a) => a.id === 'inventory').metric, 'var(--warn)'],
    [L('loanLim'), o.cash.eligible ? inr(o.cash.limit) : '—', 'var(--good)'],
    [`${L('gstDue')} ${o.compliance.daysToDue} ${L('days')}`, o.compliance.pendingInvoices, 'var(--bad)'],
  ];
  return (
    <div className="grid gap-4">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-surface p-5 pb-32 sm:p-7 sm:pb-36">
        <Blobs />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div>
            <p className="text-muted"><TextEffect per="word" preset="slide">{`${t('hello')}, ${o.merchant.owner.split(' ')[0]} 🙏`}</TextEffect></p>
            <p className="text-sm text-muted">{t('todaySoFar')}</p>
            <h1 className="my-1 text-5xl font-bold leading-none sm:text-6xl"><AnimatedNumber value={s.today} format={inr} /></h1>
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${s.deltaPct >= 0 ? 'bg-primary-soft text-good' : 'bg-accent-soft text-bad'}`}>
              {s.deltaPct >= 0 ? '▲' : '▼'} {Math.abs(s.deltaPct)}% {t('usually')}
            </span>
            <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2">
              <div><p className="text-xs text-muted">{t('yesterday')}</p><p className="font-semibold tabular">{inr(s.yesterday)}</p></div>
              <div><p className="text-xs text-muted">{t('last7')}</p><p className="font-semibold tabular">{inr(s.week)} <span className={s.weekDeltaPct >= 0 ? 'text-good' : 'text-bad'}>{s.weekDeltaPct >= 0 ? '▲' : '▼'}{Math.abs(s.weekDeltaPct)}%</span></p></div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs text-muted">{t('last30')} · {t('last30sub')}</p>
            <Bars series={s.series} weakDow={o.weakest.idx < 0.9 ? o.weakest.dow : -1} t={t} />
          </div>
        </div>
        <Waves />
      </section>

      <AnimatedGroup className="grid grid-cols-2 gap-3 md:grid-cols-5" itemClassName="min-w-0" stagger={0.06}>
        {kpis.map(([name, val, color]) => (
          <SpotlightCard key={name} className="h-full rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs text-muted wrap-any">{name}</p>
            <p className="mt-1 text-2xl font-bold tabular" style={{ color, fontFamily: 'var(--font-display)' }}>{val}</p>
          </SpotlightCard>
        ))}
      </AnimatedGroup>

      {top && (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">{L('topAction')}</p>
          <h2 className="text-xl font-bold wrap-any">{top.title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted wrap-any">{top.why}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="font-bold text-good tabular" style={{ fontFamily: 'var(--font-display)' }}>~{inr(top.impact)} <small className="font-normal text-muted">{t('perMonth')}</small></span>
            <button onClick={() => go('actions')} className="min-h-11 rounded-xl bg-primary px-5 font-semibold text-on-primary">{L('seeAll')} →</button>
          </div>
        </motion.section>
      )}
    </div>
  );
}
