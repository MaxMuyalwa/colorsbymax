# Changelog

What changed in each colorsbymax release. Update with `npm install colorsbymax@latest`.

## Unreleased

- **Sliding pills work.** A nav item, tab or segmented control whose active state is a separate pill underneath it (shadcn and Radix animated tabs, framer-motion `layoutId` pills) now counts that pill as its background, everywhere colorsbymax asks what something sits on: the re-colouring engine, the contrast guard and Studio. Before, Colourful repainted the pill as a pale badge and the active item's text was matched to the bar, so it could vanish (1.10:1). When the active item changes, it's read again once the pill has slid into place. Thanks to the user who reported it, with the cause.
- **An empty shape isn't a badge.** Colourful only paints a small rounded fill as a badge when it has words in it, so decorative pills, dots and indicators keep their colour.
- **One rule for white on brand, on every theme.** On the site's own colours too, the contrast guard now deepens a brand fill until its light text reads (a "Clock in" button keeps its white text) instead of turning the text dark, matching what happens with any other theme.

## 0.5.1 (2026-10-02)

- **Ghost buttons keep their shape.** On sites colorsbymax re-colours, Colourful and Subtle no longer paint a filled circle or box behind buttons that have no fill or outline of their own, like toolbar icons and tabs.
- **White text on brand buttons stays white.** Where a site puts light text on a brand-coloured fill (a "Clock in" button, a banner) and the theme's colour is too light for it, the fill is deepened until the white reads, instead of the text turning dark.
- **Colourful's cards** take the same tint as the page, rather than the theme's second brand colour, which could clash on large surfaces.

## 0.5.0 (2026-10-01)

- **Studio.** A new **Studio** button in the panel header opens a deeper way to colour a site, with **Back to the switcher** to return to the quick one. It starts with where the colours go: the whole site, or only some pages. Studio offers the site's own pages (the ones the page links to, and the ones you've opened), and `/*` covers a whole section. The choice is saved on your device, and Studio gives you the config line and an AI-editor prompt that make it everyone's. Pages left out keep their own colours, dark mode included; the quick switcher says so when you open it there. Switch Studio off with `features: { studio: false }`.
- **Studio: point and click.** Click any part of the page (a button, a card, a heading, the footer) and give it its own background, text and border, from the theme's colours or any colour. Change just that part or every part like it, step out to the part around it or back into the part inside it, and see at once whether its text is readable: every piece of text in it is checked against what it really sits on, and **Fix** picks a text colour that reads on all of it and checks the result. Swatches that would be hard to read are marked. Picking another theme while you have Studio changes asks whether to keep or clear them. Changes are listed page by page, kept on your device and drawn before the page first shows, and **Keep them for good** turns them into a prompt for your AI editor, or plain CSS.
- **Subtle, Balanced and Colourful, on every site.** The colour style now makes a clear difference everywhere. **Subtle** keeps your site's own backgrounds, cards and text; the theme's colour comes in on buttons, links and highlights, with only a quiet hint of it on badges and tints (on a plain black-and-white site too). **Balanced** (new) is the theme in every role, with a soft wash of it across the page, cards and borders, so it shows even where a theme's own backgrounds are nearly white. Your site's own colours stay exactly as designed. **Colourful** is an overhaul: the page, cards and borders take a clear tint of the brand, light or dark, and text and headings a hint of it. On a site that paints with the colour variables it works through them alone, so the site's own design decides where each colour goes; on a site colorsbymax re-colours it also paints the page by role (header, hero, tinted sections, headings, cards, buttons and footer).
- **A contrast guard, on every site and in every style.** After the colours change, every piece of text and every icon is checked against what it really sits on, see-through layers and gradients included, and anything hard to read is brought up to WCAG (4.5:1 for text, 3:1 for large text and icons), keeping its own hue where it can so status colours keep their meaning. It never runs while you scroll. Mark a deliberate example of poor contrast `data-colorsbymax-contrast="keep"` to leave it as it is.
- **A bell for updates and news.** When a newer colorsbymax is published, the panel's bell (and a red dot on the colour button) says so, with what changed, `npm install colorsbymax@latest` to copy, a prompt for your AI editor and a link to the changelog. It also shows news from mrmaxdesigns. It checks once a day, and by default only on development addresses, never to a live site's visitors; set `updates: true` or `false` to choose.
- **A strength slider for Colourful,** from a light wash to bold: how much the page, sections and cards are tinted, whether headings take the brand colour, and how deep the footer goes. `colourStrength` (0 to 100) sets where first-time visitors start.
- **Tints from your pictures.** Colourful can take its washes from your logo and photos, so they feel made for your site; buttons and links keep the theme's colours. It's on by default, and the panel shows the colours it found. Pictures from another site that doesn't allow reading them are skipped.
- **Studio learns across pages.** A change can go on just one part, every part like it on the page, or every part like it on every page of your site. Those show on every page as you open them, and the prompt asks your AI editor to change the shared component.
- **Colourful reads the page more deeply,** on sites colorsbymax re-colours. Besides the header, hero, sections, cards and footer, it now recognises pricing tables (plans as cards, the most popular one ringed in the brand colour), testimonials (on their own wash, with a brand bar on each), forms (a tinted band, a raised form box, readable labels), image-led sections (kept on the plain page colour so pictures show true, with a soft shadow) and the current page in the menu.
- **`pages` config option: only colour some pages,** e.g. `pages: ['/', '/pricing', '/blog/*']`. Every other page keeps its own colours. Single-page apps are followed as they change page, and the pre-paint script leaves those pages alone too, so they never flash in the theme.
- **A calmer panel header:** just Light, Dark and Auto, Studio and settings. **Audit** moved into Studio (it stays in the header if a site switches Studio off), and **Add a light and dark switch to your site** into settings and the I'm done screen.
- **A tidier panel.** The Subtle / Colourful switch and Scan site have their own **Colour style** section above Preset themes, so Preset themes opens straight onto search, Surprise me and the themes. The current theme's name shows beside Preset themes.
- The panel's heading reads plain "colorsbymax", without the ™.
- **Upgrading:** sites that paint with the `--color-*` variables now start in Balanced: their own colours look exactly as before, and other themes take a soft wash. Sites colorsbymax re-colours still start in Colourful. Set `colourStyle` to choose. A visitor who had picked Colourful on a variables site now sees its stronger tints.
- **Upgrading:** if you copied the pre-paint script into your HTML by hand, copy the new one from `prePaintScript()`. The old one still works, but it would briefly paint the theme on pages left out.

## 0.4.1 (2026-09-27)

- **Export as CSS.** Import / export now has a JSON / CSS switch: CSS gives the current theme as `--color-*` variables on `:root`, to copy or download as a `.css` file.
- **Room for a bar above your nav.** Set `--colorsbymax-offset-top` on `<html>` (in px) to the height of anything pinned to the top of your page, such as an announcement banner, and the colour button and its panel move down by it instead of sitting on top of it.

## 0.4.0 (2026-09-26)

- **`features` config option: switch parts of the panel off for everyone,** e.g. `{ scan: false, audit: false }`: Max's picks, the library, search, Surprise me, Scan site, custom palettes, single-colour overrides, import / export, Audit, Add to site, the Subtle / Colourful switch and colour counts. It's read live, so a site can turn things off from its own settings without a redeploy.
- **Choose how many colours a theme uses, 5 to 10.** Every theme starts with its five core colours (brand, gradient partner, deep brand, background and text), for a calm, cohesive site. − and + on the theme in use add or remove colours for that theme, and the panel's settings set the count for every theme, with a sample palette. Extras come back in order of how well they fit the theme (in a forest theme, green chart colours before a bright blue), and a colour that's left out is painted with the ones that remain, so the site really uses fewer. Every one of the 715 library themes, light and dark, at every count, keeps its contrast.
- **The panel starts folded.** Preset themes, Custom palettes, Override a single colour and Import / export all start closed on a first look, so it isn't overwhelming; each opens with a tap (and, like everything else, stays as you left it when you close and reopen the panel).
- **Search by colour.** Typing clears the way: the groups and the library step aside so only matching themes show, with a count and a Light / Dark switch above them. A colour word ("red", "navy") finds themes by their actual colours, not only their names, and suggestions finish the word as you type ("b": blue, brown, black…), mood names included.
- **Closing the panel is like minimising it.** Open it again and it's just as you left it: the same group or library mood, search, open sections and scroll position.
- **Colourful and Subtle.** On a site colorsbymax re-colours (one that doesn't paint with the --color-* variables), themes used to only swap the colours the site already had, so a plain white-and-black site barely changed. The new **Colourful** style, now the default, paints the page by role, like colorsbymax's own site: the header, a hero lit with the brand colour (with any emphasis in its headline as a gradient), sections taking turns with a soft tint, cards, brand-coloured buttons and links, deep-brand headings, badges, fields, tables and quotes, a brand-gradient call to action, and a footer in the secondary colour, with hover effects. Every text colour is checked against what it sits on. **Subtle** keeps the old behaviour there. The switch is in the panel on every site: on one painted with the colour tokens (like colorsbymax's own), Subtle calms the page's backgrounds, cards and tints to near-neutral and keeps the theme's colour for buttons, links and highlights, and the finish screen's CSS follows it. The new `colourStyle` config option sets the default.
- **Black or grey logos stay readable on dark themes.** A logo keeps its own colours, but a plain black or grey one now follows the theme's text colour instead of vanishing on a dark background.
- **The panel's header fits on a phone.** On a narrow panel the Light / Dark / Auto, Add to site, Audit and settings buttons no longer sit on top of the colorsbymax title; they sit on their own centred row below it, with a little more room. Reported through the site's feedback form.
- **Picking colorsbymax, Max’s picks or Yours scrolls to its themes,** as picking a library mood already did, so the colours are right there. The scroll now also lands clear of the panel's header.
- **The panel's header is centred on a phone:** the logo, name and "by mrmaxdesigns" on top, the tools on their own row below.
- **A clearer library.** It sits in a box of its own with a heading that says what it is ("715 palettes sorted by mood"), so it reads as one place to browse.
- **Nothing cut off on a phone:** the colorsbymax / Max’s picks / Yours labels wrap under their icons instead of being cut off, and the search box says "Search 700+ themes…" in full.
- **Surprise me bursts with colour,** like the colour button, in the theme it just picked. When the group showing has a single theme it picks from the whole library, and never the theme already on.

## 0.3.3 (2026-09-25)

- **The panel's header shows the mrmaxdesigns mark** (three slanted bars) before "colorsbymax", in the current theme's colours, deepened or lightened so each bar stands out on the light or dark panel.
- The colorsbymax site: feedback reports are now emailed straight to Max (through Resend), screenshots attached; the floating tags around the hero are gone.

## 0.3.2 (2026-09-25)

- **`defaultMode` config option:** the mode first-time visitors start in, `'light'` (the default), `'dark'` or `'system'` to follow their device. Any site can start dark, since every theme has a dark twin, and visitors can still switch. The colorsbymax site now opens in dark mode.
- The colorsbymax site's browser-tab icon is the mrmaxdesigns logo mark in the current theme's colours, with a version for light tabs and one for dark tabs, each checked to stand out.

## 0.3.1 (2026-09-25)

- **`colourLogo` config option:** start with "Colour the logo too" on, for sites whose logo is drawn in the theme's colours. It's off by default, so logos keep their own colours, and visitors can still change it in settings. It also applies when the switcher is hidden. The colorsbymax site turns it on for its wordmark.

## 0.3.0 (2026-09-25)

- **Dark mode for every site, on every load.** The mode now lives in the theme provider: a saved Dark (or Auto on a dark device) turns the whole site dark as soon as it loads, not only when the mode is changed, and it keeps working when the switcher is hidden. Before, the panel could go dark while the site stayed light. Sites without a dark mode of their own get one: every theme's dark twin re-colours the page, contrast-checked.
- **A light and dark switch for your site:** mark any element with `data-colorsbymax-mode="toggle"` (or `light`, `dark`, `system`) and colorsbymax wires it up and remembers the choice. `<html>` gets `data-colorsbymax-scheme` with the current mode, and `useTheme()` has `mode`, `modeSetting` and `setMode`.
- **Light, Dark and Auto in the panel's header**, next to Audit, so they're one click away.
- **"Add to site": a light and dark switch for your site.** Next to the mode buttons, it previews a working switch in your page's top bar (until reload) and gives the code (HTML or React, plus styles) and a prompt for Claude, Cursor or Copilot to add it for good.
- **Plain sites show off a theme.** On a site with no brand colour of its own (greys and text), grey icons and plain text links now take the theme's brand colour, contrast-checked, so a theme visibly changes the page.
- **A burst of colour on every click** of the colour button, not only when it first appears.
- **The panel stays open while you drag the button**, and moves with it.
- **Picking a library category scrolls to its themes**, so the colours are in view straight away.
- **Feedback on the colorsbymax site:** a Feedback button in the top bar (and the menu and footer) opens a form for bug reports, suggestions, praise and questions, with the areas it's about, a rating, steps to reproduce, expected and actual results, severity, several screenshots (pasted, dropped, chosen or captured from the page) and technical details attached automatically. The coffee and bakery demo pages are gone: the colorsbymax site is the demo. The site also asks for feedback in its own section, and has a support page (buy Max a coffee, coming soon).
- **The colour button makes an entrance.** A moment after the page loads, it pops in with a burst of squiggles, dots and dashes in the theme's colours, so visitors notice it arrive. With reduced motion it simply fades in. Turn it off with `intro: false`.
- **A new colorsbymax site** at [mrmaxdesigns.com/colorsbymax](https://mrmaxdesigns.com/colorsbymax): what colorsbymax does and why, every colour role explained with a live preview, the rules of good colour (with a little history), setup guides, coding-agent setup, and a way back to mrmaxdesigns.com. Every colour on it follows the theme you pick.
- **Set-up steps for many more coding agents,** in the README, the MCP README and the site: GitHub Copilot CLI, Codex, Google Antigravity, Gemini CLI, Grok Build, Windsurf, Kiro, Zed, JetBrains, Cline and Roo, and opencode, alongside Claude Code, Cursor, VS Code and Claude Desktop. The MCP server's docs tool has a new `agents` topic with all of them (colorsbymax-mcp 0.1.3).
- **Dark themes always read.** A dark twin's brand, data and status colours are now lifted until they measurably pass against the dark background, and buttons get whichever text colour (dark or white) reads best. Before, a few vivid blues and violets stayed too dark to read (7 of the 720 built-in themes, and some sites' own colours); now every built-in theme passes every check in both light and dark.
- The colorsbymax site's own colours now pass every contrast check in light and dark.
- Fixed: when the colour button was hidden on a device, the next page load could stop the switcher with an error.
- The demo is live at [mrmaxdesigns.com/colorsbymax](https://mrmaxdesigns.com/colorsbymax), now the package's homepage.

## 0.2.3 (2026-09-25)

- **Paste an image to build a palette.** Took a screenshot of something whose colours you like? Open the panel and press Ctrl+V (⌘V on a Mac), or use the new **Paste image** button in Import / export. Import / export opens by itself and shows a thumbnail of the image, marked "Image pasted", with its size and a button to remove it (dropped and chosen images get the same preview). Pasting text into a field still works as usual.
- The README and the MCP README now explain the steps after adding the MCP server: start a new session, ask your agent to add colorsbymax, and run your site.

## 0.2.2 (2026-09-25)

- **MCP server for AI agents.** [colorsbymax-mcp](mcp/) lets Claude Code, Cursor, VS Code Copilot and other agents set colorsbymax up in a project (with the right edits for Vite, Next.js, Remix, Astro, Nuxt, SvelteKit, plain HTML and more), find themes, build one from brand colours, check contrast and finish. Add it with `claude mcp add colorsbymax -- npx -y colorsbymax-mcp`.
- **A new README** with colour-coded sections and navigation, and a full guide to using colorsbymax with Claude Code, Cursor, VS Code Copilot, Claude Desktop, Windsurf, Cline and Codex, with or without the MCP server.
- Fixed: on sites whose body text is a warm or tinted dark (such as dark brown), re-colouring could take the text colour for the brand colour, so brand areas came out far too light or garish. The text colour is no longer a brand candidate.

## 0.2.1 (2026-09-25)

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
