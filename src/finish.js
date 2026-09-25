// Finishing with colorsbymax: code and AI-editor prompts that keep the chosen colours for every
// visitor, bring the switcher back, or remove colorsbymax. Shared by the panel's "I'm done" view
// and the colorsbymax MCP server.

import { TOKEN_KEYS } from './tokens.js'

/** The production check for Vite projects; other bundlers use NODE_ENV. */
export const VITE_PROD = 'import.meta.env.PROD'
export const NODE_PROD = "process.env.NODE_ENV === 'production'"

const tokenLines = (tokens, indent) => TOKEN_KEYS.map((k) => `${indent}'${k}': '${tokens[k]}',`).join('\n')

/**
 * Code that makes the chosen colours the site's default and hides the switcher in production.
 * @param {'auto' | 'provider'} kind  the one-line setup (autoMount) or ThemeProvider
 */
export function keepSnippet(kind, name, tokens, prod = VITE_PROD) {
  const theme = `defaultTheme: {\n    name: ${JSON.stringify(name)},\n    tokens: {\n${tokenLines(tokens, '      ')}\n    },\n  },\n  // Hides the colour button in production; set to false to bring it back.\n  hidden: ${prod},`
  if (kind === 'auto') {
    return `// Replace \`import 'colorsbymax/auto'\` with:\nimport { autoMount } from 'colorsbymax/auto'\n\nautoMount({\n  ${theme}\n})`
  }
  return `// Add to the config you pass to <ThemeProvider>:\n<ThemeProvider config={{\n  ...config,\n  ${theme}\n}}>`
}

/** The theme as `--color-*` variables on :root. */
export const cssSnippet = (tokens) => `:root {\n${TOKEN_KEYS.map((k) => `  --color-${k}: ${tokens[k]};`).join('\n')}\n}`

export const keepPrompt = (name, tokens) =>
  `Update my colorsbymax setup so the colours I chose become my site's default and the colour switcher is hidden in production. In the colorsbymax config (the autoMount({...}) call, or the config passed to <ThemeProvider>), set defaultTheme to { name: ${JSON.stringify(name)}, tokens: ${JSON.stringify(tokens)} } and set hidden: ${VITE_PROD} (use ${NODE_PROD} if this isn't a Vite project). If the site uses import 'colorsbymax/auto', replace it with import { autoMount } from 'colorsbymax/auto' and an autoMount({...}) call with that config. Don't change anything else.`

export const BRING_BACK_PROMPT =
  "Show the colorsbymax colour switcher again in production: in its config (the autoMount({...}) call or the config passed to <ThemeProvider>), set hidden to false or remove the hidden line. Don't change anything else."

/** @param {boolean} recolouring  true when colorsbymax was swapping the site's hard-coded colours */
export const removePrompt = (tokens, recolouring) =>
  recolouring
    ? `Remove colorsbymax from this project but keep the colours it currently shows. The site's CSS uses hard-coded colours that colorsbymax was swapping at runtime, so update the site's own CSS to use this palette instead (primary is the main brand colour, background the page, ink the text): ${JSON.stringify(tokens)}. Then uninstall the colorsbymax package and delete its import (import 'colorsbymax/auto', autoMount, ThemeProvider or ThemeSwitcher) and any colorsbymax pre-paint script in index.html.`
    : `Remove colorsbymax from this project but keep my colours: add these CSS variables to my global stylesheet, replacing any existing --color-* values: ${cssSnippet(tokens)} Then uninstall the colorsbymax package and delete its usage (ThemeProvider, ThemeSwitcher, autoMount or import 'colorsbymax/auto') and any colorsbymax pre-paint script in index.html. Keep colorsbymax/tokens.css only if nothing else needs it.`
