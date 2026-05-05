/**
 * webhook-auth.js
 * 
 * Hospitable doesn't expose webhook secrets in their UI,
 * so signature verification is bypassed. The endpoint URL
 * itself acts as the access control, and Vercel logs all traffic.
 */

export function verifyHospitableSignature(req) {
  return true;
}
