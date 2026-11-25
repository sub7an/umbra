// Moves progress made on this device (localStorage) into the account
// (profiles.progress), once per device per user.
//
// Real keys used by the app:
//   umbra_challenges   { date, completed: { [challengeId]: points }, streak }
//   umbra_story_xp     integer string
//   umbra_story        { [journeyId]: { step } | { completed: true, step } }

export const MIGRATED_KEY = 'umbra_progress_migrated'
const CHALLENGES_KEY = 'umbra_challenges'
const XP_KEY = 'umbra_story_xp'
const STORY_KEY = 'umbra_story'
const LEGACY_STREAK_KEY = 'umbra_challenge_streak' // read by ProfilePanel, never written

const emptyProgress = () => ({ challenges: [], streak: 0, storyXp: 0, story: {} })
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const num = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)

function readJson(storage, key) {
  try {
    const v = JSON.parse(storage.getItem(key))
    return isObj(v) ? v : {}
  } catch { return {} }
}
function readInt(storage, key) {
  try { return num(parseInt(storage.getItem(key), 10)) } catch { return 0 }
}

export function readLocalProgress(storage = globalThis.localStorage) {
  if (!storage) return emptyProgress()
  const ch = readJson(storage, CHALLENGES_KEY)
  const story = readJson(storage, STORY_KEY)
  return {
    challenges: isObj(ch.completed) ? Object.keys(ch.completed).sort() : [],
    streak: Math.max(num(ch.streak), readInt(storage, LEGACY_STREAK_KEY)),
    storyXp: readInt(storage, XP_KEY),
    story: Object.fromEntries(Object.entries(story).filter(([, v]) => isObj(v))),
  }
}

// Rank of a journey's progress: completed beats any step; otherwise higher step is further.
const rank = (p) => (p?.completed ? Infinity : Number.isFinite(p?.step) ? p.step : -1)

function normalise(p) {
  const o = isObj(p) ? p : {}
  return {
    challenges: Array.isArray(o.challenges) ? o.challenges.filter((x) => typeof x === 'string') : [],
    streak: num(o.streak),
    storyXp: num(o.storyXp),
    story: isObj(o.story) ? o.story : {},
  }
}

export function mergeProgress(local, remote) {
  const l = normalise(local)
  const r = normalise(remote)
  const story = { ...r.story }
  for (const [k, v] of Object.entries(l.story)) {
    if (!(k in story) || rank(v) > rank(story[k])) story[k] = v
  }
  return {
    challenges: [...new Set([...l.challenges, ...r.challenges])].sort(),
    streak: Math.max(l.streak, r.streak),
    storyXp: Math.max(l.storyXp, r.storyXp),
    story,
  }
}

// The UI reads localStorage, so reflect the merged xp/story/streak back on this
// device. Challenge ids are not written back: umbra_challenges.completed is a
// per-day map of points that resets daily, and remote ids carry no points.
export function writeLocalProgress(merged, storage = globalThis.localStorage) {
  try {
    storage.setItem(XP_KEY, String(merged.storyXp))
    storage.setItem(STORY_KEY, JSON.stringify(merged.story))
    const ch = readJson(storage, CHALLENGES_KEY)
    storage.setItem(CHALLENGES_KEY, JSON.stringify({ ...ch, streak: merged.streak }))
  } catch { /* private mode / quota */ }
}

// Never throws. Marker is set only after the remote save succeeded.
export async function migrateProgress(client, user, storage = globalThis.localStorage) {
  try {
    if (!client || !user?.id || !storage) return
    if (user.app_metadata?.umbra_card) return // card users have no profiles row
    if (storage.getItem(MIGRATED_KEY) === user.id) return
    const { data, error } = await client.from('profiles').select('progress').eq('id', user.id).single()
    if (error || !data) return
    const merged = mergeProgress(readLocalProgress(storage), data.progress)
    const { error: saveError } = await client.from('profiles').update({ progress: merged }).eq('id', user.id)
    if (saveError) return
    writeLocalProgress(merged, storage)
    storage.setItem(MIGRATED_KEY, user.id)
  } catch { /* retry next sign-in */ }
}
