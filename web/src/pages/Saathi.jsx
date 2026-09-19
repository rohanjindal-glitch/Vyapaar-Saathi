import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '../api.js';
import { SPEECH } from '../ui.js';
import { TextEffect } from '../components/motion.jsx';

export default function Saathi({ t, lang, chat, setChat, afterAction }) {
  const [text, setText] = useState('');
  const [speak, setSpeak] = useState(true);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const rec = useRef(null);
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [chat, busy]);

  const say = (s) => {
    if (!speak || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(s.replace(/[₹▲▼]/g, ' '));
    u.lang = SPEECH[lang] || 'en-IN';
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  };

  const send = async (msg) => {
    const m = msg.trim();
    if (!m || busy) return;
    setText(''); setBusy(true);
    setChat((c) => [...c, { me: true, text: m }]);
    try {
      const r = await api('/api/me/chat', { method: 'POST', body: { text: m } });
      setChat((c) => [...c, { me: false, text: r.text }]);
      say(r.text);
      afterAction();
    } catch (e) {
      setChat((c) => [...c, { me: false, text: `⚠ ${e.message}` }]);
    } finally { setBusy(false); }
  };

  const mic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return setChat((c) => [...c, { me: false, text: t('micNo') }]);
    if (rec.current) return rec.current.stop();
    const r = new SR();
    r.lang = SPEECH[lang] || 'en-IN';
    r.onstart = () => setListening(true);
    r.onend = () => { setListening(false); rec.current = null; };
    r.onresult = (e) => send(e.results[0][0].transcript);
    rec.current = r; r.start();
  };

  return (
    <section className="mx-auto grid max-w-3xl gap-3 rounded-3xl border border-line bg-surface p-4 sm:p-6">
      <div><h2 className="text-2xl font-bold">{t('askSaathi')}</h2></div>
      <div className="flex flex-wrap gap-2">
        {t('chips').map((c) => (
          <motion.button key={c} whileTap={{ scale: 0.94 }} whileHover={{ y: -2 }} onClick={() => send(c)} className="min-h-9 rounded-full border border-line bg-surface2 px-3.5 text-sm">{c}</motion.button>
        ))}
      </div>
      <div className="flex h-[52vh] min-h-64 flex-col gap-2 overflow-y-auto rounded-2xl bg-surface2 p-3" aria-live="polite">
        {!chat.length && <p className="m-auto text-muted"><TextEffect per="word">{t('chips')[5] + ' …'}</TextEffect></p>}
        <AnimatePresence initial={false}>
          {chat.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', bounce: 0.25, duration: 0.5 }}
              className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 wrap-any ${m.me ? 'self-end rounded-br-md bg-primary text-on-primary' : 'self-start rounded-bl-md bg-surface'}`}>
              {m.text}
            </motion.div>
          ))}
          {busy && <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="self-start rounded-2xl bg-surface px-4 py-3">
            {[0, 1, 2].map((i) => <motion.i key={i} className="mx-0.5 inline-block size-2 rounded-full bg-primary" animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.12 }} />)}
          </motion.div>}
        </AnimatePresence>
        <div ref={end} />
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={listening ? t('listening') : t('placeholder')} aria-label={t('askSaathi')} autoComplete="off"
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4" />
        <motion.button type="button" onClick={mic} aria-label="Voice input" whileTap={{ scale: 0.9 }} animate={listening ? { scale: [1, 1.1, 1] } : {}} transition={{ repeat: Infinity, duration: 1 }}
          className={`size-12 rounded-xl border border-primary text-lg ${listening ? 'bg-bad text-white' : 'bg-surface text-primary'}`}>🎤</motion.button>
        <button className="min-h-12 rounded-xl bg-primary px-5 font-semibold text-on-primary" type="submit">{t('send')}</button>
      </form>
      <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={speak} onChange={(e) => setSpeak(e.target.checked)} /> {t('speak')}</label>
    </section>
  );
}
