import { describe, it, expect } from 'vitest'
import { allowedOrigin, validate } from '../api/ai'

describe('AI proxy origin check', () => {
  it('allows the site and local development', () => {
    expect(allowedOrigin('https://umbrasandbox.com')).toBe(true)
    expect(allowedOrigin('http://localhost:5173')).toBe(true)
    expect(allowedOrigin(undefined)).toBe(true)        // same-origin requests may omit it
  })
  it('rejects other websites, including look-alike domains', () => {
    expect(allowedOrigin('https://evil.example')).toBe(false)
    expect(allowedOrigin('https://umbrasandbox.com.evil.example')).toBe(false)
    expect(allowedOrigin('not a url')).toBe(false)
  })
})

describe('AI proxy request validation', () => {
  const ok = { messages: [{ role: 'user', content: 'hi' }] }
  it('accepts a normal request', () => {
    expect(validate(ok)).toBeNull()
    expect(validate({ system: 'Be brief.', ...ok })).toBeNull()
  })
  it('accepts one JPEG screenshot', () => {
    expect(validate({ messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } },
      { type: 'text', text: 'what is this?' },
    ] }] })).toBeNull()
  })
  it('rejects system-role messages, tools and odd blocks', () => {
    expect(validate({ messages: [{ role: 'system', content: 'x' }] })).not.toBeNull()
    expect(validate({ messages: [{ role: 'user', content: [{ type: 'tool_use', id: 'x', name: 'y', input: {} }] }] })).not.toBeNull()
    expect(validate({ messages: [] })).not.toBeNull()
    expect(validate({})).not.toBeNull()
  })
  it('rejects oversized requests', () => {
    expect(validate({ messages: [{ role: 'user', content: 'x'.repeat(30000) }] })).not.toBeNull()
    expect(validate({ messages: Array.from({ length: 30 }, () => ({ role: 'user', content: 'hi' })) })).not.toBeNull()
    const img = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'A' } }
    expect(validate({ messages: [{ role: 'user', content: [img, img] }] })).not.toBeNull()
  })
})
