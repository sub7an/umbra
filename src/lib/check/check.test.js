import { describe, it, expect } from 'vitest'
import {
  parseQuantity, toSI, checkNumeric, checkChoice, checkOrder,
  checkExpression, checkResponse, matchWrongAnswer,
} from './index.js'

const key = { value: 2000, unit: 'm', rel_tol: 0.01 }

describe('numeric', () => {
  it.each(['2000 m', '2,000 m', '2e3 m', '2.0 km', ' 2000 m ', '2000m'])('accepts %s', (r) =>
    expect(checkNumeric(r, key).correct).toBe(true))
  it('rejects wrong dimension', () => expect(checkNumeric('2000 s', key)).toMatchObject({ correct: false, reason: 'unit' }))
  it('rejects garbage without throwing', () => expect(checkNumeric('two thousand', key)).toMatchObject({ correct: false, reason: 'format' }))
  it('rejects outside tolerance', () => expect(checkNumeric('2100 m', key)).toMatchObject({ correct: false, reason: 'value' }))
  it('celsius offset', () => expect(checkNumeric('27 °C', { value: 300.15, unit: 'K', rel_tol: 0.001 }).correct).toBe(true))
  it('sig figs enforced when set', () => expect(checkNumeric('2000.0 m', { ...key, sig_figs: 2 })).toMatchObject({ correct: false, reason: 'sig_figs' }))
  it('sig figs satisfied', () => expect(checkNumeric('2.0 km', { ...key, sig_figs: 2 }).correct).toBe(true))
  it('sig figs checked only after value/unit', () => expect(checkNumeric('5 s', { ...key, sig_figs: 2 }).reason).toBe('unit'))
  it('normalised is SI', () => expect(checkNumeric('2 km', key).normalised).toBe('2000 m'))

  it.each([
    [''], ['   '], ['1e'], ['--2 m'], ['abc'], ['m'], ['1,00 m'],
  ])('format error for %j', (r) => expect(checkNumeric(r, key)).toMatchObject({ correct: false, reason: 'format' }))
  it.each([[null], [undefined], [42], [{}], [['2000 m']]])('non-string %j is format, no throw', (r) =>
    expect(checkNumeric(r, key)).toMatchObject({ correct: false, reason: 'format' }))
  it('trailing junk after unit is a unit error', () => expect(checkNumeric('2 m 3', key).reason).toBe('unit'))
  it('unknown unit', () => expect(checkNumeric('2 furlongs', key)).toMatchObject({ correct: false, reason: 'unit' }))
  it('unitless key', () => {
    const k = { value: 3, unit: null }
    expect(checkNumeric('3', k).correct).toBe(true)
    expect(checkNumeric('3 m', k)).toMatchObject({ correct: false, reason: 'unit' })
    expect(checkNumeric('3', key)).toMatchObject({ correct: false, reason: 'unit' })
  })
  it('negative compound', () => {
    const k = { value: -9.8, unit: 'm/s^2' }
    expect(checkNumeric('-9.8 m/s^2', k).correct).toBe(true)
    expect(checkNumeric('-980 cm/s^2', k).correct).toBe(true)
    expect(checkNumeric('9.8 m/s^2', k)).toMatchObject({ correct: false, reason: 'value' })
    expect(checkNumeric('-9.8 m/s', k)).toMatchObject({ correct: false, reason: 'unit' })
  })
})

describe('units', () => {
  it('compound forms are equivalent', () => {
    const a = toSI(1, 'N')
    expect(toSI(1, 'kg m s^-2')).toEqual(a)
    expect(toSI(1, 'kg*m/s^2')).toEqual(a)
    expect(toSI(1, 'J/m')).toEqual(a)
    expect(toSI(1, 'kg·m/s²')).toEqual(a)
    expect(toSI(2, 'J/(kg K)').dim).toBe(toSI(1, 'm^2 s^-2 K^-1').dim)
    expect(toSI(1, 'J/kg/K').dim).toBe(toSI(1, 'J/(kg K)').dim)
  })
  it('prefixes and special units', () => {
    expect(toSI(1, 'g').value).toBeCloseTo(1e-3)
    expect(toSI(1, 'kg').value).toBe(1)
    expect(toSI(1, 'µm').value).toBeCloseTo(1e-6, 18)
    expect(toSI(1, 'um').value).toBeCloseTo(1e-6, 18)
    expect(toSI(1, 'min').value).toBe(60)
    expect(toSI(1, 'h').value).toBe(3600)
    expect(toSI(1, 'MeV').value).toBeCloseTo(1.602176634e-13, 25)
    expect(toSI(1, 'ohm')).toEqual(toSI(1, 'Ω'))
    expect(toSI(0, '°C').value).toBeCloseTo(273.15)
    expect(toSI(1, 'ms').dim).toBe('s')
    expect(toSI(1, 'mm').dim).toBe('m')
  })
  it('rejects bad units', () => {
    expect(toSI(1, 'furlongs')).toBeNull()
    expect(toSI(1, 'k°C')).toBeNull()
    expect(toSI(1, '°C/s')).toBeNull()
    expect(toSI(1, 'm^')).toBeNull()
    expect(toSI(1, '')).toBeNull()
  })
  it('unitless', () => expect(toSI(5, null)).toEqual({ value: 5, dim: '' }))
  it('parseQuantity', () => {
    expect(parseQuantity('2,000 m')).toEqual({ value: 2000, unit: 'm' })
    expect(parseQuantity('2e3')).toEqual({ value: 2000, unit: null })
    expect(parseQuantity('2eV')).toEqual({ value: 2, unit: 'eV' })
    expect(parseQuantity('nope')).toBeNull()
  })
})

describe('expression', () => {
  const vars = { m: [1, 5], v: [1, 10] }
  it('equivalence', () => expect(checkExpression('m*v^2/2', { expr: '0.5*m*v^2', vars }).correct).toBe(true))
  it('non-equivalence', () => expect(checkExpression('m*v^2', { expr: '0.5*m*v^2', vars }).correct).toBe(false))
  it('implicit multiplication', () => expect(checkExpression('1/2 m v^2', { expr: '0.5*m*v^2', vars }).correct).toBe(true))
  it.each(['', '2*', 'import(1)', 'foo(m)', 'z+1', null, undefined, 5])('bad expression %j is format', (r) =>
    expect(checkExpression(r, { expr: 'm*v', vars })).toMatchObject({ correct: false, reason: 'format' }))
})

describe('choice / order / dispatch / wrong answers', () => {
  it('choice case/space-insensitive', () => expect(checkChoice(' b ', { answer: 'B' }).correct).toBe(true))
  it('choice wrong', () => expect(checkChoice('c', { answer: 'B' })).toMatchObject({ correct: false, reason: 'value' }))
  it('choice bad input', () => expect(checkChoice(null, { answer: 'B' }).reason).toBe('format'))
  it('order', () => expect(checkOrder(['c', 'a', 'b'], { order: ['c', 'a', 'b'] }).correct).toBe(true))
  it('order wrong / bad', () => {
    expect(checkOrder(['a', 'c', 'b'], { order: ['c', 'a', 'b'] }).correct).toBe(false)
    expect(checkOrder(['c', 'a'], { order: ['c', 'a', 'b'] }).correct).toBe(false)
    expect(checkOrder('cab', { order: ['c', 'a', 'b'] }).reason).toBe('format')
  })
  it('checkResponse dispatches', () => {
    expect(checkResponse('numeric', key, '2 km').correct).toBe(true)
    expect(checkResponse('choice', { answer: 'A' }, 'a').correct).toBe(true)
    expect(checkResponse('order', { order: ['a'] }, ['a']).correct).toBe(true)
    expect(checkResponse('expression', { expr: 'x', vars: { x: [1, 2] } }, 'x').correct).toBe(true)
    expect(checkResponse('bogus', {}, 'x').reason).toBe('format')
    expect(checkResponse('numeric', null, '2 m').reason).toBe('format')
  })
  it('wrong-answer match', () => expect(matchWrongAnswer('1000 m', [{ value: '1000 m', feedback_id: 'halved' }])).toBe('halved'))
  it('wrong-answer match is unit-aware', () => expect(matchWrongAnswer('1 km', [{ value: '1000 m', feedback_id: 'halved' }])).toBe('halved'))
  it('wrong-answer no match / non-numeric / bad input', () => {
    expect(matchWrongAnswer('5 m', [{ value: '1000 m', feedback_id: 'x' }])).toBeNull()
    expect(matchWrongAnswer('C', [{ value: 'c', feedback_id: 'trap' }])).toBe('trap')
    expect(matchWrongAnswer(null, [{ value: '1', feedback_id: 'x' }])).toBeNull()
    expect(matchWrongAnswer('1', null)).toBeNull()
  })
})

describe('fix round 1', () => {
  const K = { expr: 'm*v', vars: { m: [1, 5], v: [1, 10] } }
  it('engine cannot be mutated by student input', () => {
    for (const r of ['config({number:"BigNumber"})', 'config({relTol:1, absTol:1})', 'import({f: 1})', 'createUnit("foo")',
      'evaluate("1")', 'parse("1")', 'm = 5', 'm[1]', '[1,2]', 'x ? 1 : 2', '{a:1}', '1:3', 'f(x)=x', '"s"', 'sqrt(m).foo', 'cbrt(m)', 'm; v']) {
      expect(checkExpression(r, K)).toMatchObject({ correct: false, reason: 'format' })
    }
    expect(checkExpression('m*v', K).correct).toBe(true)
    expect(checkExpression('v*sqrt(m)^2', K).correct).toBe(true)
    expect(checkExpression('exp(ln(m*v))', K).correct).toBe(true)
    expect(checkNumeric('2 km', key).correct).toBe(true)
  })
  it('absolute floor scales with magnitude', () =>
    expect(checkExpression('m-m+1e-15', { expr: '0', vars: { m: [1, 5] } }).correct).toBe(true))
  it('celsius tolerance is relative to key in its own unit', () => {
    const k = { value: 100, unit: '°C', rel_tol: 0.01 }
    expect(checkNumeric('97 °C', k)).toMatchObject({ correct: false, reason: 'value' })
    expect(checkNumeric('100.5 °C', k).correct).toBe(true)
    expect(checkNumeric('373.15 K', k).correct).toBe(true)
    expect(checkNumeric('25 °C', { value: 27, unit: '°C' }).correct).toBe(false)
  })
  it.each(['2.0×10^3 m', '2.0 x 10^3 m', '2·10³ m', '2*10^3 m', '2.0 X 10**3 m', '2×10^+3 m'])('sci notation %s', (r) =>
    expect(checkNumeric(r, key).correct).toBe(true))
  it('sci notation negative exponent and sig figs from mantissa', () => {
    expect(checkNumeric('2×10⁻³ m', { value: 0.002, unit: 'm' }).correct).toBe(true)
    expect(checkNumeric('2.0×10^3 m', { ...key, sig_figs: 2 }).correct).toBe(true)
    expect(checkNumeric('2.00×10^3 m', { ...key, sig_figs: 2 }).reason).toBe('sig_figs')
  })
  it('slash makes the rest the denominator', () => {
    const k = { value: 5, unit: 'J/(kg K)' }
    for (const r of ['5 J/kg K', '5 J/kg·K', '5 J/kg/K', '5 J/(kg K)', '5 J kg^-1 K^-1']) expect(checkNumeric(r, k).correct).toBe(true)
  })
  it('sig_figs coercion', () => {
    expect(checkNumeric('2000.0 m', { ...key, sig_figs: '2' }).reason).toBe('sig_figs')
    expect(checkNumeric('2000.0 m', { ...key, sig_figs: 2.5 }).correct).toBe(true)
    expect(checkNumeric('2000.0 m', { ...key, sig_figs: 'abc' }).correct).toBe(true)
  })
})

describe('fix round 2: small-magnitude keys', () => {
  it('m*v with tiny values', () => {
    const K = { expr: 'm*v', vars: { m: [1e-6, 2e-6], v: [1e-6, 2e-6] } }
    for (const r of ['0', '2*m*v', 'm+v-m-v']) expect(checkExpression(r, K)).toMatchObject({ correct: false, reason: 'value' })
    expect(checkExpression('v*m', K).correct).toBe(true)
  })
  it('q*E with charge-sized values', () => {
    const K = { expr: 'q*E', vars: { q: [1.6e-19, 3.2e-19], E: [1, 100] } }
    for (const r of ['0', 'q', 'q*E*E']) expect(checkExpression(r, K)).toMatchObject({ correct: false, reason: 'value' })
    expect(checkExpression('E*q', K).correct).toBe(true)
  })
  it('near-zero vs 0 still passes at unit scale', () =>
    expect(checkExpression('m-m+1e-15', { expr: '0', vars: { m: [1, 5] } }).correct).toBe(true))
})
