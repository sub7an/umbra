import { describe, it, expect } from 'vitest'
import { parseRoute, formatRoute } from './routes'

describe('parseRoute', () => {
  it('sim module + view', () => expect(parseRoute('/simulations/optics/lens')).toMatchObject({ area: 'sim', module: 'optics', view: 'lens' }))
  it('sim module only, trailing slash', () => expect(parseRoute('/simulations/optics/')).toMatchObject({ area: 'sim', module: 'optics', view: null }))
  it('teach with rest', () => expect(parseRoute('/teach/classes/abc')).toMatchObject({ area: 'teach', rest: ['classes', 'abc'] }))
  it('join reads and normalises ?code', () => expect(parseRoute('/join', '?code= ab3 k9x ')).toMatchObject({ area: 'join', code: 'AB3K9X' }))
  it('keeps search for shared state', () => expect(parseRoute('/simulations/optics', '?s=xyz').search).toBe('?s=xyz'))
  it('unknown path falls back home', () => expect(parseRoute('/teachx')).toMatchObject({ area: 'home' }))
  it('module ids are validated by the caller, not here', () => expect(parseRoute('/simulations/nope')).toMatchObject({ area: 'sim', module: 'nope' }))
})

describe('formatRoute', () => {
  it.each(['/simulations/optics/lens', '/simulations/optics', '/teach/classes/abc', '/validation', '/'])('round-trips %s', (p) =>
    expect(formatRoute(parseRoute(p))).toBe(p))
  it('join with code', () => expect(formatRoute({ area: 'join', code: 'AB3K9X', search: '' })).toBe('/join?code=AB3K9X'))
})
