import { useEffect, useState } from 'react'
import { parseRoute, ROUTE_CHANGE_EVENT } from './routes'

const current = () => parseRoute(window.location.pathname, window.location.search)

export function useRoute() {
  const [route, setRoute] = useState(current)
  useEffect(() => {
    const onPop = () => setRoute(current())
    window.addEventListener('popstate', onPop)
    window.addEventListener(ROUTE_CHANGE_EVENT, onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener(ROUTE_CHANGE_EVENT, onPop)
    }
  }, [])
  return route
}
