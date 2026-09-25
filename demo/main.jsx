import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, ThemeSwitcher } from '../src/index.js'
import { loadPdf } from '../src/pdf.js'
import { Nav } from './site/Nav.jsx'
import { Hero } from './site/Hero.jsx'
import { Stats, Why } from './site/Why.jsx'
import { Roles } from './site/Roles.jsx'
import { Rules } from './site/Rules.jsx'
import { Features } from './site/Features.jsx'
import { Setup } from './site/Setup.jsx'
import { Agents } from './site/Agents.jsx'
import { About, Closing } from './site/About.jsx'
import { Footer } from './site/Footer.jsx'
import './demo.css'

// colorsbymax's own site, and the demo: every colour on the page is a colorsbymax token, so the
// whole page re-colours with whatever theme you pick. It uses every token group.
const config = {
  siteName: 'colorsbymax',
  storageKey: 'colorsbymax-demo',
  pdf: loadPdf,
  // The button sits just under this page's floating nav bar.
  position: 'top-right',
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

function Site() {
  return (
    <div className="min-h-screen overflow-x-clip">
      <a href="#main" className="sr-only rounded-full bg-primary px-4 py-2 font-semibold text-on-primary focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <Stats />
        <Why />
        <Roles />
        <Rules />
        <Features />
        <Setup />
        <Agents />
        <About />
        <Closing />
      </main>
      <Footer />
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider config={config}>
      <Site />
      <ThemeSwitcher />
    </ThemeProvider>
  </StrictMode>,
)
