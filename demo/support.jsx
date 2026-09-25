import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, ThemeSwitcher } from '../src/index.js'
import { config } from './site/config.js'
import { Nav } from './site/Nav.jsx'
import { Support } from './site/Community.jsx'
import { Footer } from './site/Footer.jsx'
import { Feedback } from './site/Feedback.jsx'
import './demo.css'

// The support page: ways to thank Max. Same colorsbymax setup as the home page, so the theme a
// visitor picked follows them here.
const HOME = import.meta.env.BASE_URL

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider config={config}>
      <div className="min-h-screen overflow-x-clip">
        <Nav home={HOME} />
        <Support />
        <Footer home={HOME} />
        <Feedback />
      </div>
      <ThemeSwitcher />
    </ThemeProvider>
  </StrictMode>,
)
