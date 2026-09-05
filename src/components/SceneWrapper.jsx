import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, MeshReflectorMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { useGesture } from '../context/GestureContext'
import CinematicEffects from './CinematicEffects'

function DefaultLighting() {
  return (
    <>
      <ambientLight intensity={0.15} color="#0a2030" />
      <directionalLight position={[5, 8, 5]} intensity={0.6} color="#c0f0e8" castShadow />
      <pointLight position={[-4, 4, -4]} intensity={0.3} color="#5e6ad2" />
      <pointLight position={[4, -2, 4]} intensity={0.15} color="#f59e0b" />
    </>
  )
}

// ── Distant black-mirror void floor + faint measurement grid ─────────────────
// The mirror sits well below the scene so content that extends under y=0
// (past light cones, funnels, lower halves of spheres) is never occluded.
function CinematicFloor() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -6.5, 0]}>
        <planeGeometry args={[90, 90]} />
        <MeshReflectorMaterial
          blur={[320, 110]}
          resolution={512}
          mixBlur={1}
          mixStrength={1.6}
          roughness={0.9}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.3}
          color="#0a0a0e"
          metalness={0.5}
          mirror={0.45}
        />
      </mesh>
      <Grid
        args={[20, 20]}
        cellSize={1}
        cellThickness={0.4}
        cellColor="#16161c"
        sectionSize={5}
        sectionThickness={0.8}
        sectionColor="#232332"
        fadeDistance={18}
        fadeStrength={1.2}
        infiniteGrid={false}
        position={[0, -0.01, 0]}
      />
    </>
  )
}

// ── Cosmic dust — slow-drifting soft particles for depth and scale ────────────
function makeSoftSprite() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.4)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

function DustField({ count = 240 }) {
  const ref = useRef()
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 9 + Math.random() * 24
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      arr[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.cos(phi) * 0.55
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    return arr
  }, [count])
  const sprite = useMemo(() => makeSoftSprite(), [])

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.009
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.02
    }
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={sprite}
        size={0.14}
        sizeAttenuation
        transparent
        opacity={0.32}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        color="#8b9cf7"
      />
    </points>
  )
}

function isPeaceSign(lms) {
  if (!lms || lms.length < 21) return false
  const w    = lms[0]
  const dist = (a) => Math.hypot(lms[a].x - w.x, lms[a].y - w.y)
  return dist(8)  > dist(6)  * 1.12 &&
         dist(12) > dist(10) * 1.12 &&
         dist(16) < dist(14) * 1.05 &&
         dist(20) < dist(18) * 1.05
}

function GestureCamera({ orbitRef, minDist, maxDist }) {
  const { enabled, pointerRef, pinchingRef, landmarksRef, twoPinchRef, peaceRef } = useGesture()
  const { camera } = useThree()

  const prevNDC   = useRef(null)
  const spherical = useRef(new THREE.Spherical())

  useFrame(() => {
    if (!enabled) return

    const ptr       = pointerRef.current
    const pinching  = pinchingRef.current
    const peace     = peaceRef?.current ?? isPeaceSign(landmarksRef.current)
    const twoPinch  = twoPinchRef?.current

    // ── Two-hand pinch zoom takes priority ───────────────────────────────────
    if (twoPinch?.active) {
      if (orbitRef.current) orbitRef.current.enabled = false
      spherical.current.setFromVector3(camera.position)
      const clamped = THREE.MathUtils.clamp(
        spherical.current.radius * (twoPinch.delta ?? 1),
        minDist, maxDist,
      )
      spherical.current.radius = clamped
      spherical.current.makeSafe()
      camera.position.setFromSpherical(spherical.current)
      camera.lookAt(0, 0, 0)
      prevNDC.current = null
      return
    }

    const active = pinching || peace
    if (orbitRef.current) orbitRef.current.enabled = !active

    if (!active) {
      spherical.current.setFromVector3(camera.position)
      prevNDC.current = null
      return
    }

    if (ptr && prevNDC.current) {
      const dx = ptr.x - prevNDC.current.x
      const dy = ptr.y - prevNDC.current.y

      if (pinching) {
        spherical.current.theta -= dx * 3.2
        spherical.current.phi    = THREE.MathUtils.clamp(
          spherical.current.phi - dy * 2.4,
          0.08, Math.PI - 0.08,
        )
      } else if (peace) {
        spherical.current.radius = THREE.MathUtils.clamp(
          spherical.current.radius * (1 - dy * 4),
          minDist, maxDist,
        )
      }

      spherical.current.makeSafe()
      camera.position.setFromSpherical(spherical.current)
      camera.lookAt(0, 0, 0)
    }

    prevNDC.current = ptr ? { x: ptr.x, y: ptr.y } : null
  })

  return null
}

// ── Camera director: dolly-in on load, eased glide on view change ─────────────
function CameraDirector({ position }) {
  const { camera } = useThree()
  const key   = position.join(',')
  const goal  = useRef(new THREE.Vector3(...position))
  const anim  = useRef({ active: false, from: new THREE.Vector3(), start: -1, dur: 1 })
  const first = useRef(true)

  // Cancel the cinematic move the moment the user grabs the scene
  useEffect(() => {
    const cancel = () => { anim.current.active = false }
    window.addEventListener('pointerdown', cancel)
    window.addEventListener('wheel', cancel)
    return () => {
      window.removeEventListener('pointerdown', cancel)
      window.removeEventListener('wheel', cancel)
    }
  }, [])

  useEffect(() => {
    const g = new THREE.Vector3(...position)
    goal.current = g
    if (first.current) {
      // Opening shot: start pulled back and above, dolly in
      first.current = false
      const start = g.clone().multiplyScalar(1.65)
      start.y += g.length() * 0.2
      camera.position.copy(start)
      camera.lookAt(0, 0, 0)
      anim.current = { active: true, from: start, start: -1, dur: 1.8 }
    } else {
      // View change: glide from wherever we are now
      anim.current = { active: true, from: camera.position.clone(), start: -1, dur: 1.1 }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useFrame((state) => {
    const a = anim.current
    if (!a.active) return
    if (a.start < 0) a.start = state.clock.elapsedTime
    const e = Math.min((state.clock.elapsedTime - a.start) / a.dur, 1)
    const k = 1 - Math.pow(1 - e, 3) // easeOutCubic
    camera.position.lerpVectors(a.from, goal.current, k)
    camera.lookAt(0, 0, 0)
    if (e === 1) a.active = false
  })

  return null
}

// ── Idle drift: slow auto-orbit after 5s of inactivity ────────────────────────
function IdleDrift({ orbitRef }) {
  const idle = useRef(0)

  useEffect(() => {
    const reset = () => { idle.current = 0 }
    window.addEventListener('pointerdown', reset)
    window.addEventListener('pointermove', reset)
    window.addEventListener('wheel', reset)
    window.addEventListener('keydown', reset)
    return () => {
      window.removeEventListener('pointerdown', reset)
      window.removeEventListener('pointermove', reset)
      window.removeEventListener('wheel', reset)
      window.removeEventListener('keydown', reset)
    }
  }, [])

  useFrame((_, dt) => {
    const c = orbitRef.current
    if (!c) return
    idle.current += dt
    c.autoRotate = idle.current > 5
    c.autoRotateSpeed = 0.22
  })

  return null
}

export default function SceneWrapper({ children, cameraPosition, showGrid = true, minDist = 2, maxDist = 20 }) {
  const orbitRef = useRef()
  const camPos = cameraPosition || [4, 3, 7]

  return (
    <div className="relative w-full h-full scanlines" style={{ minHeight: 0 }}>
      <Canvas
        camera={{ position: camPos, fov: 45, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        dpr={[1, 2]}
        performance={{ min: 0.5 }}
        style={{ width: '100%', height: '100%', display: 'block', background: '#08090a' }}
      >
        <fog attach="fog" args={['#08090a', 18, 55]} />
        <CameraDirector position={camPos} />
        <DefaultLighting />
        <DustField />
        {showGrid && <CinematicFloor />}
        {children}
        <OrbitControls
          ref={orbitRef}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={minDist}
          maxDistance={maxDist}
          maxPolarAngle={Math.PI * 0.85}
        />
        <GestureCamera orbitRef={orbitRef} minDist={minDist} maxDist={maxDist} />
        <IdleDrift orbitRef={orbitRef} />
        <CinematicEffects />
      </Canvas>
    </div>
  )
}
