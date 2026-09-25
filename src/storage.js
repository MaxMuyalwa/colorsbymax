// localStorage persistence. Every access is wrapped: storage can throw or be empty in
// private browsing, and the site must then simply render with its default theme.

import { normalizeHex } from './color.js'
import { TOKEN_KEYS, completeTokens } from './tokens.js'

export const DEFAULT_STORAGE_KEY = 'colorsbymax'
const VERSION = 1

/**
 * @typedef {Object} ThemeState
 * @property {string} activeId                         Theme id (site, pick, library or custom)
 * @property {Partial<import('./tokens.js').ThemeTokens>} overrides
 * @property {import('./tokens.js').Theme[]} customs
 * @property {import('./tokens.js').Theme | null} snapshot  Copy of the active library theme, so it
 *   resolves on load without downloading the whole library
 * @property {{ at: number, palette: string[], themes: import('./tokens.js').Theme[] } | null} scanned
 *   Result of the last site scan
 */

/** @returns {ThemeState} */
export const initialState = (defaultId) => ({ activeId: defaultId, overrides: {}, customs: [], snapshot: null, scanned: null })

/** Keeps only known token keys with valid hex values. */
export function sanitizeTokens(input) {
  const out = {}
  if (!input || typeof input !== 'object') return out
  for (const key of TOKEN_KEYS) {
    const hex = normalizeHex(input[key])
    if (hex) out[key] = hex
  }
  return out
}

/**
 * @param {string} storageKey
 * @param {import('./tokens.js').Theme} defaultTheme  fills missing tokens and is the fallback
 * @returns {ThemeState}
 */
export function loadState(storageKey, defaultTheme) {
  const fresh = initialState(defaultTheme.id)
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return fresh
    const data = JSON.parse(raw)
    if (!data || data.v !== VERSION) return fresh
    const complete = (tokens) => completeTokens(sanitizeTokens(tokens), defaultTheme.tokens)
    const customs = Array.isArray(data.customs)
      ? data.customs
          .filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string')
          .map((c) => ({ id: c.id, name: c.name, custom: true, tokens: complete(c.tokens) }))
      : []
    const snap = data.snapshot
    const snapshot =
      snap && typeof snap.id === 'string' && typeof snap.name === 'string' ? { id: snap.id, name: snap.name, tokens: complete(snap.tokens) } : null
    const sc = data.scanned
    const scanned =
      sc && Array.isArray(sc.themes)
        ? {
            at: Number(sc.at) || 0,
            palette: Array.isArray(sc.palette) ? sc.palette.map(normalizeHex).filter(Boolean) : [],
            themes: sc.themes
              .filter((t) => t && typeof t.id === 'string' && typeof t.name === 'string')
              .map((t) => ({ id: t.id, name: t.name, site: true, scanned: true, match: Boolean(t.match), tokens: complete(t.tokens) })),
          }
        : null
    return {
      activeId: typeof data.activeId === 'string' ? data.activeId : defaultTheme.id,
      overrides: sanitizeTokens(data.overrides),
      customs,
      snapshot,
      scanned,
    }
  } catch {
    return fresh
  }
}

/**
 * Persists state plus the fully resolved tokens, so the pre-paint script can apply
 * them without knowing about presets.
 */
export function saveState(storageKey, state, resolved) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify({ v: VERSION, ...state, resolved }))
  } catch {
    // Storage unavailable or full: the theme still applies for this page view.
  }
}

/**
 * Where the visitor dragged the colour button, as fractions (0–1) of the space it can move in,
 * so it keeps its relative spot when the window resizes. Null means the default corner.
 * @returns {{ rx: number, ry: number } | null}
 */
export function loadButtonPosition(storageKey) {
  try {
    const p = JSON.parse(window.localStorage.getItem(`${storageKey}:button`) || 'null')
    const ok = (n) => typeof n === 'number' && n >= 0 && n <= 1
    return p && ok(p.rx) && ok(p.ry) ? { rx: p.rx, ry: p.ry } : null
  } catch {
    return null
  }
}

export function saveButtonPosition(storageKey, position) {
  try {
    if (position) window.localStorage.setItem(`${storageKey}:button`, JSON.stringify(position))
    else window.localStorage.removeItem(`${storageKey}:button`)
  } catch {
    // Storage unavailable: the button stays put for this page view.
  }
}

/**
 * Inline script for the document <head> that applies the saved theme before first paint,
 * avoiding a flash of the default. Embed it as a classic (non-module) <script>.
 */
export function prePaintScript(storageKey = DEFAULT_STORAGE_KEY) {
  return `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)})||'null');var t=s&&s.v===${VERSION}&&s.resolved;if(!t||typeof t!=='object')return;var d=document.documentElement.style;for(var k in t){var v=t[k];if(/^[a-z0-9-]+$/.test(k)&&/^#[0-9a-f]{6}$/i.test(v))d.setProperty('--color-'+k,v)}}catch(e){}})()`
}
