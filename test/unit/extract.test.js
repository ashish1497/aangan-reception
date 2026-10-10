const test = require('node:test');
const assert = require('node:assert');
const { extractFields, normaliseTranscript } = require('../../lib/extract');

test('extracts type, city, area and budget from a plain transcript', () => {
  const t =
    'AI: Hello. Caller: I want interiors for my 3 BHK flat in Baner, Pune. About 1400 sq ft. Budget around 15 lakh.';
  const f = extractFields(t, {});
  assert.strictEqual(f.projectType, 'home');
  assert.strictEqual(f.city, 'Pune');
  assert.strictEqual(f.areaSqft, 1400);
  assert.strictEqual(f.budgetLakh, 15);
});

test('does not invent fields that were not said', () => {
  const f = extractFields('Caller: Hi, I am just checking what you do.', {});
  assert.ok(f.areaSqft == null);
  assert.ok(f.budgetLakh == null);
});

test('accepts an array transcript', () => {
  const f = extractFields(
    [
      { speaker: 'AI', text: 'Hello' },
      { speaker: 'Caller', text: 'Office space in Pune, 600 sq ft' },
    ],
    {},
  );
  assert.strictEqual(f.projectType, 'office');
  assert.strictEqual(f.areaSqft, 600);
});

test('normaliseTranscript returns text and lines for string and array input', () => {
  const a = normaliseTranscript('Caller: hi');
  const b = normaliseTranscript([{ speaker: 'AI', text: 'hello' }]);
  assert.ok(a.fullText.includes('hi'));
  assert.ok(Array.isArray(b.lines) && b.lines.length === 1);
});
