import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Builds the package itself into dist/: plain JavaScript (JSX compiled away), so any bundler
// can use it without extra setup. React, the icons and PDF.js stay external: the site's own
// copies are used, and PDF.js still loads only when someone uploads a PDF.
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
      entry: fileURLToPath(new URL('./src/index.js', import.meta.url)),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [/^react($|\/)/, /^react-dom($|\/)/, 'lucide-react', /^pdfjs-dist($|\/)/],
    },
  },
})
