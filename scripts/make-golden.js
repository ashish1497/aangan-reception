// Regenerate test/fixtures/golden.json from the current code.
// Only run this when a behaviour change is intended and reviewed against policy/qualified.md.
const fs = require('fs');
const path = require('path');
const { processCall } = require('../lib/process');
for (const k of ['GOOGLE_GEMINI_KEY', 'GOOGLE_GEMINI_KEY_2', 'GOOGLE_GEMINI_KEY_3', 'GEMINI_API_KEY'])
  delete process.env[k];

function summarise(r) {
  const q = r.qualification;
  return {
    status: q.status,
    secondLook: q.secondLook || null,
    nextQuestion: q.nextQuestion,
    criteria: Object.fromEntries(Object.entries(q.criteria).map(([k, v]) => [k, v.result])),
    notes: q.notes,
    projectType: r.fields.projectType || null,
    city: r.fields.city || null,
    scope: r.fields.scope || null,
    timelineWeeks: r.fields.timelineWeeks ?? null,
    budgetLakh: r.fields.budgetLakh ?? null,
    estimateLabel: r.internalEstimate ? r.internalEstimate.label : null,
    guardrails: r.guardrails.flags.map((f) => `${f.code}:${f.severity}`),
    needsReview: r.guardrails.needsReview,
    recordStatus: r.status,
    afterHours: !!r.afterHours,
    booked: !!r.bookedSlot,
  };
}

if (require.main === module) {
  (async () => {
    const cases = JSON.parse(fs.readFileSync(path.join(__dirname, '../test/fixtures/calls.json'), 'utf8'));
    const out = {};
    for (const c of cases)
      out[c.payload.callId] = summarise(await processCall(c.payload, { useGemini: false }));
    fs.writeFileSync(
      path.join(__dirname, '../test/fixtures/golden.json'),
      JSON.stringify(out, null, 2) + '\n',
    );
    console.log(JSON.stringify(out, null, 2));
  })();
}

module.exports = { summarise };
