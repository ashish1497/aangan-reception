# Aangan Voice Desk

Mesa School, Case 03: Aangan Studio unanswered enquiries. A voice AI desk built around Vaani.

Aangan Studio (interior design for homes and small offices, Pune, 60 people, 14 designers, founder Nikhil Deshpande) gets about 200 enquiries a month. About 48% get no response within 48 hours, about 33% arrive outside 10am to 7pm, and the front desk is 2 people. The case says an enquiry answered within an hour converts at 4x the rate of one answered next day. Nikhil wants every enquiry answered within 5 minutes, day or night, and worthwhile enquiries to reach designers with everything already asked.

This project covers **incoming phone calls only**. Vaani answers the call live, asks the qualifying questions, and when the call ends it posts the call to this app. The app extracts the details, scores the lead, attaches an indicative price range, notifies designers on Telegram, stores the record, and shows everything on a dashboard for Nikhil and the front desk.

## Architecture

1. **Trigger:** a caller rings Aangan Studio; Vaani answers and, when the call ends, POSTs to `/api/vaani-webhook`.
2. **Input:** call JSON `{callId, callerName, phone, startedAt, durationSec, transcript, recordingUrl, bookedSlot?}`.
3. **Context:** qualification rubric (`lib/rubric.js`), per-sq-ft pricing (`lib/pricing.js`), cost assumptions (`lib/cost.js`).
4. **Processing:** regex and keyword extraction, rubric scoring (qualified, grey, unqualified), indicative price range, handoff note.
5. **AI:** Vaani runs the conversation; optional Gemini fills gaps in extraction and writes a 5-line designer brief, falling back to rules on any error.
6. **Output:** Telegram message to designers (qualified) or front desk (grey), stored record, dashboard at `/`.

```
api/vaani-webhook.js  POST, called by Vaani after each call
api/calls.js          GET list, GET ?id= detail (?demo=0 hides demo calls)
api/stats.js          GET KPIs (?includeDemo=1 to count demo calls)
lib/                  extract, gemini, rubric, pricing, cost, store, telegram, demo, process
public/index.html     dashboard, vanilla JS, no CDN
dev-server.js         local static + API server
test/run.js           test script
```

No npm dependencies and no build step. Node 18 or newer.

## Run locally

```
node test/run.js          # runs the tests
node dev-server.js        # http://localhost:3000 (set PORT to change)
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

1. In the Vaani agent, script the questions the rubric needs: name, home or office, locality, carpet area in sq ft, budget, timeline, preferred callback time. Offer a slot if Vaani supports booking.
2. Tell the agent to give price only as an indicative range and to say it "varies by site".
3. Set the post-call webhook URL to `https://<your-vercel-domain>/api/vaani-webhook`, method POST, JSON body.
4. Add header `x-webhook-secret: <same value as WEBHOOK_SECRET>`.
5. Map Vaani's post-call fields to the input above. **The field names here are assumptions; check them against Vaani's webhook docs** and adjust `api/vaani-webhook.js` if they differ. `transcript` can be a string (`Caller: ...` lines) or an array of `{speaker, text}`. An optional `answeredAfterSec` is read if Vaani reports ring time; otherwise a live Vaani pickup counts as answered within 5 minutes.

## Deploy (not done yet; run these yourself)

```
gh auth login
gh repo create aangan-voice-desk --public --source=. --push
vercel login
vercel --prod
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

- **Placeholder rubric and pricing.** `lib/rubric.js` and `lib/pricing.js` hold made-up thresholds and per-sq-ft rates. Replace them with `qualified.md` and `pricing.md` from the LMS before any real use. Until then, never quote these numbers to a client.
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
| Unit                  | `npm run test:unit`       | rubric, pricing, cost, extraction, Gemini key rotation, Telegram, webhook, calls and stats handlers                                                                                |
| Regression            | `npm run test:regression` | 7 fixed calls (`test/fixtures/calls.json`) must keep the reviewed outcomes in `test/fixtures/golden.json`. Update with `node scripts/make-golden.js` only after reviewing a change |
| Smoke                 | `npm run test:smoke`      | starts the real server and hits the page and every API route once                                                                                                                  |
| End to end (Selenium) | `npm run test:e2e`        | 10 browser tests of the dashboard (Chrome, headless). Needs `pip install selenium`. Set `BASE_URL` to test a deployed copy                                                         |
| Legacy script         | `npm run test:legacy`     | the original 14-check script                                                                                                                                                       |
| Everything            | `npm run check`           | prettier check, eslint, then all tests except Selenium                                                                                                                             |

Every dashboard element has a `data-testid`, and `<body>` gets `data-ready="true"` once data has loaded, so Selenium waits are explicit.
Tests clear all integration env vars first and block the network, so they never call Vaani, Gemini, Telegram or Upstash.
Format with `npm run format`, lint with `npm run lint`.
