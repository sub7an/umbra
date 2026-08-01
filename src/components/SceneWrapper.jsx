import { useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei'

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

export default function SceneWrapper({ children, cameraPosition }) {
  return (
    <div className="relative w-full h-full scanlines" style={{ minHeight: 0 }}>
      <Canvas
        camera={{ position: cameraPosition || [4, 3, 7], fov: 45, near: 0.1, far: 100 }}
        shadows
        gl={{ antialias: true, alpha: false }}
        style={{ width: '100%', height: '100%', display: 'block', background: '#070b0d' }}
      >
        <CameraRig position={cameraPosition || [4, 3, 7]} />
        <DefaultLighting />
        <SceneGrid />
        {children}
        <OrbitControls
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={2}
          maxDistance={20}
          maxPolarAngle={Math.PI * 0.85}
        />
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
