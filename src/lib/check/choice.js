const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ')

export function checkChoice(response, key) {
  if (typeof response !== 'string' || !response.trim() || !key || key.answer == null) {
    return { correct: false, reason: 'format' }
  }
  const n = norm(response)
  return n === norm(key.answer) ? { correct: true, reason: 'ok', normalised: n } : { correct: false, reason: 'value', normalised: n }
}
