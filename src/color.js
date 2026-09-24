// Small sRGB colour helpers used by the theme system. All colours are #rrggbb strings.

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Normalises "#abc", "abc", "#AABBCC" to "#aabbcc"; returns null for anything else. */
export function normalizeHex(input) {
  if (typeof input !== 'string') return null
  const m = input.trim().match(HEX_RE)
  if (!m) return null
  let h = m[1].toLowerCase()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return `#${h}`
}

export function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1)
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')
}

/** Composites `fg` over `bg` at the given alpha (0–1), like `color-mix(fg alpha, bg)`. */
export function mix(fg, bg, alpha) {
  const a = hexToRgb(fg)
  const b = hexToRgb(bg)
  return rgbToHex(a.map((v, i) => v * alpha + b[i] * (1 - alpha)))
}

function channelToLinear(c) {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** WCAG 2.x relative luminance. */
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(channelToLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.x contrast ratio between two colours (1–21). */
export function contrastRatio(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export function rgbToHsl([r, g, b]) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h * 60, s, l]
}

export function hslToRgb([h, s, l]) {
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

/** Returns `hex` with its HSL lightness replaced (hue and saturation kept). */
export function withLightness(hex, l) {
  const [h, s] = rgbToHsl(hexToRgb(hex))
  return rgbToHex(hslToRgb([h, s, Math.min(1, Math.max(0, l))]))
}

export function lightness(hex) {
  return rgbToHsl(hexToRgb(hex))[2]
}

/** CIE L*a*b* (D65), used for perceptual checks on ramps. */
export function toLab(hex) {
  const [r, g, b] = hexToRgb(hex).map(channelToLinear)
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  const [fx, fy, fz] = [f(x), f(y), f(z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/** CIE76 colour difference. */
export function deltaE(a, b) {
  const [l1, a1, b1] = toLab(a)
  const [l2, a2, b2] = toLab(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}
