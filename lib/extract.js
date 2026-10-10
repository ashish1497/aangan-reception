// Deterministic, rule-based extraction from a call transcript.
// Runs on every call. Gemini (lib/gemini.js) is optional and only fills gaps.
// Rule: never guess. A field stays null unless the caller said it.
// Place names come from policy/rubric.json (taken from policy/services.md).

const POLICY = require('../policy/rubric.json');
const AREA = POLICY.serviceArea;

const HOSTILE =
  /\b(stupid|useless|idiot|idiots|scam|cheat(?:ers?)?|waste of (?:my )?time|shut up|nonsense|bloody|rubbish|fraud|fools?)\b/i;

const AGENT_SPEAKER =
  /^(?:ai|agent|bot|assistant|vaani|receptionist|front\s*desk|staff|aangan|riya|designer)\b/i;
const INLINE_LABEL =
  /\s+(?=(?:AI|Agent|Assistant|Bot|Vaani|Front Desk|Receptionist|Caller|Customer|Client|User)\s*:)/g;

function cap(s) {
  return s.replace(/(^|[\s-])(\w)/g, (m, a, c) => a + c.toUpperCase());
}
function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function hasWord(text, phrase) {
  return new RegExp(`\\b${esc(phrase).replace(/ /g, '[\\s-]+')}\\b`, 'i').test(text);
}

function isAgentSpeaker(s) {
  return AGENT_SPEAKER.test(String(s || '').trim());
}

/** Normalise transcript (string or [{speaker,text}]) into lines and caller-only text. */
function normaliseTranscript(t) {
  let lines;
  if (Array.isArray(t)) {
    lines = t.map((x) => ({
      speaker: String(x.speaker || x.role || 'unknown'),
      text: String(x.text || x.content || ''),
    }));
  } else {
    // Plain string: split "Caller: ..." / "AI: ..." turns, even when they share one line.
    const s = String(t || '').replace(INLINE_LABEL, '\n');
    // A line with no label continues the previous speaker's turn (transcripts are often
    // hard-wrapped), so a wrapped Front Desk sentence is never read as the caller.
    let last = 'caller';
    lines = s
      .split(/\n+/)
      .filter((x) => x.trim())
      .map((line) => {
        const m = line.match(/^\s*([A-Za-z ]{2,20}):\s*(.*)$/);
        if (m) {
          last = m[1].trim();
          return { speaker: last, text: m[2] };
        }
        return { speaker: last, text: line.trim() };
      });
  }
  const pick = (agent) =>
    lines
      .filter((l) => isAgentSpeaker(l.speaker) === agent)
      .map((l) => l.text)
      .join(' ');
  return {
    lines,
    fullText: lines.map((l) => `${l.speaker}: ${l.text}`).join('\n'),
    callerText: pick(false),
    agentText: pick(true),
  };
}

function toNumber(s) {
  return Number(String(s).replace(/,/g, ''));
}

const NUM_WORDS = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
};
function numberFrom(s) {
  const k = String(s).toLowerCase();
  return k in NUM_WORDS ? NUM_WORDS[k] : Number(k);
}

/** Location: locality and city from the services.md lists, plus places we do not serve. */
function extractLocation(text) {
  const out = { locality: null, city: null, outsideArea: null, locationConflict: false };
  let t = ' ' + String(text).toLowerCase() + ' ';
  let pcmcNamed = false;
  if (/\b(?:pimpri[\s-]+chinchwad|pcmc)\b/.test(t)) {
    pcmcNamed = true;
    t = t.replace(/\b(?:pimpri[\s-]+chinchwad|pcmc)\b/g, ' ');
  }
  const byLength = (a, b) => b.length - a.length;
  let inArea = null;
  for (const loc of AREA.pcmcLocalities.slice().sort(byLength)) {
    if (hasWord(t, loc)) {
      inArea = { locality: cap(loc), city: 'Pimpri-Chinchwad' };
      break;
    }
  }
  if (!inArea) {
    for (const loc of AREA.puneLocalities.slice().sort(byLength)) {
      if (hasWord(t, loc)) {
        inArea = { locality: loc === 'nibm' ? 'NIBM' : cap(loc), city: 'Pune' };
        break;
      }
    }
  }
  if (!inArea && pcmcNamed) inArea = { locality: null, city: 'Pimpri-Chinchwad' };
  if (!inArea && hasWord(t, 'pune')) inArea = { locality: null, city: 'Pune' };

  let outside = null;
  for (const c of AREA.excludedPlaces.concat(AREA.otherCities).sort(byLength)) {
    if (hasWord(t, c)) {
      outside = cap(c);
      break;
    }
  }

  if (inArea && outside) {
    // Both a place we serve and one we do not: do not guess which one is the site.
    out.locationConflict = true;
    out.outsideArea = outside;
    out.locality = inArea.locality;
    return out;
  }
  if (outside) {
    out.city = outside;
    out.outsideArea = outside;
    return out;
  }
  if (inArea) Object.assign(out, inArea);
  return out;
}

const QTY =
  '(\\d+(?:\\.\\d+)?|(?:a )?couple of|a few|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)';
const TIMELINE_RE = new RegExp(
  `\\b(?:in|within|by|before|after|next|over|takes?|done in|complete in|ready in)\\s+(?:the\\s+)?(?:next\\s+)?(?:about\\s+|around\\s+|roughly\\s+|just\\s+|only\\s+)?${QTY}\\s*(day|days|week|weeks|month|months|year|years)\\b`,
);

/** Weeks until the caller needs the project complete. Null when not said or vague. */
const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
const MONTH_RE = new RegExp(
  `\\b(?:(by|before|until|till|end of)\\s+(?:the\\s+end\\s+of\\s+)?|(?:in|for|from|starting|start(?:ing)? in|move in(?:to)?(?: in)?|moving in(?: in)?|around)\\s+(?:early\\s+|mid\\s+|late\\s+)?)(${MONTHS.join('|')})\\b|\\b(${MONTHS.join('|')})\\s+start\\b`,
);
const BARE_QTY_RE = new RegExp(
  `\\b(?:about|around|roughly|approximately|almost)\\s+${QTY}\\s*(week|weeks|month|months)\\b`,
);

/** Weeks until a named month, from refDate. By <month> means the end of it; otherwise its start. */
function weeksToMonth(monthName, byEnd, refDate) {
  const ref = refDate instanceof Date && !Number.isNaN(refDate.getTime()) ? refDate : new Date();
  const mi = MONTHS.indexOf(monthName);
  let year = ref.getUTCFullYear();
  let target = byEnd ? Date.UTC(year, mi + 1, 0) : Date.UTC(year, mi, 1);
  if (target < ref.getTime()) {
    year += 1;
    target = byEnd ? Date.UTC(year, mi + 1, 0) : Date.UTC(year, mi, 1);
  }
  return Math.round(((target - ref.getTime()) / (7 * 86400000)) * 10) / 10;
}

function extractTimeline(text, refDate) {
  const t = String(text).toLowerCase();
  const mm = t.match(MONTH_RE);
  if (mm) {
    const name = mm[2] || mm[3];
    const byEnd = !!mm[1] && /by|before|until|till|end of/.test(mm[1]);
    return {
      timelineWeeks: weeksToMonth(name, byEnd, refDate),
      timeline: mm[0].trim(),
      timelineFlexible: false,
    };
  }
  // "3 months mein", "2 months baad", "3 months later", "4 months away"
  const hinglish = t.match(
    new RegExp(`\\b${QTY}\\s*(week|weeks|month|months)\\s+(?:mein|me|baad|later|from now|away)\\b`),
  );
  if (hinglish && hinglish[1] !== 'a few') {
    const qty = numberFrom(hinglish[1]);
    return {
      timelineWeeks: Math.round((/^week/.test(hinglish[2]) ? qty : qty * 4.33) * 10) / 10,
      timeline: hinglish[0].trim(),
      timelineFlexible: false,
    };
  }
  const bq = t.match(BARE_QTY_RE);
  if (bq && !TIMELINE_RE.test(t) && bq[1] !== 'a few') {
    const qty = numberFrom(bq[1]);
    return {
      timelineWeeks: Math.round((/^week/.test(bq[2]) ? qty : qty * 4.33) * 10) / 10,
      timeline: bq[0].trim(),
      timelineFlexible: false,
    };
  }
  const m = t.match(TIMELINE_RE);
  if (m && m[1] !== 'a few') {
    const qty = /couple/.test(m[1]) ? 2 : numberFrom(m[1]);
    const unit = m[2];
    let weeks;
    if (/^day/.test(unit)) weeks = qty / 7;
    else if (/^week/.test(unit)) weeks = qty;
    else if (/^month/.test(unit)) weeks = qty * 4.33;
    else weeks = qty * 52;
    return { timelineWeeks: Math.round(weeks * 10) / 10, timeline: m[0].trim(), timelineFlexible: false };
  }
  const rel = [
    [/\b(?:by|before|within|in) (?:the )?end of (?:this|the) month\b/, 3],
    [/\bnext month\b/, 4],
    [/\bthis month\b/, 2],
    [/\b(?:in|within|by) a fortnight\b/, 2],
  ];
  for (const [re, w] of rel) {
    const r = t.match(re);
    if (r) return { timelineWeeks: w, timeline: r[0].trim(), timelineFlexible: false };
  }
  const flex = t.match(/\b(no hurry|no rush|flexible on (?:time|timing|the timeline)|not in a hurry)\b/);
  if (flex) return { timelineWeeks: null, timeline: flex[0], timelineFlexible: true };
  const vague = t.match(
    /\b(immediately|asap|as soon as possible|right away|urgently|after possession|on possession|a few (?:weeks|months))\b/,
  );
  if (vague) return { timelineWeeks: null, timeline: vague[0], timelineFlexible: false };
  return { timelineWeeks: null, timeline: null, timelineFlexible: false };
}

const ROOM =
  '(?:master\\s+)?(?:bed\\s?room|living\\s+room|hall|kitchen|kids\\s+room|study|dining\\s+room|room)';
const SINGLE_RE = new RegExp(
  `\\b(?:just|only)\\s+(?:the\\s+|my\\s+|our\\s+|a\\s+|one\\s+)?${ROOM}\\b|\\b(?:one|a single|single)\\s+${ROOM}\\b`,
);
const MULTI_RE = new RegExp(
  `\\b(?:two|three|four|2|3|4|few|some|all the)\\s+(?:bed\\s?)?rooms\\b|\\b(?:a|one|the)\\s+(?:full\\s+)?floor\\b|${ROOM},?\\s+and\\s+(?:the\\s+|a\\s+)?${ROOM}`,
);

/** 'single_room' | 'multi_room' | 'full' | null */
function extractScope(text) {
  const t = String(text).toLowerCase();
  if (SINGLE_RE.test(t)) return 'single_room';
  if (
    /\b(?:full|whole|entire|complete)\s+(?:flat|home|house|apartment|bungalow|villa|office|place)\b/.test(t)
  )
    return 'full';
  if (MULTI_RE.test(t)) return 'multi_room';
  if (/\b(?:\d|one|two|three|four|five)[\s-]*bhk\b|\b(?:bungalow|villa|row house)\b/.test(t)) return 'full';
  if (new RegExp(`\\b${ROOM}\\b`).test(t)) return 'single_room';
  return null;
}

const OUT_OF_SCOPE = [
  ['restaurant', /\b(restaurant|cafe|café|eatery|cloud kitchen|food court)\b/],
  ['hotel', /\b(hotel|resort|guest ?house|homestay|hostel|lodge)\b/],
  ['hospitality', /\bhospitality\b/],
  ['gym', /\b(gym|gymnasium|fitness (?:centre|center|studio))\b/],
  ['retail', /\b(retail|shop|showroom|boutique|outlet|storefront|store front)\b/],
  [
    'architecture_structural',
    /\b(?:(?:need|want|looking for|require)\s+(?:an?\s+)?architect|architecture (?:work|services)|architectural (?:work|services|plans?)|structural (?:work|changes|engineer|design)|construction of|build(?:ing)? a (?:new )?(?:house|bungalow|building|floor))\b/,
  ],
  ['vastu_only', /\b(?:only|just)\b[^.?!]{0,30}\bvastu\b|\bvastu\b[^.?!]{0,25}\bonly\b|\bstandalone vastu\b/],
  [
    'furniture_only',
    /\b(?:only|just)\s+(?:need\s+|want\s+|looking for\s+|to buy\s+|buy\s+|source\s+)?(?:some\s+|a\s+few\s+)?(?:furniture|a sofa|sofas)\b|\bfurniture (?:sourcing|procurement|shopping)\b|\bsource (?:some )?furniture\b/,
  ],
  [
    'decor_only',
    /\b(?:decor|styling) only\b|\b(?:just|only) (?:decor|styling|(?:some )?decoration|paint(?:ing)?|colou?rs?)\b|\b(?:advise|advice|suggest\w*|help) (?:me |us )?(?:on|with) (?:the )?(?:colou?rs|paint|decor)\b|\brearrange (?:the |my |our )?furniture\b/,
  ],
];

const RED_FLAGS =
  /\b(just looking for (?:some )?ideas|looking for (?:some )?ideas|only want (?:some )?(?:suggestions|ideas|advice)|just want (?:some )?(?:suggestions|ideas|advice)|come (?:and |to )?advise|second opinion|execute it (?:myself|ourselves)|do the execution (?:myself|ourselves)|(?:i|we)(?:'ll| will) (?:do|handle|manage) the execution|consultation only|just a consultation|only a consultation|advise (?:me|us|on))\b/i;

const DM_UNCLEAR =
  /\b(initial research|for my in-?laws|just exploring for someone|exploring (?:it )?for (?:someone|a friend|my (?:boss|parents|relative))|(?:they|he|she)(?:'re| are| is|'s) not available|not my decision|(?:need|have) to (?:check|ask|discuss) with my (?:husband|wife|spouse|parents|father|mother|family|boss|partner|in-?laws)|asking on behalf of someone)\b/i;
const AUTHORISED = /\bauthori[sz]ed\b|\bi can decide\b|\b(?:i|i'm|i am) the decision maker\b/i;

const PRICE_ASK =
  /\b(price|prices|pricing|how much|what (?:will|would) it cost|cost me|charges?|your rates?|per sq(?:uare)?\.? ?f(?:ee)?t|quote|quotation)\b/i;

function extractFields(transcript, payload = {}) {
  const { callerText } = normaliseTranscript(transcript);
  const t = callerText;
  const lower = t.toLowerCase();
  const f = {
    name: payload.callerName || null,
    phone: payload.phone || null,
    email: null,
    projectType: null,
    city: null,
    locality: null,
    outsideArea: null,
    locationConflict: false,
    areaSqft: null,
    bhk: null,
    scope: null,
    outOfScopeType: null,
    budgetLakh: null,
    budgetText: null,
    timeline: null,
    timelineWeeks: null,
    timelineFlexible: false,
    preferredTime: null,
    realProjectRedFlag: null,
    decisionMakerUnclear: null,
    wallChangesMentioned: false,
    askedAboutPrice: false,
    hostile: false,
  };

  if (!f.name) {
    const m = t.match(/(?:my name is|this is|i am|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    if (m) f.name = m[1];
  }

  const em = t.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (em) f.email = em[0].replace(/\.$/, '');
  if (!f.email && payload.email) f.email = String(payload.email);

  if (/\b(office|workspace|work space|commercial|co-?working|clinic|studio space|startup)\b/i.test(t))
    f.projectType = 'office';
  else if (
    /\b(flat|apartment|home|house|bungalow|villa|row house|(?:\d|one|two|three|four|five)[\s-]*bhk|bed\s?room|kitchen|living room)\b/i.test(
      t,
    )
  )
    f.projectType = 'home';

  const area = t.match(
    /(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft\.?|sqft|square\s*feet|square\s*foot|sq\.?\s*feet|sft)/i,
  );
  if (area) f.areaSqft = Math.round(toNumber(area[1]));

  const bhk = t.match(/(\d|one|two|three|four|five)[\s-]*bhk/i);
  if (bhk) f.bhk = numberFrom(bhk[1]);

  Object.assign(f, extractLocation(t));
  Object.assign(f, extractTimeline(t, payload.startedAt ? new Date(payload.startedAt) : undefined));
  f.scope = extractScope(t);

  for (const [type, re] of OUT_OF_SCOPE) {
    if (re.test(lower)) {
      f.outOfScopeType = type;
      break;
    }
  }

  const range = t.match(
    /(\d+(?:\.\d+)?)\s*(?:to|-|or)\s*(\d+(?:\.\d+)?)\s*(lakh|lakhs|lac|lacs|crore|cr)\b/i,
  );
  const single = t.match(/(\d+(?:\.\d+)?)\s*(lakh|lakhs|lac|lacs|crore|cr)\b/i);
  if (range) {
    const mult = /crore|cr/i.test(range[3]) ? 100 : 1;
    f.budgetLakh = toNumber(range[2]) * mult; // use upper end of stated range
    f.budgetText = range[0];
  } else if (single) {
    const mult = /crore|cr/i.test(single[2]) ? 100 : 1;
    f.budgetLakh = toNumber(single[1]) * mult;
    f.budgetText = single[0];
  }

  const pt =
    t.match(
      /\b((?:this|next|on)?\s*(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|tomorrow)(?:\s+(?:morning|afternoon|evening))?(?:\s+(?:at|around)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/i,
    ) ||
    t.match(/\b((?:after|before|around|at)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i) ||
    t.match(/\b((?:in the\s+)?(?:morning|afternoon|evening)s?)\b/i);
  if (pt) f.preferredTime = pt[1].trim();

  const rf = t.match(RED_FLAGS);
  if (rf) f.realProjectRedFlag = rf[0];

  const dm = t.match(DM_UNCLEAR);
  if (dm && !AUTHORISED.test(t)) f.decisionMakerUnclear = dm[0];

  f.wallChangesMentioned =
    /\b(?:move|moving|remove|removing|break|breaking|knock(?:ing)? down|shift|shifting)\s+(?:a\s+|the\s+|one\s+|some\s+)?walls?\b/i.test(
      t,
    );
  f.askedAboutPrice = PRICE_ASK.test(t);
  f.hostile = HOSTILE.test(t);
  return f;
}

module.exports = {
  extractFields,
  normaliseTranscript,
  isAgentSpeaker,
  extractLocation,
  extractTimeline,
  extractScope,
  HOSTILE,
  PRICE_ASK,
};
