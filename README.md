# colorsbymax™

**by mrmaxdesigns**

A floating theme switcher for websites. Visitors (or the site's owner) can re-colour the whole site instantly: pick one of the site's own themes, a hand-tuned pick, or one of 715 library themes in 14 categories; build and share custom palettes; or override single colours. Every theme is checked against the Web Content Accessibility Guidelines (WCAG) contrast rules, with one-click fixes.

**At a glance**

- **Two steps.** `npm install colorsbymax`, then `import 'colorsbymax/auto'` once. The colour button appears and visitors can re-colour the site, even if its colours are hard-coded (see [Quick start](#quick-start)).
- **React 18 or 19.**
- **Tailwind optional.** The panel carries its own styles, so it works with Tailwind v4, older Tailwind or plain CSS. Your site only needs to paint its colours with `var(--color-…)` variables. The optional `colorsbymax/tokens.css` helper is for Tailwind v4 (`@theme` syntax); without Tailwind v4, define the variables yourself.
- **TypeScript types included.**
- **No runtime dependencies** besides React. PDF uploads are opt-in and need `pdfjs-dist` (see [PDF uploads](#pdf-uploads)).
- **ESM only.** Import it from a bundler or `import()`; `require('colorsbymax')` from CommonJS isn't supported.
- **The colour tools work on their own too.** `contrastRatio`, `checkTheme`, `suggestFix`, `fixAll`, `themeFromPalette`, `darkTokens` and the rest are plain functions with no UI.

## Features

- **Site themes first.** The panel opens on a group named after the site, holding its own colours. If those fail contrast, an accessible version is generated automatically.
- **Scan the site.** Press "Scan site" and colorsbymax reads the colours actually painted on the page (ignoring any theme it has applied, and including gradients). It works out the page background, surfaces, text and brand colours, then adds themes named after the site: Scanned (as found), Accessible, Soft, Bold, Complementary, and the closest library matches. Scans run only when asked, and the results are remembered.
- **Max’s picks and library.** 5 hand-tuned picks, plus 715 library themes (Bright, Fun, Pastel, Earth tones, Summer, Autumn, Winter, Spring, Ocean, Warm, Nature, Moody, Monochrome, Eclectic) with search and "Surprise me". The library loads only when the panel opens.
- **Custom palettes, single-colour overrides, JSON import/export.**
- **Palettes from images and PDFs.** In Import / export, upload or drop a mood board, screenshot or photo. colorsbymax picks out its main colours, lets you leave any out, previews the palette it builds around them and saves it as a custom palette. Nothing leaves the browser. PDFs, such as brand guides, work where the site [turns them on](#pdf-uploads); hex codes written in a PDF take priority.
- **Contrast checks.** Problems show as a badge on the theme; the breakdown offers per-item fixes or "Fix all automatically", which changes lightness only.
- **No flash on reload.** An inline pre-paint script applies the saved theme before the page draws.
- **Works on any site.** The panel carries its own stylesheet inside a shadow root, so it needs no Tailwind or other CSS from the site, and the site's CSS can't restyle it.
- **Movable colour button.** The floating button starts in the corner; visitors can drag it anywhere (mouse or touch; a tooltip says so on hover, and the panel closes while it moves) and it stays there, remembered across reloads. The panel then opens beside it, on whichever side has room. Its dot cycles through the current theme's colours.
- **Light and dark mode.** Every built-in theme is designed light; dark mode lists a generated dark twin of each (dark surfaces, light text, brand colours lifted to read on dark, then contrast-fixed) and switches the current theme to its twin. The panel turns dark with it. Custom palettes stay as they were made.
- **Visitor settings.** The gear in the panel header opens settings: theme mode (Light, Dark, Auto), panel size (Compact, Standard, Large), which groups and sections to show, whether the button can be dragged or its dot animates, and moving the button back to its corner. Saved per site.
- **Resizable panel.** Drag the panel's free edges or corner (the ones away from the colour button) to any size, or pick a size in settings; double-click an edge to reset it. The layout follows the panel's width, so a large panel shows three theme cards a row.
- **Clear groups and feedback.** The site's own group (globe), Max’s picks (paintbrush) and Yours (person) sit in their own row, apart from the library's categories. Toasts confirm what just happened; saving, importing or building a palette says it went to Yours and offers "Show" to jump straight to it. Tooltips are drawn in the panel's colours.
- **Themed scrollbars.** The page's scrollbars and the panel's slim one take the selected theme's primary colour. Turn the page's off with `scrollbars: false`.
- **Accessible panel.** A labelled dialog with focus trap, Escape, the colour button or an outside click to close, keyboard operable, and reduced-motion support.

## How it works

Every colour is one of 35 tokens (`primary`, `surface`, `ink`, `data-1`…), exposed as `--color-<token>` CSS variables. Applying a theme just sets those variables on `<html>`, so anything the site paints with `var(--color-primary)` (directly, or through Tailwind CSS v4 utilities like `bg-primary`) changes instantly. There's no rebuild and no re-render.

The switcher renders into a `<colorsbymax-root>` element on `<body>` with its own shadow root and stylesheet. Only the `--color-*` variables cross into it. With reduced motion, the colour button's dot holds still on the theme's primary colour.

## Try the demo

```bash
npm install
npm run dev
```

This serves `demo/`: colorsbymax's own landing page, built with Tailwind, where every colour is a token (it uses every token group, and a strip shows the live values); `/plain.html`, a plain-CSS bakery site with deliberately careless global styles to show they don't reach the panel; and `/unwired.html`, a coffee shop with only hard-coded colours whose whole setup is `import 'colorsbymax/auto'`.

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

   With plain CSS, or Tailwind before v4, define the variables yourself (`demo/plain.html` shows this):

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

   The switcher needs React but not a React site: `demo/plain.jsx` mounts it on its own next to a static page.

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
}
```

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

## Building the package

`src/` is the source; `dist/` is what sites install: plain JavaScript with the JSX compiled away. `types/` holds the hand-written TypeScript declarations; `npm run typecheck` compiles `types/check.tsx` against them and checks they match the built exports. The panel's icons are copied from Lucide into `src/icons.jsx` by `npm run icons`. `dist/` is committed so installs straight from GitHub work even when npm skips install scripts, so rebuild it before committing changes to `src/`. `npm publish` also rebuilds it first:

```bash
npm run build
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
