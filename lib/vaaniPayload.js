// Turns whatever Vaani posts after a call into the one shape the pipeline uses:
//   { callId, callerName, phone, startedAt, durationSec, transcript, recordingUrl, bookedSlot }
// Vaani's field names are not fixed in our documents, so this accepts the common
// spellings, nested objects ({ data }, { call }, { payload }), and transcripts that
// are a string or a list of turns. Only keys are ever logged, never values.

const WRAPPERS = ['data', 'call', 'payload', 'result', 'body', 'event_data'];

function pick(obj, names) {
  for (const n of names) {
    const parts = n.split('.');
    let cur = obj;
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
      else {
        cur = undefined;
        break;
      }
    }
    if (cur !== undefined && cur !== null && cur !== '') return cur;
  }
  return undefined;
}

function unwrap(body) {
  let cur = body && typeof body === 'object' ? body : {};
  for (let i = 0; i < 3; i++) {
    const inner = WRAPPERS.map((w) => cur[w]).find((v) => v && typeof v === 'object' && !Array.isArray(v));
    if (!inner) break;
    // Keep top-level fields too (event name, ids) by merging, inner wins.
    cur = { ...cur, ...inner };
  }
  return cur;
}

const AGENT = /^(?:assistant|agent|bot|ai|vaani|system|model)$/i;
const CALLER = /^(?:user|customer|caller|human|client)$/i;

function turnsToTranscript(arr) {
  const lines = [];
  for (const t of arr) {
    if (typeof t === 'string') {
      lines.push(t);
      continue;
    }
    if (!t || typeof t !== 'object') continue;
    const role = String(t.role || t.speaker || t.from || t.participant || t.sender || '').trim();
    const text = t.text ?? t.content ?? t.message ?? t.transcript ?? t.utterance ?? '';
    if (!String(text).trim()) continue;
    const label = AGENT.test(role) ? 'AI' : CALLER.test(role) ? 'Caller' : role || 'Caller';
    lines.push(`${label}: ${String(text).trim()}`);
  }
  return lines.join('\n');
}

function extractTranscript(src) {
  const raw = pick(src, [
    'transcript',
    'transcription',
    'full_transcript',
    'call_transcript',
    'conversation',
    'messages',
    'utterances',
    'turns',
    'dialogue',
    'chat_history',
  ]);
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return turnsToTranscript(raw);
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.turns)) return turnsToTranscript(raw.turns);
    if (Array.isArray(raw.messages)) return turnsToTranscript(raw.messages);
    if (typeof raw.text === 'string') return raw.text;
  }
  return undefined;
}

function toSeconds(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function extractBookedSlot(src) {
  const direct = pick(src, [
    'bookedSlot',
    'booked_slot',
    'booking.start',
    'booking.start_time',
    'booking.startTime',
    'appointment.start',
    'appointment.start_time',
    'appointment.time',
    'appointment_time',
    'booked_time',
  ]);
  if (direct) return String(direct);
  const lists = [src.tool_calls, src.tools, src.function_calls, src.actions, src.tool_results].filter(
    Array.isArray,
  );
  for (const list of lists) {
    for (const t of list) {
      const name = String((t && (t.name || t.tool || t.function)) || '');
      if (!/book_appointment/i.test(name)) continue;
      const res = t.result || t.output || t.response || {};
      const args = t.arguments || t.args || t.input || {};
      if (res && (res.success === false || res.error)) continue;
      const when = pick({ ...args, ...(typeof res === 'object' ? res : {}) }, [
        'start',
        'start_time',
        'startTime',
        'datetime',
        'date_time',
        'time',
        'slot',
      ]);
      if (when) return String(when);
    }
  }
  return undefined;
}

/** Returns { payload, ignored, receivedKeys } */
function normaliseVaaniPayload(body) {
  const src = unwrap(body);
  const receivedKeys = Object.keys(src).slice(0, 40);
  const event = String(pick(src, ['event', 'event_type', 'type', 'status']) || '').toLowerCase();
  if (/(call[._-]?started|call[._-]?initiated|ringing|in[._-]?progress|ongoing)/.test(event)) {
    return { payload: null, ignored: 'call has not ended', receivedKeys };
  }
  const startedAt = pick(src, [
    'startedAt',
    'started_at',
    'start_time',
    'startTime',
    'call_start',
    'created_at',
    'createdAt',
    'timestamp',
  ]);
  let durationSec = toSeconds(
    pick(src, ['durationSec', 'duration_seconds', 'duration_sec', 'duration', 'call_duration', 'billsec']),
  );
  if (durationSec === undefined) {
    const ms = toSeconds(pick(src, ['duration_ms', 'durationMs']));
    if (ms !== undefined) durationSec = ms / 1000;
  }
  const payload = {
    callId: pick(src, [
      'callId',
      'call_id',
      'id',
      'callSid',
      'call_sid',
      'session_id',
      'conversation_id',
      'uuid',
    ]),
    callerName: pick(src, ['callerName', 'caller_name', 'customer_name', 'customer.name', 'name']),
    phone: pick(src, [
      'phone',
      'caller_number',
      'caller_phone',
      'from_number',
      'from',
      'customer_number',
      'customer.number',
      'customer.phone',
      'phone_number',
      'caller',
    ]),
    startedAt: startedAt ? String(startedAt) : undefined,
    durationSec,
    transcript: extractTranscript(src),
    recordingUrl: pick(src, ['recordingUrl', 'recording_url', 'recording', 'audio_url', 'call_recording']),
    bookedSlot: extractBookedSlot(src),
  };
  for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k];
  if (payload.phone !== undefined && typeof payload.phone === 'object') delete payload.phone;
  if (payload.callerName !== undefined && typeof payload.callerName === 'object') delete payload.callerName;
  if (payload.callId !== undefined) payload.callId = String(payload.callId);
  return { payload, ignored: null, receivedKeys };
}

module.exports = { normaliseVaaniPayload, turnsToTranscript };
