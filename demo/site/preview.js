// This page embedded in itself (?preview=…): the real site in use, in the visitor's current theme,
// scrolled to a section, for the landing page's live pictures of it:
//
//   desktop, phone                 the hero's window and phone, the panel open on desktop
//   subtle, balanced, colourful    the "Colour styles" section: the page in each colour style
//   studio                         the "Studio" section: Studio picking a card and colouring it
//
// Each keeps its own copy of the visitor's colorsbymax state, so what happens in here never changes
// their real one, and the copies never change each other.

import { inScope, normalPath } from '../../src/scope.js'

/** The kind of preview, or null when this is the page itself. */
export const PREVIEW = new URLSearchParams(location.search).get('preview')
const STYLE_KINDS = ['subtle', 'balanced', 'colourful']

const FROM = 'colorsbymax-demo'
const TO = `colorsbymax-preview-${PREVIEW}`
// With the site's own colours on, Subtle and Balanced look the same (both are the site as
// designed), so the colour style pictures show one of Max's picks instead.
const SHOWCASE_THEME = 'sunset'

/** The site's config for the embedded copy: the visitor's saved state under its own key. */
export function previewConfig(config) {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key.startsWith(`${FROM}:`) || key === FROM) localStorage.setItem(TO + key.slice(FROM.length), localStorage.getItem(key))
    }
    // The copy is the page it sits in, whatever its address: coloured exactly when that page is
    // (Studio's "only some pages"), with that page's Studio changes.
    const state = JSON.parse(localStorage.getItem(TO) || 'null')
    if (state) {
      const page = normalPath(window.parent.location.pathname) ?? '/'
      const here = normalPath(location.pathname) ?? '/'
      const coloured = inScope(state.where ?? state.scope, page)
      state.scope = coloured ? null : { mode: 'pages', pages: [] }
      state.where = coloured ? null : state.scope
      state.paints = (state.paints ?? []).filter((p) => p.everywhere || p.page === page).map((p) => (p.everywhere ? p : { ...p, page: here }))
      state.paintCss = state.paintCss ? { ...(state.paintCss['*'] ? { '*': state.paintCss['*'] } : {}), ...(state.paintCss[page] ? { [here]: state.paintCss[page] } : {}) } : null
      if (STYLE_KINDS.includes(PREVIEW) && /^site-default(~dark)?$/.test(state.activeId) && !Object.keys(state.overrides ?? {}).length) state.activeId = SHOWCASE_THEME
      // Studio's picture starts clean, then makes one change of its own.
      if (PREVIEW === 'studio') {
        state.paints = []
        state.paintCss = null
      }
      localStorage.setItem(TO, JSON.stringify(state))
    }
    // The colour button in its usual corner, and a roomier panel (as if dragged wider) so its
    // header and theme cards read well when scaled down. The colour style pictures show the page
    // alone, in their own style.
    localStorage.removeItem(`${TO}:button`)
    const key = `${TO}:settings`
    const settings = JSON.parse(localStorage.getItem(key) || '{}')
    const style = STYLE_KINDS.includes(PREVIEW) ? { colourStyle: PREVIEW, hideButton: true } : { hideButton: false }
    localStorage.setItem(key, JSON.stringify({ ...settings, panelWidth: 580, panelHeight: null, libraryCollapsed: false, ...style }))
  } catch {
    // Storage blocked: the copy starts from the default theme.
  }
  return { ...config, storageKey: TO, intro: false, updates: false }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const until = async (find, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    const found = find()
    if (found) return found
    await wait(100)
  }
  return null
}

/** Frames the page: no nav bar, scrolled to the "Why" section, and whatever the kind shows. */
export async function setUpPreview() {
  document.documentElement.style.scrollBehavior = 'auto'
  document.documentElement.style.overflow = 'hidden'
  await wait(300)
  document.querySelector('nav[aria-label=Main]')?.parentElement.style.setProperty('display', 'none')
  document.querySelectorAll('.reveal').forEach((e) => e.classList.add('is-visible'))
  const why = document.getElementById('why')
  // Only the "Why" section: what follows keeps its place, so the scroll stays put, but is blank.
  for (let el = why.nextElementSibling; el; el = el.nextElementSibling) el.style.visibility = 'hidden'
  document.querySelector('footer')?.style.setProperty('visibility', 'hidden')
  const root = document.querySelector('colorsbymax-root')?.shadowRoot
  const button = () => root?.querySelector('button[aria-label^="colorsbymax theme settings"]')

  if (PREVIEW === 'phone') {
    // The phone shows the page on its own, from the "colorsbymax way" card.
    const title = [...why.querySelectorAll('h3')].find((h) => h.textContent.startsWith('The research'))
    const card = title?.closest('.bg-primary') ?? why
    window.scrollTo(0, card.getBoundingClientRect().top + scrollY - 70)
  } else if (STYLE_KINDS.includes(PREVIEW)) {
    // The section's heading and its cards, in this colour style (the button is hidden).
    window.scrollTo(0, why.getBoundingClientRect().top + scrollY + 40)
    await wait(600) // the guard's check, once the colours are on
  } else if (PREVIEW === 'studio') {
    window.scrollTo(0, why.getBoundingClientRect().top + scrollY + 40)
    if (root && (await until(button))) {
      button().click()
      ;(await until(() => root.querySelector('[aria-label="Studio"]')))?.click()
      ;(await until(() => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Point and click')))?.click()
      await wait(300)
      // Pick the second card, and give it the theme's brand colour as its background.
      const title = [...why.querySelectorAll('h3')][1]
      const card = title?.closest('.rounded-3xl') ?? title
      card?.click()
      const group = await until(() => [...root.querySelectorAll('[role=group]')].find((g) => g.textContent.startsWith('Background')))
      ;(group?.querySelector('button[aria-label^="Primary ("]') ?? group?.querySelector('button[aria-label]'))?.click()
      await wait(600)
      root.activeElement?.blur()
    }
  } else {
    window.scrollTo(0, why.getBoundingClientRect().top + scrollY + 265)
    const open = () => root?.querySelector('[role=radio]')
    await until(button)
    if (root && !open()) button()?.click()
    // Unfold "Preset themes" (sections start folded), then show a library mood's theme cards,
    // with their swatches, from its row of moods down.
    const presets = (await until(() => [...(root?.querySelectorAll('summary') ?? [])].find((s) => s.textContent.startsWith('Preset themes'))))?.parentElement
    if (presets) presets.open = true
    const find = () => [...root.querySelectorAll('button')].find((b) => /^Winter\d/.test(b.textContent.trim()))
    const mood = root && (await until(find))
    if (mood) {
      mood.click()
      await wait(400)
      // The real panel starts folded; this showcase keeps its themes open.
      if (presets) presets.open = true
      const scroller = root.querySelector('.theme-scroll')
      scroller.style.scrollBehavior = 'auto'
      for (let i = 0; i < 3; i++, await wait(150)) scroller.scrollTop += find().getBoundingClientRect().top - scroller.getBoundingClientRect().top - 84 // under the panel's pinned header
      root.activeElement?.blur()
    }
  }
  await wait(400)
  window.parent.postMessage({ colorsbymaxPreview: 'ready' }, location.origin)
}
