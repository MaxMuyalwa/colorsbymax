// Type declarations for 'colorsbymax/auto'. Importing the module mounts the colour button by
// itself once the page has rendered: `import 'colorsbymax/auto'`.

import type { ColorsByMaxConfig } from './index.js'

/**
 * Mounts the colour button and panel with settings, instead of the automatic mount. Calling it
 * again replaces the previous mount. Returns a function that removes it.
 */
export function autoMount(config?: ColorsByMaxConfig): () => void
