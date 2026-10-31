// Ray-traced Schwarzschild black hole (full-screen shader).
//
// Units: Schwarzschild radius Rs = 1 (so M = 1/2, photon sphere r = 1.5,
// ISCO r = 3). Every pixel's light ray is traced backwards from the camera
// along a null geodesic, written in the standard Cartesian form
//     d²x/dλ² = −(3/2) h² x / r⁵,   h = |x × dx/dλ| (conserved)
// Each crossing of the disc plane (3 ≤ r ≤ 12) adds emitted light, so the
// far side of the disc appears bent over and under the shadow, plus thinner
// higher-order rings. Rays that fall inside r = 1 are black; rays that escape
// sample a procedural star field, so the background is lensed too.

export const RT_VERT = /* glsl */`
varying vec2 vNdc;
void main() {
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const RT_FRAG = /* glsl */`
precision highp float;
uniform mat4  uInvProj;
uniform mat4  uCamWorld;
uniform vec3  uCamPos;     // camera position in world units
uniform float uRs;         // world size of one Schwarzschild radius
uniform float uTime;
uniform float uSteps;      // max integration steps (quality)
varying vec2 vNdc;

const float DISK_IN  = 3.0;
const float DISK_OUT = 12.0;

float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash3(vec3(i, 1.0)), b = hash3(vec3(i + vec2(1, 0), 1.0));
  float c = hash3(vec3(i + vec2(0, 1), 1.0)), d = hash3(vec3(i + vec2(1, 1), 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise2(p); p *= 2.07; a *= 0.5; }
  return v;
}

// Background: sparse stars of varied colour + a faint galactic band
vec3 starfield(vec3 d) {
  vec3 col = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float scale = k == 0 ? 220.0 : 90.0;
    vec3 g = d * scale;
    vec3 id = floor(g);
    float h = hash3(id);
    if (h > (k == 0 ? 0.985 : 0.993)) {
      vec3 c = fract(g) - 0.5;
      float s = exp(-dot(c, c) * (k == 0 ? 60.0 : 30.0));
      vec3 tint = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.85, 0.65), hash3(id + 7.0));
      col += tint * s * (k == 0 ? 1.6 : 3.0);
    }
  }
  float band = exp(-pow(d.y * 3.2 + 0.4 * d.x, 2.0)) * (0.35 + 0.65 * fbm(d.xz * 6.0));
  col += vec3(0.35, 0.32, 0.45) * band * 0.10;
  return col;
}

// Disc emission at radius r, azimuth phi; v = ray direction at the hit
vec4 disk(vec3 hit, vec3 v) {
  float r = length(hit.xz);
  if (r < DISK_IN || r > DISK_OUT) return vec4(0.0);
  float phi = atan(hit.z, hit.x);

  // Keplerian shear: angular speed ∝ r^-3/2, so the texture winds in time
  float omega = 1.0 / pow(r, 1.5);
  float swirl = phi - uTime * omega * 2.2;
  vec2 q = vec2(swirl * 3.0, log(r) * 7.0);
  float n = fbm(q) * 0.75 + fbm(q * 3.1 + 4.0) * 0.35;
  float lanes = 0.82 + 0.18 * sin(log(r) * 18.0 + n * 6.0);

  // Thin-disc temperature profile T ∝ r^-3/4 (Shakura–Sunyaev, zero-torque edge)
  float x = DISK_IN / r;
  float T = pow(x, 0.75) * pow(max(1.0 - sqrt(x), 0.0), 0.25) * 2.2;

  // Orbital speed (Schwarzschild, M = 1/2): beta = sqrt(M / (r − 2M))
  float beta = clamp(sqrt(0.5 / (r - 1.0)), 0.0, 0.95);
  float gam = 1.0 / sqrt(1.0 - beta * beta);
  vec3 vel = normalize(vec3(-hit.z, 0.0, hit.x));          // counter-clockwise
  float cosA = dot(vel, -normalize(v));                   // toward the camera
  float D = 1.0 / (gam * (1.0 - beta * cosA));            // Doppler factor
  float grav = sqrt(max(1.0 - 1.0 / r, 0.0));             // gravitational redshift
  float g = D * grav;

  float I = T * pow(g, 4.0) * (0.25 + 1.0 * n) * lanes;
  // Colour: hotter (bluer-white) where g is high, redder where low
  float temp = T * g;
  vec3 c = mix(vec3(0.9, 0.18, 0.02), vec3(1.0, 0.55, 0.18), smoothstep(0.1, 0.55, temp));
  c = mix(c, vec3(1.0, 0.86, 0.62), smoothstep(0.55, 1.1, temp));
  c = mix(c, vec3(0.85, 0.92, 1.0), smoothstep(1.1, 1.8, temp));
  float edge = smoothstep(DISK_IN, DISK_IN + 0.25, r) * (1.0 - smoothstep(DISK_OUT - 3.0, DISK_OUT, r));
  float alpha = clamp(I * 1.2 * edge, 0.0, 0.95);
  return vec4(c * I * 0.85 * edge, alpha);
}

void main() {
  vec4 view = uInvProj * vec4(vNdc, 1.0, 1.0);
  view /= view.w;
  vec3 dir = normalize((uCamWorld * vec4(view.xyz, 0.0)).xyz);

  vec3 p = uCamPos / uRs;
  vec3 v = dir;
  vec3 hvec = cross(p, v);
  float h2 = dot(hvec, hvec);

  vec3 col = vec3(0.0);
  float trans = 1.0;            // remaining transmittance through the disc
  bool captured = false;

  for (int i = 0; i < 600; i++) {
    if (float(i) >= uSteps) break;
    float r2 = dot(p, p);
    float r = sqrt(r2);
    if (r < 1.0) { captured = true; break; }
    if (r > 60.0 && dot(p, v) > 0.0) break;

    // Adaptive step: small near the hole, large far away
    float dt = clamp(0.06 * r, 0.025, 1.4);
    vec3 acc = -1.5 * h2 * p / (r2 * r2 * r);
    vec3 pNew = p + v * dt + 0.5 * acc * dt * dt;
    vec3 vNew = v + acc * dt;

    // Disc plane crossing (y = 0)
    if (p.y * pNew.y < 0.0) {
      float t = p.y / (p.y - pNew.y);
      vec3 hit = mix(p, pNew, t);
      vec4 dsk = disk(hit, v);
      col += trans * dsk.rgb;
      trans *= 1.0 - dsk.a;
      if (trans < 0.02) break;
    }
    p = pNew;
    v = normalize(vNew);
  }

  if (!captured && trans > 0.02) col += trans * starfield(v);
  gl_FragColor = vec4(col, 1.0);
}
`
