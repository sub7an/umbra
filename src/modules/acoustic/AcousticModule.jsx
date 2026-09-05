import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import SceneWrapper from '../../components/SceneWrapper'
import InfoPanel from '../../components/InfoPanel'
import useModuleStore from '../../store/useModuleStore'

const ACCENT = '#a855f7'

const VIEWS = [
  { id: 'cymatics',  label: 'CYMATICS' },
  { id: 'harmonics', label: 'HARMONICS' },
  { id: 'lissajous', label: 'LISSAJOUS' },
]
const CAMERA = {
  cymatics:  [0, 4.5, 3.2],
  harmonics: [0, 0, 7.5],
  lissajous: [0.8, 0.4, 5.5],
}

// Chladni modes — f_mn = 100·√(m²+n²)
const CHLADNI_MODES = [
  { m:1, n:1, label:'(1,1)', freq:141, note:'D3'  },
  { m:1, n:2, label:'(1,2)', freq:224, note:'A3'  },
  { m:2, n:2, label:'(2,2)', freq:283, note:'C#4' },
  { m:1, n:3, label:'(1,3)', freq:316, note:'Eb4' },
  { m:2, n:3, label:'(2,3)', freq:361, note:'F#4' },
  { m:3, n:3, label:'(3,3)', freq:424, note:'Ab4' },
  { m:2, n:4, label:'(2,4)', freq:447, note:'A4'  },
  { m:3, n:4, label:'(3,4)', freq:500, note:'B4'  },
  { m:4, n:4, label:'(4,4)', freq:566, note:'Db5' },
  { m:3, n:5, label:'(3,5)', freq:583, note:'D5'  },
]

// Harmonics of C3 (130.8 Hz)
const C3 = 130.8
const HARMONIC_COLORS = ['#FF6B6B','#FFB347','#FFD166','#A8E063','#00D4FF','#6677FF','#BB66FF','#FF77BB']
const HARMONIC_NOTES  = ['C3','C4','G4','C5','E5','G5','Bb5','C6']

// Lissajous musical intervals
const LISSAJOUS_PRESETS = [
  { a:1, b:1, name:'Unison',         ratio:'1:1', color:'#00D4FF' },
  { a:1, b:2, name:'Octave',         ratio:'1:2', color:'#FFD166' },
  { a:2, b:3, name:'Perfect Fifth',  ratio:'2:3', color:'#A8E063' },
  { a:3, b:4, name:'Perfect Fourth', ratio:'3:4', color:'#FF6B6B' },
  { a:4, b:5, name:'Major Third',    ratio:'4:5', color:'#FF77BB' },
  { a:5, b:6, name:'Minor Third',    ratio:'5:6', color:'#BB66FF' },
  { a:3, b:5, name:'Major Sixth',    ratio:'3:5', color:'#FFB347' },
  { a:5, b:8, name:'Minor Sixth',    ratio:'5:8', color:'#6677FF' },
]

// ── Web Audio (module-level singleton) ────────────────────────────────────────
let _audioCtx = null
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (_audioCtx.state === 'suspended') _audioCtx.resume()
  return _audioCtx
}
function playTone(freq, duration = 1.2, type = 'sine', vol = 0.22) {
  const ctx  = getAudioCtx()
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = type
  osc.frequency.value = freq
  const t = ctx.currentTime
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(vol, t + 0.012)
  gain.gain.setValueAtTime(vol, t + duration * 0.3)
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
  osc.start(t)
  osc.stop(t + duration + 0.05)
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYMATICS SCENE
// ═══════════════════════════════════════════════════════════════════════════════
const N_PARTICLES = 2200

function CymaticsScene({ modeIdx, scatterToken }) {
  const meshRef = useRef()
  const posRef  = useRef()
  const velRef  = useRef()
  const dummy   = useMemo(() => new THREE.Object3D(), [])

  const scatter = useCallback(() => {
    if (!posRef.current) return
    for (let i = 0; i < N_PARTICLES; i++) {
      posRef.current[i*2]   = (Math.random() - 0.5) * 1.88
      posRef.current[i*2+1] = (Math.random() - 0.5) * 1.88
      velRef.current[i*2]   = (Math.random() - 0.5) * 0.04
      velRef.current[i*2+1] = (Math.random() - 0.5) * 0.04
    }
  }, [])

  useEffect(() => {
    posRef.current = new Float32Array(N_PARTICLES * 2)
    velRef.current = new Float32Array(N_PARTICLES * 2)
    scatter()
  }, [scatter])

  useEffect(() => { scatter() }, [scatterToken, scatter])

  useFrame((_, delta) => {
    if (!meshRef.current || !posRef.current) return
    const { m, n } = CHLADNI_MODES[modeIdx]
    const dt   = Math.min(delta, 0.033)
    const DAMP = 0.86, NOISE = 0.0009, FORCE = 0.055

    for (let i = 0; i < N_PARTICLES; i++) {
      let x = posRef.current[i*2], y = posRef.current[i*2+1]
      let vx = velRef.current[i*2], vy = velRef.current[i*2+1]
      const sinMX = Math.sin(m * Math.PI * x)
      const sinNY = Math.sin(n * Math.PI * y)
      const u     = sinMX * sinNY
      const sign  = u >= 0 ? 1 : -1
      const dudx  = m * Math.PI * Math.cos(m * Math.PI * x) * sinNY
      const dudy  = n * Math.PI * sinMX * Math.cos(n * Math.PI * y)
      vx = (vx - sign * dudx * FORCE * dt + (Math.random()-0.5)*NOISE) * DAMP
      vy = (vy - sign * dudy * FORCE * dt + (Math.random()-0.5)*NOISE) * DAMP
      x += vx; y += vy
      if (x < -0.97) { x = -0.97; vx =  Math.abs(vx) * 0.3 }
      if (x >  0.97) { x =  0.97; vx = -Math.abs(vx) * 0.3 }
      if (y < -0.97) { y = -0.97; vy =  Math.abs(vy) * 0.3 }
      if (y >  0.97) { y =  0.97; vy = -Math.abs(vy) * 0.3 }
      posRef.current[i*2]   = x;  posRef.current[i*2+1]  = y
      velRef.current[i*2]   = vx; velRef.current[i*2+1]  = vy
      dummy.position.set(x, 0.018, y)
      dummy.scale.setScalar(0.011)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <mesh rotation={[-Math.PI/2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.05, 2.05]} />
        <meshStandardMaterial color="#060c16" metalness={0.88} roughness={0.22} />
      </mesh>
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[2.08, 2.08]} />
        <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={0.10} transparent opacity={0.20} />
      </mesh>
      {[[0.95,0.95],[-0.95,0.95],[0.95,-0.95],[-0.95,-0.95]].map(([cx,cy],i) => (
        <mesh key={i} position={[cx, 0.05, cy]}>
          <cylinderGeometry args={[0.022, 0.022, 0.09, 8]} />
          <meshStandardMaterial color="#5a6a7a" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}
      <instancedMesh ref={meshRef} args={[undefined, undefined, N_PARTICLES]}>
        <sphereGeometry args={[1, 5, 5]} />
        <meshStandardMaterial color="#F5DEB3" emissive="#C8A060" emissiveIntensity={0.30} roughness={0.85} />
      </instancedMesh>
      <ambientLight intensity={0.25} color="#102030" />
      <directionalLight position={[1, 5, 2]} intensity={1.6} castShadow />
      <pointLight position={[0, 3.5, 0]} intensity={0.8} color="#d0e8ff" />
      <pointLight position={[-2, 1, 2]} intensity={0.4} color={ACCENT} />
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// HARMONICS SCENE — clickable/pluckable strings
// ═══════════════════════════════════════════════════════════════════════════════
const H_PTS = 240

function HarmonicsScene({ focusN, onPluck }) {
  const pluckRef   = useRef(new Array(8).fill(null))
  const [hoveredN, setHoveredN] = useState(null)

  const geos = useMemo(() => Array.from({ length: 8 }, () => {
    const pos = new Float32Array((H_PTS + 1) * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return geo
  }), [])
  useEffect(() => () => geos.forEach(g => g.dispose()), [geos])

  const axisGeos = useMemo(() => Array.from({ length: 8 }, (_, i) => {
    const n = i + 1, yOff = -(n - 4.5) * 0.66
    const pos = new Float32Array([-1.4, yOff, 0, 1.4, yOff, 0])
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return geo
  }), [])
  useEffect(() => () => axisGeos.forEach(g => g.dispose()), [axisGeos])

  const handleClick = useCallback((n) => {
    pluckRef.current[n-1] = performance.now()
    onPluck(n)
  }, [onPluck])

  useFrame(({ clock }) => {
    const t   = clock.getElapsedTime()
    const now = performance.now()
    for (let n = 1; n <= 8; n++) {
      const geo   = geos[n-1]
      const pos   = geo.attributes.position.array
      const yOff  = -(n - 4.5) * 0.66
      const omega = n * 1.8

      const pluckTime = pluckRef.current[n-1]
      const pluckAge  = pluckTime ? (now - pluckTime) / 1000 : null
      if (pluckAge !== null && pluckAge > 3.5) pluckRef.current[n-1] = null

      const isPlucked = pluckAge !== null && pluckAge <= 3.5
      const pluckGain = isPlucked ? Math.exp(-pluckAge * 1.8) : 0
      const baseGain  = (focusN === null || focusN === n) ? 0.22 : 0.05
      const amp = baseGain + pluckGain * 0.55

      for (let p = 0; p <= H_PTS; p++) {
        const xN = p / H_PTS
        const x  = xN * 2.8 - 1.4
        const dy = Math.sin(n * Math.PI * xN) * Math.cos(omega * t) * amp
        pos[p*3]   = x
        pos[p*3+1] = yOff + dy
        pos[p*3+2] = 0
      }
      geo.attributes.position.needsUpdate = true
    }
  })

  return (
    <group>
      {axisGeos.map((geo, i) => (
        <line key={`ax-${i}`} geometry={geo}>
          <lineBasicMaterial color="#0d1e2e" transparent opacity={0.7} />
        </line>
      ))}
      {geos.map((geo, i) => {
        const n        = i + 1
        const color    = HARMONIC_COLORS[i]
        const isActive = focusN === null || focusN === n
        const isHover  = hoveredN === n
        const yOff     = -(n - 4.5) * 0.66
        return (
          <group key={n}>
            <line geometry={geo}>
              <lineBasicMaterial color={color} transparent opacity={isActive ? (isHover ? 1.0 : 0.75) : 0.06} />
            </line>
            {[-1.4, 1.4].map(ex => (
              <mesh key={ex} position={[ex, yOff, 0]}>
                <sphereGeometry args={[0.028, 8, 8]} />
                <meshBasicMaterial color={isActive ? color : '#1a2a3a'} />
              </mesh>
            ))}
            {/* Invisible clickable hit-zone */}
            <mesh
              position={[0, yOff, 0]}
              onClick={(e) => { e.stopPropagation(); handleClick(n) }}
              onPointerEnter={() => setHoveredN(n)}
              onPointerLeave={() => setHoveredN(null)}
            >
              <planeGeometry args={[2.8, 0.52]} />
              <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )
      })}
      <ambientLight intensity={0.6} />
      <pointLight position={[0, 2, 4]} intensity={0.8} color="#c0d8ff" />
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// LISSAJOUS SCENE
// ═══════════════════════════════════════════════════════════════════════════════
const LIS_TRAIL = 2000

function LissajousScene({ presetIdx, phase }) {
  const dotRef   = useRef()
  const trailGeo = useMemo(() => {
    const pos = new Float32Array(LIS_TRAIL * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return geo
  }, [])
  useEffect(() => () => trailGeo.dispose(), [trailGeo])
  useEffect(() => {
    trailGeo.attributes.position.array.fill(0)
    trailGeo.attributes.position.needsUpdate = true
  }, [presetIdx, trailGeo])

  useFrame(({ clock }) => {
    const t   = clock.getElapsedTime()
    const { a, b } = LISSAJOUS_PRESETS[presetIdx]
    const arr = trailGeo.attributes.position.array
    arr.copyWithin(3, 0, (LIS_TRAIL - 1) * 3)
    const px = Math.sin(a * t * 0.55) * 1.5
    const py = Math.sin(b * t * 0.55 + phase) * 1.5
    const pz = Math.sin((a + b) * t * 0.27) * 0.35
    arr[0] = px; arr[1] = py; arr[2] = pz
    trailGeo.attributes.position.needsUpdate = true
    if (dotRef.current) dotRef.current.position.set(px, py, pz)
  })

  const { color } = LISSAJOUS_PRESETS[presetIdx]
  return (
    <group>
      <line geometry={trailGeo}>
        <lineBasicMaterial color={color} transparent opacity={0.72} />
      </line>
      <mesh ref={dotRef}>
        <sphereGeometry args={[0.055, 14, 14]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <ambientLight intensity={0.3} />
      <pointLight position={[3, 3, 3]} intensity={1.2} color={color} />
      <pointLight position={[-3,-3, 2]} intensity={0.5} color="#3040a0" />
    </group>
  )
}

// ── InfoPanel data ─────────────────────────────────────────────────────────────
function buildEquations(view) {
  switch (view) {
    case 'cymatics': return {
      domain: 'ACOUSTIC PHYSICS · CHLADNI FIGURES',
      primaryEq: `u(x,y)=\\sin(m\\pi x)\\sin(n\\pi y)\\cos(\\omega_{mn}t)`,
      derivedEqs: [
        { label:'Eigenfreq.', eq:`f_{mn}=\\tfrac{c}{2L}\\sqrt{m^2+n^2}` },
        { label:'Force',      eq:`F=-\\operatorname{sgn}(u)\\nabla|u|`   },
      ],
    }
    case 'harmonics': return {
      domain: 'ACOUSTIC PHYSICS · STANDING WAVES',
      primaryEq: `y_n(x,t)=A\\sin\\!\\tfrac{n\\pi x}{L}\\cos(\\omega_n t)`,
      derivedEqs: [
        { label:'Harmonics', eq:`f_n = n\\,f_0 = \\tfrac{nv}{2L}` },
        { label:'Nodes',     eq:`x_k = \\tfrac{kL}{n},\\;k=0\\ldots n` },
      ],
    }
    case 'lissajous': return {
      domain: 'ACOUSTIC PHYSICS · LISSAJOUS',
      primaryEq: `x=\\sin(at),\\quad y=\\sin(bt+\\delta)`,
      derivedEqs: [
        { label:'Closed if', eq:`a/b\\in\\mathbb{Q}` },
        { label:'Phase',     eq:`\\delta\\in[0,2\\pi]\\text{ morphs figure}` },
      ],
    }
    default: return { domain:'', primaryEq:'', derivedEqs:[] }
  }
}
function buildExplanation(view) {
  switch (view) {
    case 'cymatics':
      return 'Tap the tone pads to vibrate the plate at that mode\'s resonant frequency — and hear it. Sand settles on nodal lines where vibration is zero. Enable MIC to let your voice drive the pattern live.'
    case 'harmonics':
      return 'Click any string to pluck it and hear the note. Each harmonic n vibrates at n × f₀. STRUM ALL plays them as a chord. The ratio of overtones defines the timbre of every musical instrument.'
    case 'lissajous':
      return 'Tap PLAY to hear both frequencies simultaneously. Drag PHASE to morph the figure in real time — 0° and 180° give a line, 90° gives an ellipse. Simple ratios produce cleaner figures; this is why consonant intervals look more symmetric.'
    default: return ''
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MODULE
// ═══════════════════════════════════════════════════════════════════════════════
export default function AcousticModule() {
  const setActiveModule = useModuleStore(s => s.setActiveModule)

  const [view,         setView]         = useState('cymatics')
  const [modeIdx,      setModeIdx]      = useState(3)
  const [focusN,       setFocusN]       = useState(null)
  const [presetIdx,    setPresetIdx]    = useState(1)
  const [scatterToken, setScatterToken] = useState(0)
  const [micActive,    setMicActive]    = useState(false)
  const [lissAudio,    setLissAudio]    = useState(false)
  const [lissPhase,    setLissPhase]    = useState(Math.PI / 4)
  const [lissBaseFreq, setLissBaseFreq] = useState(220)

  const micStreamRef = useRef(null)
  const analyserRef  = useRef(null)
  const micRafRef    = useRef(null)
  const lissOscRef   = useRef(null)

  // ── Cymatics: pad tap ───────────────────────────────────────────────────────
  const handlePad = useCallback((i) => {
    setModeIdx(i)
    setScatterToken(t => t + 1)
    playTone(CHLADNI_MODES[i].freq, 1.4)
  }, [])

  // ── Cymatics: microphone ────────────────────────────────────────────────────
  const startMic = useCallback(async () => {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      micStreamRef.current = stream
      const ctx      = getAudioCtx()
      const source   = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 4096
      source.connect(analyser)
      analyserRef.current = analyser
      const buf = new Float32Array(analyser.frequencyBinCount)
      let lastMode = -1
      const tick = () => {
        analyser.getFloatFrequencyData(buf)
        let maxVal = -Infinity, maxIdx = 1
        for (let i = 20; i < buf.length * 0.25; i++) {
          if (buf[i] > maxVal) { maxVal = buf[i]; maxIdx = i }
        }
        const freq = maxIdx * ctx.sampleRate / analyser.fftSize
        let best = 0, bestDist = Infinity
        CHLADNI_MODES.forEach((mode, j) => {
          const d = Math.abs(freq - mode.freq)
          if (d < bestDist) { bestDist = d; best = j }
        })
        if (best !== lastMode) { lastMode = best; setModeIdx(best) }
        micRafRef.current = requestAnimationFrame(tick)
      }
      micRafRef.current = requestAnimationFrame(tick)
      setMicActive(true)
    } catch (e) {
      console.warn('Mic access denied:', e)
    }
  }, [])

  const stopMic = useCallback(() => {
    cancelAnimationFrame(micRafRef.current)
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    micStreamRef.current = null; analyserRef.current = null
    setMicActive(false)
  }, [])

  // ── Harmonics: pluck ────────────────────────────────────────────────────────
  const handlePluck = useCallback((n) => {
    playTone(C3 * n, 2.2, 'triangle', 0.18)
  }, [])

  const handleStrum = useCallback(() => {
    for (let n = 1; n <= 8; n++) {
      setTimeout(() => playTone(C3 * n, 1.8, 'triangle', 0.14), (n - 1) * 120)
    }
  }, [])

  // ── Lissajous: oscillator management ───────────────────────────────────────
  const stopLissajousAudio = useCallback(() => {
    if (!lissOscRef.current) return
    const { osc1, osc2, gain } = lissOscRef.current
    const ctx = getAudioCtx()
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    setTimeout(() => { try { osc1.stop(); osc2.stop(); gain.disconnect() } catch (_) {} }, 200)
    lissOscRef.current = null
  }, [])

  const startLissajousAudio = useCallback((a, b, baseFreq) => {
    stopLissajousAudio()
    const ctx  = getAudioCtx()
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 0.06)
    gain.connect(ctx.destination)
    const osc1 = ctx.createOscillator()
    osc1.type = 'sine'; osc1.frequency.value = a * baseFreq
    osc1.connect(gain); osc1.start()
    const osc2 = ctx.createOscillator()
    osc2.type = 'sine'; osc2.frequency.value = b * baseFreq
    osc2.connect(gain); osc2.start()
    lissOscRef.current = { osc1, osc2, gain }
  }, [stopLissajousAudio])

  const toggleLissAudio = useCallback(() => {
    if (lissAudio) { stopLissajousAudio(); setLissAudio(false) }
    else {
      const { a, b } = LISSAJOUS_PRESETS[presetIdx]
      startLissajousAudio(a, b, lissBaseFreq)
      setLissAudio(true)
    }
  }, [lissAudio, presetIdx, lissBaseFreq, startLissajousAudio, stopLissajousAudio])

  // Update oscillator freqs live when preset/pitch changes
  useEffect(() => {
    if (!lissAudio || !lissOscRef.current) return
    const { a, b } = LISSAJOUS_PRESETS[presetIdx]
    lissOscRef.current.osc1.frequency.value = a * lissBaseFreq
    lissOscRef.current.osc2.frequency.value = b * lissBaseFreq
  }, [presetIdx, lissBaseFreq, lissAudio])

  // Cleanup on view change or unmount
  useEffect(() => () => { stopLissajousAudio(); stopMic() }, [stopLissajousAudio, stopMic])
  useEffect(() => {
    if (view !== 'lissajous' && lissAudio) { stopLissajousAudio(); setLissAudio(false) }
    if (view !== 'cymatics'  && micActive)  stopMic()
  }, [view, lissAudio, micActive, stopLissajousAudio, stopMic])

  const eq = buildEquations(view)
  const { a: lA, b: lB, color: lColor } = LISSAJOUS_PRESETS[presetIdx]

  return (
    <div style={{
      width:'100%', height:'100%', background:'#08090a',
      display:'flex', flexDirection:'column',
      fontFamily:'JetBrains Mono, monospace',
    }}>
      <style>{`
        @keyframes umbra-pulse{0%,100%{opacity:1}50%{opacity:.3}}
        .ac-btn{
          font-family:'JetBrains Mono',monospace;
          font-size:9px;letter-spacing:.14em;text-transform:uppercase;
          padding:5px 10px;border-radius:2px;cursor:pointer;
          border:1px solid rgba(168,85,247,.22);
          background:transparent;color:rgba(168,85,247,.55);
          transition:all .13s;
        }
        .ac-btn:hover{background:rgba(168,85,247,.12);color:#a855f7;}
        .ac-btn.active{
          background:rgba(168,85,247,.14);border-color:rgba(168,85,247,.55);
          color:#c084fc;box-shadow:0 0 10px rgba(168,85,247,.18);
        }
        .tone-pad{
          font-family:'JetBrains Mono',monospace;cursor:pointer;
          border:1px solid rgba(168,85,247,.18);border-radius:3px;
          background:rgba(8,9,10,.85);transition:all .1s;user-select:none;
          display:flex;flex-direction:column;align-items:center;
          justify-content:center;gap:2px;padding:6px 0;
        }
        .tone-pad:hover{background:rgba(168,85,247,.09);border-color:rgba(168,85,247,.40);}
        .tone-pad.active{
          background:rgba(168,85,247,.16);border-color:rgba(168,85,247,.65);
          box-shadow:0 0 16px rgba(168,85,247,.22);
        }
        .tone-pad:active{transform:scale(0.94);}
        input[type=range].ac-slider{
          -webkit-appearance:none;appearance:none;
          height:3px;border-radius:2px;outline:none;cursor:pointer;
          background:linear-gradient(90deg,rgba(168,85,247,.6) var(--val,50%),rgba(168,85,247,.1) var(--val,50%));
        }
        input[type=range].ac-slider::-webkit-slider-thumb{
          -webkit-appearance:none;width:11px;height:11px;border-radius:50%;
          background:#c084fc;border:none;cursor:pointer;
          box-shadow:0 0 6px rgba(168,85,247,.5);
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        display:'flex',alignItems:'center',gap:14,
        padding:'11px 18px',flexShrink:0,
        borderBottom:'1px solid rgba(168,85,247,.10)',
        background:'rgba(8,9,10,.97)',
      }}>
        <button onClick={() => setActiveModule(null)} style={{
          fontFamily:'JetBrains Mono,monospace',fontSize:10,
          letterSpacing:'.18em',textTransform:'uppercase',
          color:'rgba(168,85,247,.50)',background:'none',border:'none',cursor:'pointer',padding:0,
        }}>← MODULES</button>
        <div style={{width:1,height:14,background:'rgba(168,85,247,.12)'}}/>
        <span style={{fontSize:11,letterSpacing:'.28em',textTransform:'uppercase',color:ACCENT,fontWeight:700}}>
          Acoustic Physics
        </span>
        <div style={{
          display:'flex',alignItems:'center',gap:5,padding:'2px 8px',
          border:'1px solid rgba(168,85,247,.28)',borderRadius:2,background:'rgba(168,85,247,.05)',
        }}>
          <div style={{width:5,height:5,borderRadius:'50%',background:ACCENT,boxShadow:`0 0 6px ${ACCENT}`,animation:'umbra-pulse 1.8s ease-in-out infinite'}}/>
          <span style={{fontSize:8,letterSpacing:'.2em',color:ACCENT}}>LIVE</span>
        </div>
        <div style={{display:'flex',gap:4,marginLeft:'auto'}}>
          {VIEWS.map(v => (
            <button key={v.id} role="tab" aria-selected={view===v.id} onClick={() => setView(v.id)} style={{
              fontFamily:'JetBrains Mono,monospace',fontSize:9,letterSpacing:'.15em',textTransform:'uppercase',
              padding:'5px 12px',borderRadius:2,cursor:'pointer',
              background: view===v.id ? 'rgba(168,85,247,.09)' : 'transparent',
              border:`1px solid ${view===v.id ? 'rgba(168,85,247,.33)' : 'rgba(255,255,255,.07)'}`,
              color: view===v.id ? '#c084fc' : 'rgba(255,255,255,.33)',
            }}>{v.label}</button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{flex:1,display:'flex',overflow:'hidden',minHeight:0}}>

        {/* Info panel */}
        <div style={{width:235,flexShrink:0,borderRight:'1px solid rgba(168,85,247,.07)'}}>
          <InfoPanel
            title={view==='cymatics'?'Chladni Figures':view==='harmonics'?'Standing Waves':'Lissajous'}
            domain={eq.domain}
            primaryEq={eq.primaryEq}
            derivedEqs={eq.derivedEqs}
            explanation={buildExplanation(view)}
            accentColor="violet"
            footer="ACOUSTIC PHYSICS · UMBRA"
          />
        </div>

        {/* Scene + controls column */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>

          {/* 3-D scene */}
          <div style={{flex:1,position:'relative',overflow:'hidden',minHeight:0}}>
            <SceneWrapper cameraPosition={CAMERA[view]} showGrid={false} minDist={2} maxDist={18}>
              {view==='cymatics'  && <CymaticsScene  modeIdx={modeIdx} scatterToken={scatterToken} />}
              {view==='harmonics' && <HarmonicsScene  focusN={focusN} onPluck={handlePluck} />}
              {view==='lissajous' && <LissajousScene  presetIdx={presetIdx} phase={lissPhase} />}
            </SceneWrapper>

            <div style={{
              position:'absolute',bottom:10,left:12,display:'flex',alignItems:'center',gap:7,
              padding:'4px 10px',border:'1px solid rgba(168,85,247,.18)',borderRadius:2,
              background:'rgba(8,9,10,.88)',pointerEvents:'none',
            }}>
              <div style={{width:4,height:4,borderRadius:'50%',background:ACCENT,boxShadow:`0 0 4px ${ACCENT}`}}/>
              <span style={{fontSize:8,letterSpacing:'.2em',color:'rgba(168,85,247,.55)'}}>SIM ACTIVE</span>
            </div>

            {/* Lissajous interval picker (overlay) */}
            {view==='lissajous' && (
              <div style={{
                position:'absolute',bottom:10,right:12,
                display:'flex',flexDirection:'column',gap:4,
                pointerEvents:'all',alignItems:'flex-end',
              }}>
                <div style={{fontSize:7,letterSpacing:'.22em',color:'rgba(168,85,247,.40)',textTransform:'uppercase'}}>INTERVAL</div>
                <div style={{display:'flex',flexDirection:'column',gap:2,alignItems:'flex-end'}}>
                  {LISSAJOUS_PRESETS.map((p,i) => (
                    <button key={i} onClick={() => setPresetIdx(i)}
                      className={`ac-btn${presetIdx===i?' active':''}`}
                      style={{
                        borderColor: presetIdx===i ? `${p.color}66` : `${p.color}22`,
                        color: presetIdx===i ? p.color : `${p.color}55`,
                        minWidth:148,textAlign:'left',display:'flex',justifyContent:'space-between',
                      }}
                    >
                      <span>{p.name}</span><span style={{opacity:.55}}>{p.ratio}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Bottom interactive strip ── */}

          {/* CYMATICS: tone pads + mic */}
          {view==='cymatics' && (
            <div style={{
              flexShrink:0,padding:'10px 14px',
              borderTop:'1px solid rgba(168,85,247,.08)',
              background:'rgba(2,6,10,.97)',
            }}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                <span style={{fontSize:8,letterSpacing:'.2em',color:'rgba(168,85,247,.45)',textTransform:'uppercase'}}>
                  TONE PADS — tap to hear the plate vibrate
                </span>
                <button onClick={micActive ? stopMic : startMic}
                  className={`ac-btn${micActive?' active':''}`}
                  style={{
                    marginLeft:'auto',
                    borderColor: micActive ? '#ff6b6b88' : undefined,
                    color:       micActive ? '#ff9090'   : undefined,
                  }}
                >
                  {micActive ? '🎙 MIC ON' : '🎙 USE MIC'}
                </button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:5}}>
                {CHLADNI_MODES.slice(0,5).map((mode,i) => (
                  <button key={i} onMouseDown={() => handlePad(i)}
                    className={`tone-pad${modeIdx===i?' active':''}`}
                  >
                    <span style={{fontSize:9,color:modeIdx===i?'#c084fc':'rgba(168,85,247,.65)',letterSpacing:'.08em'}}>{mode.label}</span>
                    <span style={{fontSize:10,color:modeIdx===i?'#e0d0ff':'rgba(200,180,255,.45)',fontWeight:600}}>{mode.freq} Hz</span>
                    <span style={{fontSize:7,color:'rgba(168,85,247,.40)',letterSpacing:'.1em'}}>{mode.note}</span>
                  </button>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:5,marginTop:5}}>
                {CHLADNI_MODES.slice(5).map((mode,i) => (
                  <button key={i+5} onMouseDown={() => handlePad(i+5)}
                    className={`tone-pad${modeIdx===i+5?' active':''}`}
                  >
                    <span style={{fontSize:9,color:modeIdx===i+5?'#c084fc':'rgba(168,85,247,.65)',letterSpacing:'.08em'}}>{mode.label}</span>
                    <span style={{fontSize:10,color:modeIdx===i+5?'#e0d0ff':'rgba(200,180,255,.45)',fontWeight:600}}>{mode.freq} Hz</span>
                    <span style={{fontSize:7,color:'rgba(168,85,247,.40)',letterSpacing:'.1em'}}>{mode.note}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* HARMONICS: string controls */}
          {view==='harmonics' && (
            <div style={{
              flexShrink:0,padding:'10px 16px',
              borderTop:'1px solid rgba(168,85,247,.08)',
              background:'rgba(2,6,10,.97)',
              display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',
            }}>
              <span style={{fontSize:8,letterSpacing:'.2em',color:'rgba(168,85,247,.45)',textTransform:'uppercase'}}>
                CLICK A STRING TO PLUCK
              </span>
              <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                <button onClick={() => setFocusN(null)} className={`ac-btn${focusN===null?' active':''}`}>ALL</button>
                {Array.from({length:8},(_,i) => {
                  const n = i+1, c = HARMONIC_COLORS[i]
                  return (
                    <button key={n} onClick={() => setFocusN(focusN===n?null:n)}
                      className={`ac-btn${focusN===n?' active':''}`}
                      style={{
                        borderColor: focusN===n ? `${c}66` : `${c}22`,
                        color: focusN===n ? c : `${c}55`,
                      }}
                    >
                      n={n} <span style={{opacity:.5,fontSize:7}}>{HARMONIC_NOTES[i]}</span>
                    </button>
                  )
                })}
              </div>
              <button onClick={handleStrum} className="ac-btn" style={{
                marginLeft:'auto',
                borderColor:'rgba(255,200,100,.35)',color:'rgba(255,200,100,.75)',
                padding:'5px 16px',
              }}>♪ STRUM ALL</button>
            </div>
          )}

          {/* LISSAJOUS: audio + phase + pitch */}
          {view==='lissajous' && (
            <div style={{
              flexShrink:0,padding:'10px 18px',
              borderTop:'1px solid rgba(168,85,247,.08)',
              background:'rgba(2,6,10,.97)',
              display:'flex',alignItems:'center',gap:18,flexWrap:'wrap',
            }}>
              {/* Play/stop */}
              <button onClick={toggleLissAudio}
                className={`ac-btn${lissAudio?' active':''}`}
                style={{
                  padding:'6px 18px',fontSize:10,
                  borderColor: lissAudio ? `${lColor}66` : `${lColor}22`,
                  color:       lissAudio ? lColor          : `${lColor}55`,
                  minWidth:90,
                }}
              >{lissAudio ? '⏸ STOP' : '♪ PLAY'}</button>

              {/* Live freq readout */}
              {lissAudio && (
                <div style={{display:'flex',gap:10,fontSize:9,letterSpacing:'.1em'}}>
                  <span style={{color:`${lColor}88`}}>{lA}×<span style={{color:lColor,fontWeight:700,marginLeft:3}}>{(lA*lissBaseFreq).toFixed(0)} Hz</span></span>
                  <span style={{color:'rgba(168,85,247,.3)'}}>+</span>
                  <span style={{color:`${lColor}88`}}>{lB}×<span style={{color:lColor,fontWeight:700,marginLeft:3}}>{(lB*lissBaseFreq).toFixed(0)} Hz</span></span>
                </div>
              )}

              {/* Base pitch */}
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:8,letterSpacing:'.15em',color:'rgba(168,85,247,.45)',textTransform:'uppercase',whiteSpace:'nowrap'}}>PITCH</span>
                <input type="range" className="ac-slider" min={80} max={440} step={1}
                  value={lissBaseFreq}
                  style={{'--val':`${((lissBaseFreq-80)/360*100).toFixed(1)}%`}}
                  onChange={e => setLissBaseFreq(Number(e.target.value))}
                />
                <span style={{fontSize:9,color:'rgba(168,85,247,.6)',minWidth:38}}>{lissBaseFreq} Hz</span>
              </div>

              {/* Phase delta */}
              <div style={{display:'flex',alignItems:'center',gap:8,flex:'1 1 auto',maxWidth:260}}>
                <span style={{fontSize:8,letterSpacing:'.15em',color:'rgba(168,85,247,.45)',textTransform:'uppercase',whiteSpace:'nowrap'}}>PHASE δ</span>
                <input type="range" className="ac-slider" min={0} max={6.283} step={0.01}
                  value={lissPhase}
                  style={{'--val':`${(lissPhase/6.283*100).toFixed(1)}%`}}
                  onChange={e => setLissPhase(Number(e.target.value))}
                />
                <span style={{fontSize:9,color:'rgba(168,85,247,.6)',minWidth:36}}>
                  {(lissPhase * 180 / Math.PI).toFixed(0)}°
                </span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
