// GET /api/stats : KPIs. Demo calls are EXCLUDED unless ?includeDemo=1.
const { sendJson, getQuery } = require('../lib/http');
const store = require('../lib/store');
const { COST } = require('../lib/cost');
const { RUBRIC } = require('../lib/rubric');
const { PRICING } = require('../lib/pricing');

function computeStats(records) {
  const n = records.length;
  const count = (fn) => records.filter(fn).length;
  const qualified = count((r) => r.qualification.status === 'qualified');
  const totalCost = Math.round(records.reduce((s, r) => s + (r.costInr || 0), 0) * 100) / 100;
  const totalMinutes = Math.round(records.reduce((s, r) => s + (r.durationSec || 0), 0) / 6) / 10;
  return {
    callsAnswered: n,
    answeredWithin5Min: count((r) => r.answeredWithin5Min),
    qualified,
    grey: count((r) => r.qualification.status === 'grey'),
    unqualified: count((r) => r.qualification.status === 'unqualified'),
    nearMiss: count((r) => r.qualification.secondLook === 'near_miss'),
    needsHumanReview: count(
      (r) => r.qualification.status === 'grey' || r.qualification.secondLook === 'near_miss',
    ),
    answeredWithin5MinShare: n ? Math.round((count((r) => r.answeredWithin5Min) / n) * 1000) / 10 : 0,
    qualifiedShare: n ? Math.round((qualified / n) * 1000) / 10 : 0,
    bookedShareOfQualified: qualified
      ? Math.round(
          (count((r) => !!r.bookedSlot && r.qualification.status === 'qualified') / qualified) * 1000,
        ) / 10
      : 0,
    bookedOnCall: count((r) => !!r.bookedSlot),
    afterHours: count((r) => r.afterHours),
    afterHoursShare: n ? Math.round((count((r) => r.afterHours) / n) * 1000) / 10 : 0,
    cost: {
      totalInr: totalCost,
      perCallInr: n ? Math.round((totalCost / n) * 100) / 100 : 0,
      totalVoiceMinutes: totalMinutes,
      voiceCostPerMin: COST.VOICE_COST_PER_MIN,
      llmCostPerCall: COST.LLM_COST_PER_CALL,
      isAssumption: COST.IS_ASSUMPTION,
    },
    value: {
      qualifiedLeads: qualified,
      pipelineLowInr: qualified * COST.PROJECT_VALUE_LOW,
      pipelineHighInr: qualified * COST.PROJECT_VALUE_HIGH,
      caveat:
        'Pipeline value if converted. Conversion rate is unknown. The 4x figure in the case applies only to answer speed, so no revenue claim is made.',
    },
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Use GET' });
  const q = getQuery(req);
  const includeDemo = q.includeDemo === '1' || q.includeDemo === 'true';
  try {
    const all = await store.listRecords(includeDemo ? q : { ...q, demo: '0' });
    const records = includeDemo ? all : all.filter((r) => !r.demo);
    return sendJson(res, 200, {
      storage: store.backend(),
      includesDemo: includeDemo && store.demoEnabled(q),
      placeholders: {
        rubric: RUBRIC.IS_PLACEHOLDER,
        pricing: PRICING.IS_PLACEHOLDER,
        cost: COST.IS_ASSUMPTION,
      },
      ...computeStats(records),
    });
  } catch (e) {
    return sendJson(res, 500, { error: 'Could not compute stats', detail: e.message });
  }
};

module.exports.computeStats = computeStats;
