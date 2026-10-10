// Deterministic, rule-based extraction from a call transcript.
// Runs on every call. Gemini (lib/gemini.js) is optional and only fills gaps.

const PUNE_LOCALITIES = [
  'baner',
  'aundh',
  'kothrud',
  'wakad',
  'hinjewadi',
  'viman nagar',
  'kharadi',
  'koregaon park',
  'hadapsar',
  'magarpatta',
  'pimple saudagar',
  'balewadi',
  'shivaji nagar',
  'shivajinagar',
  'deccan',
  'camp',
  'pashan',
  'bavdhan',
  'undri',
  'kondhwa',
  'wagholi',
  'pimpri',
  'chinchwad',
  'sus',
  'erandwane',
  'karve nagar',
  'warje',
  'nibm',
  'yerawada',
  'kalyani nagar',
  'sinhagad road',
];
const OTHER_CITIES = [
  'mumbai',
  'thane',
  'navi mumbai',
  'nashik',
  'nagpur',
  'aurangabad',
  'kolhapur',
  'satara',
  'goa',
  'bangalore',
  'bengaluru',
  'hyderabad',
  'delhi',
  'gurgaon',
  'noida',
  'chennai',
  'ahmedabad',
  'lonavala',
];
const HOSTILE =
  /\b(stupid|useless|idiot|scam|cheat(?:ers?)?|waste of (?:my )?time|shut up|nonsense|bloody|rubbish|fraud)\b/i;

function cap(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Normalise transcript (string or [{speaker,text}]) into lines and caller-only text. */
function normaliseTranscript(t) {
  if (Array.isArray(t)) {
    const lines = t.map((x) => ({
      speaker: String(x.speaker || x.role || 'unknown'),
      text: String(x.text || x.content || ''),
    }));
    const isAgent = (s) => /agent|bot|assistant|vaani|ai/i.test(s);
    const callerText = lines
      .filter((l) => !isAgent(l.speaker))
      .map((l) => l.text)
      .join(' ');
    return { lines, fullText: lines.map((l) => `${l.speaker}: ${l.text}`).join('\n'), callerText };
  }
  const s = String(t || '');
  // Plain string: try "Caller: ..." / "Agent: ..." lines, else treat all as caller.
  const lines = s
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^\s*([A-Za-z ]{2,20}):\s*(.*)$/);
      return m ? { speaker: m[1].trim(), text: m[2] } : { speaker: 'caller', text: line };
    });
  const isAgent = (sp) => /agent|bot|assistant|vaani|ai/i.test(sp);
  const callerText = lines
    .filter((l) => !isAgent(l.speaker))
    .map((l) => l.text)
    .join(' ');
  return { lines, fullText: s, callerText: callerText || s };
}

function toNumber(s) {
  return Number(String(s).replace(/,/g, ''));
}

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
    areaSqft: null,
    bhk: null,
    budgetLakh: null,
    budgetText: null,
    timeline: null,
    preferredTime: null,
    hostile: false,
  };

  if (!f.name) {
    const m = t.match(/(?:my name is|this is|i am|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    if (m) f.name = m[1];
  }

  const em = t.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (em) f.email = em[0].replace(/\.$/, '');

  if (/\b(office|workspace|work space|commercial|co-?working|clinic|showroom|startup)\b/i.test(t))
    f.projectType = 'office';
  else if (
    /\b(flat|apartment|home|house|bungalow|villa|row house|(?:\d|one|two|three|four|five)[\s-]*bhk|bedroom|kitchen|living room)\b/i.test(
      t,
    )
  )
    f.projectType = 'home';

  const area = t.match(
    /(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft\.?|sqft|square\s*feet|square\s*foot|sq\.?\s*feet|sft)/i,
  );
  if (area) f.areaSqft = Math.round(toNumber(area[1]));

  const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  const bhk = t.match(/(\d|one|two|three|four|five)[\s-]*bhk/i);
  if (bhk) f.bhk = WORDS[bhk[1].toLowerCase()] || Number(bhk[1]);

  for (const loc of PUNE_LOCALITIES) {
    if (new RegExp(`\\b${loc}\\b`, 'i').test(lower)) {
      f.locality = cap(loc);
      f.city = 'Pune';
      break;
    }
  }
  if (!f.city) {
    for (const c of OTHER_CITIES) {
      if (new RegExp(`\\b${c}\\b`, 'i').test(lower)) {
        f.city = cap(c);
        break;
      }
    }
  }
  if (!f.city && /\bpune\b/i.test(lower)) f.city = 'Pune';
  if (!f.city && /\b(pcmc|pimpri-chinchwad)\b/i.test(lower)) f.city = 'Pimpri-Chinchwad';

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

  const tl =
    t.match(
      /\b(?:in|within|next|after|by)\s+(?:the\s+)?(?:next\s+)?(\d+|one|two|three|four|six)\s*(week|weeks|month|months)\b/i,
    ) ||
    t.match(
      /\b(immediately|asap|right away|next month|this month|after possession|on possession|by diwali|before diwali|no hurry|just exploring)\b/i,
    );
  if (tl) f.timeline = tl[0].trim();

  const pt =
    t.match(
      /\b((?:this|next|on)?\s*(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|tomorrow)(?:\s+(?:morning|afternoon|evening))?(?:\s+(?:at|around)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b/i,
    ) ||
    t.match(/\b((?:after|before|around|at)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i) ||
    t.match(/\b((?:in the\s+)?(?:morning|afternoon|evening)s?)\b/i);
  if (pt) f.preferredTime = pt[1].trim();

  f.hostile = HOSTILE.test(t);
  return f;
}

module.exports = { extractFields, normaliseTranscript };
