// Studio's point and click: pick any part of the page and give it its own colours. Each change is
// a "paint": what was picked (a CSS selector for it, and for every part like it), how to describe
// it to a person or an AI agent, and its background, text and border colours. Paints are drawn
// with a stylesheet on the page they were made on, and exported as a prompt or as CSS.
//
// A colour is { token, hex }: picked from the theme's swatches it follows the theme (the token),
// with the hex it was when picked; or a custom { hex }.

import { contrastRatio, normalizeHex } from './color.js'
import { normalPath } from './scope.js'
import { TOKEN_KEYS, TOKEN_LABELS } from './tokens.js'

/** Most paints a site keeps. */
export const MAX_PAINTS = 80
/** The theme colours offered as swatches, in order. */
export const SWATCH_TOKENS = ['primary', 'primary-alt', 'primary-dark', 'secondary', 'accent', 'on-primary', 'background', 'surface', 'ink', 'ink-muted', 'data-1', 'data-2', 'data-3']
export const PROPS = [
  { key: 'background', label: 'Background' },
  { key: 'text', label: 'Text' },
  { key: 'border', label: 'Border' },
]

const SKIP = 'colorsbymax-root, [data-colorsbymax], script, style, noscript, template, head'
const CONTROLS = 'a, button, [role="button"], input, select, textarea, label, summary'

// ---------------------------------------------------------------- what was picked

/** The part of the page a pointer event is over: the control it's in, or the element itself. */
export function pickTarget(e) {
  if (e.composedPath?.().some((n) => n.localName === 'colorsbymax-root')) return null
  let el = e.target
  if (!(el instanceof Element)) return null
  el = el.closest('svg') ?? el // an icon, not the path inside it
  if (el === document.documentElement || el === document.body || el.closest(SKIP)) return null
  return el.closest(CONTROLS) ?? el
}

/** The element around this one, skipping wrappers exactly its size; null at the top. */
export function parentOf(el) {
  const r = el.getBoundingClientRect()
  let p = el.parentElement
  while (p && p !== document.body) {
    const q = p.getBoundingClientRect()
    if (Math.abs(q.width - r.width) > 2 || Math.abs(q.height - r.height) > 2) return p
    p = p.parentElement
  }
  return null
}

const shown = (el) => {
  if (el.closest(SKIP)) return false
  const r = el.getBoundingClientRect()
  return r.width > 1 && r.height > 1
}
const sameSize = (a, b) => {
  const r = a.getBoundingClientRect()
  const q = b.getBoundingClientRect()
  return Math.abs(q.width - r.width) <= 2 && Math.abs(q.height - r.height) <= 2
}

/**
 * The first part inside this one (the first holding words, else the first shown), past wrappers
 * exactly its size; null when it holds only its own words, so it is the text itself.
 */
export function childOf(el) {
  let node = el
  for (let depth = 0; depth < 10; depth++) {
    const kids = [...node.children].filter(shown)
    if (!kids.length) return node === el ? null : node
    const next = kids.find((k) => k.innerText?.trim()) ?? kids[0]
    if (!sameSize(next, el)) return next.closest('svg') ?? next
    node = next
  }
  return null
}

const validId = (id) => /^[A-Za-z][\w-]*$/.test(id) && !/\d{4,}|^(radix|headlessui|react|:r)/i.test(id)

/** A selector for exactly this element: its place under the nearest element with a steady id. */
export function selectorFor(el) {
  const parts = []
  let node = el
  while (node && node.nodeType === 1) {
    if (node === document.body) {
      parts.unshift('body')
      break
    }
    if (node.id && validId(node.id) && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) {
      parts.unshift(`#${CSS.escape(node.id)}`)
      break
    }
    const tag = node.localName
    const parent = node.parentElement
    if (!parent) break
    const same = [...parent.children].filter((c) => c.localName === tag)
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(node) + 1})` : tag)
    node = parent
  }
  return parts.join(' > ')
}

/** A selector for every part like this one: the same tag and classes, or its siblings of that tag. */
export function similarSelector(el) {
  const classes = [...el.classList].filter((c) => !/^(cbm|colorsbymax)/.test(c)).slice(0, 8)
  if (classes.length) return `${el.localName}${classes.map((c) => `.${CSS.escape(c)}`).join('')}`
  const path = selectorFor(el).split(' > ')
  path[path.length - 1] = el.localName
  return path.join(' > ')
}

const count = (selector) => {
  try {
    return document.querySelectorAll(selector).length
  } catch {
    return 0
  }
}

const TEXT_TAGS = new Set(['p', 'span', 'li', 'small', 'strong', 'em', 'b', 'i', 'label', 'blockquote', 'figcaption', 'dd', 'dt', 'td', 'th', 'code', 'time'])
const LANDMARKS = { header: 'Header', nav: 'Navigation', footer: 'Footer', aside: 'Sidebar', main: 'Main area', section: 'Section', form: 'Form' }

function looksLikeButton(el) {
  const cs = getComputedStyle(el)
  const filled = toHex(cs.backgroundColor) !== null
  const bordered = parseFloat(cs.borderTopWidth) > 0
  return (filled || bordered) && parseFloat(cs.paddingLeft) >= 6 && cs.display !== 'inline'
}

/** What kind of part it is, in plain words: Button, Link, Heading, Card and so on. */
export function kindOf(el) {
  const tag = el.localName
  if (tag === 'button' || el.getAttribute('role') === 'button' || (tag === 'input' && ['button', 'submit', 'reset'].includes(el.type))) return 'Button'
  if (tag === 'a') return looksLikeButton(el) ? 'Button' : 'Link'
  if (/^h[1-6]$/.test(tag)) return 'Heading'
  if (['img', 'svg', 'picture', 'video', 'canvas'].includes(tag)) return tag === 'svg' ? 'Icon' : 'Image'
  if (['input', 'select', 'textarea'].includes(tag)) return 'Field'
  if (LANDMARKS[tag]) return LANDMARKS[tag]
  if (TEXT_TAGS.has(tag)) return 'Text'
  const cs = getComputedStyle(el)
  const r = el.getBoundingClientRect()
  if (r.width > window.innerWidth * 0.85 && r.height > 160) return 'Section'
  const boxed = parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none' || parseFloat(cs.borderTopLeftRadius) >= 6
  if (boxed && el.children.length) return 'Card'
  if (!el.children.length && el.textContent.trim()) return 'Text'
  return 'Box'
}

const trimText = (s, max = 48) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

/** Its words (or a picture's description), to recognise it by. */
export const textOf = (el) => trimText(el.getAttribute('aria-label') || el.getAttribute('alt') || el.innerText || el.getAttribute('title') || '')

function* ancestors(el) {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) yield node
}

/** The words to know a part by: a card or section by its heading, anything else by its own text. */
function nameText(el, kind) {
  if (['Card', 'Section', 'Box', 'Header', 'Footer', 'Sidebar', 'Main area', 'Form', 'Navigation'].includes(kind)) {
    const heading = el.querySelector('h1, h2, h3, h4, h5, h6')
    if (heading) return trimText(heading.innerText)
  }
  return textOf(el)
}

/** Where it is on the page: "in the header", "in the “Pricing” section". */
export function whereOf(el) {
  // A <header> that fills the screen is a hero, not the site's top bar.
  const landmark = [...ancestors(el)].find((a) => ['footer', 'nav', 'aside'].includes(a.localName) || (a.localName === 'header' && a.getBoundingClientRect().height < 220))
  if (landmark) return { header: 'in the header', footer: 'in the footer', nav: 'in the navigation', aside: 'in the sidebar' }[landmark.localName]
  const section = el.parentElement?.closest('section, article, header, [id]:not(body):not(#root):not(#app):not(#__next)')
  if (section) {
    const heading = section.querySelector('h1, h2, h3')
    if (heading && heading !== el && trimText(heading.innerText, 40)) return `in the “${trimText(heading.innerText, 40)}” section`
    return 'in a section'
  }
  return ''
}

/** Everything Studio needs about a picked element. */
export function describe(el) {
  const one = selectorFor(el)
  const similar = similarSelector(el)
  const likeIt = count(similar)
  const cs = getComputedStyle(el)
  const kind = kindOf(el)
  return {
    el,
    one,
    similar: likeIt > 1 && similar !== one ? similar : null,
    likeIt,
    kind,
    text: nameText(el, kind),
    where: whereOf(el),
    hasBorder: parseFloat(cs.borderTopWidth) > 0,
  }
}

// ---------------------------------------------------------------- colours on the page

let canvas = null
const rgbaCache = new Map()
/**
 * Any CSS colour the browser understands (rgb, hex, oklch, color(srgb …), color-mix and the rest)
 * as [r, g, b, alpha], read back from a pixel so every format comes out the same way.
 */
export function rgbaOf(colour) {
  if (!colour || colour === 'transparent') return [0, 0, 0, 0]
  const cached = rgbaCache.get(colour)
  if (cached) return cached
  let out = [0, 0, 0, 0]
  const m = colour.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/)
  if (m) {
    const alpha = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4])
    out = [Number(m[1]), Number(m[2]), Number(m[3]), alpha]
  } else {
    try {
      canvas ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true })
      canvas.clearRect(0, 0, 1, 1)
      canvas.fillStyle = colour
      canvas.fillRect(0, 0, 1, 1)
      // getImageData hands back the colour itself and its alpha, separately (not premultiplied).
      const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data
      out = [r, g, b, a / 255]
    } catch {
      out = [0, 0, 0, 0]
    }
  }
  if (rgbaCache.size > 500) rgbaCache.clear()
  rgbaCache.set(colour, out)
  return out
}

const hexOfRgb = (rgb) => `#${rgb.map((n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')).join('')}`
/** `top` (with its alpha) laid over the solid colour `under`. */
const over = ([r, g, b, a], under) => under.map((u, i) => [r, g, b][i] * a + u * (1 - a))

/** Any CSS colour as #rrggbb, or null when it's mostly see-through. */
export function toHex(colour) {
  const [r, g, b, a] = rgbaOf(colour)
  return a < 0.5 ? null : hexOfRgb([r, g, b])
}

/** The page's own backdrop: the root's or body's background, else white. */
function pageBackdrop() {
  for (const node of [document.body, document.documentElement]) {
    const [r, g, b, a] = rgbaOf(getComputedStyle(node).backgroundColor)
    if (a > 0.5) return [r, g, b]
  }
  return [255, 255, 255]
}

/**
 * The solid colour an element's text sits on: its own background and every see-through one
 * behind it, laid over each other down to the first solid one (or the page). Background
 * pictures and gradients aren't counted.
 */
export function backgroundRgb(el) {
  const layers = []
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    const rgba = rgbaOf(getComputedStyle(node).backgroundColor)
    if (rgba[3] > 0.01) layers.push(rgba)
    if (rgba[3] > 0.99) break
  }
  let colour = layers.at(-1)?.[3] > 0.99 ? layers.pop().slice(0, 3) : pageBackdrop()
  for (const layer of layers.reverse()) colour = over(layer, colour)
  return colour
}
export const backgroundBehind = (el) => hexOfRgb(backgroundRgb(el))

/** An element's text colour as it shows: faded by its own alpha and any see-through parents. */
export function textRgb(el, background = backgroundRgb(el)) {
  let [r, g, b, a] = rgbaOf(getComputedStyle(el).color)
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) a *= Number(getComputedStyle(node).opacity) || 0
  return over([r, g, b, a], background)
}

/** Text against its background right now: the ratio, both colours, and what it needs to pass. */
export function readability(el) {
  const bg = backgroundRgb(el)
  const text = hexOfRgb(textRgb(el, bg))
  const background = hexOfRgb(bg)
  const cs = getComputedStyle(el)
  const size = parseFloat(cs.fontSize)
  const large = size >= 24 || (size >= 18.6 && Number(cs.fontWeight) >= 700)
  return { ratio: contrastRatio(text, background), text, background, need: large ? 3 : 4.5 }
}

/** Elements under `root` (itself included) that hold their own words. */
function textHolders(root, max) {
  const out = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  })
  const seen = new Set()
  for (let n = walker.nextNode(); n && out.length < max; n = walker.nextNode()) {
    const el = n.parentElement
    if (!el || seen.has(el) || el.closest(SKIP)) continue
    seen.add(el)
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1 || getComputedStyle(el).visibility === 'hidden') continue
    out.push(el)
  }
  return out
}

/**
 * How readable the text in a part is: every piece of text in it (and in every part like it, when
 * they change together), with the ones that are hard to read.
 */
export function checkText(roots, max = 60) {
  const pieces = roots.flatMap((root) => textHolders(root, max)).slice(0, max)
  const results = pieces.map((el) => ({ el, ...readability(el) }))
  return { checked: results.length, failing: results.filter((r) => r.ratio < r.need), worst: results.reduce((w, r) => (!w || r.ratio / r.need < w.ratio / w.need ? r : w), null) }
}

/**
 * The best text colour for a background: the theme colour that reads best, or black or white
 * when no theme colour is readable enough.
 */
export function bestText(background, tokens, need = 4.5) {
  const seen = new Set()
  const options = TOKEN_KEYS.filter((token) => !token.startsWith('app-') && tokens[token] && !seen.has(tokens[token]) && seen.add(tokens[token])).map((token) => ({
    token,
    hex: tokens[token],
    ratio: contrastRatio(tokens[token], background),
  }))
  const best = options.sort((a, b) => b.ratio - a.ratio)[0]
  if (best && best.ratio >= need) return best
  const black = contrastRatio('#000000', background)
  const white = contrastRatio('#ffffff', background)
  return black >= white ? { hex: '#000000', ratio: black } : { hex: '#ffffff', ratio: white }
}

// ---------------------------------------------------------------- paints

const cleanColour = (v) => {
  if (!v || typeof v !== 'object') return null
  const hex = normalizeHex(v.hex)
  if (TOKEN_KEYS.includes(v.token)) return { token: v.token, ...(hex ? { hex } : {}) }
  return hex ? { hex } : null
}
const cleanSelector = (s) => (typeof s === 'string' && s.length <= 600 && !/[{}<;]/.test(s) ? s : null)
const cleanString = (s, max) => (typeof s === 'string' ? s.slice(0, max) : '')

/** Keeps only well-formed paints (they come back from storage). */
export function cleanPaints(list) {
  if (!Array.isArray(list)) return []
  const out = []
  for (const p of list) {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string') continue
    const page = normalPath(p.page)
    const one = cleanSelector(p.one)
    if (!page || !one) continue
    const props = Object.fromEntries(PROPS.map(({ key }) => [key, cleanColour(p.props?.[key])]).filter(([, v]) => v))
    out.push({
      id: p.id.slice(0, 40),
      page,
      one,
      similar: cleanSelector(p.similar),
      all: Boolean(p.all && cleanSelector(p.similar)),
      // Every part like it, on every page of the site: what Studio has learnt from this change.
      everywhere: Boolean(p.everywhere && cleanSelector(p.similar)),
      likeIt: Number.isInteger(p.likeIt) ? p.likeIt : 1,
      kind: cleanString(p.kind, 30) || 'Part',
      text: cleanString(p.text, 60),
      where: cleanString(p.where, 80),
      hasBorder: Boolean(p.hasBorder),
      props,
    })
    if (out.length >= MAX_PAINTS) break
  }
  return out
}

export const selectorOf = (paint) => ((paint.all || paint.everywhere) && paint.similar ? paint.similar : paint.one)
/** The page a paint is drawn on, or '*' for one that goes on every page. */
export const pageOf = (paint) => (paint.everywhere ? '*' : paint.page)

/** A colour for the stylesheet: the theme's variable where it follows the theme, else its hex. */
const cssValue = (v, themed) => (v.token && themed ? `var(--color-${v.token}${v.hex ? `, ${v.hex}` : ''})` : v.hex ?? `var(--color-${v.token})`)

/** The stylesheet for some paints. `themed`: the page takes the theme, so swatches follow it. */
export function paintCss(paints, themed = true) {
  return paints
    .map((p) => {
      const sel = `html ${selectorOf(p)}`
      const rules = []
      const { background, text, border } = p.props
      if (background) rules.push(`${sel}{background:${cssValue(background, themed)}!important}`)
      if (text) rules.push(`${sel},${sel} *{color:${cssValue(text, themed)}!important}`)
      if (border) rules.push(`${sel}{border-color:${cssValue(border, themed)}!important${p.hasBorder ? '' : ';border-width:1px!important;border-style:solid!important'}}`)
      return rules.join('')
    })
    .join('')
}

const hexOf = (v, tokens) => (v.token ? tokens[v.token] : v.hex)
const nameOf = (v, tokens) => (v.token ? `${hexOf(v, tokens)} (the theme's ${TOKEN_LABELS[v.token]?.toLowerCase() ?? v.token} colour, var(--color-${v.token}))` : v.hex)
const partName = (p) => {
  const kind = p.kind.toLowerCase()
  const what = p.text ? `the ${kind} “${p.text}”` : `${['header', 'footer', 'navigation', 'sidebar', 'main area'].includes(kind) ? 'the' : 'a'} ${kind}`
  return [what, p.where].filter(Boolean).join(' ')
}
const groupByPage = (paints) => paints.reduce((m, p) => m.set(pageOf(p), [...(m.get(pageOf(p)) ?? []), p]), new Map())
const onPage = (page) => (page === '*' ? 'On every page of the site' : `On the page ${page}`)

/** A prompt for Claude, Cursor or Copilot that makes the changes in the site's code. */
export function paintsPrompt(paints, tokens) {
  const pages = [...groupByPage(paints)].map(([page, list]) => {
    const lines = list.map((p, i) => {
      const who = p.everywhere
        ? `${partName(p)}, and every ${p.kind.toLowerCase()} like it on every page (it's a shared component, so change it where it's defined)`
        : p.all && p.similar
          ? `${partName(p)}, and every ${p.kind.toLowerCase()} like it (${p.likeIt} on the page)`
          : partName(p)
      const changes = PROPS.filter(({ key }) => p.props[key]).map(({ key, label }) => `${label.toLowerCase()} ${nameOf(p.props[key], tokens)}`)
      return `${i + 1}. ${who[0].toUpperCase()}${who.slice(1)} (CSS selector: ${selectorOf(p)}): ${changes.join('; ')}.`
    })
    return `${onPage(page)}:\n${lines.join('\n')}`
  })
  return `Make these colour changes in my site's code. I picked them in colorsbymax Studio by clicking on the page. Find each part in the code from its description and words (the CSS selector is only a hint), and change only what's listed; keep everything else the same. Where the site already has a colour variable or theme setting for a colour, use that instead of hard-coding the hex.\n\n${pages.join('\n\n')}`
}

/** The changes as plain CSS, with the theme's colours as hex. */
export function paintsCssExport(paints, tokens) {
  return [...groupByPage(paints)]
    .map(([page, list]) => {
      const rules = list.flatMap((p) => {
        const sel = selectorOf(p)
        const { background, text, border } = p.props
        return [
          `/* ${partName(p)} */`,
          ...(background ? [`${sel} { background: ${hexOf(background, tokens)}; }`] : []),
          ...(text ? [`${sel}, ${sel} * { color: ${hexOf(text, tokens)}; }`] : []),
          ...(border ? [`${sel} { ${p.hasBorder ? 'border-color:' : 'border: 1px solid'} ${hexOf(border, tokens)}; }`] : []),
        ]
      })
      return `/* colorsbymax Studio, ${page === '*' ? 'on every page' : `on ${page}`} */\n${rules.join('\n')}`
    })
    .join('\n\n')
}
