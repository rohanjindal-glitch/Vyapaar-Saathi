import { motion } from 'motion/react';
import { AnimatedGroup, AnimatedNumber } from '../components/motion.jsx';
import { inr } from './Overview.jsx';

const Card = ({ title, sub, children }) => (
  <section className="min-w-0 rounded-2xl border border-line bg-surface p-5">
    <h3 className="text-lg font-bold">{title}</h3>{sub && <p className="mb-3 text-xs text-muted">{sub}</p>}{children}
  </section>
);
const Meter = ({ pct, color = 'var(--primary)' }) => (
  <div className="h-2.5 overflow-hidden rounded-full bg-surface2"><motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(2, pct))}%` }} transition={{ type: 'spring', stiffness: 70, damping: 16 }} /></div>
);
const Row = ({ k, v }) => <div className="flex justify-between gap-3 py-1.5 text-sm"><span className="text-muted wrap-any">{k}</span><b className="tabular text-right">{v}</b></div>;

export default function Insights({ d, t, L }) {
  const o = d.overview;
  const c = o.customers;
  const segMax = Math.max(c.loyal, c.lapsed, c.fresh, 1);
  const { impact } = d;
  return (
    <AnimatedGroup className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" itemClassName="min-w-0" stagger={0.08}>
      <Card title={L('stockTitle')} sub={L('stockSub')}>
        <ul className="grid gap-3">
          {o.inventory.map((x) => (
            <li key={x.sku}>
              <div className="mb-1 flex justify-between gap-2 text-sm"><span className="wrap-any">{x.name}</span><b className="tabular" style={{ color: x.risk ? 'var(--bad)' : 'var(--good)' }}>{x.cover > 60 ? '60+' : x.cover.toFixed(1)}d</b></div>
              <Meter pct={(Math.min(x.cover, 20) / 20) * 100} color={x.risk ? 'var(--bad)' : 'var(--primary)'} />
            </li>
          ))}
        </ul>
      </Card>

      <Card title={L('custTitle')} sub={`${c.total} total`}>
        <div className="grid gap-3">
          {[['loyal', c.loyal, 'var(--primary)'], ['lapsed', c.lapsed, 'var(--warn)'], ['fresh', c.fresh, 'var(--accent)']].map(([k, v, col]) => (
            <div key={k}><div className="mb-1 flex justify-between text-sm"><span>{L(k)}</span><b className="tabular"><AnimatedNumber value={v} /></b></div><Meter pct={(v / segMax) * 100} color={col} /></div>
          ))}
        </div>
        <div className="mt-4 border-t border-line pt-3">
          <Row k={L('footfall')} v={o.signals.footfall.toFixed(2)} />
          <Row k={L('competitors')} v={o.signals.competitors} />
          <Row k={L('shoppers')} v={o.signals.consumers.toLocaleString('en-IN')} />
          {o.festival && <Row k={L('festival')} v={`${o.festival.name} · ${o.festival.days}d`} />}
        </div>
      </Card>

      <Card title={L('cashTitle')}>
        <Row k={L('monthSales')} v={inr(o.cash.monthGmv)} />
        <Row k={L('surplus')} v={inr(o.cash.netMonthly)} />
        <Row k={L('pendingSettle')} v={inr(o.cash.pendingSettle)} />
        <Row k={L('gstPayable')} v={inr(o.compliance.gstPayable)} />
        <Row k={L('unbilled')} v={o.compliance.pendingInvoices} />
        <Row k={L('recon')} v={`${o.compliance.reconDays} · ${inr(o.compliance.reconShort)}`} />
        <p className="mt-2 text-xs text-muted">{t('moneyNote')}</p>
      </Card>

      <Card title={t('impact')} sub={`${t('growthLbl')} · ${t('synthetic')}`}>
        {[['treatment', impact.treatment, 'var(--primary)'], ['holdout', impact.holdout, 'var(--accent)']].map(([k, v, col]) => (
          <div key={k} className="mb-3"><div className="mb-1 flex justify-between text-sm"><span>{t(k)}</span><b className="tabular">{v.toFixed(1)}%</b></div><Meter pct={50 + v * 2} color={col} /></div>
        ))}
        <Row k={t('lift')} v={`${impact.liftPts >= 0 ? '+' : ''}${impact.liftPts.toFixed(1)} pts`} />
        <p className="text-xs text-muted">{impact.note}</p>
      </Card>

      <Card title={t('memory')} sub={`${t('memSrc')}: ${d.memory.source}`}>
        <ul className="grid gap-2 text-sm">
          {d.memory.items.length ? d.memory.items.slice(0, 5).map((m, i) => <li key={i} className="rounded-lg bg-surface2 p-2.5 wrap-any">{m.text}</li>) : <li className="text-muted">{t('noMem')}</li>}
        </ul>
      </Card>
    </AnimatedGroup>
  );
}
