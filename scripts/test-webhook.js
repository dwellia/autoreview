/**
 * test-webhook.js
 * 
 * Simulates a Hospitable VRBO checkout webhook locally.
 * Run this to test without needing a real booking.
 * 
 * Usage:
 *   1. Start local Vercel dev server:  npm run dev
 *   2. In another terminal:            node scripts/test-webhook.js
 */

const LOCAL_URL = 'http://localhost:3000/api/checkout-webhook';

// Simulated Hospitable checkout payload for a VRBO booking
const mockPayload = {
  event_type: 'booking.checkout',
  booking: {
    id: 'test-booking-12345',
    source: 'vrbo',                          // ← this is what triggers the VRBO filter
    check_in: '2026-05-01',
    check_out: '2026-05-04',
    guest: {
      first_name: 'Sarah',
      last_name: 'Mitchell',
    },
    listing: {
      name: 'Delta Dawn Retreat',            // ← swap to 'LeGobi Villa' to test Florida
    },
  },
};

async function runTest() {
  console.log('Sending test VRBO checkout webhook...\n');
  console.log('Payload:', JSON.stringify(mockPayload, null, 2), '\n');

  try {
    const response = await fetch(LOCAL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockPayload),
    });

    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Test failed:', err.message);
    console.error('Make sure your local dev server is running (npm run dev)');
  }
}

runTest();
