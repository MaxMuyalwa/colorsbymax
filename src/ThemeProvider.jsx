import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { checkTheme, fixAll, suggestFix } from './contrast.js'
import { loadLibrary } from './library.js'
import { DARK_SUFFIX, accentTokens, inMode, isDarkTheme, toDark, vividTokens } from './modes.js'
import { createGuard } from './guard.js'
import { imageColours, tintOf } from './images.js'
import { baseId, clampColours, coloursFor, reducePalette } from './palette.js'
import { LOGO_SELECTOR, createRecolourer, usesColourTokens } from './recolour.js'
import { collectColors, detectSiteName, inferRoles, suggestThemes } from './scan.js'
import { MAX_SEEN, cleanPages, cleanScope, inScope, usePathname } from './scope.js'
import { MAX_PAINTS, cleanPaints, pageOf, paintCss } from './studio.js'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, usePrefersDark } from './settings.js'
import { DEFAULT_STORAGE_KEY, loadState, sanitizeTokens, saveState } from './storage.js'
import { BASE_TOKENS, PRESETS, TOKEN_KEYS, completeTokens } from './tokens.js'

const ThemeContext = createContext(null)

/** Writes each token to `--color-<key>` on <html>. Tailwind v4 utilities read these directly. */
export function applyTokens(tokens) {
  const style = document.documentElement.style
  for (const key of TOKEN_KEYS) style.setProperty(`--color-${key}`, tokens[key])
}
/** Takes the tokens off <html> again, so the site's own stylesheet colours show. */
const removeTokens = () => {
  const style = document.documentElement.style
  for (const key of TOKEN_KEYS) style.removeProperty(`--color-${key}`)
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
 * @property {'subtle' | 'balanced' | 'colourful'} [colourStyle]  How boldly the site takes a theme, for a
 *   first-time visitor. 'subtle' keeps the site's own backgrounds, cards and text and brings the theme
 *   in on buttons, links and highlights. 'balanced' is the theme as designed, every colour in its role
 *   (the default on a site painted with the --color-* variables). 'colourful' is an overhaul: tinted
 *   backgrounds, and the page's parts painted by role as a designer would (header, hero, sections,
 *   headings, cards, buttons, links and footer; the default on a site colorsbymax re-colours).
 *   Visitors can switch in the panel.
 * @property {number} [colourStrength]  How strongly Colourful paints for a first-time visitor, 0 (a light
 *   wash) to 100 (bold); default 50. Visitors can change it in the panel.
 * @property {Partial<Record<keyof typeof FEATURES, boolean>>} [features]  Parts of the panel to switch off
 *   for everyone, e.g. { scan: false, audit: false } (all on by default). Unlike the rest of the
 *   config it's read live, so a site can change it after loading (from its own settings).
 * @property {string[]} [pages]  Only colour these pages, e.g. ['/', '/pricing', '/blog/*'] (a path ending in
 *   /* is that section and every page under it); every other page keeps its own colours. Default:
 *   the whole site. A visitor can choose differently in Studio, on their own device.
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
/** Parts of the panel a site can switch off for everyone (config `features`). All on by default. */
/** How boldly a site can take a theme, from least to most. */
export const COLOUR_STYLES = ['subtle', 'balanced', 'colourful']

export const FEATURES = {
  picks: true, // Max's picks
  library: true, // the theme library
  search: true,
  surprise: true, // Surprise me
  scan: true, // Scan site
  custom: true, // Custom palettes
  overrides: true, // Override a single colour
  importExport: true,
  audit: true,
  addToSite: true, // the light and dark switch for the site ("Add to site")
  colourStyle: true, // the Subtle / Colourful switch
  colourCount: true, // − and + for how many colours a theme uses
  studio: true, // Studio: going deeper, starting with which pages get the colours
}

export function ThemeProvider({ config = {}, children }) {
  const storageKey = config.storageKey || DEFAULT_STORAGE_KEY
  // Config is read once; it describes the host site and shouldn't change at runtime. The one
  // exception is `features`, read live below.
  const [initialConfig] = useState(config)
  const features = useMemo(() => ({ ...FEATURES, ...Object.fromEntries(Object.entries(config.features ?? {}).filter(([k, v]) => k in FEATURES && typeof v === 'boolean')) }), [config.features])
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
  // How many of the theme's colours it uses: its own count, else the visitor's default (5 to 10).
  const [paletteDefault, setPaletteDefault] = useState(() => loadSettings(storageKey, DEFAULT_SETTINGS).paletteSize)
  const coloursOf = useCallback((id) => coloursFor(state.paletteSizes, id, paletteDefault), [state.paletteSizes, paletteDefault])
  const colourCount = coloursOf(base.id)
  const tokens = useMemo(() => ({ ...reducePalette(base.tokens, colourCount), ...state.overrides }), [base, colourCount, state.overrides])
  const issues = useMemo(() => checkTheme(tokens), [tokens])

  // Where the colours go (Studio): the visitor's choice, else the site's `pages`, else everywhere.
  // Pages outside it are left exactly as the site made them.
  const configPages = useMemo(() => (Array.isArray(initialConfig.pages) ? cleanPages(initialConfig.pages) : null), [initialConfig])
  const scope = useMemo(() => state.scope ?? (configPages ? { mode: 'pages', pages: configPages } : { mode: 'all', pages: [] }), [state.scope, configPages])
  const pathname = usePathname()
  const here = inScope(scope, pathname)
  // Studio offers back the pages this visitor has opened.
  useEffect(() => {
    setState((s) => (s.seen[0] === pathname ? s : { ...s, seen: [pathname, ...s.seen.filter((p) => p !== pathname)].slice(0, MAX_SEEN) }))
  }, [pathname])

  // Studio's point and click: parts of pages given their own colours, drawn on the page they were
  // picked on. On a page left out of the theme, they keep the exact colours that were picked.
  const paints = features.studio ? state.paints : []
  const pagePaintCss = useMemo(() => {
    const byPage = {}
    for (const p of paints) (byPage[pageOf(p)] ??= []).push(p)
    // '*': changes for every page of the site.
    const css = Object.fromEntries(Object.entries(byPage).map(([page, list]) => [page, paintCss(list, page === '*' || inScope(scope, page))]))
    return Object.keys(css).length ? css : null
  }, [paints, scope])
  useLayoutEffect(() => {
    document.querySelectorAll('style[data-colorsbymax="studio-early"]').forEach((el) => el.remove())
    const css = (pagePaintCss?.['*'] ?? '') + (pagePaintCss?.[pathname] ?? '')
    if (!css) return
    const style = document.createElement('style')
    style.dataset.colorsbymax = 'studio'
    style.textContent = css
    document.head.append(style)
    return () => style.remove()
  }, [pagePaintCss, pathname])

  // Re-colouring for sites that don't paint with the token variables. Layout effects run after
  // the children have rendered, so the engine sees the site's content.
  const recolourMode = initialConfig.recolour ?? 'auto'
  // Whether colorsbymax re-colours this site (it doesn't paint with the variables), known up front
  // for the style a first-time visitor starts in.
  const [recolours] = useState(() => recolourMode === true || (recolourMode === 'auto' && !usesColourTokens()))
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
      colourStrength: Number.isFinite(initialConfig.colourStrength) ? Math.min(100, Math.max(0, initialConfig.colourStrength)) : DEFAULT_SETTINGS.colourStrength,
      // A re-coloured site starts Colourful (on its own it barely changes); one painted with the
      // variables starts Balanced, the theme exactly as it's designed for it.
      colourStyle: COLOUR_STYLES.includes(initialConfig.colourStyle) ? initialConfig.colourStyle : recolours ? 'colourful' : 'balanced',
      mode: ['light', 'dark', 'system'].includes(initialConfig.defaultMode) ? initialConfig.defaultMode : DEFAULT_SETTINGS.mode,
    }),
    [initialConfig, recolours],
  )
  const [logoColouring, setLogoColouring] = useState(() => loadSettings(storageKey, settingDefaults).colourLogo)
  useLayoutEffect(() => {
    recolourer.current?.setLogoColouring(logoColouring)
  }, [logoColouring, pageColours])
  // Subtle, Balanced or Colourful (a visitor setting): how boldly the site takes the theme.
  const [colourStyle, setColourStyle] = useState(() => loadSettings(storageKey, settingDefaults).colourStyle)
  // Colourful's strength, and whether it tints with the site's own picture colours (visitor settings).
  const [colourStrength, setColourStrength] = useState(() => loadSettings(storageKey, settingDefaults).colourStrength)
  const [imageTints, setImageTints] = useState(() => loadSettings(storageKey, settingDefaults).imageTints)
  // The colours in the site's logo and pictures, read once the page and its pictures have loaded.
  const [pictureColours, setPictureColours] = useState([])
  const vividOpts = useMemo(
    () => ({ strength: colourStrength / 100, tint: imageTints ? tintOf(pictureColours) : null }),
    [colourStrength, imageTints, pictureColours],
  )
  useLayoutEffect(() => {
    recolourer.current?.setColourful(colourStyle === 'colourful' ? true : colourStyle === 'subtle' ? 'accents' : false, vividOpts)
  }, [colourStyle, pageColours, vividOpts])
  useLayoutEffect(() => {
    if (logoColouring || pageColours || !here) return
    const style = document.createElement('style')
    style.dataset.colorsbymax = 'logo'
    style.textContent = `:is(${LOGO_SELECTOR}){${TOKEN_KEYS.map((k) => `--color-${k}:${defaultTheme.tokens[k]}`).join(';')}}`
    document.head.append(style)
    return () => style.remove()
  }, [logoColouring, pageColours, defaultTheme, here])

  // The page's own colours with no overrides are its original look, so nothing is swapped. (A
  // defaultTheme in the config is chosen colours, which do need applying.)
  const pageLook = base.id === 'site-original' || (base.id === defaultTheme.id && !initialConfig.defaultTheme)
  const original = pageLook && !Object.keys(state.overrides).length

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

  // What the page shows, in the visitor's colour style: Subtle keeps the site's own backgrounds and
  // text (in this mode) with the theme on its accents; Balanced is the theme; Colourful tints it.
  const siteTokens = useMemo(() => inMode(defaultTheme, mode).tokens, [defaultTheme, mode])
  const applied = useMemo(
    () => (colourStyle === 'subtle' ? accentTokens(tokens, siteTokens) : colourStyle === 'colourful' ? vividTokens(tokens, vividOpts) : tokens),
    [tokens, siteTokens, colourStyle, vividOpts],
  )
  useEffect(() => {
    if (colourStyle !== 'colourful' || !imageTints) return
    const read = () => setPictureColours((old) => {
      const next = imageColours()
      return next.join() === old.join() ? old : next
    })
    const timer = setTimeout(read, 400)
    window.addEventListener('load', read)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('load', read)
    }
  }, [colourStyle, imageTints, pathname])
  useLayoutEffect(() => {
    if (here) applyTokens(applied)
    else removeTokens()
    saveState(storageKey, { ...state, activeId: base.id }, applied, scope, pagePaintCss)
  }, [applied, state, base.id, storageKey, here, scope, pagePaintCss])
  // A re-coloured site swaps its colours for these, and Colourful paints its parts by role too.
  useLayoutEffect(() => {
    recolourer.current?.apply(original || !here ? null : applied)
  }, [applied, original, pageColours, here])
  // A site painted with the variables is designed with them, so every style works through them
  // alone; painting its parts by role on top would fight that design.
  //
  // The contrast guard, on every site and in every style: once the colours are on the page, any
  // text or icon they made hard to read is brought back up to WCAG (see guard.js).
  const guard = useRef(null)
  useEffect(() => {
    const g = createGuard()
    guard.current = g
    return () => {
      g.stop()
      guard.current = null
    }
  }, [])
  useEffect(() => {
    guard.current?.check(here ? applied : null)
  }, [applied, here, pathname, colourStyle, pageColours, logoColouring, pagePaintCss])
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
    // A page outside the chosen ones keeps its own look, dark mode included.
    if (here) {
      html.dataset.colorsbymaxScheme = mode
      html.style.colorScheme = mode
    } else {
      delete html.dataset.colorsbymaxScheme
      html.style.removeProperty('color-scheme')
    }
    for (const el of document.querySelectorAll('[data-colorsbymax-mode]')) {
      const want = el.getAttribute('data-colorsbymax-mode')
      el.setAttribute('aria-pressed', String(want === 'toggle' ? mode === 'dark' : want === modeSetting))
    }
  }, [mode, modeSetting, here])

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
    /** Sets how boldly the site takes the theme: 'subtle', 'balanced' or 'colourful'. */
    setColourStyle,
    colourStyle,
    /** Colourful's strength (0 to 100) and image tints, set from the switcher's settings. */
    setColourStrength,
    setImageTints,
    /** The main colours of the site's logo and pictures, and the one Colourful tints with (or null). */
    pictureColours,
    pictureTint: imageTints ? tintOf(pictureColours) : null,
    /** The colours as the page shows them, in the visitor's colour style. */
    appliedTokens: applied,
    /** Which parts of the panel are on (config `features`). */
    features,
    /** Where the colours go: { mode: 'all' | 'pages', pages }, and whether this page gets them. */
    scope,
    inScope: here,
    pathname,
    /** The site's own `pages` config, or null; `scopeChosen` is true once the visitor picks their own. */
    configPages,
    scopeChosen: Boolean(state.scope),
    /** Sets where the colours go (Studio), on this device; null goes back to the site's setting. */
    setScope: (next) => setState((s) => ({ ...s, scope: next === null ? null : cleanScope(next) })),
    /** Pages of the site this visitor has opened, newest first. */
    seenPages: state.seen,
    /** Parts of pages coloured in Studio by pointing and clicking. */
    paints: state.paints,
    /** Adds a paint, or updates the one with its id; one with no colours left is removed. */
    savePaint: (paint) =>
      setState((s) => {
        const [clean] = cleanPaints([paint])
        const rest = s.paints.filter((p) => p.id !== paint.id)
        if (!clean || !Object.keys(clean.props).length) return { ...s, paints: rest }
        const at = s.paints.findIndex((p) => p.id === paint.id)
        const paints = at < 0 ? [...rest, clean].slice(-MAX_PAINTS) : s.paints.map((p) => (p.id === paint.id ? clean : p))
        return { ...s, paints }
      }),
    removePaint: (id) => setState((s) => ({ ...s, paints: s.paints.filter((p) => p.id !== id) })),
    /** Clears Studio's colours, on one page or everywhere. */
    clearPaints: (page = null) => setState((s) => ({ ...s, paints: page ? s.paints.filter((p) => p.page !== page) : [] })),
    /** How many colours a theme uses (5 to 10): its own count, or the visitor's default. */
    coloursOf,
    /** Sets one theme's colour count (light and dark share it). */
    setThemeColours: (id, n) => setState((s) => ({ ...s, paletteSizes: { ...s.paletteSizes, [baseId(id)]: clampColours(n) } })),
    /** The default count for every theme (the panel's settings); themes given their own count keep it. */
    setPaletteDefault,
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
