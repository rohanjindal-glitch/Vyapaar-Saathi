import { createHash } from 'node:crypto';

// Pin "now" with SAATHI_NOW=2026-09-22T11:30:00 to get a repeatable demo.
export const clock = {
  now: () => (process.env.SAATHI_NOW ? new Date(process.env.SAATHI_NOW) : new Date()),
};

const p2 = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const dowOf = (day) => new Date(`${day}T00:00:00`).getDay();

export const fnv = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
export const sha = (s) => createHash('sha256').update(s).digest('hex');
export const roundTo = (n, step) => Math.round(n / step) * step;

export class HttpError extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const LOCALES = { en: 'en-IN', hinglish: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', gu: 'gu-IN', ta: 'ta-IN', bn: 'bn-IN' };
export const dayName = (dow, lang) =>
  new Intl.DateTimeFormat(LOCALES[lang] || 'en-IN', { weekday: 'long' }).format(new Date(2024, 0, 7 + dow));
