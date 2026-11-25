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
const ABS = 1e-9 // near-zero floor, relative to the magnitude of cancelling terms (never an absolute constant)
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

// Round-off only matters where terms can cancel: operands of binary + and -.
// Their magnitude is the scale S for the near-zero floor. Expressions with no
// sums/differences get S = 0, i.e. a purely relative comparison.
function cancelOperands(tree) {
  const out = []
  tree.traverse((n) => {
    if (n.type === 'OperatorNode' && (n.op === '+' || n.op === '-') && n.args.length === 2) {
      for (const a of n.args) out.push(a.compile())
    }
  })
  return out
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
    const want = wantTree.compile()
    const sums = [...cancelOperands(tree), ...cancelOperands(wantTree)]
    const rng = mulberry32(42)
    for (let i = 0; i < POINTS; i++) {
      const scope = {}
      for (const n of names) {
        const [lo, hi] = key.vars[n]
        scope[n] = lo + rng() * (hi - lo)
      }
      let S = 0
      for (const c of sums) { try { const x = Math.abs(run(c, scope)); if (Number.isFinite(x)) S = Math.max(S, x) } catch { /* ignore */ } }
      const g = run(got, scope) // throws on unknown symbol etc. -> format
      const w = run(want, scope)
      if (!Number.isFinite(g) || !Number.isFinite(w)) return { correct: false, reason: 'value' }
      if (Math.abs(g - w) > Math.max(REL * Math.max(Math.abs(g), Math.abs(w)), ABS * S)) {
        return { correct: false, reason: 'value' }
      }
    }
    return { correct: true, reason: 'ok' }
  } catch {
    return { correct: false, reason: 'format' }
  }
}
