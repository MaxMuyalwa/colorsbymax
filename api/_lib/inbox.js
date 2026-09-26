// The feedback inbox: every report Max's sites' feedback forms send (colorsbymax, and later
// mrmaxdesigns.com), kept in one PRIVATE GitHub repo, never a public one: reports hold people's
// names, emails and screenshots. One folder per report: report.json, which says which site it
// came from, plus each screenshot as a file beside it.
//
//   FEEDBACK_REPO          owner/name of the private repo (default MaxMuyalwa/mrmaxdesigns-feedback)
//   FEEDBACK_SITE          which site this deployment is (default colorsbymax)
//   GITHUB_CONTENT_TOKEN   the fine-grained token, with Contents read and write on that repo too

import { randomBytes } from 'node:crypto'

const REPO = process.env.FEEDBACK_REPO || 'MaxMuyalwa/mrmaxdesigns-feedback'
const SITE = process.env.FEEDBACK_SITE || 'colorsbymax'
const DIR = 'reports'
const MAX_LISTED = 150

const gh = (path, init = {}) =>
  fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${process.env.GITHUB_CONTENT_TOKEN}`,
      ...init.headers,
    },
  })

const put = async (path, bytes, message, sha) => {
  const res = await gh(`/contents/${path}`, { method: 'PUT', body: JSON.stringify({ message, content: Buffer.from(bytes).toString('base64'), ...(sha ? { sha } : {}) }) })
  if (!res.ok) throw new Error(`GitHub said ${res.status} saving ${path}`)
}
const safeName = (name, i) => `${i + 1}-${String(name || 'screenshot').replace(/[^\w.-]/g, '_').slice(0, 60) || 'screenshot'}`

export const inboxReady = () => Boolean(process.env.GITHUB_CONTENT_TOKEN)

/** Saves one report and its screenshots ({ name, type, bytes }). Returns its id. */
export async function saveReport(report, shots) {
  const id = `${new Date().toISOString().slice(0, 10)}-${randomBytes(4).toString('hex')}`
  const files = []
  for (const [i, shot] of shots.entries()) {
    const file = safeName(shot.name, i)
    await put(`${DIR}/${id}/${file}`, shot.bytes, `Screenshot for ${id}`)
    files.push({ file, name: shot.name, type: shot.type })
  }
  const saved = { id, site: SITE, received: new Date().toISOString(), status: 'new', ...report, screenshots: files }
  await put(`${DIR}/${id}/report.json`, JSON.stringify(saved, null, 2), `Feedback: ${report.kind} "${String(report.summary).slice(0, 60)}"`)
  return id
}

const readJson = async (path) => {
  const res = await gh(`/contents/${path}`)
  if (!res.ok) return null
  const meta = await res.json()
  return { data: JSON.parse(Buffer.from(meta.content, 'base64').toString('utf8')), sha: meta.sha }
}

/** Every report, newest first (the folder names start with the date). */
export async function listReports() {
  const res = await gh(`/contents/${DIR}`)
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`GitHub said ${res.status} listing reports`)
  const dirs = (await res.json())
    .filter((d) => d.type === 'dir')
    .map((d) => d.name)
    .sort()
    .reverse()
    .slice(0, MAX_LISTED)
  const reports = await Promise.all(dirs.map((id) => readJson(`${DIR}/${id}/report.json`).then((r) => r?.data ?? null)))
  return reports.filter(Boolean).sort((a, b) => String(b.received).localeCompare(String(a.received)))
}

/** One screenshot's bytes and type, or null. */
export async function readShot(id, file) {
  if (!/^[\w-]+$/.test(id) || !/^[\w.-]+$/.test(file) || file === 'report.json') return null
  const res = await gh(`/contents/${DIR}/${id}/${file}`, { headers: { Accept: 'application/vnd.github.raw+json' } })
  if (!res.ok) return null
  const type = /\.png$/i.test(file) ? 'image/png' : /\.webp$/i.test(file) ? 'image/webp' : 'image/jpeg'
  return { bytes: await res.arrayBuffer(), type }
}

/** Marks a report new or done. */
export async function setStatus(id, status) {
  if (!/^[\w-]+$/.test(id) || !['new', 'done'].includes(status)) throw new Error('bad report')
  const path = `${DIR}/${id}/report.json`
  const current = await readJson(path)
  if (!current) throw new Error('no such report')
  await put(path, JSON.stringify({ ...current.data, status }, null, 2), `Feedback ${id}: ${status}`, current.sha)
}
