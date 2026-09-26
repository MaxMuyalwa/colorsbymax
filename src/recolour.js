// Automatic re-colouring for sites that don't paint with colorsbymax's --color-* variables.
//
// On start it reads the colours actually painted on the page: every element's background,
// text, borders, gradients and SVG fills. It learns which of them are the site's background,
// text and brand colours (the same analysis as the site scan), tags each element with the
// colours it uses, and keeps one stylesheet of overrides. Applying a theme rewrites only that
// stylesheet: every original colour is swapped for its counterpart in the theme. Greys slide
// between the theme's background and text; brand colours take the nearest brand colour of the
// theme, keeping their relative lightness. Text and icons are then checked against what they sit
// on, but only to undo harm the swap did: a pair is left alone if it reads as well as the site's
// original did, and a fix keeps the design's intent (light on dark stays light on dark) using the
// nearest theme colour that works. New or changed content is tagged as it appears.

import { contrastRatio, deltaE, hexToRgb, hslToRgb, luminance, mix, rgbToHex, rgbToHsl } from './color.js'
import { collectColors, COLOR_IN_GRADIENT, inferRoles, themeFromRoles, withoutAppliedTheme } from './scan.js'
import { markZones, ROLE, rolesOf, vividCss, ZONE } from './vivid.js'

const ATTR = 'data-cbm'
/** Elements the engine never touches: the switcher itself. */
const SKIP = 'colorsbymax-root'

/**
 * How colorsbymax finds a site's logo, to keep it in its own colours: an explicit
 * data-colorsbymax-logo, "logo" in a class, id or label (but not "logout"), or common brand classes.
 */
export const LOGO_SELECTOR = [
  '[data-colorsbymax-logo]',
  '[class~="logo" i]', '[class*="logo-" i]:not([class*="logout" i])', '[class*="-logo" i]', '[class*="_logo" i]', '[class*="Logo"]:not([class*="Logout"])',
  '[id*="logo" i]:not([id*="logout" i])',
  '[aria-label*="logo" i]',
  '.brand', '.navbar-brand', '.site-title', '.site-brand',
].join(', ')
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
/**
 * Contrast a swapped pair aims for (WCAG AA): 4.5:1 for text, 3:1 for icons. Never more than the
 * site's own original pair had, so deliberately soft text and icons stay soft.
 */
const MIN_TEXT_CONTRAST = 4.5
const MIN_ICON_CONTRAST = 3
/** Painted colours that sit on a background, so are checked against it. */
const FOREGROUND = new Set(['color', 'fill', 'stroke'])
/** Whether a background-image has any colours in it (gradients), rather than just images. */
const HAS_COLOUR = new RegExp(COLOR_IN_GRADIENT.source, 'i')

const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n))
/** Whether an element has text of its own, rather than only icons or child elements. */
const hasOwnText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
/**
 * Whether a background image covers the element, so it counts as what's behind the element's
 * content. Decorative strips (e.g. an animated underline sized "0% 2px") don't.
 */
const fillsElement = (cs) =>
  Boolean(cs.backgroundImage && cs.backgroundImage !== 'none') &&
  cs.backgroundSize.split(',').some((size) => /^(auto|cover|contain|100% 100%|auto auto|100%)$/.test(size.trim()))
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
export function createRecolourer({ colourful = false } = {}) {
  const parse = createParser()
  const sheet = document.createElement('style')
  sheet.dataset.colorsbymax = 'recolour'
  document.head.append(sheet)
  // The Colourful style (vivid.js): the page's parts painted by role, on top of the swaps. Its
  // own sheet, after the swaps, so its rules win where both colour an element.
  const vividSheet = document.createElement('style')
  vividSheet.dataset.colorsbymax = 'vivid'
  document.head.append(vividSheet)
  let vivid = colourful

  // The site's colours as a full token set, from the same analysis the site scan uses.
  const { roles } = inferRoles(collectColors())
  const site = themeFromRoles(roles)
  // A plain site (greys only, no brand colour of its own) would barely change with a theme. There,
  // grey icons and plain text links take the theme's brand colour, as a designer would colour them.
  const plain = !roles.primary
  const siteBgL = hslOf(site.background)[2]
  const siteInkL = hslOf(site.ink)[2]

  /** Each distinct painted value, keyed "prop|value", plus the background under text and icons. */
  const entries = new Map()
  let theme = null

  const idFor = (prop, value, kind, backdrop = null, role = null, accent = false) => {
    const key = `${prop}|${value}|${backdrop ?? ''}|${role ?? ''}|${accent ? 'a' : ''}`
    let entry = entries.get(key)
    if (!entry) {
      entry = { id: `c${entries.size.toString(36)}`, prop, value, kind, backdrop, role, accent }
      entries.set(key, entry)
      // Added once the read is over: changing the sheet's text mid-read would build a fresh sheet,
      // which starts enabled, so later reads would see themed colours as the site's own.
      if (theme) pendingRules += rule(entry)
    }
    return entry.id
  }

  // The (original) background colour showing behind an element: its own if it paints one, else
  // its nearest ancestor's. Cached per tagging pass, since parents are read before children.
  let backdrops = new WeakMap()
  const backdropOf = (el) => {
    if (!el || el.nodeType !== 1) return 'rgb(255, 255, 255)'
    if (backdrops.has(el)) return backdrops.get(el)
    const cs = getComputedStyle(el)
    const own = parse(cs.backgroundColor)
    let value
    if (own && own.alpha >= 0.5) value = cs.backgroundColor
    else if (fillsElement(cs) && HAS_COLOUR.test(cs.backgroundImage)) {
      value = cs.backgroundImage.match(HAS_COLOUR)[0] // a gradient behind it: judge by its first colour
    } else value = el === document.documentElement ? 'rgb(255, 255, 255)' : backdropOf(el.parentElement)
    backdrops.set(el, value)
    return value
  }

  // The painted colours of one element, as entry ids. Foreground colours note what they sit on,
  // and whether they draw text or only icons (an icon-only button's colour is an icon's).
  const read = (el) => {
    const cs = getComputedStyle(el)
    const ids = []
    const role = el instanceof SVGElement || !hasOwnText(el) ? 'icon' : 'text'
    // On a plain site: icons, and text links, that don't sit on a fill of their own (so not buttons).
    const ownFill = (parse(cs.backgroundColor)?.alpha ?? 0) >= 0.5
    const accent = plain && !ownFill && (role === 'icon' || el.localName === 'a')
    const colour = (prop, css, kind) => {
      if (!parse(css)) return
      ids.push(FOREGROUND.has(prop) ? idFor(prop, css, kind, backdropOf(el), prop === 'color' ? role : 'icon', accent) : idFor(prop, css, kind))
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
  let pendingRules = ''
  const tag = (roots, deep) => {
    backdrops = new WeakMap()
    withoutAppliedTheme(() => {
      for (const root of roots) {
        if (!(root instanceof Element) || root.closest(skip)) continue
        const all = deep ? [root, ...root.querySelectorAll('*')] : [root]
        for (const el of all) {
          if (el.localName === SKIP) continue
          if (el.closest(skip)) {
            el.removeAttribute(ATTR)
            el.removeAttribute(ROLE)
            continue
          }
          const ids = read(el)
          if (ids.length) el.setAttribute(ATTR, ids.join(' '))
          else el.removeAttribute(ATTR)
          // The part it plays, for the Colourful style, from its original look.
          const cs = getComputedStyle(el)
          const own = parse(cs.backgroundColor)
          const under = parse(backdropOf(el.parentElement))?.hex ?? '#ffffff'
          const roles = rolesOf(el, cs, own && own.alpha >= 0.5 ? own.hex : null, under)
          if (roles.length) el.setAttribute(ROLE, roles.join(' '))
          else el.removeAttribute(ROLE)
        }
      }
    })
    if (pendingRules) {
      sheet.textContent += pendingRules
      pendingRules = ''
    }
  }

  // Swaps one site colour for the theme's counterpart: { hex, alpha }, or null if it isn't a colour.
  const mapHex = (css, kind) => {
    const c = parse(css)
    if (!c) return null
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
    return { hex, alpha: c.alpha }
  }

  const format = ({ hex, alpha }) => {
    if (alpha >= 1) return hex
    const [r, g, b] = hexToRgb(hex)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  const mapColour = (css, kind) => {
    const mapped = mapHex(css, kind)
    return mapped ? format(mapped) : css
  }

  // A swapped text or icon colour that reads on its swapped background. It changes only if the
  // swap made the pair harder to read than the original (up to the WCAG target), and then keeps
  // the design's polarity: light on dark stays light, using the nearest theme colour that works.
  // It flips only when nothing on the same side can reach 3:1.
  const readable = (fg, bg, target, lighter) => {
    const ratio = (c) => contrastRatio(c, bg)
    if (ratio(fg) >= target - 0.05) return fg
    const pool = [fg, theme.background, theme.surface, theme.ink, theme['on-primary'], theme['on-secondary'], '#ffffff', '#000000']
    const sameSide = pool.filter((c) => luminance(c) > luminance(bg) === lighter)
    const nearest = (list) => list.reduce((a, c) => (deltaE(c, fg) < deltaE(a, fg) ? c : a))
    const strongest = (list) => list.reduce((a, c) => (ratio(c) > ratio(a) ? c : a))
    const passing = sameSide.filter((c) => ratio(c) >= target)
    if (passing.length) return nearest(passing)
    if (sameSide.length && ratio(strongest(sameSide)) >= Math.min(target, MIN_ICON_CONTRAST)) return strongest(sameSide)
    const flipped = pool.filter((c) => ratio(c) >= target)
    return flipped.length ? nearest(flipped) : strongest(pool)
  }

  const rule = (entry) => {
    let value
    if (entry.prop === 'background-image') {
      value = entry.value.replace(COLOR_IN_GRADIENT, (stop) => mapColour(stop, entry.kind))
    } else if (entry.backdrop) {
      // A grey icon or link on a plain site becomes the theme's brand colour.
      const own = parse(entry.value)
      const brand = entry.accent && own && hslOf(own.hex)[1] < NEUTRAL_SATURATION
      const fg = brand ? { hex: theme.primary, alpha: own.alpha } : mapHex(entry.value, entry.kind)
      const bg = mapHex(entry.backdrop, 'bg')
      const original = { fg: parse(entry.value)?.hex, bg: parse(entry.backdrop)?.hex }
      if (fg && bg && original.fg && original.bg) {
        const aim = entry.role === 'text' ? MIN_TEXT_CONTRAST : MIN_ICON_CONTRAST
        // A newly coloured icon or link must read; otherwise never aim above the site's own pair.
        const target = brand ? aim : Math.min(aim, contrastRatio(original.fg, original.bg))
        const lighter = luminance(original.fg) > luminance(original.bg)
        value = format({ ...fg, hex: readable(fg.hex, bg.hex, target, lighter) })
      } else value = mapColour(entry.value, entry.kind)
    } else value = mapColour(entry.value, entry.kind)
    return `[${ATTR}~="${entry.id}"]{${entry.prop}:${value}!important}`
  }

  // What tagging skips: the switcher, and the logo unless it's being coloured too.
  let skip = `${SKIP}, ${LOGO_SELECTOR}`

  withoutAppliedTheme(markZones)
  tag([document.body], true)

  // Logos keep their own colours, unless they're plain black or grey text: those would vanish on a
  // dark theme, so they follow the theme's text colour instead, still their darkest-or-lightest self.
  const LOGO_ATTR = 'data-cbm-logo'
  const logos = withoutAppliedTheme(() =>
    [...document.querySelectorAll(LOGO_SELECTOR)]
      .filter((el) => !el.parentElement?.closest(LOGO_SELECTOR) && !el.closest(SKIP))
      .map((el) => ({ el, color: getComputedStyle(el).color })),
  )
  const logoRules = () => {
    if (!theme || !skip.includes(LOGO_SELECTOR)) return ''
    return logos
      .map(({ el, color }, i) => {
        const own = parse(color)
        if (!own || hslOf(own.hex)[1] >= NEUTRAL_SATURATION || !el.isConnected) return ''
        el.setAttribute(LOGO_ATTR, i)
        return `[${LOGO_ATTR}="${i}"]{color:${mapColour(color, 'text')}!important}`
      })
      .join('')
  }

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
    // Deep: an element changing class (a nav item becoming active) changes what its children sit on.
    if (changed.size) tag([...changed], true)
  })
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] })

  return {
    site,
    /** Shows `tokens` in place of the site's colours; null brings back the original look. */
    apply(tokens) {
      theme = tokens
      sheet.textContent = tokens ? [...entries.values()].map(rule).join('') + logoRules() : ''
      vividSheet.textContent = tokens && vivid ? vividCss(tokens) : ''
    },
    /** Colourful (true) paints the page's parts by role; Subtle (false) only swaps its colours. */
    setColourful(on) {
      vivid = on
      vividSheet.textContent = theme && vivid ? vividCss(theme) : ''
    },
    /** Whether the logo is re-coloured with the rest (off keeps it in its own colours). */
    setLogoColouring(on) {
      const next = on ? SKIP : `${SKIP}, ${LOGO_SELECTOR}`
      if (next === skip) return
      skip = next
      tag([document.body], true)
      if (theme) sheet.textContent = [...entries.values()].map(rule).join('') + logoRules()
    },
    stop() {
      observer.disconnect()
      sheet.remove()
      vividSheet.remove()
      for (const el of document.querySelectorAll(`[${ATTR}], [${ROLE}], [${ZONE}], [${LOGO_ATTR}]`)) {
        el.removeAttribute(LOGO_ATTR)
        el.removeAttribute(ATTR)
        el.removeAttribute(ROLE)
        el.removeAttribute(ZONE)
      }
    },
  }
}
