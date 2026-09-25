# Changelog

What changed in each colorsbymax release. Update with `npm install colorsbymax@latest`.

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
