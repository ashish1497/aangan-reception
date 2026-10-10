// Sample calls so the dashboard can be explored before real calls arrive.
// They are not real enquiries and every record is flagged demo:true.
// Shown only on request: ?demo=1, or DEMO_DATA=on on the server.
const { processCall } = require('./process');

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
        text: 'We just got possession of a 3 BHK flat in Baner, about 1450 sq ft. Budget is 12 to 15 lakh, want to start next month.',
      },
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
        text: 'We need our office in Kharadi done, 2200 sq ft, around 25 lakh, within 2 months. Call me tomorrow morning.',
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
      { speaker: 'caller', text: 'I have a 2 BHK in Thane, 800 sq ft. Do you work in Mumbai side?' },
    ],
  },
  {
    callId: 'demo-04',
    callerName: 'Demo Caller D',
    phone: '+91 90000 00004',
    startedAt: ago(14),
    durationSec: 95,
    transcript: [
      { speaker: 'agent', text: 'Aangan Studio.' },
      { speaker: 'caller', text: 'Just a kitchen in Kothrud, maybe 120 sq ft, 2 lakh budget.' },
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
        text: 'Looking at a 1 BHK apartment in Wakad, roughly 360 sq ft, budget 6 lakh, no hurry.',
      },
    ],
  },
  {
    callId: 'demo-06',
    callerName: 'Demo Caller F',
    phone: '+91 90000 00006',
    startedAt: ago(26),
    durationSec: 180,
    bookedSlot: 'Mon 16:00 studio meeting',
    transcript: [
      { speaker: 'agent', text: 'Aangan Studio, good morning.' },
      {
        speaker: 'caller',
        text: 'I want to redo my bungalow in Aundh. Not sure of the size yet. Budget around 20 lakh.',
      },
    ],
  },
  {
    callId: 'demo-07',
    callerName: 'Demo Caller G',
    phone: '+91 90000 00007',
    startedAt: ago(31),
    durationSec: 420,
    transcript: [
      { speaker: 'agent', text: 'Aangan Studio, hello.' },
      {
        speaker: 'caller',
        text: 'Co-working space in Hinjewadi, 3500 sq ft, 40 lakh, start immediately. Email is demo.g@example.com',
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
        text: 'Your people never called back, this is useless. My flat in Viman Nagar is 1100 sq ft.',
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
    rec.status = 'demo';
    out.push(rec);
  }
  cache = out;
  return out;
}

module.exports = { getDemoRecords, DEMO_PAYLOADS };
