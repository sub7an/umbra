// Vercel serverless function — the only place the app talks to Claude.
// POST /api/ai  { system?, messages, max_tokens?, stream? }
//   stream: false → { text }
//   stream: true  → text/plain body, streamed as the model writes
//
// The API key lives only here, so it never reaches the browser bundle.
//
// Env vars (set in Vercel → Project → Settings → Environment Variables):
//   ANTHROPIC_API_KEY  — SECRET, never prefix with VITE_
//   AI_ALLOWED_ORIGINS — optional, comma-separated extra origins
//                        (e.g. a preview domain); umbrasandbox.com and
//                        localhost are always allowed
//
// Guard rails, since anyone on the web can reach this endpoint:
//   • the model and the max_tokens ceiling are fixed here, not by the caller
//   • request size limits (message count, text length, one image)
//   • browser requests must come from the site's own origin
//   • a per-IP rate limit (per warm instance; set a monthly spend limit in
//     the Anthropic Console as the hard backstop)

import Anthropic from '@anthropic-ai/sdk'

const MODEL          = 'claude-haiku-4-5'
const MAX_TOKENS     = 600
const MAX_MESSAGES   = 24
const MAX_TEXT_CHARS = 24000
const MAX_IMAGE_B64  = 1_500_000            // ~1.1 MB JPEG
const RATE_PER_MIN   = 12
const RATE_PER_DAY   = 300

const DEFAULT_ORIGINS = ['https://umbrasandbox.com', 'https://www.umbrasandbox.com']

export function allowedOrigin(origin) {
  if (!origin) return true                  // same-origin fetches may omit it
  const extra = (process.env.AI_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
  if ([...DEFAULT_ORIGINS, ...extra].includes(origin)) return true
  try {
    const { hostname } = new URL(origin)
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch { return false }
}

// Sliding-window counters per client IP (best effort: resets on cold start)
const hits = new Map()
function rateLimited(ip) {
  const now = Date.now()
  const h = (hits.get(ip) || []).filter((t) => now - t < 86_400_000)
  const lastMinute = h.filter((t) => now - t < 60_000).length
  if (lastMinute >= RATE_PER_MIN || h.length >= RATE_PER_DAY) { hits.set(ip, h); return true }
  h.push(now)
  hits.set(ip, h)
  if (hits.size > 5000) hits.delete(hits.keys().next().value)
  return false
}

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 4_000_000) throw new Error('Body too large')
  }
  return raw ? JSON.parse(raw) : {}
}

// Accept only plain user/assistant turns with text and (at most one) JPEG/PNG image
export function validate(body) {
  const { system, messages } = body || {}
  if (system !== undefined && typeof system !== 'string') return 'system must be a string'
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return 'Bad messages'
  let chars = (system || '').length
  let images = 0
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return 'Bad role'
    if (typeof m.content === 'string') { chars += m.content.length; continue }
    if (!Array.isArray(m.content)) return 'Bad content'
    for (const b of m.content) {
      if (b?.type === 'text' && typeof b.text === 'string') { chars += b.text.length; continue }
      if (b?.type === 'image' && b.source?.type === 'base64'
        && ['image/jpeg', 'image/png'].includes(b.source.media_type)
        && typeof b.source.data === 'string' && b.source.data.length <= MAX_IMAGE_B64) { images++; continue }
      return 'Unsupported content block'
    }
  }
  if (chars > MAX_TEXT_CHARS) return 'Request too long'
  if (images > 1) return 'Too many images'
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!allowedOrigin(req.headers.origin)) return res.status(403).json({ error: 'Forbidden' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'AI is not configured (missing ANTHROPIC_API_KEY).' })

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()
  if (rateLimited(ip)) return res.status(429).json({ error: 'Too many AI requests — try again in a minute.' })

  let body
  try { body = await readBody(req) } catch { return res.status(400).json({ error: 'Invalid JSON' }) }
  const problem = validate(body)
  if (problem) return res.status(400).json({ error: problem })

  const client = new Anthropic({ apiKey })
  const params = {
    model: MODEL,
    max_tokens: Math.min(Math.max(Number(body.max_tokens) || 256, 16), MAX_TOKENS),
    messages: body.messages,
    ...(body.system ? { system: body.system } : {}),
  }

  try {
    if (body.stream) {
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      const stream = client.messages.stream(params)
      stream.on('text', (t) => res.write(t))
      req.on('close', () => stream.abort())
      await stream.finalMessage()
      return res.end()
    }
    const msg = await client.messages.create(params)
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
    return res.status(200).json({ text })
  } catch (err) {
    const status = err instanceof Anthropic.APIError && err.status ? err.status : 502
    console.error('AI proxy error:', status, err?.message)
    if (res.headersSent) return res.end()
    return res.status(status === 429 ? 429 : 502).json({ error: status === 429 ? 'The AI service is busy — try again shortly.' : 'The AI service failed to respond.' })
  }
}
