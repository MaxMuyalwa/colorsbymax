# Changelog

What changed in each colorsbymax release. Update with `npm install colorsbymax@latest`.

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
