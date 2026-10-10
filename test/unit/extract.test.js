const test = require('node:test');
const assert = require('node:assert');
const {
  extractFields,
  normaliseTranscript,
  extractLocation,
  extractTimeline,
  extractScope,
} = require('../../lib/extract');

const ex = (s) => extractFields('Caller: ' + s, {});

test('extracts type, city, area and budget from a plain transcript', () => {
  const t =
    'AI: Hello. Caller: I want interiors for my 3 BHK flat in Baner, Pune. About 1400 sq ft. Budget around 15 lakh.';
  const f = extractFields(t, {});
  assert.strictEqual(f.projectType, 'home');
  assert.strictEqual(f.city, 'Pune');
  assert.strictEqual(f.locality, 'Baner');
  assert.strictEqual(f.areaSqft, 1400);
  assert.strictEqual(f.budgetLakh, 15);
  assert.strictEqual(f.bhk, 3);
});

test('does not invent fields that were not said', () => {
  const f = ex('Hi, I am just checking what you do.');
  for (const k of ['areaSqft', 'budgetLakh', 'city', 'timelineWeeks', 'scope', 'outOfScopeType'])
    assert.ok(f[k] == null, k);
  assert.strictEqual(f.realProjectRedFlag, null);
  assert.strictEqual(f.decisionMakerUnclear, null);
});

test('splits agent and caller turns on one line; agent words are not caller facts', () => {
  const n = normaliseTranscript('AI: We work in Mumbai too? Caller: Flat in Kothrud.');
  assert.strictEqual(n.lines.length, 2);
  assert.strictEqual(n.callerText, 'Flat in Kothrud.');
  assert.strictEqual(extractFields('AI: Is it in Mumbai? Caller: No, Kothrud.').city, 'Pune');
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

test('location: Pune and PCMC localities from services.md set the right city', () => {
  assert.deepStrictEqual(extractLocation('flat in Koregaon Park'), {
    locality: 'Koregaon Park',
    city: 'Pune',
    outsideArea: null,
    locationConflict: false,
  });
  assert.strictEqual(extractLocation('in NIBM').locality, 'NIBM');
  assert.strictEqual(extractLocation('Pimple Nilakh').city, 'Pimpri-Chinchwad');
  assert.strictEqual(extractLocation('Hinjewadi phase 1').city, 'Pimpri-Chinchwad');
  assert.strictEqual(extractLocation('Ravet').city, 'Pimpri-Chinchwad');
  assert.strictEqual(extractLocation('somewhere in PCMC').city, 'Pimpri-Chinchwad');
  assert.strictEqual(extractLocation('Pimpri-Chinchwad').city, 'Pimpri-Chinchwad');
  assert.strictEqual(extractLocation('Pimpri-Chinchwad').locality, null);
  assert.strictEqual(extractLocation('just Pune').city, 'Pune');
});

test('location: excluded places are recognised; a mix is not guessed', () => {
  for (const p of ['Talegaon', 'Lonavala', 'Nashik', 'Mumbai', 'Bangalore']) {
    const l = extractLocation('site is in ' + p);
    assert.strictEqual(l.city, p);
    assert.strictEqual(l.outsideArea, p);
  }
  const mix = extractLocation('I live in Baner but the bungalow is in Lonavala');
  assert.strictEqual(mix.city, null);
  assert.strictEqual(mix.locationConflict, true);
  assert.strictEqual(extractLocation('a nice place').city, null);
});

test('timeline: weeks parsed from common phrases, null when unknown or vague', () => {
  assert.strictEqual(extractTimeline('need it in 3 weeks').timelineWeeks, 3);
  assert.strictEqual(extractTimeline('within two months').timelineWeeks, 8.7);
  assert.strictEqual(extractTimeline('by next month').timelineWeeks, 4);
  assert.strictEqual(extractTimeline('in a month').timelineWeeks, 4.3);
  assert.strictEqual(extractTimeline('done in 10 days').timelineWeeks, 1.4);
  assert.strictEqual(extractTimeline('complete in six months').timelineWeeks, 26);
  assert.strictEqual(extractTimeline('in the next couple of weeks').timelineWeeks, 2);
  assert.strictEqual(extractTimeline('asap').timelineWeeks, null);
  assert.strictEqual(extractTimeline('asap').timeline, 'asap');
  assert.strictEqual(extractTimeline('in a few weeks').timelineWeeks, null);
  assert.strictEqual(extractTimeline('we have lived here for 10 years').timelineWeeks, null);
  assert.strictEqual(extractTimeline('no hurry').timelineFlexible, true);
  assert.strictEqual(extractTimeline('hello').timeline, null);
});

test('scope: single room, multi room, full, or null', () => {
  assert.strictEqual(extractScope('just the master bedroom'), 'single_room');
  assert.strictEqual(extractScope('redo our living room'), 'single_room');
  assert.strictEqual(extractScope('the kitchen and the living room'), 'multi_room');
  assert.strictEqual(extractScope('two bedrooms'), 'multi_room');
  assert.strictEqual(extractScope('3 BHK flat'), 'full');
  assert.strictEqual(extractScope('the whole house'), 'full');
  assert.strictEqual(extractScope('only the kitchen of my 2 BHK'), 'single_room');
  assert.strictEqual(extractScope('an enquiry'), null);
});

test('out of scope types', () => {
  const cases = {
    'interiors for our new restaurant': 'restaurant',
    'a boutique hotel in Baner': 'hotel',
    'a hospitality project': 'hospitality',
    'fitting out a gym': 'gym',
    'my retail shop in Deccan': 'retail',
    'we need an architect to build a new floor': 'architecture_structural',
    'only Vastu consultation for my flat': 'vastu_only',
    'I only need furniture sourcing for my flat': 'furniture_only',
    'just advise me on colours for my flat': 'decor_only',
    'help us rearrange the furniture': 'decor_only',
  };
  for (const [s, want] of Object.entries(cases)) assert.strictEqual(ex(s).outOfScopeType, want, s);
  assert.strictEqual(
    ex('3 BHK flat in Baner, our architect has finished, we want interiors').outOfScopeType,
    null,
  );
  assert.strictEqual(ex('design with Vastu in mind').outOfScopeType, null);
});

test('real project red flags', () => {
  for (const s of [
    'I am just looking for ideas',
    'can you come and advise',
    'I want a second opinion',
    'I will execute it myself',
    'we will do the execution ourselves',
    'I only want suggestions',
  ])
    assert.ok(ex(s).realProjectRedFlag, s);
  assert.strictEqual(ex('full redesign with execution').realProjectRedFlag, null);
});

test('decision maker unclear, unless the caller says they are authorised', () => {
  assert.ok(ex('I am doing initial research').decisionMakerUnclear);
  assert.ok(ex('this is for my in-laws').decisionMakerUnclear);
  assert.ok(ex('just exploring for someone').decisionMakerUnclear);
  assert.ok(ex("my wife wants this but she's not available").decisionMakerUnclear);
  assert.strictEqual(
    ex("my wife wants this, she's not available, but I am authorised").decisionMakerUnclear,
    null,
  );
  assert.strictEqual(ex('they are not available but they have authorized me').decisionMakerUnclear, null);
});

test('price questions and wall changes are detected', () => {
  assert.strictEqual(ex('How much will it cost?').askedAboutPrice, true);
  assert.strictEqual(ex('What is your per sq ft rate?').askedAboutPrice, true);
  assert.strictEqual(ex('Budget is 10 lakh').askedAboutPrice, false);
  assert.strictEqual(ex('we want to move a wall').wallChangesMentioned, true);
});

test('agent speaker names: Sai is a caller, not the AI', () => {
  const n = normaliseTranscript([
    { speaker: 'Sai', text: 'Flat in Aundh' },
    { speaker: 'assistant', text: 'Thanks' },
  ]);
  assert.strictEqual(n.callerText, 'Flat in Aundh');
  assert.strictEqual(n.agentText, 'Thanks');
});
