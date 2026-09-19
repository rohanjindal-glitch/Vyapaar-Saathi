# Vyapaar Saathi â€” merchant portal MVP

Agentic AI business partner for Paytm merchants (Team Yantrika deck): **understand â†’ advise â†’ execute**, in the merchant's language, with a human approving every action. One central portal, one Node service, no external workflow engine.

```
 DATA IN            MERCHANT BRAIN          AI CORE                 ACTION LAYER (built in)      PORTAL / CHANNELS
 txns, items,  â”€â”€â–º  Merchant-360 features â”€â–º 5 agents + orchestrator â”€â–º executor + rail adapters â”€â–º React portal (sky + white)
 settlements,       Cognee memory graph      opportunity ranker          guardrails, undo, audit    voice Â· WhatsApp webhook
 locality/festival  consent ledger           tiered LLM (Haiku)          async, failure-safe        8 AM daily brief
```

## Run

```bash
npm install
npm run build      # builds the React portal (web/) into dist/
npm start          # http://localhost:3000  â€” portal + API, auto-seeds 6 synthetic merchants
npm test           # 9 tests: agents, guardrails, consent, holdout, async executor + failure, voice intents
npm run e2e        # (API running) approves every action type and prints how each executed
npm run web        # optional: Vite dev server on :5173 with hot reload, proxying /api to :3000
```
Everything is optional beyond that: without Cognee memory is local; without `ANTHROPIC_API_KEY` replies come from rules + templates. `SAATHI_NOW=2026-09-22T11:30:00` pins the demo clock to a busy mid-morning.

## The portal (`web/`)

Sections: **Overview** (today vs usual, 30-day bars with the weak weekday highlighted, KPIs, top action) Â· **Actions** (ranked proposals, how the agents agreed, approve/undo, live activity) Â· **Saathi** (chat + voice) Â· **Agents** Â· **Insights** (stock cover, customers, cash & GST, holdout impact, memory) Â· **Privacy & system** (consent switches, executor/Cognee/LLM/WhatsApp status, outbox, audit trail).

- **Look:** sky blue + white base with a *dynamic* accent (from the shop's category + name, shufflable), auto/light/dark by time of day, fonts that follow shop personality and the language's script. Accent hues avoid violet/indigo and saturation is capped (no neon). Logic: `web/src/theme.js`.
- **Motion:** Motion Primitives-style components (`TextEffect`, `AnimatedNumber`, `AnimatedGroup`, `SpotlightCard`, `Disclosure`, sliding nav pill) in `web/src/components/motion.jsx`, built on the `motion` library â€” same ideas and prop names as motion-primitives.com, written locally rather than pulled from their copy-paste registry.
- **Haikei-style backgrounds:** layered drifting waves + soft blobs generated as SVG in `web/src/components/haikei.jsx`, coloured by the live theme (Haikei is a web tool; this is a local generator in its style).

## Built-in action layer (replaces n8n)

`server/executor.js`: each action type maps to a rail adapter. Approve returns `executing` immediately; the rail runs asynchronously, re-checks guardrails (spend cap, discount, audience, loan â‰¤ eligibility), then the action becomes `done` or `failed` (never hangs). Rails are mocks by default (`via: rail:mock`). To go live, set e.g. `RAIL_LAUNCH_OFFER_URL` â€” the payload is POSTed as JSON and the JSON reply becomes the result (`via: rail:http`). See `.env.example`.

Channels (`server/channels.js`): `GET/POST /api/channels/whatsapp` is a WhatsApp Cloud API webhook that routes messages to Saathi chat; replies and the 8 AM per-merchant brief go out via the Cloud API when `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_ID` are set, else they queue in the outbox (shown under Privacy & system).

## Deck â†’ code map

| Deck slide | Here |
|---|---|
| Merchant Brain | `server/analytics.js` Merchant-360; Cognee mirror in `server/memory.js` (set `COGNEE_URL`) |
| Six agents, one orchestrator | `server/agents.js` + `server/chat.js` (Voice Saathi) + `server/actions.js` (ranker). Growth negotiates with Inventory and Customer; the trace is shown on each card |
| Advise, ranked by â‚¹ impact | impact Ã— confidence Ã— per-merchant agent weight learned from approvals |
| Execute, one tap / "haan" | approve button or voice â†’ `actions.approve()` â†’ executor |
| Voice, 11 languages | Web Speech API; en, hi, Hinglish complete; mr, gu, ta, bn core flow (7 of 11); others fall back |
| Guardrails / human-in-loop | consent gates, caps, loan limit, money actions flagged, undo, audit, LLM numbers must appear in supplied facts |
| Closed loop / holdout | `m_deshmukh`, `m_khan` are control merchants (approvals recorded, nothing executes); `/api/me/impact` compares cohorts |

## LLM tiering (Haiku)

Rules handle routine intents at zero cost. With `ANTHROPIC_API_KEY`, **Claude Haiku 4.5** answers free-text questions and **Sonnet** writes the "what should I do today" narrative; every number in a reply must appear in the facts supplied, otherwise it's discarded for the template.

## Scaling path

| Concern | MVP | Production |
|---|---|---|
| API | stateless Express, HMAC session token | N replicas behind a gateway; Paytm OAuth / device auth |
| Data | all SQL scoped by `merchant_id`; `server/db.js` is the only driver seam | Postgres partitioned by merchant; Kafka â†’ lakehouse â†’ feature store feeding `analytics.js` |
| Cache | 20 s in-process TTL | Redis behind `merchant360(id)` |
| Actions | in-process async promises | queue (BullMQ/SQS) + worker pool; same `execute()` contract |
| Scheduler | one `setInterval` (single instance) | single cron/job runner |
| Rate limit | in-memory | gateway / Redis |
| Languages | `server/i18n.js` + `web/src/ui.js` | LLM translate step or Bhashini |

## Honest limits

- **All data is synthetic**; the impact panel shows the measurement pipeline, and lift means nothing until real post-action history exists. Loan and GST figures are heuristics, not credit or tax decisions.
- Rails are mocks until you point them at real services; WhatsApp sends, Cognee live, a real LLM key and Docker were **not** exercised here. The portal was checked in the in-app browser at desktop and phone widths.
- Voice uses the browser Web Speech API (Chrome/Edge). Bhashini/IndicASR, Soundbox playback, voice biometrics and IVR are not built.
- Marathi/Gujarati/Tamil/Bengali text is my own translation â€” please have native speakers review it.

