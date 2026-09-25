// Turns a project inspection into setup steps for the agent: what to install, which file to edit
// and with what code, how the site's colours will be themed, and how to check it worked.

import { prePaintScript } from '../../src/storage.js'
import { olderThan } from './project.js'

const INSTALL = { npm: 'npm install', pnpm: 'pnpm add', yarn: 'yarn add', bun: 'bun add' }

/** The autoMount config as source, or null when nothing needs setting. */
function configSource({ siteName, storageKey, position }) {
  const lines = []
  if (siteName) lines.push(`siteName: ${JSON.stringify(siteName)}`)
  if (storageKey) lines.push(`storageKey: ${JSON.stringify(storageKey)}`)
  if (position) lines.push(`position: ${JSON.stringify(position)}`)
  return lines.length ? `{\n  ${lines.join(',\n  ')},\n}` : null
}

/** How to load colorsbymax from a module the bundler builds (static import). */
const staticImport = (config) => (config ? `import { autoMount } from 'colorsbymax/auto'\n\nautoMount(${config})` : `import 'colorsbymax/auto'`)
/** How to load it in the browser only, for frameworks that also render on the server. */
const browserImport = (config, indent = '') =>
  (config ? `import('colorsbymax/auto').then(({ autoMount }) =>\n  autoMount(${config.replace(/\n/g, '\n  ')}),\n)` : `import('colorsbymax/auto')`).replace(/\n/g, `\n${indent}`)

function wiringStep(info, config) {
  const fw = info.framework
  const ts = info.typescript
  const entry = (patterns) => info.entryFiles.find((f) => patterns.some((p) => f.startsWith(p)))
  switch (fw.id) {
    case 'next': {
      if (fw.router === 'app') {
        const layout = entry(['app/layout', 'src/app/layout']) ?? 'app/layout.tsx'
        const dir = layout.replace(/layout\.[jt]sx?$/, '')
        const file = `${dir}colorsbymax.${ts ? 'tsx' : 'jsx'}`
        return {
          title: 'Add the colour button (Next.js app router)',
          detail: `Create ${file}, a client component that loads colorsbymax in the browser only, then render <ColorsByMax /> inside <body> in ${layout}.`,
          files: [
            { file, action: 'create', code: `'use client'\n\nimport { useEffect } from 'react'\n\nexport default function ColorsByMax() {\n  useEffect(() => {\n    ${browserImport(config, '    ')}\n  }, [])\n  return null\n}\n` },
            { file: layout, action: 'edit', code: `import ColorsByMax from './colorsbymax'\n\n// …inside <body>, after {children}:\n<ColorsByMax />` },
          ],
        }
      }
      const app = entry(['pages/_app', 'src/pages/_app']) ?? 'pages/_app.js'
      return {
        title: 'Add the colour button (Next.js pages router)',
        detail: `In ${app}, load colorsbymax in the browser once, from a useEffect in the App component.`,
        files: [{ file: app, action: 'edit', code: `import { useEffect } from 'react'\n\n// …inside App, before the return:\nuseEffect(() => {\n  ${browserImport(config, '  ')}\n}, [])` }],
      }
    }
    case 'remix': {
      const rootFile = entry(['app/root']) ?? 'app/root.tsx'
      return {
        title: `Add the colour button (${fw.label})`,
        detail: `In ${rootFile}, load colorsbymax in the browser once, from a useEffect in the App component (it renders on the server too).`,
        files: [{ file: rootFile, action: 'edit', code: `import { useEffect } from 'react'\n\n// …inside App, before the return:\nuseEffect(() => {\n  ${browserImport(config, '  ')}\n}, [])` }],
      }
    }
    case 'gatsby':
      return {
        title: 'Add the colour button (Gatsby)',
        detail: 'Gatsby runs gatsby-browser.js in the browser only, so a plain import works there.',
        files: [{ file: entry(['gatsby-browser']) ?? 'gatsby-browser.js', action: info.entryFiles.some((f) => f.startsWith('gatsby-browser')) ? 'edit' : 'create', code: staticImport(config) }],
      }
    case 'astro':
      return {
        title: 'Add the colour button (Astro)',
        detail: 'Add a script to the layout every page uses. Astro bundles it and runs it in the browser. colorsbymax needs react and react-dom installed, but no Astro React integration.',
        files: [{ file: entry(['src/layouts/']) ?? 'src/layouts/Layout.astro', action: 'edit', code: `<!-- before </body> -->\n<script>\n  ${staticImport(config).replace(/\n/g, '\n  ')}\n</script>` }],
      }
    case 'nuxt':
      return {
        title: 'Add the colour button (Nuxt)',
        detail: 'A .client plugin runs in the browser only. colorsbymax renders its own React island, so react and react-dom are installed alongside Vue.',
        files: [{ file: `plugins/colorsbymax.client.${ts ? 'ts' : 'js'}`, action: 'create', code: `export default defineNuxtPlugin(() => {\n  ${browserImport(config, '  ')}\n})\n` }],
      }
    case 'sveltekit':
      return {
        title: 'Add the colour button (SvelteKit)',
        detail: 'Load it from onMount in the root layout, so it runs in the browser only. colorsbymax renders its own React island, so react and react-dom are installed alongside Svelte.',
        files: [{ file: 'src/routes/+layout.svelte', action: info.entryFiles.includes('src/routes/+layout.svelte') ? 'edit' : 'create', code: `<script>\n  import { onMount } from 'svelte'\n  onMount(() => {\n    ${browserImport(config, '    ')}\n  })\n</script>\n\n<slot />` }],
      }
    case 'static':
      return {
        title: 'Add the colour button (static site, no bundler)',
        detail: 'Without a bundler, load colorsbymax and React from the esm.sh CDN with one module script, on every page that should have the button.',
        files: [{ file: info.entryFiles.includes('index.html') ? 'index.html' : 'each page’s .html', action: 'edit', code: `<!-- before </body> -->\n<script type="module">\n  ${(config ? `import { autoMount } from 'https://esm.sh/colorsbymax/auto'\n\nautoMount(${config})` : `import 'https://esm.sh/colorsbymax/auto'`).replace(/\n/g, '\n  ')}\n</script>` }],
      }
    default: {
      const file = entry(['src/main', 'src/index']) ?? 'your app’s entry file (for example src/main.jsx)'
      const nonReact = fw.ui && fw.ui !== 'React' && fw.ui !== 'plain'
      return {
        title: `Add the colour button (${fw.label})`,
        detail: `Add this at the top of ${file}. The button appears once the page has loaded.${nonReact ? ` colorsbymax renders its own small React island next to your ${fw.ui} app, so react and react-dom are installed alongside it.` : ''}`,
        files: [{ file, action: 'edit', code: staticImport(config) }],
      }
    }
  }
}

/**
 * @param {Awaited<ReturnType<import('./project.js').inspectProject>>} info
 * @param {{ siteName?: string, storageKey?: string, position?: string }} options
 */
export function setupPlan(info, options = {}) {
  const cbm = info.colorsbymax
  const steps = []
  const warnings = []
  const install = INSTALL[info.packageManager]
  const reactMajor = info.react?.major

  if (reactMajor !== null && reactMajor !== undefined && reactMajor < 18) {
    warnings.push(`This project uses React ${info.react.declared}. colorsbymax needs React 18 or 19, and upgrading a site's React is a bigger change: ask the user before doing it.`)
  }

  if (cbm.wired) {
    const where = Object.entries(cbm.usage).map(([, at]) => at.join(', ')).join('; ')
    const outdated = cbm.installed && cbm.latest && olderThan(cbm.installed, cbm.latest)
    if (outdated) {
      steps.push({ title: `Update colorsbymax ${cbm.installed} → ${cbm.latest}`, command: `${install} colorsbymax@latest${info.packageManager === 'npm' ? ' --prefer-online' : ''}` })
    }
    if (!cbm.installed) steps.push({ title: 'Install the packages (the code uses colorsbymax, but it isn’t in node_modules)', command: `${install}` })
    steps.push({
      title: 'Check it on the page',
      detail: 'Run the site. The colour button sits in the bottom-right corner unless position says otherwise. The panel’s Audit button (next to settings) pins notes to anything that won’t look right in the chosen theme.',
    })
    steps.push({
      title: cbm.usage.hidden ? 'Finished already' : 'When the colours are chosen',
      detail: cbm.usage.hidden
        ? `The config sets hidden (${cbm.usage.hidden.join(', ')}), so the button is hidden where that’s true, typically in production. Use the finish tool with action "bring-back" to show it again.`
        : 'Use the finish tool (action "keep") to make the chosen colours the default for every visitor and hide the button in production.',
    })
    return {
      status: 'set-up',
      summary: `colorsbymax ${cbm.installed ?? cbm.declared ?? ''} is already set up (${where}).${outdated ? ` A newer version, ${cbm.latest}, is out.` : ''}`,
      warnings,
      steps,
    }
  }

  // 1. Install.
  const extra = !info.react ? ['react', 'react-dom'] : []
  if (info.framework.id !== 'static') {
    steps.push({
      title: 'Install',
      command: `${install} colorsbymax${extra.length ? ` ${extra.join(' ')}` : ''}`,
      detail: extra.length ? 'colorsbymax’s panel is built with React, so react and react-dom come too. They only power the colour panel; the site itself doesn’t need to use React.' : undefined,
    })
  }

  // 2. Wire it up.
  const config = configSource(options)
  steps.push(wiringStep(info, config))

  // 3. How the colours get themed.
  const colours = info.colours
  if (colours.mode === 'tokens') {
    const index = info.entryFiles.includes('index.html')
    steps.push({
      title: 'Colours: themes apply to your tokens directly',
      detail: `The site already paints with ${colours.tokensUsed.length} of the 35 colorsbymax tokens (${colours.tokensUsed.slice(0, 8).join(', ')}${colours.tokensUsed.length > 8 ? '…' : ''}), so each theme sets those --color-* variables and nothing is re-coloured by reading the page.${index ? ' To avoid a flash of the default colours on reload, add the pre-paint script to <head> in index.html (use the same storageKey as the config, or the default).' : ''}`,
      files: index ? [{ file: 'index.html', action: 'edit', code: `<!-- in <head>, before any stylesheet -->\n<script>${prePaintScript(options.storageKey)}</script>` }] : undefined,
    })
  } else {
    steps.push({
      title: 'Colours: re-coloured automatically',
      detail: `The site doesn’t use the colorsbymax tokens (it has about ${colours.hardCodedColours} hard-coded colours${colours.tailwindPaletteClasses ? ` and ${colours.tailwindPaletteClasses} Tailwind palette classes` : ''}), so colorsbymax reads the colours painted on the page and swaps each for its counterpart in the chosen theme. This works with no other changes. For exact control over which colour goes where, the site can paint with the --color-* tokens instead: see the docs tool, topic "full-setup".`,
    })
  }

  // 4. Check.
  steps.push({
    title: 'Check it on the page',
    detail: `Run the site. The colour button appears ${options.position ? `at ${options.position}` : 'in the bottom-right corner'} once the page has loaded. Open it, pick a theme, and use Audit (next to settings) to see anything that won’t look right, such as a picture logo on a dark theme. If the logo isn’t detected, add data-colorsbymax-logo to it.`,
  })
  steps.push({ title: 'When the colours are chosen', detail: 'Use the finish tool (action "keep") to make them the site’s default and hide the button in production.' })

  return {
    status: 'not-set-up',
    summary: `Set up colorsbymax in ${info.name ?? 'this project'} (${info.framework.label}${info.tailwind ? `, Tailwind ${info.tailwind.major}` : ''}).`,
    warnings,
    steps,
  }
}
