const test = require('node:test');
const assert = require('node:assert');
const { cleanEnv, blockNetwork } = require('../helpers');
const { geminiExtract, geminiKeys } = require('../../lib/gemini');

const ok = (obj) => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }),
});

test('keys are read in order and de-duplicated', () => {
  const keys = geminiKeys({ GOOGLE_GEMINI_KEY: 'a', GOOGLE_GEMINI_KEY_2: 'b', GEMINI_API_KEY: 'a' });
  assert.deepStrictEqual(keys, ['a', 'b']);
});

test('skipped cleanly with no key and no network call', async () => {
  cleanEnv();
  const net = blockNetwork();
  const r = await geminiExtract('hello', {});
  net.restore();
  assert.strictEqual(r.used, false);
  assert.strictEqual(net.state.calls, 0);
});

test('rotates to the next key on 429 and 5xx', async () => {
  const seen = [];
  const real = global.fetch;
  global.fetch = async (u, o) => {
    const k = o.headers['x-goog-api-key'];
    seen.push(k);
    if (k === 'k1') return { ok: false, status: 429, json: async () => ({}) };
    if (k === 'k2') return { ok: false, status: 503, json: async () => ({}) };
    return ok({ projectType: 'home', city: 'Pune', areaSqft: 900, brief: 'a\nb\nc\nd\ne' });
  };
  const r = await geminiExtract('hello', {
    GOOGLE_GEMINI_KEY: 'k1',
    GOOGLE_GEMINI_KEY_2: 'k2',
    GOOGLE_GEMINI_KEY_3: 'k3',
  });
  global.fetch = real;
  assert.strictEqual(r.used, true);
  assert.deepStrictEqual(seen.slice(0, 3), ['k1', 'k2', 'k3']);
  assert.strictEqual(r.fields.areaSqft, 900);
});

test('does not rotate on a non-retryable error (401)', async () => {
  const seen = [];
  const real = global.fetch;
  global.fetch = async (u, o) => {
    seen.push(o.headers['x-goog-api-key']);
    return { ok: false, status: 401, json: async () => ({}) };
  };
  const r = await geminiExtract('hello', { GOOGLE_GEMINI_KEY: 'k1', GOOGLE_GEMINI_KEY_2: 'k2' });
  global.fetch = real;
  assert.strictEqual(r.used, false);
  assert.strictEqual(seen.length, 1);
});

test('rejects invalid project types and non-numeric area', async () => {
  const real = global.fetch;
  global.fetch = async () => ok({ projectType: 'villa', areaSqft: 'big', budgetLakh: 12 });
  const r = await geminiExtract('hello', { GOOGLE_GEMINI_KEY: 'k1' });
  global.fetch = real;
  assert.strictEqual(r.used, true);
  assert.strictEqual(r.fields.projectType, undefined);
  assert.strictEqual(r.fields.areaSqft, undefined);
  assert.strictEqual(r.fields.budgetLakh, 12);
});
