// Pricing, per policy/pricing.md.
// The agent must NEVER say a price, range or per-sq-ft figure to a caller. The only
// caller-facing pricing line is the scripted deflection below.
// internalEstimate() is for the designer only. Every estimate carries internalOnly:true
// and the label "Internal estimate, never quoted to the client".
// Figures live in policy/rubric.json.

const fs = require('fs');
const path = require('path');

const POLICY = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'policy', 'rubric.json'), 'utf8'));
const TABLE = POLICY.internalPricing;

const PRICING = {
  POLICY_FILE: 'policy/pricing.md',
  INTERNAL_LABEL: TABLE.label,
  DEFLECTION: POLICY.pricingDeflection,
  TABLE,
};

function formatLakh(rupees) {
  return 'Rs ' + (rupees / 100000).toFixed(1).replace(/\.0$/, '') + ' lakh';
}

/**
 * Designer-only estimate, or null when there is not enough to work from.
 * Uses the two lower tiers of the internal table (standard to premium, or basic to mid-range).
 */
function internalEstimate(f) {
  let low;
  let high;
  let basis;
  if (f.scope === 'single_room') {
    low = TABLE.singleRoomLakh.low * 100000;
    high = TABLE.singleRoomLakh.high * 100000;
    basis = 'single room, all-in';
  } else if (f.areaSqft && f.projectType === 'home') {
    const t = TABLE.residentialPerSqft;
    low = f.areaSqft * t.standard.low;
    high = f.areaSqft * t.premium.high;
    basis = `${f.areaSqft} sq ft, standard to premium specification`;
  } else if (f.areaSqft && f.projectType === 'office') {
    const t = TABLE.commercialPerSqft;
    low = f.areaSqft * t.basic.low;
    high = f.areaSqft * t.mid.high;
    basis = `${f.areaSqft} sq ft, basic fitout to mid-range office`;
  } else {
    return null;
  }
  return {
    internalOnly: true,
    low,
    high,
    basis,
    label: `${PRICING.INTERNAL_LABEL}: ${formatLakh(low)} to ${formatLakh(high)} (${basis})`,
  };
}

/** The only thing the agent may say when asked about price. */
function pricingDeflection() {
  return PRICING.DEFLECTION;
}

module.exports = { PRICING, internalEstimate, pricingDeflection, formatLakh };
