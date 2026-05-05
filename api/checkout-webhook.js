/**
 * Dwellia — VRBO Auto-Review Webhook
 * 
 * Receives Hospitable checkout webhooks, filters for VRBO bookings,
 * generates a review draft via Claude, and texts the owner.
 * 
 * Deploy to Vercel. Set these environment variables:
 *   ANTHROPIC_API_KEY       — your Anthropic key
 *   HOSPITABLE_WEBHOOK_SECRET — from Hospitable dashboard (for signature verification)
 *   QUO_API_KEY             — Quo API key (add when confirmed available)
 *   QUO_API_URL             — Quo API base URL (add when confirmed)
 *   OWNER_PHONE             — your phone number to receive texts (e.g. +13035551234)
 *   TWILIO_ACCOUNT_SID      — (fallback if Quo API unavailable)
 *   TWILIO_AUTH_TOKEN       — (fallback if Quo API unavailable)
 *   TWILIO_FROM_NUMBER      — (fallback if Quo API unavailable)
 */

import { generateReviewDraft } from '../lib/review-generator.js';
import { sendOwnerSMS } from '../lib/sms-sender.js';
import { verifyHospitableSignature } from '../lib/webhook-auth.js';

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify this actually came from Hospitable
  const isValid = verifyHospitableSignature(req);
  if (!isValid) {
    console.error('Invalid webhook signature — rejected');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const event = req.body;
  console.log('Received Hospitable event:', event?.event_type, event?.booking?.id);

  // Only process checkout events
  if (event?.event_type !== 'booking.checkout') {
    return res.status(200).json({ message: 'Not a checkout event, skipping' });
  }

  const booking = event?.booking;
  if (!booking) {
    return res.status(400).json({ error: 'No booking data in payload' });
  }

  // Only process VRBO bookings
  // Hospitable uses "homeaway" as the platform value for VRBO bookings
  const platform = (booking.platform || '').toLowerCase();
  const isVRBO = platform === 'homeaway';

  if (!isVRBO) {
    console.log(`Booking ${booking.id} is from platform "${booking.platform}" — not VRBO, skipping`);
    return res.status(200).json({ message: 'Not a VRBO booking, skipping' });
  }

  console.log(`VRBO checkout detected — booking ${booking.id}, guest: ${booking.guest?.first_name} ${booking.guest?.last_name}`);

  // Extract what we need
  const guestInfo = {
    firstName: booking.guest?.first_name || 'Guest',
    lastName: booking.guest?.last_name || '',
    fullName: `${booking.guest?.first_name || ''} ${booking.guest?.last_name || ''}`.trim(),
    propertyName: booking.listing?.name || 'the property',
    bookingId: booking.id,
    checkIn: booking.check_in,
    checkOut: booking.check_out,
  };

  // Generate review draft via Claude
  let reviewDraft;
  try {
    reviewDraft = await generateReviewDraft(guestInfo);
  } catch (err) {
    console.error('Failed to generate review draft:', err);
    return res.status(500).json({ error: 'Review generation failed' });
  }

  // Build the VRBO review URL
  // VRBO review links follow this pattern — owner goes to their dashboard to find the specific one
  // We deep-link as close as possible; the owner will see their pending reviews listed
  const vrboReviewDashboardUrl = 'https://www.vrbo.com/owner/reviews';

  // Build the SMS message
  const smsBody = buildSMSMessage(guestInfo, reviewDraft, vrboReviewDashboardUrl);

  // Send the text
  try {
    await sendOwnerSMS(smsBody);
    console.log('SMS sent to owner successfully');
  } catch (err) {
    console.error('Failed to send SMS:', err);
    // Don't fail the whole webhook — log it and return 200 so Hospitable doesn't retry
    // In production you'd want a fallback alert here (email, etc.)
    return res.status(200).json({ 
      message: 'Review generated but SMS failed — check logs',
      reviewDraft 
    });
  }

  return res.status(200).json({ 
    message: 'Success — review draft generated and owner notified',
    guestName: guestInfo.fullName,
    property: guestInfo.propertyName
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
