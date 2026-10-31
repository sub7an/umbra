// Slider T (0.2–3) → hot reservoir temperature, with T_C fixed at 1.
// Kept modest so the Carnot cycle stays a readable shape on linear p–V axes.
export function hotReservoirT(T) {
  return 1 + T * 0.5
}
