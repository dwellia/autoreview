/**
 * webhook-auth.js
 * 
 * Verifies that incoming webhooks actually came from Hospitable.
 * Without this, anyone who finds your endpoint URL could spam it.
 * 
 * Hospitable signs webhooks using HMAC-SHA256.
 * Set HOSPITABLE_WEBHOOK_SECRET in your Vercel env vars.
 * Find the secret in your Hospitable dashboard → Integrations → Webhooks.
 */

import crypto from 'crypto';

/**
 * @param {import('@vercel/node').VercelRequest} req
 * @returns {boolean}
 */
export function verifyHospitableSignature(req) {
  const secret = process.env.HOSPITABLE_WEBHOOK_SECRET;

  // If no secret is configured, skip verification (useful during local dev)
  // but log a warning so you don't forget to set it in production
  if (!secret) {
    console.warn('⚠️  HOSPITABLE_WEBHOOK_SECRET not set — skipping signature verification. Set this in production!');
    return true;
  }

  // Hospitable sends the signature in the "Signature" header
  // Format: HMAC-SHA256 hex digest of the raw payload using your webhook secret
  const signatureHeader = req.headers['signature'] || req.headers['Signature'] || '';

  if (!signatureHeader) {
    console.error('No Signature header found in request');
    return false;
  }

  // Hospitable sends the raw HMAC-SHA256 hex digest (no "sha256=" prefix)
  const receivedDigest = signatureHeader.trim();

  // Compute expected signature from raw request body
  const rawBody = JSON.stringify(req.body);
  const expectedDigest = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  let isValid;
  try {
    isValid = crypto.timingSafeEqual(
      Buffer.from(receivedDigest, 'hex'),
      Buffer.from(expectedDigest, 'hex')
    );
  } catch {
    // Buffer lengths won't match if digest is malformed
    isValid = false;
  }

  if (!isValid) {
    console.error('Signature mismatch — webhook rejected');
  }

  return isValid;
}
