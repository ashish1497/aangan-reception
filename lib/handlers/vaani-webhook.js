// POST /api/vaani-webhook : Vaani calls this after each incoming phone call ends.
const crypto = require('crypto');
const { sendJson, readBody } = require('../http');
const { processCall } = require('../process');
const { sendTelegram } = require('../telegram');
const store = require('../store');

function secretOk(req) {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) return true;
  const got = String(
    (req.headers && (req.headers['x-webhook-secret'] || req.headers['X-Webhook-Secret'])) || '',
  );
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Use POST' });
  if (!secretOk(req)) return sendJson(res, 401, { error: 'Bad or missing x-webhook-secret' });

  let payload;
  try {
    payload = await readBody(req);
  } catch {
    return sendJson(res, 400, { error: 'Body must be JSON' });
  }
  if (!payload || (!payload.transcript && payload.transcript !== '')) {
    return sendJson(res, 400, { error: 'Missing transcript' });
  }
  payload.demo = false; // webhook input is never demo data

  try {
    const rec = await processCall(payload);
    const status = rec.qualification.status;
    if (status === 'qualified' || status === 'grey') {
      const audience = status === 'qualified' ? 'designers' : 'front desk (human check)';
      const n = await sendTelegram(`[For ${audience}]\n` + rec.note);
      rec.notification = { ...n, audience };
      rec.status =
        status === 'qualified'
          ? n.status === 'sent'
            ? 'designer notified'
            : 'awaiting designer'
          : 'needs human check';
    } else {
      rec.notification = {
        channel: 'none',
        status: 'not sent',
        audience: 'none',
        detail: 'Unqualified: logged for front desk review only',
      };
      rec.status = 'logged, not routed';
    }
    // A guardrail violation (the agent slipped) always needs a person to review the call.
    // Qualification is left as it is.
    if (rec.guardrails && rec.guardrails.needsReview) rec.status = 'needs-review';
    await store.addRecord(rec);
    return sendJson(res, 200, {
      ok: true,
      id: rec.id,
      qualification: rec.qualification,
      internalEstimate: rec.internalEstimate,
      guardrails: rec.guardrails,
      notification: rec.notification,
      storage: store.backend(),
      extraction: rec.extraction,
      record: rec,
    });
  } catch (e) {
    console.error('[vaani-webhook] failed', e);
    return sendJson(res, 500, { error: 'Processing failed', detail: e.message });
  }
};
