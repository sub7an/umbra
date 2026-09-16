// Home-screen "Ways to explore" band — surfaces the interactive features that
// were previously buried in tiny nav pills, as labeled cards grouped by intent.
const GROUPS = [
  {
    label: 'LEARN',
    items: [
      { title: 'Guided Journeys', desc: 'Story-driven arcs from Galileo to Hawking, with quizzes & XP.', accent: '#f59e0b', icon: '✦', event: 'umbra-journeys-open' },
      { title: 'Daily Challenges', desc: 'Timed physics puzzles across the modules — build a streak.', accent: '#ef4444', icon: '◈', event: 'umbra-challenges-open' },
    ],
  },
  {
    label: 'EXPLORE',
    items: [
      { title: 'Live from Orbit', desc: 'What the James Webb telescope is observing right now.', accent: '#22c55e', icon: '◎', event: 'umbra-telescopes-open', live: true },
      { title: 'Surprise Me', desc: 'Jump straight into a dramatic random physics scene.', accent: '#2dd4bf', icon: '⚄', event: 'umbra-surprise' },
    ],
  },
  {
    label: 'INTERACT',
    items: [
      { title: 'Multiplayer Rooms', desc: 'Share a synced simulation with a class or study group.', accent: '#5e6ad2', icon: '⊚', event: 'umbra-rooms-open' },
      { title: 'Hand Gestures', desc: 'Control the camera and UI with your webcam — no mouse.', accent: '#a855f7', icon: '✋', event: 'umbra-gesture-open' },
    ],
  },
]

function Card({ item }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent(item.event))}
      className="group text-left"
      style={{
        display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%',
        background: 'rgba(17,17,19,0.6)', border: `1px solid ${item.accent}22`,
        borderRadius: 8, padding: '16px 16px', cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s, transform 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${item.accent}66`; e.currentTarget.style.background = `${item.accent}0d`; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${item.accent}22`; e.currentTarget.style.background = 'rgba(17,17,19,0.6)'; e.currentTarget.style.transform = 'none' }}
    >
      <span style={{
        width: 34, height: 34, borderRadius: 7, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${item.accent}1a`, border: `1px solid ${item.accent}40`,
        color: item.accent, fontSize: 16,
      }}>{item.icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
          <span style={{ fontFamily: 'Chakra Petch, sans-serif', fontWeight: 600, fontSize: 15, color: '#f7f8f8' }}>{item.title}</span>
          {item.live && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: 8, letterSpacing: '0.1em', color: '#22c55e' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e', animation: 'umbra-pulse 1.4s ease-in-out infinite' }} />LIVE
            </span>
          )}
        </div>
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12.5, lineHeight: 1.45, color: 'rgba(247,248,248,0.6)' }}>{item.desc}</div>
      </div>
    </button>
  )
}

export default function FeatureRail() {
  return (
    <section className="shrink-0 px-8 lg:px-14 pt-4 pb-14">
      <div className="flex items-center gap-4 mb-6">
        <span className="font-mono-data text-[10px] tracking-[0.24em] uppercase" style={{ color: 'rgba(94,106,210,0.7)' }}>
          // WAYS TO EXPLORE
        </span>
        <div className="flex-1 h-px" style={{ background: 'rgba(94,106,210,0.1)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
        {GROUPS.map((g) => (
          <div key={g.label}>
            <div className="font-mono-data text-[9px] tracking-[0.2em] mb-3" style={{ color: 'rgba(247,248,248,0.4)' }}>{g.label}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {g.items.map((it) => <Card key={it.title} item={it} />)}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
