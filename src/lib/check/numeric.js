import { parseQuantity, toSI, countSigFigs, unitScale } from './units.js'

const fmt = (x) => String(Number(x.toPrecision(12)))
const fail = (reason) => ({ correct: false, reason })

// Never throws. Order of checks: format -> unit -> value -> sig_figs.
export function checkNumeric(response, key) {
  try {
    const q = parseQuantity(response)
    if (!q || !key) return fail('format')
    const want = toSI(key.value, key.unit ?? null)
    if (!want) return fail('format')
    const got = toSI(q.value, q.unit)
    if (!got || got.dim !== want.dim) return fail('unit')
    const rel = typeof key.rel_tol === 'number' ? key.rel_tol : 0.01
    // tolerance is relative to the key in ITS OWN unit (matters for offset units: 1% of 100 °C is 1 K, not 3.7 K)
    const scale = unitScale(key.unit ?? null) ?? 1
    const tol = key.value === 0 ? 1e-12 * scale : Math.abs(key.value) * rel * scale
    const normalised = got.dim ? `${fmt(got.value)} ${got.dim}` : fmt(got.value)
    if (!(Math.abs(got.value - want.value) <= tol)) return { correct: false, reason: 'value', normalised }
    const sf = Number(key.sig_figs)
    if (Number.isInteger(sf) && sf > 0 && countSigFigs(response) !== sf) {
      return { correct: false, reason: 'sig_figs', normalised }
    }
    return { correct: true, reason: 'ok', normalised }
  } catch {
    return fail('format')
  }
}
