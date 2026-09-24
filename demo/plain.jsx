import { createRoot } from 'react-dom/client'
import { ThemeProvider, ThemeSwitcher } from '../src/index.js'

// A plain-CSS site that isn't a React app: colorsbymax mounts on its own, next to the page.
createRoot(document.getElementById('colorsbymax')).render(
  <ThemeProvider
    config={{
      siteName: 'Northfield',
      storageKey: 'colorsbymax-plain-demo',
      defaultTheme: {
        name: 'Northfield Crust',
        tokens: {
          primary: '#b4532a',
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
