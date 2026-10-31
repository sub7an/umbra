import { Fragment, useState, useRef, useMemo, useEffect } from 'react'
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

// ── Shadow: an opaque core so the far side of the flat disc is hidden behind
//    the hole (it reappears lensed, below) ─────────────────────────────────────
function Shadow({ Rs }) {
  return (
    <mesh renderOrder={1}>
      <sphereGeometry args={[Rs * 2.45, 48, 48]} />
      <meshBasicMaterial color="#000000" />
    </mesh>
  )
}

// ── Lensed image of the disc ──────────────────────────────────────────────────
// Light from the far side of the disc is bent over the top and under the
// bottom of the shadow. Approximated as a camera-facing glow: a thin photon
// ring hugging the shadow plus broad arcs above/below, Doppler-brighter on the
// side moving toward the camera, and fading to a symmetric ring face-on.
const LENS_VERT = /* glsl */`
varying vec2 vP;
void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const LENS_FRAG = /* glsl */`
uniform float uB;        // critical impact parameter (shadow radius)
uniform float uTime;
uniform float uSide;     // +1: approaching side is screen-right, −1: screen-left
uniform float uEdgeOn;   // 1 = camera in the disc plane, 0 = face-on
varying vec2 vP;
void main() {
  float r = length(vP) / uB;
  float psi = atan(vP.y, vP.x);
  if (r < 1.0) discard;
  // Thin photon ring just outside the shadow
  float ring = exp(-pow((r - 1.04) / 0.035, 2.0)) * 1.6;
  // Broad lensed arcs, strongest over the top and bottom when seen edge-on
  float vert = mix(1.0, pow(abs(sin(psi)), 1.6), uEdgeOn);
  float arc  = exp(-(r - 1.05) / 0.32) * smoothstep(1.0, 1.08, r) * vert;
  // Swirling texture moving round the hole
  float swirl = 0.65 + 0.35 * sin(psi * 7.0 - uTime * 1.6 + r * 9.0);
  // Doppler: brighter on the approaching side
  float dop = 1.0 + 0.75 * uSide * cos(psi);
  float I = (ring + arc * swirl) * max(dop, 0.15);
  vec3 col = mix(vec3(1.0, 0.55, 0.15), vec3(1.0, 0.93, 0.78), clamp(ring, 0.0, 1.0));
  float a = clamp(I, 0.0, 1.0) * 0.95;
  if (a < 0.004) discard;
  gl_FragColor = vec4(pow(col, vec3(2.2)) * I, a);
}
`
function LensedDisk({ Rs }) {
  const b = Rs * 2.598
  const ref = useRef()
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: LENS_VERT, fragmentShader: LENS_FRAG,
    uniforms: { uB: { value: b }, uTime: { value: 0 }, uSide: { value: 1 }, uEdgeOn: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { mat.uniforms.uB.value = b }, [mat, b])
  useEffect(() => () => mat.dispose(), [mat])
  const right = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, clock }) => {
    if (ref.current) ref.current.quaternion.copy(camera.quaternion)
    mat.uniforms.uTime.value = clock.getElapsedTime()
    // Which screen side is approaching? Disc point under the camera's right
    // vector moves along (−sinφ, 0, cosφ); compare with the direction to camera.
    right.set(1, 0, 0).applyQuaternion(camera.quaternion).setY(0)
    if (right.lengthSq() > 1e-6) {
      right.normalize()
      const phi = Math.atan2(right.z, right.x)
      const vx = -Math.sin(phi), vz = Math.cos(phi)
      const toCam = camera.position.clone().normalize()
      mat.uniforms.uSide.value = Math.sign(vx * toCam.x + vz * toCam.z) || 1
    }
    const len = camera.position.length() || 1
    mat.uniforms.uEdgeOn.value = 1 - Math.min(1, Math.abs(camera.position.y) / len)
  })
  return (
    <mesh ref={ref} renderOrder={4} material={mat}>
      <planeGeometry args={[b * 4.4, b * 4.4]} />
    </mesh>
  )
}

// ── Anatomy labels ────────────────────────────────────────────────────────────
function Anatomy({ Rs }) {
  const items = [
    { pos: [0, -Rs * 2.45 - 0.05, 0], text: 'Shadow (event horizon inside, r = Rₛ)' },
    { pos: [-Rs * 2.6, Rs * 1.9, 0], text: 'Photon ring (r = 1.5 Rₛ, light orbits)' },
    { pos: [Rs * 3.0, 0.08, Rs * 0.4], text: 'Inner edge, ISCO (3 Rₛ)' },
    { pos: [-Rs * 7.2, 0.1, 0], text: 'Accretion disc' },
    { pos: [0, Rs * 7, 0], text: 'Relativistic jet' },
  ]
  return items.map((it) => (
    <Html key={it.text} position={it.pos} center style={{ pointerEvents: 'none' }}>
      <span style={{
        fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
        color: 'rgb(var(--c-text))', background: 'rgb(var(--c-panel) / 0.8)', border: '1px solid rgb(var(--c-border))',
        borderRadius: 6, padding: '2px 7px',
      }}>{it.text}</span>
    </Html>
  ))
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function BlackHole({ hiRes }) {
  const bhMass   = useModuleStore((s) => s.fp.bhMass)
  const Rs       = bhMass * 0.5
  const unlocked = typeof window !== 'undefined' && sessionStorage.getItem('umbra_unlocked') === '1'
  const [labels, setLabels] = useState(true)

  return (
    <group>
      <StarBackground Rs={Rs} hiRes={hiRes} />
      <Shadow         Rs={Rs} />
      <PhotonSphere   Rs={Rs} />
      <AccretionDisk  Rs={Rs} />
      <LensedDisk     Rs={Rs} />
      <PolarJets      Rs={Rs} />
      {labels && <Anatomy Rs={Rs} />}

      <Html calculatePosition={(_, __, size) => [size.width - 216, 52]} style={{ pointerEvents: 'auto' }}>
        <div style={{
          width: 204, padding: '10px 12px', borderRadius: 10,
          background: 'rgb(var(--c-panel) / 0.92)', border: '1px solid rgb(var(--c-border))',
          fontFamily: 'Inter, system-ui, sans-serif', color: 'rgb(var(--c-text))', backdropFilter: 'blur(8px)', fontSize: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Schwarzschild black hole</div>
          <div style={{ color: 'rgb(var(--c-text-muted))', marginBottom: 8 }}>Radii scale with mass M (Rₛ = 2GM/c²)</div>
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4 }}>
            {[
              ['Event horizon Rₛ', Rs],
              ['Photon sphere 1.5 Rₛ', Rs * 1.5],
              ['Shadow edge b = 2.6 Rₛ', Rs * 2.598],
              ['ISCO 3 Rₛ', Rs * 3],
            ].map(([k, v]) => (
              <Fragment key={k}>
                <dt style={{ color: 'rgb(var(--c-text-muted))' }}>{k}</dt>
                <dd style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>{v.toFixed(2)}</dd>
              </Fragment>
            ))}
          </dl>
          <div style={{ marginTop: 8, color: 'rgb(var(--c-text-muted))' }}>
            The disc's far side appears bent over and under the shadow; the side moving toward you is brighter (Doppler beaming).
          </div>
          <button type="button" onClick={() => setLabels((v) => !v)} aria-pressed={labels} className="ui-btn w-full h-8 mt-2">
            {labels ? 'Hide labels' : 'Show labels'}
          </button>
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
