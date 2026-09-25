// This page embedded in its own hero (?preview=desktop or ?preview=phone): the real site in use,
// in the visitor's current theme, scrolled to a section, with the colour panel open on desktop.
// It keeps its own copy of the visitor's colorsbymax state, so opening the panel or browsing
// themes in here never changes their real one.

/** 'desktop', 'phone', or null when this is the page itself. */
export const PREVIEW = new URLSearchParams(location.search).get('preview')

const FROM = 'colorsbymax-demo'
const TO = 'colorsbymax-preview'

/** The site's config for the embedded copy: the visitor's saved state under its own key. */
export function previewConfig(config) {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key.startsWith(FROM)) localStorage.setItem(TO + key.slice(FROM.length), localStorage.getItem(key))
    }
    // The colour button in its usual corner, and a roomier panel (as if dragged wider) so its
    // header and theme cards read well when scaled down.
    localStorage.removeItem(`${TO}:button`)
    const key = `${TO}:settings`
    const settings = JSON.parse(localStorage.getItem(key) || '{}')
    localStorage.setItem(key, JSON.stringify({ ...settings, panelWidth: 580, panelHeight: null, libraryCollapsed: false, hideButton: false }))
  } catch {
    // Storage blocked: the copy starts from the default theme.
  }
  return { ...config, storageKey: TO, intro: false }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** Frames the page: no nav bar, scrolled to the "Why" section, the panel open on its themes. */
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
  if (PREVIEW === 'phone') {
    // The phone shows the page on its own, from the "colorsbymax way" card.
    const title = [...why.querySelectorAll('h3')].find((h) => h.textContent.startsWith('The research'))
    const card = title?.closest('.bg-primary') ?? why
    window.scrollTo(0, card.getBoundingClientRect().top + scrollY - 70)
  } else {
    window.scrollTo(0, why.getBoundingClientRect().top + scrollY + 265)
    const root = document.querySelector('colorsbymax-root')?.shadowRoot
    const open = () => root?.querySelector('[role=radio]')
    const toggle = () => root?.querySelector('button[aria-label="colorsbymax theme settings"]')
    for (let i = 0; i < 30 && root && !toggle(); i++) await wait(100)
    if (root && !open()) toggle()?.click()
    // Show a library mood's theme cards, with their swatches, from its row of moods down.
    const find = () => [...root.querySelectorAll('button')].find((b) => /^Winter\d/.test(b.textContent.trim()))
    for (let i = 0; i < 30 && root && !find(); i++) await wait(100)
    const mood = root && find()
    if (mood) {
      mood.click()
      await wait(400)
      const scroller = root.querySelector('.theme-scroll')
      scroller.style.scrollBehavior = 'auto'
      for (let i = 0; i < 3; i++, await wait(150)) scroller.scrollTop += find().getBoundingClientRect().top - scroller.getBoundingClientRect().top - 84 // under the panel's pinned header
      root.activeElement?.blur()
    }
  }
  await wait(400)
  window.parent.postMessage({ colorsbymaxPreview: 'ready' }, location.origin)
}
