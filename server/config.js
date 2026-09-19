import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

const env = process.env;

export const config = {
  port: Number(env.PORT) || 3000,
  dbPath: env.DB_PATH || (env.VERCEL ? '/tmp/saathi.db' : 'data/saathi.db'),
  // serverless freezes after the response, so finish the rail call before replying there
  execInline: env.EXEC_INLINE === 'true' || Boolean(env.VERCEL),
  sessionSecret: env.SESSION_SECRET || 'dev-secret-change-me',
  // simulated rail latency so the UI can show the "executing" state (0 in tests)
  execDelayMs: process.env.EXEC_DELAY_MS !== undefined ? Number(process.env.EXEC_DELAY_MS) : 900,
  // WhatsApp Cloud API (optional): inbound webhook + outbound sends
  whatsapp: { token: env.WHATSAPP_TOKEN || '', phoneId: env.WHATSAPP_PHONE_ID || '', verifyToken: env.WHATSAPP_VERIFY_TOKEN || 'saathi-verify' },
  briefHour: env.BRIEF_HOUR !== undefined ? Number(env.BRIEF_HOUR) : 8,

  // Cognee = Merchant Brain memory / knowledge graph (optional sidecar)
  cognee: {
    url: env.COGNEE_URL || '',
    token: env.COGNEE_TOKEN || '',
  },

  // LLM tiering: rules first, small model for free text, large model for planning/explanations
  llm: {
    apiKey: env.ANTHROPIC_API_KEY || '',
    small: env.LLM_MODEL_SMALL || 'claude-haiku-4-5-20251001',
    large: env.LLM_MODEL_LARGE || 'claude-sonnet-5',
  },

  guardrails: {
    maxOfferSpend: Number(env.MAX_OFFER_SPEND) || 500,
    maxWinbackRecipients: Number(env.MAX_WINBACK_RECIPIENTS) || 500,
  },

  rateLimitPerMin: Number(env.RATE_LIMIT_PER_MIN) || 240,
};


