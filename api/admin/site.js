// Saves the site's settings, for the signed-in admin only: landing page text (strings, capped),
// colour panel features (true or false) and the announcement banner. Anything else is dropped.
import { adminOf, fromSite, json, saveSettings } from '../_lib/admin.js'

const TEXT_KEYS = /^[a-z][\w.]{0,60}$/
const MAX_TEXT = 600
const MAX_ANNOUNCEMENT = 200

/** The banner: on or off, its message, an optional link (https, or a path on the site) and style. */
function cleanAnnouncement(a) {
  if (!a || typeof a !== 'object') return undefined
  const link = typeof a.link === 'string' && /^(https:\/\/[^\s"<>]+|\/[^\s"<>]*)$/.test(a.link.trim()) ? a.link.trim().slice(0, 300) : ''
  return {
    on: a.on === true,
    text: String(a.text ?? '').trim().slice(0, MAX_ANNOUNCEMENT),
    link,
    label: link ? String(a.label ?? '').trim().slice(0, 40) : '',
    tone: a.tone === 'soft' ? 'soft' : 'brand',
  }
}

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
    const announcement = cleanAnnouncement(data.announcement)
    await saveSettings({ text, features, ...(announcement ? { announcement } : {}), updated: new Date().toISOString() }, login)
    return json(200, { ok: true })
  } catch (e) {
    console.error(e)
    return json(502, { error: 'GitHub didn’t take it. Try again in a moment.' })
  }
}
