// Storage. Upstash Redis REST when configured, otherwise in-memory.
// WARNING: in-memory storage on Vercel serverless is NOT durable. Each cold
// start or new instance begins empty, so real calls can disappear.
const { getDemoRecords } = require('./demo');

const KEY = 'aangan:calls';
// Kept on globalThis so every Next.js route in one server process shares the same list.
const memory = globalThis.__aanganMemory || (globalThis.__aanganMemory = []);
let warned = false;

function upstashConfigured(env = process.env) {
  return !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

function backend() {
  return upstashConfigured() ? 'upstash' : 'memory';
}

async function upstash(command) {
  const res = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Upstash: ${data.error}`);
  return data.result;
}

function warnMemory() {
  if (!warned) {
    warned = true;
    console.warn(
      '[store] WARNING: UPSTASH_REDIS_REST_URL/TOKEN not set. Using in-memory storage. ' +
        'On Vercel this is NOT durable: records vanish on cold start and are not shared between instances.',
    );
  }
}

async function addRecord(rec) {
  if (upstashConfigured()) {
    await upstash(['LPUSH', KEY, JSON.stringify(rec)]);
    await upstash(['LTRIM', KEY, '0', '1999']);
    return;
  }
  warnMemory();
  memory.unshift(rec);
}

async function realRecords() {
  if (upstashConfigured()) {
    const rows = await upstash(['LRANGE', KEY, '0', '1999']);
    return (rows || [])
      .map((r) => {
        try {
          return JSON.parse(r);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }
  warnMemory();
  return memory.slice();
}

// Sample calls are opt in: ?demo=1 on the request, or DEMO_DATA=on on the server.
function demoEnabled(query = {}) {
  if (query.demo === '0' || query.demo === 'off') return false;
  if (query.demo === '1' || query.demo === 'on') return true;
  return String(process.env.DEMO_DATA || '').toLowerCase() === 'on';
}

/** All records, newest first. Demo records included only if demo is enabled. */
async function listRecords(query = {}) {
  const real = await realRecords();
  const demo = demoEnabled(query) ? await getDemoRecords() : [];
  return real.concat(demo).sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
}

async function getRecord(id, query = {}) {
  const all = await listRecords({ ...query, demo: '1' });
  return all.find((r) => r.id === id) || null;
}

function _resetMemory() {
  memory.length = 0;
}

module.exports = { addRecord, listRecords, getRecord, backend, demoEnabled, _resetMemory };
