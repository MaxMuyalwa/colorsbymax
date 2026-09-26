// Saves the site's settings, for the signed-in admin only: landing page text (strings, capped)
// and colour panel features (true or false). Anything else is dropped.
import { adminOf, fromSite, json, saveSettings } from '../_lib/admin.js'

const TEXT_KEYS = /^[a-z][\w.]{0,60}$/
const MAX_TEXT = 600

export async function POST(request) {
  if (!fromSite(request)) return json(403, { error: 'Not allowed.' })
  let login = null
  try {
    login = adminOf(request)
  } catch {}
  if (!login) return json(401, { error: 'Sign in first.' })
  const data = (await request.json().catch(() => null)) ?? {}
  const text = Object.fromEntries(
    Object.entries(data.text ?? {})
      .filter(([k, v]) => TEXT_KEYS.test(k) && typeof v === 'string')
      .map(([k, v]) => [k, v.slice(0, MAX_TEXT)]),
  )
  const features = Object.fromEntries(Object.entries(data.features ?? {}).filter(([k, v]) => TEXT_KEYS.test(k) && typeof v === 'boolean'))
  try {
    await saveSettings({ text, features, updated: new Date().toISOString() }, login)
    return json(200, { ok: true })
  } catch (e) {
    console.error(e)
    return json(502, { error: 'GitHub didn’t take it. Try again in a moment.' })
  }
}
