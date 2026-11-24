const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ')

export function checkOrder(response, key) {
  if (!Array.isArray(response) || !response.length || !key || !Array.isArray(key.order)) {
    return { correct: false, reason: 'format' }
  }
  if (response.some((x) => typeof x !== 'string')) return { correct: false, reason: 'format' }
  const got = response.map(norm)
  const normalised = got.join(',')
  const ok = got.length === key.order.length && got.every((x, i) => x === norm(key.order[i]))
  return { correct: ok, reason: ok ? 'ok' : 'value', normalised }
}
