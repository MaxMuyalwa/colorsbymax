// The feedback inbox, for the signed-in admin only: GET lists every report, GET ?id=&file= sends
// one screenshot, POST { id, status } marks a report new or done.
import { adminOf, fromSite, json } from '../_lib/admin.js'
import { listReports, readShot, setStatus } from '../_lib/inbox.js'

const signedIn = (request) => {
  try {
    return adminOf(request)
  } catch {
    return null
  }
}
const PRIVATE = { 'Cache-Control': 'private, no-store' }

export async function GET(request) {
  if (!signedIn(request)) return json(401, { error: 'Sign in first.' })
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  const file = url.searchParams.get('file')
  try {
    if (id && file) {
      const shot = await readShot(id, file)
      return shot ? new Response(shot.bytes, { headers: { 'Content-Type': shot.type, ...PRIVATE } }) : json(404, { error: 'Not found.' })
    }
    return json(200, { reports: await listReports() }, PRIVATE)
  } catch (e) {
    console.error(e)
    return json(502, { error: 'Couldn’t read the inbox just now. Check the token can reach the feedback repo.', reports: [] })
  }
}

export async function POST(request) {
  if (!fromSite(request)) return json(403, { error: 'Not allowed.' })
  if (!signedIn(request)) return json(401, { error: 'Sign in first.' })
  const { id, status } = (await request.json().catch(() => null)) ?? {}
  try {
    await setStatus(id, status)
    return json(200, { ok: true })
  } catch (e) {
    console.error(e)
    return json(400, { error: 'Couldn’t update that report.' })
  }
}
