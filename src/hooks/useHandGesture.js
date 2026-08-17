import { useRef, useState, useEffect, useCallback } from 'react'
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

const WASM_CDN  = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task'

const PINCH_THR      = 0.07
const SMOOTH_α       = 0.28
const SWIPE_VEL_THR  = 0.026
const SWIPE_COOLDOWN = 700
const PALM_HOLD_MS   = 820

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

function isPeace(lms) {
  if (!lms?.length) return false
  const w = lms[0]
  const dist = (a) => Math.hypot(lms[a].x - w.x, lms[a].y - w.y)
  return dist(8)  > dist(6)  * 1.12 &&
         dist(12) > dist(10) * 1.12 &&
         dist(16) < dist(14) * 1.05 &&
         dist(20) < dist(18) * 1.05
}

function isFist(lms) {
  if (!lms?.length) return false
  const pairs = [[5,8],[9,12],[13,16],[17,20]]
  return pairs.every(([mcp, tip]) => lms[tip].y > lms[mcp].y + 0.01)
    && Math.hypot(lms[4].x - lms[8].x, lms[4].y - lms[8].y) < PINCH_THR * 2.2
}

function isOpenPalm(lms) {
  if (!lms?.length) return false
  const pairs = [[5,8],[9,12],[13,16],[17,20]]
  return pairs.every(([mcp, tip]) => lms[tip].y < lms[mcp].y - 0.04)
}

function isThumbsUp(lms) {
  if (!lms?.length) return false
  // Thumb tip above thumb MCP (lower y = higher on screen), other fingers curled
  return lms[4].y < lms[2].y - 0.06 &&
    lms[8].y  > lms[6].y  + 0.015 &&
    lms[12].y > lms[10].y + 0.015 &&
    lms[16].y > lms[14].y + 0.015 &&
    lms[20].y > lms[18].y + 0.015
}

function pinchMidpoint(lms) {
  if (!lms?.length || !isPinch(lms)) return null
  return { x: (lms[4].x + lms[8].x) / 2, y: (lms[4].y + lms[8].y) / 2 }
}

export default function useHandGesture() {
  const [enabled,   setEnabled]   = useState(false)
  const [status,    setStatus]    = useState('idle')
  const [initError, setInitError] = useState(null)

  const videoRef      = useRef(null)
  const landmarkerRef = useRef(null)
  const streamRef     = useRef(null)
  const rafRef        = useRef(null)
  const prevPinchRef  = useRef(false)

  // ── Public refs ─────────────────────────────────────────────────────────────
  const pointerRef       = useRef(null)
  const rawPointerRef    = useRef(null)
  const landmarksRef     = useRef([])     // primary hand landmarks
  const allHandsRef      = useRef([])     // all detected hands' landmarks
  const hand2LandmarksRef= useRef([])     // second hand (or [])
  const pinchingRef      = useRef(false)
  const justPinchedRef   = useRef(false)
  const velocityRef      = useRef({ x: 0, y: 0 })
  const swipeRef         = useRef(null)
  const fistRef          = useRef(false)
  const openPalmRef      = useRef(false)
  const peaceRef         = useRef(false)
  const thumbsUpRef      = useRef(false)
  // Two-hand pinch zoom: { active, dist, delta }
  const twoPinchRef      = useRef({ active: false, dist: 0, delta: 1.0 })

  // Internal
  const palmHoldStart    = useRef(null)
  const palmFiredRef     = useRef(false)
  const lastSwipeAt      = useRef(0)
  const prevThumbsUpRef  = useRef(false)
  const prevTwoPinchDist = useRef(null)

  const initLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return
    const vision = await FilesetResolver.forVisionTasks(WASM_CDN)
    landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,   // detect up to two hands
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
    const allHands = result.landmarks ?? []

    if (allHands.length > 0) {
      const lms = allHands[0]            // primary hand
      const lms2 = allHands[1] ?? []    // second hand

      allHandsRef.current       = allHands
      landmarksRef.current      = lms
      hand2LandmarksRef.current = lms2

      // ── Primary hand pointer ────────────────────────────────────────────────
      const rawX = -(lms[8].x * 2 - 1)
      const rawY = -(lms[8].y * 2 - 1)
      const prev = rawPointerRef.current
      const vx   = prev ? rawX - prev.x : 0
      const vy   = prev ? rawY - prev.y : 0
      velocityRef.current   = { x: vx, y: vy }
      rawPointerRef.current = { x: rawX, y: rawY }

      const sp = pointerRef.current
      pointerRef.current = {
        x: sp ? sp.x + SMOOTH_α * (rawX - sp.x) : rawX,
        y: sp ? sp.y + SMOOTH_α * (rawY - sp.y) : rawY,
      }

      // ── Primary hand gestures ───────────────────────────────────────────────
      const pinching = isPinch(lms)
      const peace    = isPeace(lms)
      const fist     = isFist(lms)
      const openPalm = isOpenPalm(lms)
      const thumbsUp = isThumbsUp(lms)

      justPinchedRef.current   = pinching && !prevPinchRef.current
      prevPinchRef.current     = pinching
      pinchingRef.current      = pinching
      peaceRef.current         = peace
      fistRef.current          = fist
      openPalmRef.current      = openPalm
      thumbsUpRef.current      = thumbsUp

      // Thumbs up: fire event on leading edge
      if (thumbsUp && !prevThumbsUpRef.current) {
        window.dispatchEvent(new CustomEvent('umbra-thumbsup'))
      }
      prevThumbsUpRef.current = thumbsUp

      // ── Two-hand pinch zoom ─────────────────────────────────────────────────
      const m0 = pinchMidpoint(lms)
      const m1 = lms2.length ? pinchMidpoint(lms2) : null
      if (m0 && m1) {
        const dist  = Math.hypot(m0.x - m1.x, m0.y - m1.y)
        const delta = prevTwoPinchDist.current != null
          ? prevTwoPinchDist.current / dist   // >1 = spreading = zoom in
          : 1.0
        prevTwoPinchDist.current = dist
        twoPinchRef.current = { active: true, dist, delta }
      } else {
        prevTwoPinchDist.current = null
        twoPinchRef.current = { active: false, dist: 0, delta: 1.0 }
      }

      // ── Swipe detection ─────────────────────────────────────────────────────
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

      // ── Open palm hold → back navigation ────────────────────────────────────
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

      // ── Status ──────────────────────────────────────────────────────────────
      if (twoPinchRef.current.active) setStatus('twopinch')
      else if (thumbsUp)              setStatus('thumbsup')
      else if (pinching)              setStatus('pinching')
      else if (fist)                  setStatus('fist')
      else if (openPalm)              setStatus('open_palm')
      else if (peace)                 setStatus('peace')
      else                            setStatus('pointing')

    } else {
      // No hands detected
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
      prevThumbsUpRef.current   = false
      velocityRef.current       = { x: 0, y: 0 }
      palmHoldStart.current     = null
      palmFiredRef.current      = false
      prevTwoPinchDist.current  = null
      twoPinchRef.current       = { active: false, dist: 0, delta: 1.0 }
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
      allHandsRef.current   = []
      hand2LandmarksRef.current = []
      pinchingRef.current   = false
      justPinchedRef.current = false
      prevPinchRef.current  = false
      fistRef.current       = false
      openPalmRef.current   = false
      peaceRef.current      = false
      thumbsUpRef.current   = false
      twoPinchRef.current   = { active: false, dist: 0, delta: 1.0 }
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
    pointerRef, landmarksRef, allHandsRef, hand2LandmarksRef,
    pinchingRef, justPinchedRef,
    velocityRef, swipeRef, fistRef, openPalmRef, peaceRef,
    thumbsUpRef, twoPinchRef,
  }
}
