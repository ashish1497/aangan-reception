const test = require('node:test');
const assert = require('node:assert');
const { priceRange, PRICING } = require('../../lib/pricing');

test('returns an indicative range with the disclaimer', () => {
  const p = priceRange({ projectType: 'home', areaSqft: 1000 });
  assert.ok(p.low > 0 && p.high > p.low);
  assert.match(p.label, /indicative/);
  assert.match(p.disclaimer, /varies by site/i);
  assert.strictEqual(p.isPlaceholder, PRICING.IS_PLACEHOLDER);
});

test('never returns a single fixed price', () => {
  const p = priceRange({ projectType: 'office', areaSqft: 500 });
  assert.notStrictEqual(p.low, p.high);
});

test('returns null when area or type is unknown', () => {
  assert.strictEqual(priceRange({ projectType: 'home' }), null);
  assert.strictEqual(priceRange({ areaSqft: 900 }), null);
});
