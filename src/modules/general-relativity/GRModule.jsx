import { useState } from 'react'
import SceneWrapper from '../../components/SceneWrapper'
import InfoPanel from '../../components/InfoPanel'
import ModuleShell, { SceneCaption } from '../../components/ModuleShell'
import ControlPanel from '../../components/ControlPanel'
import SpacetimeCurvature from './SpacetimeCurvature'
import Geodesics from './Geodesics'
import GravitationalWaves from './GravitationalWaves'
import useModuleStore from '../../store/useModuleStore'

const VIEWS = [
  { id: 'curvature', label: 'Curvature' },
  { id: 'geodesics', label: 'Geodesics' },
  { id: 'waves',     label: 'Gravitational waves' },
]

const CAMERA = {
  curvature: [0, 7, 10],
  geodesics:  [0, 9.5, 14],
  waves:      [0, 7.5, 12.5],
}

function buildEquations(view) {
  switch (view) {
    case 'curvature':
      return {
        domain: 'GENERAL RELATIVITY · EINSTEIN FIELD EQUATIONS',
        syllabus: 'Enrichment · IB A.5 · spacetime curvature',
        primaryEq: `G_{\\mu\\nu} + \\Lambda g_{\\mu\\nu} = \\dfrac{8\\pi G}{c^4}\\,T_{\\mu\\nu}`,
        derivedEqs: [
          { label: 'Schwarzschild metric', eq: `ds^2 = -\\!\\left(1-\\tfrac{r_s}{r}\\right)c^2 dt^2 + \\dfrac{dr^2}{1-r_s/r}` },
          { label: 'Curvature depth', eq: `y \\propto -\\dfrac{GM}{r}` },
        ],
        tryThis: [
          'Add mass and watch the sheet dimple deeper — more mass, more curvature.',
          'Send a test particle past the well: it bends with no force acting — just curved space.',
        ],
        checkpoint: {
          q: 'In general relativity, what actually keeps a planet orbiting the Sun — a force, or something else?',
          a: 'Something else. Mass curves spacetime, and the planet simply follows the straightest available path (a geodesic) through that curved geometry. Gravity is geometry, not a pulling force.',
        },
      }
    case 'geodesics':
      return {
        domain: 'GR · GEODESIC EQUATION',
        syllabus: 'Enrichment · Mercury’s perihelion precession',
        primaryEq: `\\frac{d^2u}{d\\phi^2} = \\frac{M}{L^2} - u + 3Mu^2`,
        derivedEqs: [
          { label: 'u = 1/r, Newtonian', eq: `\\frac{d^2u}{d\\phi^2} = \\frac{M}{L^2} - u` },
          { label: 'Orbital precession', eq: `\\Delta\\phi = \\frac{6\\pi GM}{c^2 a(1-e^2)}` },
        ],
        tryThis: [
          'Compare the GR orbit (with the 3Mu² term) to the Newtonian ellipse — the GR one slowly rotates.',
          'That slow rotation is precession — the thing that first confirmed GR using Mercury.',
        ],
        checkpoint: {
          q: 'A GR orbit doesn’t close into a fixed ellipse — it slowly rotates. What is this, and where was it first seen?',
          a: 'Perihelion precession. The extra 3Mu² term advances the orbit a little each cycle. Mercury’s unexplained 43″ per century was general relativity’s first observational win.',
        },
      }
    case 'waves':
      return {
        domain: 'GR · GRAVITATIONAL WAVES',
        syllabus: 'Enrichment · LIGO · gravitational waves',
        primaryEq: `\\square\\,\\bar{h}_{\\mu\\nu} = -\\frac{16\\pi G}{c^4}\\,T_{\\mu\\nu}`,
        derivedEqs: [
          { label: 'h₊ strain', eq: `h_+ = \\frac{2G}{c^4 r}\\ddot{Q}_{xx}` },
          { label: 'Power radiated', eq: `P = \\frac{32G^4}{5c^5}\\frac{m_1^2 m_2^2(m_1+m_2)}{r^5}` },
        ],
        tryThis: [
          'Bring the two masses closer: the strain h and radiated power climb steeply.',
          'Power scales as 1/r⁵ — binaries blaze brightest in the final moments before merger.',
        ],
        checkpoint: {
          q: 'Gravitational waves stretch and squeeze space itself. Why are they so hard to detect?',
          a: 'The strain is minuscule — h ~ 10⁻²¹, far smaller than a proton’s width across kilometres. LIGO needs km-long laser interferometers just to catch a merger’s ripple.',
        },
      }
    default:
      return { domain: '', primaryEq: '', derivedEqs: [] }
  }
}

function buildExplanation(view) {
  switch (view) {
    case 'curvature':
      return `Einstein replaced Newton's gravitational force with geometry. Mass curves the 4D spacetime manifold; objects then follow the straightest possible paths through that curved space. The well here shows the Schwarzschild solution — the exact spacetime geometry around a non-rotating mass. Curvature is steepest at small r and falls off as 1/r. The orange ring marks the photon sphere: the radius where light can orbit in an unstable circular path.`
    case 'geodesics':
      return `A geodesic is the GR equivalent of a straight line — the path a free-falling object traces through curved spacetime. The gray ghost circle shows the Newtonian orbit (perfectly closed); the colored orbit is the GR solution — it precesses each revolution, tracing out a rosette. Three rings mark special radii: red = event horizon (r=2M), gold = photon sphere (r=3M, where light orbits), cyan = ISCO (r=6M, innermost stable orbit). White rays are photons bent by the gravitational field — the closer they pass, the more they curve. Eddington confirmed GR's light-bending prediction in 1919.`
    case 'waves':
      return `When two massive objects orbit each other, they radiate energy as ripples in spacetime — gravitational waves. The grid shows the h₊ polarization: spacetime alternately stretches and compresses perpendicular to the wave direction. LIGO detected the first signal in 2015 (GW150914), a binary black hole merger 1.3 billion light-years away. The strain was 10⁻²¹ — a thousand times smaller than a proton over 4 km.`
    default:
      return ''
  }
}

function buildMetrics(view, mass) {
  const rs = (mass * 0.15 * 1.5).toFixed(2)
  switch (view) {
    case 'curvature':
      return [
        { label: 'Mass M',             value: mass.toFixed(1),       color: 'amber' },
        { label: 'Schwarzschild r_s',  value: `${rs} units`,         color: 'cyan'  },
        { label: 'Curvature ∝',        value: 'GM / r',              color: 'dim'   },
        { label: 'Photon sphere',       value: `r = 1.5 r_s`,        color: 'amber' },
      ]
    case 'geodesics':
      return [
        { label: 'Mass M',         value: mass.toFixed(1),    color: 'amber' },
        { label: 'r_s',            value: `${rs} units`,      color: 'cyan'  },
        { label: 'Orbit type',     value: 'Precessing ellipse', color: 'dim' },
        { label: 'Light bending',  value: '4GM / bc²',        color: 'amber' },
      ]
    case 'waves':
      return [
        { label: 'Mass M',       value: mass.toFixed(1),       color: 'amber' },
        { label: 'Orbital freq', value: `${(1.2+mass*0.3).toFixed(2)} rad/s`, color: 'cyan'  },
        { label: 'Polarization', value: 'h₊',                  color: 'dim'   },
        { label: 'Propagation',  value: 'c',                   color: 'amber' },
      ]
    default:
      return []
  }
}


export default function GRModule() {
  const grMass          = useModuleStore((s) => s.gr.mass)
  const grView          = useModuleStore((s) => s.gr.viewType)
  const setGrMass       = useModuleStore((s) => s.setGrMass)
  const setGrView       = useModuleStore((s) => s.setGrView)
  const resetGr         = useModuleStore((s) => s.resetGr)

  const { domain, primaryEq, derivedEqs, syllabus, tryThis, checkpoint } = buildEquations(grView)
  const explanation = buildExplanation(grView)
  const metrics     = buildMetrics(grView, grMass)

  return (
    <ModuleShell
      title="General Relativity"
      accent="#fb923c"
      views={VIEWS}
      activeView={grView}
      onViewChange={setGrView}
      readout={<>M = {grMass.toFixed(1)}</>}
      lesson={
        <InfoPanel domain={domain} syllabus={syllabus} primaryEq={primaryEq}
          derivedEqs={derivedEqs} explanation={explanation} tryThis={tryThis} checkpoint={checkpoint} metrics={metrics} />
      }
      controls={
        <ControlPanel
          title="Parameters"
          onReset={resetGr}
          footer="Geometric units · G = c = 1"
          controls={[{ label: 'Central mass M', min: 0.5, max: 5, step: 0.1, value: grMass, onChange: setGrMass }]}
        />
      }
    >
      <SceneWrapper cameraPosition={CAMERA[grView]} showGrid={false} minDist={2} maxDist={30}>
        {grView === 'curvature' && <SpacetimeCurvature key="curv" mass={grMass} />}
        {grView === 'geodesics'  && <Geodesics           key="geo"  mass={grMass} />}
        {grView === 'waves'      && <GravitationalWaves  key="wav"  mass={grMass} />}
      </SceneWrapper>
      <SceneCaption>
        {grView === 'curvature' ? 'Schwarzschild geometry · exact solution'
         : grView === 'geodesics' ? 'Geodesic equation · GR vs Newtonian'
         : 'Gravitational-wave emission · h₊ polarisation'}
      </SceneCaption>
    </ModuleShell>
  )
}
