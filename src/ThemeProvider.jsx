import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react'
import { checkTheme, fixAll, suggestFix } from './contrast.js'
import { loadLibrary } from './library.js'
import { DARK_SUFFIX, toDark } from './modes.js'
import { collectColors, detectSiteName, inferRoles, suggestThemes } from './scan.js'
import { DEFAULT_STORAGE_KEY, loadState, sanitizeTokens, saveState } from './storage.js'
import { BASE_TOKENS, PRESETS, TOKEN_KEYS, completeTokens } from './tokens.js'

const ThemeContext = createContext(null)

/** Writes each token to `--color-<key>` on <html>. Tailwind v4 utilities read these directly. */
export function applyTokens(tokens) {
  const style = document.documentElement.style
  for (const key of TOKEN_KEYS) style.setProperty(`--color-${key}`, tokens[key])
}

/** Scrollbar thumb: the theme's primary, softened towards its page background. */
export const SCROLLBAR_THUMB = 'color-mix(in srgb, var(--color-primary) 55%, var(--color-background))'

const newId = () => `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

/**
 * @typedef {Object} ColorsByMaxConfig
 * @property {string} [siteName]      Shown as the first theme group, e.g. "Tsungi"
 * @property {string} [storageKey]    localStorage key; must match the pre-paint script
 * @property {{ name: string, tokens: Partial<import('./tokens.js').ThemeTokens> }} [defaultTheme]
 *   The site's own shipped colours
 * @property {{ id: string, name: string, tokens: Partial<import('./tokens.js').ThemeTokens> }[]} [themes]
 *   Extra themes made for this site
 * @property {Partial<Record<import('./tokens.js').TokenKey, string>>} [usage]
 *   Where each token is used on this site, shown in the editors
 * @property {boolean} [scrollbars]  Colour the page's scrollbars from the theme (default true)
 */

/** Resolves a config into the site theme group. The shipped default always comes first. */
function resolveSite(config) {
  const siteName = config.siteName || detectSiteName()
  const defaultTheme = {
    id: 'site-default',
    name: config.defaultTheme?.name || `${siteName} default`,
    site: true,
    tokens: config.defaultTheme ? completeTokens(sanitizeTokens(config.defaultTheme.tokens)) : BASE_TOKENS,
  }
  const extra = (config.themes ?? []).map((t) => ({
    id: `site-${t.id}`,
    name: t.name,
    site: true,
    tokens: completeTokens(sanitizeTokens(t.tokens), defaultTheme.tokens),
  }))
  // If the shipped colours fail contrast, offer the nearest passing version alongside them.
  const fixes = fixAll(defaultTheme.tokens)
  const accessible = Object.keys(fixes).length
    ? [{ id: 'site-accessible', name: `${defaultTheme.name} (accessible)`, site: true, tokens: { ...defaultTheme.tokens, ...fixes } }]
    : []
  return { siteName, defaultTheme, siteThemes: [defaultTheme, ...accessible, ...extra] }
}

/** @param {{ config?: ColorsByMaxConfig, children: import('react').ReactNode }} props */
export function ThemeProvider({ config = {}, children }) {
  const storageKey = config.storageKey || DEFAULT_STORAGE_KEY
  // Config is read once; it describes the host site and shouldn't change at runtime.
  const [site] = useState(() => resolveSite(config))
  const { siteName, defaultTheme } = site
  const [state, setState] = useState(() => loadState(storageKey, defaultTheme))
  // Scan suggestions join the site's own themes in its group.
  const siteThemes = useMemo(() => [...site.siteThemes, ...(state.scanned?.themes ?? [])], [site.siteThemes, state.scanned])

  const allThemes = useMemo(() => [...siteThemes, ...PRESETS, ...state.customs], [siteThemes, state.customs])
  const find = (id) => allThemes.find((t) => t.id === id)
  // A dark twin is rebuilt from its light theme, so it follows edits to that theme.
  const lightOfTwin = state.activeId.endsWith(DARK_SUFFIX) ? find(state.activeId.slice(0, -DARK_SUFFIX.length)) : null
  const base =
    find(state.activeId) ??
    (lightOfTwin ? toDark(lightOfTwin) : null) ??
    (state.snapshot?.id === state.activeId ? state.snapshot : null) ??
    defaultTheme
  const tokens = useMemo(() => ({ ...base.tokens, ...state.overrides }), [base, state.overrides])
  const issues = useMemo(() => checkTheme(tokens), [tokens])

  useLayoutEffect(() => {
    applyTokens(tokens)
    saveState(storageKey, { ...state, activeId: base.id }, tokens)
  }, [tokens, state, base.id, storageKey])

  // Scrollbars in the theme's colours. The rule reads the token variables, so it follows every
  // theme change by itself, and :where() keeps it weaker than any scrollbar styling the site has.
  const themeScrollbars = config.scrollbars !== false
  useLayoutEffect(() => {
    if (!themeScrollbars) return
    const style = document.createElement('style')
    style.dataset.colorsbymax = 'scrollbars'
    style.textContent = `:where(html){scrollbar-color:${SCROLLBAR_THUMB} var(--color-background)}`
    document.head.append(style)
    return () => style.remove()
  }, [themeScrollbars])

  const updateCustom = (id, fn) => (s) => ({ ...s, customs: s.customs.map((c) => (c.id === id ? fn(c) : c)) })

  /**
   * Sets one token wherever it currently comes from: an existing override, otherwise the
   * active custom palette, otherwise a new override on top of the active theme.
   */
  const setToken = useCallback(
    (key, value) =>
      setState((s) => {
        const active = s.customs.find((c) => c.id === s.activeId)
        if (key in s.overrides || !active) return { ...s, overrides: { ...s.overrides, [key]: value } }
        return updateCustom(active.id, (c) => ({ ...c, tokens: { ...c.tokens, [key]: value } }))(s)
      }),
    [],
  )

  const api = {
    state,
    storageKey,
    siteName,
    usage: config.usage ?? {},
    siteThemes,
    defaultTheme,
    presets: PRESETS,
    customs: state.customs,
    themes: allThemes,
    active: base,
    tokens,
    issues,

    /** Selects a theme by id; pass the theme itself for library themes and dark twins. */
    selectTheme: (id, theme) =>
      setState((s) => ({
        ...s,
        activeId: id,
        // Kept so the theme resolves on reload without the library (a twin's saved copy
        // loses its library flag, so twins are always kept).
        snapshot: theme?.library || theme?.derived ? { id: theme.id, name: theme.name, tokens: theme.tokens } : s.snapshot,
      })),

    createCustom: (name) => {
      const id = newId()
      setState((s) => ({
        ...s,
        activeId: id,
        overrides: {},
        // Start from what the user currently sees, overrides included.
        customs: [...s.customs, { id, name: name.trim() || 'My palette', custom: true, tokens: { ...tokens } }],
      }))
      return id
    },
    updateCustomToken: (id, key, value) => setState(updateCustom(id, (c) => ({ ...c, tokens: { ...c.tokens, [key]: value } }))),
    renameCustom: (id, name) => setState(updateCustom(id, (c) => ({ ...c, name }))),
    deleteCustom: (id) =>
      setState((s) => ({
        ...s,
        customs: s.customs.filter((c) => c.id !== id),
        activeId: s.activeId === id ? defaultTheme.id : s.activeId,
      })),

    setOverride: (key, value) => setState((s) => ({ ...s, overrides: { ...s.overrides, [key]: value } })),
    clearOverride: (key) =>
      setState((s) => {
        const { [key]: _removed, ...rest } = s.overrides
        return { ...s, overrides: rest }
      }),
    clearOverrides: () => setState((s) => ({ ...s, overrides: {} })),

    resetToDefault: () => setState((s) => ({ ...s, activeId: defaultTheme.id, overrides: {} })),

    scanned: state.scanned,
    /**
     * Reads the colours painted on the page (ignoring the applied theme) and adds themes built
     * around them to the site group. Returns a short summary for the UI.
     */
    runScan: async () => {
      const found = inferRoles(collectColors())
      let library = []
      try {
        library = (await loadLibrary()).themes
      } catch {
        // Library unavailable (offline): suggest without library matches.
      }
      const themes = suggestThemes(found, siteName, library)
      setState((s) => ({ ...s, scanned: { at: Date.now(), palette: found.palette, themes } }))
      return { colours: found.palette.length, themes: themes.length }
    },
    clearScan: () => setState((s) => ({ ...s, scanned: null })),

    fixIssue: (issue) => {
      const fix = suggestFix(issue.pairing, tokens)
      if (fix) setToken(fix.key, fix.value)
      return Boolean(fix)
    },
    fixAllIssues: () => {
      for (const [key, value] of Object.entries(fixAll(tokens))) setToken(key, value)
    },

    exportTheme: () => JSON.stringify({ name: base.name + (Object.keys(state.overrides).length ? ' (edited)' : ''), tokens }, null, 2),

    /** Imports `{ name, tokens }` JSON as a new custom palette. Returns an error string or null. */
    importTheme: (json) => {
      let data
      try {
        data = JSON.parse(json)
      } catch {
        return 'That isn’t valid JSON.'
      }
      const clean = sanitizeTokens(data?.tokens)
      if (!Object.keys(clean).length) return 'No recognised colour tokens found. Expected { "name": …, "tokens": { "primary": "#…" } }.'
      api.addPalette(typeof data.name === 'string' ? data.name : '', clean)
      return null
    },

    /** Adds tokens as a new custom palette (missing ones filled from the site) and applies it. */
    addPalette: (name, partialTokens) => {
      const id = newId()
      const clean = sanitizeTokens(partialTokens)
      setState((s) => ({
        ...s,
        activeId: id,
        overrides: {},
        customs: [...s.customs, { id, name: name.trim().slice(0, 60) || 'Imported palette', custom: true, tokens: completeTokens(clean, defaultTheme.tokens) }],
      }))
      return id
    },
  }

  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
