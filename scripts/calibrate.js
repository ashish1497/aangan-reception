// Run the rubric over a folder of enquiry transcripts and print what it decides.
// This is how the class said to build the rubric: use the seed data (the 40
// enquiries) and review where the rubric is wrong.
//
//   node scripts/calibrate.js seed/enquiries            (rules only)
//   node scripts/calibrate.js seed/enquiries --gemini   (also use Gemini, needs keys in env)
//
// Input: .txt or .md files with the call as plain text, or .json with
// {"transcript": "..."}. One call per file. Nothing is stored or sent.

const fs = require('fs');
const path = require('path');
const { processCall } = require('../lib/process');

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const dir = process.argv[2] || 'seed/enquiries';
const useGemini = process.argv.includes('--gemini');

function load(file) {
  const raw = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.json')) {
    const j = JSON.parse(raw);
    return { callId: path.basename(file), transcript: j.transcript || j.text || '' };
  }
  // Drop a header line such as "T03 · Phone · 3 September · 4:15pm".
  const head = raw.match(/^[TWF]\d{2}\s·[^\n]*\n/);
  const body = raw.replace(/^[TWF]\d{2}\s·[^\n]*\n/, '');
  let startedAt;
  const d =
    head &&
    head[0].match(
      /(\d{1,2})(?:[–-]\d{1,2})?\s+(January|February|March|April|May|June|July|August|September|October|November|December)/,
    );
  if (d) startedAt = new Date(Date.UTC(2026, MONTHS.indexOf(d[2]), Number(d[1]), 6)).toISOString();
  return { callId: path.basename(file), transcript: body, startedAt };
}

(async () => {
  if (!fs.existsSync(dir)) {
    console.error(`Folder not found: ${dir}`);
    process.exit(1);
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.(txt|md|json)$/i.test(f) && f.toLowerCase() !== 'readme.md');
  if (!files.length) {
    console.log(`No transcripts in ${dir}. Put the enquiry files there (see seed/README.md).`);
    return;
  }
  const counts = { qualified: 0, grey: 0, unqualified: 0 };
  const rows = [];
  for (const f of files) {
    const rec = await processCall(load(path.join(dir, f)), { useGemini });
    const q = rec.qualification;
    counts[q.status]++;
    rows.push({
      file: f,
      status: q.status,
      second: q.secondLook || '',
      type: rec.fields.projectType || '?',
      city: rec.fields.city || '?',
      area: rec.fields.areaSqft ?? '?',
      budget: rec.fields.budgetLakh ?? '?',
      weeks: rec.fields.timelineWeeks ?? '?',
      '1 real': q.criteria.realProject.result,
      '2 area': q.criteria.serviceArea.result,
      '3 time': q.criteria.timeline.result,
      '4 budget': q.criteria.budget.result,
      '5 decider': q.criteria.decisionMaker.result,
      guard: rec.guardrails.flags
        .filter((g) => g.severity !== 'info')
        .map((g) => g.code)
        .join(' '),
      ask: q.nextQuestion || '',
    });
  }
  console.table(rows);
  console.log(counts, `of ${rows.length}`);
  const review = rows.filter((r) => r.status === 'grey' || r.second === 'near_miss');
  console.log(
    `\nReview by hand (${review.length}): grey or near-miss. Compare each with Nikhil's qualified.md; numbers live in policy/rubric.json.`,
  );
  review.forEach((r) => console.log(' -', r.file, r.status, r.second));
})();
