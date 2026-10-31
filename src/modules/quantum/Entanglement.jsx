// Bell state entanglement visualization
// |ψ⟩ = cos(α)|00⟩ + sin(α)|11⟩
// Periodic measurement collapse shows correlated outcomes; CHSH S > 2 readout.
import { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'

// ── Bloch sphere wireframe ─────────────────────────────────────────────────────
function BlochWireframe({ color }) {
  const geo = useMemo(() => {
    const pts = []
    const n = 56
    for (const y of [-0.5, 0, 0.5]) {
      const r = Math.sqrt(1 - y * y)
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2
        pts.push(r * Math.cos(a0), y, r * Math.sin(a0))
        pts.push(r * Math.cos(a1), y, r * Math.sin(a1))
      }
    }
    for (let k = 0; k < 4; k++) {
      const phi = (k / 4) * Math.PI
      for (let i = 0; i < n; i++) {
        const t0 = (i / n) * Math.PI * 2, t1 = ((i + 1) / n) * Math.PI * 2
        pts.push(
          Math.sin(t0) * Math.cos(phi), Math.cos(t0), Math.sin(t0) * Math.sin(phi),
          Math.sin(t1) * Math.cos(phi), Math.cos(t1), Math.sin(t1) * Math.sin(phi)
        )
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color={color} transparent opacity={0.20} depthWrite={false} />
    </lineSegments>
  )
}

// ── State vector arrow ─────────────────────────────────────────────────────────
// direction: 1 = toward |0⟩ (+y), -1 = toward |1⟩ (−y)
function StateArrow({ length, color, direction = 1 }) {
  if (length < 0.02) return null
  const shaftLen = Math.max(0.001, length - 0.22)
  const base     = length - 0.22
  return (
    <group rotation={direction < 0 ? [Math.PI, 0, 0] : [0, 0, 0]}>
      <mesh position={[0, shaftLen / 2, 0]}>
        <cylinderGeometry args={[0.025, 0.025, shaftLen, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[0, base + 0.11, 0]}>
        <coneGeometry args={[0.08, 0.22, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.0} />
      </mesh>
    </group>
  )
}

// ── Expanding uncertainty rings ────────────────────────────────────────────────
const N_RINGS = 5
function UncertaintyRings({ concurrence, color }) {
  const phases   = useRef(Array.from({ length: N_RINGS }, (_, i) => i / N_RINGS))
  const meshRefs = useRef([])
  const mats     = useMemo(() => Array.from({ length: N_RINGS }, () =>
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true, opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  ), [color])
  useEffect(() => () => mats.forEach(m => m.dispose()), [mats])

  useFrame((_, delta) => {
    for (let i = 0; i < N_RINGS; i++) {
      phases.current[i] = (phases.current[i] + delta * 0.40) % 1
      const p = phases.current[i]
      const r = 0.25 + p * 0.75
      if (meshRefs.current[i]) meshRefs.current[i].scale.set(r, r, 1)
      mats[i].opacity = Math.min(p * 4, 1) * Math.pow(1 - p, 1.7) * 0.45 * concurrence
    }
  })

  if (concurrence < 0.04) return null
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      {Array.from({ length: N_RINGS }, (_, i) => (
        <mesh key={i} ref={el => { meshRefs.current[i] = el }} material={mats[i]}>
          <ringGeometry args={[0.9, 1.0, 48]} />
        </mesh>
      ))}
    </group>
  )
}

// ── Measurement flash glow ─────────────────────────────────────────────────────
function FlashGlow({ color, flashRef }) {
  const matRef = useRef()
  useEffect(() => {
    if (flashRef) flashRef.current = { mat: matRef.current }
  })
  return (
    <mesh>
      <sphereGeometry args={[1.18, 18, 14]} />
      <meshBasicMaterial
        ref={matRef}
        color={color}
        transparent opacity={0}
        side={THREE.FrontSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}

// ── Qubit Bloch sphere display ─────────────────────────────────────────────────
function QubitBloch({ position, color, label, blochLen, blochDir, concurrence, flashRef }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[1, 22, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.035} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <BlochWireframe color={color} />
      <StateArrow length={blochLen} color={color} direction={blochDir} />
      <UncertaintyRings concurrence={concurrence} color={color} />
      <FlashGlow color={color} flashRef={flashRef} />

      {/* Poles */}
      <mesh position={[0, 1.06, 0]}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
      </mesh>
      <mesh position={[0, -1.06, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.5} />
      </mesh>

      <Html position={[0.2, 1.20, 0]} style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 13, color, whiteSpace: 'nowrap' }}>|0⟩</span>
      </Html>
      <Html position={[0.2, -1.24, 0]} style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 13, color: `${color}bb`, whiteSpace: 'nowrap' }}>|1⟩</span>
      </Html>
      <Html position={[0, -1.92, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, fontWeight: 600, color, whiteSpace: 'nowrap' }}>
          {label}
        </div>
      </Html>
    </group>
  )
}

// ── Bidirectional entanglement beam ───────────────────────────────────────────
// 64 particles: cyan left→right, rose right→left; flash on measurement collapse
const BEAM_N = 64
function EntanglementBeam({ concurrence, flashTrigger }) {
  const posArr  = useMemo(() => new Float32Array(BEAM_N * 3), [])
  const colArr  = useMemo(() => {
    const c = new Float32Array(BEAM_N * 3)
    for (let i = 0; i < BEAM_N; i++) {
      if (i < BEAM_N / 2) { c[i*3]=0.49; c[i*3+1]=0.55; c[i*3+2]=1.0 }  // qubit A colour
      else                  { c[i*3]=0.88; c[i*3+1]=0.25; c[i*3+2]=0.98 } // qubit B colour
    }
    return c
  }, [])
  const phases  = useRef(Array.from({ length: BEAM_N }, (_, i) => i / (BEAM_N / 2) % 1))
  const matRef  = useRef()
  const flashT  = useRef(0)

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    g.setAttribute('color',    new THREE.BufferAttribute(colArr, 3))
    return g
  }, [posArr, colArr])
  useEffect(() => () => geo.dispose(), [geo])

  // Detect flash trigger
  const prevTrigger = useRef(flashTrigger)
  useEffect(() => {
    if (flashTrigger !== prevTrigger.current) {
      flashT.current = 1.0
      prevTrigger.current = flashTrigger
    }
  }, [flashTrigger])

  useFrame((_, delta) => {
    if (concurrence < 0.02) return
    flashT.current = Math.max(0, flashT.current - delta * 1.8)

    const spd = 0.3 + concurrence * 0.55
    const half = BEAM_N / 2
    for (let i = 0; i < BEAM_N; i++) {
      phases.current[i] = (phases.current[i] + delta * spd) % 1
      const p = phases.current[i]
      const arch = Math.sin(p * Math.PI)
      if (i < half) {
        // cyan: left → right
        posArr[i*3]   = -3 + p * 6
        posArr[i*3+1] = arch * (0.06 + concurrence * 0.12)
        posArr[i*3+2] = Math.sin(phases.current[i] * 5) * 0.04
      } else {
        // rose: right → left
        posArr[i*3]   = 3 - p * 6
        posArr[i*3+1] = arch * (0.06 + concurrence * 0.12)
        posArr[i*3+2] = Math.sin(phases.current[i] * 5 + Math.PI) * 0.04
      }
      // Flash: brighten color toward white
      const fl = flashT.current
      if (fl > 0) {
        colArr[i*3]   = i < half ? fl + (1-fl)*0.49 : fl + (1-fl)*0.88
        colArr[i*3+1] = i < half ? fl + (1-fl)*0.55 : fl + (1-fl)*0.25
        colArr[i*3+2] = i < half ? fl + (1-fl)*1.0  : fl + (1-fl)*0.98
      } else {
        if (i < half) { colArr[i*3]=0.49; colArr[i*3+1]=0.55; colArr[i*3+2]=1.0 }
        else          { colArr[i*3]=0.88; colArr[i*3+1]=0.25; colArr[i*3+2]=0.98 }
      }
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate    = true
    if (matRef.current) matRef.current.opacity = 0.18 + concurrence * 0.60 + flashT.current * 0.5
  })

  if (concurrence < 0.02) return null
  return (
    <points geometry={geo}>
      <pointsMaterial
        ref={matRef}
        size={0.12}
        vertexColors
        transparent opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

const CHIP = {
  fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 500, whiteSpace: 'nowrap',
  background: 'rgb(var(--c-panel) / 0.88)', border: '1px solid rgb(var(--c-border))',
  borderRadius: 8, padding: '5px 10px', transition: 'all 0.2s',
}

// ── Main export ────────────────────────────────────────────────────────────────
const MEASURE_INTERVAL = 5.5   // seconds between measurements
const SHOW_DUR         = 2.4   // how long to display the outcome

export default function Entanglement() {
  const alpha       = useModuleStore((s) => s.qm.entangleAlpha)
  const concurrence = Math.sin(2 * alpha)
  const rawBloch    = Math.cos(2 * alpha)
  const blochLen    = Math.abs(rawBloch)
  const blochDir    = rawBloch >= 0 ? 1 : -1   // sign of Bloch z-component

  // CHSH: S = 2√(1+C²), classical bound = 2, quantum max = 2√2 ≈ 2.828
  const S     = 2 * Math.sqrt(1 + concurrence * concurrence)
  const sViol = S > 2.001

  // Measurement state
  const [measureOutcome, setMeasureOutcome] = useState(null)
  const [flashTrigger,   setFlashTrigger]   = useState(0)
  const timerRef = useRef(0)
  const measRef  = useRef({ active: false })

  // Flash glow refs for the two spheres
  const flashRefA = useRef(null)
  const flashRefB = useRef(null)
  const flashTimerRef = useRef(0)

  const [tally, setTally] = useState({ n: 0, zeros: 0 })
  useEffect(() => { setTally({ n: 0, zeros: 0 }) }, [alpha])

  const alphaRef       = useRef(alpha)
  alphaRef.current     = alpha
  const concRef        = useRef(concurrence)
  concRef.current      = concurrence

  useFrame((_, delta) => {
    timerRef.current += delta

    // Trigger measurement
    if (!measRef.current.active && timerRef.current > MEASURE_INTERVAL && concRef.current > 0.08) {
      timerRef.current = 0
      measRef.current.active = true
      flashTimerRef.current  = 0
      const a = alphaRef.current
      const outcome = Math.random() < (Math.cos(a) * Math.cos(a)) ? 0 : 1
      setMeasureOutcome(outcome)
      setTally(t => ({ n: t.n + 1, zeros: t.zeros + (outcome === 0 ? 1 : 0) }))
      setFlashTrigger(t => t + 1)
      setTimeout(() => {
        setMeasureOutcome(null)
        measRef.current.active = false
      }, SHOW_DUR * 1000)
    }

    // Flash glow on spheres
    flashTimerRef.current += delta
    const flashOpacity = measRef.current.active
      ? Math.max(0, 0.55 - flashTimerRef.current * 0.8)
      : 0
    if (flashRefA.current?.mat) flashRefA.current.mat.opacity = flashOpacity
    if (flashRefB.current?.mat) flashRefB.current.mat.opacity = flashOpacity
  })

  // Arrow display during measurement: snap to pole
  const displayLen = measureOutcome !== null ? 1.0 : blochLen
  const displayDir = measureOutcome === 1 ? -1 : (measureOutcome === 0 ? 1 : blochDir)

  // Correlation label
  const poleLabel = measureOutcome === 0 ? '|0⟩' : '|1⟩'
  const corrLabel = measureOutcome !== null
    ? `A: ${poleLabel} → B: ${poleLabel}  ✓`
    : concurrence > 0.95 ? 'Bell state |Φ⁺⟩ — maximally entangled'
    : concurrence < 0.05 ? 'Product state — not entangled'
    : 'Partially entangled'

  return (
    <group position={[-1.1, 0, 0]}>

      <QubitBloch
        position={[-3, 0, 0]}
        color="#7c8cff"
        label="Qubit A"
        blochLen={displayLen}
        blochDir={displayDir}
        concurrence={concurrence}
        flashRef={flashRefA}
      />
      <QubitBloch
        position={[3, 0, 0]}
        color="#e040fb"
        label="Qubit B"
        blochLen={displayLen}
        blochDir={displayDir}
        concurrence={concurrence}
        flashRef={flashRefB}
      />

      <EntanglementBeam concurrence={concurrence} flashTrigger={flashTrigger} />

      {/* State / outcome chip above the qubits */}
      <Html position={[0, 2.35, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          ...CHIP,
          color: measureOutcome !== null ? '#fbbf24' : 'rgb(var(--c-text))',
          borderColor: measureOutcome !== null ? 'rgba(251,191,36,0.6)' : 'rgb(var(--c-border))',
          fontSize: measureOutcome !== null ? 14 : 12,
        }}>
          {measureOutcome !== null ? `Measured: A = ${poleLabel}, B = ${poleLabel} — always the same` : corrLabel}
        </div>
      </Html>

      {/* Pinned card */}
      <Html calculatePosition={(_, __, size) => [size.width - 226, 52]} style={{ pointerEvents: 'none' }}>
        <div style={{
          width: 214, padding: '10px 12px', borderRadius: 10,
          background: 'rgb(var(--c-panel) / 0.92)', border: '1px solid rgb(var(--c-border))',
          fontFamily: 'Inter, system-ui, sans-serif', color: 'rgb(var(--c-text))', backdropFilter: 'blur(8px)', fontSize: 12,
        }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, marginBottom: 8 }}>
            |ψ⟩ = {Math.cos(alpha).toFixed(3)}|00⟩ + {Math.sin(alpha).toFixed(3)}|11⟩
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'rgb(var(--c-text-muted))' }}>Concurrence C</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#fbbf24' }}>{concurrence.toFixed(3)}</span>
          </div>

          <div style={{ marginTop: 10, fontWeight: 600 }}>CHSH Bell test</div>
          <div style={{ position: 'relative', height: 8, borderRadius: 4, marginTop: 6, background: 'rgb(var(--c-border))' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(S / 2.828) * 100}%`, borderRadius: 4, background: sViol ? '#f87171' : '#94a3b8' }} />
            <div style={{ position: 'absolute', left: `${(2 / 2.828) * 100}%`, top: -4, bottom: -4, borderLeft: '2px solid rgb(var(--c-text))' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4, color: 'rgb(var(--c-text-muted))' }}>
            <span>S = <span style={{ fontFamily: 'JetBrains Mono, monospace', color: sViol ? '#f87171' : 'rgb(var(--c-text))' }}>{S.toFixed(3)}</span></span>
            <span>classical ≤ 2 · max 2√2</span>
          </div>
          <div style={{ marginTop: 4, color: sViol ? '#f87171' : 'rgb(var(--c-text-muted))' }}>
            {sViol ? 'Violates the classical limit — no local hidden variables can explain it.' : 'Within the classical bound.'}
          </div>

          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgb(var(--c-border))' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Measurements</div>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 3 }}>
              <dt style={{ color: 'rgb(var(--c-text-muted))' }}>Runs</dt>
              <dd style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>{tally.n}</dd>
              <dt style={{ color: 'rgb(var(--c-text-muted))' }}>A and B agree</dt>
              <dd style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>{tally.n ? '100%' : '–'}</dd>
              <dt style={{ color: 'rgb(var(--c-text-muted))' }}>Both |0⟩ (theory cos²α)</dt>
              <dd style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>
                {tally.n ? `${Math.round((tally.zeros / tally.n) * 100)}%` : '–'} <span style={{ color: 'rgb(var(--c-text-muted))' }}>({Math.round(Math.cos(alpha) ** 2 * 100)}%)</span>
              </dd>
            </dl>
          </div>
        </div>
      </Html>
    </group>
  )
}
