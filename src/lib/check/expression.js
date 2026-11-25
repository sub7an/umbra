// Student input is untrusted. Defence in depth:
//  (a) parse, then walk the tree against an allow-list (numbers, the key's vars,
//      pi/e, + - * / ^, unary +/-, parentheses, a fixed set of math functions);
//  (b) evaluate with a scope that shadows config/import/createUnit/evaluate/parse,
//      so nothing reachable can mutate the shared engine.
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
const MAX_DRAWS = 12
const MIN_USABLE = 4
const MAX_LEN = 200
const FUNCS = new Set(['sqrt', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'exp', 'log', 'ln', 'abs'])
const OPS = new Set(['+', '-', '*', '/', '^'])
const UNARY = new Set(['unaryMinus', 'unaryPlus'])
const CONSTS = new Set(['pi', 'e'])

// Shadowed in every scope: even if the allow-list were bypassed these cannot reach the engine.
const BLOCKED = () => { throw new Error('blocked') }
const SHADOW = { config: BLOCKED, import: BLOCKED, createUnit: BLOCKED, evaluate: BLOCKED, parse: BLOCKED, ln: Math.log }

function allowed(node, vars) {
  switch (node.type) {
    case 'ConstantNode': return typeof node.value === 'number' && Number.isFinite(node.value)
    case 'SymbolNode': return vars.has(node.name) || CONSTS.has(node.name)
    case 'ParenthesisNode': return allowed(node.content, vars)
    case 'OperatorNode':
      return (OPS.has(node.op) || UNARY.has(node.fn)) && node.args.every((a) => allowed(a, vars))
    case 'FunctionNode':
      return node.fn?.type === 'SymbolNode' && FUNCS.has(node.fn.name) && node.args.every((a) => allowed(a, vars))
    default: return false
  }
}

// Floating-point round-off bound for the KEY expression only (the student tree never
// contributes to the tolerance). Each node returns { v: value, e: error bound, c: is-constant }.
const EPS = 1e-15
const DERIV = {
  sqrt: (x) => 1 / (2 * Math.sqrt(x)),
  sin: (x) => Math.cos(x),
  cos: (x) => -Math.sin(x),
  tan: (x) => 1 / (Math.cos(x) ** 2),
  asin: (x) => 1 / Math.sqrt(1 - x * x),
  acos: (x) => -1 / Math.sqrt(1 - x * x),
  atan: (x) => 1 / (1 + x * x),
  exp: (x) => Math.exp(x),
  log: (x) => 1 / x,
  ln: (x) => 1 / x,
  abs: () => 1,
}
const FN = {
  sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos,
  atan: Math.atan, exp: Math.exp, log: Math.log, ln: Math.log, abs: Math.abs,
}

function keyEval(n, scope) {
  switch (n.type) {
    case 'ConstantNode': return { v: n.value, e: 0, c: true }
    case 'SymbolNode':
      if (n.name === 'pi') return { v: Math.PI, e: 0, c: true }
      if (n.name === 'e') return { v: Math.E, e: 0, c: true }
      if (!(n.name in scope)) throw new Error('unknown symbol')
      return { v: scope[n.name], e: 0, c: false }
    case 'ParenthesisNode': return keyEval(n.content, scope)
    case 'OperatorNode': {
      const args = n.args.map((a) => keyEval(a, scope))
      const c = args.every((x) => x.c)
      if (args.length === 1) {
        if (n.fn === 'unaryMinus') return { v: -args[0].v, e: args[0].e, c }
        if (n.fn === 'unaryPlus') return args[0]
        throw new Error('bad op')
      }
      const [A, B] = args
      const a = A.v, b = B.v
      switch (n.op) {
        case '+': return { v: a + b, e: A.e + B.e + EPS * (Math.abs(a) + Math.abs(b)), c }
        case '-': return { v: a - b, e: A.e + B.e + EPS * (Math.abs(a) + Math.abs(b)), c }
        case '*': return { v: a * b, e: Math.abs(b) * A.e + Math.abs(a) * B.e + EPS * Math.abs(a * b), c }
        case '/': return {
          v: a / b,
          e: (A.e + Math.abs(a / b) * B.e) / Math.abs(b) + EPS * Math.abs(a / b),
          c,
        }
        case '^': {
          const v = Math.pow(a, b)
          const e = B.c
            ? Math.abs(b) * Math.pow(Math.abs(a), b - 1) * A.e + EPS * Math.abs(v)
            : EPS * Math.abs(v) * (1 + Math.abs(b * Math.log(a)))
          return { v, e, c }
        }
        default: throw new Error('bad op')
      }
    }
    case 'FunctionNode': {
      const name = n.fn.name
      if (!FN[name] || n.args.length !== 1) throw new Error('bad fn')
      const x = keyEval(n.args[0], scope)
      const v = FN[name](x.v)
      return { v, e: Math.abs(DERIV[name](x.v)) * x.e + EPS * Math.abs(v), c: x.c }
    }
    default: throw new Error('bad node')
  }
}

function run(code, scope) {
  const r = code.evaluate({ ...scope, ...SHADOW })
  if (typeof r !== 'number') throw new Error('not a number')
  return r
}

export function checkExpression(response, key) {
  try {
    if (typeof response !== 'string' || !response.trim() || response.length > MAX_LEN) {
      return { correct: false, reason: 'format' }
    }
    const names = Object.keys(key.vars || {}).sort()
    const tree = math.parse(response)
    if (!allowed(tree, new Set(names))) return { correct: false, reason: 'format' }
    const got = tree.compile()
    const wantTree = math.parse(key.expr)
    const rng = mulberry32(42)
    let usable = 0
    for (let i = 0; i < MAX_DRAWS && usable < POINTS; i++) {
      const scope = {}
      for (const n of names) {
        const [lo, hi] = key.vars[n]
        scope[n] = lo + rng() * (hi - lo)
      }
      const g = run(got, scope) // throws on unknown symbol etc. -> format
      const k = keyEval(wantTree, scope)
      const w = k.v
      if (!Number.isFinite(w) || !Number.isFinite(k.e) || Math.abs(w) <= k.e) continue // degenerate point
      usable++
      if (!Number.isFinite(g)) return { correct: false, reason: 'value' }
      if (Math.abs(g - w) > REL * Math.max(Math.abs(g), Math.abs(w)) + k.e) return { correct: false, reason: 'value' }
    }
    // identically-zero / always-cancelling key is an authoring error
    if (usable < MIN_USABLE) return { correct: false, reason: 'format' }
    return { correct: true, reason: 'ok' }
  } catch {
    return { correct: false, reason: 'format' }
  }
}
