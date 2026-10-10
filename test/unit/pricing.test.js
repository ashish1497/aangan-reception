const test = require('node:test');
const assert = require('node:assert');
const { internalEstimate, pricingDeflection, PRICING } = require('../../lib/pricing');
const pricing = require('../../lib/pricing');

test('internal estimate is labelled internal only and never quoted', () => {
  const p = internalEstimate({ projectType: 'home', areaSqft: 1000 });
  assert.strictEqual(p.internalOnly, true);
  assert.match(p.label, /^Internal estimate, never quoted to the client: /);
  assert.ok(p.low > 0 && p.high > p.low);
  assert.strictEqual(p.low, 1000 * 1800);
});

test('internal estimate covers office and single room from the internal table', () => {
  const o = internalEstimate({ projectType: 'office', areaSqft: 500 });
  assert.strictEqual(o.low, 500 * 1200);
  assert.strictEqual(o.internalOnly, true);
  const r = internalEstimate({ projectType: 'home', scope: 'single_room' });
  assert.strictEqual(r.low, 350000);
  assert.strictEqual(r.high, 800000);
});

test('returns null when there is nothing to estimate from', () => {
  assert.strictEqual(internalEstimate({ projectType: 'home' }), null);
  assert.strictEqual(internalEstimate({ areaSqft: 900 }), null);
});

test('the only caller-facing pricing line is the scripted deflection, with no number in it', () => {
  const d = pricingDeflection();
  assert.strictEqual(d, PRICING.DEFLECTION);
  assert.match(d, /^Pricing depends on the site, the materials you choose, and the scope\./);
  assert.ok(!/\d|lakh|crore|rs\b|₹|per sq/i.test(d), 'deflection carries no figure');
});

test('no caller-facing price helper or disclaimer is exported', () => {
  assert.ok(!('priceRange' in pricing));
  assert.ok(!('DISCLAIMER' in PRICING));
  for (const [k, v] of Object.entries(pricing)) {
    if (typeof v === 'string') assert.ok(!/\d/.test(v), k + ' has no number');
  }
});
