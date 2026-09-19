import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { api, loadAll, setApiLang, setAuth } from './api.js';
import { applyTheme, defaultLook, shuffleLook } from './theme.js';
import { LANG_LABELS, ui } from './ui.js';
import { label } from './labels.js';
import Overview from './pages/Overview.jsx';
import Actions from './pages/Actions.jsx';
import Saathi from './pages/Saathi.jsx';
import Agents from './pages/Agents.jsx';
import Insights from './pages/Insights.jsx';
import Settings from './pages/Settings.jsx';

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const NAV = [['overview', '◎', 'navOverview'], ['actions', '⚡', 'navActions'], ['saathi', '💬', 'navSaathi'], ['agents', '✦', 'navAgents'], ['insights', '▦', 'navInsights'], ['settings', '⚙', 'navSettings']];
const PAGES = { overview: Overview, actions: Actions, saathi: Saathi, agents: Agents, insights: Insights, settings: Settings };

export default function App() {
  const [merchants, setMerchants] = useState([]);
  const [langs, setLangs] = useState([]);
  const [mid, setMid] = useState(null);
  const [lang, setLang] = useState('en');
  const [look, setLook] = useState(null);
  const [modePref, setModePref] = useState(store.get('mode') || 'auto');
  const [page, setPage] = useState(store.get('page') || 'overview');
  const [d, setD] = useState(null);
  const [chat, setChat] = useState([]);
  const [err, setErr] = useState('');

  const t = useCallback((k) => ui(lang, k), [lang]);
  const L = useCallback((k) => label(lang, k), [lang]);

  const refresh = useCallback(async () => { setD(await loadAll()); }, []);

  // boot
  useEffect(() => {
    api('/api/merchants').then(({ merchants, languages }) => {
      setMerchants(merchants); setLangs(languages);
      const saved = store.get('mid');
      setMid(merchants.some((m) => m.id === saved) ? saved : merchants[0].id);
    }).catch((e) => setErr(e.message));
  }, []);

  // switch merchant -> session, look, language
  useEffect(() => {
    if (!mid) return;
    const m = merchants.find((x) => x.id === mid);
    store.set('mid', mid);
    let saved = null;
    try { saved = JSON.parse(store.get(`look:${mid}`)); } catch { /* ignore */ }
    setLook(saved || defaultLook(m));
    const l = store.get('lang');
    const nl = l && LANG_LABELS[l] ? l : m.lang;
    setLang(nl); setApiLang(nl); setChat([]); setD(null);
    api('/api/session', { method: 'POST', body: { merchantId: mid } }).then(({ token }) => { setAuth(token); return refresh(); }).catch((e) => setErr(e.message));
  }, [mid, merchants, refresh]);

  // theme
  useEffect(() => { if (look) applyTheme(look, lang, modePref); }, [look, lang, modePref]);

  // keep polling while an action is executing
  const executing = d?.actions.some((a) => a.status === 'executing');
  useEffect(() => {
    if (!executing) return;
    const id = setTimeout(() => refresh().catch(() => {}), 900);
    return () => clearTimeout(id);
  }, [executing, d, refresh]);

  const act = useCallback(async (id, kind) => {
    try { await api(`/api/me/actions/${id}/${kind}`, { method: 'POST', body: { method: 'tap' } }); setErr(''); }
    catch (e) { setErr(e.data?.error === 'consent_required' ? `${ui(lang, 'privacy')}: ${ui(lang, e.data.scope)}` : `Blocked: ${e.message}`); }
    await refresh();
  }, [lang, refresh]);

  const go = (p) => { setPage(p); store.set('page', p); window.scrollTo({ top: 0 }); };
  const changeLang = (l) => { setLang(l); setApiLang(l); store.set('lang', l); refresh(); };
  const shuffle = () => { const n = shuffleLook(look); setLook(n); store.set(`look:${mid}`, JSON.stringify(n)); };
  const setMode = (m) => { setModePref(m); store.set('mode', m); };

  const Page = PAGES[page];
  const m = useMemo(() => merchants.find((x) => x.id === mid), [merchants, mid]);
  const sel = 'min-h-10 rounded-xl border border-line bg-surface px-3 text-sm';

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      {/* sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-line bg-surface p-4 lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary font-bold text-on-primary" style={{ fontFamily: 'var(--font-display)' }}>VS</span>
          <div><b className="block leading-tight" style={{ fontFamily: 'var(--font-display)' }}>Vyapaar Saathi</b><small className="text-muted">Merchant portal</small></div>
        </div>
        <nav className="grid gap-1" aria-label="Portal">
          {NAV.map(([id, icon, key]) => (
            <button key={id} onClick={() => go(id)} aria-current={page === id ? 'page' : undefined} className="relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-left font-medium">
              {page === id && <motion.span layoutId="navpill" className="absolute inset-0 rounded-xl bg-primary-soft" transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }} />}
              <span className="relative w-5 text-center">{icon}</span><span className={`relative ${page === id ? 'text-primary' : ''}`}>{L(key)}</span>
            </button>
          ))}
        </nav>
        <p className="mt-auto text-xs text-muted">{m?.name}<br />{m?.city}</p>
      </aside>

      <div className="min-w-0 pb-20 lg:pb-0">
        <header className="sticky top-0 z-20 flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-line bg-surface/85 px-4 py-3 backdrop-blur lg:px-8">
          <div className="mr-auto flex items-center gap-3 lg:hidden"><span className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-bold text-on-primary">VS</span><b style={{ fontFamily: 'var(--font-display)' }}>Vyapaar Saathi</b></div>
          <label className="grid text-[11px] text-muted">{t('pick')}
            <select value={mid || ''} onChange={(e) => setMid(e.target.value)} className={sel}>{merchants.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.city}{x.cohort === 'holdout' ? ' ◦' : ''}</option>)}</select></label>
          <label className="grid text-[11px] text-muted">{t('language')}
            <select value={lang} onChange={(e) => changeLang(e.target.value)} className={sel}>{langs.map((l) => <option key={l} value={l}>{LANG_LABELS[l] || l}</option>)}</select></label>
          <div className="inline-flex overflow-hidden rounded-xl border border-line" role="group" aria-label="Theme mode">
            {['auto', 'light', 'dark'].map((k) => <button key={k} aria-pressed={modePref === k} onClick={() => setMode(k)} className={`min-h-10 px-3 text-sm ${modePref === k ? 'bg-primary text-on-primary' : 'bg-surface'}`}>{t(k)}</button>)}
          </div>
          <motion.button whileTap={{ scale: 0.94, rotate: -3 }} onClick={shuffle} className="min-h-10 rounded-xl border border-dashed border-accent px-3 text-sm font-medium text-accent" title="Shuffle accent colour + fonts">{t('shuffle')} ◐</motion.button>
        </header>

        <main className="mx-auto max-w-6xl p-4 lg:p-8">
          {err && <p role="alert" className="mb-4 rounded-xl bg-accent-soft p-3 text-sm text-bad">{err}</p>}
          {!d ? (
            <div className="grid gap-4" aria-busy="true">{[0, 1, 2].map((i) => <motion.div key={i} className="h-40 rounded-3xl bg-surface2" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.15 }} />)}</div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={page + mid} initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                <Page d={d} t={t} L={L} lang={lang} go={go} act={act} refresh={refresh} chat={chat} setChat={setChat} afterAction={refresh} />
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>

      {/* bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-line bg-surface/95 backdrop-blur lg:hidden" aria-label="Portal">
        {NAV.map(([id, icon, key]) => (
          <button key={id} onClick={() => go(id)} aria-current={page === id ? 'page' : undefined} className="relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[9px]">
            {page === id && <motion.span layoutId="botpill" className="absolute inset-x-1.5 inset-y-1 rounded-xl bg-primary-soft" transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }} />}
            <span className="relative text-base">{icon}</span><span className={`relative max-w-full px-0.5 ${page === id ? 'font-semibold text-primary' : 'text-muted'}`}>{L(key)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

