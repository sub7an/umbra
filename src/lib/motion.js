// True when the visitor has asked their OS/browser for less motion.
// CSS animations are handled in index.css; this covers motion driven from JS.
export function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}
