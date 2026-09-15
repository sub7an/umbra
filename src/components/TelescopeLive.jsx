import { useEffect, useState, useCallback } from 'react'
import { track } from '@vercel/analytics'
import useModuleStore from '../store/useModuleStore'
import DecodeText from './DecodeText'

// ── The Umbra differentiator: map a live observation to a playable module ─────
// Checks keywords first (richer), then the science category. Returns the module
// to launch + a physics-framed call to action.
function bridge(category = '', keywords = '') {
  const s = `${keywords} ${category}`.toLowerCase()
  const has = (re) => re.test(s)
  if (has(/black hole|active galactic|agn|quasar|accretion|gravitational/))
    return { module: 'general-relativity', label: 'Warp spacetime around a mass', color: '#fb923c' }
  if (has(/galaxy|galaxies|dark matter|rotation curve|cosmolog|hubble/))
    return { module: 'frontier-physics', label: 'Explore galaxy rotation & dark matter', color: '#e040fb' }
  if (has(/asteroid|comet|kuiper|trans-neptun|solar system|meteor|centaur/))
    return { module: 'dynamical-systems', label: 'Simulate orbital & chaotic motion', color: '#22c55e' }
  if (has(/exoplanet|transit|planetary system/))
    return { module: 'frontier-physics', label: 'Explore orbital dynamics', color: '#e040fb' }
  if (has(/supernova|neutron|pulsar|compact object/))
    return { module: 'general-relativity', label: 'Explore extreme gravity', color: '#fb923c' }
  if (has(/nebula|circumstellar|protoplanetary|dust|emission|ism/))
    return { module: 'optics', label: 'Trace light, dispersion & spectra', color: '#fcd34d' }
  if (has(/spectroscop|dwarf|supergiant|stellar|star|brown dwarf|photospher/))
    return { module: 'quantum-mechanics', label: 'See the quantum physics of starlight', color: '#a855f7' }
  if (has(/wave|interferen|resonan/))
    return { module: 'wave-mechanics', label: 'Play with wave interference', color: '#22d3ee' }
  return { module: 'frontier-physics', label: 'Explore the frontier physics', color: '#5e6ad2' }
}

const CAT_COLOR = {
  Galaxy: '#e040fb', Star: '#f59e0b', 'Solar System': '#2dd4bf',
  Calibration: '#8d8d96', 'Stellar Cluster': '#a855f7', Unidentified: '#8d8d96',
  Exoplanet: '#22c55e', Nebula: '#fcd34d',
}

function fmtWhen(iso, status) {
  if (!iso) return ''
  const t = new Date(iso).getTime(), now = Date.now()
  const mins = Math.round(Math.abs(now - t) / 60000)
  const rel = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`
  if (status === 'observing') return `started ${rel} ago`
  if (status === 'recent') return `ended ${rel} ago`
  return `in ${rel}`
}

function Chip({ text, color }) {
  return (
    <span style={{
      fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.06em',
      color, background: `${color}1a`, border: `1px solid ${color}40`,
      borderRadius: 3, padding: '2px 7px', whiteSpace: 'nowrap',
    }}>{text}</span>
  )
}

function TimelineRow({ obs, dim }) {
  if (!obs) return null
  const c = CAT_COLOR[obs.category] || '#5e6ad2'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', opacity: dim ? 0.6 : 1 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0 }} />
      <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12.5, color: '#f7f8f8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {obs.target}
      </span>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'rgba(247,248,248,0.4)', whiteSpace: 'nowrap' }}>
        {obs.instrument?.split(' ')[0]}
      </span>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'rgba(247,248,248,0.35)', whiteSpace: 'nowrap' }}>
        {fmtWhen(obs.startTime, obs.status)}
      </span>
    </div>
  )
}

export default function TelescopeLive() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const setModule = useModuleStore(s => s.setActiveModule)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/telescopes')
      const d = await r.json()
      if (d.error) setErr(d.error); else { setData(d); setErr(null) }
    } catch (e) { setErr(e.message) }
  }, [])

  useEffect(() => {
    const h = () => { setOpen(true); track('telescopes_opened') }
    window.addEventListener('umbra-telescopes-open', h)
    return () => window.removeEventListener('umbra-telescopes-open', h)
  }, [])

  useEffect(() => {
    if (!open) return
    load()
    const iv = setInterval(load, 60000) // refresh every minute while open
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', esc)
    return () => { clearInterval(iv); window.removeEventListener('keydown', esc) }
  }, [open, load])

  if (!open) return null

  const cur = data?.jwst?.current
  const b = cur ? bridge(cur.category, cur.keywords) : null
  const catColor = cur ? (CAT_COLOR[cur.category] || '#5e6ad2') : '#5e6ad2'
  const keywords = (cur?.keywords || '').split(',').map(k => k.trim()).filter(Boolean).slice(0, 4)

  const simulate = () => {
    if (!b) return
    track('telescope_simulate', { module: b.module, category: cur?.category })
    setOpen(false)
    setModule(b.module)
  }
  const lookUp = () => {
    if (!cur) return
    track('telescope_lookup', { target: cur.target })
    const q = encodeURIComponent(`${cur.target} James Webb Space Telescope`)
    window.open(`https://www.google.com/search?q=${q}`, '_blank', 'noopener')
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10150,
        background: 'rgba(8,9,10,0.9)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '6vh 16px 48px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 620, animation: 'umbra-slide-up 0.35s cubic-bezier(0.16,1,0.3,1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'umbra-pulse 1.4s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.28em', color: 'rgba(94,106,210,0.75)' }}>
            LIVE FROM ORBIT · JWST
          </span>
        </div>

        {err && (
          <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 13, color: 'rgba(252,165,165,0.9)', padding: '16px 0' }}>
            Couldn’t reach the schedule feed right now. {err}
          </div>
        )}

        {!data && !err && (
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.2em', color: 'rgba(94,106,210,0.5)', padding: '20px 0', animation: 'umbra-pulse 1.4s ease-in-out infinite' }}>
            CONTACTING WEBB…
          </div>
        )}

        {cur && (
          <>
            {/* Current target hero */}
            <div style={{
              background: 'rgba(17,17,19,0.95)', border: `1px solid ${catColor}40`,
              borderRadius: 8, padding: '22px 22px', marginBottom: 14,
              boxShadow: `0 0 40px ${catColor}14`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.14em', color: cur.status === 'observing' ? '#22c55e' : 'rgba(247,248,248,0.5)' }}>
                  {cur.status === 'observing' ? '● OBSERVING NOW' : '● MOST RECENT'}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'rgba(247,248,248,0.4)', marginLeft: 'auto' }}>
                  {fmtWhen(cur.startTime, cur.status)}
                </span>
              </div>

              <DecodeText
                text={cur.target}
                duration={700}
                as="div"
                style={{ fontFamily: 'Chakra Petch, sans-serif', fontWeight: 700, fontSize: 'clamp(22px,4vw,32px)', color: '#f7f8f8', lineHeight: 1.1, marginBottom: 12, wordBreak: 'break-word' }}
              />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {cur.category && <Chip text={cur.category.toUpperCase()} color={catColor} />}
                {cur.instrument && <Chip text={cur.instrument} color="#5e6ad2" />}
                {keywords.map(k => <Chip key={k} text={k} color="rgba(247,248,248,0.5)" />)}
              </div>

              {/* THE bridge — turn the observation into physics */}
              {b && (
                <button
                  onClick={simulate}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 6, cursor: 'pointer', marginBottom: 8,
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: '0.1em', fontWeight: 700,
                    color: '#08090a', background: b.color, border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  ⚛ {b.label.toUpperCase()} →
                </button>
              )}
              <button
                onClick={lookUp}
                style={{
                  width: '100%', padding: '10px', borderRadius: 6, cursor: 'pointer',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.1em',
                  color: '#8b9cf7', background: 'rgba(94,106,210,0.08)', border: '1px solid rgba(94,106,210,0.3)',
                }}
              >
                LOOK UP THIS TARGET ↗
              </button>
            </div>

            {/* Running feed */}
            {(data.jwst.upcoming?.length > 0 || data.jwst.recent?.length > 0) && (
              <div style={{ background: 'rgba(17,17,19,0.7)', border: '1px solid rgba(94,106,210,0.14)', borderRadius: 8, padding: '14px 18px', marginBottom: 14 }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(94,106,210,0.6)', marginBottom: 4 }}>
                  UP NEXT
                </div>
                {(data.jwst.upcoming || []).map((o, i) => <TimelineRow key={'u' + i} obs={o} dim={i > 1} />)}
                {data.jwst.recent?.length > 0 && (
                  <>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(247,248,248,0.35)', margin: '10px 0 2px' }}>
                      JUST OBSERVED
                    </div>
                    {data.jwst.recent.map((o, i) => <TimelineRow key={'r' + i} obs={o} dim />)}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* Hubble handoff + footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <a href="https://spacetelescopelive.org/hubble" target="_blank" rel="noopener noreferrer"
            onClick={() => track('hubble_handoff')}
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.1em', color: 'rgba(94,106,210,0.7)', textDecoration: 'none', border: '1px solid rgba(94,106,210,0.25)', borderRadius: 4, padding: '6px 10px' }}>
            HUBBLE LIVE ↗
          </a>
          <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 11, color: 'rgba(247,248,248,0.35)' }}>
            Live from STScI schedules{data?.jwst?.weekOf ? ` · week of ${data.jwst.weekOf}` : ''} · ESC to close
          </span>
        </div>
      </div>
    </div>
  )
}
