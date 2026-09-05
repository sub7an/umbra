import { useEffect, useState } from 'react'
import { isMuted, setMuted, tick, click } from '../lib/sound'

/**
 * Master sound toggle + global UI sound wiring.
 * One delegated listener pair gives every button in the app hover ticks
 * and click blips — no per-component wiring.
 */
export default function SoundToggle() {
  const [muted, set] = useState(isMuted())

  useEffect(() => {
    const onOver = (e) => {
      if (e.target.closest?.('button, [role="button"], a')) tick()
    }
    const onClick = (e) => {
      if (e.target.closest?.('button, [role="button"], a')) click()
    }
    document.addEventListener('pointerover', onOver, { passive: true })
    document.addEventListener('pointerdown', onClick, { passive: true })
    return () => {
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerdown', onClick)
    }
  }, [])

  return (
    <button
      onClick={() => { const m = !muted; setMuted(m); set(m) }}
      title={muted ? 'Unmute interface sounds' : 'Mute interface sounds'}
      style={{
        position: 'fixed', bottom: 14, left: 14, zIndex: 10000,
        display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.12em',
        color: muted ? 'rgba(255,255,255,0.28)' : 'rgba(94,106,210,0.75)',
        background: 'rgba(8,9,10,0.72)', backdropFilter: 'blur(8px)',
        border: `1px solid ${muted ? 'rgba(255,255,255,0.08)' : 'rgba(94,106,210,0.25)'}`,
        borderRadius: 3, padding: '5px 9px', cursor: 'pointer',
        transition: 'color 0.15s, border-color 0.15s',
      }}
    >
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <path d="M1.5 4V7H3.5L6 9.5V1.5L3.5 4H1.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
        {muted
          ? <path d="M7.5 4L10 6.5M10 4L7.5 6.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          : <path d="M7.5 3.5C8.3 4.3 8.3 6.7 7.5 7.5M9 2.2C10.4 3.6 10.4 7.4 9 8.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />}
      </svg>
      {muted ? 'MUTED' : 'SND'}
    </button>
  )
}
