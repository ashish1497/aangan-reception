# Receiving calls from Vaani

The app takes one POST per finished call at `/api/vaani-webhook`.

## Set up in Vaani

1. Open the agent, then **Webhooks** (or the post-call or API section).
2. URL: `https://<your-vercel-url>/api/vaani-webhook`
3. If custom headers are allowed, add `x-webhook-secret` with the value of `WEBHOOK_SECRET`.
4. Send the event when the call ends, with the transcript included.

## What the app accepts

Vaani's field names are not fixed in our documents, so the app reads the common spellings. Fields can sit at
the top level or inside `data`, `call`, `payload` or `result`.

| Needed                | Names it looks for                                                                                                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transcript (required) | `transcript`, `transcription`, `full_transcript`, `conversation`, `messages`, `utterances`, `turns`, `dialogue`. A string, or a list of turns with `role` or `speaker` and `text`, `content` or `message` |
| Call id               | `callId`, `call_id`, `id`, `callSid`, `session_id`, `conversation_id`                                                                                                                                     |
| Caller number         | `phone`, `caller_number`, `from`, `from_number`, `customer.number`, `phone_number`                                                                                                                        |
| Caller name           | `callerName`, `caller_name`, `customer_name`, `customer.name`, `name`                                                                                                                                     |
| Start time            | `startedAt`, `started_at`, `start_time`, `created_at`, `timestamp`                                                                                                                                        |
| Duration              | `durationSec`, `duration_seconds`, `duration`, `call_duration`, `duration_ms` (milliseconds)                                                                                                              |
| Recording             | `recordingUrl`, `recording_url`, `audio_url`                                                                                                                                                              |
| Booked slot           | `bookedSlot`, `booking.start`, `appointment.start_time`, or a successful `book_appointment` entry in `tool_calls`                                                                                         |

Events that mean the call has not ended (`call.started`, `ringing`, `in-progress`) are acknowledged and ignored.
If the transcript is missing, the response is 400 and lists the field names that were received (names only).

## Check it

```bash
WEBHOOK_SECRET=... node scripts/send-test-call.js https://<your-vercel-url> good
```

Scenarios: `good`, `price`, `nashik`, `soon`. The call then appears on the dashboard and, if the decision is
qualified or grey, a Telegram note goes to the designer.

## If Vaani does not send the transcript

Some platforms send only a call id and ask you to fetch the call. If the webhook returns 400 with
`receivedKeys` that include an id but no transcript, the app needs a fetch step against Vaani's API.
