// Automatic re-colouring for sites that don't paint with colorsbymax's --color-* variables.
//
// On start it reads the colours actually painted on the page: every element's background,
// text, borders, gradients and SVG fills. It learns which of them are the site's background,
// text and brand colours (the same analysis as the site scan), tags each element with the
// colours it uses, and keeps one stylesheet of overrides. Applying a theme rewrites only that
// stylesheet: every original colour is swapped for its counterpart in the theme. Greys slide
// between the theme's background and text; brand colours take the nearest brand colour of the
// theme, keeping their relative lightness. New or changed content is tagged as it appears.

import { deltaE, hexToRgb, hslToRgb, mix, rgbToHex, rgbToHsl } from './color.js'
import { collectColors, COLOR_IN_GRADIENT, inferRoles, themeFromRoles, withoutAppliedTheme } from './scan.js'

const ATTR = 'data-cbm'
/** Elements the engine never touches: the switcher itself. */
const SKIP = 'colorsbymax-root'
/** Below this HSL saturation a colour counts as a grey and follows the background→text scale. */
const NEUTRAL_SATURATION = 0.12
/** Colours within this many degrees of a brand hue are shades of it and follow the theme's version. */
const FAMILY_HUE = 35
/** Colours within this many degrees of a status hue (and not brand) keep that meaning. */
const STATUS = ['success', 'warning', 'danger', 'info']
const STATUS_HUE = 25
/** Everything else coloured (categories, illustrations) maps to the nearest of these. */
const CATEGORIES = [...STATUS, 'data-1', 'data-2', 'data-3', 'data-4', 'data-5', 'data-6', 'data-7', 'data-8']
const SIDES = ['top', 'right', 'bottom', 'left']
/** Whether a background-image has any colours in it (gradients), rather than just images. */
const HAS_COLOUR = new RegExp(COLOR_IN_GRADIENT.source, 'i')

const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n))
const hueDist = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
/** How far hue `a` is from `b`, signed, in -180..180. */
const signedHue = (a, b) => ((a - b + 540) % 360) - 180
const hslOf = (hex) => rgbToHsl(hexToRgb(hex))

/** True when the site defines colorsbymax's variables itself, so no re-colouring is needed. */
export function usesColourTokens() {
  return withoutAppliedTheme(() => getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() !== '')
}

// Any CSS colour → { hex, alpha }, via a 1×1 canvas that understands everything the browser does.
function createParser() {
  const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true })
  const cache = new Map()
  return (css) => {
    if (!css || css === 'none' || css === 'transparent') return null
    if (cache.has(css)) return cache.get(css)
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000'
    ctx.fillStyle = css
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    const out = a === 0 ? null : { hex: rgbToHex([r, g, b]), alpha: Math.round((a / 255) * 100) / 100 }
    cache.set(css, out)
    return out
  }
}

/**
 * Starts re-colouring the page. Returns the site's own colours as tokens (`site`), `apply(tokens)`
 * to show a theme (null restores the original look) and `stop()`.
 */
export function createRecolourer() {
  const parse = createParser()
  const sheet = document.createElement('style')
  sheet.dataset.colorsbymax = 'recolour'
  document.head.append(sheet)

  // The site's colours as a full token set, from the same analysis the site scan uses.
  const site = themeFromRoles(inferRoles(collectColors()).roles)
  const siteBgL = hslOf(site.background)[2]
  const siteInkL = hslOf(site.ink)[2]

  /** Each distinct painted value, keyed "prop|value". */
  const entries = new Map()
  let theme = null

  const idFor = (prop, value, kind) => {
    const key = `${prop}|${value}`
    let entry = entries.get(key)
    if (!entry) {
      entry = { id: `c${entries.size.toString(36)}`, prop, value, kind }
      entries.set(key, entry)
      if (theme) sheet.textContent += rule(entry)
    }
    return entry.id
  }

  // The painted colours of one element, as entry ids.
  const read = (el) => {
    const cs = getComputedStyle(el)
    const ids = []
    const colour = (prop, css, kind) => {
      if (parse(css)) ids.push(idFor(prop, css, kind))
    }
    colour('background-color', cs.backgroundColor, 'bg')
    colour('color', cs.color, 'text')
    const image = cs.backgroundImage
    if (image && image !== 'none' && HAS_COLOUR.test(image)) {
      const clipText = cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text'
      ids.push(idFor('background-image', image, clipText ? 'text' : 'bg'))
    }
    for (const side of SIDES) {
      if (parseFloat(cs.getPropertyValue(`border-${side}-width`)) > 0 && cs.getPropertyValue(`border-${side}-style`) !== 'none') {
        colour(`border-${side}-color`, cs.getPropertyValue(`border-${side}-color`), 'border')
      }
    }
    if (el instanceof SVGElement) {
      colour('fill', cs.fill, 'text')
      colour('stroke', cs.stroke, 'text')
    }
    return ids
  }

  /** Tags `elements` (and optionally their descendants) with the colours they paint. */
  const tag = (roots, deep) => {
    withoutAppliedTheme(() => {
      for (const root of roots) {
        if (!(root instanceof Element) || root.closest(SKIP)) continue
        const all = deep ? [root, ...root.querySelectorAll('*')] : [root]
        for (const el of all) {
          if (el.localName === SKIP) continue
          const ids = read(el)
          if (ids.length) el.setAttribute(ATTR, ids.join(' '))
          else el.removeAttribute(ATTR)
        }
      }
    })
  }

  // Swaps one site colour for the theme's counterpart, keeping its alpha.
  const mapColour = (css, kind) => {
    const c = parse(css)
    if (!c) return css
    const [, s, l] = hslOf(c.hex)
    let hex
    if (s < NEUTRAL_SATURATION) {
      // Greys: where the colour sits between the site's background (0) and text (1).
      const span = siteInkL - siteBgL
      const t = Math.abs(span) < 0.05 ? (l > 0.5 ? 0 : 1) : clamp((l - siteBgL) / span)
      hex = mix(theme.ink, theme.background, t)
    } else {
      // Coloured. Shades of the site's brand hues (tints, darker text, gradient partners) follow
      // the theme's brand colour; other colours (status, categories) the nearest of the rest.
      const hue = hslOf(c.hex)[0]
      const near = (token, within) => hueDist(hue, hslOf(site[token])[0]) <= within
      // In order: the site's brand family, then status colours (a success green stays the
      // theme's success colour), then the second brand colour's family.
      let anchor = near('primary', FAMILY_HUE) ? 'primary' : null
      if (!anchor && s >= 0.25) {
        const status = STATUS.filter((token) => near(token, STATUS_HUE))
        anchor = status.sort((a, b) => hueDist(hue, hslOf(site[a])[0]) - hueDist(hue, hslOf(site[b])[0]))[0] ?? null
      }
      if (!anchor && near('primary-alt', FAMILY_HUE)) anchor = 'primary-alt'
      if (!anchor) {
        let bestD = Infinity
        for (const token of CATEGORIES) {
          const d = deltaE(c.hex, site[token])
          if (d < bestD) [anchor, bestD] = [token, d]
        }
      }
      const [sh, ss, sl] = hslOf(site[anchor])
      const [th, ts, tl] = hslOf(theme[anchor])
      // Lightness is placed relative to the page. Between the background and the anchor colour it
      // keeps its position (a pale tint stays near the background, so in dark themes it becomes a
      // dark tint); past the anchor it moves the same share of the way towards the text colour.
      const themeBgL = hslOf(theme.background)[2]
      const themeInkL = hslOf(theme.ink)[2]
      const toBg = sl - siteBgL
      const toInk = siteInkL - sl
      const u = Math.abs(toBg) < 0.05 ? null : (l - siteBgL) / toBg
      let lightness
      if (u === null) lightness = tl + (l - sl)
      else if (u <= 1) lightness = themeBgL + clamp(u, -0.5, 1) * (tl - themeBgL)
      else lightness = tl + (Math.abs(toInk) < 0.05 ? 0 : clamp((l - sl) / toInk)) * (themeInkL - tl)
      const saturation = ts * (s / Math.max(ss, 0.05))
      hex = rgbToHex(hslToRgb([(th + signedHue(hue, sh) + 360) % 360, clamp(saturation), clamp(lightness)]))
    }
    if (c.alpha >= 1) return hex
    const [r, g, b] = hexToRgb(hex)
    return `rgba(${r}, ${g}, ${b}, ${c.alpha})`
  }

  const rule = (entry) => {
    const value =
      entry.prop === 'background-image'
        ? entry.value.replace(COLOR_IN_GRADIENT, (stop) => mapColour(stop, entry.kind))
        : mapColour(entry.value, entry.kind)
    return `[${ATTR}~="${entry.id}"]{${entry.prop}:${value}!important}`
  }

  tag([document.body], true)

  // New content, and elements whose class or style changes, get (re)tagged as it happens.
  // Callbacks run before the next paint, so new content never shows in its old colours.
  const observer = new MutationObserver((records) => {
    const added = []
    const changed = new Set()
    for (const r of records) {
      if (r.type === 'childList') for (const n of r.addedNodes) if (n.nodeType === 1) added.push(n)
      if (r.type === 'attributes') changed.add(r.target)
    }
    if (added.length) tag(added, true)
    if (changed.size) tag([...changed], false)
  })
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] })

  return {
    site,
    /** Shows `tokens` in place of the site's colours; null brings back the original look. */
    apply(tokens) {
      theme = tokens
      sheet.textContent = tokens ? [...entries.values()].map(rule).join('') : ''
    },
    stop() {
      observer.disconnect()
      sheet.remove()
      for (const el of document.querySelectorAll(`[${ATTR}]`)) el.removeAttribute(ATTR)
    },
  }
}
