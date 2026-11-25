// Verifies the caller's Supabase session from `Authorization: Bearer <access token>`.
import { getAdmin } from './supabaseAdmin.js'

export class HttpError extends Error {
  constructor(status, code) {
    super(code)
    this.status = status
    this.code = code
  }
}

// Resolves to { user }; throws HttpError(401) without a valid bearer token.
export async function requireUser(req, admin = getAdmin()) {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  const m = /^Bearer\s+(\S+)$/i.exec(header)
  if (!m) throw new HttpError(401, 'not_authenticated')
  const { data, error } = await admin.auth.getUser(m[1])
  if (error || !data?.user) throw new HttpError(401, 'not_authenticated')
  return { user: data.user }
}
