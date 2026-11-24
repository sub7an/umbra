// Scoped mathjs: only parse/evaluate + basic arithmetic and elementary functions.
// No import/createUnit/etc. is installed, so student input cannot mutate the engine.
import {
  create, evaluateDependencies, addDependencies, subtractDependencies, multiplyDependencies,
  divideDependencies, powDependencies, unaryMinusDependencies, unaryPlusDependencies,
  sqrtDependencies, cbrtDependencies, absDependencies, expDependencies, logDependencies,
  sinDependencies, cosDependencies, tanDependencies, asinDependencies, acosDependencies,
  atanDependencies, atan2Dependencies, sinhDependencies, coshDependencies, tanhDependencies,
  piDependencies, eDependencies,
} from 'mathjs'
import { mulberry32 } from './rng.js'

const math = create({
  evaluateDependencies, addDependencies, subtractDependencies, multiplyDependencies,
  divideDependencies, powDependencies, unaryMinusDependencies, unaryPlusDependencies,
  sqrtDependencies, cbrtDependencies, absDependencies, expDependencies, logDependencies,
  sinDependencies, cosDependencies, tanDependencies, asinDependencies, acosDependencies,
  atanDependencies, atan2Dependencies, sinhDependencies, coshDependencies, tanhDependencies,
  piDependencies, eDependencies,
})

const POINTS = 6
const REL = 1e-6
const MAX_LEN = 200

function ev(expr, scope) {
  const r = math.evaluate(expr, { ...scope })
  if (typeof r !== 'number') throw new Error('not a number')
  return r
}

export function checkExpression(response, key) {
  try {
    if (typeof response !== 'string' || !response.trim() || response.length > MAX_LEN) {
      return { correct: false, reason: 'format' }
    }
    const names = Object.keys(key.vars || {}).sort()
    const rng = mulberry32(42)
    for (let i = 0; i < POINTS; i++) {
      const scope = {}
      for (const n of names) {
        const [lo, hi] = key.vars[n]
        scope[n] = lo + rng() * (hi - lo)
      }
      const got = ev(response, scope) // throws on syntax error / unknown symbol -> format
      const want = ev(key.expr, scope)
      if (!Number.isFinite(got) || !Number.isFinite(want)) return { correct: false, reason: 'value' }
      if (Math.abs(got - want) > REL * Math.max(Math.abs(want), 1e-12)) return { correct: false, reason: 'value' }
    }
    return { correct: true, reason: 'ok' }
  } catch {
    return { correct: false, reason: 'format' }
  }
}
