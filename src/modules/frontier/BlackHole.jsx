import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import useModuleStore from '../../store/useModuleStore'

// ── Background sphere shaders ──────────────────────────────────────────────────

const BG_VERT = /* glsl */`
varying vec3 vWorldPos;
void main() {
  vec4 wPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = wPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * wPos;
}
`

const BG_FRAG = /* glsl */`
#define PI 3.14159265358979

uniform vec3  uCamPos;
uniform float uRs;
uniform float uTime;
varying vec3  vWorldPos;

float hashF(vec3 p) {
  p = fract(p * vec3(443.8975, 397.2973, 491.1871));
  p += dot(p, p.yxz + 19.19);
  return fract((p.x + p.y) * p.z);
}

vec3 starField(vec3 dir) {
  float phi = atan(dir.z, dir.x);
  vec2 uv = vec2(phi / (2.0 * PI) + 0.5, dir.y * 0.5 + 0.5);
  vec3 col = vec3(0.002, 0.003, 0.007);

  // Bright sparse stars with twinkle
  vec2 c1 = floor(uv * 140.0);
  float h1  = hashF(vec3(c1, 0.0));
  float h1b = hashF(vec3(c1, 7.3));
  float h1c = hashF(vec3(c1, 13.7));
  float b1  = max(0.0, h1 - 0.987) * (1.0 / 0.013) * 3.0;
  b1 *= 0.8 + 0.2 * sin(uTime * (h1c * 3.0 + 0.5) + h1b * 6.28);
  col += mix(vec3(0.85, 0.92, 1.0), vec3(1.0, 0.82, 0.65), h1b) * b1;

  // Medium stars
  vec2 c2 = floor(uv * 320.0);
  float h2  = hashF(vec3(c2, 1.0));
  float h2b = hashF(vec3(c2, 8.3));
  float b2  = max(0.0, h2 - 0.993) * (1.0 / 0.007) * 1.3;
  col += mix(vec3(0.9, 0.95, 1.0), vec3(1.0, 0.85, 0.72), h2b) * b2;

  // Fine dim stars
  vec2 c3 = floor(uv * 600.0);
  float h3 = hashF(vec3(c3, 2.0));
  col += vec3(0.7, 0.8, 1.0) * max(0.0, h3 - 0.997) * (1.0 / 0.003) * 0.6;

  // Nebula haze
  vec2 cn = floor(uv * 22.0);
  float hn  = hashF(vec3(cn, 3.0));
  float hn2 = hashF(vec3(cn, 19.0));
  float neb = max(0.0, hn - 0.5) * 2.0 * max(0.0, hn2 - 0.3) * (1.0 / 0.7);
  col += vec3(0.04, 0.06, 0.14) * neb;

  return col;
}

void main() {
  vec3 rayDir = normalize(vWorldPos - uCamPos);

  // Impact parameter: minimum distance of ray from BH at origin
  float t_c    = -dot(uCamPos, rayDir);
  bool  toward = t_c > 0.0;
  vec3  cPt    = uCamPos + max(t_c, 0.0) * rayDir;
  float b      = length(cPt);

  // b_crit = 3√3/2 · Rs — shadow boundary (photon capture radius)
  float b_crit = uRs * 2.598;

  // Shadow: rays captured by BH
  if (toward && b < b_crit) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Gravitational lensing deflection
  vec3 deflDir = rayDir;
  if (toward && b < uRs * 30.0) {
    vec3  perp  = normalize(-cPt); // unit vector from closest approach → BH

    // First-order Schwarzschild + strong-field divergence near b_crit
    float alpha  = 2.0 * uRs / b;
    float excess = max(b / b_crit - 1.0, 0.001);
    alpha += 0.12 / excess;
    alpha  = min(alpha, PI * 0.96);

    // Rotate rayDir toward BH by alpha (in the plane of rayDir and perp)
    deflDir = normalize(cos(alpha) * rayDir + sin(alpha) * perp);
  }

  vec3 col = starField(deflDir);

  // Photon ring glow: tight bright band at the shadow boundary
  if (toward) {
    float u    = b / b_crit - 1.0; // 0 at boundary, > 0 outside
    float ring = exp(-u * u * 1400.0) * 5.5;
    col += vec3(1.0, 0.87, 0.52) * ring;
  }

  gl_FragColor = vec4(col, 1.0);
}
`

// ── Accretion disk shaders ──────────────────────────────────────────────────────

const DISK_VERT = /* glsl */`
varying vec3 vWorldPos;
void main() {
  vec4 wPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = wPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * wPos;
}
`

const DISK_FRAG = /* glsl */`
uniform float uTime;
uniform float uInner;
uniform float uOuter;
varying vec3  vWorldPos;

void main() {
  // Disk lies in XZ plane after the rotation applied in JSX
  float r     = length(vWorldPos.xz);
  float rNorm = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);

  float angle    = atan(vWorldPos.z, vWorldPos.x);
  float omega    = 1.0 / max(r * sqrt(max(r, 0.01)), 0.01); // Keplerian: ω ∝ r^-3/2
  float rotAngle = angle - uTime * omega * 0.28;

  // Turbulent brightness bands
  float turb  = 0.60 + 0.40 * sin(rotAngle * 7.0 + rNorm * 22.0);
  float turb2 = 0.75 + 0.25 * sin(rotAngle * 3.0 - rNorm * 9.0 + 1.3);
  float bright = pow(1.0 - rNorm, 2.0) * 3.2 * turb * turb2;

  // Color: white-hot inner → orange → dim red outer
  vec3 innerCol = vec3(1.0, 0.97, 0.9);
  vec3 midCol   = vec3(1.0, 0.52, 0.10);
  vec3 outerCol = vec3(0.45, 0.07, 0.01);
  vec3 col = rNorm < 0.35
    ? mix(innerCol, midCol, rNorm / 0.35)
    : mix(midCol, outerCol, (rNorm - 0.35) / 0.65);

  float alpha = bright
    * smoothstep(0.0, 0.07, rNorm)
    * smoothstep(1.0, 0.87, rNorm);

  if (alpha < 0.006) discard;
  gl_FragColor = vec4(col * alpha, alpha * 0.92);
}
`

// ── Sub-components ─────────────────────────────────────────────────────────────

function StarBackground({ Rs }) {
  const matRef = useRef()

  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   BG_VERT,
    fragmentShader: BG_FRAG,
    uniforms: {
      uCamPos: { value: new THREE.Vector3() },
      uRs:     { value: Rs },
      uTime:   { value: 0.0 },
    },
    side:        THREE.BackSide,
    depthWrite:  false,
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep Rs uniform in sync without recreating material
  useMemo(() => { if (mat) mat.uniforms.uRs.value = Rs }, [mat, Rs])

  useFrame(({ clock, camera }) => {
    mat.uniforms.uCamPos.value.copy(camera.position)
    mat.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <mesh renderOrder={-1} material={mat}>
      <sphereGeometry args={[45, 48, 48]} />
    </mesh>
  )
}

function EventHorizon({ Rs }) {
  return (
    <mesh renderOrder={0}>
      <sphereGeometry args={[Rs, 32, 32]} />
      <meshBasicMaterial color="#000000" depthWrite={true} />
    </mesh>
  )
}

function AccretionDisk({ Rs }) {
  const innerR = Rs * 3.0  // ISCO for Schwarzschild BH
  const outerR = Rs * 8.5

  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   DISK_VERT,
    fragmentShader: DISK_FRAG,
    uniforms: {
      uTime:  { value: 0.0 },
      uInner: { value: innerR },
      uOuter: { value: outerR },
    },
    transparent:  true,
    depthWrite:   false,
    side:         THREE.DoubleSide,
  }), [innerR, outerR])

  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <mesh renderOrder={1} rotation={[Math.PI / 2, 0, 0]} material={mat}>
      {/* phiSegments=6 gives smooth radial gradient in shader */}
      <ringGeometry args={[innerR, outerR, 160, 6]} />
    </mesh>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function BlackHole() {
  const bhMass = useModuleStore((s) => s.fp.bhMass)
  const Rs     = bhMass * 0.5   // Schwarzschild radius in scene units

  return (
    <group>
      <StarBackground Rs={Rs} />
      <EventHorizon Rs={Rs} />
      <AccretionDisk Rs={Rs} />
    </group>
  )
}
