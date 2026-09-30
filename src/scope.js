// Where the colours go: the whole site (the default), or only some of its pages. Studio sets it,
// and a site can set it for everyone with the `pages` config option. Pages outside it are left
// exactly as the site made them: no theme, no re-colouring, no dark mode.
//
// A page is its path, e.g. "/pricing". One ending in "/*" is a whole section: "/blog/*" is
// /blog and every page under it.

import { useEffect, useState } from 'react'

/** Most pages a scope can list. */
export const MAX_PAGES = 50
/** Most pages Studio remembers seeing, to offer them back. */
export const MAX_SEEN = 30

/** A path as colorsbymax compares it: no query or hash, no trailing slash (but "/" for the home page). */
export function normalPath(input) {
  if (typeof input !== 'string') return null
  let p = input.trim().split(/[?#]/)[0]
  if (!p) return null
  try {
    // A full link on this site counts as its path.
    if (/^https?:\/\//i.test(p)) {
      const url = new URL(p)
      if (url.origin !== location.origin) return null
      p = url.pathname
    }
  } catch {
    return null
  }
  if (!p.startsWith('/')) p = `/${p}`
  const section = p.endsWith('/*')
  p = p.replace(/\/\*$/, '').replace(/\/+/g, '/').replace(/\/$/, '')
  if (!/^[\w\-./~%@+:]*$/.test(p) || p.length > 200) return null
  return section ? `${p}/*` : p || '/'
}

/** A clean list of pages: valid, without duplicates, at most MAX_PAGES. */
export const cleanPages = (list) => [...new Set((Array.isArray(list) ? list : []).map(normalPath).filter(Boolean))].slice(0, MAX_PAGES)

/**
 * The scope a visitor chose, or null for none (the site's `pages` config, else the whole site).
 * @returns {{ mode: 'all' | 'pages', pages: string[] } | null}
 */
export function cleanScope(input) {
  if (!input || typeof input !== 'object') return null
  return { mode: input.mode === 'pages' ? 'pages' : 'all', pages: cleanPages(input.pages) }
}

/** Whether a page gets the colours. */
export const pageMatches = (page, path) => (page.endsWith('/*') ? path === page.slice(0, -2) || path.startsWith(page.slice(0, -1)) : path === page)
export const inScope = (scope, path) => !scope || scope.mode !== 'pages' || scope.pages.some((p) => pageMatches(p, path))

// Single-page apps change page without loading one; history.pushState and replaceState announce it.
const NAVIGATE = 'colorsbymax:navigate'
const WATCHED = Symbol.for('colorsbymax.history')
function watchHistory() {
  if (history[WATCHED]) return
  history[WATCHED] = true
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method]
    history[method] = function (...args) {
      const result = original.apply(this, args)
      window.dispatchEvent(new Event(NAVIGATE))
      return result
    }
  }
}

/** The current page's path, following a single-page app's navigation too. */
export function usePathname() {
  const [path, setPath] = useState(() => normalPath(location.pathname) ?? '/')
  useEffect(() => {
    watchHistory()
    const update = () => setPath(normalPath(location.pathname) ?? '/')
    window.addEventListener(NAVIGATE, update)
    window.addEventListener('popstate', update)
    update()
    return () => {
      window.removeEventListener(NAVIGATE, update)
      window.removeEventListener('popstate', update)
    }
  }, [])
  return path
}

const FILE = /\.(?!html?$)[a-z0-9]{2,5}$/i

/** The site's pages this page links to (its nav, footer and so on), for Studio to offer. */
export function linkedPages(max = MAX_SEEN) {
  const found = new Set()
  for (const a of document.querySelectorAll('a[href]')) {
    if (a.closest('colorsbymax-root, [data-colorsbymax]')) continue
    const href = a.getAttribute('href')
    if (!href || /^(mailto|tel|javascript):/i.test(href) || href.startsWith('#')) continue
    let url
    try {
      url = new URL(href, location.href)
    } catch {
      continue
    }
    if (url.origin !== location.origin || FILE.test(url.pathname)) continue
    const path = normalPath(url.pathname)
    if (path) found.add(path)
    if (found.size >= max) break
  }
  return [...found]
}

/** The config line that gives every visitor these pages. */
export const pagesSnippet = (pages) =>
  `// Add to your colorsbymax config (the autoMount({...}) call, or the config passed to <ThemeProvider>):\npages: ${JSON.stringify(pages, null, 2)},`

export const pagesPrompt = (pages) =>
  `In my colorsbymax config (the autoMount({...}) call, or the config passed to <ThemeProvider>), set pages: ${JSON.stringify(pages)} so the theme only colours those pages and every other page keeps its own colours. A path ending in /* covers that section and every page under it. If the site uses import 'colorsbymax/auto', replace it with import { autoMount } from 'colorsbymax/auto' and an autoMount({ pages: [...] }) call. Don't change anything else.`
