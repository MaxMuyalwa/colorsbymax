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

export default defineConfig({
  root: demo,
  plugins: [panelCss(), react(), tailwindcss()],
  server: { port: Number(process.env.PORT) || 5174 },
  build: {
    // PDF.js's reader is ~1.2 MB but loads only when someone uploads a PDF.
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      input: { main: `${demo}/index.html`, plain: `${demo}/plain.html`, unwired: `${demo}/unwired.html` },
    },
  },
})
