// ── Umbra sound engine ────────────────────────────────────────────────────────
// Fully synthesized — zero audio files. Everything is oscillators + filtered
// noise through a master gain. Muting persists across sessions.

let ctx    = null
let master = null
let muted  = typeof localStorage !== 'undefined' && localStorage.getItem('umbra_muted') === '1'
let drone  = null
let lastTick = 0

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 1
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export function isMuted() { return muted }

export function setMuted(m) {
  muted = m
  try { localStorage.setItem('umbra_muted', m ? '1' : '0') } catch { /* private mode */ }
  if (ctx && master) {
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.linearRampToValueAtTime(m ? 0 : 1, ctx.currentTime + 0.15)
  }
}

// Short high blip — button hover. Throttled so lists don't machine-gun.
export function tick() {
  if (muted) return
  const now = performance.now()
  if (now - lastTick < 70) return
  lastTick = now
  const c = ensure(); if (!c) return
  const o = c.createOscillator(), g = c.createGain()
  o.type = 'sine'
  o.frequency.value = 1650 + Math.random() * 250
  g.gain.setValueAtTime(0.006, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.045)
  o.connect(g); g.connect(master)
  o.start(); o.stop(c.currentTime + 0.05)
}

// Firmer blip — click / confirm.
export function click() {
  if (muted) return
  const c = ensure(); if (!c) return
  const o = c.createOscillator(), g = c.createGain()
  o.type = 'triangle'
  o.frequency.setValueAtTime(880, c.currentTime)
  o.frequency.exponentialRampToValueAtTime(520, c.currentTime + 0.07)
  g.gain.setValueAtTime(0.014, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.09)
  o.connect(g); g.connect(master)
  o.start(); o.stop(c.currentTime + 0.1)
}

// Hyperspace whoosh — rising sweep + noise burst, ~0.9s.
export function warp() {
  if (muted) return
  const c = ensure(); if (!c) return
  const t0 = c.currentTime

  const o = c.createOscillator(), g = c.createGain()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(90, t0)
  o.frequency.exponentialRampToValueAtTime(740, t0 + 0.5)
  o.frequency.exponentialRampToValueAtTime(160, t0 + 0.95)
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.setValueAtTime(400, t0)
  f.frequency.exponentialRampToValueAtTime(3200, t0 + 0.5)
  f.frequency.exponentialRampToValueAtTime(300, t0 + 0.95)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.4)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.0)
  o.connect(f); f.connect(g); g.connect(master)
  o.start(t0); o.stop(t0 + 1.05)

  // Noise layer
  const len = c.sampleRate * 1
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = c.createBufferSource()
  src.buffer = buf
  const nf = c.createBiquadFilter()
  nf.type = 'bandpass'
  nf.frequency.setValueAtTime(600, t0)
  nf.frequency.exponentialRampToValueAtTime(2800, t0 + 0.5)
  nf.Q.value = 0.8
  const ng = c.createGain()
  ng.gain.setValueAtTime(0.0001, t0)
  ng.gain.exponentialRampToValueAtTime(0.035, t0 + 0.45)
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.95)
  src.connect(nf); nf.connect(ng); ng.connect(master)
  src.start(t0)
}

// Quiet ambient drone — one per module, very low in the mix.
export function startDrone(baseFreq = 55) {
  stopDrone()
  if (muted) return
  const c = ensure(); if (!c) return
  const t0 = c.currentTime

  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.012, t0 + 2.5)
  g.connect(master)

  const o1 = c.createOscillator()
  o1.type = 'sine'
  o1.frequency.value = baseFreq
  const o2 = c.createOscillator()
  o2.type = 'sine'
  o2.frequency.value = baseFreq * 1.5 + 0.7 // slow beat against the fifth

  const lfo  = c.createOscillator()
  const lfoG = c.createGain()
  lfo.frequency.value = 0.08
  lfoG.gain.value = 0.004
  lfo.connect(lfoG); lfoG.connect(g.gain)

  o1.connect(g); o2.connect(g)
  o1.start(); o2.start(); lfo.start()
  drone = { g, oscs: [o1, o2, lfo] }
}

export function stopDrone() {
  if (!drone || !ctx) { drone = null; return }
  const { g, oscs } = drone
  drone = null
  g.gain.cancelScheduledValues(ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2)
  const dead = oscs
  setTimeout(() => { dead.forEach(o => { try { o.stop() } catch { /* already stopped */ } }) }, 1400)
}
