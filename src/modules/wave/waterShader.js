// Shared water shading for the ripple tank and the double-slit tank.
// The vertex stage supplies a world normal, the height, and a "focus" term
// (−∇²h, positive where the surface is curved like a lens). The fragment stage
// combines: water tint, the tank floor seen through the surface (offset by
// refraction), caustic light where crests focus it, a fresnel sky reflection,
// and a sun highlight.
export const WATER_FRAG = /* glsl */`
  varying vec3  vN;
  varying vec3  vWorld;
  varying float vH;
  varying float vFocus;
  vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
  void main() {
    vec3 N = normalize(vN);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(cameraPosition - vWorld);

    // Floor seen through the water, displaced by refraction
    vec2 fuv = vWorld.xz + N.xz * 0.9;
    vec2 g = abs(fract(fuv / 0.5 + 0.5) - 0.5) * 0.5 / fwidth(fuv);
    float grid = 1.0 - min(min(g.x, g.y), 1.0);
    vec3 col = lin(vec3(0.02, 0.10, 0.15)) + lin(vec3(0.10, 0.22, 0.28)) * grid * 0.35;

    // Caustics: light focused under crests (curvature acting as a lens)
    float c = clamp(vFocus, 0.0, 1.0);
    col += lin(vec3(0.55, 0.92, 1.0)) * pow(c, 1.4) * 0.9;
    // Crests lighter, troughs darker, so the wave pattern reads at a glance
    col += lin(vec3(0.05, 0.35, 0.50)) * clamp(vH * 2.5, 0.0, 1.0);
    col *= 1.0 + clamp(vH * 2.0, -0.6, 0.0);

    // Sky reflection (fresnel) and the sun's highlight
    vec3 R = reflect(-V, N);
    vec3 sky = mix(lin(vec3(0.04, 0.06, 0.10)), lin(vec3(0.35, 0.50, 0.70)), clamp(R.y, 0.0, 1.0));
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    col = mix(col, sky, fres * 0.8);
    vec3 L = normalize(vec3(0.4, 1.0, 0.3));
    col += vec3(1.0, 0.97, 0.9) * pow(max(dot(N, normalize(L + V)), 0.0), 120.0) * 0.6;

    gl_FragColor = vec4(col, 1.0);
  }
`
