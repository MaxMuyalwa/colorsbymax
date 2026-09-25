// Page audit: looks at the page as it's painted right now (with the chosen theme) and points out
// what won't look right: a logo that disappears against its background, pictures whose solid
// background shows as a box, and text or icons too faint to read. The switcher pins each finding
// to its element on the page.

import { contrastRatio, luminance, rgbToHex } from './color.js'
import { LOGO_SELECTOR } from './recolour.js'

/** Most findings pinned to the page at once; the rest are counted. */
export const MAX_PINNED = 8
/** Elements read, at most, so audits stay quick on huge pages. */
const MAX_ELEMENTS = 3000
const SKIP = 'colorsbymax-root'

const parser = () => {
  const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true })
  return (css) => {
    if (!css || css === 'none' || css === 'transparent') return null
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000'
    ctx.fillStyle = css
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return a < 128 ? null : rgbToHex([r, g, b])
  }
}

const visible = (el) => {
  if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false
  const r = el.getBoundingClientRect()
  return r.width > 2 && r.height > 2
}
const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
const describe = (el) => (el.getAttribute('aria-label') || el.alt || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)
const fmt = (r) => `${(Math.floor(r * 10) / 10).toFixed(1)}:1`

/**
 * Samples an image's corners and middle (for a solid background and an overall colour). Returns
 * null when the browser won't allow reading it (a cross-origin image without CORS).
 */
function sampleImage(img) {
  try {
    const w = 24
    const h = Math.max(1, Math.round((img.naturalHeight / Math.max(1, img.naturalWidth)) * w))
    const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h })
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, w, h)
    const data = ctx.getImageData(0, 0, w, h).data
    const at = (x, y) => {
      const i = (y * w + x) * 4
      return data[i + 3] < 200 ? null : rgbToHex([data[i], data[i + 1], data[i + 2]])
    }
    const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)]
    // The image's "ink": its average non-transparent colour, for how it reads on a background.
    let r = 0, g = 0, b = 0, n = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue
      r += data[i]
      g += data[i + 1]
      b += data[i + 2]
      n++
    }
    return { corners, average: n ? rgbToHex([r / n, g / n, b / n].map(Math.round)) : null, transparent: n < (data.length / 4) * 0.9 }
  } catch {
    return null
  }
}

/**
 * Audits the page as painted now.
 * @param {{ logoColouring: boolean }} options
 * @returns {{ id: string, el: Element, title: string, message: string, action?: 'colour-logo' | 'invert' }[]}
 */
export function runAudit({ logoColouring }) {
  const parse = parser()
  const findings = []
  const flagged = new Set()
  const add = (el, finding) => {
    for (let n = el; n; n = n.parentElement) if (flagged.has(n)) return // one finding per area
    flagged.add(el)
    findings.push({ id: `${finding.kind}-${findings.length}`, el, ...finding })
  }

  // The colour showing behind an element: its nearest painted background. `null` when a picture
  // is behind it, since its colours can't be judged.
  const cache = new WeakMap()
  const behind = (el) => {
    if (!el || el.nodeType !== 1) return parse(getComputedStyle(document.documentElement).backgroundColor) ?? '#ffffff'
    if (cache.has(el)) return cache.get(el)
    const cs = getComputedStyle(el)
    let out
    const own = parse(cs.backgroundColor)
    if (own) out = own
    else if (/url\(/.test(cs.backgroundImage)) out = null
    else out = el === document.body ? parse(getComputedStyle(document.documentElement).backgroundColor) ?? '#ffffff' : behind(el.parentElement)
    cache.set(el, out)
    return out
  }
  const pageBg = behind(document.body) ?? '#ffffff'
  const darkPage = luminance(pageBg) < 0.2

  // 1. The logo.
  for (const logo of document.querySelectorAll(LOGO_SELECTOR)) {
    if (logo.closest(SKIP) || !visible(logo)) continue
    if (logo.parentElement?.closest(LOGO_SELECTOR)) continue // the outermost logo element only
    const bg = behind(logo.parentElement) ?? pageBg
    const img = logo.localName === 'img' ? logo : logo.querySelector('img')
    if (img && img.complete && img.naturalWidth) {
      const sample = sampleImage(img)
      const ratio = sample?.average ? contrastRatio(sample.average, bg) : null
      if (ratio !== null && ratio < 3) {
        add(img, {
          kind: 'logo-image',
          title: 'Logo is hard to see here',
          message: `Your logo is a picture, which colorsbymax can’t re-colour, and it reads at only ${fmt(ratio)} on this background. Use a transparent SVG (which colorsbymax can colour), or add a version made for ${darkPage ? 'dark' : 'light'} backgrounds.`,
          action: 'invert',
        })
      } else if (sample === null) {
        add(img, {
          kind: 'logo-image',
          title: 'Check your logo here',
          message: `Your logo is a picture, which colorsbymax can’t re-colour. Check it still reads on this ${darkPage ? 'dark' : 'light'} background, or use a transparent SVG instead.`,
          action: 'invert',
        })
      }
      continue
    }
    // A text or SVG logo: judge its text colour, or its first drawn shape.
    const painted = ownText(logo) ? logo : [...logo.querySelectorAll('*')].find((n) => ownText(n) || n instanceof SVGElement) ?? logo
    const cs = getComputedStyle(painted)
    const fg = parse(painted instanceof SVGElement ? (cs.fill !== 'none' ? cs.fill : cs.stroke) : cs.color)
    if (!fg) continue
    const ratio = contrastRatio(fg, bg)
    if (ratio < 3) {
      add(logo, {
        kind: 'logo',
        title: 'Logo is hard to see here',
        message: logoColouring
          ? `Your logo reads at only ${fmt(ratio)} on this background. Try another theme, or give the logo its own colour.`
          : `Your logo keeps its own colours, which read at only ${fmt(ratio)} on this background. Let colorsbymax colour it to match the theme, or pick a theme it suits.`,
        action: logoColouring ? undefined : 'colour-logo',
      })
    }
  }

  // 2. Pictures whose solid background shows as a box on the page.
  for (const img of document.images) {
    if (img.closest(SKIP) || !img.complete || !img.naturalWidth || !visible(img)) continue
    const rect = img.getBoundingClientRect()
    if (rect.width < 24 || rect.height < 24) continue
    const sample = sampleImage(img)
    if (!sample || sample.transparent) continue
    const solid = sample.corners.every((c) => c && contrastRatio(c, sample.corners[0]) < 1.15)
    if (!solid) continue
    const bg = behind(img.parentElement) ?? pageBg
    const ratio = contrastRatio(sample.corners[0], bg)
    if (ratio >= 1.6) {
      const light = luminance(sample.corners[0]) > luminance(bg)
      add(img, {
        kind: 'image-box',
        title: `Picture shows as a ${light ? 'light' : 'dark'} box`,
        message: `This picture has a solid ${light ? 'light' : 'dark'} background that stands out against this ${luminance(bg) < 0.2 ? 'dark' : 'light'} page. A transparent PNG or an SVG would blend in with any theme.`,
        action: img.closest(LOGO_SELECTOR) ? 'invert' : undefined,
      })
    }
  }

  // 3. Text and icons too faint to read.
  const elements = [...document.body.querySelectorAll('*')].slice(0, MAX_ELEMENTS)
  for (const el of elements) {
    if (el.closest(SKIP) || el.closest(LOGO_SELECTOR)) continue
    const svg = el.localName === 'svg'
    if (!svg && !ownText(el)) continue
    if (!visible(el)) continue
    const cs = getComputedStyle(el)
    if (cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text') continue
    const fg = parse(svg ? (cs.stroke !== 'none' ? cs.stroke : cs.fill) : cs.color)
    const bg = behind(el)
    if (!fg || !bg) continue
    const size = parseFloat(cs.fontSize)
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700)
    const needed = svg || large ? 3 : 4.5
    const ratio = contrastRatio(fg, bg)
    if (ratio >= needed) continue
    const what = svg ? 'Icon' : 'Text'
    add(el, {
      kind: svg ? 'icon' : 'text',
      title: `${what} is hard to read`,
      message: `${describe(el) ? `“${describe(el)}” ` : ''}reads at ${fmt(ratio)} here; ${svg ? 'icons' : large ? 'large text' : 'text'} needs ${needed}:1. Try another theme, or adjust it under “Override a single colour”.`,
    })
  }

  return findings
}
