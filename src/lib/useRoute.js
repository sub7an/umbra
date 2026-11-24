import { useEffect, useState } from 'react'
import { parseRoute } from './routes'

const current = () => parseRoute(window.location.pathname, window.location.search)

export function useRoute() {
  const [route, setRoute] = useState(current)
  useEffect(() => {
    const onPop = () => setRoute(current())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return route
}
