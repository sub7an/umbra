import { useState, useEffect, useCallback } from 'react'

// Brief branded splash on first load of a session. Short on purpose: it covers
// the first WebGL compile, then gets out of the way. Any key or click skips it.
const AUTO_T = 900

export default function BootScreen({ onComplete }) {
  const [fading, setFading] = useState(false)

  const finish = useCallback(() => {
    setFading(true)
    setTimeout(onComplete, 260)
  }, [onComplete])

  useEffect(() => {
    const id = setTimeout(finish, AUTO_T)
    const onKey = () => finish()
    window.addEventListener('keydown', onKey, { once: true })
    return () => {
      clearTimeout(id)
      window.removeEventListener('keydown', onKey)
    }
  }, [finish])

  return (
    <div
      onClick={finish}
      role="presentation"
      className="fixed inset-0 z-[9000] flex flex-col items-center justify-center gap-4 bg-ground select-none cursor-pointer"
      style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.26s ease' }}
    >
      <style>{`
        @keyframes boot-in {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
      <div className="flex items-center gap-3" style={{ animation: 'boot-in 0.45s cubic-bezier(0.16,1,0.3,1) both' }}>
        <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-glow text-ground text-[22px] font-bold" aria-hidden="true">U</span>
        <span className="text-[34px] font-semibold tracking-[-0.02em] text-text-primary">Umbra</span>
      </div>
      <p className="text-[14px] text-text-dim" style={{ animation: 'boot-in 0.45s cubic-bezier(0.16,1,0.3,1) 0.08s both' }}>
        Interactive physics, in real time
      </p>
    </div>
  )
}
