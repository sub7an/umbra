// Mastery bands for the teacher heatmap. p_known is the BKT probability the
// student knows the topic (public.mastery). Thresholds: <0.4 low, <0.7 developing,
// <0.95 secure, >=0.95 mastered. No row yet → 'none'.
//
// Colour is a single-hue blue ordinal ramp (validated colour-blind safe on the dark
// panel with the dataviz validator: monotone lightness, visible step gaps). Colour is
// never the only cue: every cell also prints its percentage and band label, and the
// bands carry a pattern (hatch for none / low) for print and forced-colours.
export const MASTERY_LEVELS = {
  none: { label: 'Not started', short: '–', bg: 'transparent', ink: 'rgb(var(--c-text-muted))' },
  low: { label: 'Low', short: 'Low', bg: '#184f95', ink: '#ffffff' },
  developing: { label: 'Developing', short: 'Dev', bg: '#2a78d6', ink: '#ffffff' },
  secure: { label: 'Secure', short: 'Sec', bg: '#6da7ec', ink: '#0b0d12' },
  mastered: { label: 'Mastered', short: 'Mst', bg: '#b7d3f6', ink: '#0b0d12' },
}

export const MASTERY_ORDER = ['low', 'developing', 'secure', 'mastered']

export function heatmapColour(p) {
  if (typeof p !== 'number' || !Number.isFinite(p)) return 'none'
  if (p < 0.4) return 'low'
  if (p < 0.7) return 'developing'
  if (p < 0.95) return 'secure'
  return 'mastered'
}
