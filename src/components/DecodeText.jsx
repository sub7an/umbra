import { useEffect, useState } from 'react'

const GLYPHS = '01∂∇ψΩλπΣφγβμ≈≠∞×∫√ħΔθ'
const TICK_MS = 40

/**
 * Text that materializes by decoding: characters flicker through physics
 * glyphs then lock in left-to-right.
 *
 * Driven by setInterval with a hard completion timeout — RAF-based animation
 * proved to stall in throttled/occluded tabs and strand the headline
 * mid-scramble. Whatever happens, the real text is on screen by
 * delay + duration + 250ms.
 */
export default function DecodeText({ text, delay = 0, duration = 900, as: Tag = 'span', ...rest }) {
  const [out, setOut] = useState(() => text.replace(/\S/g, ' '))

  useEffect(() => {
    // Reduced motion (or an already-hidden tab): skip straight to the text
    if (document.hidden || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setOut(text)
      return
    }

    let interval
    const start = performance.now() + delay

    const timer = setTimeout(() => {
      interval = setInterval(() => {
        const t = (performance.now() - start) / duration
        if (t >= 1) {
          clearInterval(interval)
          setOut(text)
          return
        }
        const lock = Math.floor(Math.max(0, t) * text.length * 1.15)
        let s = ''
        for (let i = 0; i < text.length; i++) {
          const ch = text[i]
          if (ch === ' ' || i < lock) s += ch
          else s += GLYPHS[(Math.random() * GLYPHS.length) | 0]
        }
        setOut(s)
      }, TICK_MS)
    }, delay)

    // Belt and braces: the finished text always lands
    const failsafe = setTimeout(() => {
      clearInterval(interval)
      setOut(text)
    }, delay + duration + 250)

    return () => { clearTimeout(timer); clearTimeout(failsafe); clearInterval(interval) }
  }, [text, delay, duration])

  return <Tag {...rest}>{out}</Tag>
}
