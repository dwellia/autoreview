/**
 * sms-sender.js
 * 
 * Sends SMS to the owner via Quo API.
 * Quo's API base URL: https://api.openphone.com/v1
 * 
 * Required env vars:
 *   QUO_API_KEY    — your Quo API key (from Quo workspace settings)
 *   QUO_FROM       — your Quo phone number in E.164 format (e.g. +13035550000)
 *   OWNER_PHONE    — the number to text, in E.164 format (e.g. +13035551234)
 * 
 * Optional env vars:
 *   QUO_USER_ID    — your Quo user ID (if omitted, defaults to phone number owner)
 */

const QUO_API_BASE = 'https://api.openphone.com/v1';

/**
 * Send an SMS to the owner.
 * @param {string} body — Full message text
 */
export async function sendOwnerSMS(body) {
  const ownerPhone = process.env.OWNER_PHONE;
  const quoApiKey  = process.env.QUO_API_KEY;
  const quoFrom    = process.env.QUO_FROM;

  if (!ownerPhone) throw new Error('OWNER_PHONE env var not set');
  if (!quoApiKey)  throw new Error('QUO_API_KEY env var not set');
  if (!quoFrom)    throw new Error('QUO_FROM env var not set (your Quo phone number)');

  const payload = {
    content: body,
    from: quoFrom,
    to: [ownerPhone],
  };

  // Optionally scope to a specific workspace user
  if (process.env.QUO_USER_ID) {
    payload.userId = process.env.QUO_USER_ID;
  }

  const response = await fetch(`${QUO_API_BASE}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': process.env.QUO_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Quo SMS failed (${response.status}): ${error}`);
  }

  console.log('SMS sent via Quo to', ownerPhone);
  return await response.json();
}
