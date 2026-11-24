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
