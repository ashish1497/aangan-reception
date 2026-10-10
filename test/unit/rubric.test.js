const test = require('node:test');
const assert = require('node:assert');
const { scoreLead, RUBRIC } = require('../../lib/rubric');

const base = { projectType: 'home', city: 'Pune', areaSqft: 1200 };

test('qualified when location, area and budget all pass', () => {
  const r = scoreLead({ ...base, budgetLakh: 10 });
  assert.strictEqual(r.status, 'qualified');
  assert.ok(r.reasons.length >= 3);
});

test('unqualified outside the service area, with a clear second look', () => {
  const r = scoreLead({ ...base, city: 'Nashik' });
  assert.strictEqual(r.status, 'unqualified');
  assert.strictEqual(r.secondLook, 'clear');
});

test('grey when area is just under the minimum', () => {
  const r = scoreLead({ ...base, areaSqft: RUBRIC.MIN_AREA_SQFT.home - 20 });
  assert.strictEqual(r.status, 'grey');
});

test('unqualified near miss when area is well under but over half of minimum', () => {
  const r = scoreLead({ ...base, areaSqft: Math.round(RUBRIC.MIN_AREA_SQFT.home * 0.6) });
  assert.strictEqual(r.status, 'unqualified');
  assert.strictEqual(r.secondLook, 'near_miss');
});

test('grey, never auto-rejected, when required fields are missing', () => {
  const r = scoreLead({ projectType: 'home', city: 'Pune' });
  assert.strictEqual(r.status, 'grey');
  assert.ok(r.reasons.join(' ').includes('areaSqft'));
});

test('hostile caller is grey and routed to a human', () => {
  const r = scoreLead({ ...base, hostile: true });
  assert.strictEqual(r.status, 'grey');
});

test('budget below minimum is unqualified; just under is grey', () => {
  assert.strictEqual(scoreLead({ ...base, budgetLakh: 1 }).status, 'unqualified');
  assert.strictEqual(scoreLead({ ...base, budgetLakh: RUBRIC.MIN_BUDGET_LAKH - 0.5 }).status, 'grey');
});

test('thresholds come from policy/rubric.json', () => {
  const policy = require('../../policy/rubric.json');
  assert.strictEqual(RUBRIC.MIN_BUDGET_LAKH, policy.minBudgetLakh);
  assert.deepStrictEqual(RUBRIC.MIN_AREA_SQFT, policy.minAreaSqft);
  assert.deepStrictEqual(RUBRIC.SERVICE_CITIES, policy.serviceCities);
});

test('no reason text mentions placeholders or build internals', () => {
  const r = scoreLead({ ...base, areaSqft: 100, budgetLakh: 1 });
  assert.ok(!/placeholder|assumption|build/i.test(r.reasons.join(' ')));
});

test('missing city does not unqualify', () => {
  const r = scoreLead({ projectType: 'home', areaSqft: 1200 });
  assert.notStrictEqual(r.status, 'unqualified');
});
