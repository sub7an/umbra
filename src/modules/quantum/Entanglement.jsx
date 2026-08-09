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
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 9, color, whiteSpace: 'nowrap' }}>|0⟩</span>
      </Html>
      <Html position={[0.2, -1.24, 0]} style={{ pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 9, color: `${color}77`, whiteSpace: 'nowrap' }}>|1⟩</span>
      </Html>
      <Html position={[0, -1.92, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{ fontFamily: 'Chakra Petch,sans-serif', fontSize: 11, color, letterSpacing: '0.14em', textShadow: `0 0 8px ${color}88`, whiteSpace: 'nowrap' }}>
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
      if (i < BEAM_N / 2) { c[i*3]=0; c[i*3+1]=0.90; c[i*3+2]=0.77 }    // cyan
      else                  { c[i*3]=0.88; c[i*3+1]=0.25; c[i*3+2]=0.98 } // rose
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
        colArr[i*3]   = i < half ? fl + (1-fl)*0   : fl + (1-fl)*0.88
        colArr[i*3+1] = i < half ? fl + (1-fl)*0.9 : fl + (1-fl)*0.25
        colArr[i*3+2] = i < half ? fl + (1-fl)*0.77 : fl + (1-fl)*0.98
      } else {
        if (i < half) { colArr[i*3]=0; colArr[i*3+1]=0.90; colArr[i*3+2]=0.77 }
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
        size={0.10}
        vertexColors
        transparent opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
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

  const readoutRef = useRef()

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
    : concurrence > 0.95 ? '|Φ⁺⟩  BELL STATE'
    : concurrence < 0.05 ? 'PRODUCT STATE'
    : 'PARTIAL ENTANGLEMENT'

  return (
    <group>
      <ambientLight intensity={0.06} color="#06060e" />
      <directionalLight position={[2, 6, 3]} intensity={0.2} color="#c0c8ff" />

      <QubitBloch
        position={[-3, 0, 0]}
        color="#00e5c4"
        label="QUBIT A"
        blochLen={displayLen}
        blochDir={displayDir}
        concurrence={concurrence}
        flashRef={flashRefA}
      />
      <QubitBloch
        position={[3, 0, 0]}
        color="#e040fb"
        label="QUBIT B"
        blochLen={displayLen}
        blochDir={displayDir}
        concurrence={concurrence}
        flashRef={flashRefB}
      />

      <EntanglementBeam concurrence={concurrence} flashTrigger={flashTrigger} />

      {/* ── Concurrence + CHSH readout ── */}
      <Html position={[0, 2.3, 0]} center style={{ pointerEvents: 'none', textAlign: 'center' }}>
        {/* State label */}
        <div style={{
          fontFamily: 'JetBrains Mono,monospace',
          fontSize: measureOutcome !== null ? 13 : 10,
          color: measureOutcome !== null ? '#f59e0b' : '#4a7a74',
          textShadow: measureOutcome !== null ? '0 0 12px rgba(245,158,11,0.8)' : 'none',
          letterSpacing: '0.06em', whiteSpace: 'nowrap',
          transition: 'font-size 0.2s',
        }}>
          {corrLabel}
        </div>

        {/* Concurrence */}
        <div style={{
          fontFamily: 'JetBrains Mono,monospace', fontSize: 11,
          color: '#f59e0b',
          textShadow: '0 0 8px rgba(245,158,11,0.5)',
          letterSpacing: '0.04em', marginTop: 6, whiteSpace: 'nowrap',
        }}>
          C = {concurrence.toFixed(4)}
        </div>
      </Html>

      {/* ── CHSH Bell inequality ── */}
      <Html position={[0, -2.6, 0]} center style={{ pointerEvents: 'none', textAlign: 'center' }}>
        <div style={{
          fontFamily: 'JetBrains Mono,monospace',
          background: 'rgba(4,6,14,0.80)',
          border: `1px solid ${sViol ? 'rgba(239,68,68,0.35)' : 'rgba(74,122,116,0.2)'}`,
          borderRadius: 3, padding: '5px 12px',
          display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        }}>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', color: 'rgba(180,180,200,0.45)' }}>
            CHSH BELL INEQUALITY
          </div>
          <div style={{
            fontSize: 13,
            color: sViol ? '#ef4444' : 'rgba(180,180,200,0.55)',
            textShadow: sViol ? '0 0 10px rgba(239,68,68,0.6)' : 'none',
            letterSpacing: '0.04em',
          }}>
            S = {S.toFixed(3)}
          </div>
          <div style={{ fontSize: 8, letterSpacing: '0.12em', color: sViol ? '#ef4444' : 'rgba(180,180,200,0.35)' }}>
            {sViol ? 'CLASSICAL LIMIT VIOLATED  (S > 2)' : 'WITHIN CLASSICAL BOUND  (S ≤ 2)'}
          </div>
          <div style={{ fontSize: 8, color: 'rgba(100,120,130,0.45)', letterSpacing: '0.1em', marginTop: 1 }}>
            QUANTUM MAX: 2√2 ≈ 2.828
          </div>
        </div>
      </Html>

      {/* ── State vector ── */}
      <Html position={[0, -2.0, 0]} center style={{ pointerEvents: 'none', textAlign: 'center' }}>
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, color: '#2e4a46', whiteSpace: 'nowrap' }}>
          {`|ψ⟩ = ${Math.cos(alpha).toFixed(3)}|00⟩ + ${Math.sin(alpha).toFixed(3)}|11⟩`}
        </div>
      </Html>
    </group>
  )
}
