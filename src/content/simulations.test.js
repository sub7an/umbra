import { describe, it, expect } from 'vitest'
import { SITE, SIMULATIONS } from './simulations'
import { VIEW_PAGES, viewIdForSlug } from './simulationPages'

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

describe('simulation view pages', () => {
  const all = Object.entries(VIEW_PAGES).flatMap(([mod, pages]) => pages.map((p) => ({ mod, ...p })))

  it('has a page for every topic view, in the same order as the topic page sections', () => {
    for (const s of SIMULATIONS) {
      const pages = VIEW_PAGES[s.id]
      if (!pages) continue
      expect(pages.length, s.id).toBe(s.views.length)
    }
    expect(all.length).toBe(39)
  })
  it('keeps titles, descriptions and slugs unique and within limits', () => {
    const titles = new Set(all.map((p) => p.title))
    expect(titles.size).toBe(all.length)
    for (const p of all) {
      expect(p.title.length, p.slug).toBeLessThanOrEqual(60)
      expect(p.description.length, p.slug).toBeGreaterThanOrEqual(110)
      expect(p.description.length, p.slug).toBeLessThanOrEqual(155)
      expect(p.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(viewIdForSlug(p.mod, p.slug)).toBe(p.viewId)
    }
  })
  it('gives every page its own explanation, steps, misconception and worked question', () => {
    for (const p of all) {
      const words = [p.intro, p.see, ...p.tryThis, p.misconception, p.question.q, p.question.a].join(' ').split(/\s+/).length
      expect(words, p.slug).toBeGreaterThanOrEqual(160)
      expect(p.tryThis.length, p.slug).toBe(3)
      expect(p.equations.length, p.slug).toBeGreaterThan(0)
    }
  })
})
