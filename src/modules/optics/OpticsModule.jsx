import { useState } from 'react'
import useModuleStore from '../../store/useModuleStore'
import SceneWrapper from '../../components/SceneWrapper'
import InfoPanel from '../../components/InfoPanel'
import RayTracer from './RayTracer'
import LensLab from './LensLab'
import DiffractionGrating from './DiffractionGrating'

const ACCENT = '#fcd34d'

function Slider({ label, value, min, max, step, decimals, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>{label}</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: ACCENT, tabularNums: true }}>{value.toFixed(decimals)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: ACCENT, cursor: 'pointer' }} />
    </div>
  )
}

const VIEWS = [
  { id: 'prism', label: 'PRISM' },
  { id: 'lens',  label: 'LENS LAB' },
  { id: 'grating', label: 'DIFFRACTION' },
]

const CAMERA = {
  prism:   [2, 4.5, 10],
  lens:    [0, 3, 9],
  grating: [5, 3, 8],
}

function buildEquations(view) {
  switch (view) {
    case 'prism': return {
      domain: 'OPTICS · SNELL\'S LAW & DISPERSION',
      primaryEq: `n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2`,
      derivedEqs: [
        { label: 'Cauchy (glass)', eq: `n(\\lambda) = A + B/\\lambda^2` },
        { label: 'Deviation',     eq: `\\delta = (n-1)A \\text{ (thin prism)}` },
      ],
    }
    case 'lens': return {
      domain: 'OPTICS · THIN LENS EQUATION',
      primaryEq: `\\frac{1}{f} = \\frac{1}{d_o} + \\frac{1}{d_i}`,
      derivedEqs: [
        { label: 'Magnification', eq: `m = -d_i/d_o` },
        { label: 'Power',         eq: `P = 1/f \\text{ (diopters)}` },
      ],
    }
    case 'grating': return {
      domain: 'OPTICS · DIFFRACTION GRATING',
      primaryEq: `d\\sin\\theta_m = m\\lambda`,
      derivedEqs: [
        { label: 'Resolving power', eq: `\\mathcal{R} = mN` },
        { label: 'Free spectral range', eq: `\\Delta\\lambda_{\\rm FSR} = \\lambda/m` },
      ],
    }
    default: return { domain: '', primaryEq: '', derivedEqs: [] }
  }
}

function buildExplanation(view) {
  switch (view) {
    case 'prism': return '48 spectral rays (380–720 nm) pass through a glass prism. Cauchy dispersion n(λ) = A + B/λ² gives higher n for shorter wavelengths — violet bends most, red least — creating a rainbow on the projection screen. Use the PRISM ANGLE slider to rotate the prism: shallow angles show a narrow spread, steep angles push internal rays past the critical angle θ_c = arcsin(1/n) and trigger Total Internal Reflection (TIR), trapping those wavelengths inside.'
    case 'lens': return 'A biconvex lens refracts parallel rays through its curved surfaces. Paraxial rays (near the axis) all converge at the focal point f. The thin lens equation 1/f = 1/dₒ + 1/dᵢ relates object and image distances. Focal length is positive for converging lenses. Rays further from the axis suffer spherical aberration — they cross the axis slightly closer, which is why real lenses need multiple elements.'
    case 'grating': return 'A diffraction grating has thousands of equally-spaced slits (here: 600 lines/mm, d = 1.67 µm). Constructive interference occurs where path difference = mλ: d·sinθ = mλ. Each wavelength diffracts at a different angle — white light is spread into orders m = 0, ±1, ±2. The 0th order is straight-through, ±1st orders are the most intense. Larger |m| means wider angular spread.'
    default: return ''
  }
}

export default function OpticsModule() {
  const setActiveModule = useModuleStore((s) => s.setActiveModule)
  const [view, setView] = useState('prism')
  const [focalLength, setFocalLength] = useState(2.5)

  const eq = buildEquations(view)

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#08090a',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'JetBrains Mono, monospace',
    }}>
      <style>{`
        @keyframes umbra-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '11px 18px',
        borderBottom: '1px solid rgba(252,211,77,0.10)',
        background: 'rgba(8,9,10,0.97)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => setActiveModule(null)}
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'rgba(252,211,77,0.5)', background: 'none',
            border: 'none', cursor: 'pointer', padding: 0,
          }}
        >← MODULES</button>

        <div style={{ width: 1, height: 14, background: 'rgba(252,211,77,0.12)' }} />

        <span style={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: ACCENT, fontWeight: 700 }}>
          Optics
        </span>

        {/* LIVE badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '2px 8px',
          border: '1px solid rgba(252,211,77,0.28)',
          borderRadius: 2,
          background: 'rgba(252,211,77,0.05)',
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: ACCENT, boxShadow: `0 0 6px ${ACCENT}`,
            animation: 'umbra-pulse 1.8s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 8, letterSpacing: '0.2em', color: ACCENT }}>LIVE</span>
        </div>

        {/* View tabs */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {VIEWS.map((v) => (
            <button key={v.id} onClick={() => setView(v.id)} style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
              padding: '5px 12px',
              background: view === v.id ? 'rgba(252,211,77,0.09)' : 'transparent',
              border: `1px solid ${view === v.id ? 'rgba(252,211,77,0.33)' : 'rgba(255,255,255,0.07)'}`,
              color: view === v.id ? ACCENT : 'rgba(255,255,255,0.33)',
              borderRadius: 2, cursor: 'pointer',
            }}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Info panel */}
        <div style={{ width: 235, flexShrink: 0, borderRight: '1px solid rgba(252,211,77,0.07)' }}>
          <InfoPanel
            title="Optics"
            domain={eq.domain}
            primaryEq={eq.primaryEq}
            derivedEqs={eq.derivedEqs}
            explanation={buildExplanation(view)}
            accentColor="amber"
            footer="OPTICS · UMBRA"
          />
        </div>

        {/* 3D scene */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
          <SceneWrapper
            cameraPosition={CAMERA[view]}
            showGrid={false}
            minDist={3}
            maxDist={22}
          >
            {view === 'prism'   && <RayTracer />}
            {view === 'lens'    && <LensLab f={focalLength} />}
            {view === 'grating' && <DiffractionGrating />}
          </SceneWrapper>

          {/* SIM ACTIVE badge */}
          <div style={{
            position: 'absolute', bottom: 16, left: 16,
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '4px 10px',
            border: '1px solid rgba(252,211,77,0.18)',
            borderRadius: 2,
            background: 'rgba(8,9,10,0.88)',
            pointerEvents: 'none',
          }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: ACCENT, boxShadow: `0 0 4px ${ACCENT}` }} />
            <span style={{ fontSize: 8, letterSpacing: '0.2em', color: 'rgba(252,211,77,0.55)' }}>SIM ACTIVE</span>
          </div>

          {/* Orbit hint */}
          <div style={{
            position: 'absolute', bottom: 16, right: 16,
            fontSize: 8, letterSpacing: '0.12em', color: 'rgba(252,211,77,0.28)',
            pointerEvents: 'none',
          }}>
            DRAG TO ORBIT · SCROLL TO ZOOM
          </div>
        </div>

        {/* ── Parameter sidebar (Lens view only) ── */}
        {view === 'lens' && (
          <div style={{
            width: 180, flexShrink: 0,
            background: 'rgba(8,9,10,0.97)',
            borderLeft: '1px solid rgba(252,211,77,0.08)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '10px 14px',
              borderBottom: '1px solid rgba(252,211,77,0.08)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.30)',
            }}>
              Parameters
            </div>
            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Slider
                label="Focal length f"
                value={focalLength}
                min={1.5} max={5.0} step={0.1} decimals={1}
                onChange={setFocalLength}
              />
              <div style={{ height: 1, background: 'rgba(252,211,77,0.08)' }} />
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: 'rgba(255,255,255,0.22)', lineHeight: 1.6 }}>
                <p style={{ color: ACCENT, marginBottom: 4 }}>● focal pts: ±{focalLength.toFixed(1)}</p>
                <p>Power: {(1/focalLength).toFixed(2)} D</p>
                <p>Magnification varies</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
