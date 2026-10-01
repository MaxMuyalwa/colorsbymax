// Colours from the site's own pictures: its logo and its biggest photos. Colourful can tint the
// page with them, so a theme's washes feel made for the site rather than laid on top of it.
// Pictures from another site that doesn't allow reading them can't be sampled and are skipped.

import { hexToRgb, rgbToHsl } from './color.js'
import { dominantColours } from './extract.js'
import { LOGO_SELECTOR } from './recolour.js'

const SAMPLE = 48
const MAX_PICTURES = 8

const shownArea = (img) => {
  const r = img.getBoundingClientRect()
  return r.width > 0 && r.height > 0 ? r.width * r.height : 0
}

/** A picture's pixels, scaled down; null when it can't be read (another site's, not loaded). */
function pixelsOf(img) {
  try {
    const w = img.naturalWidth
    const h = img.naturalHeight
    const scale = Math.min(1, SAMPLE / Math.max(w, h))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(w * scale))
    canvas.height = Math.max(1, Math.round(h * scale))
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return ctx.getImageData(0, 0, canvas.width, canvas.height).data
  } catch {
    return null
  }
}

/** The main colours in the site's logo and biggest pictures, most used first. */
export function imageColours() {
  const pictures = [...document.images].filter((img) => img.complete && img.naturalWidth >= 24 && shownArea(img) && !img.closest('colorsbymax-root, [data-colorsbymax]'))
  const logos = pictures.filter((img) => img.closest(LOGO_SELECTOR))
  const photos = pictures
    .filter((img) => !logos.includes(img))
    .sort((a, b) => shownArea(b) - shownArea(a))
    .slice(0, MAX_PICTURES)
  const sets = [...logos.slice(0, 2), ...photos].map(pixelsOf).filter(Boolean)
  return sets.length ? dominantColours(sets) : []
}

/** The picture colour to tint with: the most used one with real colour in it (no greys, black or white). */
export function tintOf(colours) {
  return (
    colours.find((hex) => {
      const [, s, l] = rgbToHsl(hexToRgb(hex))
      return s >= 0.22 && l > 0.18 && l < 0.85
    }) ?? null
  )
}
