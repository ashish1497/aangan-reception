const test = require('node:test');
const assert = require('node:assert');
const { cleanEnv } = require('../helpers');
cleanEnv();
const { inr, lakh, readOptions } = require('../../lib/dashboardData');

test('inr shows rates with decimals and totals as whole rupees', () => {
  assert.strictEqual(inr(5.5), 'Rs 5.5');
  assert.strictEqual(inr(0.5), 'Rs 0.5');
  assert.strictEqual(inr(1250), 'Rs 1,250');
  assert.strictEqual(inr(0), 'Rs 0');
  assert.strictEqual(inr(undefined), 'Rs 0');
  assert.strictEqual(inr(1234567), 'Rs 12,34,567');
});

test('lakh formats pipeline values in lakh', () => {
  assert.strictEqual(lakh(800000), 'Rs 8 lakh');
  assert.strictEqual(lakh(1400000), 'Rs 14 lakh');
  assert.strictEqual(lakh(0), 'Rs 0 lakh');
  assert.strictEqual(lakh(250000), 'Rs 2.5 lakh');
});

test('readOptions: samples and count are opt in, call id is passed through', () => {
  const d = readOptions({});
  assert.strictEqual(d.showSamples, false);
  assert.strictEqual(d.countSamples, false);
  assert.strictEqual(d.call, null);
  const o = readOptions({ samples: '1', count: '1', call: 'abc' });
  assert.strictEqual(o.showSamples, true);
  assert.strictEqual(o.countSamples, true);
  assert.strictEqual(o.call, 'abc');
  assert.strictEqual(readOptions({ samples: '0' }).showSamples, false);
});
