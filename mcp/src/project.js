// Reads a project on disk to work out how colorsbymax fits in: the framework, the package manager,
// whether colorsbymax is installed and wired up, and whether the site paints with the --color-*
// tokens or hard-coded colours. Read-only: the agent makes the edits.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { TOKEN_KEYS } from './engine.js'

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.output', '.svelte-kit', '.astro', '.vercel', '.netlify', '.turbo', '.cache', 'coverage', 'vendor', 'public', 'static'])
const SOURCE = /\.(?:[cm]?[jt]sx?|vue|svelte|astro|html?|css|scss|sass|less)$/i
const STYLE = /\.(?:css|scss|sass|less)$/i
const MAX_FILES = 2500
const MAX_BYTES = 400_000

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

const major = (range) => {
  const m = String(range ?? '').match(/(\d+)(?:\.(\d+))?/)
  return m ? Number(m[1]) : null
}

/** a < b for plain x.y.z versions. */
export const olderThan = (a, b) => {
  const pa = String(a).split('.').map(Number)
  const pb = String(b).split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0)
  return false
}

function walk(root) {
  const files = []
  const visit = (dir, depth) => {
    if (depth > 8 || files.length >= MAX_FILES) return
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (files.length >= MAX_FILES) return
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) visit(join(dir, e.name), depth + 1)
      } else if (SOURCE.test(e.name)) files.push(join(dir, e.name))
    }
  }
  visit(root, 0)
  return files
}

/** The newest colorsbymax on npm, or null when offline. */
export async function latestVersion() {
  try {
    const res = await fetch('https://registry.npmjs.org/colorsbymax/latest', { signal: AbortSignal.timeout(3000) })
    return res.ok ? (await res.json()).version : null
  } catch {
    return null
  }
}

function detectFramework(deps, root) {
  const has = (name) => name in deps
  if (has('next')) return { id: 'next', label: 'Next.js', router: existsSync(join(root, 'app')) || existsSync(join(root, 'src', 'app')) ? 'app' : 'pages' }
  if (has('@remix-run/react') || has('@react-router/dev')) return { id: 'remix', label: has('@react-router/dev') ? 'React Router (framework mode)' : 'Remix' }
  if (has('gatsby')) return { id: 'gatsby', label: 'Gatsby' }
  if (has('astro')) return { id: 'astro', label: 'Astro' }
  if (has('nuxt')) return { id: 'nuxt', label: 'Nuxt' }
  if (has('@sveltejs/kit')) return { id: 'sveltekit', label: 'SvelteKit' }
  if (has('react-scripts')) return { id: 'cra', label: 'Create React App' }
  if (has('vite')) {
    const ui = has('react') ? 'React' : has('vue') ? 'Vue' : has('svelte') ? 'Svelte' : has('solid-js') ? 'Solid' : 'plain'
    return { id: 'vite', label: `Vite (${ui})`, ui }
  }
  if (has('webpack') || has('parcel') || has('esbuild') || has('rollup')) return { id: 'bundler', label: 'a JavaScript bundler' }
  return { id: 'unknown', label: 'an unrecognised setup' }
}

const ENTRY_CANDIDATES = [
  'src/main.jsx', 'src/main.tsx', 'src/main.js', 'src/main.ts',
  'src/index.jsx', 'src/index.tsx', 'src/index.js', 'src/index.ts',
  'app/layout.tsx', 'app/layout.jsx', 'app/layout.js', 'src/app/layout.tsx', 'src/app/layout.jsx', 'src/app/layout.js',
  'pages/_app.tsx', 'pages/_app.jsx', 'pages/_app.js', 'src/pages/_app.tsx', 'src/pages/_app.jsx', 'src/pages/_app.js',
  'app/root.tsx', 'app/root.jsx', 'gatsby-browser.js', 'gatsby-browser.tsx',
  'src/layouts/Layout.astro', 'src/routes/+layout.svelte', 'app.vue', 'src/App.vue', 'index.html',
]

const USAGE = [
  { id: 'auto-import', pattern: /import\s+['"]colorsbymax\/auto['"]|import\(\s*['"]colorsbymax\/auto['"]\s*\)/, label: "import 'colorsbymax/auto'" },
  { id: 'autoMount', pattern: /\bautoMount\s*\(/, label: 'autoMount({...})' },
  { id: 'provider', pattern: /<ThemeProvider\b[^>]*config/, label: '<ThemeProvider config>' },
  { id: 'switcher', pattern: /<ThemeSwitcher\b/, label: '<ThemeSwitcher />' },
  { id: 'tokens-css', pattern: /colorsbymax\/tokens\.css/, label: 'colorsbymax/tokens.css' },
  { id: 'pre-paint', pattern: /prePaintScript|--color-'\+k/, label: 'pre-paint script' },
  { id: 'hidden', pattern: /\bhidden\s*:/, label: 'hidden: … (switcher hidden, e.g. in production)' },
  { id: 'defaultTheme', pattern: /\bdefaultTheme\s*:/, label: 'defaultTheme' },
]

const HARD_CODED = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/gi
const TAILWIND_PALETTE = /\b(?:bg|text|border|from|via|to|ring|fill|stroke|outline|decoration|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g

/**
 * Inspects the project at `dir`.
 * @returns {Promise<object>} everything the setup plan needs, with file paths relative to `dir`
 */
export async function inspectProject(dir) {
  const root = resolve(dir)
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`No folder at ${root}.`)
  const pkg = readJson(join(root, 'package.json'))
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies }
  const rel = (f) => relative(root, f).split(sep).join('/')

  const packageManager = existsSync(join(root, 'pnpm-lock.yaml')) ? 'pnpm' : existsSync(join(root, 'yarn.lock')) ? 'yarn' : existsSync(join(root, 'bun.lockb')) || existsSync(join(root, 'bun.lock')) ? 'bun' : 'npm'
  const installedPkg = readJson(join(root, 'node_modules', 'colorsbymax', 'package.json'))
  const framework = pkg ? detectFramework(deps, root) : { id: 'static', label: 'a static site (no package.json)' }

  const usage = Object.fromEntries(USAGE.map((u) => [u.id, []]))
  const tokenUses = new Map()
  const tokenDefs = new Set()
  let hardCoded = 0
  let tailwindPalette = 0
  const files = walk(root)
  for (const file of files) {
    let text
    try {
      if (statSync(file).size > MAX_BYTES) continue
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    if (text.includes('colorsbymax') || /ThemeProvider|ThemeSwitcher|autoMount/.test(text)) {
      const lines = text.split('\n')
      for (const u of USAGE) {
        const i = lines.findIndex((l) => u.pattern.test(l))
        if (i >= 0 && (u.id !== 'hidden' || text.includes('colorsbymax'))) usage[u.id].push(`${rel(file)}:${i + 1}`)
      }
    }
    for (const m of text.matchAll(/var\(\s*--color-([a-z0-9-]+)/g)) if (TOKEN_KEYS.includes(m[1])) tokenUses.set(m[1], (tokenUses.get(m[1]) ?? 0) + 1)
    for (const m of text.matchAll(/--color-([a-z0-9-]+)\s*:/g)) if (TOKEN_KEYS.includes(m[1])) tokenDefs.add(m[1])
    // Tailwind v4 token utilities (bg-primary, text-ink…) count as token use when the tokens are defined.
    for (const m of text.matchAll(/\b(?:bg|text|border|from|via|to|ring|fill|stroke)-((?:primary|on|ink|surface|background|secondary|accent|data|app|success|warning|danger|info)[a-z0-9-]*)\b/g)) {
      if (TOKEN_KEYS.includes(m[1])) tokenUses.set(m[1], (tokenUses.get(m[1]) ?? 0) + 1)
    }
    if (STYLE.test(file) || /style=|className=|class=/.test(text)) hardCoded += (text.match(HARD_CODED) ?? []).length
    tailwindPalette += (text.match(TAILWIND_PALETTE) ?? []).length
  }

  const entries = ENTRY_CANDIDATES.filter((f) => existsSync(join(root, f)))
  const wired = usage['auto-import'].length || usage.autoMount.length || usage.provider.length
  const tokensUsed = [...tokenUses.keys()].filter((k) => tokenDefs.has(k) || usage['tokens-css'].length)
  return {
    root,
    name: pkg?.name ?? null,
    framework,
    packageManager,
    react: deps.react ? { declared: deps.react, major: major(deps.react), reactDom: deps['react-dom'] ?? null } : null,
    tailwind: deps.tailwindcss ? { declared: deps.tailwindcss, major: major(deps.tailwindcss) } : null,
    typescript: 'typescript' in deps,
    colorsbymax: {
      declared: deps.colorsbymax ?? null,
      installed: installedPkg?.version ?? null,
      latest: await latestVersion(),
      wired: Boolean(wired),
      usage: Object.fromEntries(Object.entries(usage).filter(([, v]) => v.length)),
    },
    colours: {
      mode: tokensUsed.length >= 3 ? 'tokens' : 'recolour',
      tokensDefined: [...tokenDefs],
      tokensUsed,
      hardCodedColours: hardCoded,
      tailwindPaletteClasses: tailwindPalette,
    },
    entryFiles: entries,
    filesScanned: files.length,
  }
}
