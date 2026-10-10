// Qualification rubric: Nikhil's five criteria from policy/qualified.md.
// Numbers and word lists live in policy/rubric.json. Edit those, not this file.
//
// Each criterion returns pass, fail or unclear with a plain-English reason.
//  - Any fail: unqualified (decline gracefully).
//  - Otherwise unclear on 1, 2 or 3: grey, with one direct question to ask.
//  - Unclear on 4 or 5: qualified, with the doubt written into the handoff notes.
//  - A hostile caller goes to a human (grey) unless a criterion already failed.

const POLICY = require('../policy/rubric.json');

const RUBRIC = {
  POLICY_FILE: 'policy/qualified.md',
  SERVED_CITIES: POLICY.serviceArea.servedCities,
  COMMERCIAL_MAX_SQFT: POLICY.scope.commercialMaxSqft,
  COMMERCIAL_TOLERANCE: POLICY.scope.commercialApproxTolerance,
  EXCLUDED_PROJECT_TYPES: POLICY.scope.excludedProjectTypes,
  EXCLUDED_SERVICE_ONLY: POLICY.scope.excludedServiceOnly,
  MIN_LEAD_TIME_WEEKS: POLICY.timeline.minLeadTimeWeeks,
  EXECUTION_WINDOW_WEEKS: POLICY.timeline.executionWindowWeeks,
  BUDGET: POLICY.budget,
  QUESTIONS: POLICY.questions,
  DECLINE_LINE: POLICY.declineLine,
};

const CRITERIA = [
  {
    id: 'realProject',
    n: 1,
    text: 'Real project, not just advice: design and execution of something we take on',
  },
  { id: 'serviceArea', n: 2, text: 'Site is in Pune city or PCMC' },
  {
    id: 'timeline',
    n: 3,
    text: `Realistic timeline: at least ${RUBRIC.MIN_LEAD_TIME_WEEKS} weeks to complete`,
  },
  { id: 'budget', n: 4, text: 'Budget, only if volunteered, is not clearly below the lowest plausible cost' },
  { id: 'decisionMaker', n: 5, text: 'Caller decides, or is authorised by the person who does' },
];

const OUT_OF_SCOPE_TEXT = {
  retail: 'a retail space, which we do not take on',
  hospitality: 'a hospitality project, which we do not take on',
  restaurant: 'a restaurant or cafe, which we do not take on',
  hotel: 'a hotel or guest house, which we do not take on',
  gym: 'a gym, which we do not take on',
  architecture_structural: 'architecture or structural work; we are interior designers, not architects',
  decor_only: 'decor or styling advice only; our minimum is a room redesign with execution',
  furniture_only: 'furniture sourcing only; we only source furniture as part of a design project',
  vastu_only: 'a Vastu consultation only; we include Vastu in our designs but do not advise on it alone',
};

const r = (result, reason) => ({ result, reason });

function realProject(f) {
  if (f.realProjectRedFlag)
    return r('fail', `Caller wants advice rather than a project ("${f.realProjectRedFlag}")`);
  if (f.outOfScopeType) {
    const what = OUT_OF_SCOPE_TEXT[f.outOfScopeType] || 'outside what we do';
    return r('fail', `Request is for ${what}`);
  }
  if (f.projectType === 'office' && f.areaSqft != null) {
    const hardMax = RUBRIC.COMMERCIAL_MAX_SQFT * (1 + RUBRIC.COMMERCIAL_TOLERANCE);
    if (f.areaSqft > hardMax)
      return r(
        'fail',
        `Commercial space of ${f.areaSqft} sq ft is above our limit of about ${RUBRIC.COMMERCIAL_MAX_SQFT} sq ft`,
      );
  }
  if (f.projectType || f.scope) {
    const what =
      f.scope === 'single_room'
        ? 'a single room redesign'
        : f.projectType === 'office'
          ? 'an office'
          : 'a home';
    return r('pass', `Caller wants ${what} designed and done`);
  }
  return r('unclear', 'Not clear yet whether this is a design-and-execution project or a request for advice');
}

function serviceArea(f) {
  if (f.locationConflict)
    return r(
      'unclear',
      `Caller mentioned ${f.outsideArea} and a place we serve${f.locality ? ' (' + f.locality + ')' : ''}; site location not confirmed`,
    );
  if (f.city && RUBRIC.SERVED_CITIES.includes(f.city))
    return r('pass', `Site is in ${f.locality ? f.locality + ', ' : ''}${f.city}, inside our service area`);
  if (f.outsideArea || f.city)
    return r(
      'fail',
      `Site is in ${f.outsideArea || f.city}, outside Pune and PCMC where we have our vendors`,
    );
  return r('unclear', 'Site location not given');
}

function timeline(f) {
  const min = RUBRIC.MIN_LEAD_TIME_WEEKS;
  if (f.timelineWeeks != null) {
    if (f.timelineWeeks < min)
      return r(
        'fail',
        `Caller needs it in about ${f.timelineWeeks} weeks ("${f.timeline}"); we need at least ${min} weeks`,
      );
    return r('pass', `Timeline of about ${f.timelineWeeks} weeks ("${f.timeline}") is workable`);
  }
  if (f.timelineFlexible) return r('pass', `Caller is flexible on timing ("${f.timeline}")`);
  if (f.timeline) return r('unclear', `Timeline is vague ("${f.timeline}"); completion date not confirmed`);
  return r('unclear', 'Caller did not say when the project needs to be complete');
}

/** Lowest plausible cost in lakh for the scope described, from pricing.md. */
function lowestPlausibleLakh(f) {
  const b = RUBRIC.BUDGET;
  if (f.scope === 'single_room') return { lakh: b.singleRoomLowLakh, basis: 'a single room' };
  if (f.areaSqft && f.projectType === 'office')
    return { lakh: (f.areaSqft * b.officePerSqftLow) / 100000, basis: `an office of ${f.areaSqft} sq ft` };
  if (f.areaSqft && f.projectType === 'home')
    return { lakh: (f.areaSqft * b.homePerSqftLow) / 100000, basis: `a home of ${f.areaSqft} sq ft` };
  if (f.scope === 'full' && f.projectType === 'home')
    return {
      lakh: (b.smallestFullHomeSqft * b.homePerSqftLow) / 100000,
      basis: 'even the smallest full home',
    };
  return { lakh: b.singleRoomLowLakh, basis: 'our smallest engagement, a single room' };
}

function budget(f) {
  if (f.budgetLakh == null)
    return r('pass', 'No budget mentioned; the designer sets fit at the consultation');
  const low = lowestPlausibleLakh(f);
  const lowTxt = Math.round(low.lakh * 10) / 10;
  if (f.budgetLakh < low.lakh * RUBRIC.BUDGET.clearFailRatio)
    return r(
      'fail',
      `Volunteered budget of Rs ${f.budgetLakh} lakh is clearly below what ${low.basis} costs (from about Rs ${lowTxt} lakh, internal figure)`,
    );
  if (f.budgetLakh < low.lakh)
    return r(
      'unclear',
      `Volunteered budget of Rs ${f.budgetLakh} lakh is under the usual starting cost for ${low.basis}; designer to discuss`,
    );
  return r('pass', `Volunteered budget of Rs ${f.budgetLakh} lakh fits the scope described`);
}

function decisionMaker(f) {
  if (f.decisionMakerUnclear)
    return r('unclear', `Caller may not be the decision maker ("${f.decisionMakerUnclear}")`);
  return r('pass', 'Caller is treated as the decision maker');
}

/**
 * Score extracted fields against the five criteria.
 * Returns { status, reasons, notes, nextQuestion, criteria, secondLook? }
 */
function scoreLead(f) {
  const criteria = {
    realProject: realProject(f),
    serviceArea: serviceArea(f),
    timeline: timeline(f),
    budget: budget(f),
    decisionMaker: decisionMaker(f),
  };
  const reasons = CRITERIA.map((c) => {
    const x = criteria[c.id];
    return `${c.n}. ${x.result === 'pass' ? 'Pass' : x.result === 'fail' ? 'Fail' : 'Unclear'}: ${x.reason}`;
  });
  const notes = [];
  const failed = CRITERIA.filter((c) => criteria[c.id].result === 'fail');
  const unclearAsk = CRITERIA.filter((c) => c.n <= 3 && criteria[c.id].result === 'unclear');

  for (const c of CRITERIA.filter((x) => x.n >= 4 && criteria[x.id].result === 'unclear'))
    notes.push(criteria[c.id].reason);
  if (
    f.timelineWeeks != null &&
    f.timelineWeeks >= RUBRIC.MIN_LEAD_TIME_WEEKS &&
    f.timelineWeeks < RUBRIC.EXECUTION_WINDOW_WEEKS.low
  )
    notes.push(`Tight timeline (about ${f.timelineWeeks} weeks); confirm the site is ready for execution`);
  if (
    f.projectType === 'office' &&
    f.areaSqft > RUBRIC.COMMERCIAL_MAX_SQFT &&
    criteria.realProject.result === 'pass'
  )
    notes.push(
      `Office of ${f.areaSqft} sq ft is at the top of our range (about ${RUBRIC.COMMERCIAL_MAX_SQFT} sq ft)`,
    );
  if (f.wallChangesMentioned)
    notes.push('Caller mentioned moving walls: structural work is outside our scope, designer to clarify');

  let status;
  let nextQuestion = null;
  if (failed.length) {
    status = 'unqualified';
    if (failed.length >= 2)
      reasons.push(`Two or more criteria fail: decline gracefully. "${RUBRIC.DECLINE_LINE}"`);
    else reasons.push('Does not meet one criterion: close gracefully, do not forward');
  } else if (f.hostile) {
    status = 'grey';
    reasons.push('Caller sounded hostile or abusive: a person should handle this, do not auto-assign');
    if (unclearAsk.length) nextQuestion = RUBRIC.QUESTIONS[unclearAsk[0].id];
  } else if (unclearAsk.length) {
    status = 'grey';
    nextQuestion = RUBRIC.QUESTIONS[unclearAsk[0].id];
    reasons.push(`Ask one direct question: "${nextQuestion}"`);
  } else {
    status = 'qualified';
  }

  const out = { status, reasons, notes, nextQuestion, criteria };
  if (status === 'unqualified') {
    const near = failed.length === 1 && ['budget', 'timeline'].includes(failed[0].id);
    out.secondLook = near ? 'near_miss' : 'clear';
    reasons.push(
      near
        ? 'Second look: a near miss on budget or timeline only. Worth one quick look before it is closed'
        : 'Second look: a clear miss. No follow-up needed',
    );
  }
  return out;
}

module.exports = { RUBRIC, CRITERIA, scoreLead, lowestPlausibleLakh };
