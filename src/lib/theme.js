// Light/dark theme. Light mode works by inverting the whole app at the root
// (see index.css); simulation canvases are re-inverted so the physics keeps
// its true dark render inside light chrome.

const KEY = 'umbra_theme'

export function getTheme() {
  try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark' } catch { return 'dark' }
}

export function applyTheme(t) {
  document.documentElement.classList.toggle('light', t === 'light')
}

export function toggleTheme() {
  const next = getTheme() === 'light' ? 'dark' : 'light'
  try { localStorage.setItem(KEY, next) } catch { /* private mode */ }
  applyTheme(next)
  window.dispatchEvent(new CustomEvent('umbra-theme', { detail: next }))
  return next
}

export function initTheme() { applyTheme(getTheme()) }
