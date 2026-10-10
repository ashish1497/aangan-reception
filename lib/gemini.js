// Optional Gemini REST call with key rotation, same idea as the ares scraper.
// Keys: GOOGLE_GEMINI_KEY, GOOGLE_GEMINI_KEY_2, GOOGLE_GEMINI_KEY_3 (and the
// older GEMINI_API_KEY as a last resort). On a rate-limit, quota, 5xx or
// timeout error it rotates to the next key and retries the same call.
// Any final error returns { used: false, error } so the caller falls back to rules.

const FIELDS = [
  'name',
  'email',
  'projectType',
  'city',
  'locality',
  'areaSqft',
  'budgetLakh',
  'timeline',
  'preferredTime',
];
const KEY_NAMES = ['GOOGLE_GEMINI_KEY', 'GOOGLE_GEMINI_KEY_2', 'GOOGLE_GEMINI_KEY_3', 'GEMINI_API_KEY'];
const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);

// Kept across calls so a warm serverless instance does not keep starting from a throttled key.
let keyIndex = 0;

function geminiKeys(env = process.env) {
  const seen = new Set();
  const keys = [];
  for (const n of KEY_NAMES) {
    const v = (env[n] || '').trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      keys.push(v);
    }
  }
  return keys;
}

async function callOnce(key, model, prompt) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0 },
        }),
        signal: ctrl.signal,
      },
    );
    if (!res.ok) {
      const err = new Error(`Gemini HTTP ${res.status}`);
      err.retryable = RETRY_STATUS.has(res.status);
      throw err;
    }
    return await res.json();
  } catch (e) {
    if (e.name === 'AbortError') {
      const t = new Error('timeout');
      t.retryable = true;
      throw t;
    }
    if (e.retryable === undefined) e.retryable = true; // network errors
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function geminiExtract(fullText, env = process.env) {
  const keys = geminiKeys(env);
  if (!keys.length) return { used: false, skipped: 'no GOOGLE_GEMINI_KEY set' };
  const model = env.GEMINI_MODEL || 'gemini-flash-latest';
  const prompt =
    'You read a phone call transcript between an AI receptionist and a caller enquiring about interior design ' +
    'from Aangan Studio, Pune. Return ONLY JSON with keys: name, email, projectType ("home" or "office" or null), ' +
    'city, locality, areaSqft (number or null), budgetLakh (number in lakh rupees or null), timeline, preferredTime, ' +
    'brief (exactly 5 short lines separated by \\n for a designer: who, what space, size and budget, timing, what to prepare). ' +
    'Use null for anything the caller did not say. Do not guess.\n\nTRANSCRIPT:\n' +
    fullText;
  try {
    let data = null;
    let lastErr = null;
    for (let attempt = 0; attempt < keys.length; attempt++) {
      const i = (keyIndex + attempt) % keys.length;
      try {
        data = await callOnce(keys[i], model, prompt);
        keyIndex = i;
        break;
      } catch (e) {
        lastErr = e;
        if (!e.retryable) break;
      }
    }
    if (!data) return { used: false, error: lastErr ? lastErr.message : 'Gemini failed' };
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { used: false, error: 'Gemini returned no text' };
    const parsed = JSON.parse(text);
    const fields = {};
    for (const k of FIELDS) if (parsed[k] !== undefined && parsed[k] !== '') fields[k] = parsed[k];
    if (fields.projectType && !['home', 'office'].includes(fields.projectType)) delete fields.projectType;
    for (const k of ['areaSqft', 'budgetLakh'])
      if (fields[k] != null && !Number.isFinite(Number(fields[k]))) delete fields[k];
    return { used: true, model, fields, brief: typeof parsed.brief === 'string' ? parsed.brief : null };
  } catch (e) {
    return { used: false, error: `Gemini error: ${e.message}` };
  }
}

module.exports = { geminiExtract, geminiKeys };
