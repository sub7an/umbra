import { useState, useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import SceneWrapper from '../../components/SceneWrapper'
import InfoPanel from '../../components/InfoPanel'
import useModuleStore from '../../store/useModuleStore'

const ACCENT = '#a855f7'

// ── View config ───────────────────────────────────────────────────────────────

const VIEWS = [
  { id: 'cymatics',  label: 'CYMATICS' },
  { id: 'harmonics', label: 'HARMONICS' },
  { id: 'lissajous', label: 'LISSAJOUS' },
]

const CAMERA = {
  cymatics:  [0, 4.5, 3.2],
  harmonics: [0, 0, 7.5],
  lissajous: [0.8, 0.4, 5.5],
}

// ── Chladni mode presets ──────────────────────────────────────────────────────

const CHLADNI_MODES = [
  { m:1, n:1, label:'(1,1)' }, { m:1, n:2, label:'(1,2)' },
  { m:2, n:2, label:'(2,2)' }, { m:1, n:3, label:'(1,3)' },
  { m:2, n:3, label:'(2,3)' }, { m:3, n:3, label:'(3,3)' },
  { m:2, n:4, label:'(2,4)' }, { m:3, n:4, label:'(3,4)' },
  { m:4, n:4, label:'(4,4)' }, { m:3, n:5, label:'(3,5)' },
]

// ── Harmonic colors & labels ──────────────────────────────────────────────────

const HARMONIC_COLORS = [
  '#FF6B6B','#FFB347','#FFD166','#A8E063',
  '#00D4FF','#6677FF','#BB66FF','#FF77BB',
]
const HARMONIC_LABELS = [
  'n=1  Fundamental',  'n=2  Octave',
  'n=3  Perfect 5th',  'n=4  Dbl Octave',
  'n=5  Major 3rd+',   'n=6  Minor 7th+',
  'n=7  7th Harmonic', 'n=8  3rd Octave',
]

// ── Lissajous musical-interval presets ───────────────────────────────────────

const LISSAJOUS_PRESETS = [
  { a:1, b:1, name:'Unison',         ratio:'1:1', color:'#00D4FF' },
  { a:1, b:2, name:'Octave',         ratio:'1:2', color:'#FFD166' },
  { a:2, b:3, name:'Perfect Fifth',  ratio:'2:3', color:'#A8E063' },
  { a:3, b:4, name:'Perfect Fourth', ratio:'3:4', color:'#FF6B6B' },
  { a:4, b:5, name:'Major Third',    ratio:'4:5', color:'#FF77BB' },
  { a:5, b:6, name:'Minor Third',    ratio:'5:6', color:'#BB66FF' },
  { a:3, b:5, name:'Major Sixth',    ratio:'3:5', color:'#FFB347' },
  { a:5, b:8, name:'Minor Sixth',    ratio:'5:8', color:'#6677FF' },
]

// ── Physics equations per view ────────────────────────────────────────────────

function buildEquations(view) {
  switch (view) {
    case 'cymatics': return {
      domain: 'ACOUSTIC PHYSICS · CHLADNI FIGURES',
      primaryEq: `u(x,y)=\\sin(m\\pi x)\\sin(n\\pi y)\\cos(\\omega_{mn}t)`,
      derivedEqs: [
        { label: 'Eigenfreq.',  eq: `\\omega_{mn}=\\pi c\\sqrt{m^2+n^2}/L` },
        { label: 'Nodal lines', eq: `\\sin(m\\pi x)\\sin(n\\pi y)=0` },
      ],
    }
    case 'harmonics': return {
      domain: 'ACOUSTIC PHYSICS · STANDING WAVES',
      primaryEq: `y_n(x,t)=A\\sin\\!\\frac{n\\pi x}{L}\\cos(\\omega_n t)`,
      derivedEqs: [
        { label: 'Harmonics', eq: `f_n = n\\,f_0 = \\frac{nv}{2L}` },
        { label: 'Superpos.',  eq: `y=\\textstyle\\sum_n A_n\\sin\\frac{n\\pi x}{L}\\cos\\omega_n t` },
      ],
    }
    case 'lissajous': return {
      domain: 'ACOUSTIC PHYSICS · LISSAJOUS FIGURES',
      primaryEq: `x=\\sin(a\\,t),\\quad y=\\sin(b\\,t+\\delta)`,
      derivedEqs: [
        { label: 'Ratio a:b', eq: `\\text{musical interval}\\leftrightarrow\\text{figure symmetry}` },
        { label: 'Closed if', eq: `a/b\\in\\mathbb{Q}` },
      ],
    }
    default: return { domain:'', primaryEq:'', derivedEqs:[] }
  }
}

function buildExplanation(view) {
  switch (view) {
    case 'cymatics':
      return 'Chladni figures appear when a plate vibrates at a resonant frequency. Sand particles are thrown off the antinodes (maximum vibration) and collect at nodal lines (zero vibration) — making the invisible pattern of the sound wave visible. Each mode (m,n) creates a unique pattern. Higher modes produce more complex figures. Select a mode and watch the sand reform.'
    case 'harmonics':
      return 'A string fixed at both ends can only vibrate in whole-number multiples of its fundamental frequency f₀. The n-th harmonic vibrates at nf₀ and has n half-wavelengths along the string length. Musical intervals like octaves (2:1), perfect fifths (3:2), and thirds (4:3, 5:4) are integer ratios of harmonic frequencies. Click a harmonic to isolate it.'
    case 'lissajous':
      return 'Lissajous figures are drawn by two perpendicular oscillations. When the frequency ratio a:b matches a simple musical interval, the figure closes into a beautiful shape. The octave (1:2) gives a figure-8, the perfect fifth (2:3) gives three loops, and the unison (1:1) traces an ellipse. Consonant intervals produce simpler, more symmetric figures than dissonant ones.'
    default: return ''
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYMATICS SCENE — 2 200 sand particles settling onto nodal lines
// ═══════════════════════════════════════════════════════════════════════════════

const N_PARTICLES = 2200

function CymaticsScene({ modeIdx }) {
  const meshRef = useRef()
  const posRef  = useRef()
  const velRef  = useRef()
  const dummy   = useMemo(() => new THREE.Object3D(), [])

  // Initialize particles scattered randomly across the plate
  useEffect(() => {
    posRef.current = new Float32Array(N_PARTICLES * 2)
    velRef.current = new Float32Array(N_PARTICLES * 2)
    for (let i = 0; i < N_PARTICLES; i++) {
      posRef.current[i*2]   = (Math.random() - 0.5) * 1.88
      posRef.current[i*2+1] = (Math.random() - 0.5) * 1.88
    }
  }, [])

  // Scatter when mode changes
  useEffect(() => {
    if (!posRef.current) return
    for (let i = 0; i < N_PARTICLES; i++) {
      posRef.current[i*2]   = (Math.random() - 0.5) * 1.88
      posRef.current[i*2+1] = (Math.random() - 0.5) * 1.88
      velRef.current[i*2]   = (Math.random() - 0.5) * 0.015
      velRef.current[i*2+1] = (Math.random() - 0.5) * 0.015
    }
  }, [modeIdx])

  useFrame((_, delta) => {
    if (!meshRef.current || !posRef.current) return
    const { m, n } = CHLADNI_MODES[modeIdx]
    const dt       = Math.min(delta, 0.033)
    const FORCE    = 0.055
    const DAMP     = 0.86
    const NOISE    = 0.0009

    for (let i = 0; i < N_PARTICLES; i++) {
      let x = posRef.current[i*2],   y  = posRef.current[i*2+1]
      let vx = velRef.current[i*2], vy  = velRef.current[i*2+1]

      // Chladni standing wave amplitude
      const sinMX = Math.sin(m * Math.PI * x)
      const sinNY = Math.sin(n * Math.PI * y)
      const u     = sinMX * sinNY
      const sign  = u >= 0 ? 1 : -1

      // Gradient of |u| — force pushes particles toward nodal lines (u=0)
      const dudx = m * Math.PI * Math.cos(m * Math.PI * x) * sinNY
      const dudy = n * Math.PI * sinMX * Math.cos(n * Math.PI * y)

      vx = (vx - sign * dudx * FORCE * dt + (Math.random()-0.5)*NOISE) * DAMP
      vy = (vy - sign * dudy * FORCE * dt + (Math.random()-0.5)*NOISE) * DAMP

      x += vx; y += vy

      // Bounce off plate edges
      if (x < -0.97) { x = -0.97; vx =  Math.abs(vx)*0.3 }
      if (x >  0.97) { x =  0.97; vx = -Math.abs(vx)*0.3 }
      if (y < -0.97) { y = -0.97; vy =  Math.abs(vy)*0.3 }
      if (y >  0.97) { y =  0.97; vy = -Math.abs(vy)*0.3 }

      posRef.current[i*2]   = x;  posRef.current[i*2+1]  = y
      velRef.current[i*2]   = vx; velRef.current[i*2+1]  = vy

      dummy.position.set(x, 0.018, y)
      dummy.scale.setScalar(0.011)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {/* Plate surface */}
      <mesh rotation={[-Math.PI/2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.05, 2.05]} />
        <meshStandardMaterial color="#060c16" metalness={0.88} roughness={0.22} />
      </mesh>

      {/* Glowing edge ring */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[2.08, 2.08]} />
        <meshStandardMaterial
          color={ACCENT} emissive={ACCENT} emissiveIntensity={0.10}
          transparent opacity={0.20}
        />
      </mesh>

      {/* Corner mounting pins */}
      {[[ 0.95, 0.95],[-0.95, 0.95],[ 0.95,-0.95],[-0.95,-0.95]].map(([cx,cy],i) => (
        <mesh key={i} position={[cx, 0.05, cy]} castShadow>
          <cylinderGeometry args={[0.022, 0.022, 0.09, 8]} />
          <meshStandardMaterial color="#5a6a7a" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}

      {/* Sand particles */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, N_PARTICLES]} castShadow>
        <sphereGeometry args={[1, 5, 5]} />
        <meshStandardMaterial
          color="#F5DEB3" emissive="#C8A060"
          emissiveIntensity={0.30} roughness={0.85}
        />
      </instancedMesh>

      {/* Lighting */}
      <ambientLight intensity={0.25} color="#102030" />
      <directionalLight position={[1, 5, 2]} intensity={1.6} color="#ffffff" castShadow />
      <pointLight position={[0, 3.5, 0]} intensity={0.8} color="#d0e8ff" />
      <pointLight position={[-2, 1, 2]} intensity={0.4} color={ACCENT} />
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// HARMONICS SCENE — 8 standing-wave harmonics stacked on a string
// ═══════════════════════════════════════════════════════════════════════════════

const H_PTS = 240

function HarmonicsScene({ focusN }) {
  // Create 8 mutable buffer geometries once
  const geos = useMemo(() => {
    return Array.from({ length: 8 }, () => {
      const pos = new Float32Array((H_PTS + 1) * 3)
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      return geo
    })
  }, [])

  // Cleanup geometries on unmount
  useEffect(() => () => geos.forEach(g => g.dispose()), [geos])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    for (let n = 1; n <= 8; n++) {
      const geo    = geos[n - 1]
      const pos    = geo.attributes.position.array
      const yOff   = -(n - 4.5) * 0.66  // vertical stacking
      const omega  = n * 1.8

      for (let p = 0; p <= H_PTS; p++) {
        const xN = p / H_PTS                             // 0→1 normalized
        const x  = xN * 2.8 - 1.4                       // screen space
        const dy = Math.sin(n * Math.PI * xN) * Math.cos(omega * t) * 0.22
        pos[p*3]   = x
        pos[p*3+1] = yOff + dy
        pos[p*3+2] = 0
      }
      geo.attributes.position.needsUpdate = true
    }
  })

  // Axis geometries (static dashed baseline for each harmonic)
  const axisGeos = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const n = i + 1, yOff = -(n - 4.5) * 0.66
      const pos = new Float32Array([-1.4, yOff, 0,  1.4, yOff, 0])
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      return geo
    })
  }, [])
  useEffect(() => () => axisGeos.forEach(g => g.dispose()), [axisGeos])

  return (
    <group>
      {/* Axis baselines */}
      {axisGeos.map((geo, i) => (
        <line key={`ax-${i}`} geometry={geo}>
          <lineBasicMaterial color="#0d1e2e" transparent opacity={0.7} />
        </line>
      ))}

      {/* Harmonic curves */}
      {geos.map((geo, i) => {
        const n        = i + 1
        const color    = HARMONIC_COLORS[i]
        const isActive = focusN === null || focusN === n
        const yOff     = -(n - 4.5) * 0.66
        return (
          <group key={n}>
            <line geometry={geo}>
              <lineBasicMaterial color={color} transparent opacity={isActive ? 1.0 : 0.08} />
            </line>
            {/* Fixed endpoint nodes */}
            {[-1.4, 1.4].map(ex => (
              <mesh key={ex} position={[ex, yOff, 0]}>
                <sphereGeometry args={[0.028, 8, 8]} />
                <meshBasicMaterial color={isActive ? color : '#1a2a3a'} />
              </mesh>
            ))}
          </group>
        )
      })}

      <ambientLight intensity={0.6} />
      <pointLight position={[0, 2, 4]} intensity={0.8} color="#c0d8ff" />
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// LISSAJOUS SCENE — 3-D Lissajous figure as a glowing trail
// ═══════════════════════════════════════════════════════════════════════════════

const LIS_TRAIL = 2000

function LissajousScene({ presetIdx }) {
  const dotRef  = useRef()

  const trailGeo = useMemo(() => {
    const pos = new Float32Array(LIS_TRAIL * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return geo
  }, [])
  useEffect(() => () => trailGeo.dispose(), [trailGeo])

  // Reset trail when preset changes
  useEffect(() => {
    trailGeo.attributes.position.array.fill(0)
    trailGeo.attributes.position.needsUpdate = true
  }, [presetIdx, trailGeo])

  useFrame(({ clock }) => {
    const t   = clock.getElapsedTime()
    const { a, b } = LISSAJOUS_PRESETS[presetIdx]
    const arr = trailGeo.attributes.position.array

    // Shift trail right by one triplet
    arr.copyWithin(3, 0, (LIS_TRAIL - 1) * 3)

    // New head position
    const px = Math.sin(a * t * 0.55) * 1.5
    const py = Math.sin(b * t * 0.55 + Math.PI / 4) * 1.5
    const pz = Math.sin((a + b) * t * 0.27) * 0.35
    arr[0] = px; arr[1] = py; arr[2] = pz

    trailGeo.attributes.position.needsUpdate = true
    if (dotRef.current) dotRef.current.position.set(px, py, pz)
  })

  const { color } = LISSAJOUS_PRESETS[presetIdx]

  return (
    <group>
      {/* Glowing trail */}
      <line geometry={trailGeo}>
        <lineBasicMaterial color={color} transparent opacity={0.70} />
      </line>

      {/* Bright leading dot */}
      <mesh ref={dotRef}>
        <sphereGeometry args={[0.055, 14, 14]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      <ambientLight intensity={0.3} />
      <pointLight position={[3, 3, 3]} intensity={1.2} color={color} />
      <pointLight position={[-3,-3, 2]} intensity={0.5} color="#3040a0" />
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MODULE
// ═══════════════════════════════════════════════════════════════════════════════

export default function AcousticModule() {
  const setActiveModule = useModuleStore(s => s.setActiveModule)
  const [view,        setView]       = useState('cymatics')
  const [modeIdx,     setModeIdx]    = useState(3)   // cymatics default
  const [focusN,      setFocusN]     = useState(null) // null = all harmonics
  const [presetIdx,   setPresetIdx]  = useState(1)   // lissajous default

  const eq = buildEquations(view)

  return (
    <div style={{
      width:'100%', height:'100%', background:'#04090c',
      display:'flex', flexDirection:'column',
      fontFamily:'JetBrains Mono, monospace',
    }}>
      <style>{`
        @keyframes umbra-pulse{0%,100%{opacity:1}50%{opacity:.3}}
        .acoustic-btn{
          font-family:'JetBrains Mono',monospace;
          font-size:9px;letter-spacing:.14em;text-transform:uppercase;
          padding:5px 11px;border-radius:2px;cursor:pointer;
          border:1px solid rgba(168,85,247,.22);
          background:transparent;color:rgba(168,85,247,.55);
          transition:all .15s;
        }
        .acoustic-btn:hover{background:rgba(168,85,247,.12);color:#a855f7;}
        .acoustic-btn.active{
          background:rgba(168,85,247,.14);border-color:rgba(168,85,247,.55);
          color:#c084fc;box-shadow:0 0 12px rgba(168,85,247,.18);
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        display:'flex',alignItems:'center',gap:14,
        padding:'11px 18px',flexShrink:0,
        borderBottom:'1px solid rgba(168,85,247,.10)',
        background:'rgba(4,9,12,.97)',
      }}>
        <button onClick={() => setActiveModule(null)} style={{
          fontFamily:'JetBrains Mono,monospace',fontSize:10,
          letterSpacing:'.18em',textTransform:'uppercase',
          color:'rgba(168,85,247,.50)',background:'none',
          border:'none',cursor:'pointer',padding:0,
        }}>← MODULES</button>

        <div style={{width:1,height:14,background:'rgba(168,85,247,.12)'}}/>

        <span style={{
          fontSize:11,letterSpacing:'.28em',textTransform:'uppercase',
          color:ACCENT,fontWeight:700,
        }}>Acoustic Physics</span>

        <div style={{
          display:'flex',alignItems:'center',gap:5,padding:'2px 8px',
          border:'1px solid rgba(168,85,247,.28)',borderRadius:2,
          background:'rgba(168,85,247,.05)',
        }}>
          <div style={{
            width:5,height:5,borderRadius:'50%',
            background:ACCENT,boxShadow:`0 0 6px ${ACCENT}`,
            animation:'umbra-pulse 1.8s ease-in-out infinite',
          }}/>
          <span style={{fontSize:8,letterSpacing:'.2em',color:ACCENT}}>LIVE</span>
        </div>

        {/* Current-state stat */}
        <span style={{fontSize:9,letterSpacing:'.12em',color:'rgba(168,85,247,.45)'}}>
          {view==='cymatics'  && `MODE: ${CHLADNI_MODES[modeIdx].label}`}
          {view==='harmonics' && (focusN ? `n=${focusN} · f=${focusN}f₀` : 'ALL HARMONICS')}
          {view==='lissajous' && `${LISSAJOUS_PRESETS[presetIdx].name.toUpperCase()} · ${LISSAJOUS_PRESETS[presetIdx].ratio}`}
        </span>

        {/* View tabs */}
        <div style={{display:'flex',gap:4,marginLeft:'auto'}}>
          {VIEWS.map(v => (
            <button
              key={v.id}
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              style={{
                fontFamily:'JetBrains Mono,monospace',fontSize:9,
                letterSpacing:'.15em',textTransform:'uppercase',
                padding:'5px 12px',borderRadius:2,cursor:'pointer',
                background: view===v.id ? 'rgba(168,85,247,.09)' : 'transparent',
                border:`1px solid ${view===v.id ? 'rgba(168,85,247,.33)' : 'rgba(255,255,255,.07)'}`,
                color: view===v.id ? '#c084fc' : 'rgba(255,255,255,.33)',
              }}
            >{v.label}</button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{flex:1,display:'flex',overflow:'hidden',minHeight:0}}>

        {/* Info panel */}
        <div style={{width:235,flexShrink:0,borderRight:'1px solid rgba(168,85,247,.07)'}}>
          <InfoPanel
            title={view==='cymatics'?'Chladni Figures':view==='harmonics'?'Standing Waves':'Lissajous'}
            domain={eq.domain}
            primaryEq={eq.primaryEq}
            derivedEqs={eq.derivedEqs}
            explanation={buildExplanation(view)}
            accentColor="violet"
            footer="ACOUSTIC PHYSICS · UMBRA"
          />
        </div>

        {/* 3-D scene */}
        <div style={{flex:1,position:'relative',overflow:'hidden',minHeight:0}}>
          <SceneWrapper
            cameraPosition={CAMERA[view]}
            showGrid={false}
            minDist={2}
            maxDist={18}
          >
            {view==='cymatics'  && <CymaticsScene  modeIdx={modeIdx}  />}
            {view==='harmonics' && <HarmonicsScene  focusN={focusN}    />}
            {view==='lissajous' && <LissajousScene  presetIdx={presetIdx} />}
          </SceneWrapper>

          {/* SIM ACTIVE badge */}
          <div style={{
            position:'absolute',bottom:16,left:16,
            display:'flex',alignItems:'center',gap:7,
            padding:'4px 10px',
            border:'1px solid rgba(168,85,247,.18)',
            borderRadius:2,background:'rgba(4,9,12,.88)',
            pointerEvents:'none',
          }}>
            <div style={{width:4,height:4,borderRadius:'50%',background:ACCENT,boxShadow:`0 0 4px ${ACCENT}`}}/>
            <span style={{fontSize:8,letterSpacing:'.2em',color:'rgba(168,85,247,.55)'}}>SIM ACTIVE</span>
          </div>

          {/* ── CYMATICS mode selector ── */}
          {view==='cymatics' && (
            <div style={{
              position:'absolute',bottom:16,right:16,
              display:'flex',flexDirection:'column',gap:6,
              pointerEvents:'all',
            }}>
              <div style={{
                fontSize:7,letterSpacing:'.22em',color:'rgba(168,85,247,.40)',
                textTransform:'uppercase',textAlign:'right',marginBottom:2,
              }}>SELECT MODE</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:4}}>
                {CHLADNI_MODES.map((mode, i) => (
                  <button
                    key={i}
                    onClick={() => setModeIdx(i)}
                    className={`acoustic-btn${modeIdx===i?' active':''}`}
                    style={{padding:'4px 6px',fontSize:8,minWidth:42}}
                  >{mode.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* ── HARMONICS selector ── */}
          {view==='harmonics' && (
            <div style={{
              position:'absolute',bottom:16,right:16,
              display:'flex',flexDirection:'column',gap:6,
              pointerEvents:'all',alignItems:'flex-end',
            }}>
              <div style={{
                fontSize:7,letterSpacing:'.22em',color:'rgba(168,85,247,.40)',
                textTransform:'uppercase',
              }}>FOCUS HARMONIC</div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:'flex-end'}}>
                <button
                  onClick={() => setFocusN(null)}
                  className={`acoustic-btn${focusN===null?' active':''}`}
                >ALL</button>
                {Array.from({length:8},(_,i) => {
                  const n = i+1
                  return (
                    <button
                      key={n}
                      onClick={() => setFocusN(focusN===n ? null : n)}
                      className={`acoustic-btn${focusN===n?' active':''}`}
                      style={{borderColor:`${HARMONIC_COLORS[i]}44`,
                        color:focusN===n?HARMONIC_COLORS[i]:`${HARMONIC_COLORS[i]}66`}}
                    >n={n}</button>
                  )
                })}
              </div>
              {/* Harmonic label */}
              {focusN && (
                <div style={{
                  fontSize:9,letterSpacing:'.12em',
                  color:HARMONIC_COLORS[focusN-1],
                  background:'rgba(4,9,12,.88)',
                  border:`1px solid ${HARMONIC_COLORS[focusN-1]}33`,
                  padding:'4px 10px',borderRadius:2,
                }}>
                  {HARMONIC_LABELS[focusN-1]}
                </div>
              )}
            </div>
          )}

          {/* ── LISSAJOUS preset selector ── */}
          {view==='lissajous' && (
            <div style={{
              position:'absolute',bottom:16,right:16,
              display:'flex',flexDirection:'column',gap:6,
              pointerEvents:'all',alignItems:'flex-end',
            }}>
              <div style={{
                fontSize:7,letterSpacing:'.22em',color:'rgba(168,85,247,.40)',
                textTransform:'uppercase',
              }}>MUSICAL INTERVAL</div>
              <div style={{display:'flex',flexDirection:'column',gap:3,alignItems:'flex-end'}}>
                {LISSAJOUS_PRESETS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setPresetIdx(i)}
                    className={`acoustic-btn${presetIdx===i?' active':''}`}
                    style={{
                      borderColor: presetIdx===i ? `${p.color}66` : `${p.color}22`,
                      color: presetIdx===i ? p.color : `${p.color}55`,
                      minWidth:160,textAlign:'left',
                      display:'flex',justifyContent:'space-between',
                    }}
                  >
                    <span>{p.name}</span>
                    <span style={{opacity:.55}}>{p.ratio}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
