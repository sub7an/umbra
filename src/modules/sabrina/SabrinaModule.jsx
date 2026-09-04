import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'

const PINK = '#ff69b4'
const DEEP = '#ff1493'
const LIGHT = '#ffb6c1'

function heartXY(t) {
  const x = 16 * Math.pow(Math.sin(t), 3)
  const y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)
  return [x / 8.5, y / 8.5 - 0.15]
}

const N_HEART = 900

function HeartCloud() {
  const groupRef = useRef()
  const timeRef  = useRef(0)

  const { pos, col } = useMemo(() => {
    const pos = new Float32Array(N_HEART * 3)
    const col = new Float32Array(N_HEART * 3)
    for (let i = 0; i < N_HEART; i++) {
      const t = (i / N_HEART) * Math.PI * 2 + (Math.random() - 0.5) * 0.14
      const [hx, hy] = heartXY(t)
      pos[i*3]   = hx + (Math.random() - 0.5) * 0.12
      pos[i*3+1] = hy + (Math.random() - 0.5) * 0.12
      pos[i*3+2] = (Math.random() - 0.5) * 0.5
      const f = Math.random()
      col[i*3]   = 1.0
      col[i*3+1] = 0.18 + f * 0.35
      col[i*3+2] = 0.45 + f * 0.35
    }
    return { pos, col }
  }, [])

  useFrame((_, delta) => {
    timeRef.current += delta
    const t = timeRef.current
    if (!groupRef.current) return
    groupRef.current.rotation.y = t * 0.22
    const pulse = 1 + 0.065 * Math.sin(t * 2.1)
    groupRef.current.scale.set(pulse, pulse, pulse)
  })

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[pos, 3]} />
          <bufferAttribute attach="attributes-color" args={[col, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.09}
          vertexColors
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  )
}

const N_SPARKS = 55

function Sparkles() {
  const posArr = useMemo(() => {
    const p = new Float32Array(N_SPARKS * 3)
    for (let i = 0; i < N_SPARKS; i++) {
      p[i*3]   = (Math.random() - 0.5) * 12
      p[i*3+1] = (Math.random() - 0.5) * 8
      p[i*3+2] = (Math.random() - 0.5) * 5
    }
    return p
  }, [])
  const speeds = useMemo(() => Float32Array.from({ length: N_SPARKS }, () => 0.25 + Math.random() * 0.55), [])
  const geoRef = useRef()

  useFrame((_, delta) => {
    for (let i = 0; i < N_SPARKS; i++) {
      posArr[i*3+1] += speeds[i] * delta
      if (posArr[i*3+1] > 5.5) {
        posArr[i*3]   = (Math.random() - 0.5) * 12
        posArr[i*3+1] = -5.5
        posArr[i*3+2] = (Math.random() - 0.5) * 5
      }
    }
    if (geoRef.current) geoRef.current.attributes.position.needsUpdate = true
  })

  return (
    <points>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" args={[posArr, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        color={PINK}
        transparent
        opacity={0.55}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

export default function SabrinaModule() {
  const setActiveModule = useModuleStore((s) => s.setActiveModule)

  return (
    <div className="relative w-full h-full" style={{ background: '#07041a', overflow: 'hidden' }}>

      <Canvas
        camera={{ position: [0, 0, 8], fov: 45, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <color attach="background" args={['#07041a']} />
        <HeartCloud />
        <Sparkles />
        <OrbitControls enablePan={false} enableDamping dampingFactor={0.08} minDistance={3} maxDistance={16} />
      </Canvas>

      <button
        onClick={() => setActiveModule(null)}
        style={{
          position: 'absolute', top: 18, left: 22, zIndex: 20,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
          letterSpacing: '0.15em', color: PINK,
          textShadow: `0 0 8px ${PINK}`,
          background: 'none', border: 'none', cursor: 'pointer',
          textTransform: 'uppercase',
        }}
      >
        ← back
      </button>

      <div style={{
        position: 'absolute', bottom: 52, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 10, zIndex: 10, pointerEvents: 'none',
      }}>
        <style>{`
          @keyframes heartbeat {
            0%,100% { transform: scale(1); }
            14%      { transform: scale(1.35); }
            28%      { transform: scale(1); }
            42%      { transform: scale(1.18); }
            56%      { transform: scale(1); }
          }
          @keyframes fadein {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 0.75; transform: translateY(0); }
          }
        `}</style>
        <div style={{
          fontFamily: 'Chakra Petch, sans-serif',
          fontSize: 34, fontWeight: 700, color: PINK,
          textShadow: `0 0 18px ${DEEP}, 0 0 45px ${DEEP}, 0 0 70px ${DEEP}`,
          letterSpacing: '0.06em', whiteSpace: 'nowrap',
        }}>
          for sabrina{' '}
          <span style={{ display: 'inline-block', animation: 'heartbeat 1.4s ease-in-out infinite' }}>♥</span>
        </div>
        <div style={{
          fontFamily: 'Chakra Petch, sans-serif',
          fontSize: 14, color: LIGHT,
          opacity: 0.75, letterSpacing: '0.16em',
          textTransform: 'uppercase',
          animation: 'fadein 1.2s ease 0.4s both',
        }}>
          you make everything better
        </div>
        <div style={{
          fontFamily: 'Chakra Petch, sans-serif',
          fontSize: 11, color: PINK,
          opacity: 0, letterSpacing: '0.22em',
          textTransform: 'uppercase',
          animation: 'fadein 1.2s ease 1.6s both',
        }}>
          thanks for existing ♡
        </div>
      </div>
    </div>
  )
}
