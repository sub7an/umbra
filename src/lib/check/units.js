// Units: dimension = exponent vector over [kg, m, s, A, K, mol].
// Grammar: product of terms separated by space, '*', '·' or '/', where each
// term is `symbol[^int]` (also `**`, unicode superscripts) or a parenthesised
// group. '/' is left-associative: J/kg/K = J/(kg K). Never throws.

const DIMS = ['kg', 'm', 's', 'A', 'K', 'mol']
const v = (kg, m, s, A, K, mol) => [kg, m, s, A, K, mol]
const EV = 1.602176634e-19

const PREFIXES = { p: 1e-12, n: 1e-9, µ: 1e-6, μ: 1e-6, u: 1e-6, m: 1e-3, c: 1e-2, k: 1e3, M: 1e6, G: 1e9 }

// Prefixable units: factor to SI + dimension. 'g' is 1e-3 kg so 'kg' = k + g.
const BASE = {
  m: [1, v(0, 1, 0, 0, 0, 0)],
  s: [1, v(0, 0, 1, 0, 0, 0)],
  g: [1e-3, v(1, 0, 0, 0, 0, 0)],
  A: [1, v(0, 0, 0, 1, 0, 0)],
  K: [1, v(0, 0, 0, 0, 1, 0)],
  mol: [1, v(0, 0, 0, 0, 0, 1)],
  J: [1, v(1, 2, -2, 0, 0, 0)],
  W: [1, v(1, 2, -3, 0, 0, 0)],
  V: [1, v(1, 2, -3, -1, 0, 0)],
  Ω: [1, v(1, 2, -3, -2, 0, 0)],
  ohm: [1, v(1, 2, -3, -2, 0, 0)],
  N: [1, v(1, 1, -2, 0, 0, 0)],
  Pa: [1, v(1, -1, -2, 0, 0, 0)],
  Hz: [1, v(0, 0, -1, 0, 0, 0)],
  C: [1, v(0, 0, 1, 1, 0, 0)],
  F: [1, v(-1, -2, 4, 2, 0, 0)],
  T: [1, v(1, 0, -2, -1, 0, 0)],
  eV: [EV, v(1, 2, -2, 0, 0, 0)],
}
// Not prefixable.
const PLAIN = {
  min: [60, v(0, 0, 1, 0, 0, 0)],
  h: [3600, v(0, 0, 1, 0, 0, 0)],
  '°C': [1, v(0, 0, 0, 0, 1, 0), 273.15],
}

function lookup(sym) {
  sym = sym.replace('\u2126', '\u03A9').replace('℃', '°C') // ohm sign -> Greek omega
  if (PLAIN[sym]) return { factor: PLAIN[sym][0], exp: PLAIN[sym][1].slice(), offset: PLAIN[sym][2] || 0 }
  if (BASE[sym]) return { factor: BASE[sym][0], exp: BASE[sym][1].slice(), offset: 0 }
  const p = PREFIXES[sym[0]]
  if (p !== undefined && BASE[sym.slice(1)]) {
    const [f, e] = BASE[sym.slice(1)]
    return { factor: p * f, exp: e.slice(), offset: 0 }
  }
  return null
}

const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' }

function tokenize(s) {
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (m) => '^' + [...m].map((c) => SUP[c]).join(''))
  s = s.replace(/−/g, '-').replace(/\*\*/g, '^')
  const toks = []
  const re = /\s*(?:([A-Za-zµμΩ\u2126°℃]+)|(-?\d+)|([\^*·/()]))/y
  let i = 0
  while (i < s.length) {
    re.lastIndex = i
    const m = re.exec(s)
    if (!m) { if (/^\s*$/.test(s.slice(i))) break; return null }
    toks.push(m[1] ? { t: 'sym', v: m[1] } : m[2] ? { t: 'int', v: parseInt(m[2], 10) } : { t: 'op', v: m[3] })
    i = re.lastIndex
  }
  return toks
}

// SI factor of a unit (no offset), or null if invalid.
export function unitScale(unit) {
  if (unit === null || unit === undefined) return 1
  const u = parseUnit(unit)
  return u ? u.factor : null
}

// Returns { factor, exp, offset, single } or null.
function parseUnit(str) {
  if (typeof str !== 'string' || str.length > 60) return null
  const toks = tokenize(str.trim())
  if (!toks || !toks.length) return null
  let pos = 0
  const peek = () => toks[pos]
  const op = (c) => peek() && peek().t === 'op' && peek().v === c

  function term() {
    let r
    if (op('(')) {
      pos++
      r = product()
      if (!r || !op(')')) return null
      pos++
    } else if (peek() && peek().t === 'sym') {
      const u = lookup(toks[pos++].v)
      if (!u) return null
      r = { ...u, single: true }
    } else return null
    if (op('^')) {
      pos++
      if (!peek() || peek().t !== 'int') return null
      const n = toks[pos++].v
      if (Math.abs(n) > 12) return null
      r = { factor: Math.pow(r.factor, n), exp: r.exp.map((e) => e * n), offset: 0, single: false, bad: r.offset !== 0 || r.bad }
    }
    return r
  }
  function mul(a, b, sign) {
    return {
      factor: sign > 0 ? a.factor * b.factor : a.factor / b.factor,
      exp: a.exp.map((e, i) => e + sign * b.exp[i]),
      offset: 0, single: false, bad: false,
    }
  }
  // Convention: everything after a '/' is the denominator, and whitespace / '*' / '·'
  // bind tighter than '/': J/kg K = J/kg·K = J/(kg K). J/kg/K still works.
  function sequence() {
    let acc = term()
    if (!acc) return null
    while (pos < toks.length && !op(')') && !op('/')) {
      if (op('*') || op('·')) pos++
      const t = term()
      if (!t) return null
      const merged = mul(acc, t, 1)
      merged.bad = acc.bad || t.bad || acc.offset !== 0 || t.offset !== 0
      acc = merged
    }
    return acc
  }
  function product() {
    let acc = sequence()
    if (!acc) return null
    while (op('/')) {
      pos++
      const t = sequence()
      if (!t) return null
      const merged = mul(acc, t, -1)
      merged.bad = acc.bad || t.bad || acc.offset !== 0 || t.offset !== 0
      acc = merged
    }
    return acc
  }
  const r = product()
  if (!r || pos !== toks.length) return null
  if (r.bad) return null
  return r
}

function dimString(exp) {
  const parts = []
  exp.forEach((e, i) => { if (e) parts.push(e === 1 ? DIMS[i] : `${DIMS[i]}^${e}`) })
  return parts.join(' ')
}

// -> { value, dim } in SI, or null if the unit is unknown/invalid.
export function toSI(value, unit) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (unit === null || unit === undefined) return { value, dim: '' }
  const u = parseUnit(unit)
  if (!u) return null
  return { value: value * u.factor + u.offset, dim: dimString(u.exp) }
}

// Number token: optional sign, digits with optional thousands commas, decimal, exponent.
const NUM = /^([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d*)?(?:[eE][+-]?\d+)?)\s*(.*)$/s

function splitNumber(input) {
  if (typeof input !== 'string' || input.length > 200) return null
  const s = input.trim().replace(/−/g, '-')
  const m = NUM.exec(s)
  if (!m || !/\d/.test(m[1])) return null
  const tok = m[1]
  // a leftover that is a malformed exponent ("1e", "1e+") is a format error, not a unit
  // (a leftover starting with a digit/comma/dot, e.g. "1,00 m", is ambiguous: reject)
  let value = Number(tok.replace(/,/g, ''))
  let rest = m[2]
  // scientific notation: 2.0×10^3, 2 x 10^3, 2*10**3, 2·10³, 2×10⁻³
  const sci = /^[×xX*·]\s*10\s*(?:(?:\^|\*\*)\s*([+\-]?\d+)|([⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+))\s*(.*)$/s.exec(rest)
  if (sci) {
    const e = sci[1] !== undefined ? sci[1] : [...sci[2]].map((c) => (c === '⁻' ? '-' : c === '⁺' ? '+' : '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c))).join('')
    const n = parseInt(e, 10)
    if (!Number.isFinite(n) || Math.abs(n) > 400) return null
    value *= Math.pow(10, n)
    rest = sci[3]
  }
  if (!Number.isFinite(value)) return null
  if (/^[eE][+-]?$/.test(rest) || /^[,.\d]/.test(rest)) return null
  return { tok, value, unit: rest === '' ? null : rest }
}

export function parseQuantity(input) {
  const q = splitNumber(input)
  return q ? { value: q.value, unit: q.unit } : null
}

// Significant figures in the number as the student wrote it:
//  - with a decimal point, every digit after leading zeros counts ('2000.0' -> 5, '2.0' -> 2, '0.0050' -> 2)
//  - without one, trailing zeros are not significant ('2000' -> 1, '2,000' -> 1, '2e3' -> 1)
//  - exponent part (e3, ×10^3) is ignored: sig figs come from the mantissa; minimum 1
export function countSigFigs(input) {
  const q = splitNumber(input)
  if (!q) return null
  const mant = q.tok.replace(/[+-]/, '').replace(/,/g, '').split(/[eE]/)[0]
  const digits = mant.replace('.', '').replace(/^0+/, '')
  const sig = mant.includes('.') ? digits : digits.replace(/0+$/, '')
  return Math.max(1, sig.length)
}
