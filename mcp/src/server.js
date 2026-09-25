// colorsbymax MCP server: lets AI agents set colorsbymax up in a project, find and build themes,
// check contrast, and finish a site's colours. It reads projects but never writes to them; the
// agent makes the edits it describes.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { BRING_BACK_PROMPT, keepPrompt, keepSnippet, NODE_PROD, removePrompt, VITE_PROD } from '../../src/finish.js'
import README from '../../README.md?raw'
import TYPES from '../../types/index.d.ts?raw'
import {
  CATEGORIES, completeFrom, contrastReport, cssSnippet, darkTokens, findTheme, normalizeHex, pairReport, searchThemes,
  tailwindSnippet, THEME_COUNT, themeFromColours, themeJson, TOKEN_GROUPS,
} from './engine.js'
import { inspectProject } from './project.js'
import { setupPlan } from './plan.js'
import { version } from '../package.json'

const INSTRUCTIONS = `colorsbymax (npm package "colorsbymax") is a live theme switcher for websites. A colour button sits on the page; its panel swaps the whole site's colours between ${THEME_COUNT} themes, keeps WCAG contrast, builds palettes from images, and has an Audit that pins notes to anything that won't look right.

Every colour is one of 35 tokens (primary, background, surface, ink, data-1…), exposed as --color-<token> CSS variables. Sites that paint with those variables are themed directly; any other site is re-coloured automatically by reading its painted colours.

How to help a user with it:
1. setup_plan with the project's folder: it inspects the project and returns the exact install command and edits for its framework. This server never writes files; make the edits yourself, and ask before bigger changes such as upgrading React.
2. The user picks colours in the panel on their running site. You can also choose for them: find_themes (by mood, category or brand colour), get_theme, or theme_from_colours (a full theme around their brand colours), then check_contrast.
3. finish with the chosen colours: it returns the code that makes them the site's default and hides the switcher in production, or removes colorsbymax while keeping the colours.
Theme JSON ({ name, tokens }) from get_theme or theme_from_colours can be pasted into the panel's Import/export. docs has the README and the full TypeScript API.`

const server = new McpServer({ name: 'colorsbymax', title: 'colorsbymax', version }, { instructions: INSTRUCTIONS })

const text = (body) => ({ content: [{ type: 'text', text: body }] })
const json = (value) => '```json\n' + JSON.stringify(value, null, 2) + '\n```'
const code = (lang, body) => '```' + lang + '\n' + body + '\n```'
const fail = (message) => ({ content: [{ type: 'text', text: message }], isError: true })
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false }

const tokensSchema = z.record(z.string(), z.string()).describe('Token key → hex colour, e.g. { "primary": "#0d6b84", "background": "#f6fbfc" }. Keys may include the --color- prefix. Missing tokens are filled in.')
const FORMATS = ['json', 'css', 'tailwind', 'config']
/** Code fence language for a planned file edit. */
const langOf = (f) => (/\.(astro|svelte|vue|html)$/.test(f.file) || f.code.startsWith('<') ? 'html' : (f.file.match(/\.([cm]?[jt]sx?)$/)?.[1] ?? 'js'))

/** A theme in the format the agent asked for. */
function formatTheme(name, tokens, format) {
  switch (format) {
    case 'css':
      return `Plain CSS: the theme as --color-* variables.\n\n${code('css', cssSnippet(tokens))}`
    case 'tailwind':
      return `Tailwind CSS v4: in the main stylesheet. Utilities like bg-primary and text-ink then follow the theme.\n\n${code('css', tailwindSnippet(tokens))}`
    case 'config':
      return `colorsbymax config: makes this the site's default theme.\n\n${code('js', `defaultTheme: ${JSON.stringify({ name, tokens }, null, 2)}`)}`
    default:
      return `Theme JSON: paste into the panel's Import/export, or pass as defaultTheme.\n\n${code('json', themeJson(name, tokens))}`
  }
}

// ---------------------------------------------------------------- setup

server.registerTool(
  'setup_plan',
  {
    title: 'Plan the colorsbymax setup for a project',
    description:
      'Inspects a project folder (framework, package manager, whether colorsbymax is installed or wired up, whether the CSS uses colorsbymax tokens or hard-coded colours) and returns the install command and the exact edits to add the colour switcher. Also reports an existing setup and whether an update is available. Read-only.',
    inputSchema: {
      path: z.string().describe('Absolute path to the project folder (where package.json is).'),
      siteName: z.string().optional().describe('Name for the site’s own theme group in the panel. Detected from the page when left out.'),
      storageKey: z.string().optional().describe('localStorage key for the visitor’s choice. Defaults to "colorsbymax".'),
      position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional().describe('Where the colour button starts. Defaults to bottom-right.'),
    },
    annotations: { ...READ_ONLY, openWorldHint: true },
  },
  async ({ path, ...options }) => {
    let info
    try {
      info = await inspectProject(path)
    } catch (e) {
      return fail(e.message)
    }
    const plan = setupPlan(info, options)
    const out = [`# ${plan.summary}`]
    if (plan.warnings.length) out.push(plan.warnings.map((w) => `> **Warning:** ${w}`).join('\n'))
    plan.steps.forEach((s, i) => {
      out.push(`## ${i + 1}. ${s.title}`)
      if (s.detail) out.push(s.detail)
      if (s.command) out.push(code('bash', s.command))
      for (const f of s.files ?? []) out.push(`${f.action === 'create' ? 'Create' : 'Edit'} \`${f.file}\`:\n\n${code(langOf(f), f.code)}`)
    })
    out.push(`## What was found\n\n${json({ framework: info.framework, packageManager: info.packageManager, react: info.react, tailwind: info.tailwind, colorsbymax: info.colorsbymax, colours: info.colours, entryFiles: info.entryFiles, filesScanned: info.filesScanned })}`)
    return text(out.join('\n\n'))
  },
)

// ---------------------------------------------------------------- themes

server.registerTool(
  'find_themes',
  {
    title: 'Find colorsbymax themes',
    description: `Searches the ${THEME_COUNT} built-in themes (Max's picks and the library) by name or mood words, category, or closeness to a brand colour. Returns ids with their key colours; pass an id to get_theme for every token.`,
    inputSchema: {
      query: z.string().optional().describe('Words to match in names and categories, e.g. "ocean", "teal", "pastel".'),
      category: z.enum(CATEGORIES.map((c) => c.id)).optional().describe(`One of: ${CATEGORIES.map((c) => `${c.id} (${c.description.toLowerCase()})`).join(', ')}.`),
      near: z.string().optional().describe('A brand colour as hex: results are sorted by how close their primary colour is.'),
      mode: z.enum(['light', 'dark']).optional().describe('Show the dark versions. Every theme has a generated dark twin.'),
      limit: z.number().int().min(1).max(50).optional().describe('Most results to return (default 12).'),
    },
    annotations: READ_ONLY,
  },
  async (args) => {
    try {
      const { total, themes } = searchThemes(args)
      if (!total) return text(`No themes match. Categories: ${CATEGORIES.map((c) => c.id).join(', ')}. Or try near with a hex colour.`)
      return text(`${total} theme${total === 1 ? '' : 's'} match${themes.length < total ? `; showing ${themes.length}` : ''}. contrastIssues counts failing WCAG pairings (0 is best).\n\n${json(themes)}`)
    } catch (e) {
      return fail(e.message)
    }
  },
)

server.registerTool(
  'get_theme',
  {
    title: 'Get a theme’s colours',
    description: 'Every token of one theme, in light or dark, with its contrast report. Formats: json (the panel’s Import/export format), css (--color-* variables), tailwind (Tailwind v4 @theme), config (defaultTheme for the colorsbymax config).',
    inputSchema: {
      id: z.string().describe('Theme id from find_themes, e.g. "ocean" or "lib-12". Add "~dark" for the dark twin.'),
      mode: z.enum(['light', 'dark']).optional(),
      format: z.enum(FORMATS).optional().describe('Defaults to json.'),
    },
    annotations: READ_ONLY,
  },
  async ({ id, mode, format }) => {
    const theme = findTheme(id, mode)
    if (!theme) return fail(`No theme "${id}". Use find_themes to look ids up; Max's picks are ocean, forest, sunset, slate and rose.`)
    const name = theme.name
    return text(`# ${name} (${theme.group}${theme.id.endsWith('~dark') || mode === 'dark' ? ', dark' : ''})\n\n${formatTheme(name, theme.tokens, format)}\n\n## Contrast\n\n${json(contrastReport(theme.tokens))}`)
  },
)

server.registerTool(
  'theme_from_colours',
  {
    title: 'Build a theme from brand colours',
    description: 'Builds a complete 35-token theme around 1–8 colours (brand colours, a logo’s colours, a mood board), the way the panel does for an uploaded image: the most vivid becomes primary, a very light one the page, a very dark one the text, and every colour feeds the chart colours. Contrast is fixed automatically. Optionally returns the dark twin too.',
    inputSchema: {
      colours: z.array(z.string()).min(1).max(8).describe('Hex colours, most important first.'),
      name: z.string().optional().describe('Theme name. Defaults to "Brand".'),
      format: z.enum(FORMATS).optional().describe('Defaults to json.'),
      withDark: z.boolean().optional().describe('Also return the dark version.'),
    },
    annotations: READ_ONLY,
  },
  async ({ colours, name = 'Brand', format, withDark }) => {
    let tokens
    try {
      tokens = themeFromColours(colours)
    } catch (e) {
      return fail(e.message)
    }
    const out = [`# ${name}`, formatTheme(name, tokens, format), `## Contrast\n\n${json(contrastReport(tokens))}`]
    if (withDark) {
      const d = darkTokens(tokens)
      out.push(`# ${name} (dark)`, formatTheme(`${name} (dark)`, d, format), `## Contrast\n\n${json(contrastReport(d))}`)
    }
    return text(out.join('\n\n'))
  },
)

server.registerTool(
  'check_contrast',
  {
    title: 'Check colour contrast',
    description: 'WCAG contrast checks. Pass tokens to check a theme the way the panel does (text on the page and on cards, button text, muted text, icons, chart colours) and get the smallest fixes; or pass pairs of foreground and background colours.',
    inputSchema: {
      tokens: tokensSchema.optional(),
      pairs: z.array(z.object({ foreground: z.string(), background: z.string() })).max(40).optional().describe('Colour pairs to check on their own.'),
    },
    annotations: READ_ONLY,
  },
  async ({ tokens, pairs }) => {
    if (!tokens && !pairs?.length) return fail('Pass tokens (a theme) or pairs (foreground and background colours).')
    const out = []
    if (tokens) {
      const { tokens: full, given, rejected } = completeFrom(tokens)
      out.push(`## Theme\n\nChecked with ${given.length} of your tokens; the other ${35 - given.length} use colorsbymax’s neutral defaults.${rejected.length ? ` Ignored (not a token or not a colour): ${rejected.join(', ')}.` : ''}\n\n${json(contrastReport(full))}`)
    }
    if (pairs?.length) {
      const bad = pairs.filter((p) => !normalizeHex(p.foreground) || !normalizeHex(p.background))
      if (bad.length) return fail(`Not hex colours: ${bad.map((p) => `${p.foreground} on ${p.background}`).join(', ')}.`)
      out.push(`## Pairs\n\nText needs 4.5:1, large text (24px, or 18.7px bold) and icons 3:1.\n\n${json(pairs.map((p) => pairReport(normalizeHex(p.foreground), normalizeHex(p.background))))}`)
    }
    return text(out.join('\n\n'))
  },
)

// ---------------------------------------------------------------- finishing

server.registerTool(
  'finish',
  {
    title: 'Finish: keep the colours, hide or remove the switcher',
    description:
      'What to change once colours are chosen. keep: make the colours the site’s default for every visitor and hide the button in production (recommended). bring-back: show the button in production again. hide-locally: hide it on one device, with no code change. remove: uninstall colorsbymax and keep the colours in the site’s own CSS. Pass the colours as a theme id or tokens.',
    inputSchema: {
      action: z.enum(['keep', 'bring-back', 'hide-locally', 'remove']),
      themeId: z.string().optional().describe('A theme id from find_themes (add "~dark" for dark).'),
      tokens: tokensSchema.optional().describe('The chosen colours, e.g. from the panel’s Import/export or theme_from_colours.'),
      name: z.string().optional().describe('Name for the theme. Defaults to the theme’s name or "My colours".'),
      setup: z.enum(['auto', 'provider']).optional().describe('auto for import "colorsbymax/auto" or autoMount (default); provider for <ThemeProvider>.'),
      bundler: z.enum(['vite', 'other']).optional().describe('vite uses import.meta.env.PROD; other (Next.js, webpack…) uses process.env.NODE_ENV. Defaults to vite.'),
      recolouring: z.boolean().optional().describe('For remove: true when the site uses hard-coded colours that colorsbymax was re-colouring (no --color-* tokens).'),
    },
    annotations: READ_ONLY,
  },
  async ({ action, themeId, tokens, name, setup = 'auto', bundler = 'vite', recolouring = false }) => {
    if (action === 'hide-locally') {
      return text('# Hide it on this device only\n\nNo code change, and nobody else is affected. In the panel, press **I’m done**, pick "Hide it on this device only", then **Hide the button here**. Pressing **Alt+Shift+C** on the page also hides it.\n\nTo bring it back: press **Alt+Shift+C** again, or add `?colorsbymax` to the address.')
    }
    if (action === 'bring-back') {
      return text(`# Show the switcher in production again\n\nIn the colorsbymax config (the autoMount({...}) call or the config passed to <ThemeProvider>), set \`hidden: false\` or delete the \`hidden\` line. It always shows in development.\n\nAs a prompt for an AI editor:\n\n> ${BRING_BACK_PROMPT}`)
    }
    let full
    let themeName = name
    if (themeId) {
      const theme = findTheme(themeId)
      if (!theme) return fail(`No theme "${themeId}". Use find_themes to look ids up.`)
      full = theme.tokens
      themeName ??= theme.name
    } else if (tokens) {
      const done = completeFrom(tokens)
      if (!done.given.length) return fail('None of those tokens were recognised. Expected keys like primary, background and ink, with hex colours.')
      full = done.tokens
    } else {
      return fail('Pass themeId or tokens: the colours to keep. The user can copy them from the panel’s Import/export.')
    }
    themeName ??= 'My colours'
    const prod = bundler === 'vite' ? VITE_PROD : NODE_PROD

    if (action === 'keep') {
      return text(
        [
          `# Keep "${themeName}" and hide the switcher in production`,
          'Everyone gets these colours; the button keeps showing in development so the user can keep iterating.',
          code(setup === 'auto' ? 'js' : 'jsx', keepSnippet(setup, themeName, full, prod)),
          setup === 'auto'
            ? 'For Next.js, Remix and other server-rendered setups that load colorsbymax with `import(\'colorsbymax/auto\')` inside a useEffect, call `autoMount` from its result: `import(\'colorsbymax/auto\').then(({ autoMount }) => autoMount({ defaultTheme, hidden }))`.'
            : '',
          `Visitors who picked another theme before keep their pick until they choose "${themeName}" or clear it. To bring the button back in production later, use this tool with action "bring-back".`,
        ].filter(Boolean).join('\n\n'),
      )
    }
    // remove
    return text(
      [
        `# Remove colorsbymax, keep "${themeName}"`,
        `1. Uninstall:\n\n${code('bash', 'npm uninstall colorsbymax')}`,
        '2. Delete its usage: `import \'colorsbymax/auto\'`, `autoMount`, or `ThemeProvider` and `ThemeSwitcher`, and any colorsbymax pre-paint script in index.html. Keep react and react-dom if the site uses React itself.',
        recolouring
          ? `3. Keep the colours: the site's CSS uses hard-coded colours that colorsbymax swapped while it ran, so update the site's own CSS to this palette (primary is the main brand colour, background the page, ink the text):\n\n${code('json', JSON.stringify(full, null, 2))}`
          : `3. Keep the colours: add these to the global stylesheet, replacing any existing --color-* values. If it imports colorsbymax/tokens.css, replace that import with this block.\n\n${code('css', cssSnippet(full))}`,
        `As a prompt for an AI editor:\n\n> ${removePrompt(full, recolouring)}`,
      ].join('\n\n'),
    )
  },
)

// ---------------------------------------------------------------- docs

/** README sections by their ## heading. */
const SECTIONS = Object.fromEntries(
  README.split(/\n(?=## )/).map((part, i) => [i === 0 ? 'intro' : part.match(/^## (.+)/)[1].toLowerCase(), part.trim()]),
)
const section = (...names) => names.map((n) => SECTIONS[n]).filter(Boolean).join('\n\n')
const TOPICS = {
  overview: () => section('intro', 'features', 'how it works'),
  'quick-start': () => section('quick start'),
  'full-setup': () => section('add it to a site'),
  finish: () => section('finished? keep your colours and hide the switcher'),
  updating: () => section('updating'),
  tokens: () =>
    `# The 35 colour tokens\n\nEach is a CSS variable, --color-<key>. A site that paints with them is themed directly.\n\n${TOKEN_GROUPS.map((g) => `## ${g.group}\n\n${g.tokens.map((t) => `- \`${t.key}\` (${t.label}): ${t.usage}`).join('\n')}`).join('\n\n')}`,
  api: () => `# colorsbymax TypeScript API\n\n${code('ts', TYPES)}`,
  readme: () => README,
}

server.registerTool(
  'docs',
  {
    title: 'colorsbymax documentation',
    description: 'colorsbymax’s documentation by topic: overview, quick-start, full-setup (tokens, config, ThemeProvider, PDF uploads), finish, updating, tokens (all 35 with what each colours), api (the TypeScript declarations), or readme (everything).',
    inputSchema: { topic: z.enum(Object.keys(TOPICS)) },
    annotations: READ_ONLY,
  },
  async ({ topic }) => text(TOPICS[topic]()),
)

// ---------------------------------------------------------------- prompts

server.registerPrompt(
  'add-colorsbymax',
  {
    title: 'Add colorsbymax to this project',
    description: 'Sets up the colorsbymax theme switcher in the current project.',
    argsSchema: { path: z.string().optional().describe('Project folder. Defaults to the current workspace.') },
  },
  ({ path }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Add the colorsbymax theme switcher to this project${path ? ` (${path})` : ''}. Call the colorsbymax setup_plan tool with the project's absolute path, make the edits it lists, run the install command, then tell me how to see the colour button. Ask me before anything beyond its plan, such as upgrading React.`,
        },
      },
    ],
  }),
)

server.registerPrompt(
  'finish-colorsbymax',
  {
    title: 'Keep my colorsbymax colours',
    description: 'Makes the chosen colours the site’s default and hides the switcher in production.',
    argsSchema: { theme: z.string().optional().describe('Theme JSON from the panel’s Import/export, or a theme id.') },
  },
  ({ theme }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `I've picked my colours with colorsbymax. ${theme ? `Here they are: ${theme}. ` : 'Ask me to copy them from the panel’s Import/export if you need them. '}Use the colorsbymax finish tool with action "keep" (check this project's setup and bundler first), apply its change, and don't change anything else.`,
        },
      },
    ],
  }),
)

await server.connect(new StdioServerTransport())
