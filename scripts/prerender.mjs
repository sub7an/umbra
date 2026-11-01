// Runs after `vite build`. Writes a real, crawlable HTML page for every
// simulation (dist/simulations/<id>/index.html), a hub page (/simulations),
// fills the home page with links, and generates sitemap.xml and llms.txt.
//
// Each page is the normal app shell (same JS and CSS) with its own <head>
// (title, description, canonical, Open Graph, JSON-LD) and its lesson content
// as plain HTML inside #root. Search engines and AI crawlers read that HTML
// without running JavaScript; in a browser the app replaces it on load.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { SITE, SIMULATIONS } from '../src/content/simulations.js'

const DIST = new URL('../dist/', import.meta.url)
const template = readFileSync(new URL('index.html', DIST), 'utf8')
const today = new Date().toISOString().slice(0, 10)

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const simPath = (s) => `/simulations/${s.id}`

if (!template.includes('<!-- seo:start -->') || !template.includes('<div id="root"')) {
  throw new Error('prerender: index.html is missing the <!-- seo:start --> block or #root')
}

// ── <head> ─────────────────────────────────────────────────────────────────
function head({ path, title, description, jsonld }) {
  const url = SITE.url + path
  return `<!-- seo:start -->
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${url}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${SITE.url}/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="${SITE.name}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${SITE.url}/og.png" />
    <script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>
    <!-- seo:end -->`
}

const ORG = { '@type': 'Organization', '@id': `${SITE.url}/#org`, name: SITE.name, url: SITE.url, logo: `${SITE.url}/favicon.svg` }
const WEBSITE = { '@type': 'WebSite', '@id': `${SITE.url}/#website`, name: SITE.name, url: SITE.url, publisher: { '@id': `${SITE.url}/#org` } }

const crumbs = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE.url + path })),
})

// ── Body content (plain, semantic HTML) ────────────────────────────────────
const STYLE = `<style>
  .seo-static{position:fixed;inset:0;overflow:auto;background:#0b0d12;color:#d9dce5;font:16px/1.65 Inter,system-ui,-apple-system,sans-serif}
  .seo-static .wrap{max-width:760px;margin:0 auto;padding:40px 20px 80px}
  .seo-static a{color:#9aa6ff}
  .seo-static h1{font-size:34px;line-height:1.2;color:#fff;margin:12px 0 16px}
  .seo-static h2{font-size:22px;color:#fff;margin:36px 0 10px}
  .seo-static h3{font-size:17px;color:#fff;margin:20px 0 4px}
  .seo-static nav{font-size:14px;color:#8a90a0}
  .seo-static code{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:14px;color:#c7cdfb}
  .seo-static .note{font-size:14px;color:#8a90a0}
</style>`

const relatedList = (exceptId) => `<ul>${SIMULATIONS.filter((s) => s.id !== exceptId).map((s) =>
  `<li><a href="${simPath(s)}">${esc(s.name)}</a>: ${esc(s.views.map((v) => v.name).join(', '))}</li>`).join('')}</ul>`

function simulationBody(s) {
  return `<div class="seo-static"><div class="wrap">
  <nav aria-label="Breadcrumb"><a href="/">Umbra</a> › <a href="/simulations">Simulations</a> › ${esc(s.name)}</nav>
  <main>
    <h1>${esc(s.h1)}</h1>
    <p>${esc(s.intro)}</p>
    <p class="note">This interactive simulation runs in your browser with WebGL. Free, no account needed.</p>
    <h2>What you can explore</h2>
    ${s.views.map((v) => `<h3>${esc(v.name)}</h3><p>${esc(v.text)}</p>`).join('\n    ')}
    <h2>Key equations</h2>
    <ul>${s.equations.map((e) => `<li><code>${esc(e)}</code></li>`).join('')}</ul>
    <h2>Curriculum</h2>
    <p>${esc(s.syllabus)}.</p>
    <h2>Common questions</h2>
    ${s.faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('\n    ')}
    <h2>More physics simulations</h2>
    ${relatedList(s.id)}
  </main>
</div></div>`
}

function hubBody() {
  return `<div class="seo-static"><div class="wrap">
  <nav aria-label="Breadcrumb"><a href="/">Umbra</a> › Simulations</nav>
  <main>
    <h1>Interactive physics simulations</h1>
    <p>${esc(SITE.intro)}</p>
    ${SIMULATIONS.map((s) => `<h2><a href="${simPath(s)}">${esc(s.name)}</a></h2><p>${esc(s.description)}</p>`).join('\n    ')}
  </main>
</div></div>`
}

function homeBody() {
  return `<div class="seo-static"><div class="wrap">
  <main>
    <h1>See the physics. Then change it.</h1>
    <p>${esc(SITE.intro)}</p>
    <h2>Simulations</h2>
    <ul>${SIMULATIONS.map((s) => `<li><a href="${simPath(s)}">${esc(s.name)}</a>: ${esc(s.description)}</li>`).join('')}</ul>
    <p><a href="/simulations">Browse all simulations</a></p>
  </main>
</div></div>`
}

// ── Assemble ───────────────────────────────────────────────────────────────
function render({ path, title, description, jsonld, body }) {
  return template
    .replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/, head({ path, title, description, jsonld }) + '\n    ' + STYLE)
    .replace(/(<div id="root"[^>]*>)(<\/div>)/, `$1${body}$2`)
}

function write(path, html) {
  const dir = new URL(`.${path === '/' ? '' : path}/`, DIST)
  mkdirSync(dir, { recursive: true })
  writeFileSync(new URL('index.html', dir), html)
}

// Home
write('/', render({
  path: '/',
  title: SITE.title,
  description: SITE.description,
  body: homeBody(),
  jsonld: { '@context': 'https://schema.org', '@graph': [ORG, WEBSITE, {
    '@type': 'WebApplication',
    name: SITE.name,
    url: `${SITE.url}/`,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any (runs in the browser)',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: SITE.description,
    publisher: { '@id': `${SITE.url}/#org` },
  }] },
}))

// Hub
write('/simulations', render({
  path: '/simulations',
  title: 'Interactive Physics Simulations: All 12 Topics | Umbra',
  description: 'Browse free interactive 3D physics simulations: relativity, quantum mechanics, chaos, electromagnetism, optics, waves, thermodynamics and more.',
  body: hubBody(),
  jsonld: { '@context': 'https://schema.org', '@graph': [ORG, WEBSITE, crumbs([['Umbra', '/'], ['Simulations', '/simulations']]), {
    '@type': 'CollectionPage',
    name: 'Interactive physics simulations',
    url: `${SITE.url}/simulations`,
    hasPart: SIMULATIONS.map((s) => ({ '@type': 'LearningResource', name: s.name, url: SITE.url + simPath(s) })),
  }] },
}))

// One page per simulation
for (const s of SIMULATIONS) {
  write(simPath(s), render({
    path: simPath(s),
    title: s.title,
    description: s.description,
    body: simulationBody(s),
    jsonld: { '@context': 'https://schema.org', '@graph': [ORG, WEBSITE,
      crumbs([['Umbra', '/'], ['Simulations', '/simulations'], [s.name, simPath(s)]]), {
        '@type': 'LearningResource',
        name: s.h1,
        headline: s.title,
        description: s.description,
        url: SITE.url + simPath(s),
        learningResourceType: 'Interactive simulation',
        interactivityType: 'active',
        educationalLevel: 'Secondary and undergraduate (A-level, IB)',
        isAccessibleForFree: true,
        inLanguage: 'en',
        teaches: s.views.map((v) => v.name),
        provider: { '@id': `${SITE.url}/#org` },
      }] },
  }))
}

// sitemap.xml
const urls = ['/', '/simulations', ...SIMULATIONS.map(simPath)]
writeFileSync(new URL('sitemap.xml', DIST), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE.url}${u === '/' ? '/' : u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`)

// llms.txt: a plain-language map of the site for AI assistants
writeFileSync(new URL('llms.txt', DIST), `# ${SITE.name}

> ${SITE.description}

${SITE.intro}

## Simulations

${SIMULATIONS.map((s) => `- [${s.name}](${SITE.url}${simPath(s)}): ${s.description}`).join('\n')}

## Notes

- Everything runs client-side in the browser (WebGL). Free, no account needed.
- Topics are mapped to A-level (AQA, OCR) and IB physics syllabuses.
- Each simulation shows the governing equation, a short lesson and an AI tutor that sees the current state.
`)

console.log(`prerender: wrote ${urls.length} pages, sitemap.xml and llms.txt`)
