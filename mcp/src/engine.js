// The colour side of the MCP server: the same theme catalogue, palette builder and contrast
// checks the switcher uses in the browser, bundled from colorsbymax's own source.

import { contrastRatio, deltaE, normalizeHex } from '../../src/color.js'
import { checkTheme, fixAll, formatRatio, MIN_CONTRAST_LARGE_TEXT, MIN_CONTRAST_NON_TEXT, MIN_CONTRAST_TEXT, PAIRINGS, THRESHOLDS } from '../../src/contrast.js'
import { themeFromPalette } from '../../src/extract.js'
import { cssSnippet } from '../../src/finish.js'
import library from '../../src/library.generated.json'
import { DARK_SUFFIX, darkTokens, isDarkTheme, toDark } from '../../src/modes.js'
import { BASE_TOKENS, completeTokens, PRESETS, TOKEN_GROUPS, TOKEN_KEYS } from '../../src/tokens.js'

export { contrastRatio, formatRatio, normalizeHex, cssSnippet, darkTokens, TOKEN_GROUPS, TOKEN_KEYS, DARK_SUFFIX }

export const CATEGORIES = library.categories

const PICKS = PRESETS.map((t) => ({ ...t, group: "Max's picks", tags: ['picks'] }))
const LIBRARY = library.themes.map((t) => ({
  id: t.id,
  name: t.name,
  group: 'Library',
  tags: t.tags,
  tokens: Object.fromEntries(library.keys.map((key, i) => [key, `#${t.t.slice(i * 6, i * 6 + 6)}`])),
}))
export const ALL_THEMES = [...PICKS, ...LIBRARY]
export const THEME_COUNT = ALL_THEMES.length

/** A theme by id, in light or dark. `ocean~dark` also selects the dark twin. */
export function findTheme(id, mode = 'light') {
  const dark = mode === 'dark' || id.endsWith(DARK_SUFFIX)
  const base = ALL_THEMES.find((t) => t.id === id.replace(DARK_SUFFIX, ''))
  if (!base) return null
  return dark ? { ...toDark(base), group: base.group, tags: base.tags } : base
}

const SWATCHES = ['primary', 'primary-alt', 'background', 'surface', 'secondary', 'ink']

/** A short description of a theme for listings. */
export const summary = (t) => ({
  id: t.id,
  name: t.name,
  group: t.group,
  tags: t.tags,
  dark: isDarkTheme(t.tokens),
  colours: Object.fromEntries(SWATCHES.map((k) => [k, t.tokens[k]])),
  contrastIssues: checkTheme(t.tokens).length,
})

/**
 * Searches the picks and the library.
 * @param {{ query?: string, category?: string, near?: string, mode?: 'light'|'dark', limit?: number }} options
 */
export function searchThemes({ query, category, near, mode = 'light', limit = 12 }) {
  const words = (query ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  const target = near ? normalizeHex(near) : null
  if (near && !target) throw new Error(`"${near}" isn't a colour. Use a hex code like #0d6b84.`)
  let found = ALL_THEMES.filter((t) => !category || t.tags.includes(category))
  if (words.length) {
    found = found.filter((t) => {
      const text = `${t.id} ${t.name} ${t.group} ${t.tags.join(' ')}`.toLowerCase()
      return words.every((w) => text.includes(w))
    })
  }
  if (target) {
    // Closest brand colour first; primary counts most, its gradient partner a little.
    const distance = (t) => Math.min(deltaE(t.tokens.primary, target), deltaE(t.tokens['primary-alt'], target) + 4)
    found = found.map((t) => [t, distance(t)]).sort((a, b) => a[1] - b[1]).map(([t]) => t)
  }
  const total = found.length
  const themes = found.slice(0, limit).map((t) => summary(mode === 'dark' ? findTheme(t.id, 'dark') : t))
  return { total, themes }
}

/** Every token filled in; unknown keys and non-colours are reported, not silently dropped. */
export function completeFrom(partial = {}) {
  const clean = {}
  const rejected = []
  for (const [key, value] of Object.entries(partial)) {
    const k = key.replace(/^--color-/, '')
    const hex = normalizeHex(value)
    if (TOKEN_KEYS.includes(k) && hex) clean[k] = hex
    else rejected.push(key)
  }
  return { tokens: completeTokens(clean, BASE_TOKENS), given: Object.keys(clean), rejected }
}

/** Contrast report for a full token set: each failing pairing, and the smallest fix for all. */
export function contrastReport(tokens) {
  const issues = checkTheme(tokens).map((i) => ({ pairing: i.pairing.id, label: i.pairing.label, ratio: formatRatio(i.ratio), required: `${i.required}:1`, message: i.message }))
  const fixes = issues.length ? fixAll(tokens) : {}
  return { checked: PAIRINGS.length, passing: PAIRINGS.length - issues.length, issues, suggestedFixes: fixes }
}

/** WCAG results for one foreground/background pair. */
export function pairReport(fg, bg) {
  const ratio = contrastRatio(fg, bg)
  return {
    foreground: fg,
    background: bg,
    ratio: formatRatio(ratio),
    text: ratio >= MIN_CONTRAST_TEXT ? 'pass (AA)' : 'fail',
    largeText: ratio >= MIN_CONTRAST_LARGE_TEXT ? 'pass (AA)' : 'fail',
    iconsAndUi: ratio >= MIN_CONTRAST_NON_TEXT ? 'pass (AA)' : 'fail',
    aaaText: ratio >= 7 ? 'pass' : 'fail',
  }
}

export { THRESHOLDS }

/** A complete, contrast-checked theme built around up to 8 colours, as the panel's image upload does. */
export function themeFromColours(colours) {
  const hexes = colours.map((c) => [c, normalizeHex(c)])
  const bad = hexes.filter(([, h]) => !h).map(([c]) => c)
  if (bad.length) throw new Error(`Not colours: ${bad.join(', ')}. Use hex codes like #0d6b84.`)
  return themeFromPalette([...new Set(hexes.map(([, h]) => h))].slice(0, 8))
}

/** The token set as Tailwind v4 @theme overrides. */
export const tailwindSnippet = (tokens) =>
  `@import "tailwindcss";\n@import "colorsbymax/tokens.css";\n\n@theme static {\n${TOKEN_KEYS.map((k) => `  --color-${k}: ${tokens[k]};`).join('\n')}\n}`

/** The panel's Import/export format: paste into the panel, or download as a .theme.json. */
export const themeJson = (name, tokens) => JSON.stringify({ name, tokens }, null, 2)
