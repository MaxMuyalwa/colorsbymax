// What's painted underneath an element besides its parents: a positioned sibling under it, like the
// sliding pill behind the active item of a nav bar or a segmented control (shadcn and Radix animated
// tabs, framer-motion layoutId pills). Such a pill is a separate element, so walking up an
// element's parents never finds it, and the item would look like it sits on the bar.
//
// Every part of colorsbymax that asks "what does this sit on" (the re-colouring engine, the contrast
// guard, Studio's readability check) asks this first, for an element with no fill of its own.

const MAX_SIBLINGS = 40
const POSITIONED = new Set(['absolute', 'fixed'])

const alphaOf = (colour) => {
  const m = colour.match(/rgba?\([^)]*[,/]\s*([\d.]+%?)\s*\)$/)
  if (!m) return colour === 'transparent' ? 0 : 1
  return m[1].endsWith('%') ? parseFloat(m[1]) / 100 : Number(m[1])
}

/**
 * The positioned sibling painted under the middle of `el`, with a background of its own, or null.
 * It counts when it comes before `el` (painted first) or sits behind it (a negative z-index); one
 * after it at the same level would be on top, like a tooltip, and doesn't count.
 */
export function underlayOf(el) {
  const parent = el.parentElement
  if (!parent || parent.children.length > MAX_SIBLINGS) return null
  const r = el.getBoundingClientRect()
  if (!r.width || !r.height) return null
  const x = r.left + r.width / 2
  const y = r.top + r.height / 2
  let before = true
  for (const sib of parent.children) {
    if (sib === el) {
      before = false
      continue
    }
    const cs = getComputedStyle(sib)
    if (!POSITIONED.has(cs.position)) continue
    if (!before && !(parseInt(cs.zIndex, 10) < 0)) continue
    if (alphaOf(cs.backgroundColor) < 0.5 && !/gradient/.test(cs.backgroundImage)) continue
    const s = sib.getBoundingClientRect()
    if (x >= s.left && x <= s.right && y >= s.top && y <= s.bottom) return sib
  }
  return null
}
