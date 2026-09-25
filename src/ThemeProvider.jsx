import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { checkTheme, fixAll, suggestFix } from './contrast.js'
import { loadLibrary } from './library.js'
import { DARK_SUFFIX, isDarkTheme, toDark } from './modes.js'
import { LOGO_SELECTOR, createRecolourer, usesColourTokens } from './recolour.js'
import { collectColors, detectSiteName, inferRoles, suggestThemes } from './scan.js'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, usePrefersDark } from './settings.js'
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
 * @property {() => Promise<any>} [pdf]  Enables PDF uploads: pass `loadPdf` from 'colorsbymax/pdf'
 * @property {'light' | 'dark' | 'system'} [defaultMode]  The mode a first-time visitor starts in
 *   (default 'light'; 'system' follows their device). Visitors can still change it.
 * @property {boolean} [colourLogo]  Whether themes colour the site's logo for a first-time visitor
 *   (default false: the logo keeps its own colours). Visitors can still change it in settings.
 * @property {boolean} [intro]  Bring the colour button in with a short pop and burst of the theme's
 *   colours, a moment after the page loads (default true). Reduced motion fades it in instead.
 * @property {boolean} [hidden]  Hide the colour button and panel; the theme still applies. Use
 *   `hidden: import.meta.env.PROD` to keep it out of production once the colours are chosen.
 * @property {'bottom-right' | 'bottom-left' | 'top-left' | 'top-right'} [position]  Where the colour
 *   button starts (default 'bottom-right'). 'top-right' sits under a floating nav bar.
 * @property {boolean | 'auto'} [recolour]  Re-colour a site that doesn't paint with the --color-*
 *   variables, by swapping the colours actually on the page. 'auto' (default) does it only when
 *   the site doesn't define --color-primary itself.
 */

/**
 * Resolves a config into the site theme group. The shipped default always comes first. Without
 * one, a re-coloured site's own colours (read from the page) are its default.
 */
function resolveSite(config, pageColours) {
  const siteName = config.siteName || detectSiteName()
  const defaultTheme = {
    id: 'site-default',
    name: config.defaultTheme?.name || `${siteName} ${pageColours ? 'original' : 'default'}`,
    site: true,
    tokens: config.defaultTheme
      ? completeTokens(sanitizeTokens(config.defaultTheme.tokens))
      : (pageColours ?? BASE_TOKENS),
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
  // A re-coloured site with chosen colours in its config can still go back to how its page looks.
  const pageOriginal =
    pageColours && config.defaultTheme ? [{ id: 'site-original', name: `${siteName} original`, site: true, tokens: pageColours }] : []
  return { siteName, defaultTheme, siteThemes: [defaultTheme, ...accessible, ...pageOriginal, ...extra] }
}

/** @param {{ config?: ColorsByMaxConfig, children: import('react').ReactNode }} props */
export function ThemeProvider({ config = {}, children }) {
  const storageKey = config.storageKey || DEFAULT_STORAGE_KEY
  // Config is read once; it describes the host site and shouldn't change at runtime.
  const [initialConfig] = useState(config)
  // The site's own colours, when it's being re-coloured (read once its content has rendered).
  const [pageColours, setPageColours] = useState(null)
  const site = useMemo(() => resolveSite(initialConfig, pageColours), [initialConfig, pageColours])
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

  // Re-colouring for sites that don't paint with the token variables. Layout effects run after
  // the children have rendered, so the engine sees the site's content.
  const recolourMode = initialConfig.recolour ?? 'auto'
  const recolourer = useRef(null)
  useLayoutEffect(() => {
    if (recolourMode === false || (recolourMode === 'auto' && usesColourTokens())) return
    const engine = createRecolourer()
    recolourer.current = engine
    setPageColours(engine.site)
    return () => {
      engine.stop()
      recolourer.current = null
    }
  }, [recolourMode])
  // Logo colouring (a visitor setting, off by default): when off, the logo keeps its own colours.
  // Re-coloured sites leave it out of the swap; sites on the colour variables get the site's own
  // variables back on the logo, so it paints as it always did.
  // The site's starting settings: the defaults, with its own choices for the mode and the logo.
  const settingDefaults = useMemo(
    () => ({
      ...DEFAULT_SETTINGS,
      colourLogo: Boolean(initialConfig.colourLogo),
      mode: ['light', 'dark', 'system'].includes(initialConfig.defaultMode) ? initialConfig.defaultMode : DEFAULT_SETTINGS.mode,
    }),
    [initialConfig],
  )
  const [logoColouring, setLogoColouring] = useState(() => loadSettings(storageKey, settingDefaults).colourLogo)
  useLayoutEffect(() => {
    recolourer.current?.setLogoColouring(logoColouring)
  }, [logoColouring, pageColours])
  useLayoutEffect(() => {
    if (logoColouring || pageColours) return
    const style = document.createElement('style')
    style.dataset.colorsbymax = 'logo'
    style.textContent = `:is(${LOGO_SELECTOR}){${TOKEN_KEYS.map((k) => `--color-${k}:${defaultTheme.tokens[k]}`).join(';')}}`
    document.head.append(style)
    return () => style.remove()
  }, [logoColouring, pageColours, defaultTheme])

  // The page's own colours with no overrides are its original look, so nothing is swapped. (A
  // defaultTheme in the config is chosen colours, which do need applying.)
  const pageLook = base.id === 'site-original' || (base.id === defaultTheme.id && !initialConfig.defaultTheme)
  const original = pageLook && !Object.keys(state.overrides).length
  useLayoutEffect(() => {
    recolourer.current?.apply(original ? null : tokens)
  }, [tokens, original, pageColours])

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

  /** Selects a theme by id; pass the theme itself for library themes and dark twins. */
  const selectTheme = useCallback(
    (id, theme) =>
      setState((s) => ({
        ...s,
        activeId: id,
        // Kept so the theme resolves on reload without the library (a twin's saved copy
        // loses its library flag, so twins are always kept).
        snapshot: theme?.library || theme?.derived ? { id: theme.id, name: theme.name, tokens: theme.tokens } : s.snapshot,
      })),
    [],
  )

  // ------------------------------------------------------------ light and dark mode
  // The visitor's mode: 'light', 'dark', or 'system' to follow the device. It lives here rather
  // than in the switcher, so it works on every page load and even when the switcher is hidden.
  // Every built-in theme has a dark twin, so any site can go dark, with or without a dark mode of
  // its own.
  const [modeSetting, setModeSetting] = useState(() => loadSettings(storageKey, settingDefaults).mode)
  const prefersDark = usePrefersDark()
  const mode = modeSetting === 'system' ? (prefersDark ? 'dark' : 'light') : modeSetting
  const modeRef = useRef(mode)
  modeRef.current = mode
  const setMode = useCallback(
    (next) => {
      if (!['light', 'dark', 'system'].includes(next)) return
      setModeSetting(next)
      saveSettings(storageKey, { ...loadSettings(storageKey, settingDefaults), mode: next })
    },
    [storageKey, settingDefaults],
  )

  // Show the version of the current theme that matches the mode: on load, and whenever either
  // changes. Custom palettes stay exactly as they were made.
  useLayoutEffect(() => {
    if (base.custom) return
    if (mode === 'dark' && !isDarkTheme(base.tokens)) {
      const twin = toDark(base)
      selectTheme(twin.id, twin)
    } else if (mode === 'light' && base.id.endsWith(DARK_SUFFIX)) {
      const lightId = base.id.slice(0, -DARK_SUFFIX.length)
      const local = allThemes.find((t) => t.id === lightId)
      if (local) selectTheme(local.id, local)
      else
        loadLibrary().then(
          (lib) => {
            const t = lib.themes.find((x) => x.id === lightId)
            if (t) selectTheme(t.id, t)
          },
          () => {},
        )
    }
  }, [mode, base, allThemes, selectTheme])

  // The page says which mode it's in (data-colorsbymax-scheme on <html>, for the site's own CSS),
  // and native controls and scrollbars follow it.
  useLayoutEffect(() => {
    const html = document.documentElement
    html.dataset.colorsbymaxScheme = mode
    html.style.colorScheme = mode
    for (const el of document.querySelectorAll('[data-colorsbymax-mode]')) {
      const want = el.getAttribute('data-colorsbymax-mode')
      el.setAttribute('aria-pressed', String(want === 'toggle' ? mode === 'dark' : want === modeSetting))
    }
  }, [mode, modeSetting])

  // Light and dark switches on the site itself: any element with data-colorsbymax-mode, set to
  // "toggle" (light and dark in turn), "light", "dark" or "system". The site decides where it
  // goes and how it looks.
  useEffect(() => {
    const onClick = (e) => {
      const el = e.target.closest?.('[data-colorsbymax-mode]')
      if (!el) return
      const want = el.getAttribute('data-colorsbymax-mode')
      setMode(want === 'toggle' ? (modeRef.current === 'dark' ? 'light' : 'dark') : want)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [setMode])

  const api = {
    state,
    /** The switcher's starting settings for this site. */
    settingDefaults,
    /** The mode in effect ('light' or 'dark'), the visitor's setting ('system' follows the device), and a setter. */
    mode,
    modeSetting,
    setMode,
    storageKey,
    siteName,
    usage: initialConfig.usage ?? {},
    loadPdf: initialConfig.pdf ?? null,
    position: initialConfig.position ?? 'bottom-right',
    /** True when the config hides the switcher (e.g. in production); the theme still applies. */
    hidden: Boolean(initialConfig.hidden),
    /** Whether the colour button makes an entrance when it first appears. */
    intro: initialConfig.intro !== false,
    /** True when colorsbymax is swapping the page's own colours (the site isn't wired to tokens). */
    recolouring: Boolean(pageColours),
    /** Turns re-colouring of the site's logo on or off (the switcher's "Colour the logo" setting). */
    setLogoColouring,
    siteThemes,
    defaultTheme,
    presets: PRESETS,
    customs: state.customs,
    themes: allThemes,
    active: base,
    tokens,
    issues,

    selectTheme,

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
