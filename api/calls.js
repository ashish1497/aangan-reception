// GET /api/calls          list (summary rows)
// GET /api/calls?id=...   full detail for one call
// Add ?demo=0 to hide SYNTHETIC demo calls.
const { sendJson, getQuery } = require('../lib/http');
const store = require('../lib/store');

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
    const rows = all.map((r) => ({
      id: r.id,
      demo: !!r.demo,
      startedAt: r.startedAt,
      callerName: r.callerName,
      phone: r.phone,
      qualification: r.qualification.status,
      price: r.price ? r.price.label : null,
      bookedSlot: r.bookedSlot,
      status: r.status,
      afterHours: r.afterHours,
    }));
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
