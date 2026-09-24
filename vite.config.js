import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Serves the demo site in ./demo, which uses the package straight from ./src.
// The root is absolute so the demo also runs when launched from another folder.
export default defineConfig({
  root: fileURLToPath(new URL('./demo', import.meta.url)),
  plugins: [react(), tailwindcss()],
  server: { port: Number(process.env.PORT) || 5174 },
})
