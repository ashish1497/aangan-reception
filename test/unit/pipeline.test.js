const test = require('node:test');
const assert = require('node:assert');
const { cleanEnv, blockNetwork, mockRes } = require('../helpers');
cleanEnv();
const store = require('../../lib/store');
const webhook = require('../../lib/handlers/vaani-webhook');
const callsApi = require('../../lib/handlers/calls');
const statsApi = require('../../lib/handlers/stats');
const { computeStats } = statsApi;

const payload = {
  callId: 'p1',
  callerName: 'Test',
  phone: '+919000000000',
  startedAt: '2026-10-06T05:00:00Z',
  durationSec: 120,
  transcript: 'Caller: 2 BHK flat in Pune, 900 sq ft, budget 10 lakh.',
};

async function post(body, headers = {}, method = 'POST') {
  const res = mockRes();
  await webhook({ method, headers, body }, res);
  return res;
}
async function get(api, query = {}) {
  const res = mockRes();
  await api({ method: 'GET', query, headers: {}, url: '/' }, res);
  return res;
}

test('webhook rejects non-POST and missing transcript', async () => {
  store._resetMemory();
  assert.strictEqual((await post(payload, {}, 'GET')).statusCode, 405);
  assert.strictEqual((await post({ callId: 'x' })).statusCode, 400);
});

test('webhook enforces the shared secret when set', async () => {
  store._resetMemory();
  process.env.WEBHOOK_SECRET = 's3cret';
  assert.strictEqual((await post(payload)).statusCode, 401);
  assert.strictEqual((await post(payload, { 'x-webhook-secret': 'wrong' })).statusCode, 401);
  assert.strictEqual((await post(payload, { 'x-webhook-secret': 's3cret' })).statusCode, 200);
  delete process.env.WEBHOOK_SECRET;
});

test('webhook stores the call and it appears in the list and detail', async () => {
  store._resetMemory();
  const net = blockNetwork();
  const r = await post({ ...payload, callId: 'p2' });
  net.restore();
  assert.strictEqual(r.statusCode, 200);
  const list = (await get(callsApi, {})).body;
  assert.strictEqual(list.count, 1);
  const d = (await get(callsApi, { id: 'p2', demo: '0' })).body;
  assert.strictEqual(d.callId || d.id, 'p2');
});

test('unknown call id returns 404', async () => {
  store._resetMemory();
  assert.strictEqual((await get(callsApi, { id: 'nope', demo: '0' })).statusCode, 404);
});

test('sample calls are opt in and left out of the numbers by default', async () => {
  store._resetMemory();
  const real = (await get(statsApi, {})).body;
  const withSamples = (await get(statsApi, { includeDemo: '1' })).body;
  assert.strictEqual(real.callsAnswered, 0);
  assert.ok(withSamples.callsAnswered > 0);
  assert.strictEqual(real.includesDemo, false);
  assert.strictEqual((await get(callsApi, {})).body.count, 0);
  assert.ok((await get(callsApi, { demo: '1' })).body.count > 0);
});

test('computeStats: shares, near-miss and human-review counts', () => {
  const rec = (status, extra = {}) => ({
    qualification: { status, ...(extra.secondLook ? { secondLook: extra.secondLook } : {}) },
    answeredWithin5Min: true,
    afterHours: extra.afterHours || false,
    bookedSlot: extra.bookedSlot || null,
    durationSec: 60,
    costInr: 10,
  });
  const s = computeStats([
    rec('qualified', { bookedSlot: 'x', afterHours: true }),
    rec('qualified'),
    rec('grey'),
    rec('unqualified', { secondLook: 'near_miss' }),
  ]);
  assert.strictEqual(s.callsAnswered, 4);
  assert.strictEqual(s.qualified, 2);
  assert.strictEqual(s.nearMiss, 1);
  assert.strictEqual(s.needsHumanReview, 2);
  assert.strictEqual(s.qualifiedShare, 50);
  assert.strictEqual(s.bookedShareOfQualified, 50);
  assert.strictEqual(s.afterHoursShare, 25);
  assert.strictEqual(s.cost.totalInr, 40);
  assert.strictEqual(s.cost.perCallInr, 10);
  assert.strictEqual(s.value.qualifiedLeads, 2);
  assert.strictEqual(s.guardrailViolations, 0);
  assert.strictEqual(s.callsNeedingReview, 0);
});

test('computeStats on no calls is all zeros, not NaN', () => {
  const s = computeStats([]);
  assert.strictEqual(s.callsAnswered, 0);
  assert.strictEqual(s.afterHoursShare, 0);
  assert.strictEqual(s.cost.perCallInr, 0);
  assert.strictEqual(s.bookedShareOfQualified, 0);
});

test('agent price slip: record needs review, qualification unchanged, note carries Guardrail lines', async () => {
  store._resetMemory();
  const net = blockNetwork();
  const r = await post({
    ...payload,
    callId: 'g1',
    transcript:
      'Caller: 2 BHK flat in Baner, 900 sq ft, done in three months. How much? AI: It will be around Rs 15 lakh.',
  });
  net.restore();
  assert.strictEqual(r.statusCode, 200);
  const rec = r.body.record;
  assert.strictEqual(rec.qualification.status, 'qualified');
  assert.strictEqual(rec.status, 'needs-review');
  assert.strictEqual(rec.guardrails.needsReview, true);
  assert.match(rec.note, /Guardrail: Agent said a price/);
  assert.match(rec.note, /Caller asked about price: deflected, designer to cover at consultation/);
  assert.match(rec.note, /Internal estimate, never quoted to the client/);
  const s = (await get(statsApi, {})).body;
  assert.strictEqual(s.guardrailViolations, 1);
  assert.strictEqual(s.callsNeedingReview, 1);
  const row = (await get(callsApi, {})).body.calls[0];
  assert.strictEqual(row.needsReview, true);
  assert.match(row.internalEstimate, /^Internal estimate, never quoted to the client/);
  assert.ok(!('price' in row));
});

test('stored transcript is redacted', async () => {
  store._resetMemory();
  const net = blockNetwork();
  await post({ ...payload, callId: 'pii1', transcript: 'Caller: my PAN is ABCDE1234F, flat in Aundh' });
  net.restore();
  const d = (await get(callsApi, { id: 'pii1', demo: '0' })).body;
  assert.ok(!JSON.stringify(d).includes('ABCDE1234F'));
  assert.ok(d.guardrails.flags.some((f) => f.code === 'pii_pan'));
});
