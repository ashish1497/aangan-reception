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

const dir = process.argv[2] || 'seed/enquiries';
const useGemini = process.argv.includes('--gemini');

function load(file) {
  const raw = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.json')) {
    const j = JSON.parse(raw);
    return { callId: path.basename(file), transcript: j.transcript || j.text || '' };
  }
  return { callId: path.basename(file), transcript: raw };
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
    });
  }
  console.table(rows);
  console.log(counts, `of ${rows.length}`);
  const review = rows.filter((r) => r.status === 'grey' || r.second === 'near_miss');
  console.log(
    `\nReview by hand (${review.length}): grey or near-miss. Compare each with Nikhil's qualified.md and adjust policy/rubric.json.`,
  );
  review.forEach((r) => console.log(' -', r.file, r.status, r.second));
})();
