import { useRef, useState, useEffect, useCallback } from 'react'
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

const WASM_CDN   = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const MODEL_URL  = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task'
const PINCH_THR  = 0.07   // normalized distance threshold

// MediaPipe hand skeleton connections (pairs of landmark indices)
export const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[0,17],[17,18],[18,19],[19,20],
]

export default function useHandGesture() {
  const [enabled,  setEnabled]  = useState(false)
  const [status,   setStatus]   = useState('idle')  // 'idle' | 'pointing' | 'pinching'
  const [initError, setInitError] = useState(null)

  const videoRef       = useRef(null)
  const landmarkerRef  = useRef(null)
  const streamRef      = useRef(null)
  const rafRef         = useRef(null)
  const prevPinchRef   = useRef(false)

  // Refs consumed by consuming components without triggering re-renders
  const pointerRef    = useRef(null)   // { x, y } NDC  (null if no hand detected)
  const landmarksRef  = useRef([])     // raw landmark array (21 points)
  const pinchingRef   = useRef(false)
  const justPinchedRef = useRef(false) // single-frame rising edge

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
      const lms  = result.landmarks[0]
      landmarksRef.current = lms

      // Index fingertip (8): mirror X so the gesture feels natural
      const tip   = lms[8]
      const thumb = lms[4]
      pointerRef.current = {
        x: -(tip.x * 2 - 1),
        y: -(tip.y * 2 - 1),
      }

      const dx = thumb.x - tip.x
      const dy = thumb.y - tip.y
      const pinching = Math.sqrt(dx * dx + dy * dy) < PINCH_THR

      justPinchedRef.current  = pinching && !prevPinchRef.current
      prevPinchRef.current    = pinching
      pinchingRef.current     = pinching

      setStatus(pinching ? 'pinching' : 'pointing')
    } else {
      landmarksRef.current     = []
      pointerRef.current       = null
      pinchingRef.current      = false
      justPinchedRef.current   = false
      prevPinchRef.current     = false
      setStatus('idle')
    }

    rafRef.current = requestAnimationFrame(detect)
  }, [])

  const toggle = useCallback(async () => {
    if (enabled) {
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current      = null
      pointerRef.current     = null
      landmarksRef.current   = []
      pinchingRef.current    = false
      justPinchedRef.current = false
      prevPinchRef.current   = false
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

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  return {
    enabled,
    status,
    initError,
    toggle,
    videoRef,
    pointerRef,
    landmarksRef,
    pinchingRef,
    justPinchedRef,
  }
}
