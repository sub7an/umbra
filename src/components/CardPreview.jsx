import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Mini-scene: Physics Sandbox ───────────────────────────────────────────────
function PreviewPhysicsSandbox() {
  const ref = useRef()
  const N = 180
  const pos = useMemo(() => {
    const a = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const r = 0.3 + Math.random() * 0.85
      const t = Math.random() * Math.PI * 2
      a[i * 3]     = Math.cos(t) * r
      a[i * 3 + 1] = (Math.random() - 0.5) * 0.3
      a[i * 3 + 2] = Math.sin(t) * r
    }
    return a
  }, [])
  const velRef = useRef(Array.from({ length: N }, (_, i) => ({
    angle: (i / N) * Math.PI * 2,
    r: 0.3 + Math.random() * 0.85,
    speed: 0.4 + Math.random() * 0.6,
  })))

  useFrame((_, dt) => {
    if (!ref.current) return
    const attr = ref.current.geometry.attributes.position
    for (let i = 0; i < N; i++) {
      const v = velRef.current[i]
      v.angle += dt * v.speed * (1.2 / v.r)
      attr.setX(i, Math.cos(v.angle) * v.r)
      attr.setZ(i, Math.sin(v.angle) * v.r)
    }
    attr.needsUpdate = true
  })

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [pos])

  return (
    <group>
      <points ref={ref} geometry={geo}>
        <pointsMaterial size={0.045} color="#84cc16" transparent opacity={0.8}
          blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>
      <mesh>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshBasicMaterial color="#84cc16" />
      </mesh>
      <pointLight color="#84cc16" intensity={1.2} distance={3} />
    </group>
  )
}

// ── Mini-scene: Wave Mechanics ─────────────────────────────────────────────────
const WAVE_NX = 40, WAVE_NZ = 40

const WAVE_VERT = `
  varying float vH;
  void main() { vH = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }
`
const WAVE_FRAG = `
  varying float vH;
  void main() {
    float t = clamp(vH * 1.4 + 0.5, 0., 1.);
    vec3 d = vec3(0.01,0.04,0.18); vec3 m = vec3(0.05,0.52,0.90); vec3 p = vec3(0.82,0.97,1.00);
    vec3 c = t < 0.5 ? mix(d,m,t*2.) : mix(m,p,(t-.5)*2.);
    gl_FragColor = vec4(c, 0.9);
  }
`

function PreviewWave() {
  const meshRef = useRef()
  const tRef = useRef(0)

  const geo = useMemo(() => {
    const pos = new Float32Array(WAVE_NX * WAVE_NZ * 3)
    for (let j = 0; j < WAVE_NZ; j++)
      for (let i = 0; i < WAVE_NX; i++) {
        const k = (j * WAVE_NX + i) * 3
        pos[k]     = (i / (WAVE_NX - 1) - 0.5) * 2.2
        pos[k + 1] = 0
        pos[k + 2] = (j / (WAVE_NZ - 1) - 0.5) * 2.2
      }
    const idx = new Uint32Array((WAVE_NX - 1) * (WAVE_NZ - 1) * 6)
    let p = 0
    for (let j = 0; j < WAVE_NZ - 1; j++)
      for (let i = 0; i < WAVE_NX - 1; i++) {
        const a = j * WAVE_NX + i, b = a+1, c = a+WAVE_NX, d = c+1
        idx[p++]=a; idx[p++]=c; idx[p++]=b; idx[p++]=b; idx[p++]=c; idx[p++]=d
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setIndex(new THREE.BufferAttribute(idx, 1))
    return g
  }, [])

  useFrame((_, dt) => {
    tRef.current += dt
    const t = tRef.current
    if (!meshRef.current) return
    const attr = meshRef.current.geometry.attributes.position
    for (let j = 0; j < WAVE_NZ; j++)
      for (let i = 0; i < WAVE_NX; i++) {
        const x = (i / (WAVE_NX - 1) - 0.5) * 2.2
        const z = (j / (WAVE_NZ - 1) - 0.5) * 2.2
        const r = Math.sqrt(x*x + z*z)
        attr.setY(j * WAVE_NX + i, Math.sin(r * 5 - t * 2.8) * 0.18 / (1 + r * 1.5))
      }
    attr.needsUpdate = true
  })

  return (
    <group rotation={[-0.3, 0.4, 0]}>
      <mesh ref={meshRef} geometry={geo} frustumCulled={false}>
        <shaderMaterial vertexShader={WAVE_VERT} fragmentShader={WAVE_FRAG}
          side={THREE.DoubleSide} transparent />
      </mesh>
      <pointLight position={[0, 1.5, 0]} color="#22d3ee" intensity={1.5} distance={5} />
    </group>
  )
}

// ── Mini-scene: Optics ────────────────────────────────────────────────────────
function PreviewOptics() {
  const groupRef = useRef()
  const RAY_COLORS = useMemo(() => ['#ff2020','#ff6600','#ffee00','#44ff00','#00ccff','#4444ff','#9900ff'], [])

  useFrame((_, dt) => {
    if (groupRef.current) groupRef.current.rotation.y += dt * 0.5
  })

  const prismGeo = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(0, 0.55)
    shape.lineTo(-0.48, -0.28)
    shape.lineTo(0.48, -0.28)
    shape.closePath()
    return new THREE.ExtrudeGeometry(shape, { depth: 0.28, bevelEnabled: false })
  }, [])

  return (
    <group ref={groupRef}>
      <mesh geometry={prismGeo} position={[0, 0, -0.14]}>
        <meshStandardMaterial color="#88ccff" transparent opacity={0.35}
          roughness={0.05} metalness={0.1} side={THREE.DoubleSide} />
      </mesh>
      {RAY_COLORS.map((col, i) => {
        const t = (i / (RAY_COLORS.length - 1)) - 0.5
        const angle = t * 0.65
        const endX = -1.2 + t * 0.3
        const endY = -0.28 + t * 0.9
        const pts = [new THREE.Vector3(-1.1, 0.05, 0), new THREE.Vector3(0, 0.05, 0),
          new THREE.Vector3(endX, endY, 0)]
        const geo = new THREE.BufferGeometry().setFromPoints(pts)
        return (
          <line key={i} geometry={geo}>
            <lineBasicMaterial color={col} transparent opacity={0.85} />
          </line>
        )
      })}
      <pointLight position={[0, 0, 0.5]} color="#fcd34d" intensity={1.5} distance={4} />
    </group>
  )
}

// ── Mini-scene: Special Relativity ─────────────────────────────────────────────
function PreviewRelativity() {
  const groupRef = useRef()
  const N = 32

  const conePts = useMemo(() => {
    const pts = []
    const h = 1.0
    for (let ring = 0; ring <= 8; ring++) {
      const y = (ring / 8) * h
      const r = y
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2
        pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r))
      }
    }
    return pts
  }, [])

  useFrame((_, dt) => {
    if (groupRef.current) groupRef.current.rotation.y += dt * 0.3
  })

  return (
    <group ref={groupRef}>
      {/* Future cone */}
      {[...Array(9)].map((_, ri) => {
        const y = (ri / 8) * 1.0
        const r = y
        const pts = Array.from({ length: N + 1 }, (_, i) => {
          const a = (i / N) * Math.PI * 2
          return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)
        })
        const geo = new THREE.BufferGeometry().setFromPoints(pts)
        return (
          <line key={`f${ri}`} geometry={geo}>
            <lineBasicMaterial color="#00e5c4" transparent opacity={0.25 + ri * 0.05} />
          </line>
        )
      })}
      {/* Past cone (inverted) */}
      {[...Array(9)].map((_, ri) => {
        const y = -(ri / 8) * 1.0
        const r = Math.abs(y)
        const pts = Array.from({ length: N + 1 }, (_, i) => {
          const a = (i / N) * Math.PI * 2
          return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)
        })
        const geo = new THREE.BufferGeometry().setFromPoints(pts)
        return (
          <line key={`p${ri}`} geometry={geo}>
            <lineBasicMaterial color="#00e5c4" transparent opacity={0.12 + ri * 0.03} />
          </line>
        )
      })}
      {/* Time axis */}
      <line geometry={new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0,-1.1,0), new THREE.Vector3(0,1.1,0)])}>
        <lineBasicMaterial color="#00e5c4" transparent opacity={0.6} />
      </line>
      <pointLight position={[0, 0, 0]} color="#00e5c4" intensity={1} distance={3} />
    </group>
  )
}

// ── Mini-scene: Quantum Mechanics ─────────────────────────────────────────────
const QM_VERT = `
  uniform vec3 uDir; varying vec3 vColor;
  void main() {
    float d = dot(normalize(position), uDir);
    float accept = (1. + d) * .5;
    float h = fract(sin(dot(position*43., vec3(127.1,311.7,74.4))) * 43758.5);
    vColor = h < accept ? vec3(0.,0.898,0.769) * mix(.4,1.,accept) : vec3(0.);
    vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = 2.5; gl_Position = projectionMatrix * mv;
  }
`
const QM_FRAG = `
  varying vec3 vColor; void main() {
    if (length(vColor) < .01) discard;
    float d = length(gl_PointCoord-.5); if(d>.5) discard;
    gl_FragColor = vec4(vColor, smoothstep(.5,.0,d));
  }
`

function PreviewQuantum() {
  const groupRef = useRef()
  const matRef   = useRef()
  const N = 800
  const dirRef = useRef(new THREE.Vector3(0, 1, 0))

  const geo = useMemo(() => {
    const pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const ct = 2 * Math.random() - 1
      const st = Math.sqrt(1 - ct * ct)
      const phi = Math.random() * Math.PI * 2
      pos[i*3] = st * Math.cos(phi)
      pos[i*3+1] = st * Math.sin(phi)
      pos[i*3+2] = ct
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [])

  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: QM_VERT, fragmentShader: QM_FRAG,
    uniforms: { uDir: { value: new THREE.Vector3(0, 1, 0) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }), [])

  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])

  useFrame(({ clock }) => {
    if (groupRef.current) groupRef.current.rotation.y += 0.008
    const t = clock.getElapsedTime()
    const theta = 0.8 + Math.sin(t * 0.4) * 0.5
    const phi = t * 0.7
    dirRef.current.set(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi))
    mat.uniforms.uDir.value.copy(dirRef.current)
  })

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[1, 20, 16]} />
        <meshBasicMaterial color="#0c2530" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
      <points geometry={geo} material={mat} />
      {/* Wireframe great circles */}
      {[0, 1, 2].map((k) => {
        const pts = Array.from({ length: 65 }, (_, i) => {
          const a = (i / 64) * Math.PI * 2
          const c = Math.cos(a), s = Math.sin(a)
          return k === 0 ? new THREE.Vector3(c, 0, s) : k === 1 ? new THREE.Vector3(c, s, 0) : new THREE.Vector3(0, c, s)
        })
        return (
          <line key={k} geometry={new THREE.BufferGeometry().setFromPoints(pts)}>
            <lineBasicMaterial color="#1a3d50" transparent opacity={0.4} />
          </line>
        )
      })}
      <pointLight color="#e040fb" intensity={0.8} distance={3} />
    </group>
  )
}

// ── Mini-scene: Frontier Physics ──────────────────────────────────────────────
function PreviewFrontier() {
  const groupRef = useRef()
  const N = 120
  const pts = useMemo(() => {
    const pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const r = 0.18 + (i / N) * 1.05
      const spread = 0.15
      const a = Math.random() * Math.PI * 2
      pos[i*3]   = Math.cos(a) * r + (Math.random() - 0.5) * spread
      pos[i*3+1] = (Math.random() - 0.5) * 0.12
      pos[i*3+2] = Math.sin(a) * r + (Math.random() - 0.5) * spread
    }
    return pos
  }, [])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3))
    return g
  }, [pts])

  // Rotation curve line (flat)
  const curvePts = useMemo(() => {
    const p = []
    for (let i = 0; i <= 30; i++) {
      const r = 0.18 + (i / 30) * 0.9
      p.push(new THREE.Vector3(r, 0.55, 0))
    }
    return p
  }, [])
  const curveGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints(curvePts), [curvePts])

  useFrame((_, dt) => {
    if (groupRef.current) groupRef.current.rotation.y += dt * 0.25
  })

  return (
    <group ref={groupRef}>
      <points geometry={geo}>
        <pointsMaterial size={0.055} color="#e040fb" transparent opacity={0.75}
          blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>
      <line geometry={curveGeo}>
        <lineBasicMaterial color="#f472b6" transparent opacity={0.6} />
      </line>
      <pointLight color="#e040fb" intensity={0.8} distance={4} />
    </group>
  )
}

// ── Mini-scene: Dynamical Systems (Lorenz) ─────────────────────────────────────
const LORENZ_VERT = `
  attribute float aIdx; uniform float uN; varying vec3 vC;
  void main() {
    float t = aIdx / uN;
    vC = mix(vec3(0.,.8,.2), vec3(.1,.9,.5), t);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
  }
`
const LORENZ_FRAG = `varying vec3 vC; void main() { gl_FragColor = vec4(vC, 1.0); }`

function PreviewDynamical() {
  const lineRef = useRef()
  const matRef  = useRef()

  // Pre-integrate Lorenz attractor
  const { pos, idxArr, N } = useMemo(() => {
    const sigma = 10, rho = 28, beta = 8/3
    const dt = 0.008
    const SKIP = 300
    const N = 500
    let x = 0.1, y = 0, z = 20
    for (let i = 0; i < SKIP; i++) {
      const dx = sigma * (y - x)
      const dy = x * (rho - z) - y
      const dz = x * y - beta * z
      x += dx*dt; y += dy*dt; z += dz*dt
    }
    const pos = new Float32Array(N * 3)
    const idxArr = new Float32Array(N)
    const sc = 0.045
    for (let i = 0; i < N; i++) {
      const dx = sigma * (y - x), dy = x*(rho-z)-y, dz = x*y-beta*z
      x += dx*dt; y += dy*dt; z += dz*dt
      pos[i*3] = x*sc; pos[i*3+1] = (z - 25)*sc; pos[i*3+2] = y*sc
      idxArr[i] = i
    }
    return { pos, idxArr, N }
  }, [])

  const geo = useMemo(() => {
    const pts = []
    for (let i = 0; i < N; i++) pts.push(new THREE.Vector3(pos[i*3], pos[i*3+1], pos[i*3+2]))
    const g = new THREE.BufferGeometry().setFromPoints(pts)
    g.setAttribute('aIdx', new THREE.BufferAttribute(idxArr, 1))
    return g
  }, [pos, idxArr, N])

  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: LORENZ_VERT, fragmentShader: LORENZ_FRAG,
    uniforms: { uN: { value: N } },
  }), [N])

  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])

  const groupRef = useRef()
  useFrame((_, dt) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += dt * 0.3
      groupRef.current.rotation.x += dt * 0.08
    }
  })

  return (
    <group ref={groupRef}>
      <line ref={lineRef} geometry={geo} material={mat} />
      <pointLight color="#10b981" intensity={0.8} distance={5} />
    </group>
  )
}

// ── Mini-scene: Electromagnetism ──────────────────────────────────────────────
function PreviewEM() {
  const groupRef = useRef()
  const LINES = 10

  const fieldLines = useMemo(() => {
    const result = []
    for (let k = 0; k < LINES; k++) {
      const angle = (k / LINES) * Math.PI * 2
      const pts = []
      let x = Math.cos(angle) * 0.12, y = Math.sin(angle) * 0.12
      for (let s = 0; s < 60; s++) {
        pts.push(new THREE.Vector3(x, y, 0))
        const d2 = x*x + y*y, d = Math.sqrt(d2)
        const Bx = 2*x*y / (d2*d2 + 0.0001)
        const By = (y*y - x*x) / (d2*d2 + 0.0001)
        const len = Math.sqrt(Bx*Bx + By*By) + 0.001
        x += (Bx/len) * 0.04; y += (By/len) * 0.04
        if (x*x + y*y > 4) break
      }
      result.push(pts)
    }
    return result
  }, [])

  useFrame((_, dt) => {
    if (groupRef.current) groupRef.current.rotation.z += dt * 0.2
  })

  return (
    <group ref={groupRef}>
      {fieldLines.map((pts, i) => (
        <line key={i} geometry={new THREE.BufferGeometry().setFromPoints(pts)}>
          <lineBasicMaterial color="#a855f7" transparent opacity={0.55} />
        </line>
      ))}
      <mesh>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color="#a855f7" />
      </mesh>
      <mesh position={[0, -0.4, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color="#60a0ff" />
      </mesh>
      <pointLight color="#a855f7" intensity={1} distance={4} />
    </group>
  )
}

// ── Mini-scene: General Relativity ────────────────────────────────────────────
const GR_NX = 24, GR_NZ = 24

const GR_VERT = `
  varying float vH;
  void main() { vH = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }
`
const GR_FRAG = `
  varying float vH; void main() {
    float t = clamp(-vH * 1.4 + 0.5, 0., 1.);
    vec3 a = vec3(.55,.18,.04); vec3 b = vec3(.25,.07,.01);
    gl_FragColor = vec4(mix(b,a,t), 0.85);
  }
`

function PreviewGR() {
  const meshRef  = useRef()
  const groupRef = useRef()

  const geo = useMemo(() => {
    const pos = new Float32Array(GR_NX * GR_NZ * 3)
    const idx = new Uint32Array((GR_NX-1)*(GR_NZ-1)*6)
    for (let j = 0; j < GR_NZ; j++)
      for (let i = 0; i < GR_NX; i++) {
        const k = (j*GR_NX+i)*3
        const x = (i/(GR_NX-1)-0.5)*2.2
        const z = (j/(GR_NZ-1)-0.5)*2.2
        const r = Math.sqrt(x*x+z*z)
        pos[k]=x; pos[k+1] = -0.45/(r+0.35); pos[k+2]=z
      }
    let p=0
    for (let j=0;j<GR_NZ-1;j++) for (let i=0;i<GR_NX-1;i++) {
      const a=j*GR_NX+i,b=a+1,c=a+GR_NX,d=c+1
      idx[p++]=a;idx[p++]=c;idx[p++]=b;idx[p++]=b;idx[p++]=c;idx[p++]=d
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos,3))
    g.setIndex(new THREE.BufferAttribute(idx,1))
    return g
  }, [])

  useFrame((_, dt) => {
    if (groupRef.current) groupRef.current.rotation.y += dt * 0.3
  })

  return (
    <group ref={groupRef} rotation={[-0.5, 0, 0]}>
      <mesh ref={meshRef} geometry={geo} frustumCulled={false}>
        <shaderMaterial vertexShader={GR_VERT} fragmentShader={GR_FRAG}
          side={THREE.DoubleSide} transparent />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshBasicMaterial color="#fb923c" />
      </mesh>
      <pointLight position={[0, 0.5, 0]} color="#fb923c" intensity={1.2} distance={4} />
    </group>
  )
}

// ── Mini-scene: Thermodynamics ────────────────────────────────────────────────
function PreviewThermo() {
  const N = 80
  const particleRef = useRef()
  const velocities = useRef(Array.from({ length: N }, () => ({
    vx: (Math.random() - 0.5) * 1.8,
    vy: (Math.random() - 0.5) * 1.8,
    vz: (Math.random() - 0.5) * 1.8,
  })))

  const pos = useMemo(() => {
    const a = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      a[i*3]   = (Math.random() - 0.5) * 1.6
      a[i*3+1] = (Math.random() - 0.5) * 1.6
      a[i*3+2] = (Math.random() - 0.5) * 1.6
    }
    return a
  }, [])

  const SPEED_COLORS = useMemo(() => {
    const c = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const v = velocities.current[i]
      const spd = Math.sqrt(v.vx*v.vx + v.vy*v.vy + v.vz*v.vz)
      const t = Math.min(spd / 2, 1)
      c[i*3]   = t
      c[i*3+1] = 0.3 * (1-t)
      c[i*3+2] = 1 - t
    }
    return c
  }, [])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(SPEED_COLORS, 3))
    return g
  }, [pos, SPEED_COLORS])

  const BOUND = 0.9

  useFrame((_, dt) => {
    if (!particleRef.current) return
    const attr = particleRef.current.geometry.attributes.position
    for (let i = 0; i < N; i++) {
      const v = velocities.current[i]
      const x = attr.getX(i) + v.vx * dt
      const y = attr.getY(i) + v.vy * dt
      const z = attr.getZ(i) + v.vz * dt
      if (Math.abs(x) > BOUND) v.vx = -v.vx
      if (Math.abs(y) > BOUND) v.vy = -v.vy
      if (Math.abs(z) > BOUND) v.vz = -v.vz
      attr.setX(i, Math.max(-BOUND, Math.min(BOUND, x)))
      attr.setY(i, Math.max(-BOUND, Math.min(BOUND, y)))
      attr.setZ(i, Math.max(-BOUND, Math.min(BOUND, z)))
    }
    attr.needsUpdate = true
  })

  return (
    <group>
      <points ref={particleRef} geometry={geo}>
        <pointsMaterial size={0.06} vertexColors transparent opacity={0.9}
          blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>
      {/* Box wireframe */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(1.8, 1.8, 1.8)]} />
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.2} />
      </lineSegments>
      <pointLight color="#38bdf8" intensity={0.8} distance={4} />
    </group>
  )
}

// ── Mini-scene: Fluid Dynamics ────────────────────────────────────────────────
function PreviewFluid() {
  const groupRef = useRef()
  const N_LINES = 14

  const streamPts = useMemo(() => {
    const lines = []
    for (let k = 0; k < N_LINES; k++) {
      const y0 = -0.8 + (k / (N_LINES - 1)) * 1.6
      const pts = []
      let x = -1.2, y = y0
      for (let s = 0; s < 80; s++) {
        pts.push(new THREE.Vector3(x, y, 0))
        // Potential flow around cylinder (radius 0.25)
        const r2 = x*x + y*y
        const R2 = 0.25*0.25
        const ux = 1 + R2*(y*y - x*x)/(r2*r2 + 0.001)
        const uy =    -R2*(2*x*y)     /(r2*r2 + 0.001)
        const spd = Math.sqrt(ux*ux + uy*uy) + 0.001
        x += (ux/spd) * 0.04
        y += (uy/spd) * 0.04
        if (x > 1.2) break
      }
      lines.push(pts)
    }
    return lines
  }, [])

  useFrame((_, dt) => {
    if (groupRef.current) groupRef.current.rotation.y += dt * 0.15
  })

  return (
    <group ref={groupRef}>
      {streamPts.map((pts, i) => (
        <line key={i} geometry={new THREE.BufferGeometry().setFromPoints(pts)}>
          <lineBasicMaterial color="#2dd4bf" transparent opacity={0.5 + (i % 3) * 0.1} />
        </line>
      ))}
      <mesh>
        <circleGeometry args={[0.25, 24]} />
        <meshBasicMaterial color="#0e3a38" />
      </mesh>
      <pointLight color="#2dd4bf" intensity={0.9} distance={4} />
    </group>
  )
}

// ── Scene switcher inside a persistent Canvas ─────────────────────────────────

function ActiveScene({ moduleId }) {
  switch (moduleId) {
    case 'physics-sandbox':    return <PreviewPhysicsSandbox />
    case 'wave-mechanics':     return <PreviewWave />
    case 'optics':             return <PreviewOptics />
    case 'special-relativity': return <PreviewRelativity />
    case 'quantum-mechanics':  return <PreviewQuantum />
    case 'frontier-physics':   return <PreviewFrontier />
    case 'dynamical-systems':  return <PreviewDynamical />
    case 'electromagnetism':   return <PreviewEM />
    case 'general-relativity': return <PreviewGR />
    case 'thermodynamics':     return <PreviewThermo />
    case 'fluid-dynamics':     return <PreviewFluid />
    default: return null
  }
}

const CAMERA_FOR = {
  'physics-sandbox':    [0, 1.6, 0.5],
  'wave-mechanics':     [0, 1.5, 2.2],
  'optics':             [0, 0.5, 3],
  'special-relativity': [0.8, 0.5, 2.5],
  'quantum-mechanics':  [0, 0.5, 2.8],
  'frontier-physics':   [0, 1.2, 2.8],
  'dynamical-systems':  [0, 0.5, 3.2],
  'electromagnetism':   [0, 0.5, 2.8],
  'general-relativity': [0.5, 1.0, 2.8],
  'thermodynamics':     [0.8, 0.8, 2.8],
  'fluid-dynamics':     [0, 0.3, 2.8],
}

// ── Floating preview overlay ──────────────────────────────────────────────────
// One Canvas kept mounted; opacity fade hides/shows it to avoid WebGL context churn.

export default function CardPreview({ moduleId, cardEl }) {
  // Track last valid cardEl so position is preserved during fade-out
  const lastCardRef = useRef(null)
  const lastModRef  = useRef(null)
  if (cardEl)   lastCardRef.current = cardEl
  if (moduleId) lastModRef.current  = moduleId

  const visible = !!(moduleId && cardEl)
  const displayEl  = lastCardRef.current
  const displayMod = lastModRef.current

  if (!displayEl || !displayMod) return null

  const rect    = displayEl.getBoundingClientRect()
  const camPos  = CAMERA_FOR[displayMod] || [0, 1, 3]

  return (
    <div
      style={{
        position: 'fixed',
        left:   rect.left,
        top:    rect.top,
        width:  rect.width,
        height: rect.height,
        pointerEvents: 'none',
        zIndex: 50,
        borderRadius: 2,
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.18s ease',
      }}
    >
      <Canvas
        camera={{ position: camPos, fov: 45 }}
        gl={{ antialias: false, alpha: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <ambientLight intensity={0.08} />
        <ActiveScene moduleId={displayMod} />
      </Canvas>
    </div>
  )
}
