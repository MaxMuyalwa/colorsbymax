// The bell: tells a site's owner when a newer colorsbymax is out, with how to update, and shows
// Max's own messages (written in the colorsbymax admin space). Once a day at most, the switcher
// asks npm for the latest version and mrmaxdesigns.com for the messages; nothing is sent but the
// request itself. By default this happens only on development addresses (localhost and the like),
// where the owner works: visitors to a live site never see it. Config `updates`: true for
// everywhere, false for never.

import { useCallback, useEffect, useState } from 'react'

/** This copy's version, built in when the package is built. */
export const VERSION = typeof __COLORSBYMAX_VERSION__ === 'string' ? __COLORSBYMAX_VERSION__ : null

const LATEST = 'https://registry.npmjs.org/colorsbymax/latest'
const NOTICES = 'https://www.mrmaxdesigns.com/colorsbymax/api/notices'
const CHANGELOG_SOURCE = 'https://raw.githubusercontent.com/MaxMuyalwa/colorsbymax/main/CHANGELOG.md'
export const CHANGELOG_PAGE = 'https://www.mrmaxdesigns.com/colorsbymax/docs#changelog'
export const UPDATE_COMMAND = 'npm install colorsbymax@latest'
export const updatePrompt = (latest) =>
  `Update colorsbymax in this project to the latest version${latest ? ` (${latest})` : ''}: run ${UPDATE_COMMAND}, then read the changelog at ${CHANGELOG_PAGE} for every version since the one installed, and make any changes its "Upgrading" notes ask for. If the site has a colorsbymax pre-paint script copied into its HTML, replace it with the current prePaintScript() output. Don't change anything else.`

const DAY = 24 * 60 * 60 * 1000
const MAX_NOTES = 6

/** Whether this page is on a development address: localhost, a .local or .test name, a private network. */
export function isDevAddress(host = location.hostname) {
  return (
    ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'].includes(host) ||
    /\.(localhost|local|test)$/.test(host) ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
  )
}

/** True when version `a` is newer than `b` ("0.5.0" > "0.4.1"). */
export function isNewer(a, b) {
  if (!a || !b) return false
  const parts = (v) => String(v).split(/[.-]/).slice(0, 3).map((n) => parseInt(n, 10) || 0)
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]
  return false
}

async function fetchWithin(url, as = 'json', ms = 6000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal, credentials: 'omit' })
    if (!res.ok) throw new Error(String(res.status))
    return as === 'json' ? await res.json() : await res.text()
  } finally {
    clearTimeout(timer)
  }
}

/** The headline of each change in a version's changelog section: its bold lead, or its start. */
export function notesFor(changelog, version) {
  const start = changelog.indexOf(`## ${version}`)
  if (start < 0) return []
  const rest = changelog.slice(start).split('\n').slice(1)
  const end = rest.findIndex((line) => line.startsWith('## '))
  return rest
    .slice(0, end < 0 ? undefined : end)
    .filter((line) => line.startsWith('- '))
    .map((line) => {
      const bold = line.match(/\*\*(.+?)\*\*/)?.[1]
      const plain = (bold ?? line.slice(2)).replace(/[*`]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim()
      const tidy = plain.replace(/[,;:]$/, '')
      return tidy.length > 140 ? `${tidy.slice(0, 139)}…` : tidy
    })
    .filter((note) => !/^upgrading/i.test(note))
    .slice(0, MAX_NOTES)
}

/** The latest published version and its changelog headlines, as the bell shows them (no caching). */
export async function latestRelease() {
  const { version } = await fetchWithin(LATEST)
  let notes = []
  try {
    notes = notesFor(await fetchWithin(CHANGELOG_SOURCE, 'text'), version)
  } catch {}
  return { version, notes }
}

const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

const cleanNotices = (list) =>
  (Array.isArray(list) ? list : [])
    .filter((n) => n && typeof n.id === 'string' && typeof n.title === 'string')
    .map((n) => ({
      id: n.id.slice(0, 40),
      title: n.title.slice(0, 80),
      text: String(n.text ?? '').slice(0, 400),
      link: /^https:\/\//.test(n.link ?? '') ? n.link : /^\//.test(n.link ?? '') ? `https://www.mrmaxdesigns.com${n.link}` : '',
      label: String(n.label ?? '').slice(0, 40),
      date: String(n.date ?? '').slice(0, 10),
    }))
    .slice(0, 10)

/** The latest version, its changelog headlines and Max's messages: from today's check, or a new one. */
async function check(storageKey) {
  const key = `${storageKey}:updates`
  const cached = read(key)
  if (cached && Date.now() - cached.at < DAY) return cached
  const [latest, notices] = await Promise.allSettled([fetchWithin(LATEST), fetchWithin(NOTICES)])
  const version = latest.status === 'fulfilled' && typeof latest.value?.version === 'string' ? latest.value.version : (cached?.latest ?? null)
  let notes = cached?.latest === version ? (cached?.notes ?? []) : []
  if (version && isNewer(version, VERSION) && !notes.length) {
    try {
      notes = notesFor(await fetchWithin(CHANGELOG_SOURCE, 'text'), version)
    } catch {}
  }
  const result = {
    at: Date.now(),
    latest: version,
    notes,
    notices: notices.status === 'fulfilled' ? cleanNotices(notices.value?.notices) : (cached?.notices ?? []),
  }
  write(key, result)
  return result
}

/**
 * What the bell shows: whether a newer version is out (with its headlines), Max's messages, and
 * whether any of it is new since the owner last looked. `markSeen()` clears the dot.
 */
export function useUpdates(storageKey, enabled) {
  const [data, setData] = useState(null)
  const [seen, setSeen] = useState(() => read(`${storageKey}:updates-seen`) ?? { version: null, notices: [] })
  useEffect(() => {
    if (!enabled) return
    let live = true
    // A moment after the page has settled, so it never competes with the site loading.
    const timer = setTimeout(() => check(storageKey).then((d) => live && setData(d), () => {}), 3000)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [storageKey, enabled])
  const update = Boolean(data?.latest && isNewer(data.latest, VERSION))
  const notices = data?.notices ?? []
  const unseen = enabled && ((update && seen.version !== data.latest) || notices.some((n) => !seen.notices.includes(n.id)))
  const markSeen = useCallback(() => {
    if (!data) return
    const next = { version: data.latest, notices: (data.notices ?? []).map((n) => n.id) }
    setSeen(next)
    write(`${storageKey}:updates-seen`, next)
  }, [data, storageKey])
  return { enabled, current: VERSION, latest: data?.latest ?? null, update, notes: data?.notes ?? [], notices, unseen, markSeen, checked: Boolean(data) }
}
