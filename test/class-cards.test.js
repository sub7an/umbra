import { describe, it, expect, vi, afterEach } from 'vitest'
import { createHandler, makeUsername, makePassphrase } from '../api/class-cards'
import { WORDS } from '../api/_lib/words'

const STAFF = 'a0000000-0000-0000-0000-0000000000a1'
const OTHER = 'b0000000-0000-0000-0000-0000000000b1'
const SCHOOL = 'aaaaaaaa-0000-0000-0000-000000000000'
const CLASS = 'c0000000-0000-0000-0000-0000000000a1'
const STUDENT = '50000000-0000-0000-0000-000000000001'

// Minimal PostgREST-style query builder: every call is recorded, and `resolve`
// answers with { data, error } from the table name and the recorded state.
function builder(table, resolve, log) {
  const st = { table, op: 'select', filters: {}, single: false }
  const done = () => { log.push(st); return Promise.resolve(resolve(st)) }
  const b = {
    select(cols) { st.cols = cols; return b },
    update(payload) { st.op = 'update'; st.payload = payload; return b },
    eq(k, v) { st.filters[k] = v; return b },
    maybeSingle() { st.single = true; return done() },
    then(ok, bad) { return done().then(ok, bad) },
  }
  return b
}

function fakeAdmin({
  caller = STAFF,
  staffSchools = { [STAFF]: [SCHOOL] },
  cls = { id: CLASS, school_id: SCHOOL, archived_at: null },
  takenUsernames = [],
  createErrors = [],          // error per createUser call, in order (undefined = ok)
  enrolError = null,
  enrolFailOnCall = 0,        // 1-based; 0 = always (when enrolError set)
  studentCardSchool = SCHOOL,   // students.card_school_id of the PATCH target (null = Google)
  studentRow = true,            // false: the PATCH target has no students row
  studentMeta = { umbra_card: true },
  studentUsername = 'amira-1234',
  seats = 150,
  plan = 'pilot',
  usedSeats = 0,
  revokeError = null,
} = {}) {
  const log = []
  let created = 0
  let enrolCalls = 0
  const rpcCalls = []
  const resolve = (st) => {
    if (st.table === 'classes') return { data: cls && st.filters.id === cls.id ? cls : null, error: null }
    if (st.table === 'staff') {
      const schools = staffSchools[st.filters.user_id] || []
      if (st.single) {
        return { data: schools.includes(st.filters.school_id) ? { school_id: st.filters.school_id } : null, error: null }
      }
      return { data: schools.map((school_id) => ({ school_id })), error: null }
    }
    if (st.table === 'schools') return { data: { seats, plan }, error: null }
    if (st.table === 'students' && 'username' in st.filters) {
      return { data: takenUsernames.includes(st.filters.username) ? { user_id: 'x' } : null, error: null }
    }
    if (st.table === 'students' && 'card_school_id' in st.filters) return { data: null, count: usedSeats, error: null }
    if (st.table === 'students') {
      return { data: studentRow ? { username: studentUsername, card_school_id: studentCardSchool } : null, error: null }
    }
    throw new Error(`unexpected table ${st.table}`)
  }
  const admin = {
    log,
    from: (table) => builder(table, resolve, log),
    rpcCalls,
    rpc: vi.fn(async (name, args) => {
      rpcCalls.push([name, args])
      if (name === 'revoke_user_sessions') return { data: null, error: revokeError }
      enrolCalls += 1
      if (enrolError && (!enrolFailOnCall || enrolCalls === enrolFailOnCall)) return { data: null, error: enrolError }
      return { data: null, error: null }
    }),
    auth: {
      getUser: vi.fn(async (token) => (token === 'good'
        ? { data: { user: { id: caller } }, error: null }
        : { data: { user: null }, error: { message: 'invalid JWT' } })),
      admin: {
        createUser: vi.fn(async ({ email }) => {
          const err = createErrors[created]
          created += 1
          if (err) return { data: { user: null }, error: err }
          return { data: { user: { id: `u-${created}`, email } }, error: null }
        }),
        deleteUser: vi.fn(async () => ({ data: {}, error: null })),
        getUserById: vi.fn(async (id) => ({ data: { user: { id, app_metadata: studentMeta } }, error: null })),
        updateUserById: vi.fn(async (id) => ({ data: { user: { id } }, error: null })),
      },
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

const METHODS = ['log', 'info', 'warn', 'error', 'debug', 'trace']
function spyConsole() {
  return METHODS.map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
}
function logged(spies) {
  return JSON.stringify(spies.flatMap((s) => s.mock.calls), (_, v) => (v instanceof Error ? v.message + v.stack : v))
}

afterEach(() => vi.restoreAllMocks())

describe('makeUsername', () => {
  it('uses the slugged first name and 4 digits', async () => {
    expect(await makeUsername('Amira Khan', async () => false)).toMatch(/^amira-\d{4}$/)
  })
  it('strips diacritics, caps at 12 characters, falls back to student', async () => {
    expect(await makeUsername('  Zoë-Ann  Smith', async () => false)).toMatch(/^zoeann-\d{4}$/)
    expect(await makeUsername('Bartholomewwwwww', async () => false)).toMatch(/^bartholomeww-\d{4}$/)
    expect(await makeUsername('李雷', async () => false)).toMatch(/^student-\d{4}$/)
  })
  it('retries while the username is taken', async () => {
    const taken = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValue(false)
    expect(await makeUsername('Ben', taken)).toMatch(/^ben-\d{4}$/)
    expect(taken).toHaveBeenCalledTimes(3)
  })
  it('gives up after a bounded number of tries', async () => {
    await expect(makeUsername('Ben', async () => true)).rejects.toThrow()
  })
})

describe('makePassphrase', () => {
  it('yields 3 words, each in the wordlist', () => {
    for (let i = 0; i < 50; i++) {
      const words = makePassphrase().split('-')
      expect(words).toHaveLength(3)
      for (const w of words) expect(WORDS).toContain(w)
    }
  })
  it('rejects random values past the last whole multiple of the list size (no modulo bias)', () => {
    const limit = Math.floor(2 ** 32 / WORDS.length) * WORDS.length
    const values = [limit, 2 ** 32 - 1, 0, 1, limit - 1]
    const rand = (arr) => { arr[0] = values.shift(); return arr }
    expect(makePassphrase(rand)).toBe([WORDS[0], WORDS[1], WORDS[(limit - 1) % WORDS.length]].join('-'))
  })
})

describe('class-cards handler: auth and validation', () => {
  it('405 for other methods', async () => {
    const res = await call(fakeAdmin(), { method: 'GET' })
    expect(res.statusCode).toBe(405)
  })
  it('401 without a bearer token or with an invalid one', async () => {
    expect((await call(fakeAdmin(), { token: null, body: { class_id: CLASS, names: ['A'] } })).statusCode).toBe(401)
    expect((await call(fakeAdmin(), { token: 'bad', body: { class_id: CLASS, names: ['A'] } })).statusCode).toBe(401)
  })
  it('POST by a non-staff user → 403', async () => {
    const admin = fakeAdmin({ caller: OTHER })
    const res = await call(admin, { body: { class_id: CLASS, names: ['Amira Khan'] } })
    expect(res.statusCode).toBe(403)
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled()
  })
  it('POST for an unknown class → 403 (no existence leak)', async () => {
    const res = await call(fakeAdmin({ cls: null }), { body: { class_id: CLASS, names: ['A'] } })
    expect(res.statusCode).toBe(403)
  })
  it('POST with 61 names → 400', async () => {
    const names = Array.from({ length: 61 }, (_, i) => `Student ${i}`)
    const admin = fakeAdmin()
    expect((await call(admin, { body: { class_id: CLASS, names } })).statusCode).toBe(400)
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled()
  })
  it('POST with bad bodies → 400', async () => {
    for (const body of [
      undefined,
      { class_id: CLASS, names: [] },
      { class_id: CLASS, names: ['   '] },
      { class_id: CLASS, names: ['x'.repeat(41)] },
      { class_id: CLASS, names: [42] },
      { class_id: 'not-a-uuid', names: ['A'] },
      { names: ['A'] },
    ]) {
      expect((await call(fakeAdmin(), { body })).statusCode).toBe(400)
    }
  })
  it('POST to an archived class → 409', async () => {
    const res = await call(fakeAdmin({ cls: { id: CLASS, school_id: SCHOOL, archived_at: '2026-01-01' } }),
      { body: { class_id: CLASS, names: ['A'] } })
    expect(res.statusCode).toBe(409)
  })
})

describe('POST /api/class-cards', () => {
  it('creates card users with synthetic emails and the card flag, and never logs the passphrase', async () => {
    const spies = spyConsole()
    const admin = fakeAdmin()
    const res = await call(admin, { body: { class_id: CLASS, names: [' Amira Khan ', 'Ben'] } })
    expect(res.statusCode).toBe(201)
    expect(res.body.cards).toHaveLength(2)

    const createCalls = admin.auth.admin.createUser.mock.calls.map((c) => c[0])
    expect(createCalls).toHaveLength(2)
    for (const arg of createCalls) {
      expect(arg.email).toMatch(/@students\.umbra\.invalid$/)
      expect(arg.email_confirm).toBe(true)
      expect(arg.app_metadata).toEqual({ umbra_card: true })
      expect(JSON.stringify(arg.user_metadata ?? {})).not.toMatch(/Amira|Khan/)
    }

    const [card] = res.body.cards
    expect(card.display_name).toBe('Amira Khan')
    expect(card.username).toMatch(/^amira-\d{4}$/)
    expect(createCalls[0].email).toBe(`${card.username}@students.umbra.invalid`)
    expect(createCalls[0].password).toBe(card.passphrase)
    expect(card.student_id).toBe('u-1')
    // One RPC records username and the issuing school (card_school_id = the class's
    // school, derived in the database) and enrols, in one transaction.
    expect(admin.rpc).toHaveBeenCalledWith('enrol_card_student',
      { p_class: CLASS, p_user: 'u-1', p_name: 'Amira Khan', p_username: card.username })
    expect(admin.rpc.mock.calls.some(([n]) => n === 'enrol_student')).toBe(false)

    const out = logged(spies)
    for (const c of res.body.cards) expect(out).not.toContain(c.passphrase)
  })

  it('regenerates the username when auth says the email is already registered, never reusing that user', async () => {
    const admin = fakeAdmin({ createErrors: [{ status: 422, code: 'email_exists', message: 'A user with this email address has already been registered' }] })
    const res = await call(admin, { body: { class_id: CLASS, names: ['Amira'] } })
    expect(res.statusCode).toBe(201)
    expect(admin.auth.admin.createUser).toHaveBeenCalledTimes(2)
    expect(admin.auth.admin.getUserById).not.toHaveBeenCalled()
    expect(admin.rpc).toHaveBeenCalledTimes(1)
  })

  it('gives up after 5 "already registered" errors', async () => {
    const exists = { status: 422, code: 'email_exists', message: 'already registered' }
    const spies = spyConsole()
    const admin = fakeAdmin({ createErrors: Array(10).fill(exists) })
    const res = await call(admin, { body: { class_id: CLASS, names: ['Amira'] } })
    expect(res.statusCode).toBe(500)
    expect(admin.auth.admin.createUser).toHaveBeenCalledTimes(5)
    expect(admin.rpc).not.toHaveBeenCalled()
    const passwords = admin.auth.admin.createUser.mock.calls.map((c) => c[0].password)
    const out = logged(spies)
    for (const p of passwords) expect(out).not.toContain(p)
  })

  it('deletes the just-created auth user when enrol_student fails, and logs no passphrase', async () => {
    const spies = spyConsole()
    const admin = fakeAdmin({ enrolError: { code: 'P0001', message: 'class_archived' } })
    const res = await call(admin, { body: { class_id: CLASS, names: ['Amira'] } })
    expect(res.statusCode).toBe(500)
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith('u-1')
    expect(res.body.cards).toBeUndefined()
    const out = logged(spies)
    expect(out).not.toContain(admin.auth.admin.createUser.mock.calls[0][0].password)
  })

  it('rolls back the whole batch when a later card fails', async () => {
    spyConsole()
    const admin = fakeAdmin({ enrolError: { message: 'boom' }, enrolFailOnCall: 2 })
    const res = await call(admin, { body: { class_id: CLASS, names: ['Amira', 'Ben'] } })
    expect(res.statusCode).toBe(500)
    const deleted = admin.auth.admin.deleteUser.mock.calls.map((c) => c[0]).sort()
    expect(deleted).toEqual(['u-1', 'u-2'])
  })
})

describe('POST seat cap (R16)', () => {
  it('409 seat_limit when existing card students + names exceed the school\'s seats', async () => {
    const admin = fakeAdmin({ seats: 30, usedSeats: 29 })
    const res = await call(admin, { body: { class_id: CLASS, names: ['A', 'B'] } })
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ error: 'seat_limit' })
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled()
  })
  it('allows a batch that exactly fills the seats', async () => {
    const res = await call(fakeAdmin({ seats: 30, usedSeats: 28 }), { body: { class_id: CLASS, names: ['A', 'B'] } })
    expect(res.statusCode).toBe(201)
  })
  it('409 seat_limit when the database cap trips mid-batch (concurrent POSTs), and rolls back', async () => {
    spyConsole()
    const admin = fakeAdmin({ enrolError: { code: 'P0001', message: 'seat_limit' }, enrolFailOnCall: 2 })
    const res = await call(admin, { body: { class_id: CLASS, names: ['A', 'B'] } })
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ error: 'seat_limit' })
    expect(admin.auth.admin.deleteUser.mock.calls.map((c) => c[0]).sort()).toEqual(['u-1', 'u-2'])
  })
})

describe('POST school approval (R32)', () => {
  it('409 school_pending for a school awaiting approval, before any user is created', async () => {
    const admin = fakeAdmin({ plan: 'pending' })
    const res = await call(admin, { body: { class_id: CLASS, names: ['A'] } })
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ error: 'school_pending' })
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled()
  })
  it('409 school_pending when the database refuses mid-batch, and rolls back', async () => {
    spyConsole()
    const admin = fakeAdmin({ enrolError: { code: 'P0001', message: 'school_pending' } })
    const res = await call(admin, { body: { class_id: CLASS, names: ['A'] } })
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ error: 'school_pending' })
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith('u-1')
  })
})

describe('PATCH /api/class-cards (reset)', () => {
  it('calls updateUserById with a new passphrase and returns it once', async () => {
    const spies = spyConsole()
    const admin = fakeAdmin()
    const res = await call(admin, { method: 'PATCH', body: { student_id: STUDENT } })
    expect(res.statusCode).toBe(200)
    expect(res.body.username).toBe('amira-1234')
    expect(res.body.passphrase.split('-')).toHaveLength(3)
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith(STUDENT, { password: res.body.passphrase })
    expect(logged(spies)).not.toContain(res.body.passphrase)
  })
  it('revokes the student\'s sessions after changing the passphrase', async () => {
    const admin = fakeAdmin()
    await call(admin, { method: 'PATCH', body: { student_id: STUDENT } })
    expect(admin.rpc).toHaveBeenCalledWith('revoke_user_sessions', { p_user: STUDENT })
    const updOrder = admin.auth.admin.updateUserById.mock.invocationCallOrder[0]
    const revokeOrder = admin.rpc.mock.invocationCallOrder[admin.rpc.mock.calls.findIndex(([n]) => n === 'revoke_user_sessions')]
    expect(revokeOrder).toBeGreaterThan(updOrder)
  })
  it('500 when revoking sessions fails, without logging the new passphrase', async () => {
    const spies = spyConsole()
    const admin = fakeAdmin({ revokeError: { code: 'XX000', message: 'boom' } })
    const res = await call(admin, { method: 'PATCH', body: { student_id: STUDENT } })
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'session_revoke_failed' })
    expect(logged(spies)).not.toContain(admin.auth.admin.updateUserById.mock.calls[0][1].password)
  })
  it('403 for staff of another school where the student is enrolled but which did not issue the card', async () => {
    // OTHER is staff of school B; the student joined a B class, but card_school_id is A.
    const admin = fakeAdmin({ caller: OTHER, staffSchools: { [OTHER]: ['bbbbbbbb-0000-0000-0000-000000000000'] } })
    const res = await call(admin, { method: 'PATCH', body: { student_id: STUDENT } })
    expect(res.statusCode).toBe(403)
    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled()
    expect(admin.rpc).not.toHaveBeenCalled()
  })
  it('403 for an unknown student and for a Google student (no card_school_id)', async () => {
    expect((await call(fakeAdmin({ studentRow: false }), { method: 'PATCH', body: { student_id: STUDENT } })).statusCode).toBe(403)
    const admin = fakeAdmin({ studentCardSchool: null })
    expect((await call(admin, { method: 'PATCH', body: { student_id: STUDENT } })).statusCode).toBe(403)
    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled()
  })
  it('400 when the auth user lacks the card flag (defence in depth)', async () => {
    const admin = fakeAdmin({ studentMeta: { provider: 'google' } })
    const res = await call(admin, { method: 'PATCH', body: { student_id: STUDENT } })
    expect(res.statusCode).toBe(400)
    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled()
  })
  it('400 for a bad body', async () => {
    expect((await call(fakeAdmin(), { method: 'PATCH', body: { student_id: 'nope' } })).statusCode).toBe(400)
    expect((await call(fakeAdmin(), { method: 'PATCH', body: {} })).statusCode).toBe(400)
  })
})
