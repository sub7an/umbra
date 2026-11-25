import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
const rule = config.rewrites.find((r) => r.destination === '/index.html')
// The source uses only literal groups, so it is a valid RegExp once anchored.
const re = rule ? new RegExp(`^${rule.source}$`) : null

describe('vercel.json SPA rewrite for app areas', () => {
  it('exists and comes after the simulation rewrites', () => {
    expect(rule).toBeTruthy()
    expect(config.rewrites.indexOf(rule)).toBe(config.rewrites.length - 1)
  })
  it.each(['/teach', '/teach/classes/abc', '/join', '/learn', '/validation', '/privacy', '/schools/data-protection'])('matches %s', (p) => {
    expect(re.test(p)).toBe(true)
  })
  it.each(['/simulations/optics/lens-ray-diagram', '/simulations', '/teachx', '/privacyx', '/legal/umbra-dpa-template.docx', '/'])('does not match %s', (p) => {
    expect(re.test(p)).toBe(false)
  })
})

describe('vercel.json function limits', () => {
  it('gives class-cards 60 s, enough for a 60-name batch', () => {
    expect(config.functions?.['api/class-cards.js']?.maxDuration).toBe(60)
  })
})
