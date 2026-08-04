import { createContext, useContext } from 'react'
import useHandGesture from '../hooks/useHandGesture'

const GestureContext = createContext(null)

export function GestureProvider({ children }) {
  const gesture = useHandGesture()
  return (
    <GestureContext.Provider value={gesture}>
      {children}
    </GestureContext.Provider>
  )
}

export function useGesture() {
  const ctx = useContext(GestureContext)
  if (!ctx) throw new Error('useGesture must be inside GestureProvider')
  return ctx
}
