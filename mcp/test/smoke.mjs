// Starts the built server over stdio, as an MCP client would, and calls every tool against small
// throwaway projects. Exits non-zero on the first failure.
//
//   node test/smoke.mjs          (after npm run build)
//   node test/smoke.mjs --show   (also prints each result)

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const show = process.argv.includes('--show')
// CBM_MCP_SERVER tests another copy, such as an installed package.
const server = process.env.CBM_MCP_SERVER ?? fileURLToPath(new URL('../dist/server.js', import.meta.url))

// Throwaway projects: a Vite React app with hard-coded colours, a Next.js app on tokens, a static site.
const tmp = mkdtempSync(join(tmpdir(), 'cbm-mcp-'))
const project = (name, files) => {
  const dir = join(tmp, name)
  for (const [file, body] of Object.entries(files)) {
    mkdirSync(join(dir, file, '..'), { recursive: true })
    writeFileSync(join(dir, file), typeof body === 'string' ? body : JSON.stringify(body))
  }
  return dir
}
const vite = project('vite-app', {
  'package.json': { name: 'coffee', dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' }, devDependencies: { vite: '^8.0.0' } },
  'src/main.jsx': "import { createRoot } from 'react-dom/client'\n",
  'src/app.css': '.hero { background: #1d3557; color: #f1faee } .btn { background: rgb(230, 57, 70) }',
})
const next = project('next-app', {
  'package.json': { name: 'shop', dependencies: { next: '15.0.0', react: '19.0.0', 'react-dom': '19.0.0' }, devDependencies: { typescript: '^5', tailwindcss: '^4.1.0' } },
  'app/layout.tsx': 'export default function RootLayout({ children }) { return <html><body>{children}</body></html> }\n',
  'app/globals.css': '@import "tailwindcss";\n@import "colorsbymax/tokens.css";\n@theme static { --color-primary: #0d6b84; --color-ink: #10222a; }\n',
  'app/page.tsx': 'export default () => <main className="bg-background text-ink"><a className="bg-primary text-on-primary">Buy</a></main>\n',
})
const wired = project('wired-app', {
  'package.json': { name: 'wired', dependencies: { colorsbymax: '^0.1.0', react: '^18.2.0', 'react-dom': '^18.2.0' }, devDependencies: { vite: '^6' } },
  'node_modules/colorsbymax/package.json': { name: 'colorsbymax', version: '0.1.0' },
  'src/main.jsx': "import 'colorsbymax/auto'\n",
})
const plain = project('static-site', { 'index.html': '<!doctype html><title>Hi</title><body style="background:#fff8e7">Hello</body>' })

const client = new Client({ name: 'colorsbymax-smoke', version: '1.0.0' })
await client.connect(new StdioClientTransport({ command: process.execPath, args: [server] }))

let failures = 0
async function call(name, args, expect) {
  const res = await client.callTool({ name, arguments: args })
  const body = res.content.map((c) => c.text).join('\n')
  const missing = expect.filter((e) => !(e instanceof RegExp ? e.test(body) : body.includes(e)))
  const wantError = expect.includes('ERROR')
  const ok = (wantError ? res.isError : !res.isError) && missing.filter((e) => e !== 'ERROR').length === 0
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${JSON.stringify(args).slice(0, 90)}${ok ? '' : `\n     missing: ${missing.join(' | ')}\n${body.slice(0, 1500)}`}`)
  if (show) console.log(body, '\n')
  return body
}

try {
  const { tools } = await client.listTools()
  const names = tools.map((t) => t.name).sort().join(', ')
  const expected = 'check_contrast, docs, find_themes, finish, get_theme, setup_plan, theme_from_colours'
  console.log(`${names === expected ? 'ok  ' : 'FAIL'} tools: ${names}`)
  if (names !== expected) failures++
  const { prompts } = await client.listPrompts()
  console.log(`${prompts.length === 2 ? 'ok  ' : 'FAIL'} prompts: ${prompts.map((p) => p.name).join(', ')}`)
  if (!client.getInstructions()?.includes('setup_plan')) (failures++, console.log('FAIL instructions'))

  await call('setup_plan', { path: vite }, ['npm install colorsbymax', "import 'colorsbymax/auto'", 'src/main.jsx', 're-coloured automatically', /"hardCodedColours": 3/])
  await call('setup_plan', { path: next, siteName: 'Shop' }, ["'use client'", 'app/colorsbymax.tsx', "autoMount({", 'siteName: "Shop"', 'themes apply to your tokens', 'Next.js'])
  await call('setup_plan', { path: wired }, ['already set up', 'src/main.jsx:1', 'colorsbymax@latest'])
  await call('setup_plan', { path: plain }, ['esm.sh/colorsbymax/auto', 'static site'])
  await call('setup_plan', { path: join(tmp, 'nope') }, ['ERROR', 'No folder'])

  await call('find_themes', { query: 'ocean' }, ['"id": "ocean"'])
  await call('find_themes', { category: 'pastel', limit: 3 }, ['showing 3'])
  await call('find_themes', { near: '#e63946', limit: 2, mode: 'dark' }, ['"dark": true'])
  await call('find_themes', { near: 'teal-ish' }, ['ERROR', "isn't a colour"])

  await call('get_theme', { id: 'ocean' }, ['"name": "Ocean"', '"primary": "#', '"passing"'])
  await call('get_theme', { id: 'ocean~dark', format: 'css' }, ['--color-background: #', 'dark'])
  await call('get_theme', { id: 'lib-1', format: 'tailwind' }, ['@theme static', 'colorsbymax/tokens.css'])
  await call('get_theme', { id: 'nope' }, ['ERROR'])

  await call('theme_from_colours', { colours: ['#e63946', '#1d3557', '#f1faee'], name: 'Harbour', withDark: true }, ['# Harbour', '# Harbour (dark)', '"background": "#f1faee"', '"passing": 38'])
  await call('theme_from_colours', { colours: ['red'] }, ['ERROR', 'Not colours'])

  await call('check_contrast', { pairs: [{ foreground: '#777777', background: '#ffffff' }] }, ['"ratio": "4.4:1"', '"text": "fail"', '"largeText": "pass (AA)"'])
  await call('check_contrast', { tokens: { primary: '#ffe066', 'on-primary': '#ffffff', nonsense: '#000' } }, ['Button text on primary', 'suggestedFixes', 'nonsense'])

  await call('finish', { action: 'keep', themeId: 'forest' }, ["autoMount({", 'hidden: import.meta.env.PROD', "'primary': '#"])
  await call('finish', { action: 'keep', tokens: { primary: '#0d6b84' }, name: 'Mine', setup: 'provider', bundler: 'other' }, ['<ThemeProvider', "process.env.NODE_ENV === 'production'", '"Mine"'])
  await call('finish', { action: 'remove', themeId: 'rose', recolouring: true }, ['npm uninstall colorsbymax', 'hard-coded colours'])
  await call('finish', { action: 'remove', themeId: 'rose' }, [':root {', '--color-primary'])
  await call('finish', { action: 'bring-back' }, ['hidden: false'])
  await call('finish', { action: 'hide-locally' }, ['Alt+Shift+C'])
  await call('finish', { action: 'keep' }, ['ERROR'])

  await call('docs', { topic: 'quick-start' }, ["import 'colorsbymax/auto'"])
  await call('docs', { topic: 'tokens' }, ['`on-primary`', '## Status'])
  await call('docs', { topic: 'api' }, ['ColorsByMaxConfig'])
  await call('docs', { topic: 'finish' }, ['hide it in production'])
  await call('docs', { topic: 'agents' }, ['grok mcp add', 'Google Antigravity', 'context_servers', 'copilot mcp add'])
  await call('docs', { topic: 'overview' }, ['At a glance', 'A floating theme switcher', /^(?![\s\S]*<img)/])

  const prompt = await client.getPrompt({ name: 'add-colorsbymax', arguments: {} })
  console.log(`${prompt.messages[0].content.text.includes('setup_plan') ? 'ok  ' : 'FAIL'} prompt add-colorsbymax`)
} finally {
  await client.close()
  rmSync(tmp, { recursive: true, force: true })
}
if (failures) {
  console.log(`\n${failures} failed`)
  process.exit(1)
}
console.log('\nAll passed')
