// Runtime guardrails, run on every processed call. Pure functions, no network.
//  (a) Output: what the agent itself said (prices, promises, structural or legal advice,
//      claiming to be human, telling the caller they are qualified or not).
//  (b) Input: what the caller said (prompt injection, abuse, trying to get a price).
//  (c) PII: Aadhaar-like, card-like and PAN numbers, OTPs and passwords are replaced
//      with [redacted] before the transcript is stored.
// Result: { flags: [{code, severity, text}], redactedTranscript, needsReview }
// needsReview is true when any flag is a violation.

const { normaliseTranscript, isAgentSpeaker, HOSTILE, PRICE_ASK } = require('./extract');

const REDACTED = '[redacted]';

const OUTPUT_RULES = [
  {
    code: 'agent_price',
    text: 'Agent said a price or pricing figure (policy: never quote any number to a caller)',
    re: [
      /₹\s*\d|\brs\.?\s*\d|\binr\s*\d|\brupees\b/i,
      /\b\d+(?:\.\d+)?\s*(?:lakh|lakhs|lac|lacs|crore|cr)\b|\blakhs?\b|\bcrores?\b/i,
      /\bper\s*sq(?:uare)?\.?\s*(?:ft|feet|foot)\b|\bper\s*sqft\b/i,
      /\b(?:rates?|prices?|pricing|costs?|packages?)\s+(?:\w+\s+){0,2}starts?\s+(?:at|from)\b|\bstarts?\s+(?:at|from)\s+(?:rs|₹|\d)/i,
      /\baround\s+(?:rs|₹)/i,
      /\btypically\b[^.?!]{0,40}(?:rs\.?|₹|lakh|crore|per sq|\d{3,})/i,
      /\b(?:it(?:'ll| will)|would) cost (?:around|about|roughly)\b/i,
    ],
  },
  {
    code: 'agent_promise',
    text: 'Agent promised a timeline, guarantee or discount',
    re: [
      /\bguarantee[ds]?\b/i,
      /\bwe(?:'ll| will) definitely (?:finish|complete|deliver|be done)\b|\bdefinitely (?:finish|complete) (?:it )?(?:in|by|within)\b/i,
      /\bdiscounts?\b|\bspecial offer\b|\bfree of cost\b/i,
      /\bwe can (?:finish|complete|deliver) (?:it |the project )?(?:in|within) \d+/i,
    ],
  },
  {
    code: 'agent_structural_legal',
    text: 'Agent gave structural or legal advice (walls, permits)',
    re: [
      /\byou can (?:easily |safely )?(?:move|remove|break|knock down|shift) (?:the |that |a |any )?walls?\b/i,
      /\b(?:walls?|structure) (?:can|could) (?:easily |safely )?be (?:moved|removed|broken|knocked down)\b/i,
      /\b(?:you )?(?:don't|do not|won't|will not) need (?:a |any )?(?:permit|permits|permission|noc|approval)\b/i,
      /\bit(?:'s| is) (?:safe|fine|legal) to (?:remove|move|break)\b/i,
    ],
  },
  {
    code: 'agent_claims_human',
    text: 'Agent claimed to be a human',
    re: [
      /\b(?:i am|i'm)\s+(?:a\s+)?(?:real\s+|actual\s+)?(?:human|person|human being)\b/i,
      /\b(?:i am|i'm)\s+not\s+(?:an?\s+)?(?:ai|bot|robot|machine)\b/i,
    ],
  },
  {
    code: 'agent_disclosed_qualification',
    text: 'Agent told the caller they are qualified or unqualified',
    re: [
      /\b(?:you(?:'re| are)|you have been|your (?:enquiry|lead|project) (?:is|has been))\s+(?:not\s+)?(?:un)?qualified\b/i,
      /\b(?:un)?qualified lead\b/i,
    ],
  },
];

const INPUT_RULES = [
  {
    code: 'caller_prompt_injection',
    severity: 'warning',
    text: 'Caller tried to change or reveal the agent instructions',
    re: /\b(?:ignore (?:all |any |your |the )?(?:previous |prior |above |earlier )?instructions|system prompt|you are now|reveal (?:your |the )?(?:instructions|prompt|system)|forget (?:all |your )?(?:previous )?instructions|developer mode|jailbreak)\b/i,
  },
  { code: 'caller_abuse', severity: 'warning', text: 'Caller was abusive', re: HOSTILE },
  {
    code: 'caller_price_request',
    severity: 'info',
    text: 'Caller asked about price (deflect, not a problem)',
    re: PRICE_ASK,
  },
];

// Order matters: longer card numbers before 12-digit Aadhaar-like numbers.
const PII_RULES = [
  {
    code: 'pii_card',
    text: 'Card-like number removed from the stored transcript',
    re: /(?<![+\d])(?:\d[ -]?){12,15}\d(?![\d])/g,
    test: (m) => {
      const n = m.replace(/\D/g, '').length;
      return n >= 13 && n <= 16;
    },
  },
  {
    code: 'pii_aadhaar',
    text: 'Aadhaar-like number removed from the stored transcript',
    re: /(?<![+\d])\d{4}[ -]?\d{4}[ -]?\d{4}(?![\d])/g,
  },
  {
    code: 'pii_pan',
    text: 'PAN-like number removed from the stored transcript',
    re: /\b[A-Za-z]{5}\d{4}[A-Za-z]\b/g,
  },
];
const SECRET_RES = [
  /\b(otp|one[- ]time password|password|passcode|pin(?!\s*code))(\s*(?:is|was|:|=)\s*)([^\s,.;!?]+)/gi,
  /\b(otp|passcode|pin(?!\s*code))(\s+)(\d{4,8})\b/gi,
];

/** Redact PII in one string. Returns { text, codes } */
function redactText(text) {
  let out = String(text || '');
  const codes = new Set();
  for (const rule of PII_RULES) {
    out = out.replace(rule.re, (m) => {
      if (rule.test && !rule.test(m)) return m;
      codes.add(rule.code);
      return REDACTED;
    });
  }
  for (const re of SECRET_RES) {
    out = out.replace(re, (m, word, gap, value) => {
      if (value === REDACTED) return m;
      codes.add('pii_secret');
      return `${word}${gap}${REDACTED}`;
    });
  }
  return { text: out, codes: [...codes] };
}

const PII_TEXT = {
  pii_card: PII_RULES[0].text,
  pii_aadhaar: PII_RULES[1].text,
  pii_pan: PII_RULES[2].text,
  pii_secret: 'OTP or password removed from the stored transcript',
};

/**
 * Run all guardrails on a transcript (string or [{speaker,text}]).
 */
function runGuardrails(transcript) {
  const { lines } = normaliseTranscript(transcript);
  const flags = [];
  const seen = new Set();
  const add = (code, severity, text) => {
    if (seen.has(code)) return;
    seen.add(code);
    flags.push({ code, severity, text });
  };

  const piiCodes = new Set();
  const redactedTranscript = lines.map((l) => {
    const { text, codes } = redactText(l.text);
    codes.forEach((c) => piiCodes.add(c));
    return { speaker: l.speaker, text };
  });

  for (const l of redactedTranscript) {
    if (isAgentSpeaker(l.speaker)) {
      for (const rule of OUTPUT_RULES) {
        if (rule.re.some((re) => re.test(l.text)))
          add(rule.code, 'violation', `${rule.text}: "${clip(l.text)}"`);
      }
    } else {
      for (const rule of INPUT_RULES) {
        if (rule.re.test(l.text)) add(rule.code, rule.severity, rule.text);
      }
    }
  }
  for (const c of piiCodes) add(c, 'warning', PII_TEXT[c]);

  return {
    flags,
    redactedTranscript,
    needsReview: flags.some((x) => x.severity === 'violation'),
  };
}

function clip(s, n = 120) {
  const t = String(s).trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

module.exports = { runGuardrails, redactText, REDACTED };
