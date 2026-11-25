import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }))

const {
  normaliseCode, codeProblem, BAD_CODE_CHARS, errorMessage, errorCode, parseNames, namesProblem,
  normaliseUsername, normalisePassphrase, makeClassroomApi, ClassroomError,
} = await import('../src/lib/classroomApi')

describe('class codes', () => {
  it('strips whitespace, hyphens and zero-width characters and upper-cases', () => {
    expect(normaliseCode(' ab c-d​ef﻿ ')).toBe('ABCDEF')
    expect(normaliseCode('k7m\t2pq')).toBe('K7M2PQ')
    expect(normaliseCode(null)).toBe('')
  })

  it('reports characters outside the alphabet as soon as they are typed', () => {
    for (const bad of ['O', 'i', 'l', '0', '1', 'ab0']) expect(codeProblem(bad)).toBe('bad_code_chars')
    expect(errorMessage('bad_code_chars')).toBe(BAD_CODE_CHARS)
    expect(BAD_CODE_CHARS).toBe("codes don't use O, I, L, 0 or 1")
  })

  it('needs six characters, and accepts a valid code in any case or spacing', () => {
    expect(codeProblem('ABC')).toBe('code_too_short')
    expect(codeProblem('k7m 2pq')).toBeNull()
  })
})

describe('error messages', () => {
  it('maps RPC and API codes to plain English', () => {
    expect(errorCode({ message: 'invalid_code' })).toBe('invalid_code')
    expect(errorMessage('invalid_code')).toBe("We couldn't find that class code")
    for (const c of ['class_archived', 'card_school_only', 'school_limit', 'seat_limit']) {
      expect(errorMessage(c)).not.toMatch(/_/)
    }
    expect(errorCode({ message: 'Invalid login credentials' })).toBe('invalid_card')
    expect(errorCode({ message: 'boom' })).toBe('unknown')
  })
})

describe('names and card sign-in input', () => {
  it('parses one name per line, dropping blanks', () => {
    expect(parseNames('Amira Khan\r\n\n  Ben Ode  \n')).toEqual(['Amira Khan', 'Ben Ode'])
  })
  it('checks the batch size and name length', () => {
    expect(namesProblem([])).toMatch(/at least one/)
    expect(namesProblem(Array(61).fill('A'))).toMatch(/60/)
    expect(namesProblem(['x'.repeat(41)])).toMatch(/40/)
    expect(namesProblem(['Amira'])).toBeNull()
  })
  it('normalises username and passphrase', () => {
    expect(normaliseUsername(' Amira-0042 ')).toBe('amira-0042')
    expect(normalisePassphrase(' Acorn  Bagel-cider ')).toBe('acorn-bagel-cider')
  })
})

function fakeClient({ rpc, signIn } = {}) {
  return {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      signInWithPassword: signIn ?? (async () => ({ data: {}, error: null })),
    },
    rpc: rpc ?? (async () => ({ data: null, error: null })),
  }
}

describe('makeClassroomApi', () => {
  it('signInWithCard uses the synthetic card email', async () => {
    const signIn = vi.fn(async () => ({ data: { session: {} }, error: null }))
    const api = makeClassroomApi(fakeClient({ signIn }))
    await api.signInWithCard(' Amira-0042', 'acorn bagel cider')
    expect(signIn).toHaveBeenCalledWith({ email: 'amira-0042@students.umbra.invalid', password: 'acorn-bagel-cider' })
  })

  it('signInWithCard turns bad credentials into invalid_card', async () => {
    const api = makeClassroomApi(fakeClient({ signIn: async () => ({ data: null, error: { message: 'Invalid login credentials' } }) }))
    await expect(api.signInWithCard('a', 'b')).rejects.toMatchObject({ code: 'invalid_card' })
  })

  it('joinClass sends the normalised code and maps RPC errors', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'class_archived' } }))
    const api = makeClassroomApi(fakeClient({ rpc }))
    const err = await api.joinClass('k7m-2pq', ' Amira ').catch((e) => e)
    expect(rpc).toHaveBeenCalledWith('join_class', { p_code: 'K7M2PQ', p_display_name: 'Amira' })
    expect(err).toBeInstanceOf(ClassroomError)
    expect(err.code).toBe('class_archived')
  })

  it('createClass returns the first row of create_class', async () => {
    const rpc = vi.fn(async () => ({ data: [{ id: 'c1', code: 'K7M2PQ' }], error: null }))
    const api = makeClassroomApi(fakeClient({ rpc }))
    expect(await api.createClass({ schoolId: 's1', name: ' 12P ', syllabus: 'aqa', year: '' }))
      .toEqual({ id: 'c1', code: 'K7M2PQ' })
    expect(rpc).toHaveBeenCalledWith('create_class', { p_school: 's1', p_name: '12P', p_syllabus: 'aqa', p_year: null })
  })

  it('issueCards posts with the bearer token and maps seat_limit', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, json: async () => ({ error: 'seat_limit' }) }))
    const api = makeClassroomApi(fakeClient(), fetchImpl)
    await expect(api.issueCards('c1', ['Amira'])).rejects.toMatchObject({ code: 'seat_limit' })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/class-cards')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body)).toEqual({ class_id: 'c1', names: ['Amira'] })
  })

  it('resetCard returns the new passphrase', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ username: 'amira-0042', passphrase: 'a-b-c' }) }))
    const api = makeClassroomApi(fakeClient(), fetchImpl)
    expect(await api.resetCard('s1')).toEqual({ username: 'amira-0042', passphrase: 'a-b-c' })
    expect(fetchImpl.mock.calls[0][1].method).toBe('PATCH')
  })

  it('throws not_configured without a client', async () => {
    await expect(makeClassroomApi(null).joinClass('ABCDEF', 'x')).rejects.toMatchObject({ code: 'not_configured' })
  })
})
