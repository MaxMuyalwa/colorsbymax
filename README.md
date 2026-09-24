# colorsbymax™

**by mrmaxdesigns**

A floating theme switcher for websites. Visitors (or the site's owner) can re-colour the whole site instantly: pick one of the site's own themes, a hand-tuned pick, or one of 715 library themes in 14 categories; build and share custom palettes; or override single colours. Every theme is checked against the Web Content Accessibility Guidelines (WCAG) contrast rules, with one-click fixes.

## Features

- **Site themes first.** The panel opens on a group named after the site, holding its own colours. If those fail contrast, an accessible version is generated automatically.
- **Picks and library.** 5 hand-tuned picks, plus 715 library themes (Bright, Fun, Pastel, Earth tones, Summer, Autumn, Winter, Spring, Ocean, Warm, Nature, Moody, Monochrome, Eclectic) with search and "Surprise me". The library loads only when the panel opens.
- **Custom palettes, single-colour overrides, JSON import/export.**
- **Contrast checks.** Problems show as a badge on the theme; the breakdown offers per-item fixes or "Fix all automatically", which changes lightness only.
- **No flash on reload.** An inline pre-paint script applies the saved theme before the page draws.
- **Accessible panel.** A labelled dialog with focus trap, Escape and outside-click to close, keyboard operable, and reduced-motion support.

## How it works

Every colour is one of 35 tokens (`primary`, `surface`, `ink`, `data-1`…), exposed as `--color-<token>` CSS variables. In a Tailwind CSS v4 site, utilities like `bg-primary` compile to `var(--color-primary)`, so applying a theme just sets those variables on `<html>`. There's no rebuild and no re-render.

## Try the demo

```bash
npm install
npm run dev
```

This serves `demo/`, a fictional studio site that uses every token group.

## Add it to a site (React + Tailwind CSS v4)

1. **Map the site's colours to tokens.** Import the defaults, override them with your colours, and use the token utilities (`bg-primary`, `text-ink`, …) instead of hard-coded colours:

   ```css
   @import "tailwindcss";
   @import "colorsbymax/tokens.css";
   @source "../node_modules/colorsbymax/src"; /* compiles the panel's classes */

   @theme static {
     --color-primary: #c67cde; /* your colours */
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

3. **Add the pre-paint script** to `<head>`, as a classic inline `<script>`, using the same storage key. `prePaintScript(storageKey)` returns its source, and `demo/index.html` shows it in place.

### Config

```js
{
  siteName: 'Tsungi',               // name of the first theme group
  storageKey: 'tsungi-theme',       // localStorage key (match the pre-paint script)
  defaultTheme: { name, tokens },   // the site's own colours; missing tokens are filled in
  themes: [{ id, name, tokens }],   // optional extra themes made for the site
  usage: { primary: 'Buttons…' },   // optional notes shown in the colour editors
}
```

`examples/tsungi.config.js` is a complete example for tsungi.online, the first site to use colorsbymax.

## Regenerating the library

```bash
npm run presets
```

`scripts/generate-presets.mjs` turns each source palette into a full theme, auto-fixes contrast, drops anything that still fails or duplicates another theme, names it and tags its categories. Adjust the category rules at the top of the script.

## Notices

The library palettes come from [nice-color-palettes](https://github.com/Jam3/nice-color-palettes) (MIT). Its licence notice is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and must ship with every copy.

colorsbymax™ and mrmaxdesigns are marks of Max Muyalwa. No licence has been chosen for this code yet, so all rights are reserved.
