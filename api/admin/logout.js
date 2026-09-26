// Signs the admin out.
import { clearSession, fromSite, json } from '../_lib/admin.js'

export function POST(request) {
  if (!fromSite(request)) return json(403, { error: 'Not allowed.' })
  return json(200, { ok: true }, { 'Set-Cookie': clearSession(), 'Cache-Control': 'no-store' })
}
