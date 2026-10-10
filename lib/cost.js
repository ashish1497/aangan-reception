// ---------------------------------------------------------------------------
// COST ASSUMPTIONS: replace with real Vaani and Gemini pricing.
// These are NOT quoted prices. They exist so the dashboard can show the
// shape of the calculation. Override with env vars without editing code.
// ---------------------------------------------------------------------------

const COST = {
  IS_ASSUMPTION: true,
  // ASSUMPTION: rupees per voice minute charged by Vaani. Replace with real rate.
  VOICE_COST_PER_MIN: Number(process.env.VOICE_COST_PER_MIN || 6),
  // ASSUMPTION: rupees of LLM (Gemini) usage per call for extraction and brief.
  LLM_COST_PER_CALL: Number(process.env.LLM_COST_PER_CALL || 0.5),
  // Case fact: average project value Rs 8 to 14 lakh.
  PROJECT_VALUE_LOW: 800000,
  PROJECT_VALUE_HIGH: 1400000
};

function callCost(durationSec) {
  const minutes = Math.max(0, Number(durationSec) || 0) / 60;
  return Math.round((minutes * COST.VOICE_COST_PER_MIN + COST.LLM_COST_PER_CALL) * 100) / 100;
}

module.exports = { COST, callCost };
