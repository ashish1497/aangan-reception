# Aangan Voice Desk

Mesa School, Case 03: Aangan Studio unanswered enquiries. A voice AI desk built around Vaani.

Aangan Studio (interior design for homes and small offices, Pune, 60 people, 14 designers, founder Nikhil Deshpande) gets about 200 enquiries a month. About 48% get no response within 48 hours, about 33% arrive outside 10am to 7pm, and the front desk is 2 people. The case says an enquiry answered within an hour converts at 4x the rate of one answered next day. Nikhil wants every enquiry answered within 5 minutes, day or night, and worthwhile enquiries to reach designers with everything already asked.

This project covers **incoming phone calls only**. Vaani answers the call live, asks the qualifying questions, and when the call ends it posts the call to this app. The app extracts the details, scores the lead against Nikhil's five criteria, checks the agent's own lines with guardrails, attaches an internal estimate for the designer only (never quoted to the client), notifies designers on Telegram, stores the record, and shows everything on a dashboard for Nikhil and the front desk.

## Architecture

1. **Trigger:** a caller rings Aangan Studio; Vaani answers and, when the call ends, POSTs to `/api/vaani-webhook`.
2. **Input:** call JSON `{callId, callerName, phone, startedAt, durationSec, transcript, recordingUrl, bookedSlot?}`.
3. **Context:** policy in `policy/qualified.md`, `policy/services.md`, `policy/pricing.md`; their numbers in `policy/rubric.json`. Code: rubric (`lib/rubric.js`), internal pricing (`lib/pricing.js`), guardrails (`lib/guardrails.js`), cost (`lib/cost.js`).
4. **Processing:** PII redaction and guardrails, regex and keyword extraction, five-criteria scoring (qualified, grey with one question to ask, unqualified), internal estimate (designer only), handoff note.
5. **AI:** Vaani runs the conversation; optional Gemini fills gaps in extraction and writes a 5-line designer brief, falling back to rules on any error.
6. **Output:** Telegram message to designers (qualified) or front desk (grey), stored record, dashboard at `/`.

```
app/api/vaani-webhook/route.js  POST, called by Vaani after each call
app/api/calls/route.js          GET list, GET ?id= detail (?demo=1 adds sample calls)
app/api/stats/route.js          GET KPIs (?includeDemo=1 to count sample calls)
lib/handlers/                   the (req, res) handlers behind those routes
lib/nextAdapter.js              runs a (req, res) handler inside a Next.js route handler
lib/dashboardData.js            data for the server-rendered pages, read straight from the store
lib/                            extract, gemini, rubric, pricing, cost, store, telegram, demo, process
app/page.js                     dashboard (server rendered, Ant Design)
app/calls/[id]/page.js          one call, server rendered
app/loading.js                  skeleton shown while a page streams
components/                     dashboard pieces (KPI cards, calls table, call detail, cost and value)
```

Next.js 14 (App Router) with Ant Design 5. Styles are rendered on the server through
`@ant-design/nextjs-registry`, so the first paint is complete without client JavaScript.
Dashboard state lives in the URL: `?samples=1` shows sample calls, `?count=1` counts them in the
numbers, `?call=<id>` opens a call in the side panel. Node 18 or newer.

## Run locally

```
npm install
npm run dev               # http://localhost:3000, hot reload
npm run build && npm start  # production build on http://localhost:3000
npm run check             # prettier, eslint, unit + regression + smoke tests
npm run test:e2e          # Selenium against `next start` (builds first if needed)
npm run lighthouse        # builds, starts on :3900, prints mobile and desktop scores
```

Send a test call:

```
curl -X POST http://localhost:3000/api/vaani-webhook \
  -H 'Content-Type: application/json' \
  -d '{"callId":"c1","callerName":"Test","phone":"+91 90000 00000","startedAt":"2026-10-10T15:00:00Z","durationSec":200,"transcript":"Caller: 2 BHK flat in Kothrud, 950 sq ft, budget 9 lakh, start in 1 month."}'
```

## Environment variables

All are optional. With none set, the app runs on rules only, skips Telegram, and stores in memory.

| Variable                   | Purpose                                                    | If not set                                              |
| -------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| `WEBHOOK_SECRET`           | Shared secret Vaani sends in the `x-webhook-secret` header | Webhook accepts any caller                              |
| `GEMINI_API_KEY`           | Enables Gemini extraction and brief                        | Rules only                                              |
| `GEMINI_MODEL`             | Gemini model name                                          | `gemini-flash-latest`                                   |
| `TELEGRAM_BOT_TOKEN`       | Bot that posts handoff notes                               | Notification skipped                                    |
| `TELEGRAM_CHAT_ID`         | Designers group chat id                                    | Notification skipped                                    |
| `UPSTASH_REDIS_REST_URL`   | Durable storage                                            | In-memory (not durable on Vercel)                       |
| `UPSTASH_REDIS_REST_TOKEN` | Durable storage                                            | In-memory                                               |
| `DEMO_DATA`                | `off` hides the 8 synthetic demo calls                     | Demo calls shown (never counted in KPIs unless toggled) |
| `VOICE_COST_PER_MIN`       | Rupees per voice minute (assumption)                       | 6                                                       |
| `LLM_COST_PER_CALL`        | Rupees of LLM cost per call (assumption)                   | 0.5                                                     |

## Configure the Vaani agent

1. In the Vaani agent, script the questions the rubric needs: what they want done (design and execution), locality, when they need it complete, whether they decide. Do not probe for budget. Offer a slot if Vaani supports booking.
2. The agent must never say a price, range or per-sq-ft figure. The only answer to a pricing question is the scripted line in `policy/pricing.md`. Calls where the agent slips are flagged for review on the dashboard.
3. Set the post-call webhook URL to `https://<your-vercel-domain>/api/vaani-webhook`, method POST, JSON body.
4. Add header `x-webhook-secret: <same value as WEBHOOK_SECRET>`.
5. Map Vaani's post-call fields to the input above. **The field names here are assumptions; check them against Vaani's webhook docs** and adjust `lib/handlers/vaani-webhook.js` if they differ. `transcript` can be a string (`Caller: ...` lines) or an array of `{speaker, text}`. An optional `answeredAfterSec` is read if Vaani reports ring time; otherwise a live Vaani pickup counts as answered within 5 minutes.

## Deploy

`vercel.json` sets the framework to Next.js, so Vercel builds with `next build` and serves the
pages and the `/api/*` route handlers. In the Vercel project settings the Framework Preset should
read Next.js (vercel.json makes this automatic). The webhook URL stays `/api/vaani-webhook`.

Ship a preview first, check it, then promote:

```
vercel                      # preview deployment from this branch
# open the preview URL: dashboard loads, toggles work, POST a test call to <preview>/api/vaani-webhook
vercel --prod               # only after the preview checks out
vercel env add WEBHOOK_SECRET production
vercel env add GEMINI_API_KEY production
vercel env add TELEGRAM_BOT_TOKEN production
vercel env add TELEGRAM_CHAT_ID production
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel --prod   # redeploy so the env vars take effect
```

## Extending to WhatsApp and the web form

Out of scope for this build. Both could feed the same pipeline: a WhatsApp Business API webhook or the website form handler would post `{callerName, phone, transcript: <message text>}` to a sibling endpoint that calls `processCall` from `lib/process.js`, so scoring, pricing, Telegram and the dashboard are reused. A `channel` field would be added to records and KPIs.

## Limitations and TODO

- **Policy values.** `policy/rubric.json` holds the numbers from Nikhil's `qualified.md`, `services.md` and `pricing.md`. If those files change, change this one to match.
- **Vaani payload field names** must be checked against Vaani's docs.
- **Storage durability.** Without Upstash, records live in serverless memory and will disappear. Set the Upstash variables before going live.
- **Cost figures are assumptions.** Replace `VOICE_COST_PER_MIN` and `LLM_COST_PER_CALL` with real Vaani and Gemini pricing.
- **Value panel is not a revenue forecast.** It multiplies qualified leads by the case's Rs 8 to 14 lakh project value. Conversion is unknown, and the 4x figure only describes answer speed.
- **Rule extraction is basic.** It knows a fixed list of Pune localities and other cities, and English phrasing. Hindi or Marathi calls need Gemini or Vaani's own extraction.
- **Dashboard has no login.** Anyone with the URL can read call data. Add auth (for example Vercel password protection) before real callers' data goes in.
- Demo calls in `lib/demo.js` are synthetic and are marked DEMO DATA everywhere.
- Not yet tested against a live Vaani account, Gemini, Telegram or Upstash.

## Testing

| Layer                 | Command                   | What it covers                                                                                                                                                                     |
| --------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                  | `npm run test:unit`       | rubric, pricing, guardrails, cost, extraction, Gemini key rotation, Telegram, webhook, calls and stats handlers                                                                    |
| Regression            | `npm run test:regression` | 7 fixed calls (`test/fixtures/calls.json`) must keep the reviewed outcomes in `test/fixtures/golden.json`. Update with `node scripts/make-golden.js` only after reviewing a change |
| Smoke                 | `npm run test:smoke`      | starts `next start` (building first if needed) and hits the dashboard, a call page and every API route once                                                                        |
| End to end (Selenium) | `npm run test:e2e`        | 12 browser tests of the dashboard against `next start` (Chrome, headless). Needs `pip install selenium`. Set `BASE_URL` to test a deployed copy                                    |
| Everything            | `npm run check`           | prettier check, eslint, then all tests except Selenium                                                                                                                             |

Every dashboard element has a `data-testid`. `<body>` gets `data-ready="true"` after hydration and loses it while a toggle or refresh is re-rendering on the server, so Selenium waits are explicit.
Tests clear all integration env vars first and block the network, so they never call Vaani, Gemini, Telegram or Upstash.
Format with `npm run format`, lint with `npm run lint`.
