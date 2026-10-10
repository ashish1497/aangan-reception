// The call-processing pipeline: guardrails and redaction, extract, (optional Gemini),
// score, internal estimate, brief, note.
const { extractFields, normaliseTranscript } = require('./extract');
const { geminiExtract } = require('./gemini');
const { scoreLead } = require('./rubric');
const { internalEstimate, PRICING } = require('./pricing');
const { runGuardrails } = require('./guardrails');
const { callCost } = require('./cost');

const FIVE_MIN = 300;
const PRICE_ASKED_NOTE = 'Caller asked about price: deflected, designer to cover at consultation';

// Case fact: about 33% of enquiries arrive outside 10am to 7pm. Hours are IST.
function isAfterHours(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const istMinutes = (d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440;
  return istMinutes < 600 || istMinutes >= 1140;
}

const SCOPE_TEXT = { single_room: 'single room', multi_room: 'several rooms', full: 'full' };

function ruleBrief(f, q, estimate, bookedSlot) {
  const who = `${f.name || 'Caller (name not given)'}${f.phone ? ', ' + f.phone : ''}${f.email ? ', ' + f.email : ''}`;
  const kind = f.projectType ? (f.projectType === 'home' ? 'Home' : 'Office') : 'Space type unclear';
  const space = `${kind}${f.scope ? ' (' + SCOPE_TEXT[f.scope] + ')' : ''}${f.bhk ? ', ' + f.bhk + ' BHK' : ''} in ${f.locality ? f.locality + ', ' : ''}${f.city || 'location not given'}`;
  const size = `${f.areaSqft ? f.areaSqft + ' sq ft' : 'Area not given'}; budget ${f.budgetText || 'not stated'}. ${estimate ? estimate.label : PRICING.INTERNAL_LABEL + ': not computed'}`;
  const timing = `Timeline: ${f.timeline || 'not stated'}. Preferred contact: ${f.preferredTime || 'not stated'}. ${bookedSlot ? 'Booked on call: ' + bookedSlot : 'No slot booked yet'}`;
  const prep =
    q.status === 'qualified'
      ? 'Prepare: portfolio of similar ' + (f.projectType || '') + ' projects; confirm site visit'
      : q.nextQuestion
        ? 'Front desk: ask the caller "' + q.nextQuestion + '"'
        : 'Front desk: check the reasons below before a designer is assigned';
  return [who, space, size, timing, prep].join('\n');
}

function buildNote(rec) {
  const f = rec.fields;
  const q = rec.qualification;
  const lines = [
    `AANGAN VOICE DESK: ${q.status.toUpperCase()} enquiry${rec.demo ? ' [SAMPLE CALL]' : ''}${rec.guardrails && rec.guardrails.needsReview ? ' [NEEDS REVIEW]' : ''}`,
    `Call ${rec.callId} at ${rec.startedAt}${rec.afterHours ? ' (after hours)' : ''}`,
    '',
    rec.brief,
    '',
    'Why: ' + q.reasons.join('; '),
  ];
  if (q.nextQuestion) lines.push(`Ask the caller: ${q.nextQuestion}`);
  for (const n of q.notes || []) lines.push('Note: ' + n);
  lines.push(
    rec.internalEstimate
      ? rec.internalEstimate.label
      : `${PRICING.INTERNAL_LABEL}: not computed (scope or size missing)`,
  );
  if (f.hostile) lines.push('Note: caller was hostile. Handle with care.');
  for (const g of (rec.guardrails && rec.guardrails.flags) || []) {
    if (g.severity !== 'info') lines.push(`Guardrail: ${g.text}`);
  }
  lines.push(rec.recordingUrl ? `Recording: ${rec.recordingUrl}` : 'Recording: not provided');
  return lines.join('\n');
}

/**
 * Process one call payload into a stored record (without sending notifications).
 * opts.env lets tests control env vars; opts.useGemini=false forces rules only.
 * The stored transcript is the redacted one: PII is never kept.
 */
async function processCall(payload, opts = {}) {
  const env = opts.env || process.env;
  const guardrails = runGuardrails(payload.transcript);
  const lines = guardrails.redactedTranscript;
  const { fullText } = normaliseTranscript(lines);
  const fields = extractFields(lines, payload);

  let ai = { used: false, skipped: 'disabled' };
  if (opts.useGemini !== false) {
    ai = await geminiExtract(fullText, env);
    if (ai.used) {
      for (const [k, v] of Object.entries(ai.fields)) {
        if (fields[k] == null && v != null)
          fields[k] = ['areaSqft', 'budgetLakh'].includes(k) ? Number(v) : v;
      }
    }
  }

  const qualification = scoreLead(fields);
  if (fields.askedAboutPrice) qualification.notes.push(PRICE_ASKED_NOTE);
  const estimate = internalEstimate(fields);
  const brief = (ai.used && ai.brief) || ruleBrief(fields, qualification, estimate, payload.bookedSlot);
  const answeredAfterSec = Number(payload.answeredAfterSec ?? 0); // Vaani picks up live; 0 unless Vaani reports a ring delay

  const rec = {
    id: String(payload.callId || `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    callId: String(payload.callId || ''),
    demo: !!payload.demo,
    receivedAt: new Date().toISOString(),
    startedAt: payload.startedAt || new Date().toISOString(),
    durationSec: Number(payload.durationSec) || 0,
    answeredAfterSec,
    answeredWithin5Min: answeredAfterSec <= FIVE_MIN,
    afterHours: isAfterHours(payload.startedAt || new Date().toISOString()),
    callerName: fields.name,
    phone: fields.phone,
    bookedSlot: payload.bookedSlot || null,
    recordingUrl: payload.recordingUrl || null,
    transcript: lines,
    fields,
    qualification,
    internalEstimate: estimate,
    guardrails: { flags: guardrails.flags, needsReview: guardrails.needsReview },
    brief,
    extraction: ai.used
      ? `rules + Gemini (${ai.model})`
      : `rules only${ai.error ? ' (Gemini failed: ' + ai.error + ')' : ''}`,
    costInr: callCost(payload.durationSec),
    notification: null,
    status: guardrails.needsReview ? 'needs-review' : 'new',
  };
  if (!rec.callId) rec.callId = rec.id;
  rec.note = buildNote(rec);
  return rec;
}

module.exports = { processCall, isAfterHours, buildNote, PRICE_ASKED_NOTE };
