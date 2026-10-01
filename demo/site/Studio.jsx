// The landing page's spotlight on Studio: what it does, and a picture of it at work (a card on a page
// picked out and given its own colours), drawn in the visitor's current theme.

import { Files, Layers, MousePointerClick, ScanSearch, ShieldCheck, Sparkles } from 'lucide-react'
import { Reveal, SectionHeading, openStudio } from './ui.jsx'

const POINTS = [
  { Icon: MousePointerClick, title: 'Point and click anything', text: 'A button, a card, a heading, the footer. Pick it on the page and give it its own background, text and border.' },
  { Icon: Layers, title: 'One, all of them, or every page', text: 'Change just that part, every part like it on the page, or every one like it on every page of your site.' },
  { Icon: ShieldCheck, title: 'Readable from the first click', text: 'Studio checks the text in what you pick straight away, marks colours that wouldn’t read, and Fix finds one that does.' },
  { Icon: Files, title: 'Only the pages you choose', text: 'Colour the landing page and leave the app inside as it is, or any set of pages. Studio finds them on your site.' },
  { Icon: ScanSearch, title: 'Check the page', text: 'Audit points out what won’t look right in your colours: a logo that disappears, a picture with a white box.' },
  { Icon: Sparkles, title: 'Keep it for good', text: 'Save it all as a prompt for Claude, Cursor or Copilot, or as CSS, and your site keeps exactly what you made.' },
]

/** A small page with one card picked, and the card that colours it. */
function Picture() {
  const swatch = (token) => <span className="block h-5 w-5 rounded-md border border-border" style={{ background: `var(--color-${token})` }} />
  return (
    <div className="relative mx-auto w-full max-w-lg" aria-hidden="true">
      {/* The page. */}
      <div className="rounded-3xl border border-border bg-background p-4 shadow-xl shadow-shadow/10">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          <span className="ml-3 h-2 w-28 rounded-full bg-border" />
        </div>
        <div className="mb-4 space-y-2 rounded-2xl bg-surface p-4">
          <span className="block h-3 w-2/3 rounded-full bg-ink/80" />
          <span className="block h-2 w-1/2 rounded-full bg-ink-muted/60" />
          <span className="mt-3 inline-block h-6 w-24 rounded-full bg-primary" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`relative space-y-2 rounded-xl p-3 ${i === 1 ? 'border border-transparent' : 'border border-border bg-surface'}`}
              style={i === 1 ? { background: 'color-mix(in srgb, var(--color-primary) 16%, var(--color-surface))', outline: '2px solid #6366f1', outlineOffset: 3 } : undefined}
            >
              {i === 1 && <span className="absolute -top-6 left-0 rounded bg-[#6366f1] px-1.5 py-0.5 text-[10px] font-semibold text-white">Card</span>}
              <span className="block h-6 w-6 rounded-lg" style={{ background: `color-mix(in srgb, var(--color-data-${i + 1}) 30%, transparent)` }} />
              <span className="block h-2 w-3/4 rounded-full" style={{ background: i === 1 ? 'var(--color-primary-dark)' : 'color-mix(in srgb, var(--color-ink) 70%, transparent)' }} />
              <span className="block h-1.5 w-full rounded-full bg-ink-muted/40" />
            </div>
          ))}
        </div>
      </div>
      {/* The colour card beside it. */}
      <div className="absolute -right-2 -bottom-10 w-60 rounded-2xl border border-border bg-surface p-3 shadow-2xl shadow-shadow/20 sm:-right-8">
        <p className="text-sm font-semibold text-ink">
          Card <span className="font-normal text-ink-secondary">“Pricing”</span>
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-secondary/60 p-1 text-center text-[10px] font-semibold">
          <span className="rounded-md py-1 text-ink-secondary">This one</span>
          <span className="rounded-md bg-surface py-1 text-ink shadow-sm">All 3</span>
          <span className="rounded-md py-1 text-ink-secondary">Every page</span>
        </div>
        <p className="mt-2.5 text-[10px] font-semibold text-ink-secondary">Background · behind it</p>
        <div className="mt-1 flex gap-1">
          {['primary', 'primary-alt', 'secondary', 'accent', 'surface', 'ink'].map((t) => (
            <span key={t}>{swatch(t)}</span>
          ))}
        </div>
        <p className="mt-2.5 rounded-lg bg-success/10 px-2 py-1.5 text-[11px] text-ink">
          <strong className="font-semibold">Easy to read.</strong> All 3 pieces of text read well.
        </p>
      </div>
    </div>
  )
}

export function Studio() {
  return (
    <section aria-labelledby="studio-title" id="studio" className="relative overflow-hidden px-6 py-24">
      <div className="blob -top-20 right-0 h-96 w-96 bg-primary opacity-15" aria-hidden="true" />
      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <SectionHeading id="studio-title" eyebrow="New · Studio" title="Go deeper than a theme" align="left">
            A theme colours your whole site in one click. Studio is for the rest: open it from the panel’s header and colour your site part by
            part, exactly the way you want it.
          </SectionHeading>
          <ul className="grid gap-5 sm:grid-cols-2">
            {POINTS.map(({ Icon, title, text }, i) => (
              <Reveal as="li" key={title} delay={(i % 2) * 80} className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-on-secondary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold text-ink">{title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-secondary">{text}</span>
                </span>
              </Reveal>
            ))}
          </ul>
          <Reveal delay={120} className="mt-10">
            <button
              type="button"
              onClick={openStudio}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-on-primary shadow-lg shadow-primary/30 transition hover:-translate-y-0.5"
            >
              <MousePointerClick className="h-5 w-5" aria-hidden="true" /> Open Studio on this page
            </button>
          </Reveal>
        </div>
        <Reveal delay={100} className="pb-12">
          <Picture />
        </Reveal>
      </div>
    </section>
  )
}
