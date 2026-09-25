// Builds the MCP server into one Node file, bundling colorsbymax's colour engine from ../src.
// The MCP SDK and zod stay as the package's dependencies.
//
//   npm run build:mcp   (from the repo root)

import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  logLevel: 'warn',
  build: {
    ssr: 'src/server.js',
    outDir: 'dist',
    emptyOutDir: true,
    target: 'node18',
    minify: false,
    rollupOptions: {
      external: [/^@modelcontextprotocol\/sdk/, 'zod', /^node:/],
      output: { entryFileNames: 'server.js', banner: '#!/usr/bin/env node' },
    },
  },
})
