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
