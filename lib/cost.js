// What a call costs to run. Rates come from env vars so they can follow the real bill.
// VOICE_COST_PER_MIN: rupees per voice minute on Vaani. LLM_COST_PER_CALL: rupees of
// model usage per call for extraction and the brief.

const COST = {
  VOICE_COST_PER_MIN: Number(process.env.VOICE_COST_PER_MIN || 5.5),
  LLM_COST_PER_CALL: Number(process.env.LLM_COST_PER_CALL || 0.5),
  // Case fact: average project value Rs 8 to 14 lakh.
  PROJECT_VALUE_LOW: 800000,
  PROJECT_VALUE_HIGH: 1400000,
};

function callCost(durationSec) {
  const minutes = Math.max(0, Number(durationSec) || 0) / 60;
  return Math.round((minutes * COST.VOICE_COST_PER_MIN + COST.LLM_COST_PER_CALL) * 100) / 100;
}

module.exports = { COST, callCost };
