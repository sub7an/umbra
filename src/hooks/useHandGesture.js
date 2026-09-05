import { useRef, useState, useEffect, useCallback } from 'react'
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

const WASM_CDN  = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task'

/**
 * ── Umbra hand tracking — virtual-mouse architecture ─────────────────────────
 *
 * One gesture. The hand is a cursor; pinch is the mouse button.
 *
 *   · point       → cursor follows your hand
 *   · pinch       → press (click buttons, drag sliders, orbit on empty space)
 *   · two pinches → zoom
 *
 * There is deliberately no pose vocabulary — no fist, palm, peace, swipe or
 * thumbs-up. Poses overlap on noisy 2D landmarks and fire while the hand is
 * simply relaxing; a decade of hand-UI products (Vision Pro, Quest) converged
 * on point + pinch for exactly this reason. Every app action is an on-screen
 * control the cursor can click.
 */

// Pinch distances are normalized by hand size so they hold at any distance
// from the camera; enter/exit differ (hysteresis) so a borderline pinch
// cannot flicker into phantom clicks.
const PINCH_ENTER = 0.36
const PINCH_EXIT  = 0.52

export const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[0,17],[17,18],[18,19],[19,20],
]

const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const handSize = (lms) => Math.max(d2(lms[0], lms[9]), 1e-4)
const pinchDist = (lms) => d2(lms[4], lms[8]) / handSize(lms)

// N-consecutive-frame debouncer
class Stable {
  constructor(onFrames, offFrames) {
    this.on = onFrames; this.off = offFrames
    this.count = 0; this.state = false
  }
  update(raw) {
    if (raw === this.state) { this.count = 0; return this.state }
    this.count++
    if (this.count >= (this.state ? this.off : this.on)) {
      this.state = raw; this.count = 0
    }
    return this.state
  }
  reset() { this.count = 0; this.state = false }
}

export default function useHandGesture() {
  const [enabled,   setEnabled]   = useState(false)
  const [status,    setStatus]    = useState('idle')  // idle | tracking | pinching | twopinch
  const [initError, setInitError] = useState(null)

  const videoRef      = useRef(null)
  const landmarkerRef = useRef(null)
  const streamRef     = useRef(null)
  const rafRef        = useRef(null)

  // ── Public refs ────────────────────────────────────────────────────────────
  // pointer: NDC coords, x right, y up, mirrored to match the user's motion
  const pointerRef       = useRef(null)
  const landmarksRef     = useRef([])
  const allHandsRef      = useRef([])
  const pinchingRef      = useRef(false)
  const justPinchedRef   = useRef(false)
  const pinchStartAtRef  = useRef(0)
  const uiBusyRef        = useRef(false)  // GestureMouse claims the pinch for UI
  const velocityRef      = useRef({ x: 0, y: 0 })
  const twoPinchRef      = useRef({ active: false, dist: 0, delta: 1.0 })

  // ── Internal ───────────────────────────────────────────────────────────────
  const pinchStab        = useRef(new Stable(2, 3))
  const pinch2Stab       = useRef(new Stable(3, 2))
  const pinchLatch       = useRef(false)
  const pinch2Latch      = useRef(false)
  const prevPinchRef     = useRef(false)
  const rawPointerPrev   = useRef(null)
  const lastVideoTime    = useRef(-1)
  const prevTwoDist      = useRef(null)
  const twoDeltaSmooth   = useRef(1.0)

  const resetAll = useCallback(() => {
    pointerRef.current      = null
    landmarksRef.current    = []
    allHandsRef.current     = []
    pinchingRef.current     = false
    justPinchedRef.current  = false
    prevPinchRef.current    = false
    uiBusyRef.current       = false
    velocityRef.current     = { x: 0, y: 0 }
    rawPointerPrev.current  = null
    prevTwoDist.current     = null
    twoDeltaSmooth.current  = 1.0
    twoPinchRef.current     = { active: false, dist: 0, delta: 1.0 }
    pinchLatch.current      = false
    pinch2Latch.current     = false
    pinchStab.current.reset()
    pinch2Stab.current.reset()
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
    // Only run inference on new webcam frames — RAF outpaces the camera
    if (vid.currentTime === lastVideoTime.current) {
      rafRef.current = requestAnimationFrame(detect)
      return
    }
    lastVideoTime.current = vid.currentTime

    const result   = lm.detectForVideo(vid, performance.now())
    const allHands = result.landmarks ?? []
    const now      = performance.now()

    if (allHands.length === 0) {
      resetAll()
      setStatus('tracking') // camera on, no hand — HUD shows "show your hand"
      rafRef.current = requestAnimationFrame(detect)
      return
    }

    const lms  = allHands[0]
    const lms2 = allHands[1] ?? []
    allHandsRef.current   = allHands
    landmarksRef.current  = lms

    // ── Cursor: thumb-tip / index-tip midpoint ────────────────────────────────
    // This point barely moves while the fingers close into a pinch (they
    // converge onto it), so pressing doesn't displace the cursor — clicks land
    // where the user aimed. An index-tip cursor dives toward the thumb on
    // every pinch and drags clicks off-target.
    const mx = (lms[4].x + lms[8].x) / 2
    const my = (lms[4].y + lms[8].y) / 2
    const rawX = -(mx * 2 - 1)
    const rawY = -(my * 2 - 1)

    const prev = rawPointerPrev.current
    const vx = prev ? rawX - prev.x : 0
    const vy = prev ? rawY - prev.y : 0
    velocityRef.current  = { x: vx, y: vy }
    rawPointerPrev.current = { x: rawX, y: rawY }

    // Adaptive smoothing: heavy when slow (precision), light when fast
    const speed = Math.hypot(vx, vy)
    const alpha = Math.min(0.6, 0.12 + speed * 16)
    const sp = pointerRef.current
    pointerRef.current = {
      x: sp ? sp.x + alpha * (rawX - sp.x) : rawX,
      y: sp ? sp.y + alpha * (rawY - sp.y) : rawY,
    }

    // ── Pinch: hysteresis latch + frame debounce ──────────────────────────────
    const pd = pinchDist(lms)
    if (pinchLatch.current) { if (pd > PINCH_EXIT)  pinchLatch.current = false }
    else                    { if (pd < PINCH_ENTER) pinchLatch.current = true }
    const pinching = pinchStab.current.update(pinchLatch.current)

    justPinchedRef.current = pinching && !prevPinchRef.current
    if (justPinchedRef.current) pinchStartAtRef.current = now
    prevPinchRef.current = pinching
    pinchingRef.current  = pinching
    if (!pinching) uiBusyRef.current = false

    // ── Two-hand pinch → zoom ─────────────────────────────────────────────────
    let twoActive = false
    if (lms2.length) {
      const pd2 = pinchDist(lms2)
      if (pinch2Latch.current) { if (pd2 > PINCH_EXIT)  pinch2Latch.current = false }
      else                     { if (pd2 < PINCH_ENTER) pinch2Latch.current = true }
      const pinch2 = pinch2Stab.current.update(pinch2Latch.current)

      if (pinching && pinch2) {
        const m1x  = (lms2[4].x + lms2[8].x) / 2
        const m1y  = (lms2[4].y + lms2[8].y) / 2
        const dist = Math.hypot(mx - m1x, my - m1y)
        let raw = prevTwoDist.current != null ? prevTwoDist.current / dist : 1.0
        raw = Math.max(0.95, Math.min(1.05, raw))
        twoDeltaSmooth.current += 0.35 * (raw - twoDeltaSmooth.current)
        prevTwoDist.current = dist
        twoPinchRef.current = { active: true, dist, delta: twoDeltaSmooth.current }
        twoActive = true
      }
    }
    if (!twoActive) {
      prevTwoDist.current    = null
      twoDeltaSmooth.current = 1.0
      twoPinchRef.current    = { active: false, dist: 0, delta: 1.0 }
    }

    setStatus(twoActive ? 'twopinch' : pinching ? 'pinching' : 'tracking')
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
        setStatus('tracking')
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
    pointerRef, landmarksRef, allHandsRef,
    pinchingRef, justPinchedRef, pinchStartAtRef, uiBusyRef,
    velocityRef, twoPinchRef,
  }
}
