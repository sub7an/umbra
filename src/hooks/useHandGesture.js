import { useRef, useState, useEffect, useCallback } from 'react'
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

const WASM_CDN  = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task'

// ── Tuning ────────────────────────────────────────────────────────────────────
// All pinch distances are normalized by hand size, so they hold at any
// distance from the camera. Enter/exit thresholds differ (hysteresis) so a
// borderline pinch can't flicker.
const PINCH_ENTER      = 0.38   // × hand size
const PINCH_EXIT       = 0.55
const GRACE_MS         = 450    // ignore action gestures right after hand appears
const PINCH_REFRACTORY = 800    // ms after a pinch ends: hand is relaxing, no other gesture may start
const SWIPE_FRAMES     = 4      // consecutive directional frames required
const SWIPE_VEL_THR    = 0.030
const SWIPE_COOLDOWN   = 900
const PALM_HOLD_MS     = 1500
const PALM_STILL_THR   = 0.010  // palm must be still to count as "hold"
const THUMBS_HOLD_MS   = 350
const THUMBS_COOLDOWN  = 2000
const EDGE_MARGIN      = 0.06   // landmarks this close to frame edge = unreliable

export const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[0,17],[17,18],[18,19],[19,20],
]

// ── Geometry helpers ──────────────────────────────────────────────────────────

const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

// Wrist → middle-finger MCP: a stable proxy for apparent hand size
const handSize = (lms) => Math.max(d2(lms[0], lms[9]), 1e-4)

// Extension ratio: how far the tip is from the wrist relative to the PIP joint.
// > ~1.25 the finger is straight; < ~1.0 it's curled toward the palm.
function extRatio(lms, pip, tip) {
  const w = lms[0]
  return d2(lms[tip], w) / Math.max(d2(lms[pip], w), 1e-4)
}

function nearEdge(lms) {
  const p = lms[0], t = lms[8]
  const close = (v) => v < EDGE_MARGIN || v > 1 - EDGE_MARGIN
  return close(p.x) || close(p.y) || close(t.x) || close(t.y)
}

// ── Raw (per-frame) classifiers — debounced before use ───────────────────────

const rawPinchDist = (lms) => d2(lms[4], lms[8]) / handSize(lms)

function rawPeace(lms) {
  return extRatio(lms, 6, 8)   > 1.22 &&
         extRatio(lms, 10, 12) > 1.22 &&
         extRatio(lms, 14, 16) < 1.05 &&
         extRatio(lms, 18, 20) < 1.08
}

function rawFist(lms) {
  return extRatio(lms, 6, 8)   < 0.95 &&
         extRatio(lms, 10, 12) < 0.95 &&
         extRatio(lms, 14, 16) < 0.95 &&
         extRatio(lms, 18, 20) < 1.0
}

function rawOpenPalm(lms) {
  return extRatio(lms, 6, 8)   > 1.25 &&
         extRatio(lms, 10, 12) > 1.25 &&
         extRatio(lms, 14, 16) > 1.25 &&
         extRatio(lms, 18, 20) > 1.2 &&
         d2(lms[8], lms[20]) > handSize(lms) * 0.55 // fingers spread, not a flat chop
}

function rawThumbsUp(lms) {
  return lms[4].y < lms[2].y - 0.05 &&
         extRatio(lms, 6, 8)   < 1.0 &&
         extRatio(lms, 10, 12) < 1.0 &&
         extRatio(lms, 14, 16) < 1.0 &&
         extRatio(lms, 18, 20) < 1.05
}

// N-consecutive-frame debouncer: a gesture must persist to register, and must
// disappear for several frames to release. Kills single-frame noise.
class Stable {
  constructor(onFrames = 3, offFrames = 3) {
    this.on = onFrames; this.off = offFrames
    this.count = 0; this.state = false
  }
  update(raw) {
    if (raw === this.state) { this.count = 0; return this.state }
    this.count++
    const need = this.state ? this.off : this.on
    if (this.count >= need) { this.state = raw; this.count = 0 }
    return this.state
  }
  reset() { this.count = 0; this.state = false }
}

export default function useHandGesture() {
  const [enabled,   setEnabled]   = useState(false)
  const [status,    setStatus]    = useState('idle')
  const [initError, setInitError] = useState(null)

  const videoRef      = useRef(null)
  const landmarkerRef = useRef(null)
  const streamRef     = useRef(null)
  const rafRef        = useRef(null)

  // ── Public refs (read by HUD, camera, event bridge, modules) ───────────────
  const pointerRef       = useRef(null)
  const rawPointerRef    = useRef(null)
  const landmarksRef     = useRef([])
  const allHandsRef      = useRef([])
  const hand2LandmarksRef= useRef([])
  const pinchingRef      = useRef(false)
  const justPinchedRef   = useRef(false)
  const pinchStartAtRef  = useRef(0)      // when the current pinch began
  const pinchEndAtRef    = useRef(0)      // when the last pinch ended
  const peaceStartAtRef  = useRef(0)      // when the current peace pose began
  const uiBusyRef        = useRef(false)  // event bridge claims the pinch for UI
  const velocityRef      = useRef({ x: 0, y: 0 })
  const swipeRef         = useRef(null)
  const fistRef          = useRef(false)
  const openPalmRef      = useRef(false)
  const peaceRef         = useRef(false)
  const thumbsUpRef      = useRef(false)
  const twoPinchRef      = useRef({ active: false, dist: 0, delta: 1.0 })

  // ── Internal state ─────────────────────────────────────────────────────────
  const stab = useRef({
    pinch:  new Stable(2, 3),   // pinch enters fast, releases deliberately
    peace:  new Stable(4, 3),
    fist:   new Stable(5, 3),   // fist is destructive downstream — strictest
    palm:   new Stable(4, 3),
    thumbs: new Stable(4, 3),
    pinch2: new Stable(3, 2),   // second hand pinch (for two-hand zoom)
  })
  const pinchLatch       = useRef(false)  // hysteresis latch on pinch distance
  const pinch2Latch      = useRef(false)
  const handSinceRef     = useRef(0)      // when the hand first appeared
  const lastVideoTime    = useRef(-1)
  const prevPinchRef     = useRef(false)
  const palmHoldStart    = useRef(null)
  const palmFiredRef     = useRef(false)
  const thumbsHoldStart  = useRef(null)
  const thumbsFiredAt    = useRef(0)
  const lastSwipeAt      = useRef(0)
  const swipeHist        = useRef([])     // recent {vx, vy} samples
  const prevTwoPinchDist = useRef(null)
  const twoDeltaSmooth   = useRef(1.0)

  const resetAll = useCallback(() => {
    allHandsRef.current       = []
    landmarksRef.current      = []
    hand2LandmarksRef.current = []
    pointerRef.current        = null
    rawPointerRef.current     = null
    pinchingRef.current       = false
    justPinchedRef.current    = false
    prevPinchRef.current      = false
    fistRef.current           = false
    openPalmRef.current       = false
    peaceRef.current          = false
    thumbsUpRef.current       = false
    uiBusyRef.current         = false
    velocityRef.current       = { x: 0, y: 0 }
    palmHoldStart.current     = null
    palmFiredRef.current      = false
    thumbsHoldStart.current   = null
    prevTwoPinchDist.current  = null
    twoDeltaSmooth.current    = 1.0
    twoPinchRef.current       = { active: false, dist: 0, delta: 1.0 }
    swipeHist.current         = []
    handSinceRef.current      = 0
    pinchLatch.current        = false
    pinch2Latch.current       = false
    Object.values(stab.current).forEach(s => s.reset())
  }, [])

  const initLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return
    const vision = await FilesetResolver.forVisionTasks(WASM_CDN)
    landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    })
  }, [])

  const startCamera = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 360, facingMode: 'user' },
    })
    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play()
    }
  }, [])

  const detect = useCallback(() => {
    const lm  = landmarkerRef.current
    const vid = videoRef.current
    if (!lm || !vid || vid.readyState < 2) {
      rafRef.current = requestAnimationFrame(detect)
      return
    }

    // Only run inference on new video frames — RAF outpaces the webcam
    if (vid.currentTime === lastVideoTime.current) {
      rafRef.current = requestAnimationFrame(detect)
      return
    }
    lastVideoTime.current = vid.currentTime

    const result = lm.detectForVideo(vid, performance.now())
    const allHands = result.landmarks ?? []
    const now = performance.now()

    if (allHands.length > 0) {
      const lms  = allHands[0]
      const lms2 = allHands[1] ?? []

      if (!handSinceRef.current) handSinceRef.current = now
      const settled = now - handSinceRef.current > GRACE_MS
      const edgy    = nearEdge(lms)

      allHandsRef.current       = allHands
      landmarksRef.current      = lms
      hand2LandmarksRef.current = lms2

      // ── Pointer: adaptive smoothing (one-euro-lite) ────────────────────────
      // Slow movement → heavy smoothing (precision); fast → light (response).
      const rawX = -(lms[8].x * 2 - 1)
      const rawY = -(lms[8].y * 2 - 1)
      const prev = rawPointerRef.current
      const vx   = prev ? rawX - prev.x : 0
      const vy   = prev ? rawY - prev.y : 0
      velocityRef.current   = { x: vx, y: vy }
      rawPointerRef.current = { x: rawX, y: rawY }

      const speed = Math.hypot(vx, vy)
      const alpha = Math.min(0.55, 0.10 + speed * 14)
      const sp = pointerRef.current
      pointerRef.current = {
        x: sp ? sp.x + alpha * (rawX - sp.x) : rawX,
        y: sp ? sp.y + alpha * (rawY - sp.y) : rawY,
      }

      // ── Pinch: normalized distance + hysteresis latch + frame debounce ─────
      const pd = rawPinchDist(lms)
      if (pinchLatch.current) { if (pd > PINCH_EXIT)  pinchLatch.current = false }
      else                    { if (pd < PINCH_ENTER) pinchLatch.current = true }
      const pinching = stab.current.pinch.update(pinchLatch.current)

      justPinchedRef.current = pinching && !prevPinchRef.current
      if (justPinchedRef.current) pinchStartAtRef.current = now
      if (!pinching && prevPinchRef.current) pinchEndAtRef.current = now
      prevPinchRef.current   = pinching
      pinchingRef.current    = pinching
      if (!pinching) uiBusyRef.current = false

      // Refractory: right after a pinch the hand relaxes open — that natural
      // motion must never read as palm/peace/fist/swipe.
      const postPinch = now - pinchEndAtRef.current < PINCH_REFRACTORY

      // ── Pose gestures: mutually exclusive after debounce ───────────────────
      // A pinching hand can't also be a fist/palm — suppress at the source.
      const calm     = !pinching && !postPinch
      const prevPeace = peaceRef.current
      const peace    = stab.current.peace.update(calm && rawPeace(lms))
      const fist     = stab.current.fist.update(calm && rawFist(lms))
      const openPalm = stab.current.palm.update(calm && !fist && rawOpenPalm(lms))
      const thumbsUp = stab.current.thumbs.update(calm && !openPalm && rawThumbsUp(lms))
      if (peace && !prevPeace) peaceStartAtRef.current = now

      peaceRef.current    = peace
      fistRef.current     = fist
      openPalmRef.current = openPalm
      thumbsUpRef.current = thumbsUp

      // ── Thumbs up: must be HELD, then fires once with a long cooldown ──────
      if (thumbsUp && settled) {
        if (!thumbsHoldStart.current) thumbsHoldStart.current = now
        else if (now - thumbsHoldStart.current > THUMBS_HOLD_MS &&
                 now - thumbsFiredAt.current > THUMBS_COOLDOWN) {
          thumbsFiredAt.current = now
          window.dispatchEvent(new CustomEvent('umbra-thumbsup'))
        }
      } else {
        thumbsHoldStart.current = null
      }

      // ── Two-hand pinch zoom: both pinches debounced, delta smoothed ────────
      let twoActive = false
      if (lms2.length) {
        const pd2 = rawPinchDist(lms2)
        if (pinch2Latch.current) { if (pd2 > PINCH_EXIT)  pinch2Latch.current = false }
        else                     { if (pd2 < PINCH_ENTER) pinch2Latch.current = true }
        const pinch2 = stab.current.pinch2.update(pinch2Latch.current)

        if (pinching && pinch2) {
          const m0 = { x: (lms[4].x + lms[8].x) / 2,  y: (lms[4].y + lms[8].y) / 2 }
          const m1 = { x: (lms2[4].x + lms2[8].x) / 2, y: (lms2[4].y + lms2[8].y) / 2 }
          const dist = Math.hypot(m0.x - m1.x, m0.y - m1.y)
          let raw = prevTwoPinchDist.current != null ? prevTwoPinchDist.current / dist : 1.0
          raw = Math.max(0.95, Math.min(1.05, raw))                 // clamp spikes
          twoDeltaSmooth.current += 0.35 * (raw - twoDeltaSmooth.current)
          prevTwoPinchDist.current = dist
          twoPinchRef.current = { active: true, dist, delta: twoDeltaSmooth.current }
          twoActive = true
        }
      }
      if (!twoActive) {
        prevTwoPinchDist.current = null
        twoDeltaSmooth.current   = 1.0
        twoPinchRef.current      = { active: false, dist: 0, delta: 1.0 }
      }

      // ── Swipe: sustained directional motion in a neutral pose only ─────────
      // Requires N consecutive fast frames agreeing on direction — a hand
      // drifting into frame or twitching once can no longer switch tabs.
      const neutral = !pinching && !postPinch && !fist && !openPalm && !twoActive
      if (neutral && settled && !edgy) {
        swipeHist.current.push({ vx, vy })
        if (swipeHist.current.length > SWIPE_FRAMES) swipeHist.current.shift()

        if (swipeHist.current.length === SWIPE_FRAMES &&
            now - lastSwipeAt.current > SWIPE_COOLDOWN) {
          const fast = swipeHist.current.every(s => Math.hypot(s.vx, s.vy) > SWIPE_VEL_THR)
          const sx   = swipeHist.current.reduce((a, s) => a + s.vx, 0)
          const sy   = swipeHist.current.reduce((a, s) => a + s.vy, 0)
          const horiz = Math.abs(sx) >= Math.abs(sy)
          const consistent = horiz
            ? swipeHist.current.every(s => Math.sign(s.vx) === Math.sign(sx))
            : swipeHist.current.every(s => Math.sign(s.vy) === Math.sign(sy))

          if (fast && consistent) {
            swipeRef.current = horiz ? (sx > 0 ? 'right' : 'left') : (sy > 0 ? 'down' : 'up')
            lastSwipeAt.current = now
            swipeHist.current = []
            window.dispatchEvent(new CustomEvent('umbra-swipe', { detail: { dir: swipeRef.current } }))
            setTimeout(() => { swipeRef.current = null }, 180)
          }
        }
      } else {
        swipeHist.current = []
      }

      // ── Open palm hold → back: palm must be STILL for the whole hold ───────
      if (openPalm && settled && speed < PALM_STILL_THR) {
        if (!palmHoldStart.current) { palmHoldStart.current = now; palmFiredRef.current = false }
        else if (!palmFiredRef.current && now - palmHoldStart.current > PALM_HOLD_MS) {
          palmFiredRef.current = true
          window.dispatchEvent(new CustomEvent('umbra-back'))
        }
      } else if (!openPalm || speed >= PALM_STILL_THR * 1.6) {
        palmHoldStart.current = null
        palmFiredRef.current  = false
      }

      // ── Status for the HUD ─────────────────────────────────────────────────
      if (twoActive)          setStatus('twopinch')
      else if (thumbsUp)      setStatus('thumbsup')
      else if (pinching)      setStatus('pinching')
      else if (fist)          setStatus('fist')
      else if (openPalm)      setStatus('open_palm')
      else if (peace)         setStatus('peace')
      else                    setStatus('pointing')

    } else {
      resetAll()
      setStatus('idle')
    }

    rafRef.current = requestAnimationFrame(detect)
  }, [resetAll])

  const toggle = useCallback(async () => {
    if (enabled) {
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      resetAll()
      setEnabled(false)
      setStatus('idle')
    } else {
      try {
        setInitError(null)
        await initLandmarker()
        await startCamera()
        lastVideoTime.current = -1
        rafRef.current = requestAnimationFrame(detect)
        setEnabled(true)
      } catch (err) {
        setInitError(err.message || 'Failed to start camera')
        setEnabled(false)
      }
    }
  }, [enabled, initLandmarker, startCamera, detect, resetAll])

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  return {
    enabled, status, initError, toggle, videoRef,
    pointerRef, landmarksRef, allHandsRef, hand2LandmarksRef,
    pinchingRef, justPinchedRef, pinchStartAtRef, peaceStartAtRef, uiBusyRef,
    velocityRef, swipeRef, fistRef, openPalmRef, peaceRef,
    thumbsUpRef, twoPinchRef,
  }
}
