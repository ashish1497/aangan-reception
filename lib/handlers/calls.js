// GET /api/calls          list (summary rows)
// GET /api/calls?id=...   full detail for one call
// Add ?demo=1 to include sample calls.
const { sendJson, getQuery } = require('../http');
const store = require('../store');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Use GET' });
  const q = getQuery(req);
  try {
    if (q.id) {
      const rec = await store.getRecord(q.id, q);
      if (!rec) return sendJson(res, 404, { error: 'Not found' });
      return sendJson(res, 200, rec);
    }
    const all = await store.listRecords(q);
    const rows = all.map(toRow);
    return sendJson(res, 200, {
      storage: store.backend(),
      demoShown: store.demoEnabled(q),
      count: rows.length,
      calls: rows,
    });
  } catch (e) {
    return sendJson(res, 500, { error: 'Could not load calls', detail: e.message });
  }
};

function toRow(r) {
  return {
    id: r.id,
    demo: !!r.demo,
    startedAt: r.startedAt,
    callerName: r.callerName,
    phone: r.phone,
    qualification: r.qualification.status,
    internalEstimate: r.internalEstimate ? r.internalEstimate.label : null,
    guardrailFlags: r.guardrails ? r.guardrails.flags.filter((g) => g.severity !== 'info').length : 0,
    needsReview: !!(r.guardrails && r.guardrails.needsReview),
    bookedSlot: r.bookedSlot,
    status: r.status,
    afterHours: r.afterHours,
  };
}

module.exports.toRow = toRow;
