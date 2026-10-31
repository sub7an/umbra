import { Fragment, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import { RT_VERT, RT_FRAG } from './blackHoleRaytrace'

// Detect low-end devices at module load time (used to set default quality)
export const isMobile =
  typeof window !== 'undefined' &&
  (window.innerWidth < 768 ||
    /Mobi|Android/i.test(navigator.userAgent) ||
    (navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 4))

// ── Ray-traced black hole ─────────────────────────────────────────────────────
// A full-screen quad: the fragment shader traces every pixel's light ray
// through Schwarzschild spacetime (see blackHoleRaytrace.js). The disc, its
// lensed far-side image, the photon ring and the distorted stars all come out
// of the geodesics, not from separate layers.
function RayTraced({ Rs, hiRes }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: RT_VERT,
    fragmentShader: RT_FRAG,
    uniforms: {
      uInvProj:  { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() },
      uCamPos:   { value: new THREE.Vector3() },
      uRs:       { value: Rs },
      uTime:     { value: 0 },
      uSteps:    { value: hiRes ? 260 : 140 },
    },
    depthWrite: false,
    depthTest: false,
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { mat.uniforms.uRs.value = Rs }, [mat, Rs])
  useEffect(() => { mat.uniforms.uSteps.value = hiRes ? 260 : 140 }, [mat, hiRes])
  useEffect(() => () => mat.dispose(), [mat])

  useFrame(({ camera, clock }) => {
    mat.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse)
    mat.uniforms.uCamWorld.value.copy(camera.matrixWorld)
    mat.uniforms.uCamPos.value.copy(camera.position)
    mat.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <mesh frustumCulled={false} renderOrder={-10} material={mat}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function BlackHole({ hiRes }) {
  const bhMass   = useModuleStore((s) => s.fp.bhMass)
  const Rs       = bhMass * 0.5
  const unlocked = typeof window !== 'undefined' && sessionStorage.getItem('umbra_unlocked') === '1'

  return (
    <group>
      <RayTraced Rs={Rs} hiRes={hiRes} />

      <Html calculatePosition={(_, __, size) => [size.width - 216, 52]} style={{ pointerEvents: 'none' }}>
        <div style={{
          width: 204, padding: '10px 12px', borderRadius: 10,
          background: 'rgb(var(--c-panel) / 0.88)', border: '1px solid rgb(var(--c-border))',
          fontFamily: 'Inter, system-ui, sans-serif', color: 'rgb(var(--c-text))', backdropFilter: 'blur(8px)', fontSize: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Ray-traced black hole</div>
          <div style={{ color: 'rgb(var(--c-text-muted))', marginBottom: 8 }}>Every pixel follows a bent light path</div>
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4 }}>
            {[
              ['Event horizon Rₛ', Rs],
              ['Photon sphere 1.5 Rₛ', Rs * 1.5],
              ['Shadow edge 2.6 Rₛ', Rs * 2.598],
              ['Disc inner edge 3 Rₛ', Rs * 3],
            ].map(([k, v]) => (
              <Fragment key={k}>
                <dt style={{ color: 'rgb(var(--c-text-muted))' }}>{k}</dt>
                <dd style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>{v.toFixed(2)}</dd>
              </Fragment>
            ))}
          </dl>
        </div>
      </Html>
      {unlocked && (
        <Html position={[0, 2.2, 0]} center style={{ pointerEvents: 'none', textAlign: 'center' }}>
          <div style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 28,
            fontWeight: 700,
            color: '#ff69b4',
            textShadow: '0 0 18px #ff69b4, 0 0 40px #ff1493, 0 0 60px #ff1493',
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
            lineHeight: 1.3,
          }}>
            i like you sabrina mwah ♥
          </div>
        </Html>
      )}
    </group>
  )
}
