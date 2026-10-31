// Rectangular membrane normal modes: standing waves, nodal lines, superposition.
import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

const W   = 96
const H   = 96
const AMP = 0.9
const L   = 9.0   // membrane side length in scene units

// Height colour map: trough (violet) → rest (deep navy) → crest (cyan)
const C_LOW  = new THREE.Color('#a21caf')
const C_ZERO = new THREE.Color('#0b1640')
const C_HIGH = new THREE.Color('#22d3ee')

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
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(W * H * 3), 3))
    g.setIndex(new THREE.BufferAttribute(idxArr, 1))
    return g
  }, [])
  const tmpC = useMemo(() => new THREE.Color(), [])

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
    const col  = meshRef.current.geometry.attributes.color

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
        // colour by displacement, normalised to ±1
        const k = Math.max(-1, Math.min(1, u / (sup ? 1.3 : 1)))
        if (k < 0) tmpC.copy(C_ZERO).lerp(C_LOW, -k)
        else tmpC.copy(C_ZERO).lerp(C_HIGH, k)
        col.setXYZ(j * W + i, tmpC.r, tmpC.g, tmpC.b)
      }
    }
    attr.needsUpdate = true
    col.needsUpdate = true
    // Lit surface: recompute normals so crests and troughs catch the light
    meshRef.current.geometry.computeVertexNormals()

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
      {/* Membrane: lit, shaded drum skin coloured by displacement */}
      <mesh ref={meshRef} geometry={geo} frustumCulled={false}>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.35} metalness={0.15} envMapIntensity={0.8} />
      </mesh>

      {/* Clamped frame (the edges are fixed: u = 0 on the boundary) */}
      {[[0, -L / 2 - 0.12, L + 0.48, 0.24], [0, L / 2 + 0.12, L + 0.48, 0.24]].map(([x, z, w, d], i) => (
        <mesh key={`h${i}`} position={[x, -0.05, z]}>
          <boxGeometry args={[w, 0.22, d]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      {[[-L / 2 - 0.12, 0], [L / 2 + 0.12, 0]].map(([x, z], i) => (
        <mesh key={`v${i}`} position={[x, -0.05, z]}>
          <boxGeometry args={[0.24, 0.22, L]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}

      {/* Nodal lines (single-mode view): where the membrane never moves */}
      {nodalGeo && (
        <lineSegments ref={nodalRef} geometry={nodalGeo}>
          <lineBasicMaterial color="#fef3c7" transparent opacity={0.9} toneMapped={false} />
        </lineSegments>
      )}

      {/* ── Pinned card: mode info + superposition ── */}
      <Html calculatePosition={(_, __, size) => [size.width - 216, 52]} style={{ pointerEvents: 'auto' }}>
        <div style={{
          width: 204, padding: '10px 12px', borderRadius: 10,
          background: 'rgb(var(--c-panel) / 0.92)', border: '1px solid rgb(var(--c-border))',
          fontFamily: 'Inter, system-ui, sans-serif', color: 'rgb(var(--c-text))', backdropFilter: 'blur(8px)', fontSize: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Mode ({m1}, {n1})</div>
          <div ref={freqRef} style={{ fontFamily: 'JetBrains Mono, monospace', color: '#22d3ee', margin: '2px 0' }}>ω/π = √({m1}²+{n1}²)</div>
          <div style={{ color: 'rgb(var(--c-text-muted))', marginBottom: 8 }}>
            {m1 - 1 + n1 - 1} nodal line{m1 - 1 + n1 - 1 === 1 ? '' : 's'} (pale yellow)
          </div>
          <div style={{ height: 8, borderRadius: 3, background: 'linear-gradient(90deg, #a21caf, #0b1640 50%, #22d3ee)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 3, color: 'rgb(var(--c-text-muted))' }}>
            <span>trough</span><span>rest</span><span>crest</span>
          </div>
          <button type="button" onClick={() => setSuperpose((v) => !v)} aria-pressed={superpose} className="ui-btn w-full h-8 mt-3"
            style={superpose ? { borderColor: 'rgba(232,121,249,0.6)', background: 'rgba(232,121,249,0.12)' } : undefined}>
            {superpose ? 'Superposition on' : 'Add a second mode'}
          </button>
          {superpose && (
            <>
              <div style={{ color: 'rgb(var(--c-text-muted))', margin: '8px 0 4px' }}>Second mode ({m2}, {n2})</div>
              <div role="radiogroup" aria-label="Second mode" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                {MODES.map(([mm, nn], i) => (
                  <button key={i} type="button" role="radio" aria-checked={mode2Idx === i} onClick={() => setMode2Idx(i)}
                    className="ui-btn h-7 px-0 font-mono-data text-[12px]"
                    style={mode2Idx === i ? { borderColor: 'rgba(232,121,249,0.6)', background: 'rgba(232,121,249,0.12)' } : undefined}>
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
