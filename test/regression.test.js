// Regression: seven fixed calls must keep producing the reviewed outcomes in
// test/fixtures/golden.json. If a change is intended, review it and run
// `node scripts/make-golden.js` to update the golden file.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { cleanEnv } = require('./helpers');
cleanEnv();
const { processCall } = require('../lib/process');

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/calls.json'), 'utf8'));
const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/golden.json'), 'utf8'));

for (const c of cases) {
  test(`regression: ${c.name}`, async () => {
    const r = await processCall(c.payload, { useGemini: false });
    const g = golden[c.payload.callId];
    assert.strictEqual(r.qualification.status, g.status);
    assert.strictEqual(r.qualification.secondLook || null, g.secondLook);
    assert.strictEqual(r.fields.projectType || null, g.projectType);
    assert.strictEqual(r.fields.city || null, g.city);
    assert.strictEqual(r.fields.areaSqft ?? null, g.areaSqft);
    assert.strictEqual(r.fields.budgetLakh ?? null, g.budgetLakh);
    assert.strictEqual(r.price ? r.price.label : null, g.priceLabel);
    assert.strictEqual(!!r.afterHours, g.afterHours);
    assert.strictEqual(!!r.bookedSlot, g.booked);
  });
}

test('regression: no fixture ever produces a fixed price or an auto-rejection without a record', async () => {
  for (const c of cases) {
    const r = await processCall(c.payload, { useGemini: false });
    if (r.price) assert.notStrictEqual(r.price.low, r.price.high);
    assert.ok(r.qualification.reasons.length > 0, 'every decision carries a reason');
  }
});
