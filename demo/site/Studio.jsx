// The landing page's spotlight on Studio: what it does, and Studio at work on this very page, live
// (a card picked out and given its own colours), in the visitor's current theme.

import { Files, Layers, MousePointerClick, ScanSearch, ShieldCheck, Sparkles } from 'lucide-react'
import { LivePreview, Scaled, useColourVersion } from './Hero.jsx'
import { Reveal, SectionHeading, openStudio } from './ui.jsx'

const POINTS = [
  { Icon: MousePointerClick, title: 'Point and click anything', text: 'A button, a card, a heading, the footer. Pick it on the page and give it its own background, text and border.' },
  { Icon: Layers, title: 'One, all of them, or every page', text: 'Change just that part, every part like it on the page, or every one like it on every page of your site.' },
  { Icon: ShieldCheck, title: 'Readable from the first click', text: 'Studio checks the text in what you pick straight away, marks colours that wouldn’t read, and Fix finds one that does.' },
  { Icon: Files, title: 'Only the pages you choose', text: 'Colour the landing page and leave the app inside as it is, or any set of pages. Studio finds them on your site.' },
  { Icon: ScanSearch, title: 'Check the page', text: 'Audit points out what won’t look right in your colours: a logo that disappears, a picture with a white box.' },
  { Icon: Sparkles, title: 'Keep it for good', text: 'Save it all as a prompt for Claude, Cursor or Copilot, or as CSS, and your site keeps exactly what you made.' },
]

/**
 * Studio at work, live: this page in a window, with Studio picking one of its cards and giving it
 * the theme's colour (preview.js), in the visitor's current theme.
 */
function Picture() {
  const version = useColourVersion()
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-shadow/20">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
      </div>
      <div className="relative aspect-[16/10] bg-background">
        <Scaled width={1280} height={800}>
          <LivePreview kind="studio" version={version} lazy />
        </Scaled>
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
        <Reveal delay={100}>
          <Picture />
          <p className="mt-3 text-center text-sm text-ink-muted">This page, live: Studio picking a card and giving it the theme’s colour.</p>
        </Reveal>
      </div>
    </section>
  )
}
