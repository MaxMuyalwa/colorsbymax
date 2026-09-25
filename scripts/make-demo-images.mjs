// Draws the coffee demo's test pictures as PNGs, so the audit has real images to check:
// a picture logo (dark mark on transparent) and a product photo on a solid white background.
//
//   node scripts/make-demo-images.mjs

import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length)
  return out
}

/** A width×height RGBA PNG; `paint(x, y)` returns [r, g, b, a]. */
function png(width, height, paint) {
  const rows = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    rows[y * (width * 4 + 1)] = 0 // no filter
    for (let x = 0; x < width; x++) rows.set(paint(x, y), y * (width * 4 + 1) + 1 + x * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.set([8, 6, 0, 0, 0], 8) // 8-bit RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))])
}

const dir = new URL('../demo/assets/', import.meta.url)
mkdirSync(dir, { recursive: true })

// Logo: a dark-brown coffee cup (a ring and a handle) on transparent.
writeFileSync(new URL('harbour-logo.png', dir), png(64, 64, (x, y) => {
  const d = Math.hypot(x - 28, y - 32)
  const cup = d > 14 && d < 22
  const handle = Math.hypot(x - 50, y - 32) > 5 && Math.hypot(x - 50, y - 32) < 9 && x > 47
  return cup || handle ? [74, 38, 18, 255] : [0, 0, 0, 0]
}))

// Product photo: a bag of beans on a solid white background.
writeFileSync(new URL('beans.png', dir), png(160, 120, (x, y) => {
  const bag = x > 50 && x < 110 && y > 20 && y < 105
  const label = bag && y > 50 && y < 75
  if (label) return [253, 231, 214, 255]
  if (bag) return [122, 62, 29, 255]
  return [255, 255, 255, 255]
}))
console.log('Wrote demo/assets/harbour-logo.png and beans.png')
