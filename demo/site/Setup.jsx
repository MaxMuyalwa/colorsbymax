import { ArrowRight, Code, Globe, Layers, MousePointerClick, Package, Rocket, Zap } from 'lucide-react'
import { CodeBlock, Reveal, REPO, SectionHeading, Tabs } from './ui.jsx'

const FLOW = [
  { Icon: Package, title: 'Install', text: 'One package, no stylesheet to add.' },
  { Icon: MousePointerClick, title: 'Pick', text: 'Open the colour button and try themes on your real pages.' },
  { Icon: Rocket, title: 'Ship', text: 'Keep the colours you love as your site’s default.' },
]

function Step({ n, title, children }) {
  return (
    <li className="flex gap-4">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary font-display text-sm font-bold text-on-secondary">{n}</span>
      <div className="min-w-0 flex-1 space-y-3">
        <h4 className="pt-1 font-semibold text-ink">{title}</h4>
        {children}
      </div>
    </li>
  )
}

const Note = ({ children }) => <p className="text-sm leading-relaxed text-ink-secondary">{children}</p>

const TABS = [
  {
    label: 'One line',
    icon: Zap,
    content: (
      <ol className="space-y-6">
        <Step n={1} title="Install it">
          <CodeBlock title="terminal" code="npm install colorsbymax" />
        </Step>
        <Step n={2} title="Add one line to your app’s entry file">
          <CodeBlock title="main.jsx" code={`import 'colorsbymax/auto'`} />
          <Note>
            That’s all. The colour button appears once the page loads. If your site uses hard-coded colours, colorsbymax reads what’s on the page
            and swaps each colour for its role in the chosen theme: greys follow the theme’s background and text, brand shades follow its brand,
            and success and error colours keep their meaning.
          </Note>
        </Step>
      </ol>
    ),
  },
  {
    label: 'Full control',
    icon: Layers,
    content: (
      <ol className="space-y-6">
        <Step n={1} title="Paint your site with colour tokens">
          <Note>Use the token variables wherever you set a colour. With Tailwind CSS v4, import the defaults and use utilities like bg-primary and text-ink:</Note>
          <CodeBlock
            title="app.css"
            code={`@import "tailwindcss";
@import "colorsbymax/tokens.css";

@theme static {
  --color-primary: #5b3df5; /* your colours */
}`}
          />
          <Note>With plain CSS, define the variables yourself and use var(--color-primary) and friends.</Note>
        </Step>
        <Step n={2} title="Wrap your app and add the switcher">
          <CodeBlock
            title="App.jsx"
            code={`import { ThemeProvider, ThemeSwitcher } from 'colorsbymax'

<ThemeProvider config={{
  siteName: 'Your site',
  defaultTheme: { name: 'Your colours', tokens: { primary: '#5b3df5' } },
}}>
  <App />
  <ThemeSwitcher />
</ThemeProvider>`}
          />
          <Note>Themes then set your variables directly: no page reading, and nothing flashes on reload with the optional pre-paint script.</Note>
        </Step>
      </ol>
    ),
  },
  {
    label: 'Next.js',
    icon: Code,
    content: (
      <ol className="space-y-6">
        <Step n={1} title="Install it">
          <CodeBlock title="terminal" code="npm install colorsbymax" />
        </Step>
        <Step n={2} title="Load it in the browser from a small client component">
          <CodeBlock
            title="app/colorsbymax.tsx"
            code={`'use client'

import { useEffect } from 'react'

export default function ColorsByMax() {
  useEffect(() => {
    import('colorsbymax/auto')
  }, [])
  return null
}`}
          />
          <Note>Then render {'<ColorsByMax />'} inside {'<body>'} in app/layout.tsx. The same pattern works in Remix and other server-rendered apps.</Note>
        </Step>
      </ol>
    ),
  },
  {
    label: 'No bundler',
    icon: Globe,
    content: (
      <ol className="space-y-6">
        <Step n={1} title="Add one script to your HTML">
          <CodeBlock
            title="index.html"
            code={`<script type="module">
  import 'https://esm.sh/colorsbymax/auto'
</script>`}
          />
          <Note>Plain HTML sites load colorsbymax and React from a CDN. Put it before {'</body>'} on each page that should have the button.</Note>
        </Step>
      </ol>
    ),
  },
  {
    label: 'Finish',
    icon: Rocket,
    content: (
      <ol className="space-y-6">
        <Step n={1} title="Press “I’m done” in the panel">
          <Note>It shows your colours and three ways to finish, each with code to copy and a prompt for your AI editor.</Note>
        </Step>
        <Step n={2} title="Keep your colours and hide the switcher in production">
          <CodeBlock
            title="main.jsx"
            code={`import { autoMount } from 'colorsbymax/auto'

autoMount({
  defaultTheme: { name: 'Ocean', tokens: { /* every colour, filled in by the panel */ } },
  hidden: import.meta.env.PROD,
})`}
          />
          <Note>Everyone gets your colours; the button still shows while you develop. Set hidden: false to bring it back.</Note>
        </Step>
      </ol>
    ),
  },
]

export function Setup() {
  return (
    <section aria-labelledby="setup-title" id="setup" className="relative px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading id="setup-title" eyebrow="How it works" title="Set it up your way">
          Every colour is one of 35 tokens, exposed as CSS variables. Picking a theme sets those variables, so the whole page changes instantly,
          with no rebuild.
        </SectionHeading>

        <Reveal as="ol" className="mb-14 grid gap-4 md:grid-cols-3">
          {FLOW.map(({ Icon, title, text }, i) => (
            <li key={title} className="group relative flex items-center gap-4 rounded-3xl border border-border bg-surface p-5 transition hover:-translate-y-1 hover:border-primary">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-on-primary shadow-lg shadow-primary/25 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-display text-lg font-bold text-ink">
                  {i + 1}. {title}
                </p>
                <p className="text-sm text-ink-secondary">{text}</p>
              </div>
              {i < FLOW.length - 1 && <ArrowRight className="absolute top-1/2 -right-4 z-10 hidden h-5 w-5 -translate-y-1/2 text-ink-muted md:block" aria-hidden="true" />}
            </li>
          ))}
        </Reveal>

        <Reveal className="rounded-[2rem] border border-border bg-surface/70 p-5 shadow-sm backdrop-blur md:p-8">
          <Tabs label="Ways to set up colorsbymax" tabs={TABS} />
          <p className="mt-8 text-sm text-ink-muted">
            Every option, the full config and the TypeScript API are in the{' '}
            <a href={REPO} className="font-semibold text-primary underline decoration-2 underline-offset-2">
              README on GitHub
            </a>
            .
          </p>
        </Reveal>
      </div>
    </section>
  )
}
