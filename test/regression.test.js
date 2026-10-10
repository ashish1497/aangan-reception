// Regression: fixed, realistic calls must keep producing the reviewed outcomes in
// test/fixtures/golden.json. Each outcome was checked by hand against policy/qualified.md.
// If a change is intended, review it and run `node scripts/make-golden.js` to update.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { cleanEnv } = require('./helpers');
cleanEnv();
const { processCall } = require('../lib/process');
const { summarise } = require('../scripts/make-golden');

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/calls.json'), 'utf8'));
const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/golden.json'), 'utf8'));

for (const c of cases) {
  test(`regression: ${c.name}`, async () => {
    const r = await processCall(c.payload, { useGemini: false });
    assert.deepStrictEqual(summarise(r), golden[c.payload.callId]);
  });
}

test('regression: every decision has reasons, five criteria, and no caller-facing price', async () => {
  for (const c of cases) {
    const r = await processCall(c.payload, { useGemini: false });
    assert.ok(r.qualification.reasons.length >= 5, 'every decision carries a reason per criterion');
    assert.strictEqual(Object.keys(r.qualification.criteria).length, 5);
    assert.ok(!('price' in r), 'no caller-facing price on the record');
    if (r.internalEstimate) {
      assert.strictEqual(r.internalEstimate.internalOnly, true);
      assert.match(r.internalEstimate.label, /^Internal estimate, never quoted to the client/);
      assert.notStrictEqual(r.internalEstimate.low, r.internalEstimate.high);
    }
  }
});

test('regression: Aadhaar number never reaches the stored record', async () => {
  const c = cases.find((x) => x.payload.callId === 'reg-12');
  const r = await processCall(c.payload, { useGemini: false });
  assert.ok(!JSON.stringify(r).includes('2345 6789 0123'));
  assert.ok(JSON.stringify(r.transcript).includes('[redacted]'));
});
