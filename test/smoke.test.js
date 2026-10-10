// Smoke test: start the real dev server and hit every public route once.
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3600 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;
let server;

async function waitUp() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(BASE + '/');
      if (r.ok) return;
    } catch (_) {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
}

test.before(async () => {
  const env = { ...process.env, PORT: String(PORT) };
  for (const k of [
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID',
    'GOOGLE_GEMINI_KEY',
    'GOOGLE_GEMINI_KEY_2',
    'GOOGLE_GEMINI_KEY_3',
    'GEMINI_API_KEY',
    'WEBHOOK_SECRET',
  ])
    delete env[k];
  server = spawn('node', [path.join(__dirname, '../dev-server.js')], { env, stdio: 'ignore' });
  await waitUp();
});
test.after(() => server && server.kill());

test('smoke: dashboard page loads with the title and test ids', async () => {
  const r = await fetch(BASE + '/');
  const html = await r.text();
  assert.strictEqual(r.status, 200);
  assert.match(html, /Aangan Voice Desk/);
  assert.match(html, /data-testid="kpis"/);
});

test('smoke: /api/stats returns the metric set', async () => {
  const r = await fetch(BASE + '/api/stats?includeDemo=1');
  const s = await r.json();
  assert.strictEqual(r.status, 200);
  for (const k of [
    'callsAnswered',
    'answeredWithin5Min',
    'qualified',
    'grey',
    'unqualified',
    'nearMiss',
    'bookedOnCall',
    'afterHoursShare',
    'cost',
    'value',
  ])
    assert.ok(k in s, 'missing ' + k);
});

test('smoke: /api/calls returns demo calls and a call detail', async () => {
  const list = await (await fetch(BASE + '/api/calls')).json();
  assert.ok(list.count > 0);
  const id = list.calls[0].id;
  const d = await fetch(BASE + '/api/calls?id=' + encodeURIComponent(id));
  assert.strictEqual(d.status, 200);
});

test('smoke: webhook accepts a call and the stats move', async () => {
  const before = (await (await fetch(BASE + '/api/stats')).json()).callsAnswered;
  const r = await fetch(BASE + '/api/vaani-webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      callId: 'smoke-1',
      callerName: 'Smoke',
      phone: '+910000000000',
      startedAt: new Date().toISOString(),
      durationSec: 100,
      transcript: 'Caller: 2 BHK in Pune, 1000 sq ft, budget 10 lakh',
    }),
  });
  assert.strictEqual(r.status, 200);
  const after = (await (await fetch(BASE + '/api/stats')).json()).callsAnswered;
  assert.strictEqual(after, before + 1);
});

test('smoke: unknown route is 404, wrong method is rejected', async () => {
  assert.strictEqual((await fetch(BASE + '/api/nope')).status, 404);
  assert.strictEqual((await fetch(BASE + '/api/vaani-webhook')).status, 405);
});
