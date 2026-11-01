import { useState, useEffect } from 'react'
import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'

// Info card pinned to the scene's top-right corner. On narrow canvases
// (phones) it starts collapsed to a small "Info" button so it doesn't cover
// the simulation; tap to open or close it.
// interactive: let the card itself take clicks (cards with buttons/inputs).
export default function SceneCard({ interactive = false, children }) {
  const narrow = useThree((s) => s.size.width < 640)
  const [open, setOpen] = useState(!narrow)
  useEffect(() => { setOpen(!narrow) }, [narrow])

  return (
    <Html calculatePosition={(_, __, size) => [size.width - 12, 52]} style={{ pointerEvents: interactive ? 'auto' : 'none' }}>
      <div style={{ transform: 'translateX(-100%)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        {narrow && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            style={{
              pointerEvents: 'auto', minHeight: 32, padding: '0 12px', borderRadius: 8,
              background: 'rgb(var(--c-panel) / 0.92)', border: '1px solid rgb(var(--c-border))',
              color: 'rgb(var(--c-text))', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12,
              backdropFilter: 'blur(8px)', cursor: 'pointer',
            }}
          >
            {open ? 'Hide info' : 'Info'}
          </button>
        )}
        {open && children}
      </div>
    </Html>
  )
}
