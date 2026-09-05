// Generates public/og.png (1200x630) — the social share card.
// Run: node scripts/make-og.mjs
import sharp from 'sharp'

const W = 1200, H = 630

// Deterministic pseudo-random for a reproducible card
let seed = 42
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647

// Lorenz attractor traced into an SVG path — the product's actual geometry
function lorenzPath() {
  let x = 0.1, y = 0, z = 0
  const dt = 0.004, sigma = 10, rho = 28, beta = 8 / 3
  const pts = []
  for (let i = 0; i < 14000; i++) {
    x += sigma * (y - x) * dt
    y += (x * (rho - z) - y) * dt
    z += (x * y - beta * z) * dt
    if (i > 300 && i % 4 === 0) {
      pts.push([760 + x * 10.5, 355 - (z - 25) * 9.5])
    }
  }
  return 'M' + pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')
}

const dust = Array.from({ length: 90 }, () => {
  const cx = rand() * W, cy = rand() * H, r = 0.6 + rand() * 1.6, o = 0.08 + rand() * 0.5
  return `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(1)}" fill="#8b9cf7" opacity="${o.toFixed(2)}"/>`
}).join('')

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow1" cx="72%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#5e6ad2" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#5e6ad2" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="15%" cy="90%" r="60%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="trail" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#22d3ee"/>
      <stop offset="55%" stop-color="#5e6ad2"/>
      <stop offset="100%" stop-color="#e040fb"/>
    </linearGradient>
    <filter id="soften" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="0.6"/>
    </filter>
    <filter id="bloom" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="7"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="#08090a"/>
  <rect width="${W}" height="${H}" fill="url(#glow1)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>
  ${dust}

  <!-- Attractor: bloom underlayer + crisp trace -->
  <path d="${lorenzPath()}" fill="none" stroke="url(#trail)" stroke-width="4.5" opacity="0.5" filter="url(#bloom)"/>
  <path d="${lorenzPath()}" fill="none" stroke="url(#trail)" stroke-width="1.1" opacity="0.9" filter="url(#soften)"/>

  <!-- Copy block -->
  <text x="84" y="278" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="74" fill="#f7f8f8" letter-spacing="1">Explore physics.</text>
  <text x="84" y="368" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="74" fill="#7d8af2" letter-spacing="1">In real time.</text>
  <text x="86" y="430" font-family="Courier New, monospace" font-size="21" fill="#8d8d96" letter-spacing="3">13 WORLDS · GPU-ACCELERATED · AI-GUIDED · FREE</text>

  <!-- Brand -->
  <text x="84" y="120" font-family="Courier New, monospace" font-weight="bold" font-size="30" fill="#5e6ad2" letter-spacing="10">⬡ UMBRA</text>
  <text x="86" y="566" font-family="Courier New, monospace" font-size="19" fill="#5e6ad2" opacity="0.75" letter-spacing="2">umbrasandbox.com</text>

  <!-- Frame -->
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" fill="none" stroke="#5e6ad2" stroke-opacity="0.28" stroke-width="1.5"/>
</svg>`

await sharp(Buffer.from(svg)).png().toFile('public/og.png')
console.log('public/og.png written')
