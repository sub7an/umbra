// Resolves NASA's CURRENT live YouTube video id so the client can embed a valid
// stream (the deprecated live_stream?channel= embed shows "unavailable").
// GET /api/livestream → { videoId } | { videoId: null }

const LIVE_PAGES = [
  'https://www.youtube.com/@NASA/live',
  'https://www.youtube.com/channel/UCLA_DiR1FfKNvjuUpBHmylQ/live',
]

export default async function handler(req, res) {
  const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
  try {
    for (const url of LIVE_PAGES) {
      const html = await fetch(url, { headers: { 'User-Agent': ua, 'Accept-Language': 'en-US,en' } }).then(r => r.text())
      // The canonical link on a /live page points at the actual live video —
      // the first "videoId" in the HTML is often an unrelated recommendation.
      const canon = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})">/)
      const live = /"isLive(?:Now)?":true/.test(html)
      if (canon && live) {
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
        return res.status(200).json({ videoId: canon[1] })
      }
    }
    res.setHeader('Cache-Control', 's-maxage=120')
    return res.status(200).json({ videoId: null })
  } catch (err) {
    console.error('[livestream]', err)
    return res.status(200).json({ videoId: null })
  }
}
