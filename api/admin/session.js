// Whether the visitor is the signed-in admin. Never cached.
import { adminOf, json } from '../_lib/admin.js'

export function GET(request) {
  let login = null
  try {
    login = adminOf(request)
  } catch {}
  return json(200, { admin: Boolean(login), login }, { 'Cache-Control': 'no-store' })
}
