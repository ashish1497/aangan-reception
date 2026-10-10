const test = require('node:test');
const assert = require('node:assert');
const { scoreLead, RUBRIC, CRITERIA } = require('../../lib/rubric');

// A lead that passes all five criteria.
const good = {
  projectType: 'home',
  scope: 'full',
  bhk: 3,
  city: 'Pune',
  locality: 'Baner',
  areaSqft: 1400,
  timeline: 'in three months',
  timelineWeeks: 13,
  budgetLakh: null,
};
const crit = (f, id) => scoreLead(f).criteria[id].result;

test('five criteria, in the order of policy/qualified.md', () => {
  assert.deepStrictEqual(
    CRITERIA.map((c) => c.id),
    ['realProject', 'serviceArea', 'timeline', 'budget', 'decisionMaker'],
  );
  const r = scoreLead(good);
  assert.strictEqual(r.status, 'qualified');
  assert.strictEqual(r.nextQuestion, null);
  assert.deepStrictEqual(r.notes, []);
  assert.strictEqual(r.reasons.length, 5);
});

// 1. Real project
test('criterion 1 real project: pass, fail, unclear', () => {
  assert.strictEqual(crit(good, 'realProject'), 'pass');
  assert.strictEqual(crit({ ...good, realProjectRedFlag: 'just looking for ideas' }, 'realProject'), 'fail');
  assert.strictEqual(crit({ ...good, projectType: null, scope: null }, 'realProject'), 'unclear');
});

test('criterion 1: out-of-scope types and service-only requests fail', () => {
  for (const t of [...RUBRIC.EXCLUDED_PROJECT_TYPES, ...RUBRIC.EXCLUDED_SERVICE_ONLY])
    assert.strictEqual(crit({ ...good, outOfScopeType: t }, 'realProject'), 'fail', t);
});

test('criterion 1: commercial above about 3000 sq ft fails, just above is noted not failed', () => {
  const office = { ...good, projectType: 'office', scope: null };
  assert.strictEqual(crit({ ...office, areaSqft: 5000 }, 'realProject'), 'fail');
  const near = scoreLead({ ...office, areaSqft: 3100 });
  assert.strictEqual(near.criteria.realProject.result, 'pass');
  assert.ok(near.notes.some((n) => /top of our range/.test(n)));
});

// 2. Service area
test('criterion 2 service area: pass, fail, unclear', () => {
  assert.strictEqual(crit(good, 'serviceArea'), 'pass');
  assert.strictEqual(crit({ ...good, city: 'Pimpri-Chinchwad', locality: 'Ravet' }, 'serviceArea'), 'pass');
  assert.strictEqual(crit({ ...good, city: 'Nashik', outsideArea: 'Nashik' }, 'serviceArea'), 'fail');
  assert.strictEqual(crit({ ...good, city: null, locality: null }, 'serviceArea'), 'unclear');
  assert.strictEqual(
    crit({ ...good, city: null, locationConflict: true, outsideArea: 'Mumbai' }, 'serviceArea'),
    'unclear',
  );
});

// 3. Timeline
test('criterion 3 timeline: pass, fail, unclear', () => {
  assert.strictEqual(crit(good, 'timeline'), 'pass');
  assert.strictEqual(crit({ ...good, timelineWeeks: 3, timeline: 'in 3 weeks' }, 'timeline'), 'fail');
  assert.strictEqual(crit({ ...good, timelineWeeks: null, timeline: null }, 'timeline'), 'unclear');
  assert.strictEqual(crit({ ...good, timelineWeeks: null, timeline: 'asap' }, 'timeline'), 'unclear');
  assert.strictEqual(
    crit({ ...good, timelineWeeks: null, timeline: 'no hurry', timelineFlexible: true }, 'timeline'),
    'pass',
  );
});

test('criterion 3: minimum lead time boundary and tight-timeline note', () => {
  const min = RUBRIC.MIN_LEAD_TIME_WEEKS;
  assert.strictEqual(crit({ ...good, timelineWeeks: min - 0.1 }, 'timeline'), 'fail');
  const atMin = scoreLead({ ...good, timelineWeeks: min });
  assert.strictEqual(atMin.status, 'qualified');
  assert.ok(atMin.notes.some((n) => /Tight timeline/.test(n)));
});

// 4. Budget
test('criterion 4 budget: pass, fail, unclear', () => {
  assert.strictEqual(crit({ ...good, budgetLakh: 30 }, 'budget'), 'pass');
  // 1400 sq ft at Rs 1800 = Rs 25.2 lakh; half is 12.6
  assert.strictEqual(crit({ ...good, budgetLakh: 10 }, 'budget'), 'fail');
  assert.strictEqual(crit({ ...good, budgetLakh: 15 }, 'budget'), 'unclear');
});

test('criterion 4: budget never volunteered is qualified', () => {
  assert.strictEqual(crit({ ...good, budgetLakh: null }, 'budget'), 'pass');
  assert.strictEqual(scoreLead({ ...good, budgetLakh: null }).status, 'qualified');
});

test('criterion 4: Rs 1 to 1.5 lakh for a full flat of unknown size fails (example in qualified.md)', () => {
  const r = scoreLead({ ...good, areaSqft: null, budgetLakh: 1.5 });
  assert.strictEqual(r.criteria.budget.result, 'fail');
  assert.strictEqual(r.status, 'unqualified');
  assert.strictEqual(r.secondLook, 'near_miss');
});

test('criterion 4: single room floor is Rs 3.5 lakh, clear fail under half', () => {
  const room = { ...good, scope: 'single_room', areaSqft: null };
  assert.strictEqual(crit({ ...room, budgetLakh: 4 }, 'budget'), 'pass');
  assert.strictEqual(crit({ ...room, budgetLakh: 2.5 }, 'budget'), 'unclear');
  assert.strictEqual(crit({ ...room, budgetLakh: 1.5 }, 'budget'), 'fail');
});

// 5. Decision maker
test('criterion 5 decision maker: pass, unclear (never fails from the call alone)', () => {
  assert.strictEqual(crit(good, 'decisionMaker'), 'pass');
  assert.strictEqual(crit({ ...good, decisionMakerUnclear: 'initial research' }, 'decisionMaker'), 'unclear');
});

// Boundary rules
test('boundary: unclear on 1, 2 or 3 is grey with one direct question', () => {
  const a = scoreLead({ ...good, projectType: null, scope: null });
  assert.strictEqual(a.status, 'grey');
  assert.strictEqual(a.nextQuestion, RUBRIC.QUESTIONS.realProject);
  const b = scoreLead({ ...good, city: null, locality: null });
  assert.strictEqual(b.status, 'grey');
  assert.strictEqual(b.nextQuestion, RUBRIC.QUESTIONS.serviceArea);
  const c = scoreLead({ ...good, timelineWeeks: null, timeline: null });
  assert.strictEqual(c.status, 'grey');
  assert.strictEqual(c.nextQuestion, 'When would you need the project complete?');
  const both = scoreLead({ ...good, city: null, timelineWeeks: null, timeline: null });
  assert.strictEqual(both.nextQuestion, RUBRIC.QUESTIONS.serviceArea, 'only one question, the first');
});

test('boundary: unclear on 4 or 5 is qualified with handoff notes', () => {
  const r = scoreLead({ ...good, budgetLakh: 15, decisionMakerUnclear: 'for my in-laws' });
  assert.strictEqual(r.status, 'qualified');
  assert.strictEqual(r.notes.length, 2);
  assert.strictEqual(r.nextQuestion, null);
});

test('boundary: any fail is unqualified; two or more fails says so', () => {
  const one = scoreLead({ ...good, city: 'Mumbai', outsideArea: 'Mumbai' });
  assert.strictEqual(one.status, 'unqualified');
  assert.strictEqual(one.secondLook, 'clear');
  assert.ok(!one.reasons.join(' ').includes('Two or more'));
  const two = scoreLead({
    ...good,
    city: 'Mumbai',
    outsideArea: 'Mumbai',
    timelineWeeks: 2,
    timeline: 'in 2 weeks',
  });
  assert.strictEqual(two.status, 'unqualified');
  assert.ok(two.reasons.join(' ').includes('Two or more criteria fail'));
  assert.strictEqual(two.secondLook, 'clear');
});

test('second look: near miss only when the single fail is budget or timeline', () => {
  assert.strictEqual(
    scoreLead({ ...good, timelineWeeks: 3, timeline: 'in 3 weeks' }).secondLook,
    'near_miss',
  );
  assert.strictEqual(scoreLead({ ...good, budgetLakh: 2 }).secondLook, 'near_miss');
  assert.strictEqual(scoreLead({ ...good, realProjectRedFlag: 'second opinion' }).secondLook, 'clear');
});

test('fail beats unclear: a failed lead with missing info is unqualified, not grey', () => {
  const r = scoreLead({
    ...good,
    city: 'Nashik',
    outsideArea: 'Nashik',
    timelineWeeks: null,
    timeline: null,
  });
  assert.strictEqual(r.status, 'unqualified');
  assert.strictEqual(r.nextQuestion, null);
});

test('hostile caller is grey and routed to a human', () => {
  const r = scoreLead({ ...good, hostile: true });
  assert.strictEqual(r.status, 'grey');
  assert.ok(r.reasons.join(' ').includes('hostile'));
});

test('does NOT disqualify: unknown style, after hours, asking price, single room, rented flat', () => {
  // Style/materials/after hours/rented are not inputs to the rubric at all; pricing asks are only a note.
  assert.strictEqual(scoreLead({ ...good, askedAboutPrice: true }).status, 'qualified');
  assert.strictEqual(scoreLead({ ...good, scope: 'single_room', areaSqft: null }).status, 'qualified');
  assert.strictEqual(scoreLead({ ...good, style: null, materials: null, rented: true }).status, 'qualified');
});

test('wall changes are noted for the designer, not disqualifying', () => {
  const r = scoreLead({ ...good, wallChangesMentioned: true });
  assert.strictEqual(r.status, 'qualified');
  assert.ok(r.notes.some((n) => /walls/.test(n)));
});

test('numbers come from policy/rubric.json', () => {
  const policy = require('../../policy/rubric.json');
  assert.strictEqual(RUBRIC.MIN_LEAD_TIME_WEEKS, policy.timeline.minLeadTimeWeeks);
  assert.strictEqual(RUBRIC.MIN_LEAD_TIME_WEEKS, 6);
  assert.strictEqual(RUBRIC.BUDGET.singleRoomLowLakh, 3.5);
  assert.strictEqual(RUBRIC.BUDGET.homePerSqftLow, 1800);
  assert.strictEqual(RUBRIC.BUDGET.officePerSqftLow, 1200);
  assert.strictEqual(RUBRIC.BUDGET.clearFailRatio, 0.5);
  assert.deepStrictEqual(RUBRIC.SERVED_CITIES, ['Pune', 'Pimpri-Chinchwad']);
});

test('no reason text mentions placeholders or build internals', () => {
  const variants = [
    good,
    { ...good, city: 'Nashik', outsideArea: 'Nashik', budgetLakh: 1 },
    { ...good, projectType: null, scope: null, city: null, timelineWeeks: null, timeline: null },
    { ...good, decisionMakerUnclear: 'for my in-laws', budgetLakh: 15 },
  ];
  for (const f of variants) {
    const r = scoreLead(f);
    assert.ok(!/placeholder|assumption|build/i.test(r.reasons.concat(r.notes).join(' ')));
  }
});
