// The contrast guard: colorsbymax's last word on readability, on every site and in every colour
// style. After the colours change, it checks every piece of text and every icon on the page
// against what it actually sits on (its own background and every see-through one behind it, or
// the colours of a gradient), and fixes any that the theme made hard to read.
//
// Every pair is brought up to the WCAG target (4.5:1 for text, 3:1 for large text and icons): its
// own colour made lighter or darker first, so status colours keep their meaning, else the theme
// colour closest to it, else black or white. Anything marked data-colorsbymax-contrast="keep" (an
// example of poor contrast, say) is left alone, as are hidden, disabled and decorative parts. It runs when the colours or the page's content change,
// never while the page scrolls, so it costs nothing in between.

import { contrastRatio, deltaE, lightness, withLightness } from './color.js'
import { COLOR_IN_GRADIENT } from './scan.js'
import { rgbaOf } from './studio.js'

const FIX = 'data-cbm-fix'
const SKIP = 'colorsbymax-root, [data-colorsbymax], [data-colorsbymax-contrast="keep"], script, style, noscript, template, head, [aria-hidden="true"], :disabled'
const MAX_CHECKED = 1500
const WAIT = 150

const hex = (rgb) => `#${rgb.map((n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')).join('')}`
const over = ([r, g, b, a], under) => under.map((u, i) => [r, g, b][i] * a + u * (1 - a))
const hasGradient = (cs) => cs.backgroundImage && cs.backgroundImage !== 'none' && /gradient/.test(cs.backgroundImage)

/** Elements that hold words of their own, and icons drawn in the text colour. */
function holders() {
  const out = []
  const seen = new Set()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  })
  for (let n = walker.nextNode(); n && out.length < MAX_CHECKED; n = walker.nextNode()) {
    const el = n.parentElement
    if (!el || seen.has(el)) continue
    seen.add(el)
    out.push(el)
  }
  for (const svg of document.querySelectorAll('svg')) {
    if (out.length >= MAX_CHECKED) break
    const cs = getComputedStyle(svg)
    const drawn = [cs.fill, cs.stroke].some((v) => v && v !== 'none')
    if (drawn && !seen.has(svg)) out.push(svg)
  }
  return out.filter((el) => {
    if (el.closest(SKIP)) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
  })
}

/**
 * The solid colours an element's text could sit on: its background with every see-through one
 * behind it laid over each other, or each colour of a gradient behind it.
 */
function backgroundsOf(el, cache) {
  if (cache.has(el)) return cache.get(el)
  const cs = getComputedStyle(el)
  let result
  if (hasGradient(cs)) {
    const stops = (cs.backgroundImage.match(COLOR_IN_GRADIENT) ?? []).map(rgbaOf).filter((c) => c[3] > 0.05)
    const under = el.parentElement ? backgroundsOf(el.parentElement, cache) : [[255, 255, 255]]
    result = stops.length ? stops.flatMap((stop) => under.map((u) => over(stop, u))) : under
  } else {
    const own = rgbaOf(cs.backgroundColor)
    if (own[3] > 0.99) result = [own.slice(0, 3)]
    else {
      const under = el.parentElement && el !== document.documentElement ? backgroundsOf(el.parentElement, cache) : [[255, 255, 255]]
      result = own[3] > 0.01 ? under.map((u) => over(own, u)) : under
    }
  }
  cache.set(el, result)
  return result
}

/** How readable each element is right now: its worst ratio, what it needs, its colour and backgrounds. */
function readAll(elements) {
  const cache = new Map()
  const out = new Map()
  for (const el of elements) {
    const cs = getComputedStyle(el)
    const bgs = backgroundsOf(el, cache).slice(0, 6)
    const colour = rgbaOf(cs.color)
    if (colour[3] < 0.05) continue // text drawn some other way (a gradient fill, a clipped image)
    const texts = bgs.map((bg) => hex(over(colour, bg)))
    const ratio = Math.min(...bgs.map((bg, i) => contrastRatio(texts[i], hex(bg))))
    const size = parseFloat(cs.fontSize)
    const large = el.localName === 'svg' || size >= 24 || (size >= 18.6 && Number(cs.fontWeight) >= 700)
    out.set(el, { ratio, need: large ? 3 : 4.5, text: texts[0], bgs: bgs.map(hex) })
  }
  return out
}

/** Reads with transitions held, so colours that animate report where they're going. */
function steady(fn) {
  const freeze = document.createElement('style')
  freeze.textContent = '*,*::before,*::after{transition:none!important}'
  document.head.append(freeze)
  try {
    return fn()
  } finally {
    freeze.remove()
  }
}

/**
 * The colour a hard-to-read element should take. Its own colour first, made lighter or darker
 * until it reads, so a green "Paid" stays green and a red "Failed" red; else the theme's nearest
 * colour that reads, else the strongest.
 */
function fixFor({ text, bgs }, target, tokens) {
  const worstOf = (c) => Math.min(...bgs.map((bg) => contrastRatio(c, bg)))
  // Lighter or darker, whichever needs the smaller change.
  const start = lightness(text)
  const found = [-1, 1]
    .map((dir) => {
      for (let l = start; l >= 0 && l <= 1; l += dir * 0.02) if (worstOf(withLightness(text, l)) >= target) return { l, c: withLightness(text, l) }
      return null
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(a.l - start) - Math.abs(b.l - start))[0]
  if (found) return found.c
  const pool = [...new Set(['ink', 'ink-secondary', 'on-primary', 'on-secondary', 'on-accent', 'background', 'surface', 'primary', 'primary-dark'].map((k) => tokens[k]).filter(Boolean)), '#ffffff', '#000000']
  const worst = (c) => Math.min(...bgs.map((bg) => contrastRatio(c, bg)))
  const passing = pool.filter((c) => worst(c) >= target)
  if (passing.length) return passing.reduce((a, c) => (deltaE(c, text) < deltaE(a, text) ? c : a))
  return pool.reduce((a, c) => (worst(c) > worst(a) ? c : a))
}

/** Starts the guard. `check(tokens)` asks for a check soon; `stop()` takes its fixes away. */
export function createGuard() {
  const sheet = document.createElement('style')
  sheet.dataset.colorsbymax = 'guard'
  document.head.append(sheet)
  let tokens = null
  let timer = 0

  const run = () => {
    timer = 0
    if (!tokens || !document.body) return
    sheet.textContent = ''
    for (const el of document.querySelectorAll(`[${FIX}]`)) el.removeAttribute(FIX)
    const elements = holders()
    const now = steady(() => readAll(elements))
    const rules = []
    let n = 0
    for (const [el, reading] of now) {
      const target = reading.need
      if (reading.ratio >= target - 0.05) continue
      const id = `g${(n++).toString(36)}`
      el.setAttribute(FIX, id)
      const colour = fixFor(reading, target, tokens)
      rules.push(`[${FIX}="${id}"]{color:${colour}!important${el.localName === 'svg' ? `;fill:${getComputedStyle(el).fill === 'none' ? 'none' : colour}!important` : ''}}`)
    }
    sheet.textContent = rules.join('')
  }
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(run, { timeout: 300 }) : run()), WAIT)
  }

  // New content is checked as it appears, and so is a part of the page that sets colour variables
  // of its own (a theme preview, say). Other class and style changes (scroll effects) aren't.
  const isOurs = (node) => node.closest?.('colorsbymax-root, [data-colorsbymax]')
  const observer = new MutationObserver((records) => {
    const colourVars = (style) => (style ?? '').includes('--color-')
    const matters = records.some((r) => {
      if (r.type === 'childList') return [...r.addedNodes].some((node) => node.nodeType === 1 && !isOurs(node))
      const style = r.target.getAttribute('style')
      return style !== r.oldValue && (colourVars(style) || colourVars(r.oldValue))
    })
    if (matters) schedule()
  })
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'], attributeOldValue: true })
  window.addEventListener('load', schedule)

  return {
    /** Checks the page soon against these colours (the ones the page now shows). */
    check(next) {
      tokens = next
      schedule()
    },
    stop() {
      clearTimeout(timer)
      observer.disconnect()
      window.removeEventListener('load', schedule)
      sheet.remove()
      for (const el of document.querySelectorAll(`[${FIX}]`)) el.removeAttribute(FIX)
    },
  }
}
