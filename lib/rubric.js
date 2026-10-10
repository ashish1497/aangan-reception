// REPLACE the VALUES with qualified.md. The STRUCTURE follows what the AI class taught.
// ---------------------------------------------------------------------------
// QUALIFICATION RUBRIC
//
// Structure, from the AI and its Application class (Mihir, Session 5, 7 Oct):
//  1. Three outcomes, not two: qualified, unqualified and a grey state that goes
//     to a human. A good lead wrongly rejected is the higher risk, so anything
//     unclear is grey, never auto-rejected.
//  2. Every decision is explainable: each criterion adds a plain-English reason
//     that the designer and Nikhil can read on the dashboard.
//  3. Unqualified leads get a second look rating ("near miss" or "clear") so
//     good leads wrongly rejected can be found, as the instructor asked for.
//  4. The rubric is built and tested from the seed data (the 40 enquiries),
//     with dummy calls: rude caller, clear qualify, clear disqualify, grey area.
//     scripts/calibrate.js runs this rubric over any folder of transcripts.
//
// Values: every number below is a PLACEHOLDER. qualified.md and pricing.md are on
// the Mesa LMS and were not available here. Do not present them as Aangan's policy.
// ---------------------------------------------------------------------------

const RUBRIC = {
  IS_PLACEHOLDER: true,
  // PLACEHOLDER: cities the studio serves (the case says Pune).
  SERVICE_CITIES: ['pune', 'pimpri-chinchwad'],
  // PLACEHOLDER: minimum area worth a designer's time, by project type.
  MIN_AREA_SQFT: { home: 400, office: 300 },
  // PLACEHOLDER: minimum budget in lakh rupees, applied only if the caller gives one.
  // Case fact for context: average project value is Rs 8 to 14 lakh.
  MIN_BUDGET_LAKH: 5,
  // A value within this fraction below a minimum is grey (human check), not unqualified.
  GREY_BAND: 0.2,
  // Fields a designer needs before the first meeting.
  REQUIRED_FIELDS: ['projectType', 'city', 'areaSqft'],
};

// Plain-English list shown in docs and used by the calibration script.
const CRITERIA = [
  { id: 'hostile', kind: 'human', text: 'Caller hostile or abusive: send to a human, do not auto-assign' },
  { id: 'location', kind: 'hard', text: 'Project is inside the service area' },
  { id: 'area', kind: 'hard-with-grey-band', text: 'Area meets the minimum for the project type' },
  { id: 'budget', kind: 'hard-with-grey-band', text: 'Stated budget meets the minimum (only if given)' },
  {
    id: 'complete',
    kind: 'grey',
    text: 'Project type, city and area are known; otherwise grey for a call-back',
  },
];

/**
 * Score extracted fields against the rubric.
 * Returns { status, reasons, secondLook, rubricIsPlaceholder }
 *  status: 'qualified' | 'grey' | 'unqualified'
 *  secondLook (only when unqualified): 'near_miss' | 'clear'
 *    near_miss = failed only on a soft criterion (area or budget) and is within
 *    half of the threshold, so a human may still want to look.
 */
function scoreLead(f) {
  const reasons = [];
  let hardFail = false;
  let grey = false;
  let failedOnLocation = false;
  let softOnly = true;

  if (f.hostile) {
    grey = true;
    reasons.push('Caller sounded hostile or abusive: route to a human, do not auto-assign a designer');
  }

  if (f.city) {
    if (!RUBRIC.SERVICE_CITIES.includes(String(f.city).toLowerCase())) {
      hardFail = true;
      failedOnLocation = true;
      reasons.push(
        `Location "${f.city}" is outside the service area (placeholder list: ${RUBRIC.SERVICE_CITIES.join(', ')})`,
      );
    } else {
      reasons.push(`Location ${f.locality ? f.locality + ', ' : ''}${f.city} is inside the service area`);
    }
  }

  const minArea = f.projectType ? RUBRIC.MIN_AREA_SQFT[f.projectType] : null;
  let areaRatio = null;
  if (f.areaSqft != null && minArea != null) {
    areaRatio = f.areaSqft / minArea;
    if (f.areaSqft >= minArea) {
      reasons.push(`Area ${f.areaSqft} sq ft meets the ${f.projectType} minimum of ${minArea} (placeholder)`);
    } else if (f.areaSqft >= minArea * (1 - RUBRIC.GREY_BAND)) {
      grey = true;
      reasons.push(
        `Area ${f.areaSqft} sq ft is just under the ${f.projectType} minimum of ${minArea} (placeholder): needs a human call`,
      );
    } else {
      hardFail = true;
      reasons.push(
        `Area ${f.areaSqft} sq ft is below the ${f.projectType} minimum of ${minArea} (placeholder)`,
      );
    }
  }

  let budgetRatio = null;
  if (f.budgetLakh != null) {
    budgetRatio = f.budgetLakh / RUBRIC.MIN_BUDGET_LAKH;
    if (f.budgetLakh >= RUBRIC.MIN_BUDGET_LAKH) {
      reasons.push(
        `Budget about Rs ${f.budgetLakh} lakh meets the minimum of Rs ${RUBRIC.MIN_BUDGET_LAKH} lakh (placeholder)`,
      );
    } else if (f.budgetLakh >= RUBRIC.MIN_BUDGET_LAKH * (1 - RUBRIC.GREY_BAND)) {
      grey = true;
      reasons.push(
        `Budget Rs ${f.budgetLakh} lakh is just under the minimum (placeholder): needs a human call`,
      );
    } else {
      hardFail = true;
      reasons.push(
        `Budget Rs ${f.budgetLakh} lakh is below the minimum of Rs ${RUBRIC.MIN_BUDGET_LAKH} lakh (placeholder)`,
      );
    }
  }

  const missing = RUBRIC.REQUIRED_FIELDS.filter((k) => f[k] == null || f[k] === '');
  if (missing.length && !hardFail) {
    grey = true;
    reasons.push(`Missing on the call: ${missing.join(', ')}. Front desk to call back and fill in`);
  }

  const status = hardFail ? 'unqualified' : grey ? 'grey' : 'qualified';
  const out = { status, reasons, rubricIsPlaceholder: RUBRIC.IS_PLACEHOLDER };

  if (status === 'unqualified') {
    // Second look rating: only soft failures (area or budget), never location.
    softOnly = !failedOnLocation;
    const nearArea = areaRatio != null && areaRatio >= 0.5;
    const nearBudget = budgetRatio != null && budgetRatio >= 0.5;
    const nearMiss = softOnly && (nearArea || nearBudget);
    out.secondLook = nearMiss ? 'near_miss' : 'clear';
    reasons.push(
      nearMiss
        ? 'Second look: near miss on a soft criterion, worth a quick human check before closing'
        : 'Second look: clear miss, no follow-up needed',
    );
  }
  return out;
}

module.exports = { RUBRIC, CRITERIA, scoreLead };
