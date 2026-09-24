import { lightness, withLightness } from './color.js'

// colorsbymax token schema. Every themeable colour is one of these keys, exposed to CSS as
// `--color-<key>`. A site maps its colours onto these keys once (e.g. Tailwind v4 @theme
// variables), after which any theme can be applied at runtime.

/**
 * @typedef {'primary'|'primary-dark'|'primary-alt'|'on-primary'
 *   |'background'|'surface'|'secondary'|'on-secondary'|'accent'|'on-accent'|'border'|'shadow'
 *   |'ink'|'ink-secondary'|'ink-muted'
 *   |'success'|'warning'|'danger'|'info'
 *   |'data-1'|'data-2'|'data-3'|'data-4'|'data-5'|'data-6'|'data-7'|'data-8'
 *   |'app-background'|'app-input'|'app-border'|'app-primary'|'app-shadow-dark'|'app-shadow-light'|'app-ink'|'app-ink-muted'} TokenKey
 */

/** @typedef {Record<TokenKey, string>} ThemeTokens  Token key → "#rrggbb". */

/**
 * @typedef {Object} Theme
 * @property {string} id
 * @property {string} name
 * @property {ThemeTokens} tokens
 * @property {boolean} [custom]   true for user-created palettes
 * @property {boolean} [library]  true for themes from the generated library
 * @property {boolean} [site]     true for the host site's own themes
 */

/** @type {{ group: string, tokens: { key: TokenKey, label: string, usage: string }[] }[]} */
export const TOKEN_GROUPS = [
  {
    group: 'Brand',
    tokens: [
      { key: 'primary', label: 'Primary', usage: 'Buttons, highlighted bands, links, focus rings' },
      { key: 'primary-dark', label: 'Primary dark', usage: 'Logo or brand text' },
      { key: 'primary-alt', label: 'Primary gradient partner', usage: 'Gradients and glows' },
      { key: 'on-primary', label: 'Text on primary', usage: 'Text on primary buttons and bands' },
    ],
  },
  {
    group: 'Surfaces',
    tokens: [
      { key: 'background', label: 'Page background', usage: 'Behind everything' },
      { key: 'surface', label: 'Surface', usage: 'Cards, panels, inputs' },
      { key: 'secondary', label: 'Tint', usage: 'Badges, tinted areas, footers' },
      { key: 'on-secondary', label: 'Text on tint', usage: 'Text on tinted areas' },
      { key: 'accent', label: 'Hover tint', usage: 'Hover backgrounds' },
      { key: 'on-accent', label: 'Text on hover tint', usage: 'Text on hover backgrounds' },
      { key: 'border', label: 'Border', usage: 'Dividers (decorative)' },
      { key: 'shadow', label: 'Shadow', usage: 'Card and panel shadows' },
    ],
  },
  {
    group: 'Text',
    tokens: [
      { key: 'ink', label: 'Text', usage: 'Headings and body text' },
      { key: 'ink-secondary', label: 'Secondary text', usage: 'Paragraphs, nav links' },
      { key: 'ink-muted', label: 'Muted text', usage: 'Placeholders, footnotes' },
    ],
  },
  {
    group: 'Status',
    tokens: [
      { key: 'success', label: 'Success', usage: 'Confirmations, positive icons' },
      { key: 'warning', label: 'Warning', usage: 'Reserved for warnings' },
      { key: 'danger', label: 'Danger', usage: 'Errors, problem icons' },
      { key: 'info', label: 'Info', usage: 'Informational icons' },
    ],
  },
  {
    group: 'Data / categorical',
    tokens: [
      { key: 'data-1', label: 'Data 1', usage: 'Charts, icons, category colour 1' },
      { key: 'data-2', label: 'Data 2', usage: 'Category colour 2' },
      { key: 'data-3', label: 'Data 3', usage: 'Category colour 3' },
      { key: 'data-4', label: 'Data 4', usage: 'Category colour 4' },
      { key: 'data-5', label: 'Data 5', usage: 'Category colour 5' },
      { key: 'data-6', label: 'Data 6', usage: 'Category colour 6' },
      { key: 'data-7', label: 'Data 7', usage: 'Category colour 7' },
      { key: 'data-8', label: 'Data 8', usage: 'Category colour 8' },
    ],
  },
  {
    group: 'Secondary area',
    tokens: [
      { key: 'app-background', label: 'Area background', usage: 'A distinct section, e.g. sign-in pages' },
      { key: 'app-input', label: 'Area input fill', usage: 'Form fields' },
      { key: 'app-border', label: 'Area border', usage: 'Card, field and divider lines' },
      { key: 'app-primary', label: 'Area primary', usage: 'Buttons and links in the area' },
      { key: 'app-shadow-dark', label: 'Area shadow (dark)', usage: 'Neumorphic lower shadow' },
      { key: 'app-shadow-light', label: 'Area shadow (light)', usage: 'Neumorphic upper highlight' },
      { key: 'app-ink', label: 'Area text', usage: 'Labels and input text' },
      { key: 'app-ink-muted', label: 'Area muted text', usage: 'Descriptions, placeholders, icons' },
    ],
  },
]

/** @type {TokenKey[]} */
export const TOKEN_KEYS = TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => t.key))

export const TOKEN_LABELS = Object.fromEntries(TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => [t.key, t.label])))

// Darker categorical set that clears 3:1 as icons and 4.5:1 where used as text.
const DATA_ACCESSIBLE = {
  'data-1': '#1d4ed8',
  'data-2': '#047857',
  'data-3': '#be185d',
  'data-4': '#c2410c',
  'data-5': '#4b5563',
  'data-6': '#7c3aed',
  'data-7': '#0e7490',
  'data-8': '#4d7c0f',
}

const STATUS_ACCESSIBLE = {
  success: '#15803d',
  warning: '#b45309',
  danger: '#b91c1c',
  info: '#1d4ed8',
}

const APP_KEYS = TOKEN_GROUPS.find((g) => g.group === 'Secondary area').tokens.map((t) => t.key)

/**
 * Derives the secondary-area tokens from a theme's main palette, for themes that don't
 * define them: a soft tinted area with neumorphic shadows, reusing its text and primary.
 */
export function deriveAppTokens(t) {
  const bg = withLightness(t.secondary, Math.min(0.93, lightness(t.secondary)))
  const l = lightness(bg)
  return {
    'app-background': bg,
    'app-input': withLightness(bg, l - 0.05),
    'app-border': withLightness(bg, l - 0.1),
    'app-primary': t.primary,
    'app-shadow-dark': withLightness(bg, l - 0.08),
    'app-shadow-light': withLightness(bg, Math.min(0.99, l + 0.08)),
    'app-ink': t.ink,
    'app-ink-muted': t['ink-secondary'],
  }
}

/** @type {Theme[]} */
const RAW_PRESETS = [
  {
    id: 'ocean',
    name: 'Ocean',
    tokens: {
      primary: '#0d6b84',
      'app-primary': '#0b5e74',
      'primary-dark': '#164e63',
      'primary-alt': '#0891b2',
      'on-primary': '#ffffff',
      background: '#f8fcfd',
      surface: '#ffffff',
      secondary: '#dff3f8',
      'on-secondary': '#155e75',
      accent: '#e0f2f7',
      'on-accent': '#155e75',
      border: '#d5e7ec',
      shadow: '#0c2a33',
      ink: '#122126',
      'ink-secondary': '#4a5f66',
      'ink-muted': '#56696f',
      ...STATUS_ACCESSIBLE,
      ...DATA_ACCESSIBLE,
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    tokens: {
      primary: '#127136',
      'app-primary': '#106430',
      'primary-dark': '#14532d',
      'primary-alt': '#159c47',
      'on-primary': '#ffffff',
      background: '#f9fcf9',
      surface: '#ffffff',
      secondary: '#e1f3e6',
      'on-secondary': '#166534',
      accent: '#e6f4ea',
      'on-accent': '#166534',
      border: '#d7e8dc',
      shadow: '#0f2a18',
      ink: '#17231b',
      'ink-secondary': '#4d5f53',
      'ink-muted': '#56685c',
      ...STATUS_ACCESSIBLE,
      ...DATA_ACCESSIBLE,
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    tokens: {
      primary: '#ac3a0b',
      'app-primary': '#a2370a',
      'primary-dark': '#7c2d12',
      'primary-alt': '#ea580c',
      'on-primary': '#ffffff',
      background: '#fffbf8',
      surface: '#ffffff',
      secondary: '#fde8dc',
      'on-secondary': '#9a3412',
      accent: '#fdeee4',
      'on-accent': '#9a3412',
      border: '#f1ddd0',
      shadow: '#3b1a0c',
      ink: '#2a1a12',
      'ink-secondary': '#6b5448',
      'ink-muted': '#6f584c',
      ...STATUS_ACCESSIBLE,
      ...DATA_ACCESSIBLE,
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    tokens: {
      primary: '#334155',
      'primary-dark': '#0f172a',
      'primary-alt': '#64748b',
      'on-primary': '#ffffff',
      background: '#f8fafc',
      surface: '#ffffff',
      secondary: '#e2e8f0',
      'on-secondary': '#1e293b',
      accent: '#eef2f6',
      'on-accent': '#1e293b',
      border: '#dbe2ea',
      shadow: '#0f172a',
      ink: '#0f172a',
      'ink-secondary': '#475569',
      'ink-muted': '#556274',
      ...STATUS_ACCESSIBLE,
      ...DATA_ACCESSIBLE,
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    tokens: {
      primary: '#b7175a',
      'primary-dark': '#831843',
      'primary-alt': '#db2777',
      'on-primary': '#ffffff',
      background: '#fffafc',
      surface: '#ffffff',
      secondary: '#fce4ef',
      'on-secondary': '#9d174d',
      accent: '#fdecf3',
      'on-accent': '#9d174d',
      border: '#f2d9e4',
      shadow: '#3d0f22',
      ink: '#2b1520',
      'ink-secondary': '#6b4f5c',
      'ink-muted': '#6f5360',
      ...STATUS_ACCESSIBLE,
      ...DATA_ACCESSIBLE,
    },
  },
]

/** Neutral fallback used to fill tokens a theme leaves out (Slate). */
export const BASE_TOKENS = { ...RAW_PRESETS.find((t) => t.id === 'slate').tokens, ...deriveAppTokens(RAW_PRESETS.find((t) => t.id === 'slate').tokens) }

/**
 * Fills any missing tokens: secondary-area tokens are derived from the theme itself, the
 * rest come from `base` (the site's default theme, or the neutral fallback).
 */
export function completeTokens(partial, base = BASE_TOKENS) {
  const full = { ...base, ...partial }
  const derived = deriveAppTokens(full)
  for (const key of APP_KEYS) if (!(key in partial)) full[key] = derived[key]
  return full
}

/** The built-in "colorsbymax picks": hand-tuned themes that pass every contrast check. */
/** @type {Theme[]} */
export const PRESETS = RAW_PRESETS.map((t) => ({ ...t, tokens: completeTokens(t.tokens) }))
