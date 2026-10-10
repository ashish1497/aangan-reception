// Shared test helpers. Clears integration env vars so no test can reach the network.
const KEYS = [
  'GEMINI_API_KEY',
  'GOOGLE_GEMINI_KEY',
  'GOOGLE_GEMINI_KEY_2',
  'GOOGLE_GEMINI_KEY_3',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'WEBHOOK_SECRET',
  'DEMO_DATA',
  'VOICE_COST_PER_MIN',
  'LLM_COST_PER_CALL',
];
function cleanEnv() {
  for (const k of KEYS) delete process.env[k];
}
function blockNetwork() {
  const real = global.fetch;
  const state = { calls: 0 };
  global.fetch = async (url) => {
    state.calls++;
    throw new Error('Unexpected network call: ' + url);
  };
  return {
    state,
    restore: () => {
      global.fetch = real;
    },
  };
}
function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    end(s) {
      this.body = s ? JSON.parse(s) : null;
    },
  };
}
module.exports = { cleanEnv, blockNetwork, mockRes, KEYS };
