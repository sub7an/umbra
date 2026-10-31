import { useState } from 'react'
import useModuleStore from '../../store/useModuleStore'
import SceneWrapper from '../../components/SceneWrapper'
import InfoPanel from '../../components/InfoPanel'
import ModuleShell, { SceneCaption } from '../../components/ModuleShell'
import ControlPanel, { ControlGroup, OptionList } from '../../components/ControlPanel'
import RippleTank from './RippleTank'
import DoubleSlit from './DoubleSlit'
import NormalModes, { MODES } from './NormalModes'

const ACCENT = '#22d3ee'

const VIEWS = [
  { id: 'ripple', label: 'Ripple tank' },
  { id: 'slit',   label: 'Double slit' },
  { id: 'modes',  label: 'Normal modes' },
]

const CAMERA = {
  ripple: [0, 11, 9],
  slit:   [2, 9, 9],
  modes:  [0, 12, 8],
}

function buildEquations(view) {
  switch (view) {
    case 'ripple': return {
      domain: 'WAVE MECHANICS · WAVE EQUATION',
      syllabus: 'AQA 3.3.1 · IB 4.4 · superposition',
      primaryEq: `\\frac{\\partial^2 u}{\\partial t^2} = c^2 \\nabla^2 u`,
      derivedEqs: [
        { label: 'Superposition', eq: `u = \\textstyle\\sum_i A_i \\cos(kr_i - \\omega t)` },
        { label: 'Interference',  eq: `\\Delta = r_2 - r_1` },
      ],
      tryThis: [
        'Place two sources, then a third between them — watch the nodal lines rearrange.',
        'Switch to 2 SLITS and count the bright bands behind the barrier.',
      ],
      checkpoint: {
        q: 'Two sources are in phase. At a point exactly equidistant from both, is the water high, low, or still?',
        a: 'High (then low) — equal path means Δ = 0, so the waves always arrive in phase and add: a constructive antinode, oscillating at full amplitude.',
      },
    }
    case 'slit': return {
      domain: 'WAVE MECHANICS · DOUBLE SLIT',
      syllabus: 'AQA 3.3.2 · IB 9.3 · Young’s slits',
      primaryEq: `I \\propto \\cos^2\\!\\left(\\frac{\\pi d \\sin\\theta}{\\lambda}\\right)`,
      derivedEqs: [
        { label: 'Maxima',        eq: `d \\sin\\theta = m\\lambda` },
        { label: 'Fringe spacing', eq: `\\Delta y = \\lambda L / d` },
      ],
      tryThis: [
        'Halve the slit separation d in your head — by Δy = λL/d the fringes should double in spacing.',
        'Ask: what changes if you swap red light for blue (smaller λ)?',
      ],
      checkpoint: {
        q: 'You double the slit separation d. Do the bright fringes move closer together or further apart?',
        a: 'Closer together. Δy = λL/d, so doubling d halves the fringe spacing.',
      },
    }
    case 'modes': return {
      domain: 'WAVE MECHANICS · NORMAL MODES',
      syllabus: 'AQA 3.3.1.3 · IB 4.5 · standing waves',
      primaryEq: `u_{mn} = A \\sin\\!\\frac{m\\pi x}{L}\\sin\\!\\frac{n\\pi y}{L}\\cos(\\omega_{mn}t)`,
      derivedEqs: [
        { label: 'Eigenfreq.', eq: `\\omega_{mn} = \\pi c\\sqrt{m^2{+}n^2}/L` },
        { label: 'Nodes',      eq: `x = kL/m,\\quad y = kL/n` },
      ],
      tryThis: [
        'Select (2,1) then (1,2) — same frequency, rotated pattern. That is degeneracy.',
        'Find the fundamental (1,1): the whole membrane moves as one, no internal nodal lines.',
      ],
      checkpoint: {
        q: 'Mode (3,1) — how many nodal lines (still lines) lie inside the membrane?',
        a: 'Two: m−1 = 2 nodal lines across x, and n−1 = 0 across y.',
      },
    }
    default: return { domain: '', primaryEq: '', derivedEqs: [] }
  }
}

function buildExplanation(view) {
  switch (view) {
    case 'ripple': return 'Click on the left half to place a wave source (up to 5). Waves propagate outward and interfere — crest+crest gives constructive interference (bright peaks), crest+trough gives destructive interference (flat nodes). Switch to 1 SLIT or 2 SLITS to insert a barrier: waves diffract through the openings and form the classic single- or double-slit interference pattern behind it. FDTD 128×128 grid; sponge absorbs edges.'
    case 'slit': return 'A plane wave passes through two slits separated by d, creating two coherent point sources. Their superposed wavefronts form a standing interference pattern. Bright fringes where path difference Δ = mλ (constructive). Dark fringes where Δ = (m+½)λ (destructive). Fringe spacing scales as Δy = λL/d.'
    case 'modes': return 'A rectangular membrane fixed at all edges can only vibrate in quantized normal modes (m, n). Each mode has a characteristic nodal grid: m−1 nodal lines in x, n−1 in y. Frequency scales as √(m²+n²). Mode (1,1) is the fundamental; (2,1) and (1,2) are degenerate. Click a mode to see its pattern.'
    default: return ''
  }
}

export default function WaveModule() {
  const view                    = useModuleStore((s) => s.wave.viewType)
  const modeIdx                 = useModuleStore((s) => s.wave.modeIdx)
  const slitMode                = useModuleStore((s) => s.wave.slitMode)
  const setView                 = useModuleStore((s) => s.setWaveView)
  const setModeIdx              = useModuleStore((s) => s.setWaveModeIdx)
  const setSlitMode             = useModuleStore((s) => s.setWaveSlitMode)
  const [sourceCount, setCount] = useState(1)
  const [clearCount, setClear]  = useState(0)

  const eq = buildEquations(view)
  const [m, n] = MODES[modeIdx]

  return (
    <ModuleShell
      title="Wave Mechanics"
      accent={ACCENT}
      views={VIEWS}
      activeView={view}
      onViewChange={setView}
      readout={view === 'ripple' ? `${sourceCount} source${sourceCount === 1 ? '' : 's'}` : view === 'modes' ? <>mode ({m},{n}) · ω = π·{Math.sqrt(m * m + n * n).toFixed(2)} c/L</> : 'Two-slit interference'}
      lesson={
        <InfoPanel
          domain={eq.domain}
          syllabus={eq.syllabus}
          primaryEq={eq.primaryEq}
          derivedEqs={eq.derivedEqs}
          explanation={buildExplanation(view)}
          tryThis={eq.tryThis}
          checkpoint={eq.checkpoint}
        />
      }
      controls={
        <ControlPanel title="Controls" footer="128 × 128 wave mesh · finite differences">
          {view === 'ripple' && (
            <>
              <ControlGroup label="Barrier">
                <OptionList
                  label="Barrier"
                  options={[
                    { id: 0, label: 'Open water' },
                    { id: 1, label: 'Single slit', desc: 'Watch the wave diffract' },
                    { id: 2, label: 'Double slit', desc: 'Two sources interfere' },
                  ]}
                  value={slitMode}
                  onChange={setSlitMode}
                />
              </ControlGroup>
              <ControlGroup label="Sources">
                <p className="text-[13px] text-text-dim">Click the water surface to drop an oscillating source.</p>
                <button type="button" onClick={() => setClear((c) => c + 1)} className="ui-btn w-full">Clear sources</button>
              </ControlGroup>
            </>
          )}
          {view === 'modes' && (
            <ControlGroup label="Normal mode (m, n)">
              <div role="radiogroup" aria-label="Normal mode" className="grid grid-cols-3 gap-1.5">
                {MODES.map(([mm, nn], i) => (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={modeIdx === i}
                    onClick={() => setModeIdx(i)}
                    className={`h-10 rounded-md border font-mono-data text-[13px] transition-colors duration-150 ${
                      modeIdx === i ? 'border-cyan-glow/60 bg-cyan-glow/10 text-text-primary' : 'border-border-subtle bg-ground/40 text-text-dim hover:text-text-primary hover:bg-panel-hover'
                    }`}
                  >
                    {mm},{nn}
                  </button>
                ))}
              </div>
            </ControlGroup>
          )}
          {view === 'slit' && (
            <p className="text-sm text-text-dim">Orbit and zoom the scene to compare the bright and dark fringes.</p>
          )}
        </ControlPanel>
      }
    >
      <SceneWrapper cameraPosition={CAMERA[view]} showGrid={false} minDist={4} maxDist={28}>
        {view === 'ripple' && <RippleTank onSourceCount={setCount} slitMode={slitMode} clearCount={clearCount} />}
        {view === 'slit'   && <DoubleSlit />}
        {view === 'modes'  && <NormalModes modeIdx={modeIdx} />}
      </SceneWrapper>
      <SceneCaption>{VIEWS.find((v) => v.id === view)?.label}</SceneCaption>
    </ModuleShell>
  )
}
