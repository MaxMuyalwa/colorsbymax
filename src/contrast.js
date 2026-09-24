// WCAG contrast validation for themes. PAIRINGS lists the foreground/background pairings a
// typical site renders with the colorsbymax tokens, computed against realistic composited
// backgrounds (translucent cards, tinted icon chips) rather than the raw token.

import { contrastRatio, deltaE, lightness, mix, toLab, withLightness } from './color.js'

/** WCAG 2.x SC 1.4.3: normal-size text. */
export const MIN_CONTRAST_TEXT = 4.5
/** WCAG 2.x SC 1.4.3: large text (≥24px, or ≥18.66px bold). */
export const MIN_CONTRAST_LARGE_TEXT = 3
/** WCAG 2.x SC 1.4.11: icons, chart marks, meaningful borders. */
export const MIN_CONTRAST_NON_TEXT = 3
/** Minimum CIE76 ΔE between adjacent steps of an ordinal/sequential ramp. */
export const MIN_RAMP_STEP_DELTA_E = 10
/** HSL lightness step used when searching for the nearest passing value. */
export const AUTO_FIX_LIGHTNESS_STEP = 0.005

export const THRESHOLDS = {
  text: MIN_CONTRAST_TEXT,
  'large-text': MIN_CONTRAST_LARGE_TEXT,
  'non-text': MIN_CONTRAST_NON_TEXT,
}

const CONSEQUENCE = {
  text: 'text will be hard to read',
  'large-text': 'headline will be hard to read',
  'non-text': 'icon will be hard to see',
}

// Opacities used by the page's classes, so checks match what is painted.
const GLASS_ALPHA = 0.6 // translucent card: surface at 60% over the background
const CHIP_ALPHA = 0.15 // icon on a 15% tint of its own colour
const BADGE_ALPHA = 0.1 // primary text on a 10% primary tint (badges, pills)
const MUTED_ON_PRIMARY_ALPHA = 0.8 // secondary text on primary: on-primary at 80%
const APP_GRADIENT_LIGHT_ALPHA = 0.8 // lighter end of an app-primary button gradient (80% + white)

const glass = (t) => mix(t.surface, t.background, GLASS_ALPHA)
const chip = (key) => (t) => mix(t[key], glass(t), CHIP_ALPHA)

/**
 * @typedef {Object} Pairing
 * @property {string} id
 * @property {string} label       Human name, e.g. "Primary on surface"
 * @property {'text'|'large-text'|'non-text'} kind
 * @property {(t: import('./tokens.js').ThemeTokens) => string} fg
 * @property {(t: import('./tokens.js').ThemeTokens) => string} bg
 * @property {import('./tokens.js').TokenKey[]} fixable  Tokens auto-fix may adjust, in preference order
 */

/** @type {Pairing[]} */
export const PAIRINGS = [
  { id: 'ink-bg', label: 'Text on page background', kind: 'text', fg: (t) => t.ink, bg: (t) => t.background, fixable: ['ink'] },
  { id: 'ink-card', label: 'Text on cards', kind: 'text', fg: (t) => t.ink, bg: glass, fixable: ['ink'] },
  { id: 'ink2-bg', label: 'Secondary text on page background', kind: 'text', fg: (t) => t['ink-secondary'], bg: (t) => t.background, fixable: ['ink-secondary'] },
  { id: 'ink2-card', label: 'Secondary text on cards', kind: 'text', fg: (t) => t['ink-secondary'], bg: glass, fixable: ['ink-secondary'] },
  { id: 'ink3-surface', label: 'Muted text on surface', kind: 'text', fg: (t) => t['ink-muted'], bg: (t) => t.surface, fixable: ['ink-muted'] },
  { id: 'ink3-bg', label: 'Muted text on page background', kind: 'text', fg: (t) => t['ink-muted'], bg: (t) => t.background, fixable: ['ink-muted'] },
  { id: 'on-primary', label: 'Button text on primary', kind: 'text', fg: (t) => t['on-primary'], bg: (t) => t.primary, fixable: ['primary', 'on-primary'] },
  {
    id: 'muted-on-primary',
    label: 'Secondary text on primary',
    kind: 'text',
    fg: (t) => mix(t['on-primary'], t.primary, MUTED_ON_PRIMARY_ALPHA),
    bg: (t) => t.primary,
    fixable: ['primary', 'on-primary'],
  },
  { id: 'primary-text', label: 'Primary text on background', kind: 'text', fg: (t) => t.primary, bg: (t) => mix(t.primary, t.background, BADGE_ALPHA), fixable: ['primary'] },
  { id: 'primary-dark-nav', label: 'Brand-dark text on cards', kind: 'text', fg: (t) => t['primary-dark'], bg: glass, fixable: ['primary-dark'] },
  { id: 'gradient-a', label: 'Headline gradient (primary) on background', kind: 'large-text', fg: (t) => t.primary, bg: (t) => t.background, fixable: ['primary'] },
  { id: 'gradient-b', label: 'Headline gradient (partner) on background', kind: 'large-text', fg: (t) => t['primary-alt'], bg: (t) => t.background, fixable: ['primary-alt'] },
  { id: 'on-secondary', label: 'Text on tint', kind: 'text', fg: (t) => t['on-secondary'], bg: (t) => t.secondary, fixable: ['on-secondary'] },
  { id: 'on-accent', label: 'Hover text on hover tint', kind: 'text', fg: (t) => t['on-accent'], bg: (t) => t.accent, fixable: ['on-accent'] },
  { id: 'icon-primary', label: 'Primary icon on its chip', kind: 'non-text', fg: (t) => t.primary, bg: chip('primary'), fixable: ['primary'] },
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    id: `icon-data-${n}`,
    label: `Data ${n} icon on its tint`,
    kind: 'non-text',
    fg: (t) => t[`data-${n}`],
    bg: chip(`data-${n}`),
    fixable: [`data-${n}`],
  })),
  { id: 'text-data-1', label: 'Data 1 as text on background', kind: 'text', fg: (t) => t['data-1'], bg: (t) => t.background, fixable: ['data-1'] },
  { id: 'text-data-2', label: 'Data 2 as text on background', kind: 'text', fg: (t) => t['data-2'], bg: (t) => t.background, fixable: ['data-2'] },
  ...['success', 'danger', 'info', 'warning'].map((key) => ({
    id: `icon-${key}`,
    label: `${key[0].toUpperCase()}${key.slice(1)} icon on its tint`,
    kind: 'non-text',
    fg: (t) => t[key],
    bg: (t) => mix(t[key], t.surface, CHIP_ALPHA),
    fixable: [key],
  })),
  { id: 'text-success', label: 'Success text on cards', kind: 'text', fg: (t) => t.success, bg: glass, fixable: ['success'] },
  { id: 'text-danger', label: 'Error text on cards', kind: 'text', fg: (t) => t.danger, bg: glass, fixable: ['danger'] },

  // Secondary area (e.g. sign-in pages).
  { id: 'app-ink', label: 'Area text on area background', kind: 'text', fg: (t) => t['app-ink'], bg: (t) => t['app-background'], fixable: ['app-ink'] },
  { id: 'app-muted', label: 'Area muted text on area background', kind: 'text', fg: (t) => t['app-ink-muted'], bg: (t) => t['app-background'], fixable: ['app-ink-muted'] },
  { id: 'app-placeholder', label: 'Placeholder text in area fields', kind: 'text', fg: (t) => t['app-ink-muted'], bg: (t) => t['app-input'], fixable: ['app-ink-muted'] },
  {
    id: 'app-button',
    label: 'Area button text on gradient',
    kind: 'text',
    fg: (t) => t['on-primary'],
    // Lighter end of the button gradient, the harder one to read.
    bg: (t) => mix(t['app-primary'], '#ffffff', APP_GRADIENT_LIGHT_ALPHA),
    fixable: ['app-primary', 'on-primary'],
  },
  { id: 'app-link', label: 'Area links on area background', kind: 'text', fg: (t) => t['app-primary'], bg: (t) => t['app-background'], fixable: ['app-primary'] },
  { id: 'app-title-a', label: 'Area headline gradient (primary)', kind: 'large-text', fg: (t) => t.primary, bg: (t) => t['app-background'], fixable: ['primary'] },
  { id: 'app-title-b', label: 'Area headline gradient (partner)', kind: 'large-text', fg: (t) => t['primary-alt'], bg: (t) => t['app-background'], fixable: ['primary-alt'] },
]

/**
 * @typedef {Object} ContrastIssue
 * @property {Pairing} pairing
 * @property {number} ratio
 * @property {number} required
 * @property {string} message   e.g. "Primary text on background: 2.7:1 — text will be hard to read (needs 4.5:1)"
 */

export const formatRatio = (r) => `${(Math.floor(r * 10) / 10).toFixed(1)}:1`

export function evaluatePairing(pairing, tokens) {
  const ratio = contrastRatio(pairing.fg(tokens), pairing.bg(tokens))
  const required = THRESHOLDS[pairing.kind]
  return { ratio, required, pass: ratio >= required }
}

/** Returns every failing pairing for a theme. */
export function checkTheme(tokens) {
  /** @type {ContrastIssue[]} */
  const issues = []
  for (const pairing of PAIRINGS) {
    const { ratio, required, pass } = evaluatePairing(pairing, tokens)
    if (!pass) {
      issues.push({
        pairing,
        ratio,
        required,
        message: `${pairing.label}: ${formatRatio(ratio)} — ${CONSEQUENCE[pairing.kind]} (needs ${required}:1)`,
      })
    }
  }
  return issues
}

/**
 * Finds the smallest lightness change to one of the pairing's fixable tokens that makes
 * it pass. Returns `{ key, value }` or null if no single-token change can pass.
 */
export function suggestFix(pairing, tokens) {
  let best = null
  for (const key of pairing.fixable) {
    const start = lightness(tokens[key])
    for (const dir of [-1, 1]) {
      for (let d = AUTO_FIX_LIGHTNESS_STEP; start + dir * d >= 0 && start + dir * d <= 1; d += AUTO_FIX_LIGHTNESS_STEP) {
        const value = withLightness(tokens[key], start + dir * d)
        if (evaluatePairing(pairing, { ...tokens, [key]: value }).pass) {
          if (!best || d < best.delta) best = { key, value, delta: d }
          break
        }
      }
    }
  }
  return best && { key: best.key, value: best.value }
}

/**
 * Repeatedly fixes failing pairings until the theme passes or no progress is possible.
 * Returns the changed tokens only.
 */
export function fixAll(tokens) {
  let current = { ...tokens }
  const changes = {}
  for (let pass = 0; pass < PAIRINGS.length * 3; pass++) {
    const fixable = checkTheme(current)
      .map((issue) => suggestFix(issue.pairing, current))
      .find(Boolean)
    if (!fixable) break
    current = { ...current, [fixable.key]: fixable.value }
    changes[fixable.key] = fixable.value
  }
  return changes
}

/**
 * Checks an ordinal/sequential ramp (lightest → darkest or darkest → lightest):
 * lightness must be monotonic, adjacent steps distinguishable, and the lightest step
 * must still clear the surface it is drawn on. Returns a list of problem strings.
 * The site has no charts today, so no ramp tokens exist yet; this is ready for them.
 */
export function checkRamp(colors, surface) {
  const problems = []
  const L = colors.map((c) => toLab(c)[0])
  const rising = L.every((v, i) => i === 0 || v >= L[i - 1])
  const falling = L.every((v, i) => i === 0 || v <= L[i - 1])
  if (!rising && !falling) problems.push('Lightness is not monotonic across the ramp')
  for (let i = 1; i < colors.length; i++) {
    const d = deltaE(colors[i - 1], colors[i])
    if (d < MIN_RAMP_STEP_DELTA_E) problems.push(`Steps ${i} and ${i + 1} are too similar (ΔE ${d.toFixed(1)})`)
  }
  const lightest = colors[L.indexOf(Math.max(...L))]
  const r = contrastRatio(lightest, surface)
  if (r < MIN_CONTRAST_NON_TEXT) problems.push(`Lightest step on surface: ${formatRatio(r)} (needs ${MIN_CONTRAST_NON_TEXT}:1)`)
  return problems
}
