import useModuleStore from '../../store/useModuleStore'
import SceneWrapper from '../../components/SceneWrapper'
import InfoPanel from '../../components/InfoPanel'
import ModuleShell, { SceneCaption } from '../../components/ModuleShell'
import ControlPanel from '../../components/ControlPanel'
import RayTracer from './RayTracer'
import LensLab from './LensLab'
import DiffractionGrating from './DiffractionGrating'

const ACCENT = '#fcd34d'


const VIEWS = [
  { id: 'prism', label: 'Prism' },
  { id: 'lens',  label: 'Lens lab' },
  { id: 'grating', label: 'Diffraction grating' },
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
      syllabus: 'AQA 3.3.2.3 · IB 4.4 · refraction & TIR',
      primaryEq: `n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2`,
      derivedEqs: [
        { label: 'Cauchy (glass)', eq: `n(\\lambda) = A + B/\\lambda^2` },
        { label: 'Deviation',     eq: `\\delta = (n-1)A \\text{ (thin prism)}` },
      ],
      tryThis: [
        'Steepen the prism angle until violet undergoes total internal reflection — you have passed the critical angle θ_c = arcsin(1/n).',
        'Compare where red and violet land: the shorter wavelength bends more.',
      ],
      checkpoint: {
        q: 'As white light enters the glass, which colour bends the most — red or violet?',
        a: 'Violet. Shorter wavelength → higher n by Cauchy n(λ)=A+B/λ², and a higher n means a larger bend at the surface.',
      },
    }
    case 'lens': return {
      domain: 'OPTICS · THIN LENS EQUATION',
      syllabus: 'IB Topic 4 · OCR optics · thin lens',
      primaryEq: `\\frac{1}{f} = \\frac{1}{d_o} + \\frac{1}{d_i}`,
      derivedEqs: [
        { label: 'Magnification', eq: `m = -d_i/d_o` },
        { label: 'Power',         eq: `P = 1/f \\text{ (diopters)}` },
      ],
      tryThis: [
        'Place the object at 2f — the image lands at 2f, same size, inverted (m = −1).',
        'Slide the object toward f and watch the image distance race off to infinity.',
      ],
      checkpoint: {
        q: 'The object sits just inside the focal length (d₀ < f). Is the image real or virtual?',
        a: 'Virtual, upright and magnified — this is the magnifying-glass case. 1/f = 1/d₀ + 1/dᵢ gives a negative dᵢ, so the image forms on the same side as the object.',
      },
    }
    case 'grating': return {
      domain: 'OPTICS · DIFFRACTION GRATING',
      syllabus: 'AQA 3.3.2.3 · IB 9.3 · diffraction grating',
      primaryEq: `d\\sin\\theta_m = m\\lambda`,
      derivedEqs: [
        { label: 'Resolving power', eq: `\\mathcal{R} = mN` },
        { label: 'Free spectral range', eq: `\\Delta\\lambda_{\\rm FSR} = \\lambda/m` },
      ],
      tryThis: [
        'Work out how many orders exist: with d = 1.67 µm, m stops when sinθ = mλ/d exceeds 1.',
        'Switch to a finer grating (more lines/mm, smaller d) — the orders fan out wider.',
      ],
      checkpoint: {
        q: 'Use a grating with more lines per mm (smaller d). Do the bright orders spread apart or bunch together?',
        a: 'Spread apart. d·sinθ = mλ, so a smaller d forces a larger diffraction angle θ for every order.',
      },
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
  const view           = useModuleStore((s) => s.optics.viewType)
  const focalLength    = useModuleStore((s) => s.optics.focalLength)
  const setView        = useModuleStore((s) => s.setOpticsView)
  const setFocalLength = useModuleStore((s) => s.setOpticsFocalLength)

  const eq = buildEquations(view)

  return (
    <ModuleShell
      title="Optics"
      accent={ACCENT}
      views={VIEWS}
      activeView={view}
      onViewChange={setView}
      readout={view === 'lens' ? <>f = {focalLength.toFixed(1)} · P = {(1 / focalLength).toFixed(2)} D</> : view === 'prism' ? 'n(λ) = A + B/λ²' : 'd sin θ = mλ'}
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
        <ControlPanel
          title="Parameters"
          footer="Geometric ray tracing · Cauchy dispersion"
          onReset={view === 'lens' ? () => setFocalLength(2.5) : undefined}
          controls={view === 'lens' ? [{ label: 'Focal length f', min: 1.5, max: 5.0, step: 0.1, value: focalLength, onChange: setFocalLength }] : []}
        >
          {view === 'lens' && (
            <dl className="grid grid-cols-2 gap-2">
              <div className="rounded-md bg-ground border border-border-subtle px-3 py-2">
                <dt className="text-[12px] text-text-dim">Focal points</dt>
                <dd className="font-mono-data text-[14px] text-amber-glow">±{focalLength.toFixed(1)}</dd>
              </div>
              <div className="rounded-md bg-ground border border-border-subtle px-3 py-2">
                <dt className="text-[12px] text-text-dim">Power</dt>
                <dd className="font-mono-data text-[14px] text-text-primary">{(1 / focalLength).toFixed(2)} D</dd>
              </div>
            </dl>
          )}
        </ControlPanel>
      }
    >
      <SceneWrapper cameraPosition={CAMERA[view]} showGrid={false} minDist={3} maxDist={22}>
        {view === 'prism'   && <RayTracer />}
        {view === 'lens'    && <LensLab f={focalLength} />}
        {view === 'grating' && <DiffractionGrating />}
      </SceneWrapper>
      <SceneCaption>{VIEWS.find((v) => v.id === view)?.label}</SceneCaption>
    </ModuleShell>
  )
}
