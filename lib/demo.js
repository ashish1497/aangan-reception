// Sample calls so the dashboard can be explored before real calls arrive.
// They are not real enquiries and every record is flagged demo:true.
// Shown only on request: ?demo=1, or DEMO_DATA=on on the server.
// The agent lines follow policy/pricing.md: no prices, only the scripted deflection.
const { processCall } = require('./process');
const { PRICING } = require('./pricing');

function ago(hours) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

const DEMO_PAYLOADS = [
  {
    callId: 'demo-01',
    callerName: 'Demo Caller A',
    phone: '+91 90000 00001',
    startedAt: ago(2),
    durationSec: 260,
    bookedSlot: 'Sat 11:00 site visit',
    transcript: [
      { speaker: 'agent', text: 'Namaste, Aangan Studio. How can I help?' },
      {
        speaker: 'caller',
        text: 'We just got possession of a 3 BHK flat in Baner, about 1450 sq ft. We want the full flat designed and done, ideally complete in three months.',
      },
      { speaker: 'agent', text: 'Lovely. Are you the one deciding on the project?' },
      { speaker: 'caller', text: 'Yes, my wife and I are deciding together, I am authorised to go ahead.' },
    ],
  },
  {
    callId: 'demo-02',
    callerName: 'Demo Caller B',
    phone: '+91 90000 00002',
    startedAt: ago(5),
    durationSec: 310,
    transcript: [
      { speaker: 'agent', text: 'Aangan Studio, good evening.' },
      {
        speaker: 'caller',
        text: 'We need our office in Hinjewadi done, 2200 sq ft, workstations and two cabins, within 4 months. Call me tomorrow morning.',
      },
    ],
  },
  {
    callId: 'demo-03',
    callerName: 'Demo Caller C',
    phone: '+91 90000 00003',
    startedAt: ago(9),
    durationSec: 140,
    transcript: [
      { speaker: 'agent', text: 'Aangan Studio, hello.' },
      { speaker: 'caller', text: 'I have a 2 BHK in Nashik, 800 sq ft, want it redone in two months.' },
      {
        speaker: 'agent',
        text: 'Thank you for thinking of us. We only work in Pune city and PCMC, so we would not be the right fit for a site in Nashik.',
      },
    ],
  },
  {
    callId: 'demo-04',
    callerName: 'Demo Caller D',
    phone: '+91 90000 00004',
    startedAt: ago(14),
    durationSec: 220,
    transcript: [
      { speaker: 'agent', text: 'Aangan Studio.' },
      {
        speaker: 'caller',
        text: 'Just the master bedroom in our Kothrud flat, full redesign with wardrobe and execution. We would like it done in two months. How much would that cost?',
      },
      { speaker: 'agent', text: PRICING.DEFLECTION },
    ],
  },
  {
    callId: 'demo-05',
    callerName: 'Demo Caller E',
    phone: '+91 90000 00005',
    startedAt: ago(20),
    durationSec: 200,
    transcript: [
      { speaker: 'agent', text: 'Aangan Studio, how can I help?' },
      {
        speaker: 'caller',
        text: 'My 2 BHK in Wakad needs to be fully done in 3 weeks, family is moving in.',
      },
    ],
  },
  {
    callId: 'demo-06',
    callerName: 'Demo Caller F',
    phone: '+91 90000 00006',
    startedAt: ago(26),
    durationSec: 180,
    transcript: [
      { speaker: 'agent', text: 'Aangan Studio, good morning.' },
      {
        speaker: 'caller',
        text: 'I have a flat in Aundh. I am just looking for ideas, can someone come and advise? I will do the execution myself.',
      },
    ],
  },
  {
    callId: 'demo-07',
    callerName: 'Demo Caller G',
    phone: '+91 90000 00007',
    startedAt: ago(31),
    durationSec: 150,
    transcript: [
      { speaker: 'agent', text: 'Aangan Studio, hello.' },
      {
        speaker: 'caller',
        text: 'We have a 2 BHK, possession done, and want the whole flat designed, complete in about three months.',
      },
    ],
  },
  {
    callId: 'demo-08',
    callerName: 'Demo Caller H',
    phone: '+91 90000 00008',
    startedAt: ago(40),
    durationSec: 60,
    transcript: [
      { speaker: 'agent', text: 'Aangan Studio.' },
      {
        speaker: 'caller',
        text: 'Your people never called back, this is useless. My flat in Viman Nagar is 1100 sq ft, needed in two months.',
      },
    ],
  },
];

let cache = null;
async function getDemoRecords() {
  if (cache) return cache;
  const out = [];
  for (const p of DEMO_PAYLOADS) {
    const rec = await processCall({ ...p, demo: true }, { useGemini: false });
    rec.notification = { channel: 'none', status: 'not sent', detail: 'Sample call: no notification sent' };
    rec.status = rec.guardrails.needsReview ? 'needs-review' : 'demo';
    out.push(rec);
  }
  cache = out;
  return out;
}

module.exports = { getDemoRecords, DEMO_PAYLOADS };
