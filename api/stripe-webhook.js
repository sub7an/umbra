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
import { createClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: false } }

// Server-side Supabase client using the SERVICE ROLE key (bypasses RLS so the
// webhook can update any user's profile). Null if not configured yet.
function admin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

async function setPro(userId, customerId, isPro) {
  const db = admin()
  if (!db) { console.log('[stripe/webhook] Supabase not configured; skipping profile update'); return }
  if (userId) {
    await db.from('profiles').update({ is_pro: isPro, stripe_customer_id: customerId }).eq('id', userId)
  } else if (customerId) {
    await db.from('profiles').update({ is_pro: isPro }).eq('stripe_customer_id', customerId)
  }
}

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
      const userId = s.client_reference_id || s.subscription_data?.metadata?.umbra_user_id
      console.log('[stripe/webhook] Pro started:', s.customer_details?.email, 'user:', userId)
      await setPro(userId, s.customer, true)
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object
      console.log('[stripe/webhook] subscription cancelled:', sub.customer)
      await setPro(sub.metadata?.umbra_user_id, sub.customer, false)
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
