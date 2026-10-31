// Quick crossfade between screens. 'out' fades the current screen to the
// ground colour, the app swaps the module underneath, then 'in' fades back.
// Kept short so switching modules in class never feels like waiting.
export default function TransitionOverlay({ phase }) {
  if (phase === 'idle') return null

  return (
    <>
      <style>{`
        @keyframes umbra-xfade-out { from { opacity: 0 } to { opacity: 1 } }
        @keyframes umbra-xfade-in  { from { opacity: 1 } to { opacity: 0 } }
      `}</style>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[5000] pointer-events-none bg-ground"
        style={{
          animation: phase === 'out'
            ? 'umbra-xfade-out 180ms ease-out both'
            : 'umbra-xfade-in 220ms ease-out both',
        }}
      />
    </>
  )
}
