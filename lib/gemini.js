// Optional Gemini REST call. Only runs when GEMINI_API_KEY is set.
// Any error returns { used: false, error } so the caller falls back to rules.

const FIELDS = ['name', 'email', 'projectType', 'city', 'locality', 'areaSqft', 'budgetLakh', 'timeline', 'preferredTime'];

async function geminiExtract(fullText, env = process.env) {
  const key = env.GEMINI_API_KEY;
  if (!key) return { used: false, skipped: 'GEMINI_API_KEY not set' };
  const model = env.GEMINI_MODEL || 'gemini-2.0-flash';
  const prompt =
    'You read a phone call transcript between an AI receptionist and a caller enquiring about interior design ' +
    'from Aangan Studio, Pune. Return ONLY JSON with keys: name, email, projectType ("home" or "office" or null), ' +
    'city, locality, areaSqft (number or null), budgetLakh (number in lakh rupees or null), timeline, preferredTime, ' +
    'brief (exactly 5 short lines separated by \\n for a designer: who, what space, size and budget, timing, what to prepare). ' +
    'Use null for anything the caller did not say. Do not guess.\n\nTRANSCRIPT:\n' + fullText;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 }
      }),
      signal: ctrl.signal
    });
    if (!res.ok) return { used: false, error: `Gemini HTTP ${res.status}` };
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { used: false, error: 'Gemini returned no text' };
    const parsed = JSON.parse(text);
    const fields = {};
    for (const k of FIELDS) if (parsed[k] !== undefined && parsed[k] !== '') fields[k] = parsed[k];
    if (fields.projectType && !['home', 'office'].includes(fields.projectType)) delete fields.projectType;
    for (const k of ['areaSqft', 'budgetLakh']) if (fields[k] != null && !Number.isFinite(Number(fields[k]))) delete fields[k];
    return { used: true, model, fields, brief: typeof parsed.brief === 'string' ? parsed.brief : null };
  } catch (e) {
    return { used: false, error: `Gemini error: ${e.name === 'AbortError' ? 'timeout' : e.message}` };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { geminiExtract };
