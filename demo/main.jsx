import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Check, Copy, ImageUp, Library, Moon, Palette, ScanLine, ShieldCheck } from 'lucide-react'
import { ThemeProvider, ThemeSwitcher } from '../src/index.js'
import { loadPdf } from '../src/pdf.js'
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
    tokens: {
      primary: '#5b3df5',
      'primary-dark': '#1e1b4b',
      'primary-alt': '#e0457b',
      secondary: '#ece9fe',
      'on-secondary': '#3b2a8f',
      background: '#fbfaff',
    },
  },
}

const REPO = 'https://github.com/MaxMuyalwa/colorsbymax'
const INSTALL = 'npm install colorsbymax'

const features = [
  { Icon: Palette, title: 'Your site’s colours first', text: 'Visitors start from your own theme, with an accessible version made for you if it needs one.', tone: 'data-1' },
  { Icon: ScanLine, title: 'Scan any page', text: 'Reads the colours actually on screen and builds themes around them: soft, bold, complementary.', tone: 'data-2' },
  { Icon: Library, title: '715 library themes', text: 'Community favourite palettes in 14 categories, every one adjusted to pass contrast.', tone: 'data-3' },
  { Icon: Moon, title: 'Light and dark', text: 'A dark twin of every theme, and a panel that follows. Or match the visitor’s device.', tone: 'data-4' },
  { Icon: ImageUp, title: 'Palettes from files', text: 'Drop in a mood board, photo or brand guide PDF and get a palette built from it.', tone: 'data-5' },
  { Icon: ShieldCheck, title: 'Contrast built in', text: 'Every pairing is checked against WCAG, with one-click fixes that only touch lightness.', tone: 'data-6' },
]

// Tokens shown in the live strip; they read straight from the applied theme.
const LIVE_TOKENS = ['primary', 'primary-alt', 'primary-dark', 'secondary', 'accent', 'background', 'surface', 'ink', 'ink-secondary', 'success', 'warning', 'danger', 'data-1', 'data-2', 'data-3', 'data-4']

const steps = [
  { title: 'Name your colours', text: 'Paint your site with colour tokens like bg-primary or var(--color-ink) instead of fixed colours.' },
  { title: 'Wrap your app', text: 'Add ThemeProvider with your site’s name and colours, and drop in ThemeSwitcher.' },
  { title: 'Let visitors play', text: 'They pick, scan, build and save themes. Your pages re-colour instantly, no rebuild.' },
]

/** Opens the switcher from a button on the page (the switcher lives in its own shadow root). */
function openPanel() {
  const button = document.querySelector('colorsbymax-root')?.shadowRoot?.querySelector('button')
  if (button?.getAttribute('aria-expanded') !== 'true') button?.click()
}

function Demo() {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="sticky top-4 z-50 px-6">
        <nav className="mx-auto flex max-w-5xl items-center justify-between rounded-full border border-border bg-surface/80 px-6 py-3 shadow-lg shadow-shadow/5 backdrop-blur">
          <a href="#top" className="font-bold text-primary-dark" data-colorsbymax-logo>
            colorsbymax<span className="align-super text-[10px] font-medium">™</span>
          </a>
          <div className="hidden gap-6 text-sm text-ink-secondary md:flex">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#install" className="hover:text-ink">Install</a>
            <a href={REPO} className="hover:text-ink">GitHub</a>
          </div>
          <a href="#install" className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-on-primary shadow-md shadow-primary/20">
            Get started
          </a>
        </nav>
      </div>

      <header id="top" className="mx-auto max-w-4xl px-6 pt-24 pb-16 text-center">
        <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-on-secondary">A live theme switcher for any website</span>
        <h1 className="mt-6 text-5xl font-bold leading-tight text-ink md:text-6xl">
          Let every visitor{' '}
          <span className="bg-gradient-to-r from-primary to-primary-alt bg-clip-text text-transparent">colour your site their way</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-secondary">
          colorsbymax adds a small colour button to your site. Visitors pick from your themes, hundreds of palettes, or their own, and
          every page re-colours instantly, always readable.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={openPanel}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary shadow-lg shadow-primary/25 hover:bg-primary-dark"
          >
            <Palette className="h-4 w-4" aria-hidden="true" /> Open the colour panel
          </button>
          <a href="#install" className="rounded-full border border-border bg-surface px-5 py-2.5 font-semibold text-ink hover:bg-accent hover:text-on-accent">
            Add it to your site
          </a>
        </div>
        <p className="mt-4 text-sm text-ink-muted">This page is the demo. Try a theme and watch everything change.</p>
      </header>

      <section aria-labelledby="live-title" className="mx-auto max-w-5xl px-6 pb-20">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="live-title" className="text-lg font-bold text-ink">Every colour is a token</h2>
            <p className="text-sm text-ink-secondary">These are this page’s colours right now.</p>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {LIVE_TOKENS.map((key) => (
              <li key={key} className="min-w-0">
                <span className="block h-10 rounded-lg border border-border" style={{ background: `var(--color-${key})` }} />
                <span className="mt-1 block truncate font-mono text-xs text-ink-secondary">{key}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-3 text-center text-3xl font-bold text-ink">Everything a colour picker should be</h2>
        <p className="mx-auto mb-10 max-w-2xl text-center text-ink-secondary">One component, no stylesheet to add, and it works on sites with or without Tailwind.</p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ Icon, title, text, tone }) => (
            <div key={title} className="rounded-2xl border border-border bg-surface/60 p-8 shadow-sm">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, var(--color-${tone}) 15%, transparent)` }}>
                <Icon className="h-6 w-6" style={{ color: `var(--color-${tone})` }} aria-hidden="true" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-ink">{title}</h3>
              <p className="text-ink-secondary">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-primary px-6 py-16 text-on-primary">
        <dl className="mx-auto grid max-w-4xl gap-8 text-center sm:grid-cols-3">
          {[
            ['715', 'library themes'],
            ['35', 'colour tokens'],
            ['4.5:1', 'text contrast, checked'],
          ].map(([value, label]) => (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd className="text-4xl font-bold">{value}</dd>
              <dd className="mt-1 text-on-primary/80">{label}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="how" className="mx-auto grid max-w-5xl gap-10 px-6 py-24 md:grid-cols-2">
        <div>
          <h2 className="mb-8 text-3xl font-bold text-ink">How it works</h2>
          <ol className="space-y-6">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary font-bold text-on-primary">{i + 1}</span>
                <div>
                  <h3 className="font-bold text-ink">{s.title}</h3>
                  <p className="text-ink-secondary">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="space-y-6">
          <pre className="overflow-x-auto rounded-2xl border border-border bg-surface p-5 text-sm leading-relaxed text-ink shadow-sm">
            <code>{`import {
  ThemeProvider,
  ThemeSwitcher,
} from 'colorsbymax'

<ThemeProvider config={{
  siteName: 'Your site',
  defaultTheme: {
    name: 'Your colours',
    tokens: { primary: '#5b3df5' },
  },
}}>
  <App />
  <ThemeSwitcher />
</ThemeProvider>`}</code>
          </pre>
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h3 className="mb-3 font-bold text-ink">Contrast check <span className="text-sm font-normal text-ink-muted">(example)</span></h3>
            <p className="flex items-center gap-2 text-sm text-success">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" /> Body text on the background: 12.6:1, passes.
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-danger">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" /> Light grey on white: 2.1:1, fix suggested.
            </p>
            <p className="mt-2 text-sm text-warning">Fixes change lightness only, so your hues stay yours.</p>
          </div>
        </div>
      </section>

      <section id="install" className="px-6 pb-24">
        <div
          className="mx-auto max-w-2xl rounded-3xl border border-app-border bg-app-background p-8 text-center"
          style={{ boxShadow: '8px 8px 16px var(--color-app-shadow-dark), -8px -8px 16px var(--color-app-shadow-light)' }}
        >
          <h2 className="mb-2 text-3xl font-bold text-app-ink">Add it to your site</h2>
          <p className="mb-6 text-app-ink-muted">Works with React. Your site keeps its look until a visitor picks a new one.</p>
          <div className="flex items-center gap-2 rounded-xl border border-app-border bg-app-input p-2 pl-4 text-left">
            <code className="min-w-0 flex-1 truncate font-mono text-sm text-app-ink">{INSTALL}</code>
            <button
              type="button"
              onClick={copy}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-app-primary px-3 py-2 text-sm font-medium text-on-primary"
            >
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-4 text-sm text-app-ink-muted">
            Setup guide on{' '}
            <a href={REPO} className="font-semibold text-app-primary underline underline-offset-2">
              GitHub
            </a>
            .
          </p>
        </div>
      </section>

      <footer className="border-t border-border bg-secondary/40 px-6 py-10 text-center text-sm text-ink-muted">
        colorsbymax™ by mrmaxdesigns · MIT licensed · Every colour on this page comes from the theme you pick.
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
