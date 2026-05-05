/**
 * review-generator.js
 * 
 * Uses Claude to write a genuine, personalized VRBO guest review.
 * If a conversation transcript is provided, Claude uses it to add
 * specific personal details from the actual stay.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * @param {object} guestInfo
 * @param {string} guestInfo.firstName
 * @param {string} guestInfo.fullName
 * @param {string} guestInfo.propertyName
 * @param {string} guestInfo.checkIn
 * @param {string} guestInfo.checkOut
 * @param {string|null} transcript — guest messages from the stay (optional)
 */
export async function generateReviewDraft(guestInfo, transcript = null) {
  const { firstName, fullName, propertyName, checkIn, checkOut } = guestInfo;

  const nights = calculateNights(checkIn, checkOut);
  const stayDescription = nights ? `${nights}-night stay` : 'recent stay';

  const prompt = buildPrompt(firstName, fullName, propertyName, stayDescription, transcript);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  const reviewText = data.content?.[0]?.text?.trim();

  if (!reviewText) throw new Error('Claude returned empty response');

  return reviewText;
}

function buildPrompt(firstName, fullName, propertyName, stayDescription, transcript) {
  const isSmokies = propertyName.toLowerCase().includes('delta') ||
                    propertyName.toLowerCase().includes('dawn');
  const isDisney  = propertyName.toLowerCase().includes('legobi') ||
                    propertyName.toLowerCase().includes('villa');

  const propertyContext = isSmokies
    ? 'a premium mountain retreat in the Smoky Mountains of Tennessee with an indoor heated pool, movie theater, game room, and mountain views'
    : isDisney
    ? 'a LEGO-themed villa near Disney World in Kissimmee, Florida with themed bedrooms, an arcade, private theater, and pool/spa'
    : 'a premium vacation rental';

  const transcriptSection = transcript
    ? `\n\nHere are messages the guest sent during their stay — use specific details from these to make the review feel personal and genuine, but don't quote them directly:\n\n${transcript}`
    : '';

  return `You're the owner of ${propertyName}, ${propertyContext}. You run a small family-owned vacation rental business called Dwellia. You just had a guest named ${fullName} complete a ${stayDescription} and you need to leave them a VRBO review.${transcriptSection}

Write a short, genuine guest review (3-5 sentences).

Rules:
- Sound like a real person writing it, not a corporate template
- Mention ${firstName} by first name naturally
- If guest messages were provided above, reference something specific from their stay — a question they asked, something they mentioned enjoying, how they communicated. Make it feel like you actually remember them.
- If no messages were provided, keep it warm and genuine without inventing specifics
- Keep it warm but not over the top
- Do NOT use phrases like: "would highly recommend", "left the place spotless", "five stars", "exceeded our expectations", "pleasure to host", "would love to have them back"
- Do NOT start with "I" — vary the opening
- Keep it under 100 words
- Return ONLY the review text, nothing else`;
}

function calculateNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return null;
  try {
    const msPerDay = 1000 * 60 * 60 * 24;
    const diff = new Date(checkOut) - new Date(checkIn);
    return Math.round(diff / msPerDay);
  } catch {
    return null;
  }
}
