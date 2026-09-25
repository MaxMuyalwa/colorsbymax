# Changelog

What changed in each colorsbymax release. Update with `npm install colorsbymax@latest`.

## 0.2.1 (unreleased)

- **Smarter colours when re-colouring a site.** After swapping, text and icons are only adjusted to undo harm the swap did: a pair that reads as well as the site's original design did is left alone (so deliberately soft icons stay soft), and a fix keeps the design's intent, so white icons on a coloured pill stay white, using the nearest theme colour that works. Icon-only buttons are judged as icons (3:1), not text (4.5:1). Across 59 themes on a test site, nothing reads worse than the original design.
- **Audit.** A new Audit button in the panel header checks the page in the chosen colours and pins numbered notes to what won't look right: a logo that's hard to see (offering "Colour the logo", or, for picture logos colorsbymax can't re-colour, advice and a "Preview inverted" look), pictures whose solid background shows as a box against the theme, and text or icons below readable contrast. A bar by the colour button shows the count and the theme's own contrast issues, with Re-check and Close; it re-checks by itself when the colours or settings change.
- **"I'm done": finish without the switcher popping up in production.** A new button at the bottom of the panel shows your chosen colours and three ways to finish, each with code to copy and a prompt for Claude, Cursor or Copilot: keep the colours as the site's default and hide the switcher in production (it still shows in development), hide it on this device only (Alt+Shift+C or `?colorsbymax` brings it back), or remove colorsbymax and keep the colours in your CSS. Cancel goes back.
- **`hidden` config option:** hides the colour button while the theme still applies, e.g. `hidden: import.meta.env.PROD`.
- A `defaultTheme` in the config is now applied on re-coloured sites too (it used to be treated as the page's original look), and the page's own colours stay available as "… original".
- **"Colour the logo too" setting**, off by default: the site's logo keeps its own colours whatever the theme. It works on re-coloured sites and on sites using the colour variables. colorsbymax finds logos by `data-colorsbymax-logo`, or "logo" in a class, id or label, or common brand classes.
- Fixed: content that appeared while a theme was showing could be re-coloured from the theme's colours instead of the site's, giving the wrong colour (for example buttons turning blue).
- Fixed: decorative gradient strips, like animated underlines, were treated as the background behind text and icons.
- When an element changes class (a nav item becoming active), its contents are re-checked too.

## 0.2.0 (2026-09-25)

**Upgrading from 0.1.x:** the colour button moves to the bottom-right corner; add `position: 'top-right'` to keep it where it was. If your site doesn't use colorsbymax's `--color-*` variables, themes now re-colour it automatically; to keep the old behaviour (themes set only the variables), pass `recolour: false` in the config.

- **One-line setup.** `import 'colorsbymax/auto'` puts the colour button on the page with no wrapping or config. `autoMount(config)` from the same entry takes settings.
- **Re-colours any site.** Sites with hard-coded colours are re-coloured by swapping the colours actually on the page for the chosen theme's, including gradients, borders and SVG icons, and content that appears later. Sites that use the colour variables work exactly as before.
- **The colour button now starts in the bottom-right corner**, where chat and help widgets usually sit, and the panel opens above it. `position` picks another corner; `position: 'top-right'` keeps 0.1's spot just under a floating nav bar. Visitors can still drag it anywhere.
- The site's own group shows its original colours ("… original") when colorsbymax is re-colouring it.

## 0.1.1 (2026-09-25)

**Upgrading from 0.1.0:** nothing to change for most sites. The one exception: PDF uploads are now opt-in. To keep them, install `pdfjs-dist` and pass the loader in your config:

```bash
npm install pdfjs-dist
```

```jsx
import { loadPdf } from 'colorsbymax/pdf'

<ThemeProvider config={{ ...config, pdf: loadPdf }}>
```

Without it, "Palette from an image" still works; it just takes images only. If you call `coloursFromFile` yourself, pass `{ loadPdf }` as its second argument for PDFs.

- **TypeScript types included.** No more "Could not find a declaration file for module 'colorsbymax'" (TS7016) in strict projects; `useTheme()`, the config and the colour helpers are fully typed.
- **Much smaller install.** No runtime dependencies besides React: about 440 KB instead of 44 MB. The panel's icons are built in, so it no longer adds a second copy of `lucide-react` next to your own, and PDF.js is no longer installed unless you opt in.
- **No install scripts**, so npm has nothing to ask you to approve for colorsbymax.
- Site scans ignore colour transitions, so sites that animate colour changes scan their own colours rather than the applied theme's.
- README: an "At a glance" section (Tailwind is optional, ESM only, types included) and PDF opt-in docs.

## 0.1.0 (2026-09-25)

First release: the floating colour button and panel, site themes and scan, Max's picks and the 715-theme library, custom palettes, overrides, JSON import/export, palettes from images and PDFs, light and dark mode, visitor settings, and WCAG contrast checks with one-click fixes.
