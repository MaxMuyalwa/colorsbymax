// Shared by the admin functions: the signed session cookie, and reading and writing the site's
// content in the GitHub repo. (Files under api/_lib aren't routes of their own.)
//
// Environment variables (Vercel → the colorsbymax project → Settings → Environment Variables):
//   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET  the GitHub OAuth app's (callback URL below)
//   ADMIN_GITHUB_LOGIN     the only GitHub account allowed in (default MaxMuyalwa)
//   SESSION_SECRET         a long random string that signs the session cookie
//   GITHUB_CONTENT_TOKEN   a fine-grained token with Contents read and write on this repo only
//   CONTENT_BRANCH         where posts and testimonials are saved (default "content")
//   SITE_URL               the site's address (default https://www.mrmaxdesigns.com/colorsbymax)

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const REPO = 'MaxMuyalwa/colorsbymax'
export const SITE_URL = (process.env.SITE_URL || 'https://www.mrmaxdesigns.com/colorsbymax').replace(/\/$/, '')
export const CALLBACK = `${SITE_URL}/api/admin/callback`
export const BRANCH = process.env.CONTENT_BRANCH || 'content'
const ADMIN = (process.env.ADMIN_GITHUB_LOGIN || 'MaxMuyalwa').toLowerCase()
const COOKIE = 'cbm_admin'
const SESSION_DAYS = 14
const ALLOWED_ORIGINS = [/^https:\/\/(www\.)?mrmaxdesigns\.com$/, /^https:\/\/colorsbymax(-[a-z0-9-]+)?\.vercel\.app$/, /^http:\/\/localhost(:\d+)?$/]

export const json = (status, body, headers = {}) => Response.json(body, { status, headers })
export const random = () => randomBytes(24).toString('base64url')

const secret = () => {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) throw new Error('SESSION_SECRET is missing or shorter than 32 characters')
  return s
}
const sign = (payload) => createHmac('sha256', secret()).update(payload).digest('base64url')
const equal = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

export function cookies(request) {
  return Object.fromEntries(
    (request.headers.get('cookie') || '')
      .split(';')
      .map((c) => c.trim().split('='))
      .filter(([k]) => k)
      .map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]),
  )
}

/** A Set-Cookie header value: HttpOnly, Secure, SameSite=Lax, for the site's path. */
export function cookie(name, value, maxAge) {
  const path = new URL(SITE_URL).pathname || '/'
  return `${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`
}

/** The session cookie for a signed-in GitHub login. */
export function sessionCookie(login) {
  const payload = Buffer.from(JSON.stringify({ login, exp: Date.now() + SESSION_DAYS * 864e5 })).toString('base64url')
  return cookie(COOKIE, `${payload}.${sign(payload)}`, SESSION_DAYS * 86400)
}
export const clearSession = () => cookie(COOKIE, '', 0)

/** The signed-in admin's login, or null: the cookie must be ours, unexpired, and the admin's. */
export function adminOf(request) {
  const raw = cookies(request)[COOKIE]
  if (!raw || !raw.includes('.')) return null
  const [payload, mac] = raw.split('.')
  try {
    if (!equal(mac, sign(payload))) return null
    const { login, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return exp > Date.now() && isAdmin(login) ? login : null
  } catch {
    return null
  }
}
export const isAdmin = (login) => typeof login === 'string' && login.toLowerCase() === ADMIN

/** Changes may only come from the site's own pages. */
export function fromSite(request) {
  const origin = request.headers.get('origin')
  return Boolean(origin) && ALLOWED_ORIGINS.some((re) => re.test(origin))
}

// ------------------------------------------------------------------ content in the repo

const api = (path, init = {}) =>
  fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(process.env.GITHUB_CONTENT_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_CONTENT_TOKEN}` } : {}),
      ...init.headers,
    },
  })

/** What the site keeps, and where: posts and testimonials, one Markdown file each. */
export const KINDS = {
  post: { dir: 'content/posts', fields: ['title', 'date', 'summary'] },
  testimonial: { dir: 'content/testimonials', fields: ['name', 'role', 'date'] },
}
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+){0,12}$/

/** "---\nkey: value\n---\nbody" → { fields, body }. Values are one line each. */
export function parseEntry(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) return { fields: {}, body: text }
  const fields = {}
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i > 0) fields[line.slice(0, i).trim()] = JSON.parse(line.slice(i + 1).trim() || '""')
  }
  return { fields, body: m[2] }
}
export const formatEntry = (fields, body) =>
  `---\n${Object.entries(fields)
    .map(([k, v]) => `${k}: ${JSON.stringify(String(v ?? ''))}`)
    .join('\n')}\n---\n${body.trim()}\n`

/** Every entry of a kind, newest first. An absent branch or folder is simply no entries yet. */
export async function listEntries(kind) {
  const { dir } = KINDS[kind]
  const res = await api(`/contents/${dir}?ref=${BRANCH}`)
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`GitHub said ${res.status} listing ${dir}`)
  const files = (await res.json()).filter((f) => f.type === 'file' && f.name.endsWith('.md'))
  const entries = await Promise.all(
    files.map(async (f) => {
      const text = await (await fetch(f.download_url)).text()
      const { fields, body } = parseEntry(text)
      return { slug: f.name.replace(/\.md$/, ''), ...fields, body }
    }),
  )
  return entries.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
}

/** Makes sure the content branch exists, starting it from main. */
async function ensureBranch() {
  if ((await api(`/git/ref/heads/${BRANCH}`)).ok) return
  const main = await api('/git/ref/heads/main')
  if (!main.ok) throw new Error(`GitHub said ${main.status} reading main`)
  const { object } = await main.json()
  const made = await api('/git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha: object.sha }) })
  if (!made.ok && made.status !== 422) throw new Error(`GitHub said ${made.status} creating ${BRANCH}`)
}

const shaOf = async (path) => {
  const res = await api(`/contents/${path}?ref=${BRANCH}`)
  return res.ok ? (await res.json()).sha : null
}

/** Saves (creates or replaces) one entry as a commit on the content branch. */
export async function saveEntry(kind, slug, fields, body, login) {
  await ensureBranch()
  const path = `${KINDS[kind].dir}/${slug}.md`
  const sha = await shaOf(path)
  const res = await api(`/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `${sha ? 'Update' : 'Add'} ${kind} "${fields.title || fields.name || slug}" (admin: ${login})`,
      content: Buffer.from(formatEntry(fields, body)).toString('base64'),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  })
  if (!res.ok) throw new Error(`GitHub said ${res.status} saving ${path}`)
}

/** Deletes one entry, as a commit on the content branch. */
export async function deleteEntry(kind, slug, login) {
  const path = `${KINDS[kind].dir}/${slug}.md`
  const sha = await shaOf(path)
  if (!sha) return
  const res = await api(`/contents/${path}`, {
    method: 'DELETE',
    body: JSON.stringify({ message: `Remove ${kind} "${slug}" (admin: ${login})`, sha, branch: BRANCH }),
  })
  if (!res.ok) throw new Error(`GitHub said ${res.status} deleting ${path}`)
}

// ------------------------------------------------------------------ site settings

/** The site's editable settings (landing page text, colour panel features): one JSON file. */
const SETTINGS = 'content/site.json'

export async function readSettings() {
  const res = await api(`/contents/${SETTINGS}?ref=${BRANCH}`)
  if (res.status === 404) return {}
  if (!res.ok) throw new Error(`GitHub said ${res.status} reading ${SETTINGS}`)
  return JSON.parse(Buffer.from((await res.json()).content, 'base64').toString('utf8'))
}

export async function saveSettings(settings, login) {
  await ensureBranch()
  const sha = await shaOf(SETTINGS)
  const res = await api(`/contents/${SETTINGS}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Update site settings (admin: ${login})`,
      content: Buffer.from(JSON.stringify(settings, null, 2) + '\n').toString('base64'),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  })
  if (!res.ok) throw new Error(`GitHub said ${res.status} saving ${SETTINGS}`)
}
