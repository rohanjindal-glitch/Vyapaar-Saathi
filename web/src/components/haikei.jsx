// Haikei-style generative SVG backgrounds (layered waves + soft blobs), generated locally so colours can
// follow the live theme (--wave-a / --wave-b / --sky / --accent). Waves use whole periods across the tile
// width, so the drift animation loops seamlessly.
import { motion } from 'motion/react';

function wavePath(w, h, { amp, periods, phase, base }) {
  const n = 64;
  let d = `M0,${h}`;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * w;
    const a = (i / n) * Math.PI * 2 * periods + phase;
    const y = base + Math.sin(a) * amp + Math.sin(a * 2 + phase) * amp * 0.35;
    d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return `${d} L${w},${h} Z`;
}

const LAYERS = [
  { fill: 'var(--wave-a)', opacity: 0.9, amp: 14, periods: 2, phase: 0.4, base: 46, dur: 34 },
  { fill: 'var(--sky)', opacity: 0.55, amp: 12, periods: 3, phase: 2.1, base: 60, dur: 26 },
  { fill: 'var(--wave-b)', opacity: 0.8, amp: 10, periods: 2, phase: 4.0, base: 74, dur: 40 },
  { fill: 'var(--sky)', opacity: 0.35, amp: 8, periods: 4, phase: 1.2, base: 88, dur: 22 },
];

export function Waves({ className = '', flip = false }) {
  const W = 800, H = 120;
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-x-0 bottom-0 h-28 overflow-hidden ${flip ? 'rotate-180' : ''} ${className}`}>
      {LAYERS.map((l, i) => (
        <motion.svg
          key={i}
          viewBox={`0 0 ${W * 2} ${H}`}
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 h-full w-[200%]"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: l.dur, repeat: Infinity, ease: 'linear' }}
        >
          <path d={wavePath(W * 2, H, { ...l, periods: l.periods * 2 })} fill={l.fill} opacity={l.opacity} />
        </motion.svg>
      ))}
    </div>
  );
}

export function Blobs({ className = '' }) {
  const blob = (color, size, pos, dur, dx, dy) => (
    <motion.div
      className="absolute rounded-full blur-3xl"
      style={{ width: size, height: size, background: color, ...pos, opacity: 0.55 }}
      animate={{ x: [0, dx, 0], y: [0, dy, 0], scale: [1, 1.12, 1] }}
      transition={{ duration: dur, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {blob('var(--sky)', 320, { top: -120, left: -80 }, 18, 40, 30)}
      {blob('var(--accent-soft)', 280, { top: -60, right: -60 }, 22, -30, 40)}
      {blob('var(--primary-soft)', 240, { bottom: -100, left: '38%' }, 26, 30, -30)}
    </div>
  );
}

