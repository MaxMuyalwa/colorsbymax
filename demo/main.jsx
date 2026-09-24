import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, ThemeSwitcher } from '../src/index.js'
import './demo.css'

// A small fictional site that uses every token group, for developing and testing colorsbymax.
const config = {
  siteName: 'Brightline',
  storageKey: 'colorsbymax-demo',
  defaultTheme: {
    name: 'Brightline Blue',
    tokens: {
      primary: '#2f6fdb',
      'primary-dark': '#1e3a8a',
      'primary-alt': '#7c5cff',
      secondary: '#e3ecfb',
      'on-secondary': '#1e3a8a',
      background: '#f8fafd',
    },
  },
}

const services = [
  { title: 'Brand identity', text: 'Logos, type and colour systems that hold together everywhere.', chip: 'bg-data-1/15', dot: 'bg-data-1' },
  { title: 'Web design', text: 'Fast, accessible sites that are easy to keep up to date.', chip: 'bg-data-2/15', dot: 'bg-data-2' },
  { title: 'Illustration', text: 'Custom artwork for launches, campaigns and products.', chip: 'bg-data-3/15', dot: 'bg-data-3' },
  { title: 'Motion', text: 'Short animations that explain ideas in seconds.', chip: 'bg-data-4/15', dot: 'bg-data-4' },
  { title: 'Workshops', text: 'Hands-on sessions that get your team aligned.', chip: 'bg-data-5/15', dot: 'bg-data-5' },
  { title: 'Research', text: 'Interviews and testing that ground every decision.', chip: 'bg-data-6/15', dot: 'bg-data-6' },
]

function Demo() {
  return (
    <div className="min-h-screen">
      <div className="sticky top-4 z-50 px-6">
        <nav className="mx-auto flex max-w-5xl items-center justify-between rounded-full border border-border bg-surface/80 px-6 py-3 shadow-lg backdrop-blur">
          <span className="font-bold text-primary-dark">Brightline</span>
          <div className="hidden gap-6 text-sm text-ink-secondary md:flex">
            <a href="#services" className="hover:text-ink">Services</a>
            <a href="#about" className="hover:text-ink">About</a>
            <a href="#contact" className="hover:text-ink">Contact</a>
          </div>
          <button className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-on-primary shadow-md shadow-primary/20">Get started</button>
        </nav>
      </div>

      <header className="mx-auto max-w-4xl px-6 pt-24 pb-20 text-center">
        <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-on-secondary">Independent design studio</span>
        <h1 className="mt-6 text-5xl font-bold leading-tight md:text-6xl">
          Design that makes your brand{' '}
          <span className="bg-gradient-to-r from-primary to-primary-alt bg-clip-text text-transparent">impossible to ignore</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-secondary">
          We help small teams look like big ones, with clear identities, thoughtful websites and a lot of care.
        </p>
      </header>

      <section id="services" className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-10 text-center text-3xl font-bold">What we do</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div key={s.title} className="rounded-2xl border border-border bg-surface/60 p-8 shadow-sm">
              <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${s.chip}`}>
                <span className={`h-4 w-4 rounded-full ${s.dot}`} />
              </div>
              <h3 className="mb-2 text-xl font-bold">{s.title}</h3>
              <p className="text-ink-secondary">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="about" className="bg-primary px-6 py-20 text-center text-on-primary">
        <h2 className="text-3xl font-bold">Small studio, big standards</h2>
        <p className="mx-auto mt-4 max-w-2xl text-on-primary/80">Every project gets a senior designer from first sketch to final file.</p>
      </section>

      <section id="contact" className="mx-auto grid max-w-5xl gap-8 px-6 py-24 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-xl">
          <h2 className="mb-6 text-2xl font-bold">Say hello</h2>
          <label className="mb-2 block text-sm font-medium" htmlFor="demo-email">Email</label>
          <input id="demo-email" placeholder="you@example.com" className="mb-4 w-full rounded-xl border border-border bg-background px-3 py-2 placeholder:text-ink-muted" />
          <p className="mb-2 text-sm text-success">Thanks, we'll reply within a day.</p>
          <p className="mb-4 text-sm text-danger">Please enter a valid email.</p>
          <button className="w-full rounded-xl bg-primary py-2.5 font-semibold text-on-primary">Send</button>
        </div>
        <div className="rounded-2xl border border-app-border bg-app-background p-8" style={{ boxShadow: '8px 8px 16px var(--color-app-shadow-dark), -8px -8px 16px var(--color-app-shadow-light)' }}>
          <h2 className="mb-2 text-2xl font-bold text-app-ink">Client portal</h2>
          <p className="mb-6 text-sm text-app-ink-muted">A secondary area with its own palette, like a sign-in page.</p>
          <input placeholder="Password" type="password" className="mb-4 w-full rounded-lg border border-app-border bg-app-input px-3 py-2 text-app-ink placeholder:text-app-ink-muted" />
          <button className="w-full rounded-lg bg-app-primary py-2.5 font-medium text-on-primary">Sign in</button>
          <p className="mt-4 text-center text-sm text-app-ink-muted">
            New here? <a href="#contact" className="font-semibold text-app-primary">Request access</a>
          </p>
        </div>
      </section>

      <footer className="border-t border-border bg-secondary/40 px-6 py-10 text-center text-sm text-ink-muted">
        Brightline is a fictional studio used to demo colorsbymax™.
      </footer>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider config={config}>
      <Demo />
      <ThemeSwitcher />
    </ThemeProvider>
  </StrictMode>,
)
