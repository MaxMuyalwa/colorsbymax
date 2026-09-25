// A light and dark switch for the site itself. Any element with data-colorsbymax-mode works (the
// theme provider wires it); these are a ready-made one to paste in, a prompt for an AI editor, and
// a preview that puts one in the page's top bar until the next reload.

const SUN = '<svg class="cbm-mode-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>'
const MOON = '<svg class="cbm-mode-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>'

/** The switch's markup: a sun in light mode, a moon in dark. */
export const TOGGLE_HTML = `<button type="button" class="cbm-mode-toggle" data-colorsbymax-mode="toggle" aria-label="Switch between light and dark mode">
  ${SUN}
  ${MOON}
</button>`

/** Its styles. It takes the colour of the text around it, so it suits any top bar. */
export const TOGGLE_CSS = `.cbm-mode-toggle {
  display: inline-grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid currentColor;
  border-radius: 9999px;
  background: transparent;
  color: inherit;
  opacity: 0.85;
  cursor: pointer;
}
.cbm-mode-toggle:hover { opacity: 1; }
.cbm-mode-toggle .cbm-mode-moon,
html[data-colorsbymax-scheme="dark"] .cbm-mode-toggle .cbm-mode-sun { display: none; }
html[data-colorsbymax-scheme="dark"] .cbm-mode-toggle .cbm-mode-moon { display: block; }`

/** The same switch as a React component. */
export const TOGGLE_REACT = `// ModeToggle.jsx: put <ModeToggle /> in your top bar. colorsbymax makes it work.
export function ModeToggle() {
  return (
    <button type="button" className="cbm-mode-toggle" data-colorsbymax-mode="toggle" aria-label="Switch between light and dark mode">
      <svg className="cbm-mode-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
      <svg className="cbm-mode-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    </button>
  )
}`

/** A prompt for Claude, Cursor or Copilot that adds the switch to the site's top bar. */
export const TOGGLE_PROMPT = `Add a light and dark mode switch to my site's top navigation bar, next to its other links or buttons. The site uses colorsbymax, which makes the switch work: any element with data-colorsbymax-mode="toggle" switches the whole site between light and dark and remembers the visitor's choice. Use this button (as a React component if the nav is React):

${TOGGLE_HTML}

and add these styles to the global stylesheet, adjusting size and spacing to match the nav:

${TOGGLE_CSS}

Don't change anything else.`

const PREVIEW = 'data-colorsbymax-preview'

/** Where a switch would go: the page's top bar, or null if it has none. */
function topBar() {
  // In order of preference: a nav bar (so the switch sits beside its links) before the header
  // around it.
  for (const selector of ['header nav', 'nav', '[role="navigation"]', 'header', '[role="banner"]']) {
    for (const el of document.querySelectorAll(selector)) {
      if (el.closest('colorsbymax-root')) continue
      const r = el.getBoundingClientRect()
      if (r.width > 200 && r.height > 12 && r.top < window.innerHeight / 2) return el
    }
  }
  return null
}

/** Whether a preview switch is on the page. */
export const isPreviewing = () => Boolean(document.querySelector(`[${PREVIEW}]`))

/**
 * Puts a switch in the page's top bar (or the top-left corner if it has none) until the next
 * reload. Returns where it went: 'nav' or 'corner'.
 */
export function previewToggle() {
  removePreview()
  const style = document.createElement('style')
  style.setAttribute(PREVIEW, '')
  style.textContent = TOGGLE_CSS
  document.head.append(style)
  const holder = document.createElement('span')
  holder.innerHTML = TOGGLE_HTML
  const button = holder.firstElementChild
  button.setAttribute(PREVIEW, '')
  button.setAttribute('aria-pressed', String(document.documentElement.dataset.colorsbymaxScheme === 'dark'))
  const bar = topBar()
  if (bar) {
    button.style.marginInline = '0.5rem'
    bar.append(button)
  } else {
    Object.assign(button.style, { position: 'fixed', top: '16px', left: '16px', zIndex: '59', background: 'Canvas' })
    document.body.append(button)
  }
  button.animate?.([{ transform: 'scale(0.4)', opacity: 0 }, { transform: 'scale(1.15)' }, { transform: 'scale(1)', opacity: 1 }], { duration: 450, easing: 'ease-out' })
  return bar ? 'nav' : 'corner'
}

export function removePreview() {
  for (const el of document.querySelectorAll(`[${PREVIEW}]`)) el.remove()
}
