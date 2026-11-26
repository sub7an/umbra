import { describe, it, expect } from 'vitest'
import { heatmapColour, MASTERY_LEVELS } from './heatmapColour'

describe('heatmapColour', () => {
  it('maps p_known to the four mastery bands at the brief thresholds', () => {
    expect(heatmapColour(0.39)).toBe('low')
    expect(heatmapColour(0.69)).toBe('developing')
    expect(heatmapColour(0.94)).toBe('secure')
    expect(heatmapColour(0.95)).toBe('mastered')
  })
  it('puts each threshold in the higher band', () => {
    expect(heatmapColour(0)).toBe('low')
    expect(heatmapColour(0.4)).toBe('developing')
    expect(heatmapColour(0.7)).toBe('secure')
    expect(heatmapColour(1)).toBe('mastered')
  })
  it('returns none when there is no mastery value yet', () => {
    expect(heatmapColour(null)).toBe('none')
    expect(heatmapColour(undefined)).toBe('none')
    expect(heatmapColour(Number.NaN)).toBe('none')
  })
  it('every band has a label for text, not colour alone', () => {
    for (const k of ['none', 'low', 'developing', 'secure', 'mastered']) expect(MASTERY_LEVELS[k].label).toBeTruthy()
  })
})
