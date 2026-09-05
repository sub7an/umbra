// Vercel serverless function — creates a Stripe Checkout Session for Umbra Pro.
// POST /api/checkout  →  { url }  (redirect the browser there)
//
// Env vars (set in Vercel → Project → Settings → Environment Variables):
//   STRIPE_SECRET_KEY   — sk_test_… / sk_live_…  (SECRET, never in the client)
//   STRIPE_PRICE_PRO    — price_… for the $6/mo recurring Pro price
//   PUBLIC_BASE_URL     — optional; defaults to the request origin

import Stripe from 'stripe'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.STRIPE_SECRET_KEY
  const price  = process.env.STRIPE_PRICE_PRO
  if (!secret || !price) {
    return res.status(500).json({ error: 'Stripe is not configured yet (missing STRIPE_SECRET_KEY or STRIPE_PRICE_PRO).' })
  }

  const stripe = new Stripe(secret)
  const origin = process.env.PUBLIC_BASE_URL || req.headers.origin || 'https://umbrasandbox.com'

  // Temporary diagnostic: GET/POST /api/checkout?debug=1 reports which prices
  // the configured key can actually see (no secrets exposed). Remove after setup.
  if (req.query?.debug === '1') {
    try {
      const prices = await stripe.prices.list({ limit: 10 })
      return res.status(200).json({
        configured_price: price,
        key_livemode: prices.data[0]?.livemode ?? null,
        visible_prices: prices.data.map(p => ({ id: p.id, product: p.product, amount: p.unit_amount, interval: p.recurring?.interval })),
      })
    } catch (err) {
      return res.status(500).json({ debug_error: err.message })
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      // Stripe Tax auto-calculates sales tax / VAT from the customer's address
      automatic_tax: { enabled: true },
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      subscription_data: { metadata: { product: 'umbra_pro' } },
    })
    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('[stripe/checkout]', err)
    return res.status(500).json({ error: err.message || 'Checkout failed' })
  }
}
