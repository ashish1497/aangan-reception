const test = require('node:test');
const assert = require('node:assert');
const { cleanEnv } = require('../helpers');
cleanEnv();
const { callCost, COST } = require('../../lib/cost');

test('cost is minutes times rate plus LLM cost', () => {
  const expected = Math.round((2 * COST.VOICE_COST_PER_MIN + COST.LLM_COST_PER_CALL) * 100) / 100;
  assert.strictEqual(callCost(120), expected);
});

test('zero or invalid duration costs only the LLM part', () => {
  assert.strictEqual(callCost(0), COST.LLM_COST_PER_CALL);
  assert.strictEqual(callCost('abc'), COST.LLM_COST_PER_CALL);
  assert.strictEqual(callCost(-30), COST.LLM_COST_PER_CALL);
});

test('project value matches the case figures', () => {
  assert.strictEqual(COST.PROJECT_VALUE_LOW, 800000);
  assert.strictEqual(COST.PROJECT_VALUE_HIGH, 1400000);
});
