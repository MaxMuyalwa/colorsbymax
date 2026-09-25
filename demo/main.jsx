import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, ThemeSwitcher } from '../src/index.js'
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
import { Feedback } from './site/Feedback.jsx'
import { config } from './site/config.js'
import { Community } from './site/Community.jsx'
import './demo.css'

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
        <Community />
        <Closing />
      </main>
      <Footer />
      <Feedback />
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
