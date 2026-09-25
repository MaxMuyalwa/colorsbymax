import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { buildPanelCss } from './scripts/build-css.mjs'

// Serves the demo sites in ./demo, which use the package straight from ./src.
// The root is absolute so the demo also runs when launched from another folder.
const demo = fileURLToPath(new URL('./demo', import.meta.url))

// Keeps src/panel-css.generated.js in step with the panel while developing.
const PANEL_SOURCES = /[\\/]src[\\/](ThemePanel\.jsx|ThemeSwitcher\.jsx|AuditLayer\.jsx|panel\.css)$/
function panelCss() {
  return {
    name: 'colorsbymax-panel-css',
    buildStart: () => void buildPanelCss(),
    configureServer(server) {
      // Nothing imports panel.css, so Vite wouldn't otherwise watch it.
      server.watcher.add(fileURLToPath(new URL('./src/panel.css', import.meta.url)))
      server.watcher.on('change', (file) => {
        if (PANEL_SOURCES.test(file)) buildPanelCss()
      })
    },
  }
}

// `vite build --mode site` builds the demo for mrmaxdesigns.com/colorsbymax: every URL starts
// with /colorsbymax/ and the files land in demo/dist/colorsbymax/, the layout the Vercel project
// (vercel.json) serves and the portfolio forwards to.
export const SITE_BASE = '/colorsbymax/'

export default defineConfig(({ mode }) => ({
  root: demo,
  base: mode === 'site' ? SITE_BASE : '/',
  plugins: [panelCss(), react(), tailwindcss()],
  server: { port: Number(process.env.PORT) || 5174 },
  build: {
    outDir: mode === 'site' ? `${demo}/dist${SITE_BASE}` : `${demo}/dist`,
    emptyOutDir: true,
    // PDF.js's reader is ~1.2 MB but loads only when someone uploads a PDF.
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      input: { main: `${demo}/index.html`, support: `${demo}/support.html` },
    },
  },
}))
