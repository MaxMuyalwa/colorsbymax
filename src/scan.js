// Site scanning: reads the colours actually painted on the page, works out what role each
// plays (page background, surfaces, text, brand colours) and builds themes around them.

import { contrastRatio, deltaE, hexToRgb, hslToRgb, lightness, rgbToHex, rgbToHsl, withLightness } from './color.js'
import { checkTheme, fixAll } from './contrast.js'
import { completeTokens } from './tokens.js'

/** Elements beyond this count are ignored so scanning stays fast on huge pages. */
export const MAX_SCANNED_ELEMENTS = 5000
/** Colours closer than this (CIE76 ΔE) are treated as the same colour. */
export const MERGE_DELTA_E = 6
/** Minimum HSL saturation for a colour to count as a brand/accent candidate. */
export const MIN_ACCENT_SATURATION = 0.25
/** How many closest library themes to suggest. */
export const LIBRARY_MATCHES = 4

// Colour functions and hex values inside computed gradients.
export const COLOR_IN_GRADIENT = /(?:rgba?|hsla?|oklab|oklch|lab|lch|color)\([^()]*\)|#[0-9a-f]{3,8}\b/gi

const hueDist = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
const hsl = (h, s, l) => rgbToHex(hslToRgb([((h % 360) + 360) % 360, Math.min(1, Math.max(0, s)), Math.min(1, Math.max(0, l))]))
const toHsl = (hex) => rgbToHsl(hexToRgb(hex))

/** Best guess at the site's name: og:site_name, then the first part of the title, then the host. */
export function detectSiteName(doc = document) {
  const og = doc.querySelector('meta[property="og:site_name"]')?.content?.trim()
  if (og) return og
  const title = doc.title?.split(/\s+[|–—-]\s+/)[0]?.trim()
  if (title) return title.length > 24 ? title.slice(0, 24).trim() + '…' : title
  return doc.location?.hostname?.replace(/^www\./, '') || 'This site'
}

// Converts any CSS colour string (rgb, oklab, color(srgb …), named…) to [hex, alpha] using a
// 1×1 canvas, which understands everything the browser does.
function createColorParser() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const cache = new Map()
  return (css) => {
    if (!css || css === 'transparent' || css === 'rgba(0, 0, 0, 0)') return null
    if (cache.has(css)) return cache.get(css)
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000'
    ctx.fillStyle = css
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    const out = a < 128 ? null : rgbToHex([r, g, b]) // ignore mostly-transparent colours
    cache.set(css, out)
    return out
  }
}

/**
 * Temporarily removes colorsbymax's inline token overrides, and its re-colouring stylesheet, so a
 * read sees the site's own colours. Everything happens synchronously, so nothing repaints in between.
 */
export function withoutAppliedTheme(fn) {
  // Sites that animate colour changes (transition-colors, transition-all) would otherwise
  // report mid-transition colours from the applied theme. Transitions are switched off only for
  // this synchronous read; animations are left alone so entrance effects don't replay.
  const freeze = document.createElement('style')
  freeze.textContent = '*,*::before,*::after{transition:none!important}'
  document.head.appendChild(freeze)

  const recolour = document.querySelector('style[data-colorsbymax="recolour"]')
  if (recolour) recolour.disabled = true

  const style = document.documentElement.style
  const saved = []
  for (let i = style.length - 1; i >= 0; i--) {
    const prop = style[i]
    if (prop.startsWith('--color-')) {
      saved.push([prop, style.getPropertyValue(prop)])
      style.removeProperty(prop)
    }
  }
  try {
    return fn()
  } finally {
    for (const [prop, value] of saved) style.setProperty(prop, value)
    if (recolour) recolour.disabled = false
    // Apply the restored colours while transitions are still off, so nothing animates back.
    void getComputedStyle(document.documentElement).color
    void document.body.offsetHeight
    freeze.remove()
  }
}

/**
 * Collects the page's painted colours with how much each is used as a background (by area),
 * as text (by length × font size²) and as a border.
 * @param {{ exclude?: string }} [options]  selector for UI to skip, e.g. the switcher itself
 */
export function collectColors({ exclude = 'colorsbymax-root, .theme-switcher' } = {}) {
  return withoutAppliedTheme(() => {
    const parse = createColorParser()
    /** @type {Map<string, { hex: string, bg: number, text: number, border: number }>} */
    const tally = new Map()
    const add = (hex, kind, weight) => {
      if (!hex || !(weight > 0)) return
      const entry = tally.get(hex) ?? { hex, bg: 0, text: 0, border: 0 }
      entry[kind] += weight
      tally.set(hex, entry)
    }

    // The canvas behind everything: body, then html, then white.
    const pageArea = document.documentElement.scrollWidth * document.documentElement.scrollHeight
    const pageBg = parse(getComputedStyle(document.body).backgroundColor) ?? parse(getComputedStyle(document.documentElement).backgroundColor) ?? '#ffffff'
    add(pageBg, 'bg', pageArea)

    const elements = [...document.body.querySelectorAll('*')].slice(0, MAX_SCANNED_ELEMENTS)
    for (const el of elements) {
      if (exclude && el.closest(exclude)) continue
      if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
      const rect = el.getBoundingClientRect()
      const area = rect.width * rect.height
      if (!area) continue
      const cs = getComputedStyle(el)

      add(parse(cs.backgroundColor), 'bg', area)

      let chars = 0
      for (const node of el.childNodes) if (node.nodeType === 3) chars += node.textContent.trim().length
      const textWeight = chars * parseFloat(cs.fontSize) ** 2
      // Gradient text (background-clip: text) is painted by the background, not `color`.
      const gradientText = cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text'
      if (chars && !gradientText) add(parse(cs.color), 'text', textWeight)

      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        const stops = cs.backgroundImage.match(COLOR_IN_GRADIENT) ?? []
        for (const stop of stops) {
          if (gradientText) add(parse(stop), 'text', (textWeight || area) / stops.length)
          else add(parse(stop), 'bg', area / stops.length)
        }
      }

      if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') add(parse(cs.borderTopColor), 'border', rect.width + rect.height)
      if (el instanceof SVGElement) {
        add(parse(cs.fill), 'text', area / 4)
        add(parse(cs.stroke), 'text', area / 8)
      }
    }
    return mergeSimilar([...tally.values()])
  })
}

// Folds near-identical colours together (anti-aliasing, tiny tint differences).
function mergeSimilar(entries) {
  const sorted = entries.sort((a, b) => b.bg + b.text * 50 + b.border - (a.bg + a.text * 50 + a.border))
  const out = []
  for (const e of sorted) {
    const into = out.find((o) => deltaE(o.hex, e.hex) < MERGE_DELTA_E)
    if (into) {
      into.bg += e.bg
      into.text += e.text
      into.border += e.border
    } else out.push({ ...e })
  }
  return out
}

/**
 * Works out token roles from collected colours.
 * @returns {{ roles: Record<string, string>, palette: string[] }}
 */
export function inferRoles(colors) {
  const total = (k) => colors.reduce((t, c) => t + c[k], 0) || 1
  const [BG, TEXT, BORDER] = [total('bg'), total('text'), total('border')]
  const byBg = [...colors].filter((c) => c.bg > 0).sort((a, b) => b.bg - a.bg)
  const byText = [...colors].filter((c) => c.text > 0).sort((a, b) => b.text - a.text)

  const background = byBg[0]?.hex ?? '#ffffff'
  const surface =
    byBg.find((c) => c.hex !== background && deltaE(c.hex, background) > 2 && lightness(c.hex) >= Math.min(0.9, lightness(background)))?.hex ??
    (lightness(background) > 0.97 ? background : '#ffffff')

  const readable = (c, min) => contrastRatio(c.hex, background) >= min
  const ink = (byText.find((c) => readable(c, 4.5)) ?? byText[0])?.hex ?? '#1f2937'
  const inkSecondary = byText.find((c) => c.hex !== ink && deltaE(c.hex, ink) > 8 && readable(c, 3))?.hex

  // Brand candidates: saturated colours, scored by how much of the page they occupy. The text
  // colour isn't one, even when it's a warm or tinted dark (it would outscore the real brand).
  const accents = colors
    .filter((c) => c.hex !== ink && c.hex !== inkSecondary)
    .map((c) => {
      const [h, s, l] = toHsl(c.hex)
      const share = c.bg / BG + c.text / TEXT + (c.border / BORDER) * 0.5
      return { hex: c.hex, h, s, l, score: share * s * (1 - Math.abs(l - 0.5)) }
    })
    .filter((c) => c.s >= MIN_ACCENT_SATURATION && c.l >= 0.15 && c.l <= 0.85)
    .sort((a, b) => b.score - a.score)

  const primary = accents[0]?.hex
  const alt = accents.slice(1).find((c) => hueDist(c.h, accents[0].h) >= 20)?.hex
  const tint = byBg.find((c) => {
    const [, s, l] = toHsl(c.hex)
    return l >= 0.82 && s >= 0.1 && c.hex !== background && c.hex !== surface
  })?.hex

  const roles = { background, surface, ink }
  if (inkSecondary) roles['ink-secondary'] = inkSecondary
  if (primary) roles.primary = primary
  if (alt) roles['primary-alt'] = alt
  if (tint) roles.secondary = tint
  accents.slice(0, 8).forEach((c, i) => (roles[`data-${i + 1}`] = c.hex))

  const palette = [background, surface, ink, ...(inkSecondary ? [inkSecondary] : []), ...accents.slice(0, 6).map((c) => c.hex)]
  return { roles, palette: [...new Set(palette)] }
}

/**
 * Builds a complete theme from detected roles, deriving whatever wasn't found.
 * @param {Record<string, string>} roles
 * @param {{ softness?: number, boldness?: number, complementary?: boolean }} [variant]
 */
export function themeFromRoles(roles, { softness = 0, boldness = 0, complementary = false } = {}) {
  const primary = roles.primary ?? '#334155'
  const [H, S] = toHsl(primary)
  const alt = complementary ? hsl(H + 180, Math.max(S, 0.45), 0.5) : (roles['primary-alt'] ?? hsl(H + 30, Math.max(S, 0.4), 0.55))
  const [AH, AS] = toHsl(alt)
  const ink = roles.ink ?? hsl(H, 0.15, 0.13)

  let background = roles.background ?? hsl(H, Math.min(S, 0.5) * 0.4, 0.985)
  if (softness) background = hsl(H, Math.min(S, 0.6) * 0.5, 0.97)
  if (boldness) background = '#ffffff'
  const secondary = roles.secondary && !softness && !boldness ? roles.secondary : hsl(H, Math.min(S, 0.7) * (0.6 + boldness * 0.3), 0.92 - boldness * 0.05)

  const data = Array.from({ length: 8 }, (_, i) => roles[`data-${i + 1}`] ?? hsl(H + 45 * (i + 1), Math.max(S, 0.5), 0.45))
  return completeTokens({
    primary,
    'primary-dark': hsl(H, Math.min(S, 0.7), 0.25),
    'primary-alt': alt,
    'on-primary': '#ffffff',
    background,
    surface: boldness ? '#ffffff' : (roles.surface ?? '#ffffff'),
    secondary,
    'on-secondary': hsl(H, Math.min(S, 0.8), 0.28),
    accent: hsl(AH, Math.min(AS, 0.7) * 0.6, 0.93),
    'on-accent': hsl(AH, Math.min(AS, 0.8), 0.3),
    border: hsl(H, Math.min(S, 0.4) * 0.5, 0.9),
    shadow: hsl(H, 0.4, 0.1),
    ink,
    'ink-secondary': roles['ink-secondary'] ?? withLightness(ink, Math.min(0.45, lightness(ink) + 0.3)),
    'ink-muted': roles['ink-secondary'] ?? withLightness(ink, Math.min(0.45, lightness(ink) + 0.32)),
    success: '#15803d',
    warning: '#b45309',
    danger: '#b91c1c',
    info: '#1d4ed8',
    ...Object.fromEntries(data.map((hex, i) => [`data-${i + 1}`, hex])),
  })
}

const passing = (tokens) => ({ ...tokens, ...fixAll(tokens) })

/**
 * Suggested themes for a scanned site, all named after it. "Scanned" keeps the colours as
 * found; every other suggestion passes contrast.
 * @param {{ roles: Record<string, string> }} scan
 * @param {string} siteName
 * @param {import('./tokens.js').Theme[]} [library]  generated library, for closest matches
 */
export function suggestThemes(scan, siteName, library = []) {
  const stamp = Date.now().toString(36)
  const make = (key, name, tokens) => ({ id: `scan-${stamp}-${key}`, name: `${siteName} ${name}`, site: true, scanned: true, tokens })

  const found = themeFromRoles(scan.roles)
  const themes = [make('found', 'Scanned', found)]
  if (checkTheme(found).length) themes.push(make('accessible', 'Accessible', passing(found)))
  themes.push(
    make('soft', 'Soft', passing(themeFromRoles(scan.roles, { softness: 1 }))),
    make('bold', 'Bold', passing(themeFromRoles(scan.roles, { boldness: 1 }))),
    make('complement', 'Complementary', passing(themeFromRoles(scan.roles, { complementary: true }))),
  )

  // Closest library themes by primary and partner colour.
  const matches = [...library]
    // The primary dominates; the partner colour only breaks near-ties.
    .map((t) => ({ t, d: deltaE(t.tokens.primary, found.primary) + 0.25 * deltaE(t.tokens['primary-alt'], found['primary-alt']) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, LIBRARY_MATCHES)
    .map(({ t }, i) => ({ id: `scan-${stamp}-match-${i}`, name: t.name, site: true, scanned: true, match: true, tokens: t.tokens }))

  return [...themes, ...matches]
}
