/**
 * hospitable-client.js
 * 
 * Fetches reservation messages from Hospitable Public API
 * to give Claude context for writing a personalized review.
 * 
 * Required env var: HOSPITABLE_API (Personal Access Token)
 */

const HOSPITABLE_API_BASE = 'https://public.api.hospitable.com';

/**
 * Fetch guest messages for a reservation and return as a readable transcript.
 * @param {string} reservationId — UUID from event.data.reservation.id
 * @returns {string|null} — formatted guest messages, or null if unavailable
 */
export async function getReservationTranscript(reservationId) {
  if (!reservationId) return null;
  if (!process.env.HOSPITABLE_API) {
    console.warn('HOSPITABLE_API not set — skipping message fetch');
    return null;
  }

  try {
    const response = await fetch(
      `${HOSPITABLE_API_BASE}/v2/reservations/${reservationId}/messages`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.HOSPITABLE_API}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn(`Hospitable API ${response.status} for reservation ${reservationId}`);
      return null;
    }

    const json = await response.json();
    const messages = json?.data;

    if (!Array.isArray(messages) || messages.length === 0) return null;

    // Guest messages only, last 10, non-empty bodies
    const guestMessages = messages
      .filter(m => m.sender_type === 'guest' && m.body?.trim())
      .slice(-10)
      .map(m => m.body.trim());

    if (guestMessages.length === 0) return null;

    console.log(`Fetched ${guestMessages.length} guest messages for review context`);
    return guestMessages.join('\n---\n');

  } catch (err) {
    console.warn('Failed to fetch Hospitable messages:', err.message);
    return null; // non-fatal — review still generates without context
  }
}
