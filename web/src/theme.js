// Portal theme: sky blue + white as the constant brand, a DYNAMIC accent (per shop, shufflable) and
// script-aware fonts. Accent hues avoid violet/indigo (255-335°) and saturation is capped, so no neon.
const CATEGORY_HUE = { kirana: 32, sweets: 14, restaurant: 4, pharmacy: 142, apparel: 348 };

export const PAIRS = [
  { display: 'Bricolage Grotesque', body: 'Figtree', kind: 'sans-serif' },
  { display: 'Fraunces', body: 'Figtree', kind: 'serif' },
  { display: 'Outfit', body: 'Nunito Sans', kind: 'sans-serif' },
  { display: 'Young Serif', body: 'Nunito Sans', kind: 'serif' },
  { display: 'DM Serif Display', body: 'Karla', kind: 'serif' },
];
const CATEGORY_PAIR = { kirana: 0, sweets: 1, restaurant: 3, apparel: 4, pharmacy: 2 };
const SCRIPT_FONT = { hi: 'Mukta', mr: 'Mukta', gu: 'Noto Sans Gujarati', ta: 'Noto Sans Tamil', bn: 'Noto Sans Bengali' };
const SCRIPT_FALLBACKS = "'Mukta','Noto Sans Devanagari','Noto Sans Gujarati','Noto Sans Tamil','Noto Sans Bengali'";

// any number -> allowed arcs: 0-165 (red, orange, yellow, green) and 340-360 (rose)
export const safeHue = (h) => {
  const x = ((((h % 360) + 360) % 360) / 360) * 185;
  return Math.round(x <= 165 ? x : 340 + (x - 165));
};
const hash = (s) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);

export function defaultLook(m) {
  return { hue: safeHue((CATEGORY_HUE[m.category] ?? 30) + ((hash(m.name) % 25) - 12)), pair: CATEGORY_PAIR[m.category] ?? 0 };
}
export const shuffleLook = (look) => ({ hue: safeHue(look.hue + 37 + Math.floor(Math.random() * 90)), pair: (look.pair + 1) % PAIRS.length });

const loaded = new Set();
function loadFont(family) {
  if (loaded.has(family)) return;
  loaded.add(family);
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;600;700&display=swap`;
  document.head.appendChild(l);
}

export const resolveMode = (pref) => (pref === 'light' || pref === 'dark' ? pref : new Date().getHours() >= 19 || new Date().getHours() < 6 ? 'dark' : 'light');

export function applyTheme({ hue, pair }, lang, modePref = 'auto') {
  const mode = resolveMode(modePref);
  const dark = mode === 'dark';
  const acc = hue;
  const sky = 199;
  const T = dark
    ? {
        '--bg': 'hsl(212 38% 8%)', '--surface': 'hsl(212 32% 12%)', '--surface2': 'hsl(210 28% 16%)', '--ink': 'hsl(205 40% 94%)', '--muted': 'hsl(208 16% 66%)',
        '--line': 'hsl(210 24% 22%)', '--primary': `hsl(${sky} 85% 58%)`, '--on-primary': 'hsl(212 60% 8%)', '--primary-soft': `hsl(${sky} 45% 20%)`, '--sky': `hsl(${sky} 70% 42%)`,
        '--accent': `hsl(${acc} 62% 62%)`, '--accent-soft': `hsl(${acc} 35% 20%)`, '--good': 'hsl(150 45% 58%)', '--warn': 'hsl(38 80% 62%)', '--bad': 'hsl(6 70% 68%)', '--wave-a': `hsl(${sky} 60% 22%)`, '--wave-b': `hsl(${acc} 40% 24%)`,
      }
    : {
        '--bg': 'hsl(200 70% 98%)', '--surface': '#ffffff', '--surface2': 'hsl(200 55% 95%)', '--ink': 'hsl(212 45% 14%)', '--muted': 'hsl(210 16% 40%)',
        '--line': 'hsl(200 35% 88%)', '--primary': `hsl(${sky} 92% 36%)`, '--on-primary': '#ffffff', '--primary-soft': `hsl(${sky} 90% 94%)`, '--sky': `hsl(${sky} 88% 72%)`,
        '--accent': `hsl(${acc} 68% 42%)`, '--accent-soft': `hsl(${acc} 80% 93%)`, '--good': 'hsl(150 55% 28%)', '--warn': 'hsl(32 85% 34%)', '--bad': 'hsl(6 65% 42%)', '--wave-a': `hsl(${sky} 85% 86%)`, '--wave-b': `hsl(${acc} 85% 88%)`,
      };
  const root = document.documentElement;
  for (const [k, v] of Object.entries(T)) root.style.setProperty(k, v);
  root.dataset.mode = mode;
  root.style.colorScheme = mode;

  const P = PAIRS[pair];
  const script = SCRIPT_FONT[lang];
  for (const f of [P.display, P.body, script].filter(Boolean)) loadFont(f);
  root.style.setProperty('--font-display', `'${P.display}',${script ? `'${script}',` : ''}${SCRIPT_FALLBACKS},${P.kind === 'serif' ? 'Georgia,serif' : 'system-ui,sans-serif'}`);
  root.style.setProperty('--font-body', `'${P.body}',${script ? `'${script}',` : ''}${SCRIPT_FALLBACKS},system-ui,sans-serif`);
  root.lang = { hinglish: 'en-IN', en: 'en-IN' }[lang] || `${lang}-IN`;
  return { mode, hue, fonts: `${P.display} + ${P.body}${script ? ' + ' + script : ''}` };
}
