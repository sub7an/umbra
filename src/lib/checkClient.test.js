import { describe, it, expect, vi } from 'vitest'
vi.mock('./supabase', () => ({ supabase: null }))
import { makeCheckClient, MAX_RETRIES, CheckError, numericHint, reasonText, mayHaveBeenRecorded, attemptIdFor } from './checkClient'

const ok = (body) => ({ ok: true, status: 200, json: async () => body })
const fail = (status, error) => ({ ok: false, status, json: async () => ({ error }) })
const body = { attempt_id: '11111111-1111-4111-8111-111111111111', item_id: 'x', part_id: 'a', response: '1' }
const client = (fetchImpl) => makeCheckClient({ getToken: async () => 't', fetchImpl, backoff: async () => {} })

describe('checkClient', () => {
  it('retries a network error, reusing the same attempt id', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(ok({ correct: true, reason: 'ok' }))
    await expect(client(fetchImpl)(body)).resolves.toEqual({ correct: true, reason: 'ok' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const ids = fetchImpl.mock.calls.map(([, init]) => JSON.parse(init.body).attempt_id)
    expect(new Set(ids)).toEqual(new Set([body.attempt_id]))
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer t')
  })
  it(`gives up after ${MAX_RETRIES} retries`, async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(client(fetchImpl)(body)).rejects.toMatchObject({ code: 'network' })
    expect(fetchImpl).toHaveBeenCalledTimes(MAX_RETRIES + 1)
  })
  it('never retries an HTTP error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fail(403, 'not_assigned'))
    const err = await client(fetchImpl)(body).catch((e) => e)
    expect(err).toBeInstanceOf(CheckError)
    expect(err.code).toBe('not_assigned')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  it('retries a gateway error (502) with the same id, then takes the stored verdict', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(fail(502, undefined))
      .mockResolvedValueOnce(ok({ correct: false, reason: 'value' }))
    await expect(client(fetchImpl)(body)).resolves.toEqual({ correct: false, reason: 'value' })
    const ids = fetchImpl.mock.calls.map(([, init]) => JSON.parse(init.body).attempt_id)
    expect(ids).toEqual([body.attempt_id, body.attempt_id])
  })
  it('a 500 is not retried automatically but reports its status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fail(500, 'server_error'))
    await expect(client(fetchImpl)(body)).rejects.toMatchObject({ status: 500 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  it('refuses without a session', async () => {
    const c = makeCheckClient({ getToken: async () => null, fetchImpl: vi.fn() })
    await expect(c(body)).rejects.toMatchObject({ code: 'not_authenticated' })
  })
})

describe('pending attempt ids (manual resubmission)', () => {
  it('keeps the id after a network error or any 5xx', () => {
    expect(mayHaveBeenRecorded(new CheckError('network'))).toBe(true)
    expect(mayHaveBeenRecorded(new CheckError('server_error', 500))).toBe(true)
    expect(mayHaveBeenRecorded(new CheckError(undefined, 504))).toBe(true)
  })
  it('drops it after an answer from the server (4xx)', () => {
    expect(mayHaveBeenRecorded(new CheckError('not_assigned', 403))).toBe(false)
    expect(mayHaveBeenRecorded(new CheckError('rate_limited', 429))).toBe(false)
  })
  it('reuses the pending id only for the same response', () => {
    const make = vi.fn(() => 'fresh')
    expect(attemptIdFor({ id: 'p', text: '42 m' }, '42 m', make)).toBe('p')
    expect(attemptIdFor({ id: 'p', text: '42 m' }, '43 m', make)).toBe('fresh')
    expect(attemptIdFor(null, '42 m', make)).toBe('fresh')
  })
})

describe('numericHint', () => {
  it('reads "Give a number only" from the stem', () => {
    expect(numericHint('Calculate the angle. Give a number only, without the unit (in degrees).').unit).toBe(false)
  })
  it('asks for a unit by default', () => {
    expect(numericHint('Calculate the wavelength of the light.').unit).toBe(true)
  })
  it('knows unitless quantities', () => {
    expect(numericHint('Calculate the Lorentz factor $\\gamma$ for the ship.').unit).toBe(false)
  })
})

describe('reasonText', () => {
  it('maps checker reasons to student text', () => {
    expect(reasonText('unit')).toMatch(/unit/i)
    expect(reasonText('sig_figs')).toMatch(/significant figures/)
    expect(reasonText('format')).toMatch(/format/)
  })
})
