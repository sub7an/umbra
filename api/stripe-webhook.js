// Vercel serverless function — receives Stripe webhook events.
// POST /api/stripe-webhook
//
// Env vars:
//   STRIPE_SECRET_KEY      — sk_test_… / sk_live_…
//   STRIPE_WEBHOOK_SECRET  — whsec_… from the Stripe webhook endpoint
//
// Signature verification requires the RAW request body, so Vercel's automatic
// JSON body parsing is disabled below.

import Stripe from 'stripe'

export const config = { api: { bodyParser: false } }

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method not allowed')
  }

  const secret        = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret || !webhookSecret) {
    return res.status(500).json({ error: 'Webhook not configured (missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET).' })
  }

  const stripe = new Stripe(secret)
  let event
  try {
    const raw = await readRawBody(req)
    event = stripe.webhooks.constructEvent(raw, req.headers['stripe-signature'], webhookSecret)
  } catch (err) {
    console.error('[stripe/webhook] signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // Handle the events that matter for granting/revoking Pro access.
  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object
      // s.customer_details.email is the buyer; s.customer is the Stripe customer id.
      // TODO: when accounts exist, mark this user as Pro here (DB write).
      console.log('[stripe/webhook] Pro subscription started:', s.customer_details?.email, s.customer)
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object
      // TODO: revoke Pro access for sub.customer here.
      console.log('[stripe/webhook] subscription cancelled:', sub.customer)
      break
    }
    case 'invoice.paid':
    case 'invoice.payment_failed':
      console.log(`[stripe/webhook] ${event.type}`)
      break
    default:
      // Ignore other event types.
      break
  }

  return res.status(200).json({ received: true })
}
