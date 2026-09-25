import { ArrowDown, Palette, Sparkles } from 'lucide-react'
import { CopyButton, panelToggle } from './ui.jsx'
import { Specimen } from './Specimen.jsx'

export function Hero() {
  return (
    <header id="top" className="relative isolate overflow-hidden px-6 pt-32 pb-24 md:pt-40">
      {/* Backdrop: drifting colour blobs over a faint dot grid, fading out towards the next section. */}
      <div className="hero-backdrop absolute inset-0 -z-10" aria-hidden="true">
        <div className="dot-grid absolute inset-0" />
        <div className="blob top-[-10%] left-[-8%] h-[28rem] w-[28rem] bg-primary" />
        <div className="blob blob-slow top-[5%] right-[-10%] h-[26rem] w-[26rem] bg-primary-alt" />
        <div className="blob bottom-[-20%] left-[30%] h-[22rem] w-[22rem] bg-data-3 opacity-30" />
      </div>

      <div className="mx-auto max-w-4xl text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1 text-sm font-medium text-ink-secondary shadow-sm backdrop-blur">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          A live theme switcher · 700+ palettes · contrast checked
        </p>
        <h1 className="mt-7 font-display text-5xl leading-[1.04] font-extrabold tracking-tight text-ink md:text-7xl">
          Colour your whole site <span className="text-gradient">like a designer would.</span>
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-ink-secondary md:text-xl">
          colorsbymax adds a colour button to your website. Open it and try hundreds of professionally built palettes on your real pages, live.
          Every colour lands in the right role, from buttons to borders, and every pairing is checked so text stays readable.
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-base text-ink-muted">
          No typing hex codes, no colour pickers, no swatch files, no letting an AI guess. The colour research is already done.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            {...panelToggle}
            className="shine group inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-on-primary shadow-xl shadow-primary/30 transition hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-primary/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            <Palette className="h-5 w-5 transition-transform duration-500 group-hover:rotate-[20deg] group-hover:scale-110" aria-hidden="true" />
            Try it on this page
          </button>
          <a
            href="#setup"
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-surface px-6 py-3 font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
          >
            Add it to your site
            <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" aria-hidden="true" />
          </a>
        </div>
        <div className="mx-auto mt-5 flex w-fit items-center gap-3 rounded-full border border-border bg-surface/80 py-1 pr-1 pl-4 shadow-sm backdrop-blur">
          <code className="font-mono text-sm text-ink">npm install colorsbymax</code>
          <CopyButton text="npm install colorsbymax" className="rounded-full" />
        </div>
        <p className="mt-4 text-sm text-ink-muted">This whole page is the demo. Pick a theme and watch every colour change.</p>
      </div>

      <div className="relative mx-auto mt-16 max-w-4xl">
        <div className="brand-ring absolute -inset-3 -z-10 rounded-[2rem] opacity-40 blur-2xl" aria-hidden="true" />
        <Specimen />
      </div>
    </header>
  )
}
