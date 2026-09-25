// One-line setup: `import 'colorsbymax/auto'` anywhere in a site's code (for example main.jsx)
// puts the colour button on the page, with no wrapping and no config. Sites that don't paint
// with the --color-* variables are re-coloured automatically.
//
// For settings, call autoMount instead; the automatic mount then steps aside:
//
//   import { autoMount } from 'colorsbymax/auto'
//   autoMount({ siteName: 'My site' })

import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './ThemeProvider.jsx'
import ThemeSwitcher from './ThemeSwitcher.jsx'

let root = null
let container = null
let pending = null

/**
 * Mounts the colour button and panel on its own, outside the site's app. Calling it again
 * replaces the previous mount with the new config. Returns a function that removes it.
 * @param {import('./ThemeProvider.jsx').ColorsByMaxConfig} [config]
 */
export function autoMount(config = {}) {
  cancelPending()
  unmount()
  container = document.createElement('div')
  container.dataset.colorsbymax = 'auto'
  document.body.append(container)
  root = createRoot(container)
  root.render(createElement(ThemeProvider, { config }, createElement(ThemeSwitcher)))
  return unmount
}

function unmount() {
  root?.unmount()
  container?.remove()
  root = container = null
}

function cancelPending() {
  if (pending) pending()
  pending = null
}

// Mount automatically shortly after the page has loaded, once a single-page app's first render
// is in, so the re-colouring engine sees the site's content. A timer rather than animation
// frames, which browsers pause in background tabs. A call to autoMount before then takes over.
const MOUNT_DELAY = 50
if (typeof window !== 'undefined') {
  let timer = 0
  const onLoad = () => {
    timer = setTimeout(() => {
      if (!root) autoMount()
    }, MOUNT_DELAY)
  }
  pending = () => {
    clearTimeout(timer)
    window.removeEventListener('load', onLoad)
  }
  if (document.readyState === 'complete') onLoad()
  else window.addEventListener('load', onLoad)
}
