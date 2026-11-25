import { describe, it, expect, vi, afterEach } from 'vitest'
import { createHandler } from '../api/check'

// Fixtures are deliberately fake (not real content): a made-up item whose key and
// solution exist only inside this test, never as a tracked JSON file.
const STUDENT = '50000000-0000-0000-0000-000000000001'
const OTHER_STUDENT = '50000000-0000-0000-0000-000000000002'
const TEACHER = 'a0000000-0000-0000-0000-0000000000a1'
const CLASS = 'c0000000-0000-0000-0000-0000000000a1'
const OTHER_CLASS = 'c0000000-0000-0000-0000-0000000000b1'
const ASSIGNMENT = 'd0000000-0000-0000-0000-0000000000a1'
const ITEM = 'test-fake-001'

const FAKE_ITEM = {
  id: ITEM,
  version: 1,
  public: {
    stem: 'Fake stem.',
    parts: [
      { id: 'a', stem: 'Fake numeric part.', answer_type: 'numeric', marks: 1 },
      { id: 'b', stem: 'Fake order part.', answer_type: 'order', marks: 1 },
      { id: 'c', stem: 'Part with no key.', answer_type: 'numeric', marks: 1 },
    ],
  },
}
const FAKE_PRIVATE = {
  key: { a: { value: 42, unit: 'm', rel_tol: 0.01 }, b: { order: ['x', 'y', 'z'] } },
  solution: ['fake step one', 'fake step two'],
  wrong_answers: { a: [{ value: '24 m', feedback_id: 'swapped', feedback: 'Fake feedback: digits swapped.' }] },
}

let uuidSeq = 0
const nextUuid = () => `e0000000-0000-0000-0000-${String(++uuidSeq).padStart(12, '0')}`

// Minimal PostgREST-style builder over an in-memory DB. Every finished query is logged.
function builder(table, db, log) {
  const st = { table, op: 'select', filters: {}, gt: {}, single: false }
  const done = () => { log.push(st); return Promise.resolve(db.resolve(st)) }
  const b = {
    select(cols, opts) { st.cols = cols; st.opts = opts; if (st.op !== 'upsert') st.op = 'select'; return b },
    upsert(row, opts) { st.op = 'upsert'; st.payload = row; st.upsertOpts = opts; return b },
    eq(k, v) { st.filters[k] = v; return b },
    gt(k, v) { st.gt[k] = v; return b },
    maybeSingle() { st.single = true; return done() },
    then(ok, bad) { return done().then(ok, bad) },
  }
  return b
}

function fakeDb({
  caller = STUDENT,
  isStudent = true,
  item = FAKE_ITEM,
  priv = FAKE_PRIVATE,
  enrolledIn = [CLASS],
  assignment = { id: ASSIGNMENT, class_id: CLASS, item_ids: [ITEM], opens_at: new Date(Date.now() - 3600e3).toISOString() },
  attempts = [],
} = {}) {
  const log = []
  const db = {
    attempts: attempts.map((a) => ({ ...a })),
    resolve(st) {
      const f = st.filters
      if (st.table === 'students') {
        return { data: isStudent && f.user_id === caller ? { user_id: caller } : null, error: null }
      }
      if (st.table === 'items') return { data: item && f.id === item.id ? item : null, error: null }
      if (st.table === 'item_keys') {
        return { data: priv && item && f.item_id === item.id ? { version: item.version, private: priv } : null, error: null }
      }
      if (st.table === 'assignments') return { data: assignment && f.id === assignment.id ? assignment : null, error: null }
      if (st.table === 'enrolments') {
        return { data: f.student_id === caller && enrolledIn.includes(f.class_id) ? { class_id: f.class_id } : null, error: null }
      }
      if (st.table === 'attempts' && st.op === 'upsert') {
        const row = st.payload
        if (db.attempts.some((a) => a.id === row.id)) return { data: [], error: null }
        db.attempts.push({ ...row, created_at: new Date().toISOString() })
        return { data: [{ id: row.id }], error: null }
      }
      if (st.table === 'attempts' && st.opts?.head) {
        const since = st.gt.created_at
        const count = db.attempts.filter((a) => a.student_id === f.student_id && (!since || a.created_at > since)).length
        return { data: null, count, error: null }
      }
      if (st.table === 'attempts' && 'id' in f) {
        return { data: db.attempts.find((a) => a.id === f.id) || null, error: null }
      }
      throw new Error(`unexpected query on ${st.table}`)
    },
  }
  const admin = {
    log,
    db,
    from: (table) => builder(table, db, log),
    auth: {
      getUser: vi.fn(async (token) => (token === 'good'
        ? { data: { user: { id: caller } }, error: null }
        : { data: { user: null }, error: { message: 'invalid JWT' } })),
    },
  }
  return admin
}

function call(admin, { method = 'POST', token = 'good', body } = {}) {
  const req = { method, headers: token ? { authorization: `Bearer ${token}` } : {}, body }
  const res = {
    statusCode: 200, body: undefined, headers: {},
    status(c) { this.statusCode = c; return this },
    json(o) { this.body = o; return this },
    setHeader(k, v) { this.headers[k.toLowerCase()] = v },
  }
  return createHandler(() => admin)(req, res).then(() => res)
}

const check = (admin, over = {}) =>
  call(admin, { body: { attempt_id: nextUuid(), item_id: ITEM, part_id: 'a', response: '42 m', ...over } })

const inserts = (admin) => admin.log.filter((s) => s.table === 'attempts' && s.op === 'upsert')

afterEach(() => vi.restoreAllMocks())

describe('POST /api/check', () => {
  it('a correct numeric answer is ok and inserts a correct attempt', async () => {
    const admin = fakeDb()
    const res = await check(admin, { hints_used: 1, time_ms: 5000 })
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ correct: true, reason: 'ok' })
    expect(res.body.feedback).toBeUndefined()
    expect(res.headers['cache-control']).toBe('no-store')
    const ins = inserts(admin)
    expect(ins).toHaveLength(1)
    expect(ins[0].upsertOpts).toMatchObject({ onConflict: 'id', ignoreDuplicates: true })
    expect(ins[0].payload).toMatchObject({
      student_id: STUDENT, item_id: ITEM, part_id: 'a', response: '42 m',
      correct: true, reason: 'ok', hints_used: 1, time_ms: 5000, assignment_id: null,
    })
  })

  it('a known wrong value returns the feedback from wrong_answers', async () => {
    const admin = fakeDb()
    const res = await check(admin, { response: '24 m' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ correct: false, reason: 'value', feedback: 'Fake feedback: digits swapped.' })
    expect(inserts(admin)[0].payload.correct).toBe(false)
  })

  it('an unknown wrong value has no feedback', async () => {
    const res = await check(fakeDb(), { response: '7 m' })
    expect(res.body).toMatchObject({ correct: false, reason: 'value' })
    expect(res.body.feedback).toBeUndefined()
  })

  it('includes the solution once an attempt exists (this one included)', async () => {
    const res = await check(fakeDb(), { response: '7 m' })
    expect(res.body.solution).toEqual(FAKE_PRIVATE.solution)
  })

  it('the same attempt_id twice inserts once and answers the same', async () => {
    const admin = fakeDb()
    const body = { attempt_id: nextUuid(), item_id: ITEM, part_id: 'a', response: '24 m' }
    const first = await call(admin, { body })
    const second = await call(admin, { body })
    expect(second.statusCode).toBe(200)
    expect(second.body).toEqual(first.body)
    expect(admin.db.attempts).toHaveLength(1)
    expect(inserts(admin)).toHaveLength(1)
  })

  it('a replay returns the stored verdict even if the resent response differs', async () => {
    const admin = fakeDb()
    const id = nextUuid()
    await call(admin, { body: { attempt_id: id, item_id: ITEM, part_id: 'a', response: '42 m' } })
    const again = await call(admin, { body: { attempt_id: id, item_id: ITEM, part_id: 'a', response: '7 m' } })
    expect(again.body).toMatchObject({ correct: true, reason: 'ok' })
    expect(admin.db.attempts).toHaveLength(1)
  })

  it("an attempt_id belonging to another student is 409 and leaks nothing", async () => {
    const id = nextUuid()
    const admin = fakeDb({ attempts: [{ id, student_id: OTHER_STUDENT, item_id: ITEM, part_id: 'a', response: '42 m', correct: true, reason: 'ok' }] })
    const res = await call(admin, { body: { attempt_id: id, item_id: ITEM, part_id: 'a', response: '1 m' } })
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ error: 'attempt_id_conflict' })
  })

  it('an attempt_id reused for another part is 409', async () => {
    const admin = fakeDb()
    const id = nextUuid()
    await call(admin, { body: { attempt_id: id, item_id: ITEM, part_id: 'a', response: '42 m' } })
    const res = await call(admin, { body: { attempt_id: id, item_id: ITEM, part_id: 'b', response: ['x', 'y', 'z'] } })
    expect(res.statusCode).toBe(409)
  })

  it('the response body never contains the key', async () => {
    const admin = fakeDb()
    for (const response of ['42 m', '24 m', '7 m', 'nonsense']) {
      const res = await check(admin, { response })
      const s = JSON.stringify(res.body)
      expect(s).not.toContain('"key"')
      expect(s).not.toContain('42')
      expect(s).not.toContain('wrong_answers')
    }
  })

  it('grades order answers given as arrays and stores them as JSON text', async () => {
    const admin = fakeDb()
    const res = await check(admin, { part_id: 'b', response: ['x', 'y', 'z'] })
    expect(res.body).toMatchObject({ correct: true, reason: 'ok' })
    expect(inserts(admin)[0].payload.response).toBe('["x","y","z"]')
  })

  it('the 31st check in a minute is 429; a replay is not counted', async () => {
    const admin = fakeDb()
    const ids = []
    for (let i = 0; i < 30; i++) {
      const id = nextUuid()
      ids.push(id)
      const r = await call(admin, { body: { attempt_id: id, item_id: ITEM, part_id: 'a', response: '7 m' } })
      expect(r.statusCode).toBe(200)
    }
    const over = await check(admin)
    expect(over.statusCode).toBe(429)
    expect(over.body).toEqual({ error: 'rate_limited' })
    expect(admin.db.attempts).toHaveLength(30)
    const replay = await call(admin, { body: { attempt_id: ids[0], item_id: ITEM, part_id: 'a', response: '7 m' } })
    expect(replay.statusCode).toBe(200)
  })

  it('no auth is 401', async () => {
    const admin = fakeDb()
    expect((await call(admin, { token: null, body: {} })).statusCode).toBe(401)
    expect((await call(admin, { token: 'bad', body: {} })).statusCode).toBe(401)
    expect(admin.db.attempts).toHaveLength(0)
  })

  it('a caller without a students row is 403 not_student', async () => {
    const res = await check(fakeDb({ caller: TEACHER, isStudent: false }))
    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual({ error: 'not_student' })
  })

  it('unknown item, unknown part, and a part without a key are 404', async () => {
    expect((await check(fakeDb(), { item_id: 'no-such-item' })).statusCode).toBe(404)
    expect((await check(fakeDb(), { part_id: 'zz' })).statusCode).toBe(404)
    expect((await check(fakeDb(), { part_id: 'c' })).statusCode).toBe(404)
    expect((await check(fakeDb({ priv: null }))).statusCode).toBe(404)
  })

  it('a valid assignment is recorded on the attempt', async () => {
    const admin = fakeDb()
    const res = await check(admin, { assignment_id: ASSIGNMENT })
    expect(res.statusCode).toBe(200)
    expect(inserts(admin)[0].payload.assignment_id).toBe(ASSIGNMENT)
  })

  it('assignments the student may not use are 403 not_assigned', async () => {
    const base = { id: ASSIGNMENT, class_id: CLASS, item_ids: [ITEM], opens_at: new Date(Date.now() - 1000).toISOString() }
    const cases = [
      fakeDb({ assignment: null }),                                         // unknown
      fakeDb({ assignment: { ...base, class_id: OTHER_CLASS } }),          // not enrolled
      fakeDb({ assignment: { ...base, item_ids: ['other-item'] } }),        // item not in it
      fakeDb({ assignment: { ...base, opens_at: new Date(Date.now() + 3600e3).toISOString() } }), // not open
    ]
    for (const admin of cases) {
      const res = await check(admin, { assignment_id: ASSIGNMENT })
      expect(res.statusCode).toBe(403)
      expect(res.body).toEqual({ error: 'not_assigned' })
      expect(admin.db.attempts).toHaveLength(0)
    }
  })

  it('rejects bad bodies with 400', async () => {
    const bad = [
      { attempt_id: 'nope' },
      { item_id: 5 },
      { part_id: '' },
      { response: 42 },
      { response: [1, 2] },
      { response: 'x'.repeat(501) },
      { response: Array.from({ length: 60 }, () => 'abcdefghij') },
      { assignment_id: 'nope' },
      { hints_used: -1 },
      { hints_used: 1.5 },
      { time_ms: 'soon' },
    ]
    for (const over of bad) {
      const admin = fakeDb()
      const res = await check(admin, over)
      expect(res.statusCode, JSON.stringify(over).slice(0, 60)).toBe(400)
      expect(admin.db.attempts).toHaveLength(0)
    }
  })

  it('only POST is allowed', async () => {
    const res = await call(fakeDb(), { method: 'GET' })
    expect(res.statusCode).toBe(405)
  })

  it('logs neither responses nor keys', async () => {
    const spies = ['log', 'info', 'warn', 'error', 'debug'].map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
    const admin = fakeDb()
    admin.db.resolve = () => { throw Object.assign(new Error('boom 42 m secret'), { code: 'XX000' }) }
    const res = await check(admin, { response: 'my-unique-response' })
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'server_error' })
    const out = JSON.stringify(spies.flatMap((s) => s.mock.calls))
    expect(out).not.toContain('my-unique-response')
    expect(out).not.toContain('secret')
  })
})
