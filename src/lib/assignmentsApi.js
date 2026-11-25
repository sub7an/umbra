// Assignments, the item catalogue, and the data behind the teacher dashboard.
// Every read goes through RLS: staff see their schools' classes, students see the
// assignments of classes they are in and only their own attempts and mastery.
// Answers are never read here: item_keys is service-role only, and grading happens
// in /api/check (src/lib/checkClient.js).
import { supabase } from './supabase'
import { ClassroomError, errorCode } from './classroomApi'
import { formatRoute } from './routes'
import { viewPageFor } from '../content/simulationPages'

export const formatDue = (iso) => new Date(iso).toLocaleString(undefined, {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
})

// /simulations/<module>/<view slug> for an item's sim_preset { module, view }.
// (sim_preset.state is not used yet: no simulation reads a preset state from the URL.)
export function simLink(preset) {
  if (!preset?.module) return null
  const page = preset.view ? viewPageFor(preset.module, preset.view) : null
  return {
    href: formatRoute({ area: 'sim', module: preset.module, view: page?.slug ?? null, search: '' }),
    name: page?.name ?? 'the simulation',
  }
}

const db = () => {
  if (!supabase) throw new ClassroomError('not_configured')
  return supabase
}
const unwrap = ({ data, error }) => {
  if (error) throw new ClassroomError(errorCode(error), error)
  return data
}

export class AssignmentHasAnswersError extends Error {
  constructor() {
    super('Students have already answered this assignment, so it can’t be deleted. Change its due date instead.')
    this.code = 'has_attempts'
  }
}

// A part key "item_id:part_id" for counting progress.
export const partKey = (itemId, partId) => `${itemId}:${partId}`

// Parts of an assignment's items, in order: [{ itemId, partId }]
export function assignmentParts(assignment, itemsById) {
  return (assignment?.item_ids ?? []).flatMap((id) =>
    (itemsById[id]?.public?.parts ?? []).map((p) => ({ itemId: id, partId: p.id })))
}

// First attempt per part: what counts as the student's own work on the dashboard
// (later attempts may follow feedback or the worked solution).
export function firstByPart(attempts) {
  const out = {}
  for (const a of [...attempts].sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)))) {
    const k = partKey(a.item_id, a.part_id)
    if (!out[k]) out[k] = a
  }
  return out
}

// Attempted after the assignment's due date (due dates are not enforced).
export const isLate = (attempt, assignment) =>
  Boolean(assignment?.due_at && attempt?.created_at && Date.parse(attempt.created_at) > Date.parse(assignment.due_at))

// Latest attempt per part: { "item:part": attemptRow }. Rows newest first.
export function latestByPart(attempts) {
  const out = {}
  for (const a of [...attempts].sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)))) {
    const k = partKey(a.item_id, a.part_id)
    if (!out[k]) out[k] = a
  }
  return out
}

export const assignmentState = (a, now = Date.now()) => {
  if (a.opens_at && Date.parse(a.opens_at) > now) return 'upcoming'
  if (a.due_at && Date.parse(a.due_at) < now) return 'past_due'
  return 'open'
}

export async function listTopics() {
  return unwrap(await db().from('topics').select('id, title').order('title'))
}

export async function listItems() {
  return unwrap(await db().from('items').select('id, topic_ids, difficulty, public').order('id'))
}

export async function getItems(ids) {
  if (!ids.length) return []
  return unwrap(await db().from('items').select('id, topic_ids, difficulty, public').in('id', ids))
}

const ASSIGNMENT_COLS = 'id, class_id, title, item_ids, opens_at, due_at'

export async function listAssignments(classId) {
  return unwrap(await db().from('assignments').select(ASSIGNMENT_COLS)
    .eq('class_id', classId).order('opens_at', { ascending: false }))
}

export async function getAssignment(id) {
  return unwrap(await db().from('assignments').select(`${ASSIGNMENT_COLS}, classes(name)`).eq('id', id).maybeSingle())
}

export async function createAssignment({ classId, title, itemIds, dueAt }) {
  const { data: auth } = await db().auth.getUser()
  return unwrap(await db().from('assignments').insert({
    class_id: classId, title: title.trim(), item_ids: itemIds, due_at: dueAt || null, created_by: auth?.user?.id ?? null,
  }).select(ASSIGNMENT_COLS).single())
}

export async function updateAssignment(id, patch) {
  unwrap(await db().from('assignments').update(patch).eq('id', id))
}

// Deleting an assignment with attempts fails (FK on delete restrict, 23503).
export async function deleteAssignment(id) {
  const { error } = await db().from('assignments').delete().eq('id', id)
  if (error?.code === '23503') throw new AssignmentHasAnswersError()
  if (error) throw new ClassroomError(errorCode(error), error)
}

// Attempts on these assignments that the caller may see (RLS).
export async function listAssignmentAttempts(assignmentIds) {
  if (!assignmentIds.length) return []
  return unwrap(await db().from('attempts')
    .select('id, student_id, assignment_id, item_id, part_id, response, correct, reason, created_at')
    .in('assignment_id', assignmentIds))
}

export async function listMastery(studentIds) {
  if (!studentIds.length) return []
  return unwrap(await db().from('mastery').select('student_id, topic_id, p_known, last_seen').in('student_id', studentIds))
}

export async function listClassItemStats(classId) {
  return unwrap(await db().from('class_item_stats')
    .select('item_id, attempts, correct_rate, top_wrong_response, top_wrong_part, top_wrong_count')
    .eq('class_id', classId))
}

// Student: assignments of every class they're in (RLS), newest first.
export async function listMyAssignments() {
  return unwrap(await db().from('assignments').select(`${ASSIGNMENT_COLS}, classes(name)`)
    .order('opens_at', { ascending: false }))
}

export async function listMyAttempts(assignmentIds) {
  if (!assignmentIds.length) return []
  const { data: auth } = await db().auth.getUser()
  return unwrap(await db().from('attempts')
    .select('id, assignment_id, item_id, part_id, response, correct, reason, created_at')
    .eq('student_id', auth?.user?.id).in('assignment_id', assignmentIds))
}

// Number of attempts on one assignment that the caller can see (staff: all of them).
export async function countAttempts(assignmentId) {
  const { count, error } = await db().from('attempts').select('id', { count: 'exact', head: true })
    .eq('assignment_id', assignmentId)
  if (error) throw new ClassroomError(errorCode(error), error)
  return count ?? 0
}
