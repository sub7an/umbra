// Pure route model: pathname + search <-> structured route. No DOM, no React.
export const AREAS = ['home', 'sim', 'teach', 'learn', 'join', 'validation', 'legal']

const SIM_PATH = /^\/simulations\/([a-z-]+)(?:\/([a-z0-9-]+))?\/?$/
const SECTION_PATH = /^\/(teach|learn|validation)((?:\/[^/]+)*)\/?$/
const JOIN_PATH = /^\/join\/?$/
// Legal pages: page id -> path
const LEGAL_PATHS = { privacy: '/privacy', schools: '/schools/data-protection' }
const LEGAL_PAGE = { '/privacy': 'privacy', '/schools/data-protection': 'schools' }

const normaliseCode = (raw) => (raw || '').replace(/\s+/g, '').toUpperCase()

export function parseRoute(pathname, search = '') {
  const sim = SIM_PATH.exec(pathname)
  if (sim) return { area: 'sim', module: sim[1], view: sim[2] || null, search }

  if (JOIN_PATH.test(pathname)) {
    const code = normaliseCode(new URLSearchParams(search).get('code'))
    return { area: 'join', code: code || null, search }
  }

  const legal = LEGAL_PAGE[pathname.replace(/\/+$/, '')]
  if (legal) return { area: 'legal', page: legal, search }

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
    case 'legal':
      return `${LEGAL_PATHS[route.page] || LEGAL_PATHS.privacy}${search}`
    case 'join':
      return route.code ? `/join?code=${encodeURIComponent(route.code)}` : `/join${search}`
    default:
      return `/${search}`
  }
}

// Client-side navigation: push (or replace) the route, then tell subscribers.
export function navigate(route, { replace = false } = {}) {
  window.history[replace ? 'replaceState' : 'pushState'](null, '', formatRoute(route))
  window.dispatchEvent(new PopStateEvent('popstate'))
}

// For code that writes history itself (replaceState/pushState fire no event):
// tell useRoute subscribers the URL changed, without a fake popstate.
export const ROUTE_CHANGE_EVENT = 'umbra:routechange'
export const notifyRouteChange = () => window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT))
