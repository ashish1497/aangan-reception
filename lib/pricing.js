// Price ranges the desk may mention. Rates and wording live in policy/rubric.json
// (described in policy/pricing.md). The desk gives a range, never one fixed number.

const fs = require('fs');
const path = require('path');

const POLICY = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'policy', 'rubric.json'), 'utf8'));

const PRICING = {
  POLICY_FILE: 'policy/pricing.md',
  RATE_PER_SQFT: POLICY.ratePerSqft,
  DISCLAIMER: POLICY.priceDisclaimer,
};

function formatLakh(rupees) {
  return 'Rs ' + (rupees / 100000).toFixed(1).replace(/\.0$/, '') + ' lakh';
}

/** Returns an indicative range, or null when area or project type is unknown. */
function priceRange(f) {
  if (!f.projectType || !f.areaSqft) return null;
  const r = PRICING.RATE_PER_SQFT[f.projectType];
  if (!r) return null;
  const low = f.areaSqft * r.low;
  const high = f.areaSqft * r.high;
  return {
    low,
    high,
    label: `${formatLakh(low)} to ${formatLakh(high)} (indicative)`,
    disclaimer: PRICING.DISCLAIMER,
  };
}

module.exports = { PRICING, priceRange };
