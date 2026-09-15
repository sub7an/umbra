// Vercel serverless function — "what is JWST observing right now?"
// Reads STScI's public weekly observing-schedule report (fixed-column text),
// parses the timeline, and returns the current + next prime observation.
// Server-side fetch avoids browser CORS; edge-cached ~15 min to be gentle on STScI.
//
// GET /api/telescopes  →  { jwst: { current, next, weekOf }, updated }

const SCHEDULE_INDEX = 'https://www.stsci.edu/jwst/science-execution/observing-schedules'
const FILE_BASE = 'https://www.stsci.edu/files/live/sites/www/files/home/jwst/science-execution/observing-schedules/_documents/'

const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/

function parseDurationSec(d) {
  // "DD/HH:MM:SS"
  const m = /(\d+)\/(\d+):(\d+):(\d+)/.exec(d || '')
  if (!m) return 0
  return (+m[1]) * 86400 + (+m[2]) * 3600 + (+m[3]) * 60 + (+m[4])
}

// Derive column [start,end) spans from the dashed separator line.
function columnSpans(sepLine) {
  const spans = []
  let i = 0
  while (i < sepLine.length) {
    if (sepLine[i] === '-') {
      const start = i
      while (i < sepLine.length && sepLine[i] === '-') i++
      spans.push([start, i])
    } else i++
  }
  return spans
}

function slice(line, [s, e]) { return (line.slice(s, e) || '').trim() }

function parseSchedule(text) {
  const lines = text.split('\n')
  const sepIdx = lines.findIndex(l => /^-{5,}/.test(l.trim()) && l.includes('--  --'))
  if (sepIdx === -1) return []
  const spans = columnSpans(lines[sepIdx])
  // spans: 0 visitId, 1 pcs, 2 visitType, 3 start, 4 duration, 5 instrument, 6 target, 7 category, 8 keywords
  const rows = []
  for (let i = sepIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const startStr = slice(line, spans[3] || [0, 0])
    if (!ISO.test(startStr)) continue           // skip parallels/attached/blank rows
    const start = new Date(startStr).getTime()
    const durSec = parseDurationSec(slice(line, spans[4] || [0, 0]))
    rows.push({
      visitType:  slice(line, spans[2] || [0, 0]),
      start,
      end:        start + durSec * 1000,
      instrument: slice(line, spans[5] || [0, 0]),
      target:     slice(line, spans[6] || [0, 0]),
      category:   slice(line, spans[7] || [0, 0]),
      keywords:   slice(line, spans[8] || [0, 0]),
    })
  }
  return rows.sort((a, b) => a.start - b.start)
}

function shape(r, status) {
  if (!r) return null
  return {
    target: r.target || (r.visitType || 'Calibration'),
    instrument: r.instrument || '',
    category: r.category || '',
    keywords: r.keywords || '',
    startTime: new Date(r.start).toISOString(),
    endTime: new Date(r.end).toISOString(),
    status,
  }
}

export default async function handler(req, res) {
  try {
    // 1. Find the newest weekly report file from the index page.
    const idx = await fetch(SCHEDULE_INDEX, { headers: { 'User-Agent': 'UmbraSandbox/1.0' } }).then(r => r.text())
    const files = [...idx.matchAll(/(\d{8}_report_\d{8}\.txt)/g)].map(m => m[1])
    if (!files.length) return res.status(502).json({ error: 'No JWST schedule files found' })
    // Filenames start with the Monday date (YYYYMMDD) — newest = max.
    const newest = files.sort().reverse()[0]

    // 2. Fetch + parse it.
    const text = await fetch(FILE_BASE + newest, { headers: { 'User-Agent': 'UmbraSandbox/1.0' } }).then(r => r.text())
    const rows = parseSchedule(text)

    // 3. Current = latest prime that has started; classify observing vs. just-finished.
    const now = Date.now()
    let currentIdx = -1
    for (let i = 0; i < rows.length; i++) { if (rows[i].start <= now) currentIdx = i; else break }
    const cur = rows[currentIdx]
    const current = shape(cur, cur && cur.end >= now ? 'observing' : 'recent')
    const upcoming = rows.filter(r => r.start > now).slice(0, 5).map(r => shape(r, 'upcoming'))
    const recent = currentIdx > 0
      ? rows.slice(Math.max(0, currentIdx - 3), currentIdx).map(r => shape(r, 'recent')).reverse()
      : []

    const weekOf = newest.slice(0, 4) + '-' + newest.slice(4, 6) + '-' + newest.slice(6, 8)

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800')
    return res.status(200).json({
      jwst: { current, next: upcoming[0] || null, upcoming, recent, weekOf },
      updated: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[telescopes]', err)
    return res.status(500).json({ error: err.message || 'Failed to load telescope schedule' })
  }
}
