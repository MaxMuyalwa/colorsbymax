// The mrmaxdesigns logo mark (three slanted bars) for the panel's header, in the current theme's
// colours: the gradient partner, the brand, and the chart colour most unlike both, as in the logo's
// own red, violet and blue. Each bar is deepened or lightened until it stands out on the panel.

import { contrastRatio, hexToRgb, mix, rgbToHsl } from './color.js'

const BARS = [
  'M57.13,163.05H0C28.34,108.7,56.67,54.35,85.01,0h55.44c-27.77,54.35-55.55,108.7-83.32,163.05Z',
  'M134.89,163.05h-57.13C106.1,108.7,134.43,54.35,162.77,0h55.44c-27.77,54.35-55.55,108.7-83.32,163.05Z',
  'M212.65,163.05h-57.13C183.86,108.7,212.19,54.35,240.53,0h55.44c-27.77,54.35-55.55,108.7-83.32,163.05Z',
]
const MIN_CONTRAST = 3 // WCAG's minimum for graphics

const hue = (hex) => rgbToHsl(hexToRgb(hex))[0]
const hueGap = (a, b) => {
  const d = Math.abs(hue(a) - hue(b))
  return Math.min(d, 360 - d)
}

/** The three bars' colours for a theme. */
export function logoColours(tokens) {
  const [a, b] = [tokens['primary-alt'], tokens.primary]
  const apart = (x) => Math.min(hueGap(x, a), hueGap(x, b))
  let c = tokens['data-3']
  for (let n = 1; n <= 8; n++) if (apart(tokens[`data-${n}`]) > apart(c)) c = tokens[`data-${n}`]
  return [a, b, c]
}

/** Moves a colour towards black (on light) or white (on dark) until it reads on `background`. */
function standOut(hex, background) {
  const target = contrastRatio(background, '#000000') > contrastRatio(background, '#ffffff') ? '#000000' : '#ffffff'
  for (let t = 0; t <= 1; t += 0.05) {
    const out = mix(target, hex, t)
    if (contrastRatio(out, background) >= MIN_CONTRAST) return out
  }
  return target
}

/** @param {{ tokens: Record<string, string>, background: string, className?: string }} props */
export function LogoMark({ tokens, background, className = '' }) {
  const colours = logoColours(tokens).map((c) => standOut(c, background))
  return (
    <svg viewBox="0 0 296 163.05" className={className} aria-hidden="true">
      {BARS.map((d, i) => (
        <path key={i} d={d} fill={colours[i]} />
      ))}
    </svg>
  )
}
