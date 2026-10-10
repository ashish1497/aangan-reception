// Regenerate test/fixtures/golden.json from the current code.
// Only run this when a behaviour change is intended and reviewed.
const fs = require('fs');
const path = require('path');
const { processCall } = require('../lib/process');
for (const k of ['GOOGLE_GEMINI_KEY', 'GOOGLE_GEMINI_KEY_2', 'GOOGLE_GEMINI_KEY_3', 'GEMINI_API_KEY'])
  delete process.env[k];
(async () => {
  const cases = JSON.parse(fs.readFileSync(path.join(__dirname, '../test/fixtures/calls.json'), 'utf8'));
  const out = {};
  for (const c of cases) {
    const r = await processCall(c.payload, { useGemini: false });
    out[c.payload.callId] = {
      status: r.qualification.status,
      secondLook: r.qualification.secondLook || null,
      projectType: r.fields.projectType || null,
      city: r.fields.city || null,
      areaSqft: r.fields.areaSqft ?? null,
      budgetLakh: r.fields.budgetLakh ?? null,
      priceLabel: r.price ? r.price.label : null,
      afterHours: !!r.afterHours,
      booked: !!r.bookedSlot,
    };
  }
  fs.writeFileSync(path.join(__dirname, '../test/fixtures/golden.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out, null, 2));
})();
