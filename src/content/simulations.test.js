import { describe, it, expect } from 'vitest'
import { SITE, SIMULATIONS } from './simulations'

// Guard rails for the search-facing copy that scripts/prerender.mjs publishes
describe('simulation page content', () => {
  it('covers all 12 modules with unique ids, titles and descriptions', () => {
    expect(SIMULATIONS).toHaveLength(12)
    for (const key of ['id', 'title', 'description', 'h1']) {
      expect(new Set(SIMULATIONS.map((s) => s[key])).size).toBe(12)
    }
  })
  it('keeps titles and descriptions within what search results display', () => {
    expect(SITE.description.length).toBeLessThanOrEqual(155)
    for (const s of SIMULATIONS) {
      expect(s.title.length, s.id).toBeLessThanOrEqual(60)
      expect(s.description.length, s.id).toBeGreaterThanOrEqual(110)
      expect(s.description.length, s.id).toBeLessThanOrEqual(155)
    }
  })
  it('gives every page substantial unique content', () => {
    for (const s of SIMULATIONS) {
      const words = [s.intro, ...s.views.map((v) => v.text), ...s.faq.map((f) => `${f.q} ${f.a}`)].join(' ').split(/\s+/).length
      expect(words, s.id).toBeGreaterThanOrEqual(120)
      expect(s.views.length, s.id).toBeGreaterThan(0)
      expect(s.equations.length, s.id).toBeGreaterThan(0)
    }
  })
  it('uses URL-safe ids', () => {
    for (const s of SIMULATIONS) expect(s.id).toMatch(/^[a-z]+(-[a-z]+)*$/)
  })
})
