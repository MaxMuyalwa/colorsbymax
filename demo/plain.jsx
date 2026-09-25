import { createRoot } from 'react-dom/client'
import { ThemeProvider, ThemeSwitcher } from '../src/index.js'
import { loadPdf } from '../src/pdf.js'

// A plain-CSS site that isn't a React app: colorsbymax mounts on its own, next to the page.
createRoot(document.getElementById('colorsbymax')).render(
  <ThemeProvider
    config={{
      siteName: 'Northfield',
      storageKey: 'colorsbymax-plain-demo',
      pdf: loadPdf,
      defaultTheme: {
        name: 'Northfield Crust',
        tokens: {
          // Deep enough for white button text and for links on the cream page (contrast checked).
          primary: '#9f4925',
          'app-primary': '#8d4121',
          'primary-dark': '#6b2d14',
          background: '#fbf6ef',
          secondary: '#f3e3d3',
          'on-secondary': '#6b2d14',
          border: '#e6d5c3',
          ink: '#2b1a10',
          'ink-secondary': '#6b5444',
        },
      },
    }}
  >
    <ThemeSwitcher />
  </ThemeProvider>,
)
