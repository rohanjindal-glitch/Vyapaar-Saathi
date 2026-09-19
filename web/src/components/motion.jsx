// Motion Primitives-style building blocks (TextEffect, AnimatedNumber, AnimatedGroup, SpotlightCard,
// Disclosure), implemented on the `motion` library. Same idea and prop names as motion-primitives.com,
// written locally so the portal has no copy-paste registry dependency.
import { Children, useEffect, useState } from 'react';
import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'motion/react';

const TEXT_PRESETS = {
  'fade-blur': { hidden: { opacity: 0, filter: 'blur(8px)' }, visible: { opacity: 1, filter: 'blur(0px)' } },
  slide: { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } },
  scale: { hidden: { opacity: 0, scale: 0.85 }, visible: { opacity: 1, scale: 1 } },
};
const ITEM_PRESETS = {
  'blur-slide': { hidden: { opacity: 0, y: 16, filter: 'blur(6px)' }, visible: { opacity: 1, y: 0, filter: 'blur(0px)' } },
  fade: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
  scale: { hidden: { opacity: 0, scale: 0.94 }, visible: { opacity: 1, scale: 1 } },
};

export function TextEffect({ children, per = 'word', preset = 'fade-blur', delay = 0, stagger = 0.05, className = '' }) {
  const text = String(children);
  const parts = per === 'char' ? [...text] : text.split(/(\s+)/);
  return (
    <motion.span
      key={text}
      className={className}
      initial="hidden"
      animate="visible"
      aria-label={text}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
    >
      {parts.map((p, i) =>
        /^\s+$/.test(p) ? p : (
          <motion.span key={i} aria-hidden="true" variants={TEXT_PRESETS[preset]} transition={{ duration: 0.4 }} style={{ display: 'inline-block', whiteSpace: 'pre' }}>
            {p}
          </motion.span>
        ),
      )}
    </motion.span>
  );
}

export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString('en-IN'), className = '' }) {
  const spring = useSpring(0, { stiffness: 70, damping: 18 });
  const text = useTransform(spring, format);
  useEffect(() => { spring.set(value); }, [value, spring]);
  return <motion.span className={`tabular ${className}`}>{text}</motion.span>;
}

export function AnimatedGroup({ children, className = '', itemClassName = '', preset = 'blur-slide', stagger = 0.07, delay = 0 }) {
  return (
    <motion.div className={className} initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: stagger, delayChildren: delay } } }}>
      {Children.toArray(children).map((c, i) => (
        <motion.div key={c.key ?? i} className={itemClassName} variants={ITEM_PRESETS[preset]} transition={{ type: 'spring', bounce: 0.2, duration: 0.7 }}>
          {c}
        </motion.div>
      ))}
    </motion.div>
  );
}

export function SpotlightCard({ children, className = '' }) {
  const x = useMotionValue(-300);
  const y = useMotionValue(-300);
  const bg = useMotionTemplate`radial-gradient(220px circle at ${x}px ${y}px, color-mix(in srgb, var(--sky) 38%, transparent), transparent 70%)`;
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); x.set(e.clientX - r.left); y.set(e.clientY - r.top); }}
      onMouseLeave={() => { x.set(-300); y.set(-300); }}
    >
      <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: bg }} />
      <div className="relative">{children}</div>
    </div>
  );
}

export function Disclosure({ summary, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-8 items-center gap-1.5 text-sm text-muted">
        <motion.span animate={{ rotate: open ? 90 : 0 }} aria-hidden>▸</motion.span>
        {summary}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
