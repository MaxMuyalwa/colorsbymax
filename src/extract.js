// Palettes from files: reads the colours in an uploaded image or PDF and turns them into a
// theme. Images are sampled pixel by pixel. PDFs are rendered with PDF.js (downloaded only when
// a PDF is picked); hex codes written in a PDF, as in brand guidelines, win over its pixels.

import { contrastRatio, deltaE, hexToRgb, mix, rgbToHex, rgbToHsl } from './color.js'
import { fixAll } from './contrast.js'
import { themeFromRoles } from './scan.js'

/** Largest file accepted, in bytes. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024
/** Images are scaled down to at most this many pixels on their longest side before sampling. */
const SAMPLE_SIZE = 200
/** PDF pages read, from the first. */
const MAX_PDF_PAGES = 3
/** Colours closer than this (CIE76 ΔE) count as one. */
const MERGE_DELTA_E = 12
/** Colours covering less than this share of the sampled pixels are ignored. */
const MIN_SHARE = 0.004
/** How close (CIE76 ΔE) a colour must be to a mix of two others to count as their edge blend. */
const BLEND_DELTA_E = 6
/** Most colours returned. */
export const MAX_COLOURS = 8

const HEX_IN_TEXT = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi
const hslOf = (hex) => rgbToHsl(hexToRgb(hex))

/**
 * The main colours in an image or PDF, most important first.
 * @param {File} file
 * @returns {Promise<{ colours: string[], from: 'image' | 'pdf-text' | 'pdf' }>}
 */
export async function coloursFromFile(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error('That file is over 25 MB. Try a smaller one.')
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (isPdf) return coloursFromPdf(file)
  if (!file.type.startsWith('image/')) throw new Error('Choose an image (PNG, JPG, WebP, SVG…) or a PDF.')
  const bitmap = await loadImage(file)
  return { colours: dominantColours([pixelsOf(bitmap, bitmap.width, bitmap.height)]), from: 'image' }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Couldn’t read that image. Try a PNG or JPG.'))
    }
    img.src = url
  })
}

/** Draws a source scaled down to SAMPLE_SIZE and returns its RGBA pixels. */
function pixelsOf(source, width, height) {
  const scale = Math.min(1, SAMPLE_SIZE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  // Nearest-pixel scaling: smoothing would invent blends along every edge between two colours.
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data
}

/**
 * Buckets pixels into a coarse colour grid, then folds similar buckets together and keeps the
 * ones covering a real share of the picture.
 * @param {Uint8ClampedArray[]} pixelSets
 */
export function dominantColours(pixelSets) {
  const buckets = new Map()
  let total = 0
  for (const data of pixelSets) {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue // transparent
      const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3)
      let b = buckets.get(key)
      if (!b) buckets.set(key, (b = { r: 0, g: 0, b: 0, n: 0 }))
      b.r += data[i]
      b.g += data[i + 1]
      b.b += data[i + 2]
      b.n++
      total++
    }
  }
  const merged = []
  for (const b of [...buckets.values()].sort((x, y) => y.n - x.n)) {
    const hex = rgbToHex([b.r / b.n, b.g / b.n, b.b / b.n].map(Math.round))
    const into = merged.find((m) => deltaE(m.hex, hex) < MERGE_DELTA_E)
    if (into) into.n += b.n
    else merged.push({ hex, n: b.n })
  }
  const kept = []
  for (const m of merged.filter((m) => m.n / total >= MIN_SHARE).sort((a, b) => b.n - a.n)) {
    if (!isEdgeBlend(m, kept)) kept.push(m)
  }
  return kept.slice(0, MAX_COLOURS).map((m) => m.hex)
}

/**
 * True for a colour that is just the anti-aliased edge between two much more common ones:
 * it sits on the line between them and covers far less of the picture.
 */
function isEdgeBlend(m, kept) {
  for (const a of kept) {
    for (const b of kept) {
      if (a === b || m.n * 3 > Math.min(a.n, b.n)) continue
      for (let t = 0.15; t <= 0.85; t += 0.05) {
        if (deltaE(m.hex, mix(a.hex, b.hex, t)) < BLEND_DELTA_E) return true
      }
    }
  }
  return false
}

async function coloursFromPdf(file) {
  let pdfjs
  try {
    pdfjs = await import('pdfjs-dist')
    // Runs PDF.js on the page instead of in a separate worker file, so no bundler setup is needed.
    await import('pdfjs-dist/build/pdf.worker.min.mjs')
  } catch {
    throw new Error('Couldn’t load the PDF reader. Check your connection and try again.')
  }
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  let doc
  try {
    doc = await task.promise
  } catch {
    throw new Error('Couldn’t open that PDF. It may be damaged or password-protected.')
  }
  try {
    const written = []
    const pixelSets = []
    for (let n = 1; n <= Math.min(MAX_PDF_PAGES, doc.numPages); n++) {
      const page = await doc.getPage(n)
      const text = await page.getTextContent()
      for (const item of text.items) for (const m of (item.str ?? '').matchAll(HEX_IN_TEXT)) written.push(expandHex(m[1]))

      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: Math.min(2, (SAMPLE_SIZE * 2) / Math.max(base.width, base.height)) })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise
      pixelSets.push(pixelsOf(canvas, canvas.width, canvas.height))
    }
    // Written codes are what the designer meant; keep their order, dropping repeats.
    const distinct = []
    for (const hex of written) if (!distinct.some((d) => deltaE(d, hex) < 2)) distinct.push(hex)
    if (distinct.length >= 2) return { colours: distinct.slice(0, MAX_COLOURS), from: 'pdf-text' }
    return { colours: dominantColours(pixelSets), from: 'pdf' }
  } finally {
    task.destroy()
  }
}

const expandHex = (h) => `#${(h.length === 3 ? h.replace(/./g, (c) => c + c) : h).toLowerCase()}`

/**
 * Assigns a palette's colours to theme roles: the most vivid becomes primary, a very light one
 * the page background, a very dark one the text, and every colour feeds the data set.
 * @param {string[]} colours  most important first
 */
export function rolesFromPalette(colours) {
  const info = colours.map((hex, i) => {
    const [h, s, l] = hslOf(hex)
    // Vivid, mid-lightness colours make good brands; earlier colours get a small edge.
    return { hex, h, s, l, score: s * (1 - Math.abs(l - 0.5) * 1.4) * (1 - i * 0.04) }
  })
  const accents = info.filter((c) => c.s >= 0.2 && c.l >= 0.15 && c.l <= 0.85).sort((a, b) => b.score - a.score)
  const byLight = [...info].sort((a, b) => b.l - a.l)
  const roles = {}

  const background = byLight.find((c) => c.l >= 0.93)
  if (background) roles.background = background.hex
  const bg = roles.background ?? '#ffffff'
  const ink = [...byLight].reverse().find((c) => c.l <= 0.25 && contrastRatio(c.hex, bg) >= 7)
  if (ink) roles.ink = ink.hex

  // Without anything vivid (a greyscale palette), use the most mid-toned colour.
  const primary = accents[0] ?? [...info].sort((a, b) => Math.abs(a.l - 0.45) - Math.abs(b.l - 0.45))[0]
  roles.primary = primary.hex
  const hueDist = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
  const alt = accents.find((c) => c !== primary && hueDist(c.h, primary.h) >= 20) ?? accents.find((c) => c !== primary)
  if (alt) roles['primary-alt'] = alt.hex
  const tint = info.find((c) => c.l >= 0.8 && c.l < 0.93 && c.s >= 0.1)
  if (tint) roles.secondary = tint.hex
  ;[...accents, ...info.filter((c) => !accents.includes(c) && c !== background && c !== ink)]
    .slice(0, 8)
    .forEach((c, i) => (roles[`data-${i + 1}`] = c.hex))
  return roles
}

/** A complete theme built around a palette, adjusted to pass contrast. */
export function themeFromPalette(colours) {
  const tokens = themeFromRoles(rolesFromPalette(colours))
  return { ...tokens, ...fixAll(tokens) }
}
