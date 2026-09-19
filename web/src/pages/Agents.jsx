import { AnimatedGroup, SpotlightCard } from '../components/motion.jsx';
import { motion } from 'motion/react';
import { AGENT_HUE } from './Actions.jsx';

const GLYPH = { growth: 'G', inventory: 'I', customer: 'C', money: '₹', compliance: '✓', voice: 'V' };
const METRIC = { growth: 'dip', inventory: 'itemsLow', customer: 'pool', money: 'loanLimit', compliance: 'invoices', voice: 'listeningLbl' };

export default function Agents({ d, t }) {
  return (
    <div className="grid gap-4">
      <div><h2 className="text-2xl font-bold">{t('agents')}</h2><p className="text-sm text-muted">Growth → Inventory → Customer → Money → Compliance · Voice</p></div>
      <AnimatedGroup className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" itemClassName="min-w-0" stagger={0.07}>
        {d.overview.agents.map((a) => (
          <SpotlightCard key={a.id} className="h-full rounded-2xl border border-line bg-surface p-5">
            <motion.div whileHover={{ rotate: -6, scale: 1.08 }} className="grid size-11 place-items-center rounded-xl text-lg font-bold" style={{ background: `hsl(${AGENT_HUE[a.id]} 70% 92%)`, color: `hsl(${AGENT_HUE[a.id]} 70% 26%)`, fontFamily: 'var(--font-display)' }}>{GLYPH[a.id]}</motion.div>
            <h3 className="mt-3 text-lg font-bold">{t('ag_' + a.id)}</h3>
            <p className="text-3xl font-bold tabular" style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)' }}>{a.metric}</p>
            <p className="text-xs text-muted">{t(METRIC[a.id])}</p>
            <p className="mt-2 text-sm text-muted">{t('agd_' + a.id)}</p>
          </SpotlightCard>
        ))}
      </AnimatedGroup>
    </div>
  );
}
