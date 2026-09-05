import { useEffect, useRef, useState } from 'react'

const GLYPHS = '01∂∇ψΩλπΣφγβμ≈≠∞×∫√ħΔθ'

/**
 * Text that materializes by decoding: characters flicker through physics
 * glyphs then lock in left-to-right.
 */
export default function DecodeText({ text, delay = 0, duration = 900, as: Tag = 'span', ...rest }) {
  const [out, setOut] = useState(() => text.replace(/\S/g, ' '))
  const rafRef = useRef()

  useEffect(() => {
    let start = null
    const step = (now) => {
      if (start === null) start = now + delay
      const t = (now - start) / duration
      if (t < 0) { rafRef.current = requestAnimationFrame(step); return }
      if (t >= 1) { setOut(text); return }
      let s = ''
      const lock = Math.floor(t * text.length * 1.15)
      for (let i = 0; i < text.length; i++) {
        const ch = text[i]
        if (ch === ' ' || i < lock) s += ch
        else s += GLYPHS[(Math.random() * GLYPHS.length) | 0]
      }
      setOut(s)
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [text, delay, duration])

  return <Tag {...rest}>{out}</Tag>
}
