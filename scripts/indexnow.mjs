// Tell IndexNow-enabled search engines (Bing, Yandex, Seznam, Naver…) that
// the site's pages exist or changed. Run after a deploy: npm run indexnow
// The key below is public by design; it must match /5df453abe653314315a50fc03ae32ce9.txt on the site.
import { SITE, SIMULATIONS } from '../src/content/simulations.js'

const KEY = '5df453abe653314315a50fc03ae32ce9'
const host = new URL(SITE.url).host
const urlList = ['/', '/simulations', ...SIMULATIONS.map((s) => `/simulations/${s.id}`)].map((p) => SITE.url + (p === '/' ? '/' : p))

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key: KEY, keyLocation: `${SITE.url}/${KEY}.txt`, urlList }),
})
console.log(`IndexNow: ${res.status} ${res.statusText} for ${urlList.length} URLs`)
if (!res.ok && res.status !== 202) process.exitCode = 1
