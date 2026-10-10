// Qualification rubric. The policy is written in policy/qualified.md and the numbers
// live in policy/rubric.json. Edit those, not this file.
//
// How it decides:
//  - Three outcomes: qualified, grey and unqualified. A good lead wrongly turned away is the
//    costly mistake, so anything unclear is grey and goes to a person.
//  - Every decision carries plain-English reasons the designer and Nikhil can read.
//  - Unqualified calls get a second look rating (near miss or clear).

const fs = require('fs');
const path = require('path');

const POLICY = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'policy', 'rubric.json'), 'utf8'));

const RUBRIC = {
  POLICY_FILE: 'policy/qualified.md',
  SERVICE_CITIES: POLICY.serviceCities,
  MIN_AREA_SQFT: POLICY.minAreaSqft,
  MIN_BUDGET_LAKH: POLICY.minBudgetLakh,
  GREY_BAND: POLICY.greyBand,
  NEAR_MISS_RATIO: POLICY.nearMissRatio,
  REQUIRED_FIELDS: POLICY.requiredFields,
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
 * Returns { status, reasons, secondLook }
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
      reasons.push(`Location "${f.city}" is outside the service area`);
    } else {
      reasons.push(`Location ${f.locality ? f.locality + ', ' : ''}${f.city} is inside the service area`);
    }
  }

  const minArea = f.projectType ? RUBRIC.MIN_AREA_SQFT[f.projectType] : null;
  let areaRatio = null;
  if (f.areaSqft != null && minArea != null) {
    areaRatio = f.areaSqft / minArea;
    if (f.areaSqft >= minArea) {
      reasons.push(`Area ${f.areaSqft} sq ft meets the ${f.projectType} minimum of ${minArea} `);
    } else if (f.areaSqft >= minArea * (1 - RUBRIC.GREY_BAND)) {
      grey = true;
      reasons.push(
        `Area ${f.areaSqft} sq ft is just under the ${f.projectType} minimum of ${minArea} : needs a human call`,
      );
    } else {
      hardFail = true;
      reasons.push(`Area ${f.areaSqft} sq ft is below the ${f.projectType} minimum of ${minArea} `);
    }
  }

  let budgetRatio = null;
  if (f.budgetLakh != null) {
    budgetRatio = f.budgetLakh / RUBRIC.MIN_BUDGET_LAKH;
    if (f.budgetLakh >= RUBRIC.MIN_BUDGET_LAKH) {
      reasons.push(
        `Budget about Rs ${f.budgetLakh} lakh meets the minimum of Rs ${RUBRIC.MIN_BUDGET_LAKH} lakh `,
      );
    } else if (f.budgetLakh >= RUBRIC.MIN_BUDGET_LAKH * (1 - RUBRIC.GREY_BAND)) {
      grey = true;
      reasons.push(`Budget Rs ${f.budgetLakh} lakh is just under the minimum : needs a human call`);
    } else {
      hardFail = true;
      reasons.push(
        `Budget Rs ${f.budgetLakh} lakh is below the minimum of Rs ${RUBRIC.MIN_BUDGET_LAKH} lakh `,
      );
    }
  }

  const missing = RUBRIC.REQUIRED_FIELDS.filter((k) => f[k] == null || f[k] === '');
  if (missing.length && !hardFail) {
    grey = true;
    reasons.push(`Missing on the call: ${missing.join(', ')}. Front desk to call back and fill in`);
  }

  const status = hardFail ? 'unqualified' : grey ? 'grey' : 'qualified';
  const out = { status, reasons };

  if (status === 'unqualified') {
    // Second look rating: only soft failures (area or budget), never location.
    softOnly = !failedOnLocation;
    const nearArea = areaRatio != null && areaRatio >= RUBRIC.NEAR_MISS_RATIO;
    const nearBudget = budgetRatio != null && budgetRatio >= RUBRIC.NEAR_MISS_RATIO;
    const nearMiss = softOnly && (nearArea || nearBudget);
    out.secondLook = nearMiss ? 'near_miss' : 'clear';
    reasons.push(
      nearMiss
        ? 'Second look: a near miss on size or budget. Worth one quick look before it is closed'
        : 'Second look: a clear miss. No follow-up needed',
    );
  }
  return out;
}

module.exports = { RUBRIC, CRITERIA, scoreLead };
