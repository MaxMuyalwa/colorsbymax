// Saves the site's settings, for the signed-in admin only: landing page text (strings, capped),
// colour panel features (true or false), the announcement banner and the messages in colorsbymax's
// bell. Anything else is dropped.
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

const MAX_NOTICES = 10
const cleanLink = (v) => (typeof v === 'string' && /^(https:\/\/[^\s"<>]+|\/[^\s"<>]*)$/.test(v.trim()) ? v.trim().slice(0, 300) : '')

/** The bell's messages: a title, a few lines, an optional link, and when it was written. */
function cleanNotices(list) {
  if (!Array.isArray(list)) return undefined
  return list
    .filter((n) => n && typeof n === 'object' && String(n.title ?? '').trim())
    .slice(0, MAX_NOTICES)
    .map((n) => {
      const link = cleanLink(n.link)
      return {
        id: /^[\w-]{1,40}$/.test(n.id ?? '') ? n.id : `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        title: String(n.title).trim().slice(0, 80),
        text: String(n.text ?? '').trim().slice(0, 400),
        link,
        label: link ? String(n.label ?? '').trim().slice(0, 40) : '',
        date: /^\d{4}-\d{2}-\d{2}$/.test(n.date ?? '') ? n.date : new Date().toISOString().slice(0, 10),
      }
    })
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
    const notices = cleanNotices(data.notices)
    await saveSettings({ text, features, ...(announcement ? { announcement } : {}), ...(notices ? { notices } : {}), updated: new Date().toISOString() }, login)
    return json(200, { ok: true })
  } catch (e) {
    console.error(e)
    return json(502, { error: 'GitHub didn’t take it. Try again in a moment.' })
  }
}
