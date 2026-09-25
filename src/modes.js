// Light and dark versions of themes. Every built-in theme is designed light, so dark mode
// derives a dark twin: dark tinted surfaces, light text, and brand and data colours lifted
// until they read on the dark background, then the usual contrast auto-fix.

import { hexToRgb, hslToRgb, luminance, rgbToHex, rgbToHsl } from './color.js'
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

/** @param {import('./tokens.js').ThemeTokens} t */
export function darkTokens(t) {
  const primary = lift(t.primary, 0.58, 0.7)
  const onPrimary = luminance(primary) > 0.18 ? tone(t.background, 0.08, 0.3) : '#ffffff'
  const tokens = {
    ...t,
    primary,
    'on-primary': onPrimary,
    'primary-dark': tone(t['primary-dark'], 0.82, 0.7),
    'primary-alt': lift(t['primary-alt'], 0.6),
    background: tone(t.background, 0.08, 0.3),
    surface: tone(t.background, 0.12, 0.25),
    secondary: tone(t.secondary, 0.2, 0.45),
    'on-secondary': tone(t['on-secondary'], 0.86, 0.6),
    accent: tone(t.accent, 0.17, 0.45),
    'on-accent': tone(t['on-accent'], 0.86, 0.6),
    border: tone(t.border, 0.24, 0.25),
    shadow: '#000000',
    ink: tone(t.ink, 0.94, 0.15),
    'ink-secondary': tone(t['ink-secondary'], 0.76, 0.12),
    'ink-muted': tone(t['ink-muted'], 0.7, 0.12),
    success: lift(t.success, 0.6),
    warning: lift(t.warning, 0.6),
    danger: lift(t.danger, 0.66),
    info: lift(t.info, 0.66),
  }
  for (let n = 1; n <= 8; n++) tokens[`data-${n}`] = lift(t[`data-${n}`], 0.6)
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
