# Dwellia — VRBO Auto-Review System

Automatically generates a personalized VRBO guest review draft and texts it to the owner every time a VRBO guest checks out. Owner copies the draft, pastes it into VRBO, done.

---

## How It Works

```
Hospitable checkout event
        ↓
  Vercel webhook endpoint
        ↓
  Is this a VRBO booking?
     No → ignore
     Yes ↓
  Claude generates review draft
        ↓
  SMS sent to owner with:
    - Review draft text
    - Link to VRBO review dashboard
```

---

## Setup (One-Time)

### Step 1 — Deploy to Vercel

```bash
# Clone / copy this folder to your machine
cd dwellia-vrbo-review

# Deploy
npx vercel --prod
```

Your endpoint will be at:
```
https://your-project.vercel.app/api/checkout-webhook
```

---

### Step 2 — Set Environment Variables in Vercel

Go to your Vercel project → Settings → Environment Variables and add:

| Variable | Value | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Your Anthropic API key |
| `OWNER_PHONE` | `+13035551234` | The number to text (you) — E.164 format |
| `HOSPITABLE_WEBHOOK_SECRET` | (from Hospitable) | See Step 3 |
| `QUO_API_KEY` | (from Quo workspace settings) | No "Bearer" prefix — passed raw in Authorization header |
| `QUO_FROM` | `+13035550000` | Your Quo phone number — E.164 format |
| `QUO_USER_ID` | (optional) | Only needed if you have multiple workspace members |

---

### Step 3 — Connect Hospitable Webhook

1. Go to **Hospitable dashboard → Integrations → Webhooks**
2. Add a new webhook:
   - **URL:** `https://your-project.vercel.app/api/checkout-webhook`
   - **Events:** `booking.checkout`
3. Copy the **webhook secret** Hospitable shows you
4. Add it to Vercel as `HOSPITABLE_WEBHOOK_SECRET`

---

### Step 4 — Test It Locally

```bash
# Terminal 1 — start local dev server
npm run dev

# Terminal 2 — fire a simulated VRBO checkout
node scripts/test-webhook.js
```

You should see:
- Console output showing the review draft
- An SMS to your phone (if SMS provider is configured)

To test the Florida property, edit `scripts/test-webhook.js` and change the listing name to `LeGobi Villa`.

---

## What the Text Looks Like

```
📋 VRBO Review — Sarah Mitchell just checked out of Delta Dawn Retreat

Here's your draft:
---
Sarah and her family were genuinely great guests — communicative 
before arrival and clearly took good care of the property during 
their stay. The Smokies are better explored with families like 
theirs. Any host would be lucky to have them.
---

Submit it here 👉 https://www.vrbo.com/owner/reviews

(Copy the draft above, paste it in, done.)
```

---

## Quo API

Quo's API endpoint is `https://api.openphone.com/v1/messages`. The API key goes directly in the `Authorization` header (no "Bearer" prefix). Get your API key from Quo → Settings → API.

---

## Troubleshooting

**Webhook fires but SMS doesn't send:**
- Check Vercel logs (dashboard → your project → Deployments → Functions)
- Confirm `OWNER_PHONE` is in E.164 format: `+13035551234`
- Confirm SMS env vars are set correctly

**"Not a VRBO booking" log but it was VRBO:**
- Check what Hospitable sends as the `booking.source` value for VRBO
- It might be `"homeaway"`, `"vrbo"`, or something else
- Add the actual value to the `isVRBO` check in `api/checkout-webhook.js`

**Signature verification failing:**
- Make sure `HOSPITABLE_WEBHOOK_SECRET` matches exactly what Hospitable shows
- During testing you can temporarily remove the secret from env vars to skip verification

---

## Files

```
dwellia-vrbo-review/
├── api/
│   └── checkout-webhook.js   ← main Vercel endpoint
├── lib/
│   ├── review-generator.js   ← Claude review draft generation
│   ├── sms-sender.js         ← Quo API SMS sender
│   └── webhook-auth.js       ← Hospitable signature verification
├── scripts/
│   └── test-webhook.js       ← local testing script
├── package.json
├── vercel.json
└── README.md
```
