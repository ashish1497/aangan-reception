// Send one sample call to a running copy of the app, as Vaani would after a call.
//   node scripts/send-test-call.js https://aangan-reception.vercel.app [scenario]
// Reads WEBHOOK_SECRET from the environment if it is set. Scenarios: good, price, nashik, soon.
const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const which = process.argv[3] || 'good';
const T = {
  good: "AI: Hello, this is Aangan Studio's assistant. This call is recorded. How can I help you today?\nCaller: Hi, I am Rohan. I want the full interior of my 3 BHK flat in Baner, Pune, about 1,400 sq ft. We would like it complete in four months.\nAI: Lovely. Which day suits you for a consultation?\nCaller: Tomorrow at eleven works. My email is rohan@example.com.",
  price:
    'AI: Hello, how can I help you today?\nCaller: 2 BHK in Wakad, 950 sq ft, full redesign, done in three months. What will it cost, just a ballpark?\nAI: Pricing depends on the site, the materials you choose, and the scope. Your designer will walk you through it at the consultation.\nCaller: Okay, book it.',
  nashik:
    'AI: Hello, how can I help you today?\nCaller: I have a flat in Nashik, 1,200 sq ft, I want it redone.\nAI: We only work in Pune and Pimpri-Chinchwad, so this may not be the right fit right now.',
  soon: 'AI: Hello, how can I help you today?\nCaller: 3 BHK in Kothrud, 1,100 sq ft, I need it done in four weeks.\nAI: We need at least six weeks before we can begin execution.',
};
const body = {
  call_id: `test-${which}-${Date.now()}`,
  caller_number: '+919800000000',
  customer_name: 'Test Caller',
  start_time: new Date().toISOString(),
  duration_seconds: 180,
  transcript: T[which] || T.good,
};
const headers = { 'content-type': 'application/json' };
if (process.env.WEBHOOK_SECRET) headers['x-webhook-secret'] = process.env.WEBHOOK_SECRET;
fetch(base + '/api/vaani-webhook', { method: 'POST', headers, body: JSON.stringify(body) })
  .then(async (r) => {
    const j = await r.json().catch(() => ({}));
    console.log(
      r.status,
      JSON.stringify({
        ok: j.ok,
        id: j.id,
        status: j.qualification && j.qualification.status,
        notification: j.notification && j.notification.status,
        storage: j.storage,
      }),
    );
  })
  .catch((e) => console.error('failed', e.message));
