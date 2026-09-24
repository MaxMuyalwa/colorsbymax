import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react'
import { checkTheme, fixAll, suggestFix } from './contrast.js'
import { DEFAULT_STORAGE_KEY, loadState, sanitizeTokens, saveState } from './storage.js'
import { BASE_TOKENS, PRESETS, TOKEN_KEYS, completeTokens } from './tokens.js'

const ThemeContext = createContext(null)

/** Writes each token to `--color-<key>` on <html>. Tailwind v4 utilities read these directly. */
export function applyTokens(tokens) {
  const style = document.documentElement.style
  for (const key of TOKEN_KEYS) style.setProperty(`--color-${key}`, tokens[key])
}

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
 */

/** Resolves a config into the site theme group. The shipped default always comes first. */
function resolveSite(config) {
  const siteName = config.siteName || 'This site'
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
  const { siteName, defaultTheme, siteThemes } = site
  const [state, setState] = useState(() => loadState(storageKey, defaultTheme))

  const allThemes = useMemo(() => [...siteThemes, ...PRESETS, ...state.customs], [siteThemes, state.customs])
  const base =
    allThemes.find((t) => t.id === state.activeId) ??
    (state.snapshot?.id === state.activeId ? state.snapshot : null) ??
    defaultTheme
  const tokens = useMemo(() => ({ ...base.tokens, ...state.overrides }), [base, state.overrides])
  const issues = useMemo(() => checkTheme(tokens), [tokens])

  useLayoutEffect(() => {
    applyTokens(tokens)
    saveState(storageKey, { ...state, activeId: base.id }, tokens)
  }, [tokens, state, base.id, storageKey])

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
    siteName,
    usage: config.usage ?? {},
    siteThemes,
    presets: PRESETS,
    customs: state.customs,
    themes: allThemes,
    active: base,
    tokens,
    issues,

    /** Selects a theme by id; pass the theme itself for library themes. */
    selectTheme: (id, theme) =>
      setState((s) => ({
        ...s,
        activeId: id,
        snapshot: theme?.library ? { id: theme.id, name: theme.name, tokens: theme.tokens } : s.snapshot,
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
      const id = newId()
      const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 60) : 'Imported palette'
      setState((s) => ({
        ...s,
        activeId: id,
        overrides: {},
        customs: [...s.customs, { id, name, custom: true, tokens: completeTokens(clean, defaultTheme.tokens) }],
      }))
      return null
    },
  }

  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
