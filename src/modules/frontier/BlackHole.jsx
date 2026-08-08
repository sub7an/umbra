import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'
import {
  BG_VERT, BG_FRAG,
  PHOTON_VERT, PHOTON_FRAG,
  DISK_VERT, DISK_FRAG,
} from './lensingShader'

// Detect low-end devices at module load time (used to set default quality)
export const isMobile =
  typeof window !== 'undefined' &&
  (window.innerWidth < 768 ||
    /Mobi|Android/i.test(navigator.userAgent) ||
    (navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 4))

// ── Star-field background sphere ───────────────────────────────────────────────
// Rendered inside-out (BackSide). Each fragment's ray direction is computed from
// the world position, so stars are fixed in world space and orbit correctly.

function StarBackground({ Rs, hiRes }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   BG_VERT,
    fragmentShader: BG_FRAG,
    uniforms: {
      uCamPos: { value: new THREE.Vector3() },
      uRs:     { value: Rs },
      uTime:   { value: 0.0 },
      uHiRes:  { value: hiRes ? 1.0 : 0.0 },
    },
    side:       THREE.BackSide,
    depthWrite: false,
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { mat.uniforms.uRs.value    = Rs      }, [mat, Rs])
  useEffect(() => { mat.uniforms.uHiRes.value = hiRes ? 1.0 : 0.0 }, [mat, hiRes])
  useEffect(() => () => mat.dispose(), [mat])

  useFrame(({ clock, camera }) => {
    mat.uniforms.uCamPos.value.copy(camera.position)
    mat.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <mesh renderOrder={-1} material={mat}>
      {/* 64 segments: enough resolution for smooth world-pos interpolation */}
      <sphereGeometry args={[45, 64, 64]} />
    </mesh>
  )
}

// ── Photon-sphere glow shell ───────────────────────────────────────────────────
// A Fresnel-shaded sphere at the photon capture radius (b_crit), rendered with
// additive blending. Produces the luminous gold rim visible in BH images.

function PhotonSphere({ Rs }) {
  const b_crit = Rs * 2.598

  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   PHOTON_VERT,
    fragmentShader: PHOTON_FRAG,
    uniforms: {
      uCamPos: { value: new THREE.Vector3() },
    },
    transparent: true,
    depthWrite:  false,
    depthTest:   false,  // always draws — camera may be very close
    blending:    THREE.AdditiveBlending,
    side:        THREE.FrontSide,
  }), [])

  useEffect(() => () => mat.dispose(), [mat])

  useFrame(({ camera }) => {
    mat.uniforms.uCamPos.value.copy(camera.position)
  })

  return (
    <mesh renderOrder={2} material={mat}>
      <sphereGeometry args={[b_crit, 48, 48]} />
    </mesh>
  )
}

// ── Accretion disk ─────────────────────────────────────────────────────────────
// Ring from ISCO (3 Rs) outward, Keplerian turbulence + relativistic Doppler
// beaming — approaching side appears brighter and bluer (like real M87* images).

function AccretionDisk({ Rs }) {
  const innerR = Rs * 3.0
  const outerR = Rs * 8.5

  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   DISK_VERT,
    fragmentShader: DISK_FRAG,
    uniforms: {
      uTime:   { value: 0.0 },
      uInner:  { value: innerR },
      uOuter:  { value: outerR },
      uCamPos: { value: new THREE.Vector3() },
    },
    transparent: true,
    depthWrite:  false,
    side:        THREE.DoubleSide,
    blending:    THREE.AdditiveBlending,
  }), [innerR, outerR])

  useEffect(() => () => mat.dispose(), [mat])

  useFrame(({ clock, camera }) => {
    mat.uniforms.uTime.value = clock.getElapsedTime()
    mat.uniforms.uCamPos.value.copy(camera.position)
  })

  return (
    <mesh renderOrder={3} rotation={[Math.PI / 2, 0, 0]} material={mat}>
      {/* 180 angular × 8 radial segments → smooth Keplerian gradients */}
      <ringGeometry args={[innerR, outerR, 180, 8]} />
    </mesh>
  )
}

// ── Relativistic polar jets ────────────────────────────────────────────────────
// AGN-style jets launched perpendicular to the disk along the spin axis (±Y).
// Rendered as open cones with additive blending + animated knot pattern.

const JET_VERT = /* glsl */`
varying float vHeight;
varying float vRNorm;
void main() {
  vHeight = position.y;
  float coneR = abs(position.x) + abs(position.z);
  float maxR  = abs(vHeight) * 0.35 + 0.01;
  vRNorm = coneR / maxR;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const JET_FRAG = /* glsl */`
uniform float uTime;
varying float vHeight;
varying float vRNorm;
void main() {
  float h    = abs(vHeight);
  // Knot pattern: plasma blobs propagating outward along jet
  float knot = 0.5 + 0.5 * sin(h * 6.0 - uTime * 7.0);
  // Edge glow: bright at rim, fades toward axis
  float rim  = 1.0 - clamp(vRNorm, 0.0, 1.0);
  float dist = exp(-h * 0.55);               // fades with distance from BH
  float glow = (rim * 0.4 + 0.6) * knot * dist;
  // Color: white-blue core → electric cyan → fades out
  vec3 inner = vec3(0.85, 0.95, 1.00);
  vec3 outer = vec3(0.20, 0.65, 1.00);
  vec3 col   = mix(inner, outer, clamp(vRNorm, 0.0, 1.0));
  float alpha = glow * 0.72;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(col * alpha, alpha);
}
`

function PolarJets({ Rs }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   JET_VERT,
    fragmentShader: JET_FRAG,
    uniforms: { uTime: { value: 0.0 } },
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
    side:        THREE.DoubleSide,
  }), [])

  useEffect(() => () => mat.dispose(), [mat])
  useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.getElapsedTime() })

  const jetH = Rs * 10
  const jetBaseR = Rs * 0.22

  return (
    <group>
      {/* Upper jet */}
      <mesh position={[0, jetH / 2, 0]} material={mat}>
        <cylinderGeometry args={[Rs * 0.55, jetBaseR, jetH, 24, 1, true]} />
      </mesh>
      {/* Lower jet */}
      <mesh position={[0, -jetH / 2, 0]} rotation={[Math.PI, 0, 0]} material={mat}>
        <cylinderGeometry args={[Rs * 0.55, jetBaseR, jetH, 24, 1, true]} />
      </mesh>
    </group>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function BlackHole({ hiRes }) {
  const bhMass   = useModuleStore((s) => s.fp.bhMass)
  const Rs       = bhMass * 0.5
  const unlocked = typeof window !== 'undefined' && sessionStorage.getItem('umbra_unlocked') === '1'

  return (
    <group>
      <StarBackground Rs={Rs} hiRes={hiRes} />
      <PhotonSphere   Rs={Rs} />
      <AccretionDisk  Rs={Rs} />
      <PolarJets      Rs={Rs} />
      {unlocked && (
        <Html position={[0, 2.2, 0]} center style={{ pointerEvents: 'none', textAlign: 'center' }}>
          <div style={{
            fontFamily: 'Chakra Petch, sans-serif',
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
