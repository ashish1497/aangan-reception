// REPLACE with qualified.md and pricing.md
// ---------------------------------------------------------------------------
// QUALIFICATION RUBRIC: every value in this file is a PLACEHOLDER.
// The real rules live in qualified.md on the Mesa LMS, which was not
// available when this was built. Do not treat these thresholds as
// Aangan Studio's real policy until they are copied in from qualified.md.
// ---------------------------------------------------------------------------

const RUBRIC = {
  IS_PLACEHOLDER: true,
  // PLACEHOLDER: cities Aangan Studio serves (case says the studio is in Pune).
  SERVICE_CITIES: ['pune', 'pimpri-chinchwad'],
  // PLACEHOLDER: minimum carpet area worth a designer's time, by project type.
  MIN_AREA_SQFT: { home: 400, office: 300 },
  // PLACEHOLDER: minimum budget in lakh rupees (only applied if the caller gives one).
  MIN_BUDGET_LAKH: 5,
  // PLACEHOLDER: a value within this fraction below a minimum goes to 'grey'
  // (human check) instead of 'unqualified'. 0.2 means within 20 percent.
  GREY_BAND: 0.2,
  // Fields a designer needs before the first meeting.
  REQUIRED_FIELDS: ['projectType', 'city', 'areaSqft']
};

/**
 * Score extracted fields against the rubric.
 * Returns { status: 'qualified' | 'grey' | 'unqualified', reasons: string[] }
 * 'grey' means a person at the front desk should check before a designer is assigned.
 */
function scoreLead(f) {
  const reasons = [];
  let hardFail = false;
  let grey = false;

  if (f.hostile) {
    grey = true;
    reasons.push('Caller sounded hostile or abusive: route to a human, do not auto-assign a designer');
  }

  if (f.city) {
    if (!RUBRIC.SERVICE_CITIES.includes(f.city.toLowerCase())) {
      hardFail = true;
      reasons.push(`Location "${f.city}" is outside the service area (placeholder list: ${RUBRIC.SERVICE_CITIES.join(', ')})`);
    } else {
      reasons.push(`Location ${f.locality ? f.locality + ', ' : ''}${f.city} is inside the service area`);
    }
  }

  const minArea = f.projectType ? RUBRIC.MIN_AREA_SQFT[f.projectType] : null;
  if (f.areaSqft != null && minArea != null) {
    if (f.areaSqft >= minArea) {
      reasons.push(`Area ${f.areaSqft} sq ft meets the ${f.projectType} minimum of ${minArea} (placeholder)`);
    } else if (f.areaSqft >= minArea * (1 - RUBRIC.GREY_BAND)) {
      grey = true;
      reasons.push(`Area ${f.areaSqft} sq ft is just under the ${f.projectType} minimum of ${minArea} (placeholder): needs a human call`);
    } else {
      hardFail = true;
      reasons.push(`Area ${f.areaSqft} sq ft is below the ${f.projectType} minimum of ${minArea} (placeholder)`);
    }
  }

  if (f.budgetLakh != null) {
    if (f.budgetLakh >= RUBRIC.MIN_BUDGET_LAKH) {
      reasons.push(`Budget about Rs ${f.budgetLakh} lakh meets the minimum of Rs ${RUBRIC.MIN_BUDGET_LAKH} lakh (placeholder)`);
    } else if (f.budgetLakh >= RUBRIC.MIN_BUDGET_LAKH * (1 - RUBRIC.GREY_BAND)) {
      grey = true;
      reasons.push(`Budget Rs ${f.budgetLakh} lakh is just under the minimum (placeholder): needs a human call`);
    } else {
      hardFail = true;
      reasons.push(`Budget Rs ${f.budgetLakh} lakh is below the minimum of Rs ${RUBRIC.MIN_BUDGET_LAKH} lakh (placeholder)`);
    }
  }

  const missing = RUBRIC.REQUIRED_FIELDS.filter((k) => f[k] == null || f[k] === '');
  if (missing.length && !hardFail) {
    grey = true;
    reasons.push(`Missing on the call: ${missing.join(', ')}. Front desk to call back and fill in`);
  }

  const status = hardFail ? 'unqualified' : grey ? 'grey' : 'qualified';
  return { status, reasons, rubricIsPlaceholder: RUBRIC.IS_PLACEHOLDER };
}

module.exports = { RUBRIC, scoreLead };
