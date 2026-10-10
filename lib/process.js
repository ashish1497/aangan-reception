// The call-processing pipeline: extract, (optional Gemini), score, price, brief, note.
const { extractFields, normaliseTranscript } = require('./extract');
const { geminiExtract } = require('./gemini');
const { scoreLead } = require('./rubric');
const { priceRange } = require('./pricing');
const { callCost } = require('./cost');

const FIVE_MIN = 300;

// Case fact: about 33% of enquiries arrive outside 10am to 7pm. Hours are IST.
function isAfterHours(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const istMinutes = (d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440;
  return istMinutes < 600 || istMinutes >= 1140;
}

function ruleBrief(f, q, price, bookedSlot) {
  const who = `${f.name || 'Caller (name not given)'}${f.phone ? ', ' + f.phone : ''}${f.email ? ', ' + f.email : ''}`;
  const space = `${f.projectType ? (f.projectType === 'home' ? 'Home' : 'Office') : 'Space type unclear'}${f.bhk ? ', ' + f.bhk + ' BHK' : ''} in ${f.locality ? f.locality + ', ' : ''}${f.city || 'location not given'}`;
  const size = `${f.areaSqft ? f.areaSqft + ' sq ft' : 'Area not given'}; budget ${f.budgetText || 'not stated'}; indicative ${price ? price.label : 'range not computed'}`;
  const timing = `Timeline: ${f.timeline || 'not stated'}. Preferred contact: ${f.preferredTime || 'not stated'}. ${bookedSlot ? 'Booked on call: ' + bookedSlot : 'No slot booked yet'}`;
  const prep =
    q.status === 'qualified'
      ? 'Prepare: portfolio of similar ' + (f.projectType || '') + ' projects; confirm site visit'
      : 'Front desk: check the reasons below before a designer is assigned';
  return [who, space, size, timing, prep].join('\n');
}

function buildNote(rec) {
  const f = rec.fields;
  const lines = [
    `AANGAN VOICE DESK: ${rec.qualification.status.toUpperCase()} enquiry${rec.demo ? ' [SAMPLE CALL]' : ''}`,
    `Call ${rec.callId} at ${rec.startedAt}${rec.afterHours ? ' (after hours)' : ''}`,
    '',
    rec.brief,
    '',
    'Why: ' + rec.qualification.reasons.join('; '),
    rec.price
      ? `Price: ${rec.price.label}. ${rec.price.disclaimer}`
      : 'Price: not computed (area or type missing)',
    rec.recordingUrl ? `Recording: ${rec.recordingUrl}` : 'Recording: not provided',
  ];
  if (f.hostile) lines.push('Note: caller was hostile. Handle with care.');
  return lines.join('\n');
}

/**
 * Process one call payload into a stored record (without sending notifications).
 * opts.env lets tests control env vars; opts.useGemini=false forces rules only.
 */
async function processCall(payload, opts = {}) {
  const env = opts.env || process.env;
  const { fullText, lines } = normaliseTranscript(payload.transcript);
  const fields = extractFields(payload.transcript, payload);

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
  const price = priceRange(fields);
  const brief = (ai.used && ai.brief) || ruleBrief(fields, qualification, price, payload.bookedSlot);
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
    price,
    brief,
    extraction: ai.used
      ? `rules + Gemini (${ai.model})`
      : `rules only${ai.error ? ' (Gemini failed: ' + ai.error + ')' : ''}`,
    costInr: callCost(payload.durationSec),
    notification: null,
    status: 'new',
  };
  if (!rec.callId) rec.callId = rec.id;
  rec.note = buildNote(rec);
  return rec;
}

module.exports = { processCall, isAfterHours, buildNote };
