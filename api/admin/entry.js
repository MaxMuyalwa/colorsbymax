// Saves or deletes one post or testimonial, for the signed-in admin only. Each change is a commit
// on the content branch of the repo, so everything has history and nothing is lost.
import { KINDS, SLUG, adminOf, deleteEntry, fromSite, json, saveEntry } from '../_lib/admin.js'

const MAX_BODY = 100_000
const MAX_FIELD = 300

function check(request) {
  if (!fromSite(request)) return [null, json(403, { error: 'Not allowed.' })]
  let login = null
  try {
    login = adminOf(request)
  } catch {
    return [null, json(503, { error: 'Admin isn’t set up yet.' })]
  }
  return login ? [login, null] : [null, json(401, { error: 'Sign in first.' })]
}

async function readEntry(request) {
  const data = await request.json().catch(() => null)
  if (!data || !KINDS[data.kind] || !SLUG.test(data.slug || '')) return null
  return data
}

export async function POST(request) {
  const [login, denied] = check(request)
  if (denied) return denied
  const data = await readEntry(request)
  if (!data) return json(400, { error: 'That entry isn’t complete.' })
  const body = String(data.body || '')
  if (!body.trim() || body.length > MAX_BODY) return json(400, { error: 'Write something first (up to 100,000 characters).' })
  const fields = Object.fromEntries(KINDS[data.kind].fields.map((f) => [f, String(data.fields?.[f] ?? '').slice(0, MAX_FIELD)]))
  try {
    await saveEntry(data.kind, data.slug, fields, body, login)
    return json(200, { ok: true })
  } catch (e) {
    console.error(e)
    return json(502, { error: 'GitHub didn’t take it. Try again in a moment.' })
  }
}

export async function DELETE(request) {
  const [login, denied] = check(request)
  if (denied) return denied
  const data = await readEntry(request)
  if (!data) return json(400, { error: 'Which one?' })
  try {
    await deleteEntry(data.kind, data.slug, login)
    return json(200, { ok: true })
  } catch (e) {
    console.error(e)
    return json(502, { error: 'GitHub didn’t take it. Try again in a moment.' })
  }
}
