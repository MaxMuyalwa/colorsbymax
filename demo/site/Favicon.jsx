// The browser tab's icon: mrmaxdesigns' logo mark (three slanted bars) in the current theme's
// colours. The icon carries two versions, and the browser shows whichever suits its tabs: deeper
// colours on light tabs, lighter ones on dark tabs, each checked to stand out. Browsers that don't
// support colour-changing SVG favicons keep the logo from favicon.svg.

import { useEffect } from 'react'
import { contrastRatio, useTheme } from '../../src/index.js'

// The logo mark's three bars, left to right.
const BARS = [
  'M57.13,163.05H0C28.34,108.7,56.67,54.35,85.01,0h55.44c-27.77,54.35-55.55,108.7-83.32,163.05Z',
  'M134.89,163.05h-57.13C106.1,108.7,134.43,54.35,162.77,0h55.44c-27.77,54.35-55.55,108.7-83.32,163.05Z',
  'M212.65,163.05h-57.13C183.86,108.7,212.19,54.35,240.53,0h55.44c-27.77,54.35-55.55,108.7-83.32,163.05Z',
]
// Which theme colours paint them: the gradient partner, the brand, and an accent (see barColours),
// like the logo's own red, violet and blue.
const ROLES = ['primary-alt', 'primary', 'data-3']
// Typical tab backgrounds, light and dark.
const LIGHT_TAB = '#ffffff'
const DARK_TAB = '#202124'
const MIN_CONTRAST = 3 // WCAG's minimum for icons

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
/** Moves a colour towards `target` (black or white) until it reaches the contrast needed on `tab`. */
function standOut(hex, tab, target) {
  const [from, to] = [toRgb(hex), toRgb(target)]
  for (let t = 0; t <= 1; t += 0.04) {
    const out = toHex(from.map((v, i) => v + (to[i] - v) * t))
    if (contrastRatio(out, tab) >= MIN_CONTRAST) return out
  }
  return target
}

/** A colour's hue, in degrees. */
function hue(hex) {
  const [r, g, b] = toRgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  if (!d) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}
const hueGap = (a, b) => Math.min(Math.abs(hue(a) - hue(b)), 360 - Math.abs(hue(a) - hue(b)))

/** The bars' colours: the gradient partner and the brand, then the chart colour most unlike both. */
function barColours(tokens) {
  return [tokens[ROLES[0]], tokens[ROLES[1]], tokens[thirdBarRole(tokens)]]
}

/** The chart colour (data-1…8) least like the gradient partner and the brand, for the third bar. */
function thirdBarRole(tokens) {
  const [a, b] = [tokens[ROLES[0]], tokens[ROLES[1]]]
  const apart = (x) => Math.min(hueGap(x, a), hueGap(x, b))
  let best = ROLES[2]
  for (let n = 1; n <= 8; n++) if (apart(tokens[`data-${n}`]) > apart(tokens[best])) best = `data-${n}`
  return best
}

/**
 * The logo mark (the three bars) for the page, in the same theme colours as the tab icon. It paints
 * with the colour variables, so the "Colour the logo" setting applies to it.
 */
export function LogoMark({ className = '' }) {
  const { tokens } = useTheme()
  const roles = [ROLES[0], ROLES[1], thirdBarRole(tokens)]
  return (
    <svg viewBox="0 0 296 163.05" className={className} aria-hidden="true">
      {BARS.map((d, i) => (
        <path key={i} d={d} style={{ fill: `var(--color-${roles[i]})` }} />
      ))}
    </svg>
  )
}

function faviconSvg(tokens) {
  const colours = barColours(tokens)
  const light = colours.map((c) => standOut(c, LIGHT_TAB, '#000000'))
  const dark = colours.map((c) => standOut(c, DARK_TAB, '#ffffff'))
  const css = light.map((c, i) => `.b${i}{fill:${c}}`).join('') + `@media (prefers-color-scheme:dark){${dark.map((c, i) => `.b${i}{fill:${c}}`).join('')}}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -66 296 296"><style>${css}</style>${BARS.map((d, i) => `<path class="b${i}" d="${d}"/>`).join('')}</svg>`
}

/** Keeps the tab icon, and the browser's theme colour, in the current theme's colours. */
export function ThemedFavicon() {
  const { tokens } = useTheme()
  useEffect(() => {
    let link = document.querySelector('link[rel="icon"][data-themed]')
    if (!link) {
      link = Object.assign(document.createElement('link'), { rel: 'icon', type: 'image/svg+xml' })
      link.dataset.themed = ''
      document.head.append(link)
    }
    link.href = `data:image/svg+xml,${encodeURIComponent(faviconSvg(tokens))}`
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tokens.background)
  }, [tokens])
  return null
}
