// Home-screen "Ways to explore" band — surfaces the interactive features that
// were previously buried in tiny nav pills, as labeled cards grouped by intent.
const GROUPS = [
  {
    label: 'Learn',
    items: [
      { title: 'Guided journeys', desc: 'Story-driven arcs from Galileo to Hawking, with quizzes & XP.', accent: '#f59e0b', icon: '✦', event: 'umbra-journeys-open' },
      { title: 'Daily challenges', desc: 'Timed physics puzzles across the modules — build a streak.', accent: '#ef4444', icon: '◈', event: 'umbra-challenges-open' },
    ],
  },
  {
    label: 'Explore',
    items: [
      { title: 'Live from orbit', desc: 'What the James Webb telescope is observing right now.', accent: '#22c55e', icon: '◎', event: 'umbra-telescopes-open', live: true },
      { title: 'Surprise me', desc: 'Jump straight into a dramatic random physics scene.', accent: '#2dd4bf', icon: '⚄', event: 'umbra-surprise' },
    ],
  },
  {
    label: 'Interact',
    items: [
      { title: 'Multiplayer rooms', desc: 'Share a synced simulation with a class or study group.', accent: '#7c8cff', icon: '⊚', event: 'umbra-rooms-open' },
      { title: 'Hand gestures', desc: 'Control the camera and UI with your webcam — no mouse.', accent: '#a855f7', icon: '✋', event: 'umbra-gesture-open' },
    ],
  },
]

function Card({ item }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(item.event))}
      className="group flex items-start gap-3.5 w-full text-left p-4 rounded-xl bg-panel border border-border-subtle hover:bg-panel-hover transition-colors duration-150"
    >
      <span
        className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0 text-[17px]"
        style={{ background: `${item.accent}1a`, border: `1px solid ${item.accent}33`, color: item.accent }}
        aria-hidden="true"
      >
        {item.icon}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[15px] font-semibold text-text-primary">{item.title}</span>
          {item.live && (
            <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded text-[11px] font-semibold text-emerald-glow bg-emerald-glow/10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-glow" aria-hidden="true" />Live
            </span>
          )}
        </div>
        <p className="text-[14px] leading-snug text-text-dim">{item.desc}</p>
      </div>
    </button>
  )
}

export default function FeatureRail() {
  return (
    <section className="px-4 sm:px-8 pb-16" aria-labelledby="ways-h">
      <h2 id="ways-h" className="text-[26px] font-semibold tracking-[-0.02em] text-text-primary mb-1">More ways to learn</h2>
      <p className="text-[15px] text-text-dim mb-6">Structured paths, practice and live data alongside the simulations.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {GROUPS.map((g) => (
          <div key={g.label}>
            <h3 className="ui-eyebrow mb-3">{g.label}</h3>
            <div className="flex flex-col gap-3">
              {g.items.map((it) => <Card key={it.title} item={it} />)}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
