// How many colours a theme uses, from 10 (all of them) down to 5 (its core). The ten are the
// swatches on a theme's card: five core colours every page needs, and five extras.
//
//   core    primary · primary-alt · primary-dark · background · ink
//   extras  secondary (the soft brand tint) · data-1 … data-4 (chart and category colours)
//
// Fewer colours keeps a site calmer and more of a piece. The extras go in order of how well they
// fit the theme: a chart colour whose hue is furthest from the theme's own brand colours (a
// bright blue in a forest theme) goes first, one close to them last, and the soft tint, which is
// the brand colour itself, only when the theme is down to five. A colour that's gone isn't left
// as a hole: its role is painted with the colours that remain, so the site really uses fewer.

import { contrastRatio, hexToRgb, hslToRgb, mix, rgbToHex, rgbToHsl } from './color.js'
import { fixAll } from './contrast.js'

export const MIN_COLOURS = 5
export const MAX_COLOURS = 10
/** The ten, in the order a card shows them. */
export const SWATCH_KEYS = ['primary', 'primary-alt', 'primary-dark', 'secondary', 'background', 'ink', 'data-1', 'data-2', 'data-3', 'data-4']
const CHART = ['data-1', 'data-2', 'data-3', 'data-4']
const HIDDEN_CHART = ['data-5', 'data-6', 'data-7', 'data-8']

const hslOf = (hex) => rgbToHsl(hexToRgb(hex))
const hueGap = (a, b) => {
  const d = Math.abs(a - b)
  return Math.min(d, 360 - d)
}
export const clampColours = (n) => Math.min(MAX_COLOURS, Math.max(MIN_COLOURS, Math.round(Number(n) || MAX_COLOURS)))

/** How far a colour's hue is from the theme's brand colours (0 = one of them); greys fit anything. */
function misfit(tokens, key) {
  const [h, s] = hslOf(tokens[key])
  if (s < 0.15) return 0
  const brand = ['primary', 'primary-alt'].map((k) => hslOf(tokens[k])).filter(([, bs]) => bs >= 0.15)
  if (!brand.length) return 90
  return Math.min(...brand.map(([bh]) => hueGap(h, bh)))
}

/** The swatch keys a theme keeps at `count` colours, in card order. */
export function paletteKeys(tokens, count = MAX_COLOURS) {
  const n = clampColours(count)
  if (n >= MAX_COLOURS) return SWATCH_KEYS
  // Extras by how well they fit: the soft tint first, then chart colours closest in hue.
  const extras = ['secondary', ...[...CHART].sort((a, b) => misfit(tokens, a) - misfit(tokens, b))]
  const kept = new Set(['primary', 'primary-alt', 'primary-dark', 'background', 'ink', ...extras.slice(0, n - MIN_COLOURS)])
  return SWATCH_KEYS.filter((k) => kept.has(k))
}

/** Same hue and saturation as `hex`, at lightness `l`. */
const atLightness = (hex, l) => {
  const [h, s] = hslOf(hex)
  return rgbToHex(hslToRgb([h, s, l]))
}

/**
 * A theme's tokens using only `count` of its colours. Chart colours that go are painted with
 * the ones that stay (brand colours first), at their own lightness so charts keep their
 * contrast; a soft tint that goes becomes a tint of the brand colour. The colours it replaces are
 * then run through the contrast fixes (lightness only), so a smaller palette still reads.
 */
export function reducePalette(tokens, count = MAX_COLOURS) {
  const n = clampColours(count)
  if (n >= MAX_COLOURS) return tokens
  const kept = new Set(paletteKeys(tokens, n))
  const out = { ...tokens }
  const replaced = new Set()
  const pool = ['primary', 'primary-alt', ...CHART.filter((k) => kept.has(k))].map((k) => tokens[k])
  ;[...CHART.filter((k) => !kept.has(k)), ...HIDDEN_CHART].forEach((key, i) => {
    if (!tokens[key]) return
    out[key] = atLightness(pool[i % pool.length], hslOf(tokens[key])[2])
    replaced.add(key)
  })
  if (!kept.has('secondary')) {
    out.secondary = mix(tokens.primary, tokens.background, 0.14)
    const onSecondary = [tokens['on-secondary'], tokens['primary-dark'], tokens.ink]
    out['on-secondary'] = onSecondary.find((c) => c && contrastRatio(c, out.secondary) >= 4.5) ?? tokens.ink
    replaced.add('secondary').add('on-secondary')
  }
  // Only what was replaced may move: the theme's own colours stay exactly as designed.
  for (const [key, value] of Object.entries(fixAll(out))) if (replaced.has(key)) out[key] = value
  return out
}

/** A theme's saved colour count: its own, or the visitor's default for every theme. */
export const coloursFor = (sizes, themeId, fallback = MAX_COLOURS) => clampColours(sizes?.[baseId(themeId)] ?? fallback)
/** Light and dark versions of a theme share one count. */
export const baseId = (id) => String(id).replace(/~dark$/, '')
