let token = null;
let lang = 'en';
export const setAuth = (t) => { token = t; };
export const setApiLang = (l) => { lang = l; };

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: { 'content-type': 'application/json', 'x-lang': lang, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || res.status), { status: res.status, data });
  return data;
}

export async function loadAll() {
  const [overview, opps, actions, consent, impact, status, memory, audit, outbound] = await Promise.all([
    api('/api/me/overview'), api('/api/me/opportunities'), api('/api/me/actions'), api('/api/me/consent'), api('/api/me/impact'),
    api('/api/status'), api('/api/me/memory?q=' + encodeURIComponent('approved OR outcome')), api('/api/me/audit'), api('/api/me/outbound'),
  ]);
  return { overview, opps: opps.opportunities, actions: actions.actions, consent: consent.consents, impact, status, memory, audit: audit.audit, outbound: outbound.outbound };
}
