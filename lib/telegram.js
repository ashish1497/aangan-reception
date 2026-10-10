// Optional Telegram notification. Skips cleanly when env vars are missing.
// Never throws: the webhook must not fail because a notification failed.

async function sendTelegram(text, env = process.env) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { channel: 'telegram', status: 'skipped', detail: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true })
    });
    if (!res.ok) return { channel: 'telegram', status: 'failed', detail: `HTTP ${res.status}` };
    return { channel: 'telegram', status: 'sent', detail: `chat ${chatId}` };
  } catch (e) {
    return { channel: 'telegram', status: 'failed', detail: e.message };
  }
}

module.exports = { sendTelegram };
