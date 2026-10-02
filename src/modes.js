// Light and dark versions of themes. Every built-in theme is designed light, so dark mode
// derives a dark twin: dark tinted surfaces, light text, and brand and data colours lifted
// until they read on the dark background, then the usual contrast auto-fix.

import { contrastRatio, hexToRgb, hslToRgb, luminance, rgbToHex, rgbToHsl } from './color.js'
import { fixAll } from './contrast.js'
import { deriveAppTokens } from './tokens.js'

/** Suffix on a dark twin's id: `ocean` → `ocean~dark`. */
export const DARK_SUFFIX = '~dark'

/** True when a theme's page background is dark. */
export const isDarkTheme = (tokens) => luminance(tokens.background) < 0.2

const hslOf = (hex) => rgbToHsl(hexToRgb(hex))
const hsl = (h, s, l) => rgbToHex(hslToRgb([h, Math.min(1, Math.max(0, s)), Math.min(1, Math.max(0, l))]))

/** Same hue, saturation capped at `maxS`, lightness set to `l`. */
const tone = (hex, l, maxS = 1) => {
  const [h, s] = hslOf(hex)
  return hsl(h, Math.min(s, maxS), l)
}

/** Keeps hue and saturation, lifting lightness into [min, max] so it reads on a dark page. */
const lift = (hex, min, max = 0.78) => {
  const [h, s, l] = hslOf(hex)
  return hsl(h, s, Math.min(max, Math.max(min, l)))
}

/**
 * Lightens a colour, keeping its hue and saturation, until it reaches `ratio` against `bg`.
 * Lightness alone doesn't guarantee that: a vivid blue or violet at 60% lightness still reads dark.
 */
const readOn = (hex, bg, ratio) => {
  const [h, s, l] = hslOf(hex)
  let out = hex
  for (let x = l; contrastRatio(out, bg) < ratio && x < 0.96; x += 0.01) out = hsl(h, s, x)
  return out
}

// Targets with a little headroom over WCAG's 4.5:1 (text) and 3:1 (icons, large text), since some
// pairings sit on a faint tint of the background rather than the background itself.
const TEXT = 4.8
const ICON = 3.3

/** @param {import('./tokens.js').ThemeTokens} t */
export function darkTokens(t) {
  const background = tone(t.background, 0.08, 0.3)
  const secondary = tone(t.secondary, 0.2, 0.45)
  // The secondary area sits on a lighter panel than the page, so the brand must read on that too.
  const areaBg = deriveAppTokens({ ...t, secondary })['app-background']
  const lighterBg = luminance(areaBg) > luminance(background) ? areaBg : background
  // Primary is also text in dark mode (links, badges): lift it until it reads, then give buttons
  // whichever text colour reads best on it, the page's dark tone or white.
  const primary = readOn(lift(t.primary, 0.58, 0.7), lighterBg, TEXT)
  const onPrimary = [background, '#ffffff'].sort((a, b) => contrastRatio(b, primary) - contrastRatio(a, primary))[0]
  const tokens = {
    ...t,
    primary,
    'on-primary': onPrimary,
    'primary-dark': tone(t['primary-dark'], 0.82, 0.7),
    'primary-alt': readOn(lift(t['primary-alt'], 0.6), lighterBg, ICON),
    background,
    surface: tone(t.background, 0.12, 0.25),
    secondary,
    'on-secondary': tone(t['on-secondary'], 0.86, 0.6),
    accent: tone(t.accent, 0.17, 0.45),
    'on-accent': tone(t['on-accent'], 0.86, 0.6),
    border: tone(t.border, 0.24, 0.25),
    shadow: '#000000',
    ink: tone(t.ink, 0.94, 0.15),
    'ink-secondary': tone(t['ink-secondary'], 0.76, 0.12),
    'ink-muted': tone(t['ink-muted'], 0.7, 0.12),
    success: readOn(lift(t.success, 0.6), background, ICON),
    warning: readOn(lift(t.warning, 0.6), background, ICON),
    danger: readOn(lift(t.danger, 0.66), background, ICON),
    info: readOn(lift(t.info, 0.66), background, ICON),
  }
  // Data 1 and 2 are also used as text; the rest as icons and chart colours.
  for (let n = 1; n <= 8; n++) tokens[`data-${n}`] = readOn(lift(t[`data-${n}`], 0.6), background, n <= 2 ? TEXT : ICON)
  const full = { ...tokens, ...deriveAppTokens(tokens) }
  return { ...full, ...fixAll(full) }
}

const twins = new WeakMap()

/**
 * The dark twin of a light theme (cached per theme object). Themes that are already dark are
 * returned as they are.
 * @param {import('./tokens.js').Theme} theme
 */
export function toDark(theme) {
  if (isDarkTheme(theme.tokens)) return theme
  let twin = twins.get(theme)
  if (!twin) {
    twin = { ...theme, id: theme.id + DARK_SUFFIX, name: `${theme.name} (dark)`, tokens: darkTokens(theme.tokens), derived: true }
    twins.set(theme, twin)
  }
  return twin
}

/**
 * The version of a theme to list for a mode. Custom palettes always appear exactly as the
 * visitor made them.
 * @param {import('./tokens.js').Theme} theme
 * @param {'light' | 'dark'} mode
 */
export const inMode = (theme, mode) => (mode === 'dark' && !theme.custom ? toDark(theme) : theme)

// The page's quiet colours: its background, surfaces, borders and soft tints.
const QUIET = ['background', 'surface', 'secondary', 'accent', 'border', 'app-background', 'app-input', 'app-border']
// Text that sits on those tints, kept readable once they're calmer.
const ON_QUIET = { secondary: 'on-secondary', accent: 'on-accent' }

/**
 * The Subtle style on a site painted with the colour tokens: the page's backgrounds, cards,
 * borders and tints go nearly neutral (same lightness, a hint of the hue), so the theme's colour
 * stays on what matters: buttons, links, headings, highlights and charts.
 */
export function subtleTokens(t) {
  const out = { ...t }
  for (const key of QUIET) {
    if (!t[key]) continue
    const [h, s, l] = hslOf(t[key])
    out[key] = hsl(h, s * 0.18, l)
  }
  for (const [bg, fg] of Object.entries(ON_QUIET)) {
    if (!out[bg] || !out[fg] || contrastRatio(out[fg], out[bg]) >= 4.5) continue
    out[fg] = contrastRatio(t.ink, out[bg]) >= 4.5 ? t.ink : luminance(out[bg]) > 0.4 ? '#000000' : '#ffffff'
  }
  return out
}

// ------------------------------------------------------------------ colour styles
// How boldly a site takes a theme: Subtle keeps the site's own look and brings the theme in on
// its accents, Balanced is the theme as it's designed, and Colourful is an overhaul.

/** What Subtle keeps from the site: its backgrounds, cards, text, borders and status colours. */
const SITE_KEYS = ['background', 'surface', 'border', 'shadow', 'ink', 'ink-secondary', 'ink-muted', 'success', 'warning', 'danger', 'info', 'app-background', 'app-input', 'app-border', 'app-shadow-dark', 'app-shadow-light', 'app-ink', 'app-ink-muted']

/** The soft tints a page is coloured with (badges, icon tiles, bands): Subtle keeps them quiet. */
const TINT_KEYS = ['secondary', 'accent']

/**
 * Subtle: the site's own backgrounds, cards and text stay (in the current mode). The theme's brand
 * colour comes in on buttons, links and highlights, and the soft tints (badges, icon tiles, bands)
 * take only a quiet, greyed hint of the theme, so the page keeps its own feel. Balanced shows those
 * tints in full. Every pairing is then checked, and anything hard to read nudged until it reads.
 * @param {import('./tokens.js').ThemeTokens} theme
 * @param {import('./tokens.js').ThemeTokens} site  the site's own colours, in the same mode
 */
export function accentTokens(theme, site) {
  const out = { ...theme }
  for (const key of SITE_KEYS) if (site[key]) out[key] = site[key]
  for (const key of TINT_KEYS) {
    if (!theme[key] || !site.background) continue
    const [h, sat] = hslOf(theme[key])
    // The site's own page lightness, nudged a step towards a tint, with a fifth of the theme's colour.
    const [, , bgL] = hslOf(site.background)
    const l = bgL > 0.5 ? Math.max(0.86, bgL - 0.06) : Math.min(0.22, bgL + 0.07)
    out[key] = hsl(h, sat * 0.22, l)
  }
  return { ...out, ...fixAll(out) }
}

const tintTowards = (colour, base, amount) => {
  const [r, g, b] = hexToRgb(colour)
  const [br, bg, bb] = hexToRgb(base)
  return rgbToHex([r * amount + br * (1 - amount), g * amount + bg * (1 - amount), b * amount + bb * (1 - amount)])
}

/**
 * Colourful: an overhaul. The page and its cards take a clear tint of the brand colours (soft in
 * light mode, deeper in dark), borders and tints lean towards them, and colorsbymax paints the
 * page's parts by role on top (see vivid.js). Text is checked against every new background.
 */
export function vividTokens(t, { strength = 0.5, tint = null } = {}) {
  // Strength runs from a light wash (0) to bold (1); a tint from the site's pictures colours the
  // washes in place of the theme's brand colours.
  const k = Math.min(1, Math.max(0, strength))
  const lerp = (a, b) => a + (b - a) * k
  const dark = isDarkTheme(t)
  const wash = tint ?? t.primary
  const deep = t['primary-dark']
  const out = {
    ...t,
    // Its lightest is still a clear step above Balanced's soft wash.
    background: tintTowards(wash, t.background, dark ? lerp(0.11, 0.24) : lerp(0.09, 0.19)),
    // Cards take the same tint as the page (a second brand colour can clash on a large surface).
    surface: tintTowards(wash, t.surface, dark ? lerp(0.07, 0.18) : lerp(0.045, 0.11)),
    border: tintTowards(wash, t.border, lerp(0.15, 0.45)),
    secondary: tintTowards(wash, t.secondary, lerp(0.12, 0.4)),
    'app-background': tintTowards(wash, t['app-background'] ?? t.background, dark ? lerp(0.11, 0.24) : lerp(0.09, 0.19)),
    // Headings and text take a hint of the brand, more as it gets bolder; still checked below.
    ink: tintTowards(deep, t.ink, lerp(0.08, 0.4)),
    'ink-secondary': tintTowards(deep, t['ink-secondary'], lerp(0.08, 0.35)),
    shadow: tintTowards(t.primary, t.shadow, lerp(0.1, 0.35)),
  }
  return { ...out, ...fixAll(out) }
}

/**
 * Balanced: the theme in every role, with a soft wash of it on the page, cards and borders, so it
 * shows on the page even where the theme's own backgrounds are nearly white (or nearly black).
 * Gentler than Colourful at its lightest; text keeps the theme's own colours.
 */
export function balancedTokens(t) {
  const dark = isDarkTheme(t)
  const out = {
    ...t,
    background: tintTowards(t.primary, t.background, dark ? 0.065 : 0.05),
    surface: tintTowards(t['primary-alt'], t.surface, dark ? 0.04 : 0.02),
    border: tintTowards(t.primary, t.border, 0.2),
    'app-background': tintTowards(t.primary, t['app-background'] ?? t.background, dark ? 0.065 : 0.05),
  }
  return { ...out, ...fixAll(out) }
}
