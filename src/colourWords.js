// Colour words for the panel's search: "red" finds every theme whose main colours are red, not
// only the ones with red in their name. Each word is a range of hue, saturation and lightness;
// a theme matches when its brand colour or its gradient partner falls in it.

import { hexToRgb, rgbToHsl } from './color.js'

const inHue = (h, from, to) => (from <= to ? h >= from && h <= to : h >= from || h <= to)

/** [word, other words for it, test on [hue 0-360, saturation 0-1, lightness 0-1]] */
const COLOURS = [
  ['red', ['crimson', 'scarlet'], ([h, s, l]) => inHue(h, 345, 12) && s >= 0.35 && l >= 0.2 && l <= 0.7],
  ['orange', ['tangerine'], ([h, s, l]) => inHue(h, 13, 38) && s >= 0.45 && l >= 0.35],
  ['coral', ['salmon', 'peach'], ([h, s, l]) => inHue(h, 0, 25) && s >= 0.45 && l >= 0.55],
  ['yellow', ['lemon'], ([h, s, l]) => inHue(h, 45, 64) && s >= 0.45 && l >= 0.45],
  ['gold', ['mustard', 'amber'], ([h, s, l]) => inHue(h, 36, 52) && s >= 0.4 && l >= 0.3 && l <= 0.65],
  ['lime', ['chartreuse'], ([h, s, l]) => inHue(h, 65, 95) && s >= 0.45 && l >= 0.35],
  ['green', ['emerald', 'olive', 'forest', 'sage', 'mint'], ([h, s]) => inHue(h, 75, 160) && s >= 0.2],
  ['teal', ['turquoise'], ([h, s]) => inHue(h, 160, 195) && s >= 0.25],
  ['cyan', ['aqua'], ([h, s, l]) => inHue(h, 180, 200) && s >= 0.45 && l >= 0.4],
  ['blue', ['sky', 'cobalt', 'azure'], ([h, s]) => inHue(h, 196, 250) && s >= 0.25],
  ['navy', ['indigo'], ([h, s, l]) => inHue(h, 205, 255) && s >= 0.2 && l <= 0.35],
  ['purple', ['violet', 'plum', 'lavender', 'lilac'], ([h, s]) => inHue(h, 251, 295) && s >= 0.2],
  ['pink', ['rose', 'blush', 'fuchsia', 'magenta', 'berry'], ([h, s, l]) => inHue(h, 296, 344) && s >= 0.3 && l >= 0.3],
  ['brown', ['chocolate', 'coffee', 'camel', 'rust', 'terracotta'], ([h, s, l]) => inHue(h, 10, 45) && s >= 0.2 && l <= 0.45],
  ['beige', ['cream', 'sand', 'tan', 'ivory'], ([h, s, l]) => inHue(h, 25, 60) && s >= 0.1 && l >= 0.6],
  ['grey', ['gray', 'slate', 'silver', 'charcoal', 'monochrome'], ([, s]) => s < 0.14],
  ['black', ['dark'], ([, , l]) => l <= 0.18],
  ['white', ['light'], ([, , l]) => l >= 0.9],
]
// Everyday colour names first (black, blue, brown), then the rest (blush, berry…).
const WORDS = [...COLOURS.map(([word]) => word), ...COLOURS.flatMap(([, aliases]) => aliases)]
const hslOf = (hex) => rgbToHsl(hexToRgb(hex))

/**
 * The colour test for a search, or null if it isn't a colour word. "reds" and "Red" count too.
 * @returns {((tokens: Record<string, string>) => boolean) | null}
 */
export function colourMatcher(query) {
  const q = query.trim().toLowerCase().replace(/s$/, '')
  const found = COLOURS.find(([word, aliases]) => word === q || aliases.includes(q))
  if (!found) return null
  const [, , test] = found
  // Brand colour and gradient partner are what a theme looks like; black and white also count
  // the deep brand colour (its darkest ink) and the page background.
  const keys = ['black', 'white'].includes(found[0]) ? ['primary', 'primary-dark', 'background'] : ['primary', 'primary-alt']
  return (tokens) => keys.some((k) => tokens[k] && test(hslOf(tokens[k])))
}

/** Words that finish what's being typed (at most `max`), colours first, then `extra` (e.g. moods). */
export function suggestWords(query, extra = [], max = 6) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const pool = [...WORDS, ...extra.map((w) => w.toLowerCase())]
  const starts = pool.filter((w) => w.startsWith(q) && w !== q)
  return [...new Set(starts)].slice(0, max)
}
