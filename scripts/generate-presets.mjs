// Builds src/library.generated.json: hundreds of preset themes generated from the
// community palettes in `nice-color-palettes` (MIT; top palettes from ColourLovers).
//
// Each 5-colour source palette becomes a full theme (all tokens), is auto-fixed so every
// WCAG pairing passes, gets a readable name and is tagged into categories.
//
//   npm run presets
//
// Categories are computed from the palette's colours, so tweak CATEGORIES below to taste.

import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { deltaE, hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from '../src/color.js'
import { checkTheme, fixAll } from '../src/contrast.js'
import { TOKEN_KEYS, deriveAppTokens } from '../src/tokens.js'

const require = createRequire(import.meta.url)
const SOURCE = require('nice-color-palettes/1000.json')
const OUT = new URL('../src/library.generated.json', import.meta.url)

const STATUS = { success: '#15803d', warning: '#b45309', danger: '#b91c1c', info: '#1d4ed8' }

const hsl = (h, s, l) => rgbToHex(hslToRgb([((h % 360) + 360) % 360, Math.min(1, Math.max(0, s)), Math.min(1, Math.max(0, l))]))
const toHsl = (hex) => rgbToHsl(hexToRgb(hex))
const hueDist = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))

// ---------------------------------------------------------------------------------------
// Names: nearest entry in a small list of everyday colour names.
const NAMES = {
  Black: '#1b1b1b', Charcoal: '#36454f', Slate: '#64748b', Grey: '#9ca3af', Silver: '#cbd5e1', Ivory: '#fbf8ea', Cream: '#f3e9c6',
  Sand: '#d8c49b', Tan: '#c19a6b', Camel: '#b5835a', Brown: '#6f4e37', Chocolate: '#4b2e20', Rust: '#b7410e', Terracotta: '#c8674a',
  Brick: '#9c3b2e', Crimson: '#b0133a', Red: '#d62828', Cherry: '#9b1b30', Coral: '#ff7f61', Salmon: '#f59a84', Peach: '#ffc3a0',
  Apricot: '#f7b37a', Orange: '#f57c00', Tangerine: '#ff9408', Amber: '#ffb300', Mustard: '#d4a017', Gold: '#e6b422', Lemon: '#f4e04d',
  Butter: '#f8e8a0', Olive: '#708238', Moss: '#8a9a5b', Sage: '#9caf88', Lime: '#9acd32', Green: '#2e8b57', Forest: '#1f5f3b',
  Emerald: '#1f9d6b', Mint: '#a8e6cf', Jade: '#00a86b', Teal: '#0f7c80', Turquoise: '#30c5c0', Aqua: '#7fdbda', Sky: '#87ceeb',
  Azure: '#2f8fdd', Blue: '#1f5fbf', Cobalt: '#0047ab', Navy: '#1b2a4a', Denim: '#3b5b8c', Periwinkle: '#9aa7e6', Indigo: '#3f3c9b',
  Violet: '#7a4fd6', Lavender: '#c7b8ea', Lilac: '#c8a2c8', Plum: '#6e3a6e', Purple: '#7b2d8e', Orchid: '#c67cde', Magenta: '#c2185b',
  Fuchsia: '#e0399f', Pink: '#f48fb1', Rose: '#e05a7a', Blush: '#f4c2c2', Berry: '#8e2453', Wine: '#6d1a36', Mauve: '#b784a7',
}
const NAME_ENTRIES = Object.entries(NAMES)
const nameOf = (hex) => NAME_ENTRIES.reduce((best, [n, h]) => (deltaE(hex, h) < best.d ? { n, d: deltaE(hex, h) } : best), { n: '', d: Infinity }).n

// ---------------------------------------------------------------------------------------
// Categories, computed from the source palette. A theme can belong to several.
const isWarm = (h) => h < 70 || h >= 330
const isCool = (h) => h >= 160 && h < 290
const isGreen = (h) => h >= 70 && h < 160
const isPink = (h) => h >= 300 || h < 15
const isEarth = ([h, s, l]) => h >= 10 && h < 110 && s >= 0.1 && s <= 0.6 && l >= 0.15 && l <= 0.7

function metrics(src) {
  const c = src.map(toHsl)
  const chromatic = c.filter(([, s, l]) => s >= 0.25 && l >= 0.12 && l <= 0.92)
  const hues = chromatic.map(([h]) => h)
  const avg = (i) => c.reduce((t, x) => t + x[i], 0) / c.length
  const buckets = new Set(hues.map((h) => Math.floor(h / 40)))
  let hueRange = 0
  for (const a of hues) for (const b of hues) hueRange = Math.max(hueRange, hueDist(a, b))
  const frac = (fn) => (hues.length ? hues.filter(fn).length / hues.length : 0)
  return {
    c,
    avgS: avg(1),
    avgL: avg(2),
    minL: Math.min(...c.map((x) => x[2])),
    chroma: chromatic.length,
    spread: buckets.size,
    hueRange,
    warm: frac(isWarm),
    cool: frac(isCool),
    green: frac(isGreen),
    pink: frac(isPink),
    earth: c.filter(isEarth).length,
    vivid: c.filter(([, s, l]) => s >= 0.6 && l >= 0.35 && l <= 0.75).length,
  }
}

export const CATEGORIES = [
  { id: 'bright', label: 'Bright', description: 'Saturated, high-energy colours', test: (m) => m.vivid >= 3 && m.avgL >= 0.4 && m.avgL <= 0.75 },
  { id: 'fun', label: 'Fun', description: 'Playful mixes of many hues', test: (m) => m.spread >= 4 && m.avgS >= 0.45 },
  { id: 'pastel', label: 'Pastel', description: 'Soft, light and airy', test: (m) => m.avgL >= 0.7 && m.minL >= 0.5 && m.avgS >= 0.2 },
  { id: 'earthy', label: 'Earth tones', description: 'Browns, clays, olives and sand', test: (m) => m.earth >= 2 && m.avgS <= 0.6 && m.cool < 0.5 },
  { id: 'summer', label: 'Summer', description: 'Sunny warm hues with a splash of sea', test: (m) => m.avgS >= 0.55 && m.avgL >= 0.5 && m.warm >= 0.4 && m.vivid >= 3 },
  { id: 'autumn', label: 'Autumn', description: 'Rust, mustard and deep warm shades', test: (m) => m.warm >= 0.7 && m.avgL <= 0.5 && m.avgS >= 0.3 && m.earth >= 1 && m.chroma >= 2 },
  { id: 'winter', label: 'Winter', description: 'Icy blues, cool greys and crisp whites', test: (m) => (m.cool >= 0.6 && m.chroma >= 2 && m.avgS <= 0.6) || (m.avgS <= 0.2 && m.avgL >= 0.5) },
  { id: 'spring', label: 'Spring', description: 'Fresh greens, blossoms and light yellows', test: (m) => m.avgL >= 0.55 && m.green > 0 && (m.pink > 0 || m.warm > 0) && m.avgS >= 0.3 },
  { id: 'ocean', label: 'Ocean', description: 'Blues, teals and aquas', test: (m) => m.cool >= 0.6 && m.chroma >= 2 },
  { id: 'warm', label: 'Warm', description: 'Reds, oranges and golds', test: (m) => m.warm >= 0.85 && m.chroma >= 3 },
  { id: 'nature', label: 'Nature', description: 'Leafy greens and botanicals', test: (m) => m.green >= 0.4 && m.chroma >= 2 },
  { id: 'muted', label: 'Moody', description: 'Dusty, low-saturation and dark', test: (m) => m.avgS <= 0.3 || m.avgL <= 0.35 },
  { id: 'mono', label: 'Monochrome', description: 'Shades of a single hue', test: (m) => m.chroma >= 3 && m.hueRange <= 30 },
]

// ---------------------------------------------------------------------------------------
// Palette → full theme.
function buildTheme(src) {
  const c = src.map((hex) => ({ hex, hsl: toHsl(hex) }))
  const score = ({ hsl: [, s, l] }) => s * (1 - Math.abs(l - 0.5) * 1.4)
  const ranked = [...c].sort((a, b) => score(b) - score(a))
  const primary = ranked[0]
  const alt = ranked.slice(1).find((x) => hueDist(x.hsl[0], primary.hsl[0]) >= 20 && x.hsl[1] >= 0.2) ?? ranked[1]
  const [H, S] = primary.hsl
  const [AH, AS] = alt.hsl

  // Data colours: the palette itself, then hue-rotated companions to reach eight.
  const data = [...ranked.map((x) => x.hex), hsl(H + 120, Math.max(S, 0.5), 0.45), hsl(H + 240, Math.max(S, 0.5), 0.45), hsl(AH + 180, Math.max(AS, 0.5), 0.45)]

  const tokens = {
    primary: primary.hex,
    'primary-dark': hsl(H, Math.min(S, 0.7), 0.25),
    'primary-alt': alt.hex,
    'on-primary': '#ffffff',
    background: hsl(H, Math.min(S, 0.5) * 0.4, 0.985),
    surface: '#ffffff',
    secondary: hsl(H, Math.min(S, 0.7) * 0.6, 0.92),
    'on-secondary': hsl(H, Math.min(S, 0.8), 0.28),
    accent: hsl(AH, Math.min(AS, 0.7) * 0.6, 0.93),
    'on-accent': hsl(AH, Math.min(AS, 0.8), 0.3),
    border: hsl(H, Math.min(S, 0.4) * 0.5, 0.9),
    shadow: hsl(H, 0.4, 0.1),
    ink: hsl(H, 0.15, 0.13),
    'ink-secondary': hsl(H, 0.1, 0.4),
    'ink-muted': hsl(H, 0.1, 0.42),
    ...STATUS,
    ...Object.fromEntries(data.slice(0, 8).map((hex, i) => [`data-${i + 1}`, hex])),
  }
  const full = { ...tokens, ...deriveAppTokens(tokens) }
  return { ...full, ...fixAll(full) }
}

// ---------------------------------------------------------------------------------------
const themes = []
const usedNames = new Map()
let failed = 0
let duplicates = 0

for (const src of SOURCE) {
  const tokens = buildTheme(src)
  if (checkTheme(tokens).length) {
    failed++
    continue
  }
  // Skip themes that look the same as one we already have.
  if (themes.some((t) => deltaE(t.tokens.primary, tokens.primary) < 6 && deltaE(t.tokens['primary-alt'], tokens['primary-alt']) < 6)) {
    duplicates++
    continue
  }
  const m = metrics(src)
  const tags = CATEGORIES.filter((cat) => cat.test(m)).map((cat) => cat.id)
  let name = `${nameOf(src.reduce((a, b) => (toHsl(b)[1] > toHsl(a)[1] ? b : a)))} & ${nameOf(tokens['primary-alt'])}`
  if (name.split(' & ')[0] === name.split(' & ')[1]) name = `${name.split(' & ')[0]} Shades`
  const n = (usedNames.get(name) ?? 0) + 1
  usedNames.set(name, n)
  themes.push({ id: `lib-${themes.length + 1}`, name: n > 1 ? `${name} ${n}` : name, tags: tags.length ? tags : ['eclectic'], src, tokens })
}

const categories = [
  ...CATEGORIES.map(({ id, label, description }) => ({ id, label, description })),
  { id: 'eclectic', label: 'Eclectic', description: 'Everything that defies a label' },
].map((cat) => ({ ...cat, count: themes.filter((t) => t.tags.includes(cat.id)).length }))

// Compact format: tokens as one string of 6-digit hexes in TOKEN_KEYS order.
const out = {
  v: 1,
  source: 'nice-color-palettes (MIT), top community palettes from ColourLovers.com',
  keys: TOKEN_KEYS,
  categories,
  themes: themes.map((t) => ({ id: t.id, name: t.name, tags: t.tags, t: TOKEN_KEYS.map((k) => t.tokens[k].slice(1)).join('') })),
}
writeFileSync(OUT, JSON.stringify(out))

const size = readFileSync(OUT).length
console.log(`${themes.length} themes (${failed} failed contrast, ${duplicates} duplicates skipped), ${(size / 1024).toFixed(0)} KB`)
for (const cat of categories) console.log(`  ${cat.label.padEnd(16)} ${cat.count}`)
