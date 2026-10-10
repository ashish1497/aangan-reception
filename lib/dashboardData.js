// Data for the server-rendered dashboard. Reads the store directly, no HTTP hop.
const store = require('./store');
const { computeStats } = require('./handlers/stats');
const { toRow } = require('./handlers/calls');

function ist(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return String(iso || '');
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function inr(n) {
  // Whole rupees for totals, up to two decimals for rates such as Rs 5.5 a minute.
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return 'Rs ' + v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function lakh(n) {
  return 'Rs ' + ((n || 0) / 100000).toLocaleString('en-IN', { maximumFractionDigits: 1 }) + ' lakh';
}

function flag(v) {
  if (v === '1' || v === 'on' || v === 'true') return true;
  if (v === '0' || v === 'off' || v === 'false') return false;
  return null;
}

/** Reads ?samples= and ?count= with the same defaults as the API. */
function readOptions(searchParams = {}) {
  const samples = flag(searchParams.samples);
  const count = flag(searchParams.count);
  return {
    showSamples: samples === null ? store.demoEnabled({}) : samples,
    countSamples: count === true,
    call: typeof searchParams.call === 'string' ? searchParams.call : null,
  };
}

async function getDashboard(searchParams) {
  const opts = readOptions(searchParams);
  const [listed, forStats] = await Promise.all([
    store.listRecords({ demo: opts.showSamples ? '1' : '0' }),
    store.listRecords({ demo: opts.countSamples ? '1' : '0' }),
  ]);
  const statsRecords = opts.countSamples ? forStats : forStats.filter((r) => !r.demo);
  const stats = { storage: store.backend(), includesDemo: opts.countSamples, ...computeStats(statsRecords) };
  const rows = listed.map(toRow).map((r) => ({
    ...r,
    time: ist(r.startedAt),
    estimateShort: r.internalEstimate ? r.internalEstimate.replace(/^[^:]*:\s*/, '') : 'not computed',
  }));
  const detail = opts.call ? await store.getRecord(opts.call, {}) : null;
  return { opts, stats, rows, detail };
}

async function getCall(id) {
  return store.getRecord(id, {});
}

module.exports = { getDashboard, getCall, readOptions, ist, inr, lakh };
