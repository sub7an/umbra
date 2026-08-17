import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei'
import * as THREE from 'three'
import { useGesture } from '../context/GestureContext'

function DefaultLighting() {
  return (
    <>
      <ambientLight intensity={0.15} color="#0a2030" />
      <directionalLight position={[5, 8, 5]} intensity={0.6} color="#c0f0e8" castShadow />
      <pointLight position={[-4, 4, -4]} intensity={0.3} color="#00e5c4" />
      <pointLight position={[4, -2, 4]} intensity={0.15} color="#f59e0b" />
    </>
  )
}

function SceneGrid() {
  return (
    <Grid
      args={[20, 20]}
      cellSize={1}
      cellThickness={0.4}
      cellColor="#0f2a38"
      sectionSize={5}
      sectionThickness={0.8}
      sectionColor="#143344"
      fadeDistance={18}
      fadeStrength={1.2}
      infiniteGrid={false}
      position={[0, -0.01, 0]}
    />
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

// Teleports camera to target position when the view changes
function CameraRig({ position }) {
  const { camera } = useThree()
  const posRef = useRef(position)

  useEffect(() => {
    if (posRef.current === position) return
    posRef.current = position
    camera.position.set(...position)
    camera.lookAt(0, 0, 0)
  }, [camera, position])

  // Apply initial position once on mount
  useEffect(() => {
    camera.position.set(...position)
    camera.lookAt(0, 0, 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export default function SceneWrapper({ children, cameraPosition, showGrid = true, minDist = 2, maxDist = 20 }) {
  const orbitRef = useRef()

  return (
    <div className="relative w-full h-full scanlines" style={{ minHeight: 0 }}>
      <Canvas
        camera={{ position: cameraPosition || [4, 3, 7], fov: 45, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        performance={{ min: 0.5 }}
        style={{ width: '100%', height: '100%', display: 'block', background: '#070b0d' }}
      >
        <CameraRig position={cameraPosition || [4, 3, 7]} />
        <DefaultLighting />
        {showGrid && <SceneGrid />}
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
        <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
          <GizmoViewport
            axisColors={['#e040fb', '#00e5c4', '#f59e0b']}
            labelColor="#dff2ed"
          />
        </GizmoHelper>
      </Canvas>
    </div>
  )
}
