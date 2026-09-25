<p align="center">
  <img src="https://raw.githubusercontent.com/MaxMuyalwa/colorsbymax/main/docs/readme/hero.svg" alt="colorsbymax by mrmaxdesigns: re-colour any website, live." width="880">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/colorsbymax"><img src="https://img.shields.io/npm/v/colorsbymax?style=flat-square&color=0d6b84&label=colorsbymax" alt="colorsbymax on npm"></a>
  <a href="https://www.npmjs.com/package/colorsbymax-mcp"><img src="https://img.shields.io/npm/v/colorsbymax-mcp?style=flat-square&color=7c3aed&label=colorsbymax-mcp" alt="colorsbymax-mcp on npm"></a>
  <img src="https://img.shields.io/badge/React-18%20%7C%2019-be185d?style=flat-square" alt="React 18 or 19">
  <img src="https://img.shields.io/badge/types-included-15803d?style=flat-square" alt="TypeScript types included">
  <a href="LICENSE"><img src="https://img.shields.io/badge/licence-MIT-c2410c?style=flat-square" alt="MIT licence"></a>
</p>

<p align="center"><strong><a href="https://mrmaxdesigns.com/colorsbymax">See it live at mrmaxdesigns.com/colorsbymax →</a></strong><br>Open the colour button on the page and re-colour the whole site.</p>

A floating theme switcher for websites. Visitors (or the site's owner) can re-colour the whole site instantly: pick one of the site's own themes, a hand-tuned pick, or one of 715 library themes in 14 categories; build and share custom palettes; or override single colours. Every theme is checked against the Web Content Accessibility Guidelines (WCAG) contrast rules, with one-click fixes.

<p align="center">
  <a href="#at-a-glance"><img src="https://raw.githubusercontent.com/MaxMuyalwa/colorsbymax/main/docs/readme/nav-start.svg" alt="1. Get started" height="36"></a>
  <a href="#coding-agents-mcp"><img src="https://raw.githubusercontent.com/MaxMuyalwa/colorsbymax/main/docs/readme/nav-agents.svg" alt="2. Coding agents" height="36"></a>
  <a href="#features"><img src="https://raw.githubusercontent.com/MaxMuyalwa/colorsbymax/main/docs/readme/nav-inside.svg" alt="3. Features" height="36"></a>
  <a href="#add-it-to-a-site"><img src="https://raw.githubusercontent.com/MaxMuyalwa/colorsbymax/main/docs/readme/nav-control.svg" alt="4. Full control" height="36"></a>
  <a href="#finished-keep-your-colours-and-hide-the-switcher"><img src="https://raw.githubusercontent.com/MaxMuyalwa/colorsbymax/main/docs/readme/nav-ship.svg" alt="5. Ship it" height="36"></a>
  <a href="#building-the-package"><img src="https://raw.githubusercontent.com/MaxMuyalwa/colorsbymax/main/docs/readme/nav-hood.svg" alt="6. Under the hood" height="36"></a>
</p>

<br>

<img src="https://raw.githubusercontent.com/MaxMuyalwa/colorsbymax/main/docs/readme/section-start.svg" alt="01 · Get started: two steps to a live colour switcher" width="100%">

## At a glance

- **Two steps.** `npm install colorsbymax`, then `import 'colorsbymax/auto'` once. The colour button appears and visitors can re-colour the site, even if its colours are hard-coded (see [Quick start](#quick-start)).
- **React 18 or 19.**
- **Tailwind optional.** The panel carries its own styles, so it works with Tailwind v4, older Tailwind or plain CSS. Your site only needs to paint its colours with `var(--color-…)` variables. The optional `colorsbymax/tokens.css` helper is for Tailwind v4 (`@theme` syntax); without Tailwind v4, define the variables yourself.
- **TypeScript types included.**
- **No runtime dependencies** besides React. PDF uploads are opt-in and need `pdfjs-dist` (see [PDF uploads](#pdf-uploads)).
- **ESM only.** Import it from a bundler or `import()`; `require('colorsbymax')` from CommonJS isn't supported.
- **The colour tools work on their own too.** `contrastRatio`, `checkTheme`, `suggestFix`, `fixAll`, `themeFromPalette`, `darkTokens` and the rest are plain functions with no UI.

## Quick start

```bash
npm install colorsbymax
```

Then add one line anywhere in your site's code, for example `main.jsx`:

```js
import 'colorsbymax/auto'
```

That's all. The colour button appears in the bottom-right corner once the page has loaded, and visitors can start swapping the site's colours. (npm doesn't let a package change your site on install, so this one line is the only step.)

- **Any site's colours.** If your site doesn't use colorsbymax's colour variables, colorsbymax reads the colours actually on the page (backgrounds, text, borders, gradients and icons) and swaps each for its counterpart in the chosen theme: greys follow the theme's background and text, brand shades follow its brand colour, and success and error colours keep their meaning. Content added later is re-coloured too, and picking the site's own theme brings back the exact original.
- **Settings.** Use `autoMount` instead of the plain import:

  ```js
  import { autoMount } from 'colorsbymax/auto'
  autoMount({ siteName: 'My site', storageKey: 'my-site-theme' })
  ```

- **Logos keep their own colours** unless a visitor turns on "Colour the logo too" in settings. Mark your logo with `data-colorsbymax-logo` if colorsbymax doesn't find it (it looks for "logo" in a class, id or label).
- **Where automatic re-colouring falls short:** images keep their colours, hover and focus colours keep the site's own, and colours drawn by `::before`/`::after` aren't swapped. For full control, use the colour variables below; colorsbymax then applies themes to them directly, with no page reading at all.

Already installed it? Get the newest version with `npm install colorsbymax@latest` (see [Updating](#updating)).

## Try the demo

colorsbymax's home, **[mrmaxdesigns.com/colorsbymax](https://mrmaxdesigns.com/colorsbymax)**, is the demo: open the colour button and the whole page re-colours. To run it locally:

```bash
npm install
npm run dev
```

This serves `demo/`, the same site: built with Tailwind, where every colour is a token, and every token group is used. Its sections are in `demo/site/`.

<br>

<img src="https://raw.githubusercontent.com/MaxMuyalwa/colorsbymax/main/docs/readme/section-agents.svg" alt="02 · Coding agents: let Claude, Cursor or Copilot do it" width="100%">

## Coding agents (MCP)

Your coding agent can set colorsbymax up and use it for you. [colorsbymax-mcp](mcp/) is an [MCP](https://modelcontextprotocol.io) server that gives Claude Code, Cursor, GitHub Copilot, Codex, Google Antigravity, Gemini CLI, Grok Build, Claude Desktop, Windsurf, Kiro, Zed, JetBrains, Cline, opencode and other agents colorsbymax's own tools:

| The agent can… | Tool |
| --- | --- |
| Look at your project and add colorsbymax the right way for its framework: Vite, Next.js, Remix, Gatsby, Astro, Nuxt, SvelteKit, Vue, Svelte or plain HTML | `setup_plan` |
| Find themes by mood, category or closeness to your brand colour, in light or dark | `find_themes`, `get_theme` |
| Build a complete, accessible theme around your brand colours | `theme_from_colours` |
| Check contrast and suggest the smallest fixes | `check_contrast` |
| Make your chosen colours the default and hide the switcher in production, or remove colorsbymax and keep them | `finish` |
| Read these docs and the full TypeScript API | `docs` |

It reads your project but never changes it: the agent makes the edits, so you review them as usual. It runs with `npx`, so there's nothing to install first (Node 18 or later).

**Adding the server doesn't change your site by itself.** It gives your agent the tools; the agent then sets colorsbymax up when you ask:

1. **Add the server** once, with the steps for your editor below.
2. **Start a new chat or session** in your project. Agents load MCP servers when a session starts, so one that was already open won't see it yet.
3. **Ask:** *"Add colorsbymax to this project."* The agent installs the package and adds the one line (or the right version of it for your framework).
4. **Run your site** (for example `npm run dev`). The colour button appears in the bottom-right corner.

### Claude Code

```bash
claude mcp add colorsbymax -- npx -y colorsbymax-mcp
```

That adds it for you in this project. Add `--scope user` to have it in every project, or `--scope project` to share it with your team through a `.mcp.json` file. Check it with `/mcp` inside Claude Code.

If your terminal says `claude` isn't found (the desktop app doesn't always put it on your PATH), ask Claude Code itself: *"Add the colorsbymax MCP server: `npx -y colorsbymax-mcp`."*

### Cursor

Add this to `.cursor/mcp.json` in your project, or to `~/.cursor/mcp.json` for every project:

```json
{
  "mcpServers": {
    "colorsbymax": { "command": "npx", "args": ["-y", "colorsbymax-mcp"] }
  }
}
```

It then shows under **Settings → MCP**, and Cursor's agent uses it when you ask about colours or themes.

### VS Code (GitHub Copilot)

Add this to `.vscode/mcp.json`, then use it from Copilot Chat in **Agent** mode:

```json
{
  "servers": {
    "colorsbymax": { "command": "npx", "args": ["-y", "colorsbymax-mcp"] }
  }
}
```

### Claude Desktop

Open **Settings → Developer → Edit Config**, add the same `mcpServers` entry as Cursor to `claude_desktop_config.json`, and restart Claude Desktop.

### GitHub Copilot CLI

```bash
copilot mcp add colorsbymax -- npx -y colorsbymax-mcp
```

Or type `/mcp add` inside `copilot`. It's saved to `~/.copilot/mcp-config.json`.

### Codex (OpenAI)

```bash
codex mcp add colorsbymax -- npx -y colorsbymax-mcp
```

It's saved to `~/.codex/config.toml`, which the Codex IDE extension shares. To write it by hand:

```toml
[mcp_servers.colorsbymax]
command = "npx"
args = ["-y", "colorsbymax-mcp"]
```

### Google Antigravity

In the agent panel, open **… → MCP Servers → Manage MCP Servers → View raw config**, add the same `mcpServers` entry as Cursor to `~/.gemini/config/mcp_config.json`, and save. Antigravity reloads it by itself. For one project, use `.agents/mcp_config.json`. In the Antigravity CLI, `/mcp` opens the same manager.

### Gemini CLI

Add the same `mcpServers` entry as Cursor to `~/.gemini/settings.json` (or `.gemini/settings.json` in your project), restart Gemini CLI, and check it with `/mcp`.

### Grok Build (xAI)

```bash
grok mcp add colorsbymax -- npx -y colorsbymax-mcp
```

It's saved to `~/.grok/config.toml`; add `--scope project` for `.grok/config.toml`. The first start downloads the server, so if it times out, raise `startup_timeout_sec` for it in that file.

### Windsurf, Kiro, JetBrains, Cline and Roo

They take the same `mcpServers` entry as Cursor:

- **Windsurf:** `~/.codeium/windsurf/mcp_config.json`
- **Kiro:** `.kiro/settings/mcp.json` in your project, or `~/.kiro/settings/mcp.json`. Kiro doesn't read your shell's PATH, so use the full path to `npx` if it can't start.
- **JetBrains:** AI Assistant under **Settings → Tools → AI Assistant → Model Context Protocol (MCP)**; Junie under **Settings → Tools → Junie → MCP Settings**.
- **Cline and Roo Code:** in the extension's **MCP Servers** view, choose **Configure** (or **Edit MCP Settings**).

### Zed and opencode

Zed calls them context servers. In `settings.json`, or through **Settings → AI → MCP Servers → Add Server**:

```json
{
  "context_servers": {
    "colorsbymax": { "command": "npx", "args": ["-y", "colorsbymax-mcp"] }
  }
}
```

opencode, in `opencode.json`:

```json
{
  "mcp": {
    "colorsbymax": { "type": "local", "command": ["npx", "-y", "colorsbymax-mcp"] }
  }
}
```

### Any other MCP client

Most take the same `mcpServers` entry as Cursor: the command is `npx`, with `-y colorsbymax-mcp` as its arguments.

On Windows, if an editor can't start `npx`, use `"command": "cmd"` with `"args": ["/c", "npx", "-y", "colorsbymax-mcp"]`.

### What to ask

- *"Add colorsbymax to this project."*
- *"Find me a calm ocean theme that also works in dark mode."*
- *"Build a theme around our brand colours #e63946 and #1d3557, and check its contrast."*
- *"Does white text pass on #f59e0b?"*
- *"I've picked my colours in the panel. Make them the default and hide the switcher in production."* Paste the theme from the panel's **Import / export**, or name the theme.

### Without MCP

Any coding agent can still do it from a prompt. Paste this into Claude, Cursor, Copilot or another agent:

> Install the colorsbymax npm package in this project and add `import 'colorsbymax/auto'` to the app's entry file, so the colorsbymax colour button appears on every page. For Next.js, Remix or other server-rendered apps, load it in the browser only, with `import('colorsbymax/auto')` inside a `useEffect`. Follow https://github.com/MaxMuyalwa/colorsbymax#quick-start and don't change anything else.

When you're done choosing colours, the panel's **I'm done** button gives you ready-made prompts for keeping your colours, hiding the switcher or removing it (see [Finished?](#finished-keep-your-colours-and-hide-the-switcher)).

<br>

<img src="https://raw.githubusercontent.com/MaxMuyalwa/colorsbymax/main/docs/readme/section-inside.svg" alt="03 · What's inside: everything in the panel" width="100%">

## Features

- **Site themes first.** The panel opens on a group named after the site, holding its own colours. If those fail contrast, an accessible version is generated automatically.
- **Scan the site.** Press "Scan site" and colorsbymax reads the colours actually painted on the page (ignoring any theme it has applied, and including gradients). It works out the page background, surfaces, text and brand colours, then adds themes named after the site: Scanned (as found), Accessible, Soft, Bold, Complementary, and the closest library matches. Scans run only when asked, and the results are remembered.
- **Max’s picks and library.** 5 hand-tuned picks, plus 715 library themes (Bright, Fun, Pastel, Earth tones, Summer, Autumn, Winter, Spring, Ocean, Warm, Nature, Moody, Monochrome, Eclectic) with search and "Surprise me". The library loads only when the panel opens.
- **Custom palettes, single-colour overrides, JSON import/export.**
- **Palettes from images and PDFs.** In Import / export, upload or drop a mood board, screenshot or photo, or paste one straight from the clipboard: take a screenshot, open the panel and press Ctrl+V (⌘V on a Mac), or use **Paste image**. colorsbymax picks out its main colours, lets you leave any out, previews the palette it builds around them and saves it as a custom palette. Nothing leaves the browser. PDFs, such as brand guides, work where the site [turns them on](#pdf-uploads); hex codes written in a PDF take priority.
- **Contrast checks.** Problems show as a badge on the theme; the breakdown offers per-item fixes or "Fix all automatically", which changes lightness only.
- **No flash on reload.** An inline pre-paint script applies the saved theme before the page draws.
- **Works on any site.** The panel carries its own stylesheet inside a shadow root, so it needs no Tailwind or other CSS from the site, and the site's CSS can't restyle it.
- **Movable colour button.** The floating button starts in the corner; visitors can drag it anywhere (mouse or touch; a tooltip says so on hover, and an open panel moves with it) and it stays there, remembered across reloads. The panel then opens beside it, on whichever side has room. Its dot cycles through the current theme's colours.
- **Light and dark mode, for any site.** Every built-in theme is designed light and has a generated dark twin (dark surfaces, light text, brand colours lifted until they read on dark, then contrast-checked). Switching to Dark, one click in the panel's header, turns the whole site dark, even one that never had a dark mode. Auto follows the visitor's device, and a light and dark switch can go anywhere on the site (see [Dark mode](#dark-mode)). Custom palettes stay as they were made.
- **Visitor settings.** The gear in the panel header opens settings: theme mode (Light, Dark, Auto), panel size (Compact, Standard, Large), which groups and sections to show, whether the button can be dragged or its dot animates, and moving the button back to its corner. Saved per site.
- **Resizable panel.** Drag the panel's free edges or corner (the ones away from the colour button) to any size, or pick a size in settings; double-click an edge to reset it. The layout follows the panel's width, so a large panel shows three theme cards a row.
- **Audit the page.** The **Audit** button in the panel header looks at the page in the chosen colours and pins notes to what won't look right: a logo that disappears against its background (with a one-click "Colour the logo", or tips when it's a picture colorsbymax can't re-colour, plus "Preview inverted"), pictures whose solid background shows as a box, and text or icons too faint to read. The notes stay on the page as you scroll; **Re-check** after a fix (it also re-checks when the colours change) and close it from its bar.
- **Clear groups and feedback.** The site's own group (globe), Max’s picks (paintbrush) and Yours (person) sit in their own row, apart from the library's categories. Toasts confirm what just happened; saving, importing or building a palette says it went to Yours and offers "Show" to jump straight to it. Tooltips are drawn in the panel's colours.
- **Themed scrollbars.** The page's scrollbars and the panel's slim one take the selected theme's primary colour. Turn the page's off with `scrollbars: false`.
- **Accessible panel.** A labelled dialog with focus trap, Escape, the colour button or an outside click to close, keyboard operable, and reduced-motion support.

## How it works

Every colour is one of 35 tokens (`primary`, `surface`, `ink`, `data-1`…), exposed as `--color-<token>` CSS variables. Applying a theme just sets those variables on `<html>`, so anything the site paints with `var(--color-primary)` (directly, or through Tailwind CSS v4 utilities like `bg-primary`) changes instantly. There's no rebuild and no re-render.

The switcher renders into a `<colorsbymax-root>` element on `<body>` with its own shadow root and stylesheet. Only the `--color-*` variables cross into it. With reduced motion, the colour button's dot holds still on the theme's primary colour.

<br>

<img src="https://raw.githubusercontent.com/MaxMuyalwa/colorsbymax/main/docs/readme/section-control.svg" alt="04 · Full control: paint with colour tokens" width="100%">

## Add it to a site

This is the full setup, for sites that want exact control over which colour goes where. colorsbymax needs React 18 or 19, and ships as plain JavaScript with TypeScript types, so Vite, Next.js, webpack and other bundlers use it without extra setup:

1. **Paint the site with the token variables.** Use `var(--color-<token>)` wherever the site sets a colour, with your own colours as the starting values.

   With Tailwind CSS v4, import the defaults (`colorsbymax/tokens.css` is Tailwind v4 syntax), override them, and use the token utilities (`bg-primary`, `text-ink`, …) instead of hard-coded colours:

   ```css
   @import "tailwindcss";
   @import "colorsbymax/tokens.css";

   @theme static {
     --color-primary: #c67cde; /* your colours */
   }
   ```

   With plain CSS, or Tailwind before v4, define the variables yourself:

   ```css
   :root {
     --color-primary: #c67cde;
   }
   .button {
     background: var(--color-primary);
   }
   ```

2. **Wrap the app and render the switcher:**

   ```jsx
   import { ThemeProvider, ThemeSwitcher } from 'colorsbymax'

   <ThemeProvider config={config}>
     <App />
     <ThemeSwitcher />
   </ThemeProvider>
   ```

   The switcher needs React but not a React site: `autoMount` from `colorsbymax/auto` mounts it on its own next to any page.

3. **Add the pre-paint script** to `<head>`, as a classic inline `<script>`, using the same storage key. `prePaintScript(storageKey)` returns its source, and `demo/index.html` shows it in place.

Without a `siteName`, the site group is named from the page's `og:site_name`, its title or its host name.

### Config

```js
{
  siteName: 'Tsungi',               // name of the first theme group
  storageKey: 'tsungi-theme',       // localStorage key (match the pre-paint script)
  defaultTheme: { name, tokens },   // the site's own colours; missing tokens are filled in
  themes: [{ id, name, tokens }],   // optional extra themes made for the site
  usage: { primary: 'Buttons…' },   // optional notes shown in the colour editors
  scrollbars: true,                 // colour the page's scrollbars from the theme (default)
  pdf: loadPdf,                     // optional: allow PDF uploads (see below)
  recolour: 'auto',                 // re-colour hard-coded colours: 'auto' (only if the site has
                                    // no --color-* variables, the default), true or false
  position: 'bottom-right',         // where the button starts: bottom-right (default), bottom-left,
                                    // top-left, or top-right (just under a floating nav bar)
  hidden: import.meta.env.PROD,     // hide the button (the theme still applies), e.g. in production
  intro: true,                      // the button pops in with a burst of the theme's colours a moment
                                    // after the page loads (default); reduced motion fades it in
}
```

### Dark mode

Dark mode works on any site: every theme has a dark twin, so choosing Dark (or Auto, on a device set to dark) re-colours the whole page, and text, buttons and icons are checked for contrast on the dark background. It applies on every page load, and keeps working when the switcher is hidden in production.

Give visitors a light and dark switch anywhere, styled your way, by marking an element with `data-colorsbymax-mode`:

```html
<button data-colorsbymax-mode="toggle">Light / dark</button>
```

`toggle` switches between light and dark; `light`, `dark` and `system` set one mode. colorsbymax wires the click, remembers the choice and sets `aria-pressed`. The page is marked with the current mode, for anything your CSS wants to adjust, like photos:

```css
html[data-colorsbymax-scheme="dark"] .hero-photo {
  filter: brightness(0.9);
}
```

With `ThemeProvider`, `useTheme()` gives `mode` ('light' or 'dark'), `modeSetting` (including 'system') and `setMode(mode)`, for building your own switch.

### PDF uploads

Building a palette from an image works out of the box. PDFs, such as brand guides, need [PDF.js](https://mozilla.github.io/pdf.js/), which is large, so it's opt-in: install it and pass the loader from `colorsbymax/pdf`.

```bash
npm install pdfjs-dist
```

```jsx
import { loadPdf } from 'colorsbymax/pdf'

<ThemeProvider config={{ ...config, pdf: loadPdf }}>
```

PDF.js still downloads only when a visitor picks a PDF. Sites that don't opt in never install or bundle it, and the upload offers images only.

`examples/tsungi.config.js` is a complete example for tsungi.online, the first site to use colorsbymax.

<br>

<img src="https://raw.githubusercontent.com/MaxMuyalwa/colorsbymax/main/docs/readme/section-ship.svg" alt="05 · Ship it: keep your colours and go live" width="100%">

## Finished? Keep your colours and hide the switcher

The colours you pick in the panel are saved only in your own browser. When you're happy with them, press **I'm done** at the bottom of the panel. It shows your colours and three ways to finish, each with code to copy and a prompt you can paste into Claude, Cursor, Copilot or any AI editor. **Cancel, keep using colorsbymax** takes you back without changing anything.

### Keep the colours and hide it in production (recommended)

Make your pick the site's default for everyone, and keep the button out of production while it still shows when you run the site locally, so you can keep iterating:

```js
// With the one-line setup, replace `import 'colorsbymax/auto'` with:
import { autoMount } from 'colorsbymax/auto'

autoMount({
  defaultTheme: { name: 'Ocean', tokens: { primary: '#0d6b84', /* …every colour… */ } },
  hidden: import.meta.env.PROD,
})
```

With `ThemeProvider`, add the same `defaultTheme` and `hidden` to its `config`. The panel fills in all your colours for you. Not using Vite? Use `process.env.NODE_ENV === 'production'` in place of `import.meta.env.PROD` (Next.js, webpack).

**Bring it back later:** it keeps showing in development. To show it in production again, set `hidden: false` or remove the line, or ask your AI editor: *"Show the colorsbymax colour switcher again in production: in its config, set hidden to false or remove the hidden line."*

### Hide it on this device only

Hides the button in your browser straight away, with no code change and nothing different for anyone else. **To bring it back**, press **Alt+Shift+C** on the page, or open it with `?colorsbymax` at the end of the address.

### Remove colorsbymax

1. `npm uninstall colorsbymax`
2. Delete its import (`import 'colorsbymax/auto'`, `autoMount`, or `ThemeProvider` and `ThemeSwitcher`) and any colorsbymax pre-paint script.
3. Keep your colours:
   - If your site uses the `--color-*` variables, paste the CSS the panel gives you (`:root { --color-primary: …; … }`) into your global stylesheet.
   - If colorsbymax was re-colouring hard-coded colours for you, the chosen colours only exist while it runs, so your CSS needs updating to them. The panel's prompt asks your AI editor to do that.

To bring it back later, install it again and follow the [Quick start](#quick-start).

## Updating

```bash
npm install colorsbymax@latest
```

This moves you to the newest release and records it in your `package.json`. `npm update` alone isn't enough while colorsbymax is below 1.0: with the usual `^0.1.0` range, npm treats 0.2.0 as a breaking change and stays on 0.1.x. Check which version you have with `npm ls colorsbymax`.

If it still installs the old version right after a release, npm is using its cached list of versions; add `--prefer-online` to check the registry:

```bash
npm install colorsbymax@latest --prefer-online
```

What changed in each release, and anything you need to do when upgrading, is in [CHANGELOG.md](CHANGELOG.md).

<br>

<img src="https://raw.githubusercontent.com/MaxMuyalwa/colorsbymax/main/docs/readme/section-hood.svg" alt="06 · Under the hood: build, regenerate, contribute" width="100%">

## Building the package

`src/` is the source; `dist/` is what sites install: plain JavaScript with the JSX compiled away. `types/` holds the hand-written TypeScript declarations; `npm run typecheck` compiles `types/check.tsx` against them and checks they match the built exports. The panel's icons are copied from Lucide into `src/icons.jsx` by `npm run icons`. `dist/` is committed so installs straight from GitHub work even when npm skips install scripts, so rebuild it before committing changes to `src/`. `npm publish` also rebuilds it first:

```bash
npm run build
```

## README artwork

The hero, the section banners and the navigation chips are SVGs in `docs/readme/`, drawn by `scripts/make-readme-art.mjs` from colorsbymax's own themes:

```bash
node scripts/make-readme-art.mjs
```

## Panel styles

The panel is styled with Tailwind classes in `src/ThemePanel.jsx` and `src/ThemeSwitcher.jsx`. `scripts/build-css.mjs` compiles them, with `src/panel.css`, into `src/panel-css.generated.js`. The demo server does this automatically as you edit; otherwise run:

```bash
npm run css
```

## Regenerating the library

```bash
npm run presets
```

`scripts/generate-presets.mjs` turns each source palette into a full theme, auto-fixes contrast, drops anything that still fails or duplicates another theme, names it and tags its categories. Adjust the category rules at the top of the script.

## Notices

The library palettes come from [nice-color-palettes](https://github.com/Jam3/nice-color-palettes) (MIT). Its licence notice is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and must ship with every copy.

PDF reading uses [pdfjs-dist](https://github.com/mozilla/pdf.js) (Apache-2.0), installed as a dependency rather than bundled into colorsbymax.

## Licence

colorsbymax is released under the [MIT Licence](LICENSE). The names colorsbymax™ and mrmaxdesigns are marks of Max Muyalwa and aren't covered by the code licence.
