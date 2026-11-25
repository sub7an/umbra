// Splits item text on inline $…$ maths. Pure; used by MathText and for plain previews.
export function splitMath(text) {
  const out = []
  const s = String(text ?? '')
  let i = 0, buf = ''
  while (i < s.length) {
    const ch = s[i]
    if (ch === '\\' && s[i + 1] === '$') { buf += '$'; i += 2; continue }
    if (ch === '$') {
      const end = s.indexOf('$', i + 1)
      if (end === -1) { buf += s.slice(i); break }
      if (buf) out.push({ math: false, text: buf })
      buf = ''
      out.push({ math: true, text: s.slice(i + 1, end) })
      i = end + 1
      continue
    }
    buf += ch
    i++
  }
  if (buf) out.push({ math: false, text: buf })
  return out
}

// Plain text for previews and aria labels: maths kept as written, without $.
export const plainMath = (text) => splitMath(text).map((p) => p.text).join('')
  .replace(/\\(text|mathrm)\{([^}]*)\}/g, '$2').replace(/\\[,;: ]/g, ' ').replace(/\\times/g, '×')
  .replace(/\\(mu)/g, 'µ').replace(/\\(Omega)/g, 'Ω').replace(/\^\\circ/g, '°').replace(/[{}\\]/g, '')
  .replace(/\s+/g, ' ').trim()

