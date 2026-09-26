import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeSwitcher } from '../src/index.js'
import { SiteThemeProvider } from './site/siteSettings.jsx'
import { config } from './site/config.js'
import { Nav } from './site/Nav.jsx'
import { AdminApp } from './site/AdminApp.jsx'
import { Footer } from './site/Footer.jsx'
import { Feedback } from './site/Feedback.jsx'
import { Announcement } from './site/Announcement.jsx'
import { ThemedFavicon } from './site/Favicon.jsx'
import './demo.css'

// The admin space: where Max runs the site. Same colorsbymax setup as the home page, so the
// theme follows here too.
const HOME = import.meta.env.BASE_URL

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SiteThemeProvider config={config}>
      <div className="min-h-screen overflow-x-clip">
        <Nav home={HOME} />
        <AdminApp home={HOME} />
        <Footer home={HOME} />
        <Feedback />
        <Announcement />
      </div>
      <ThemedFavicon />
      <ThemeSwitcher />
    </SiteThemeProvider>
  </StrictMode>,
)
