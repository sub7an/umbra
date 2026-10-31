import SceneWrapper from '../../components/SceneWrapper'
import InfoPanel from '../../components/InfoPanel'
import ModuleShell, { SceneCaption, Legend } from '../../components/ModuleShell'
import ControlPanel, { Slider as SharedSlider, ControlGroup } from '../../components/ControlPanel'
import StreamLines from './StreamLines'
import VortexShedding from './VortexShedding'
import SPH from './SPH'
import useModuleStore from '../../store/useModuleStore'

const VIEWS = [
  { id: 'streamlines', label: 'Streamlines' },
  { id: 'vortex',      label: 'Vortex street' },
  { id: 'sph',         label: 'SPH' },
]

const CAMERA = {
  streamlines: [0, 0, 17],
  vortex:      [0, 0, 20],
  sph:         [4, 2, 15],
}

function buildEquations(view) {
  switch (view) {
    case 'streamlines':
      return {
        domain: 'FLUID DYNAMICS · POTENTIAL FLOW',
        syllabus: 'IB B.3 (HL) · Bernoulli & fluid flow',
        primaryEq: `\\nabla^2 \\phi = 0,\\quad \\mathbf{u} = \\nabla\\phi`,
        derivedEqs: [
          { label: 'Stream function', eq: `\\phi = U\\!\\left(r + \\frac{R^2}{r}\\right)\\cos\\theta` },
          { label: 'Bernoulli', eq: `p + \\tfrac{1}{2}\\rho u^2 = {\\rm const}` },
        ],
        tryThis: [
          'Find where streamlines bunch tightest around the cylinder — that’s where the flow speeds up.',
          'That same speed-up over a wing’s curved top is what generates lift.',
        ],
        checkpoint: {
          q: 'Where the streamlines crowd closest around the cylinder, is the pressure higher or lower?',
          a: 'Lower. Crowded streamlines mean faster flow, and by Bernoulli p + ½ρu² = const, faster flow goes hand-in-hand with lower pressure.',
        },
      }
    case 'vortex':
      return {
        domain: 'FLUID DYNAMICS · DISCRETE VORTEX METHOD',
        syllabus: 'Enrichment · Kármán vortex street',
        primaryEq: `\\mathbf{u}(\\mathbf{x}) = \\frac{1}{2\\pi}\\sum_k \\frac{\\Gamma_k\\,(\\mathbf{x}-\\mathbf{x}_k)^\\perp}{|\\mathbf{x}-\\mathbf{x}_k|^2 + \\sigma^2}`,
        derivedEqs: [
          { label: 'Biot-Savart (2D)', eq: `\\mathbf{u} = -\\frac{\\Gamma}{2\\pi r^2}(y\\hat x - x\\hat y)` },
          { label: 'Strouhal number', eq: `St = \\frac{fD}{U} \\approx 0.20` },
        ],
        tryThis: [
          'Watch vortices peel off alternately from each side — the Kármán vortex street.',
          'The shedding frequency tracks St = fD/U ≈ 0.2 across a huge range of flow speeds.',
        ],
        checkpoint: {
          q: 'Why does a flag flap and why do power lines hum in a steady wind?',
          a: 'Vortex shedding. Vortices peel off alternately from each side of the obstacle at f ≈ 0.2 U/D, driving a periodic side-to-side force — the Kármán vortex street.',
        },
      }
    case 'sph':
      return {
        domain: 'FLUID DYNAMICS · SPH (NAVIER-STOKES)',
        syllabus: 'Enrichment · Navier–Stokes / SPH',
        primaryEq: `\\rho\\!\\left(\\frac{D\\mathbf{u}}{Dt}\\right) = -\\nabla p + \\mu\\nabla^2\\mathbf{u} + \\rho\\mathbf{g}`,
        derivedEqs: [
          { label: 'SPH density', eq: `\\rho_i = \\sum_j m_j W(|\\mathbf{r}_{ij}|,h)` },
          { label: 'Pressure', eq: `p_i = k(\\rho_i - \\rho_0)` },
        ],
        tryThis: [
          'Release the dam and watch the fluid splash and settle — each dot is a particle carrying mass.',
          'Raise the stiffness k and the fluid resists compression more strongly.',
        ],
        checkpoint: {
          q: 'SPH uses no grid — the fluid is thousands of particles. So how is the density at a point worked out?',
          a: 'By summing a smoothing kernel W over nearby particles: ρᵢ = Σ mⱼ W(rᵢⱼ, h). The fluid’s properties emerge from how tightly the particles cluster.',
        },
      }
    default:
      return { domain: '', primaryEq: '', derivedEqs: [] }
  }
}

function buildExplanation(view) {
  switch (view) {
    case 'streamlines':
      return `Potential flow is the simplest model of an ideal (inviscid, irrotational, incompressible) fluid. The velocity field is a gradient of a scalar potential φ satisfying Laplace's equation. Around a cylinder the exact solution bends streamlines symmetrically — no drag, no vortices. This is D'Alembert's paradox: the theory predicts zero drag, but real fluids create a wake. Color codes speed: blue is slow (stagnation), orange is fast (shoulders of cylinder where flow accelerates). The orange dots mark stagnation points at the front and rear.`
    case 'vortex':
      return `When a real viscous fluid flows past a cylinder above a critical Reynolds number (~47), the wake becomes unstable and alternating vortices are shed — the Kármán vortex street. Here each vortex is a point singularity with circulation Γ. Tracer particles are advected by the sum of all vortex velocities (Biot-Savart law). Red vortices have positive circulation (CCW), blue have negative (CW). They self-organize into two staggered rows separated by 0.28D and advancing at ~0.7U. The Strouhal number St ≈ 0.20 is nearly universal across a wide Reynolds range.`
    case 'sph':
      return `Smoothed Particle Hydrodynamics (SPH) discretizes the Navier-Stokes equations into 216 interacting 3D particles. Each particle carries mass, velocity, and pressure; density is summed over neighbors via the Müller Poly6 kernel. Pressure repels compressed particles; viscosity damps relative motion; gravity pulls the column down. The result is a 3D dam break: a tall block collapses, splashes across the box in all three axes, and eventually settles. Color encodes velocity speed — blue = slow (settled), cyan → amber = accelerating, white = peak impact. The additive glow reveals density: overlapping fast particles create bright halos.`
    default:
      return ''
  }
}

function buildMetrics(view, reynolds) {
  const U = (0.4 + reynolds * 0.55).toFixed(2)
  const G = (2.0 + reynolds * 0.8).toFixed(2)
  switch (view) {
    case 'streamlines':
      return [
        { label: 'Free-stream U', value: `${U} m/s`,         color: 'cyan'  },
        { label: 'Cylinder R',    value: '1.2 units',         color: 'dim'   },
        { label: 'Drag coeff',    value: 'C_D = 0 (ideal)',   color: 'amber' },
        { label: 'Model',         value: 'Irrotational',      color: 'cyan'  },
      ]
    case 'vortex':
      return [
        { label: 'Free-stream U', value: '1.5 m/s',           color: 'cyan'  },
        { label: 'Vortex Γ',      value: `${G} m²/s`,         color: 'amber' },
        { label: 'St number',     value: '~0.20',              color: 'cyan'  },
        { label: 'Max vortices',  value: '80',                 color: 'dim'   },
      ]
    case 'sph':
      return [
        { label: 'Particles N',   value: '216 (3D)',           color: 'cyan'  },
        { label: 'Gravity g',     value: `${(7+reynolds*2.5).toFixed(1)} m/s²`, color: 'amber' },
        { label: 'Kernel h',      value: '0.90',               color: 'cyan'  },
        { label: 'Scenario',      value: '3D dam break',       color: 'dim'   },
      ]
    default:
      return []
  }
}


const ACCENT = '#2dd4bf'

export default function FluidModule() {
  const fluidView         = useModuleStore((s) => s.fluid.viewType)
  const reynolds          = useModuleStore((s) => s.fluid.reynolds)
  const setFluidView      = useModuleStore((s) => s.setFluidView)
  const setFluidReynolds  = useModuleStore((s) => s.setFluidReynolds)
  const resetFluid        = useModuleStore((s) => s.resetFluid)

  const { domain, primaryEq, derivedEqs, syllabus, tryThis, checkpoint } = buildEquations(fluidView)
  const explanation = buildExplanation(fluidView)
  const metrics     = buildMetrics(fluidView, reynolds)

  return (
    <ModuleShell
      title="Fluid Dynamics"
      accent={ACCENT}
      views={VIEWS}
      activeView={fluidView}
      onViewChange={setFluidView}
      readout={<>Re = {reynolds.toFixed(1)}</>}
      lesson={
        <InfoPanel domain={domain} syllabus={syllabus} primaryEq={primaryEq}
          derivedEqs={derivedEqs} explanation={explanation} tryThis={tryThis} checkpoint={checkpoint} metrics={metrics} />
      }
      controls={
        <ControlPanel title="Parameters" onReset={resetFluid} footer="Incompressible flow · 3D SPH · Navier–Stokes">
          <SharedSlider label={fluidView === 'sph' ? 'Gravity G' : 'Flow speed Re'}
            value={reynolds} min={0.3} max={2.5} step={0.05} onChange={setFluidReynolds} />
          <ControlGroup label="Legend">
            {fluidView === 'streamlines' && <Legend items={[
              { color: '#fb923c', label: 'Stagnation points' },
              { color: ACCENT, symbol: '━', label: 'Streamlines' },
              { color: ACCENT, symbol: '·', opacity: 0.7, label: 'Tracers (speed)' },
            ]} />}
            {fluidView === 'vortex' && <Legend items={[
              { color: '#fb923c', label: 'Positive Γ (counter-clockwise)' },
              { color: '#38bdf8', label: 'Negative Γ (clockwise)' },
              { color: ACCENT, symbol: '·', opacity: 0.7, label: 'Vorticity field' },
            ]} />}
            {fluidView === 'sph' && <Legend items={[
              { color: '#38bdf8', symbol: '■', label: 'Slow (settled)' },
              { color: ACCENT, symbol: '■', label: 'Accelerating' },
              { color: '#ffffff', symbol: '■', label: 'Peak impact' },
            ]} />}
          </ControlGroup>
        </ControlPanel>
      }
    >
      <SceneWrapper cameraPosition={CAMERA[fluidView]} showGrid={false} minDist={3} maxDist={35}>
        {fluidView === 'streamlines' && <StreamLines   key="sl"  reynolds={reynolds} />}
        {fluidView === 'vortex'      && <VortexShedding key="vs"  reynolds={reynolds} />}
        {fluidView === 'sph'         && <SPH            key="sph" reynolds={reynolds} />}
      </SceneWrapper>
      <SceneCaption>
        {fluidView === 'streamlines' ? 'Potential flow · irrotational · incompressible'
         : fluidView === 'vortex'    ? 'Kármán vortex street · discrete vortex method'
         : 'SPH dam break · Navier–Stokes · 216 particles'}
      </SceneCaption>
    </ModuleShell>
  )
}
