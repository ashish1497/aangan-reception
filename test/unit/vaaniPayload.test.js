const test = require('node:test');
const assert = require('node:assert');
const { normaliseVaaniPayload } = require('../../lib/vaaniPayload');

test('our own flat shape passes through', () => {
  const { payload } = normaliseVaaniPayload({
    callId: 'a1',
    callerName: 'Rohan',
    phone: '+919800000001',
    startedAt: '2026-10-06T05:00:00Z',
    durationSec: 120,
    transcript: 'Caller: hi',
    bookedSlot: '2026-10-08 11:00 IST',
  });
  assert.strictEqual(payload.callId, 'a1');
  assert.strictEqual(payload.durationSec, 120);
  assert.strictEqual(payload.bookedSlot, '2026-10-08 11:00 IST');
});

test('snake_case fields nested under data', () => {
  const { payload } = normaliseVaaniPayload({
    event: 'call.ended',
    data: {
      call_id: 'c-9',
      caller_number: '+919811111111',
      customer_name: 'Neha',
      start_time: '2026-10-06T10:00:00Z',
      duration_seconds: 245,
      transcript: 'AI: hello\nCaller: 2 BHK in Baner',
      recording_url: 'https://example.com/r.mp3',
    },
  });
  assert.strictEqual(payload.callId, 'c-9');
  assert.strictEqual(payload.phone, '+919811111111');
  assert.strictEqual(payload.callerName, 'Neha');
  assert.strictEqual(payload.durationSec, 245);
  assert.strictEqual(payload.recordingUrl, 'https://example.com/r.mp3');
  assert.match(payload.transcript, /2 BHK/);
});

test('messages array with roles becomes a labelled transcript', () => {
  const { payload } = normaliseVaaniPayload({
    call: {
      id: 'x',
      messages: [
        { role: 'assistant', content: 'Hello, Aangan Studio.' },
        { role: 'user', content: 'I want my flat in Aundh redone.' },
      ],
    },
  });
  assert.strictEqual(
    payload.transcript,
    'AI: Hello, Aangan Studio.\nCaller: I want my flat in Aundh redone.',
  );
});

test('duration in milliseconds is converted', () => {
  const { payload } = normaliseVaaniPayload({ transcript: 'x', duration_ms: 90000 });
  assert.strictEqual(payload.durationSec, 90);
});

test('booked slot is read from a book_appointment tool call', () => {
  const { payload } = normaliseVaaniPayload({
    transcript: 'x',
    tool_calls: [
      { name: 'Check_availability_booking', result: { slots: [] } },
      {
        name: 'book_appointment',
        arguments: { start: '2026-10-09T10:00:00+05:30' },
        result: { success: true },
      },
    ],
  });
  assert.strictEqual(payload.bookedSlot, '2026-10-09T10:00:00+05:30');
});

test('a failed booking tool call is not treated as a booking', () => {
  const { payload } = normaliseVaaniPayload({
    transcript: 'x',
    tool_calls: [
      { name: 'book_appointment', arguments: { start: '2026-10-09T10:00' }, result: { success: false } },
    ],
  });
  assert.strictEqual(payload.bookedSlot, undefined);
});

test('call-started events are ignored, not stored', () => {
  const r = normaliseVaaniPayload({ event: 'call.started', call_id: '1' });
  assert.ok(r.ignored);
  assert.strictEqual(r.payload, null);
});

test('missing transcript is reported with the keys that were received', () => {
  const r = normaliseVaaniPayload({ call_id: '1', foo: 'bar' });
  assert.strictEqual(r.payload.transcript, undefined);
  assert.ok(r.receivedKeys.includes('foo'));
});

test('object phone or name fields are dropped, not stored as [object Object]', () => {
  const { payload } = normaliseVaaniPayload({
    transcript: 'x',
    customer: { number: '+91' },
    caller: { id: 1 },
  });
  assert.strictEqual(typeof payload.phone, 'string');
});
