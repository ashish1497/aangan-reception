// Run: node test/run.js
// Exercises the webhook handler directly with 6 sample transcripts.
// Clears integration env vars first so Gemini, Telegram and Upstash are skipped.
for (const k of ['GEMINI_API_KEY', 'GOOGLE_GEMINI_KEY', 'GOOGLE_GEMINI_KEY_2', 'GOOGLE_GEMINI_KEY_3', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'WEBHOOK_SECRET', 'DEMO_DATA']) delete process.env[k];

const assert = require('assert');
const webhook = require('../api/vaani-webhook');
const statsApi = require('../api/stats');
const callsApi = require('../api/calls');
const store = require('../lib/store');

// Fail loudly if any network call is attempted while env vars are unset.
const realFetch = global.fetch;
let fetchCalls = 0;
global.fetch = async (...args) => { fetchCalls++; throw new Error('Unexpected network call: ' + args[0]); };

function mockRes() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(s) { this.body = s ? JSON.parse(s) : null; }
  };
}
async function post(payload, headers = {}) {
  const res = mockRes();
  await webhook({ method: 'POST', headers, body: payload }, res);
  return res;
}
async function get(handler, query) {
  const res = mockRes();
  await handler({ method: 'GET', headers: {}, query }, res);
  return res;
}

const CASES = [
  {
    name: 'qualified home',
    payload: { callId: 't1', phone: '+91 98000 11111', startedAt: '2026-10-08T05:30:00Z', durationSec: 240, recordingUrl: 'https://example.com/rec/t1', bookedSlot: 'Sat 11:00',
      transcript: [{ speaker: 'agent', text: 'Aangan Studio, how may I help?' }, { speaker: 'caller', text: 'Hi, my name is Priya Kulkarni. We have a 3 BHK flat in Baner, about 1,400 sq ft, budget 10 to 12 lakh, want to start in 2 months. Saturday morning works.' }] },
    check: (b) => {
      assert.strictEqual(b.qualification.status, 'qualified');
      const f = b.record.fields;
      assert.strictEqual(f.projectType, 'home');
      assert.strictEqual(f.areaSqft, 1400);
      assert.strictEqual(f.locality, 'Baner');
      assert.strictEqual(f.budgetLakh, 12);
      assert.strictEqual(f.name, 'Priya Kulkarni');
      assert.ok(b.price && /indicative/i.test(b.price.label));
      assert.ok(/varies by site/i.test(b.price.disclaimer));
      assert.strictEqual(b.record.afterHours, false); // 11:00 IST
      assert.strictEqual(b.record.brief.split('\n').length, 5);
    }
  },
  {
    name: 'qualified office',
    payload: { callId: 't2', callerName: 'Rahul Mehta', phone: '+91 98000 22222', startedAt: '2026-10-08T16:00:00Z', durationSec: 300,
      transcript: 'Agent: Aangan Studio, good evening.\nCaller: We are moving our office to Kharadi, 2,500 square feet, budget around 30 lakh, need it done within 3 months. Email rahul@example.com. Call me tomorrow at 11 am.' },
    check: (b) => {
      assert.strictEqual(b.qualification.status, 'qualified');
      assert.strictEqual(b.record.fields.projectType, 'office');
      assert.strictEqual(b.record.fields.areaSqft, 2500);
      assert.strictEqual(b.record.fields.email, 'rahul@example.com');
      assert.strictEqual(b.record.afterHours, true); // 21:30 IST
    }
  },
  {
    name: 'unqualified out of area',
    payload: { callId: 't3', callerName: 'Out Of Area', phone: '+91 98000 33333', startedAt: '2026-10-08T07:00:00Z', durationSec: 120,
      transcript: [{ speaker: 'caller', text: 'I have a 2 BHK in Nashik, 900 sq ft. Can you do it?' }] },
    check: (b) => {
      assert.strictEqual(b.qualification.status, 'unqualified');
      assert.ok(b.qualification.reasons.some((r) => /outside the service area/.test(r)));
      assert.strictEqual(b.notification.status, 'not sent');
    }
  },
  {
    name: 'grey (area just under minimum)',
    payload: { callId: 't4', callerName: 'Grey Case', phone: '+91 98000 44444', startedAt: '2026-10-08T08:00:00Z', durationSec: 150,
      transcript: [{ speaker: 'caller', text: 'Small 1 BHK apartment in Kothrud, 350 sq ft, budget 6 lakh.' }] },
    check: (b) => {
      assert.strictEqual(b.qualification.status, 'grey');
      assert.ok(b.qualification.reasons.some((r) => /just under/.test(r)));
    }
  },
  {
    name: 'missing area',
    payload: { callId: 't5', callerName: 'No Area', phone: '+91 98000 55555', startedAt: '2026-10-08T09:00:00Z', durationSec: 100,
      transcript: [{ speaker: 'caller', text: 'I want to redo my house in Aundh, budget 15 lakh. I do not know the size.' }] },
    check: (b) => {
      assert.strictEqual(b.qualification.status, 'grey');
      assert.ok(b.qualification.reasons.some((r) => /Missing on the call: areaSqft/.test(r)));
      assert.strictEqual(b.price, null);
    }
  },
  {
    name: 'hostile caller',
    payload: { callId: 't6', callerName: 'Angry Caller', phone: '+91 98000 66666', startedAt: '2026-10-08T03:00:00Z', durationSec: 45,
      transcript: [{ speaker: 'agent', text: 'Aangan Studio, how can I help?' }, { speaker: 'caller', text: 'You people are useless, nobody called me back. My flat in Wakad is 1200 sq ft.' }] },
    check: (b) => {
      assert.strictEqual(b.record.fields.hostile, true);
      assert.strictEqual(b.qualification.status, 'grey');
      assert.ok(b.qualification.reasons.some((r) => /hostile/.test(r)));
    }
  }
];

(async () => {
  let passed = 0;
  const results = [];
  store._resetMemory();

  for (const c of CASES) {
    const res = await post(c.payload);
    assert.strictEqual(res.statusCode, 200, `${c.name}: status ${res.statusCode} ${JSON.stringify(res.body)}`);
    c.check(res.body);
    // Gemini and Telegram must be skipped cleanly with no env vars
    assert.ok(/^rules only/.test(res.body.extraction), `${c.name}: extraction should be rules only`);
    assert.ok(!/Gemini failed/.test(res.body.extraction), `${c.name}: Gemini should be skipped, not failed`);
    if (res.body.qualification.status !== 'unqualified') {
      assert.strictEqual(res.body.notification.status, 'skipped', `${c.name}: Telegram should be skipped`);
    }
    results.push(`PASS  ${c.name.padEnd(32)} -> ${res.body.qualification.status}${res.body.price ? ', ' + res.body.price.label : ''}`);
    passed++;
  }

  // Bad method, missing transcript
  assert.strictEqual((await (async () => { const r = mockRes(); await webhook({ method: 'GET', headers: {} }, r); return r; })()).statusCode, 405);
  assert.strictEqual((await post({ callId: 'x' })).statusCode, 400);
  results.push('PASS  rejects GET and missing transcript'); passed++;

  // Shared secret
  process.env.WEBHOOK_SECRET = 'test-secret';
  assert.strictEqual((await post(CASES[0].payload)).statusCode, 401);
  assert.strictEqual((await post({ ...CASES[0].payload, callId: 't1b' }, { 'x-webhook-secret': 'test-secret' })).statusCode, 200);
  delete process.env.WEBHOOK_SECRET;
  results.push('PASS  x-webhook-secret enforced when WEBHOOK_SECRET set'); passed++;

  // Stats exclude demo by default
  const s = (await get(statsApi, {})).body;
  assert.strictEqual(s.callsAnswered, 7); // 6 cases + t1b
  assert.strictEqual(s.includesDemo, false);
  assert.strictEqual(s.qualified, 3);
  assert.strictEqual(s.unqualified, 1);
  assert.strictEqual(s.grey, 3);
  assert.strictEqual(s.bookedOnCall, 2);
  assert.strictEqual(s.value.pipelineLowInr, 3 * 800000);
  const sd = (await get(statsApi, { includeDemo: '1' })).body;
  assert.strictEqual(sd.callsAnswered, 15);
  results.push('PASS  stats exclude demo unless includeDemo=1 (7 real, 15 with demo)'); passed++;

  // Calls list and detail, demo toggle
  const list = (await get(callsApi, {})).body;
  assert.strictEqual(list.count, 15);
  assert.strictEqual(list.calls.filter((r) => r.demo).length, 8);
  const noDemo = (await get(callsApi, { demo: '0' })).body;
  assert.strictEqual(noDemo.count, 7);
  process.env.DEMO_DATA = 'off';
  assert.strictEqual((await get(callsApi, {})).body.count, 7);
  delete process.env.DEMO_DATA;
  const detail = (await get(callsApi, { id: 't1' })).body;
  assert.strictEqual(detail.callId, 't1');
  assert.ok(Array.isArray(detail.transcript) && detail.transcript.length === 2);
  results.push('PASS  calls list, detail, demo hidden via ?demo=0 and DEMO_DATA=off'); passed++;

  assert.strictEqual(fetchCalls, 0, 'no network calls should happen without env vars');
  results.push('PASS  no network calls made (Gemini, Telegram, Upstash all skipped)'); passed++;

  // Gemini failure falls back to rules
  process.env.GEMINI_API_KEY = 'fake-key-for-test';
  const gres = await post({ ...CASES[0].payload, callId: 't1g' });
  delete process.env.GEMINI_API_KEY;
  assert.strictEqual(gres.statusCode, 200);
  assert.ok(/Gemini failed/.test(gres.body.extraction));
  assert.strictEqual(gres.body.qualification.status, 'qualified');
  results.push('PASS  Gemini error falls back to rules without failing the request'); passed++;

  // Key rotation: first key is rate limited (429), second key works
  {
    const seenKeys = [];
    const prev = global.fetch;
    global.fetch = async (url, opts) => {
      const k = opts.headers['x-goog-api-key'];
      seenKeys.push(k);
      if (k === 'key-one') return { ok: false, status: 429, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ name: 'Test Caller', projectType: 'home', city: 'Pune', areaSqft: 1200, brief: 'a\nb\nc\nd\ne' }) }] } }] }) };
    };
    process.env.GOOGLE_GEMINI_KEY = 'key-one';
    process.env.GOOGLE_GEMINI_KEY_2 = 'key-two';
    const { geminiExtract } = require('../lib/gemini');
    const r = await geminiExtract('hello');
    delete process.env.GOOGLE_GEMINI_KEY; delete process.env.GOOGLE_GEMINI_KEY_2;
    global.fetch = prev;
    assert.strictEqual(r.used, true);
    assert.deepStrictEqual(seenKeys, ['key-one', 'key-two']);
    results.push('PASS  Gemini key rotates to the next key on HTTP 429'); passed++;
  }

  global.fetch = realFetch;
  console.log(results.join('\n'));
  console.log(`\n${passed} checks passed`);
})().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
