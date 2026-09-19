// Tiered LLM access. Deterministic rules handle routine intents (zero cost); the small model handles
// free-text; the large model only writes plan explanations. Output is never allowed to trigger actions
// and every number in it must appear in the facts we supplied (hallucination guardrail).
import { config } from './config.js';

export const usage = { small: 0, large: 0, rejected: 0 };
export const llmEnabled = () => Boolean(config.llm.apiKey);

export async function complete({ tier = 'small', system, user, maxTokens = 400 }) {
  if (!llmEnabled()) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': config.llm.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: config.llm[tier], max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    usage[tier]++;
    const data = await res.json();
    return data.content?.map((c) => c.text || '').join('').trim() || null;
  } catch {
    return null;
  }
}

const nums = (s) => (String(s).match(/\d[\d,]*(?:\.\d+)?/g) || []).map((x) => x.replace(/,/g, ''));

// Reject the answer if it quotes a number that is not in the facts.
export function grounded(text, facts) {
  const allowed = new Set(nums(JSON.stringify(facts)));
  const ok = nums(text).every((n) => allowed.has(n) || Number(n) < 10);
  if (!ok) usage.rejected++;
  return ok;
}

export async function askGrounded({ tier, lang, question, facts, maxTokens }) {
  const system = `You are Saathi, a business partner for an Indian shop owner. Reply in language code "${lang}" (Hinglish = Hindi in Roman script). Be brief (max 4 sentences), practical, warm. Use ONLY the facts provided; never invent numbers. Never claim to have executed anything.`;
  const text = await complete({ tier, system, user: `Facts: ${JSON.stringify(facts)}\n\nMerchant says: ${question}`, maxTokens });
  return text && grounded(text, facts) ? text : null;
}
