// Rectangular membrane normal modes: standing waves, nodal lines, superposition.
import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

const W   = 96
const H   = 96
const AMP = 0.50
const L   = 9.0   // membrane side length in scene units

const VERT = `
  varying float vH;
  void main() {
    vH = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const FRAG = `
  varying float vH;
  void main() {
    float t = clamp(vH * 1.3 + 0.5, 0.0, 1.0);
    vec3 low  = vec3(0.42, 0.04, 0.65);
    vec3 zero = vec3(0.02, 0.04, 0.14);
    vec3 high = vec3(0.04, 0.88, 0.98);
    vec3 col  = t < 0.5
      ? mix(low, zero, t * 2.0)
      : mix(zero, high, (t - 0.5) * 2.0);
    gl_FragColor = vec4(col, 0.97);
  }
`

export const MODES = [
  [1, 1], [1, 2], [2, 1],
  [2, 2], [1, 3], [3, 1],
  [2, 3], [3, 2], [3, 3],
]

// ── Build nodal line geometry for a single mode ────────────────────────────────
function buildNodalLines(m, n) {
  const pts = []
  const half = L / 2
  // Vertical nodal lines (x = const, parallel to z axis)
  for (let k = 1; k < m; k++) {
    const x = (k / m) * L - half
    pts.push(new THREE.Vector3(x, 0.02, -half), new THREE.Vector3(x, 0.02,  half))
  }
  // Horizontal nodal lines (z = const, parallel to x axis)
  for (let k = 1; k < n; k++) {
    const z = (k / n) * L - half
    pts.push(new THREE.Vector3(-half, 0.02, z), new THREE.Vector3(half, 0.02, z))
  }
  if (pts.length === 0) return null
  return new THREE.BufferGeometry().setFromPoints(pts)
}

export default function NormalModes({ modeIdx = 0 }) {
  const [superpose, setSuperpose] = useState(false)
  const [mode2Idx, setMode2Idx]  = useState(1)

  const modeRef  = useRef(modeIdx)
  const mode2Ref = useRef(mode2Idx)
  const supRef   = useRef(superpose)
  modeRef.current  = modeIdx
  mode2Ref.current = mode2Idx
  supRef.current   = superpose

  const tRef   = useRef(0)
  const freqRef = useRef()  // DOM ref for frequency readout

  // ── Static geometry (only built once) ────────────────────────────────────────
  const geo = useMemo(() => {
    const pos = new Float32Array(W * H * 3)
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const k = (j * W + i) * 3
        pos[k]     = (i / (W - 1) - 0.5) * L
        pos[k + 1] = 0
        pos[k + 2] = (j / (H - 1) - 0.5) * L
      }
    }
    const idxArr = new Uint32Array((W - 1) * (H - 1) * 6)
    let p = 0
    for (let j = 0; j < H - 1; j++) {
      for (let i = 0; i < W - 1; i++) {
        const a = j * W + i, b = a + 1, c = a + W, d = c + 1
        idxArr[p++] = a; idxArr[p++] = c; idxArr[p++] = b
        idxArr[p++] = b; idxArr[p++] = c; idxArr[p++] = d
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setIndex(new THREE.BufferAttribute(idxArr, 1))
    return g
  }, [])

  const meshRef    = useRef()
  const nodalRef   = useRef()

  useFrame((_, delta) => {
    tRef.current += Math.min(delta, 0.033)
    const t   = tRef.current
    const [m1, n1] = MODES[modeRef.current]
    const [m2, n2] = MODES[mode2Ref.current]
    const ω1  = Math.PI * Math.sqrt(m1 * m1 + n1 * n1) * 0.85
    const ω2  = Math.PI * Math.sqrt(m2 * m2 + n2 * n2) * 0.85
    const sup  = supRef.current

    if (!meshRef.current) return
    const attr = meshRef.current.geometry.attributes.position

    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const u1 = Math.sin(m1 * Math.PI * i / (W - 1))
                 * Math.sin(n1 * Math.PI * j / (H - 1))
                 * Math.cos(ω1 * t)
        let u = u1
        if (sup) {
          const u2 = Math.sin(m2 * Math.PI * i / (W - 1))
                   * Math.sin(n2 * Math.PI * j / (H - 1))
                   * Math.cos(ω2 * t)
          u = (u1 + u2) * 0.65
        }
        attr.setY(j * W + i, u * AMP)
      }
    }
    attr.needsUpdate = true

    // Update nodal lines
    if (nodalRef.current) {
      nodalRef.current.visible = !sup
    }

    // Frequency readout
    const ωNorm = Math.sqrt(m1 * m1 + n1 * n1)
    if (freqRef.current) {
      freqRef.current.textContent = `ω/π = √(${m1}²+${n1}²) = ${ωNorm.toFixed(3)}`
    }
  })

  // Nodal line geometry for the primary mode (recreated when modeIdx changes)
  const nodalGeo = useMemo(() => {
    const [m, n] = MODES[modeIdx]
    return buildNodalLines(m, n)
  }, [modeIdx])

  const [m1, n1] = MODES[modeIdx]
  const [m2, n2] = MODES[mode2Idx]

  return (
    <group>
      <ambientLight intensity={0.08} color="#06041a" />
      <directionalLight position={[5, 10, 4]} intensity={0.45} color="#a0e0ff" />
      <pointLight position={[0, 6, 0]} intensity={1.0} color="#22d3ee" distance={18} decay={2} />

      {/* Membrane */}
      <mesh ref={meshRef} geometry={geo} frustumCulled={false}>
        <shaderMaterial vertexShader={VERT} fragmentShader={FRAG} side={THREE.DoubleSide} transparent />
      </mesh>

      {/* Membrane border */}
      <lineSegments frustumCulled={false}>
        <edgesGeometry args={[new THREE.PlaneGeometry(L, L)]} />
        <lineBasicMaterial color="#22d3ee" transparent opacity={0.18} />
      </lineSegments>

      {/* Nodal lines (only shown for single-mode view) */}
      {nodalGeo && (
        <lineSegments ref={nodalRef} geometry={nodalGeo}>
          <lineBasicMaterial color="#ffffff" transparent opacity={0.55} linewidth={2} />
        </lineSegments>
      )}

      {/* ── Eigenfrequency readout ── */}
      <Html position={[L / 2 + 0.5, 0.5, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          background: 'rgba(4,6,14,0.88)',
          border: '1px solid rgba(34,211,238,0.18)',
          borderRadius: 3, padding: '7px 10px', width: 160,
        }}>
          <div style={{ fontSize: 8, color: 'rgba(34,211,238,0.45)', letterSpacing: '0.14em', marginBottom: 4 }}>
            MODE ({m1},{n1})
          </div>
          <div ref={freqRef} style={{ fontSize: 9, color: '#22d3ee', marginBottom: 3 }}>
            ω/π = √({m1}²+{n1}²)
          </div>
          <div style={{ fontSize: 8, color: 'rgba(34,211,238,0.35)', marginBottom: 6 }}>
            {(m1 - 1)} vert · {(n1 - 1)} horiz nodal lines
          </div>
          {superpose && (
            <div style={{ fontSize: 8, color: 'rgba(232,121,249,0.6)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 5 }}>
              ⊕ MODE ({m2},{n2}) · ω/π={Math.sqrt(m2*m2+n2*n2).toFixed(2)}
            </div>
          )}
        </div>
      </Html>

      {/* ── Superposition controls ── */}
      <Html position={[-L / 2 - 0.5, 0, 0]} style={{ pointerEvents: 'all' }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          background: 'rgba(4,6,14,0.88)',
          border: '1px solid rgba(34,211,238,0.15)',
          borderRadius: 3, padding: '7px 8px', width: 100,
        }}>
          <div style={{ fontSize: 8, color: 'rgba(34,211,238,0.45)', letterSpacing: '0.13em', marginBottom: 5 }}>
            SUPERPOSE
          </div>

          <button onClick={() => setSuperpose(s => !s)} style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 8, letterSpacing: '0.1em',
            width: '100%', marginBottom: 5,
            padding: '3px 0',
            background: superpose ? 'rgba(232,121,249,0.12)' : 'rgba(34,211,238,0.05)',
            border: `1px solid ${superpose ? 'rgba(232,121,249,0.4)' : 'rgba(34,211,238,0.18)'}`,
            color: superpose ? '#e879f9' : 'rgba(34,211,238,0.5)',
            borderRadius: 2, cursor: 'pointer',
          }}>
            {superpose ? '⊕ ON' : '⊕ OFF'}
          </button>

          {superpose && (
            <>
              <div style={{ fontSize: 7, color: 'rgba(232,121,249,0.4)', marginBottom: 3, letterSpacing: '0.1em' }}>
                2ND MODE
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                {MODES.map(([mm, nn], i) => (
                  <button key={i} onClick={() => setMode2Idx(i)} style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 7,
                    padding: '2px 0',
                    background: mode2Idx === i ? 'rgba(232,121,249,0.15)' : 'rgba(4,6,14,0.6)',
                    border: `1px solid ${mode2Idx === i ? 'rgba(232,121,249,0.45)' : 'rgba(255,255,255,0.06)'}`,
                    color: mode2Idx === i ? '#e879f9' : 'rgba(255,255,255,0.3)',
                    borderRadius: 1, cursor: 'pointer',
                  }}>
                    {mm},{nn}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </Html>
    </group>
  )
}
