import { loadPdf } from '../../src/pdf.js'

// colorsbymax's own site, and the demo: every colour on the page is a colorsbymax token, so the
// whole page re-colours with whatever theme you pick. It uses every token group.
export const config = {
  siteName: 'colorsbymax',
  storageKey: 'colorsbymax-demo',
  pdf: loadPdf,
  // The button sits just under this page's floating nav bar.
  position: 'top-right',
  // The colorsbymax wordmark is drawn in the theme's own colours, so themes colour it too.
  colourLogo: true,
  // The site opens in dark mode; visitors can switch to light or Auto.
  defaultMode: 'dark',
  defaultTheme: {
    name: 'colorsbymax Violet',
    // Checked with colorsbymax's own contrast rules: every pairing passes, in light and in dark.
    tokens: {
      primary: '#593bf5',
      'app-primary': '#5333f5',
      'primary-dark': '#1e1b4b',
      'primary-alt': '#e0457b',
      secondary: '#ece9fe',
      'on-secondary': '#3b2a8f',
      background: '#fbfaff',
    },
  },
}
