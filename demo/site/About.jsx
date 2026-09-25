import { ArrowUpRight, Heart } from 'lucide-react'
import { GitHubIcon, MRMAX, Reveal, REPO } from './ui.jsx'
import portrait from '../assets/max-muyalwa.webp'

/** Who makes colorsbymax, and why. */
export function About() {
  return (
    <section aria-labelledby="about-title" id="about" className="px-6 py-24">
      <Reveal className="mx-auto grid max-w-6xl gap-10 overflow-hidden rounded-[2.5rem] border border-border bg-surface p-8 shadow-sm md:grid-cols-[0.9fr_1.1fr] md:p-14">
        <div className="relative flex min-h-64 items-center justify-center">
          <div className="brand-ring absolute h-64 w-64 rounded-full opacity-70 blur-xl" aria-hidden="true" />
          {/* Cropped to a square around the face from the portfolio photo, so it
              fills the circle without stretching and nothing important is cut off. */}
          <img
            src={portrait}
            alt="Max Muyalwa, the designer behind mrmaxdesigns and colorsbymax"
            width="240"
            height="240"
            loading="lazy"
            className="relative h-60 w-60 rounded-full border-4 border-surface object-cover shadow-2xl shadow-shadow/25"
          />
        </div>

        <div>
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold tracking-wide text-on-secondary uppercase">
            <Heart className="h-3.5 w-3.5" aria-hidden="true" /> Made by mrmaxdesigns
          </p>
          <h2 id="about-title" className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
            Built by a designer who got tired of guessing colours.
          </h2>
          <div className="mt-5 space-y-4 leading-relaxed text-ink-secondary">
            <p>
              colorsbymax is designed and built by Max Muyalwa at{' '}
              <a href={MRMAX} className="font-semibold text-primary underline decoration-2 underline-offset-2">
                mrmaxdesigns.com
              </a>
              . It started as a theme switcher for a website he was designing, where choosing colours meant hours in pickers and swatch files,
              then a contrast check that sent everything back to the start.
            </p>
            <p>
              So the research went into the tool instead: hundreds of palettes, each given 35 roles and checked for contrast, ready to try on
              a real site in seconds. It’s free and open source for every developer and site owner who would rather ship than fiddle with hex
              codes.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={MRMAX}
              className="shine group inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary shadow-lg shadow-primary/25 transition hover:-translate-y-0.5"
            >
              Visit mrmaxdesigns.com
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
            </a>
            <a href={REPO} className="group inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2.5 font-semibold text-ink transition hover:-translate-y-0.5 hover:border-primary">
              <GitHubIcon className="h-4 w-4 transition-transform group-hover:rotate-12" /> Star on GitHub
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

/** The last call to action before the footer: back to mrmaxdesigns.com, or get started. */
export function Closing() {
  return (
    <section aria-labelledby="closing-title" className="px-6 pb-8">
      <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-primary px-8 py-16 text-center text-on-primary md:py-20">
        <div className="blob -top-20 -left-10 h-72 w-72 bg-primary-alt opacity-70" aria-hidden="true" />
        <div className="blob blob-slow -right-10 -bottom-24 h-80 w-80 bg-data-3 opacity-50" aria-hidden="true" />
        <div className="dot-grid absolute inset-0 opacity-30" aria-hidden="true" />
        <div className="relative">
          <h2 id="closing-title" className="mx-auto max-w-3xl font-display text-4xl font-extrabold tracking-tight md:text-6xl">
            Ready to see your site in colour?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg opacity-90">One install, one line, and a colour studio on every page. Or see what else mrmaxdesigns makes.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a href="#setup" className="shine inline-flex items-center gap-2 rounded-full bg-on-primary px-6 py-3 font-semibold text-primary shadow-xl transition hover:-translate-y-0.5">
              Get started
            </a>
            <a
              href={MRMAX}
              className="group inline-flex items-center gap-2 rounded-full border-2 border-on-primary/60 px-6 py-3 font-semibold text-on-primary transition hover:-translate-y-0.5 hover:border-on-primary hover:bg-on-primary/10"
            >
              Explore mrmaxdesigns.com
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
