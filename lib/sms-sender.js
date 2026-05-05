/**
 * sms-sender.js
 * 
 * Sends SMS via Quo API.
 * From: Dwellia Guest (865) 252-5100 — PN13L1JX0K
 * To:   Dwellia Admin (865) 281-1917
 * 
 * Required env vars:
 *   QUO_API_KEY — from Quo workspace settings
 */

const QUO_API_BASE    = 'https://api.openphone.com/v1';
const FROM_NUMBER     = '+18652525100';  // Dwellia Guest
const FROM_NUMBER_ID  = 'PN13L1JX0K';   // Dwellia Guest phone ID
const TO_NUMBER       = '+18652811917';  // Dwellia Admin

export async function sendOwnerSMS(body) {
  if (!process.env.QUO_API_KEY) throw new Error('QUO_API_KEY env var not set');

  const response = await fetch(`${QUO_API_BASE}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': process.env.QUO_API_KEY,
    },
    body: JSON.stringify({
      content: body,
      from: FROM_NUMBER,
      phoneNumberId: FROM_NUMBER_ID,
      to: [TO_NUMBER],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Quo SMS failed (${response.status}): ${error}`);
  }

  console.log('SMS sent via Quo — Guest → Admin');
  return await response.json();
}
