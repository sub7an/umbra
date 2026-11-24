import { parseQuantity, toSI, countSigFigs } from './units.js'

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
    const tol = want.value === 0 ? 1e-12 : Math.abs(want.value) * rel
    const normalised = got.dim ? `${fmt(got.value)} ${got.dim}` : fmt(got.value)
    if (!(Math.abs(got.value - want.value) <= tol)) return { correct: false, reason: 'value', normalised }
    if (key.sig_figs != null && countSigFigs(response) !== key.sig_figs) {
      return { correct: false, reason: 'sig_figs', normalised }
    }
    return { correct: true, reason: 'ok', normalised }
  } catch {
    return fail('format')
  }
}
