/**
 * Dwellia — VRBO Auto-Review Webhook
 * 
 * Receives Hospitable checkout webhooks, filters for VRBO bookings,
 * generates a review draft via Claude, and texts the owner.
 * 
 * Hospitable payload shape (v2):
 *   event.action       — e.g. "reservation.checkout"
 *   event.data         — the reservation object
 *   event.data.platform — e.g. "homeaway" for VRBO
 */

import { generateReviewDraft } from '../lib/review-generator.js';
import { sendOwnerSMS } from '../lib/sms-sender.js';
import { verifyHospitableSignature } from '../lib/webhook-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isValid = verifyHospitableSignature(req);
  if (!isValid) {
    console.error('Invalid webhook signature — rejected');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const event = req.body;
  const action = event?.action;
  const data   = event?.data;

  console.log('Hospitable action:', action);
  console.log('FULL PAYLOAD:', JSON.stringify(event, null, 2));

  // Only process checkout events
  // Hospitable v2 uses "reservation.checkout" as the action
  // NOTE: "review.created" is allowed temporarily for end-to-end testing — remove after confirmed working
  const isCheckout = action?.includes('checkout') || action === 'review.created';
  if (!isCheckout) {
    return res.status(200).json({ message: `Action "${action}" is not a checkout — skipping` });
  }

  if (!data) {
    return res.status(400).json({ error: 'No data in payload' });
  }

  // Only process VRBO bookings (Hospitable uses "homeaway" for VRBO)
  const platform = (data.platform || '').toLowerCase();
  // NOTE: 'airbnb' allowed temporarily for testing — remove after confirmed working
  const isVRBO   = platform === 'homeaway' || platform === 'airbnb';

  if (!isVRBO) {
    console.log(`Platform "${data.platform}" is not VRBO — skipping`);
    return res.status(200).json({ message: `Platform "${data.platform}" is not VRBO — skipping` });
  }

  console.log(`VRBO checkout detected — guest: ${data.guest?.first_name} ${data.guest?.last_name}`);

  // Extract guest info from Hospitable v2 payload shape
  const guestInfo = {
    firstName:    data.guest?.first_name  || data.sender?.first_name || 'Guest',
    lastName:     data.guest?.last_name   || data.sender?.last_name  || '',
    fullName:     data.guest?.full_name   || data.sender?.full_name  || 
                  `${data.guest?.first_name || ''} ${data.guest?.last_name || ''}`.trim(),
    propertyName: data.property?.public_name || data.property?.name || 
                  data.listing?.name || 'the property',
    checkIn:      data.reservation?.check_in  || data.check_in,
    checkOut:     data.reservation?.check_out || data.check_out,
  };

  // Generate review draft via Claude
  let reviewDraft;
  try {
    reviewDraft = await generateReviewDraft(guestInfo);
  } catch (err) {
    console.error('Failed to generate review draft:', err);
    return res.status(500).json({ error: 'Review generation failed' });
  }

  const vrboReviewDashboardUrl = 'https://www.vrbo.com/owner/reviews';
  const smsBody = buildSMSMessage(guestInfo, reviewDraft, vrboReviewDashboardUrl);

  try {
    await sendOwnerSMS(smsBody);
    console.log('SMS sent to owner successfully');
  } catch (err) {
    console.error('Failed to send SMS:', err);
    return res.status(200).json({
      message: 'Review generated but SMS failed — check logs',
      reviewDraft
    });
  }

  return res.status(200).json({
    message: 'Success — review draft generated and owner notified',
    guestName: guestInfo.fullName,
    property:  guestInfo.propertyName
  });
}

function buildSMSMessage(guestInfo, reviewDraft, vrboUrl) {
  return [
    `📋 VRBO Review — ${guestInfo.fullName} just checked out of ${guestInfo.propertyName}`,
    ``,
    `Here's your draft:`,
    `---`,
    reviewDraft,
    `---`,
    ``,
    `Submit it here 👉 ${vrboUrl}`,
    ``,
    `(Copy the draft above, paste it in, done.)`
  ].join('\n');
}
