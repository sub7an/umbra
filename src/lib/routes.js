// Pure route model: pathname + search <-> structured route. No DOM, no React.
export const AREAS = ['home', 'sim', 'teach', 'learn', 'join', 'validation']

const SIM_PATH = /^\/simulations\/([a-z-]+)(?:\/([a-z0-9-]+))?\/?$/
const SECTION_PATH = /^\/(teach|learn|validation)((?:\/[^/]+)*)\/?$/
const JOIN_PATH = /^\/join\/?$/

const normaliseCode = (raw) => (raw || '').replace(/\s+/g, '').toUpperCase()

export function parseRoute(pathname, search = '') {
  const sim = SIM_PATH.exec(pathname)
  if (sim) return { area: 'sim', module: sim[1], view: sim[2] || null, search }

  if (JOIN_PATH.test(pathname)) {
    const code = normaliseCode(new URLSearchParams(search).get('code'))
    return { area: 'join', code: code || null, search }
  }

  const section = SECTION_PATH.exec(pathname)
  if (section) {
    const rest = section[2].split('/').filter(Boolean)
    return { area: section[1], rest, search }
  }

  return { area: 'home', search }
}

export function formatRoute(route) {
  const search = route.search || ''
  switch (route.area) {
    case 'sim':
      return `/simulations/${route.module}${route.view ? `/${route.view}` : ''}${search}`
    case 'teach':
    case 'learn':
    case 'validation':
      return `/${[route.area, ...(route.rest || [])].join('/')}${search}`
    case 'join':
      return route.code ? `/join?code=${encodeURIComponent(route.code)}` : `/join${search}`
    default:
      return `/${search}`
  }
}
