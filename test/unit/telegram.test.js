const test = require('node:test');
const assert = require('node:assert');
const { blockNetwork } = require('../helpers');
const { sendTelegram } = require('../../lib/telegram');

test('skipped without token or chat id, no network', async () => {
  const net = blockNetwork();
  const r = await sendTelegram('hi', {});
  net.restore();
  assert.strictEqual(r.status, 'skipped');
  assert.strictEqual(net.state.calls, 0);
});

test('sends to the Telegram API when configured', async () => {
  const real = global.fetch;
  let url = '';
  global.fetch = async (u) => {
    url = String(u);
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  const r = await sendTelegram('hi', { TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_CHAT_ID: '1' });
  global.fetch = real;
  assert.strictEqual(r.status, 'sent');
  assert.ok(url.includes('api.telegram.org/botT/sendMessage'));
});

test('reports failure without throwing', async () => {
  const real = global.fetch;
  global.fetch = async () => {
    throw new Error('boom');
  };
  const r = await sendTelegram('hi', { TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_CHAT_ID: '1' });
  global.fetch = real;
  assert.notStrictEqual(r.status, 'sent');
});
