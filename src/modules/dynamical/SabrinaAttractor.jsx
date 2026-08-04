import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Letter stroke waypoints: [dx, dy, dz] in local space
// Each letter spans ~0.9 wide, 1.5 tall, centered at x=0, y=0..1.5
const STROKES = {
  S: [
    [ 0.38, 1.30, 0.00], [ 0.10, 1.50, 0.10], [-0.35, 1.20, 0.00],
    [-0.15, 0.90,-0.10], [ 0.00, 0.75, 0.00], [ 0.15, 0.60, 0.10],
    [ 0.38, 0.30, 0.00], [ 0.28, 0.08,-0.10], [ 0.00, 0.00, 0.00], [-0.38, 0.12, 0.10],
  ],
  A: [
    [-0.38, 0.00, 0.00], [-0.18, 0.50, 0.10], [ 0.00, 1.50, 0.00],
    [ 0.18, 0.50,-0.10], [ 0.38, 0.00, 0.00],
    [ 0.18, 0.00, 0.05], [-0.12, 0.52, 0.10], [ 0.12, 0.52, 0.00],
  ],
  B: [
    [-0.28, 0.00, 0.00], [-0.28, 0.75, 0.10], [-0.28, 1.50, 0.00],
    [ 0.05, 1.50, 0.10], [ 0.34, 1.22, 0.00], [ 0.34, 0.88,-0.10],
    [ 0.05, 0.75, 0.00], [-0.28, 0.75, 0.10],
    [ 0.05, 0.75, 0.00], [ 0.34, 0.48,-0.10], [ 0.34, 0.15, 0.00],
    [ 0.05, 0.00, 0.10], [-0.28, 0.00, 0.00],
  ],
  R: [
    [-0.28, 0.00, 0.00], [-0.28, 0.75, 0.10], [-0.28, 1.50, 0.00],
    [ 0.05, 1.50, 0.10], [ 0.34, 1.22, 0.00], [ 0.34, 0.88,-0.10],
    [ 0.05, 0.75, 0.00], [-0.28, 0.75, 0.10],
    [-0.05, 0.75, 0.00], [ 0.34, 0.00,-0.10],
  ],
  I: [
    [ 0.00, 0.00, 0.00], [ 0.00, 0.50, 0.10],
    [ 0.00, 1.00,-0.10], [ 0.00, 1.50, 0.00],
  ],
  N: [
    [-0.32, 0.00, 0.00], [-0.32, 0.50, 0.10], [-0.32, 1.50, 0.00],
    [ 0.32, 0.00,-0.10],
    [ 0.32, 0.50, 0.10], [ 0.32, 1.50, 0.00],
  ],
}

const WORD    = ['S','A','B','R','I','N','A']
const SPACING = 1.28
const TOTAL_W = (WORD.length - 1) * SPACING
const Y_OFF   = -0.75   // center vertically in view

function buildCurve() {
  const pts = []
  for (let li = 0; li < WORD.length; li++) {
    const letter  = WORD[li]
    const xCenter = li * SPACING - TOTAL_W / 2
    const strokes = STROKES[letter]
    for (const [dx, dy, dz] of strokes) {
      pts.push(new THREE.Vector3(xCenter + dx, Y_OFF + dy, dz * 0.5))
    }
  }
  return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5)
}

const N = 700

export default function SabrinaAttractor() {
  const curve  = useMemo(() => buildCurve(), [])
  const tmpVec = useMemo(() => new THREE.Vector3(), [])
  const geoRef = useRef()

  const { tArr, speeds, posArr, colArr } = useMemo(() => {
    const tArr   = new Float32Array(N)
    const speeds = new Float32Array(N)
    const posArr = new Float32Array(N * 3)
    const colArr = new Float32Array(N * 3)

    for (let i = 0; i < N; i++) {
      tArr[i]   = i / N
      speeds[i] = 0.012 + Math.random() * 0.018

      // Pink → rose gradient with slight variation
      const f = Math.random()
      colArr[i*3]   = 1.0
      colArr[i*3+1] = 0.15 + f * 0.30
      colArr[i*3+2] = 0.50 + f * 0.35

      // Initialise positions on curve
      curve.getPoint(tArr[i], tmpVec)
      posArr[i*3]   = tmpVec.x
      posArr[i*3+1] = tmpVec.y
      posArr[i*3+2] = tmpVec.z
    }
    return { tArr, speeds, posArr, colArr }
  }, [curve, tmpVec])

  useFrame((_, delta) => {
    for (let i = 0; i < N; i++) {
      tArr[i] = (tArr[i] + speeds[i] * delta) % 1.0
      curve.getPoint(tArr[i], tmpVec)
      posArr[i*3]   = tmpVec.x
      posArr[i*3+1] = tmpVec.y
      posArr[i*3+2] = tmpVec.z
    }
    if (geoRef.current) geoRef.current.attributes.position.needsUpdate = true
  })

  return (
    <points>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" args={[posArr, 3]} />
        <bufferAttribute attach="attributes-color"    args={[colArr, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.055}
        vertexColors
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}
