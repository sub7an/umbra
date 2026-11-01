import useModuleStore from '../../store/useModuleStore'
import SceneWrapper from '../../components/SceneWrapper'
import InfoPanel from '../../components/InfoPanel'
import ModuleShell, { SceneCaption } from '../../components/ModuleShell'
import ControlPanel from '../../components/ControlPanel'
import RayTracer from './RayTracer'
import LensLab from './LensLab'
import DiffractionGrating from './DiffractionGrating'
import { thinLensImage } from './lensMath'

const ACCENT = '#fcd34d'


const VIEWS = [
  { id: 'prism', label: 'Prism' },
  { id: 'lens',  label: 'Lens lab' },
  { id: 'grating', label: 'Diffraction grating' },
]

const CAMERA = {
  prism:   [-1.5, 10, 11],
  lens:    [0.5, 1.4, 16.5],
  grating: [0, 0, 13.5],
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
    case 'prism': return '48 spectral rays (380–720 nm) pass through a glass prism. Cauchy dispersion n(λ) = A + B/λ² gives higher n for shorter wavelengths — violet bends most, red least — creating a rainbow on the projection screen. Use the Prism angle slider to rotate the prism: shallow angles show a narrow spread, steep angles push internal rays past the critical angle θ_c = arcsin(1/n) and trigger Total Internal Reflection (TIR), trapping those wavelengths inside.'
    case 'lens': return 'An object arrow (amber) stands on an optical bench in front of a converging lens. Three principal rays leave its tip: one parallel to the axis bends through the far focal point F′, one through the centre goes straight on, and one through the near focal point F leaves parallel. Where they meet is the image (cyan), at dᵢ given by 1/f = 1/dₒ + 1/dᵢ. Slide the object inside f and the rays diverge after the lens: trace them backwards (dashed) and they appear to come from a virtual, upright, magnified image on the object side. That is a magnifying glass.'
    case 'grating': return 'A diffraction grating has thousands of equally-spaced slits (600 lines/mm by default, d = 1.67 µm). Constructive interference occurs where path difference = mλ: d·sinθ = mλ. Each wavelength diffracts at a different angle — white light is spread into orders m = 0, ±1, ±2. The 0th order is straight-through, ±1st orders are the most intense. Larger |m| means wider angular spread.'
    default: return ''
  }
}

export default function OpticsModule() {
  const view           = useModuleStore((s) => s.optics.viewType)
  const focalLength    = useModuleStore((s) => s.optics.focalLength)
  const setView        = useModuleStore((s) => s.setOpticsView)
  const setFocalLength = useModuleStore((s) => s.setOpticsFocalLength)
  const objectDist     = useModuleStore((s) => s.optics.objectDist)
  const setObjectDist  = useModuleStore((s) => s.setOpticsObjectDist)
  const gratingLines   = useModuleStore((s) => s.optics.gratingLines)
  const setGratingLines = useModuleStore((s) => s.setOpticsGratingLines)

  // Thin-lens image for the live readouts
  const { v: imgV, m: imgM } = thinLensImage(objectDist, focalLength)

  const eq = buildEquations(view)

  return (
    <ModuleShell
      title="Optics"
      accent={ACCENT}
      views={VIEWS}
      activeView={view}
      onViewChange={setView}
      readout={view === 'lens' ? <>f = {focalLength.toFixed(1)} · u = {objectDist.toFixed(1)}</> : view === 'prism' ? 'n(λ) = A + B/λ²' : <>{gratingLines} lines/mm · d = {(1000 / gratingLines).toFixed(2)} µm</>}
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
          onReset={view === 'lens' ? () => { setFocalLength(2.5); setObjectDist(5.0) } : view === 'grating' ? () => setGratingLines(600) : undefined}
          controls={view === 'lens' ? [
            { label: 'Focal length f', min: 1.5, max: 5.0, step: 0.1, value: focalLength, onChange: setFocalLength },
            { label: 'Object distance u', min: 0.8, max: 8.0, step: 0.1, value: objectDist, onChange: setObjectDist },
          ] : view === 'grating' ? [
            { label: 'Lines per mm', min: 200, max: 1200, step: 50, value: gratingLines, onChange: setGratingLines },
          ] : []}
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
              <div className="rounded-md bg-ground border border-border-subtle px-3 py-2">
                <dt className="text-[12px] text-text-dim">Image distance v</dt>
                <dd className="font-mono-data text-[14px] text-text-primary">{isFinite(imgV) ? imgV.toFixed(2) : '∞'}</dd>
              </div>
              <div className="rounded-md bg-ground border border-border-subtle px-3 py-2">
                <dt className="text-[12px] text-text-dim">Magnification</dt>
                <dd className="font-mono-data text-[14px] text-text-primary">{isFinite(imgM) ? imgM.toFixed(2) : '∞'}</dd>
              </div>
              <div className="col-span-2 rounded-md bg-ground border border-border-subtle px-3 py-2">
                <dt className="text-[12px] text-text-dim">Image</dt>
                <dd className="text-[14px] text-text-primary">{!isFinite(imgV) ? 'At infinity: rays leave parallel' : imgV > 0 ? `Real, inverted, ${Math.abs(imgM) > 1 ? 'magnified' : Math.abs(imgM) < 1 ? 'diminished' : 'same size'}` : 'Virtual, upright, magnified'}</dd>
              </div>
            </dl>
          )}
        </ControlPanel>
      }
    >
      <SceneWrapper cameraPosition={CAMERA[view]} idleRotate={view === 'prism'} showGrid={false} minDist={3} maxDist={26}>
        {view === 'prism'   && <RayTracer />}
        {view === 'lens'    && <LensLab f={focalLength} u={objectDist} />}
        {view === 'grating' && <DiffractionGrating linesPerMm={gratingLines} />}
      </SceneWrapper>
      <SceneCaption>{VIEWS.find((v) => v.id === view)?.label}</SceneCaption>
    </ModuleShell>
  )
}
