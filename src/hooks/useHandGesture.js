import { useRef, useState, useEffect, useCallback } from 'react'
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

const WASM_CDN  = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task'

const PINCH_THR      = 0.07   // thumb–index distance for pinch
const SMOOTH_α       = 0.28   // EMA weight — lower = smoother, more lag
const SWIPE_VEL_THR  = 0.026  // NDC/frame to count as a swipe
const SWIPE_COOLDOWN = 700    // ms between swipe events
const PALM_HOLD_MS   = 820    // ms of open palm → back navigation

export const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[0,17],[17,18],[18,19],[19,20],
]

// ── Gesture classifiers ───────────────────────────────────────────────────────

function isPinch(lms) {
  if (!lms?.length) return false
  const dx = lms[4].x - lms[8].x, dy = lms[4].y - lms[8].y
  return Math.sqrt(dx*dx + dy*dy) < PINCH_THR
}

// Index + middle extended, ring + pinky curled
function isPeace(lms) {
  if (!lms?.length) return false
  const w = lms[0]
  const dist = (a) => Math.hypot(lms[a].x - w.x, lms[a].y - w.y)
  return dist(8)  > dist(6)  * 1.12 &&
         dist(12) > dist(10) * 1.12 &&
         dist(16) < dist(14) * 1.05 &&
         dist(20) < dist(18) * 1.05
}

// All four fingertips below their base knuckles (curled in)
function isFist(lms) {
  if (!lms?.length) return false
  const pairs = [[5,8],[9,12],[13,16],[17,20]]
  // fingertip.y > mcp.y means lower on screen (curled)
  return pairs.every(([mcp, tip]) => lms[tip].y > lms[mcp].y + 0.01)
    && Math.hypot(lms[4].x - lms[8].x, lms[4].y - lms[8].y) < PINCH_THR * 2.2
}

// All four fingers extended and spread above their base knuckles
function isOpenPalm(lms) {
  if (!lms?.length) return false
  const pairs = [[5,8],[9,12],[13,16],[17,20]]
  return pairs.every(([mcp, tip]) => lms[tip].y < lms[mcp].y - 0.04)
}

export default function useHandGesture() {
  const [enabled,   setEnabled]   = useState(false)
  const [status,    setStatus]    = useState('idle')
  const [initError, setInitError] = useState(null)

  const videoRef        = useRef(null)
  const landmarkerRef   = useRef(null)
  const streamRef       = useRef(null)
  const rafRef          = useRef(null)
  const prevPinchRef    = useRef(false)

  // ── Public refs consumed without re-render ──────────────────────────────────
  const pointerRef      = useRef(null)   // { x, y } smoothed NDC
  const rawPointerRef   = useRef(null)   // { x, y } unsmoothed (for velocity)
  const landmarksRef    = useRef([])
  const pinchingRef     = useRef(false)
  const justPinchedRef  = useRef(false)
  const velocityRef     = useRef({ x: 0, y: 0 })
  const swipeRef        = useRef(null)   // 'left'|'right'|'up'|'down'|null
  const fistRef         = useRef(false)
  const openPalmRef     = useRef(false)
  const peaceRef        = useRef(false)
  // Hold gesture tracking (internal)
  const palmHoldStart   = useRef(null)
  const palmFiredRef    = useRef(false)
  const lastSwipeAt     = useRef(0)

  const initLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return
    const vision = await FilesetResolver.forVisionTasks(WASM_CDN)
    landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 1,
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

    const result = lm.detectForVideo(vid, performance.now())

    if (result.landmarks?.length > 0) {
      const lms = result.landmarks[0]
      landmarksRef.current = lms

      // Raw pointer from index fingertip (mirrored)
      const rawX = -(lms[8].x * 2 - 1)
      const rawY = -(lms[8].y * 2 - 1)

      // Velocity (from raw, before smoothing)
      const prev = rawPointerRef.current
      const vx   = prev ? rawX - prev.x : 0
      const vy   = prev ? rawY - prev.y : 0
      velocityRef.current = { x: vx, y: vy }
      rawPointerRef.current = { x: rawX, y: rawY }

      // EMA smoothing
      const sp = pointerRef.current
      pointerRef.current = {
        x: sp ? sp.x + SMOOTH_α * (rawX - sp.x) : rawX,
        y: sp ? sp.y + SMOOTH_α * (rawY - sp.y) : rawY,
      }

      // Gesture classification
      const pinching  = isPinch(lms)
      const peace     = isPeace(lms)
      const fist      = isFist(lms)
      const openPalm  = isOpenPalm(lms)

      justPinchedRef.current = pinching && !prevPinchRef.current
      prevPinchRef.current   = pinching
      pinchingRef.current    = pinching
      peaceRef.current       = peace
      fistRef.current        = fist
      openPalmRef.current    = openPalm

      // Swipe: fast movement while pointing (not pinching, not fist)
      const speed = Math.sqrt(vx*vx + vy*vy)
      const now   = performance.now()
      if (speed > SWIPE_VEL_THR && !pinching && !fist && now - lastSwipeAt.current > SWIPE_COOLDOWN) {
        swipeRef.current = Math.abs(vx) >= Math.abs(vy)
          ? (vx > 0 ? 'right' : 'left')
          : (vy > 0 ? 'down' : 'up')
        lastSwipeAt.current = now
        window.dispatchEvent(new CustomEvent('umbra-swipe', { detail: { dir: swipeRef.current } }))
        setTimeout(() => { swipeRef.current = null }, 180)
      }

      // Open palm hold → back navigation
      if (openPalm && !pinching) {
        if (!palmHoldStart.current) { palmHoldStart.current = now; palmFiredRef.current = false }
        else if (!palmFiredRef.current && now - palmHoldStart.current > PALM_HOLD_MS) {
          palmFiredRef.current = true
          window.dispatchEvent(new CustomEvent('umbra-back'))
        }
      } else {
        palmHoldStart.current = null
        palmFiredRef.current  = false
      }

      // Status string
      if (pinching)        setStatus('pinching')
      else if (fist)       setStatus('fist')
      else if (openPalm)   setStatus('open_palm')
      else if (peace)      setStatus('peace')
      else                 setStatus('pointing')

    } else {
      landmarksRef.current  = []
      pointerRef.current    = null
      rawPointerRef.current = null
      pinchingRef.current   = false
      justPinchedRef.current = false
      prevPinchRef.current  = false
      fistRef.current       = false
      openPalmRef.current   = false
      peaceRef.current      = false
      velocityRef.current   = { x: 0, y: 0 }
      palmHoldStart.current = null
      palmFiredRef.current  = false
      setStatus('idle')
    }

    rafRef.current = requestAnimationFrame(detect)
  }, [])

  const toggle = useCallback(async () => {
    if (enabled) {
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current     = null
      pointerRef.current    = null
      landmarksRef.current  = []
      pinchingRef.current   = false
      justPinchedRef.current = false
      prevPinchRef.current  = false
      fistRef.current       = false
      openPalmRef.current   = false
      peaceRef.current      = false
      setEnabled(false)
      setStatus('idle')
    } else {
      try {
        setInitError(null)
        await initLandmarker()
        await startCamera()
        rafRef.current = requestAnimationFrame(detect)
        setEnabled(true)
      } catch (err) {
        setInitError(err.message || 'Failed to start camera')
        setEnabled(false)
      }
    }
  }, [enabled, initLandmarker, startCamera, detect])

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  return {
    enabled, status, initError, toggle, videoRef,
    pointerRef, landmarksRef, pinchingRef, justPinchedRef,
    velocityRef, swipeRef, fistRef, openPalmRef, peaceRef,
  }
}
