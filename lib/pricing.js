// REPLACE with qualified.md and pricing.md
// ---------------------------------------------------------------------------
// PER-SQUARE-FOOT PRICING: every rate in this file is a PLACEHOLDER.
// The real numbers live in pricing.md on the Mesa LMS, which was not
// available when this was built. pricing.md says pricing is
// "indicative only, varies by site", so the system only ever gives a range
// and always attaches the disclaimer below.
// ---------------------------------------------------------------------------

const PRICING = {
  IS_PLACEHOLDER: true,
  // PLACEHOLDER rates in rupees per sq ft. NOT Aangan Studio's real pricing.
  RATE_PER_SQFT: {
    home: { low: 1000, high: 2000 },
    office: { low: 900, high: 1800 }
  },
  DISCLAIMER:
    'Indicative only, varies by site. A designer confirms the real estimate after a site visit. ' +
    '(Rates in this build are PLACEHOLDERS until pricing.md is copied in.)'
};

function formatLakh(rupees) {
  return 'Rs ' + (rupees / 100000).toFixed(1).replace(/\.0$/, '') + ' lakh';
}

/** Returns an indicative range or null when area or project type is unknown. */
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
    isPlaceholder: PRICING.IS_PLACEHOLDER
  };
}

module.exports = { PRICING, priceRange, formatLakh };
