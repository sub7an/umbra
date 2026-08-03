// ── lensingShader.js ──────────────────────────────────────────────────────────
// All GLSL source for the Black Hole visualization, exported as tagged strings.
// Three shader pairs:
//   BG_VERT / BG_FRAG     — background sky sphere: procedural starfield + gravitational lensing
//   PHOTON_VERT / PHOTON_FRAG — photon-sphere glow shell (Fresnel rim, additive blending)
//   DISK_VERT / DISK_FRAG — accretion disk ring (Keplerian rotation, additive blending)
// ─────────────────────────────────────────────────────────────────────────────

// ── Background sky sphere ─────────────────────────────────────────────────────

export const BG_VERT = /* glsl */`
varying vec3 vWorldPos;

void main() {
  vec4 wPos    = modelMatrix * vec4(position, 1.0);
  vWorldPos    = wPos.xyz;
  gl_Position  = projectionMatrix * viewMatrix * wPos;
}
`

export const BG_FRAG = /* glsl */`
#define PI 3.14159265358979323846

uniform vec3  uCamPos;
uniform float uRs;      // Schwarzschild radius (scene units)
uniform float uTime;
uniform float uHiRes;   // 1.0 = full quality, 0.0 = reduced (mobile)

varying vec3  vWorldPos;

// ── Hash / noise ──────────────────────────────────────────────────────────────
float hF(vec3 p) {
  p  = fract(p * vec3(443.8975, 397.2973, 491.1871));
  p += dot(p, p.yxz + 19.19);
  return fract((p.x + p.y) * p.z);
}

// ── Procedural star field sampled in sky-direction space ──────────────────────
//
// Stars are fixed in world space: the same direction always maps to the same
// cell, so they rotate correctly as the camera orbits.
vec3 starField(vec3 dir) {
  float phi  = atan(dir.z, dir.x);
  vec2  sph  = vec2(phi / (2.0 * PI) + 0.5, dir.y * 0.5 + 0.5);
  vec3  col  = vec3(0.0015, 0.0022, 0.006); // deep-space background tint

  // Scale 1 — bright, sparse, twinkling
  vec2  c1   = floor(sph * 140.0);
  float h1   = hF(vec3(c1, 0.0));
  float h1b  = hF(vec3(c1, 7.3));
  float h1c  = hF(vec3(c1, 13.7));
  float b1   = max(0.0, h1 - 0.987) * (1.0 / 0.013) * 3.2;
  b1        *= 0.82 + 0.18 * sin(uTime * (h1c * 3.1 + 0.4) + h1b * 6.28);
  col       += mix(vec3(0.83, 0.91, 1.0), vec3(1.0, 0.79, 0.60), h1b) * b1;

  // Scale 2 — medium brightness (hi-res only)
  if (uHiRes > 0.5) {
    vec2  c2  = floor(sph * 330.0);
    float h2  = hF(vec3(c2, 1.0));
    float h2b = hF(vec3(c2, 8.3));
    float b2  = max(0.0, h2 - 0.9925) * (1.0 / 0.0075) * 1.4;
    col      += mix(vec3(0.88, 0.94, 1.0), vec3(1.0, 0.83, 0.68), h2b) * b2;
  }

  // Scale 3 — fine, dim (hi-res only)
  if (uHiRes > 0.5) {
    vec2  c3  = floor(sph * 640.0);
    float h3  = hF(vec3(c3, 2.0));
    col      += vec3(0.65, 0.76, 1.0) * max(0.0, h3 - 0.997) * (1.0 / 0.003) * 0.55;
  }

  // Nebula haze — faint Milky Way suggestion (hi-res only)
  if (uHiRes > 0.5) {
    vec2  cn   = floor(sph * 22.0);
    float hn   = hF(vec3(cn, 3.0));
    float hn2  = hF(vec3(cn, 19.0));
    float neb  = max(0.0, hn - 0.48) * (1.0/0.52) * max(0.0, hn2 - 0.28) * (1.0/0.72);
    col       += vec3(0.04, 0.065, 0.15) * neb;
  }

  return col;
}

void main() {
  // ── Ray direction from camera to this sky-sphere fragment ─────────────────
  vec3 rayDir = normalize(vWorldPos - uCamPos);

  // ── Impact parameter: minimum distance of ray from BH (at world origin) ───
  //    Ray: P(t) = uCamPos + t * rayDir
  //    Closest approach: t_c = -dot(uCamPos, rayDir)
  //    Impact parameter: b = |uCamPos + t_c * rayDir|
  float t_c    = -dot(uCamPos, rayDir);
  bool  toward = (t_c > 0.0);                        // ray heading toward BH
  vec3  cPt    = uCamPos + max(t_c, 0.0) * rayDir;   // closest-approach point
  float b      = length(cPt);                         // impact parameter

  // ── Shadow: b_crit = 3√3/2 · Rs  (photon capture radius) ─────────────────
  float b_crit = uRs * 2.59808; // 3*sqrt(3)/2

  if (toward && b < b_crit) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // ── Gravitational lensing — simplified 1/r² approximation ─────────────────
  //
  //   Deflection: δ ≈ k · b_crit² / b²
  //
  //   This is NOT the Schwarzschild formula (α = 4GM/c²b = 2Rs/b, a 1/b law).
  //   We use 1/b² instead: it diverges more sharply near the photon sphere,
  //   producing a visually convincing Einstein ring. k = 4.0 is calibrated
  //   so lensing is weak at b >> b_crit and approaches π at b ≈ b_crit.
  //
  //   See InfoPanel for honest labelling of this approximation.
  // ──────────────────────────────────────────────────────────────────────────
  vec3 deflDir = rayDir;

  if (toward && b < uRs * 28.0) {
    vec3  perp  = normalize(-cPt);   // points from closest approach toward BH

    float k     = 4.0;
    float denom = max(b * b, b_crit * b_crit * 0.002); // guard against divide-by-zero
    float alpha = k * b_crit * b_crit / denom;
    alpha       = min(alpha, PI * 0.965);               // cap before full reversal

    // Rotate ray toward BH by alpha in the (rayDir, perp) plane
    deflDir = normalize(cos(alpha) * rayDir + sin(alpha) * perp);
  }

  // ── Sample star field in deflected direction ───────────────────────────────
  vec3 col = starField(deflDir);

  // ── Photon-ring glow band at the shadow boundary ───────────────────────────
  //    Rays with b ≈ b_crit are deflected by ~π, compressing the entire
  //    background sky into a thin annular band — the Einstein / photon ring.
  if (toward) {
    float u    = b / b_crit - 1.0;          // 0 at boundary, grows outward
    float ring = exp(-u * u * 1600.0) * 6.0; // tight Gaussian, bright
    col       += vec3(1.0, 0.86, 0.48) * ring; // warm gold
  }

  gl_FragColor = vec4(col, 1.0);
}
`

// ── Photon-sphere glow shell ───────────────────────────────────────────────────
// A sphere of radius b_crit rendered with Fresnel edge-glow + additive blending.
// Produces the warm luminous halo around the shadow seen in real BH images.

export const PHOTON_VERT = /* glsl */`
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  vec4 wPos   = modelMatrix * vec4(position, 1.0);
  vWorldPos   = wPos.xyz;
  vNormal     = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const PHOTON_FRAG = /* glsl */`
uniform vec3 uCamPos;

varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  vec3  viewDir  = normalize(uCamPos - vWorldPos);
  float cosTheta = abs(dot(normalize(vNormal), viewDir));

  // Fresnel: bright at grazing angles (rim), dark face-on
  float fresnel  = pow(1.0 - cosTheta, 3.5);

  // Two-tone warm glow: outer rim gold, bright peak white-gold
  vec3  rimCol   = mix(vec3(1.0, 0.62, 0.15), vec3(1.0, 0.90, 0.60), fresnel);

  float intensity = fresnel * 2.8;
  gl_FragColor    = vec4(rimCol * intensity, fresnel * 0.75);
}
`

// ── Accretion disk ─────────────────────────────────────────────────────────────
// Flat ring in the XZ plane (rotated 90° in JSX). Keplerian rotation: inner
// material moves faster. Additive blending for a physically plausible glow.

export const DISK_VERT = /* glsl */`
varying vec3 vWorldPos;

void main() {
  vec4 wPos   = modelMatrix * vec4(position, 1.0);
  vWorldPos   = wPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * wPos;
}
`

export const DISK_FRAG = /* glsl */`
uniform float uTime;
uniform float uInner;
uniform float uOuter;

varying vec3 vWorldPos;

float hD(vec2 p) {
  p  = fract(p * vec2(127.1, 311.7));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}

void main() {
  // Radial distance in the disk plane (XZ after JSX rotation)
  float r      = length(vWorldPos.xz);
  float rNorm  = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);

  // Azimuth + Keplerian angular velocity (ω ∝ r^-3/2)
  float phi    = atan(vWorldPos.z, vWorldPos.x);
  float omega  = 1.0 / max(r * sqrt(max(r, 0.01)), 0.01);
  float swept  = phi - uTime * omega * 0.30; // animation

  // Turbulence: multiple sinusoidal layers at different scales
  float t1     = 0.55 + 0.45 * sin(swept *  6.0 + rNorm * 24.0);
  float t2     = 0.70 + 0.30 * sin(swept *  2.5 - rNorm *  8.0 + 1.4);
  float t3     = 0.80 + 0.20 * sin(swept * 14.0 + rNorm * 40.0 + 2.7); // fine grain

  // Discrete bright streaks simulating magnetic field lines / blobs
  float cellPhi = floor(mod(swept * 3.0 + rNorm * 6.0, 6.28) * 4.0);
  float streak  = hD(vec2(cellPhi, floor(rNorm * 12.0)));
  float blob    = smoothstep(0.85, 1.0, streak) * 0.6;

  float bright  = pow(1.0 - rNorm, 1.8) * 3.5 * t1 * t2 * t3 + blob;

  // Color: blue-white core → white-gold → orange → dim crimson outer
  vec3 coreCol  = vec3(0.92, 0.96, 1.0);
  vec3 hotCol   = vec3(1.0,  0.97, 0.80);
  vec3 midCol   = vec3(1.0,  0.52, 0.10);
  vec3 outerCol = vec3(0.42, 0.06, 0.01);

  vec3 col;
  if (rNorm < 0.12)      col = mix(coreCol, hotCol,  rNorm / 0.12);
  else if (rNorm < 0.40) col = mix(hotCol,  midCol,  (rNorm - 0.12) / 0.28);
  else                   col = mix(midCol,  outerCol, (rNorm - 0.40) / 0.60);

  float alpha = bright
    * smoothstep(0.0, 0.06, rNorm)
    * smoothstep(1.0, 0.88, rNorm);

  if (alpha < 0.004) discard;

  // Additive blending: output pre-multiplied color, alpha drives bloom
  gl_FragColor = vec4(col * alpha, alpha);
}
`
