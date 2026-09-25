import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Builds the package itself into dist/: plain JavaScript (JSX compiled away), so any bundler
// can use it without extra setup. Three entries: the main one, 'colorsbymax/auto' (the one-line
// setup) and 'colorsbymax/pdf' for sites that opt in to PDF uploads. React and PDF.js stay
// external, so the site's own copies are used.
//
// dist/ is committed, so installs straight from GitHub work even when npm skips install
// scripts. Rebuild it before committing changes to src/.
//
//   npm run build
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: {
        index: fileURLToPath(new URL('./src/index.js', import.meta.url)),
        auto: fileURLToPath(new URL('./src/auto.js', import.meta.url)),
        pdf: fileURLToPath(new URL('./src/pdf.js', import.meta.url)),
      },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
    },
    rollupOptions: {
      external: [/^react($|\/)/, /^react-dom($|\/)/, /^pdfjs-dist($|\/)/],
    },
  },
})
