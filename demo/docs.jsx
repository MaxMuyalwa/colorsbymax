import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeSwitcher } from '../src/index.js'
import { SiteThemeProvider } from './site/siteSettings.jsx'
import { config } from './site/config.js'
import { Nav } from './site/Nav.jsx'
import { Docs } from './site/Docs.jsx'
import { Footer } from './site/Footer.jsx'
import { Feedback } from './site/Feedback.jsx'
import { Announcement } from './site/Announcement.jsx'
import { ThemedFavicon } from './site/Favicon.jsx'
import './demo.css'

// The docs page: the README, changelog and, soon, posts. Same colorsbymax setup as the home page,
// so the theme a visitor picked follows them here.
const HOME = import.meta.env.BASE_URL

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SiteThemeProvider config={config}>
      <div className="min-h-screen overflow-x-clip">
        <Nav home={HOME} />
        <Docs home={HOME} />
        <Footer home={HOME} />
        <Feedback />
        <Announcement />
      </div>
      <ThemedFavicon />
      <ThemeSwitcher />
    </SiteThemeProvider>
  </StrictMode>,
)
