// The landing page's spotlight on the three colour styles (Subtle, Balanced, Colourful), the strength
// slider and tints from the site's own pictures. Each style is shown live: this very page, in a
// small window, painted in that style and the visitor's current theme (preview.js), so the
// pictures change whenever the page or the theme does.

import { Image, Contrast, Paintbrush, Palette, SlidersHorizontal } from 'lucide-react'
import { useTheme } from '../../src/index.js'
import { LivePreview, Scaled, useColourVersion } from './Hero.jsx'
import { Reveal, SectionHeading, openColourStyle } from './ui.jsx'

const mixed = (token, amount) => `color-mix(in srgb, var(--color-${token}) ${amount}%, var(--color-background))`
const WINDOW = { width: 1024, height: 640 }

const STYLES = [
  {
    id: 'subtle',
    Icon: Contrast,
    name: 'Subtle',
    text: 'Your site keeps its own backgrounds, cards and text. The theme comes in on buttons, links and highlights, with a quiet hint of it on badges.',
  },
  {
    id: 'balanced',
    Icon: Palette,
    name: 'Balanced',
    text: 'The theme in every role, with a soft wash of it across the page, cards and borders. Your own colours stay exactly as designed.',
  },
  {
    id: 'colourful',
    Icon: Paintbrush,
    name: 'Colourful',
    text: 'An overhaul: tinted backgrounds, headings with a hint of the brand, and stronger tints everywhere. Text still checked for contrast.',
  },
]

/** This page, live, in one colour style. */
function LiveStyle({ kind, version }) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-background">
      <Scaled {...WINDOW}>
        <LivePreview kind={kind} version={version} lazy />
      </Scaled>
    </div>
  )
}

export function Styles() {
  const { active, defaultTheme } = useTheme()
  const version = useColourVersion()
  // On the site's own colours the three would look alike (all are the site as designed), so the
  // windows show Sunset instead (preview.js).
  const own = active.id === defaultTheme.id || active.id === `${defaultTheme.id}~dark`
  return (
    <section aria-labelledby="styles-title" id="styles" className="relative overflow-hidden bg-surface/60 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading id="styles-title" eyebrow="New · Colour styles" title="As quiet or as bold as you like">
          Every theme comes three ways. Try a new colour on your buttons, see the theme as it’s meant to be, or let it take over the page for
          a whole new look. These are this page, live, in the theme you’re using now{own ? ' (Sunset, while you’re on our own colours)' : ''}.
        </SectionHeading>

        <div className="grid gap-5 md:grid-cols-3">
          {STYLES.map((s, i) => (
            <Reveal key={s.id} delay={i * 90} className="flex flex-col gap-4 rounded-3xl border border-border bg-background p-5">
              <LiveStyle kind={s.id} version={version} />
              <div>
                <h3 className="flex items-center gap-2 font-display text-xl font-bold text-ink">
                  <s.Icon className="h-5 w-5 text-primary" aria-hidden="true" /> {s.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <Reveal className="rounded-3xl border border-border bg-background p-6">
            <h3 className="flex items-center gap-2 font-semibold text-ink">
              <SlidersHorizontal className="h-5 w-5 text-primary" aria-hidden="true" /> From a light wash to bold
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">Colourful has a strength slider: a gentle tint for a calm site, or the whole page in colour for a loud one.</p>
            <div className="mt-4" aria-hidden="true">
              <div className="h-3 rounded-full" style={{ background: `linear-gradient(90deg, ${mixed('primary', 6)}, var(--color-primary))` }} />
              <div className="mt-1.5 flex justify-between text-xs text-ink-muted">
                <span>Light wash</span>
                <span>Soft</span>
                <span>Lively</span>
                <span>Bold</span>
              </div>
            </div>
          </Reveal>
          <Reveal delay={90} className="rounded-3xl border border-border bg-background p-6">
            <h3 className="flex items-center gap-2 font-semibold text-ink">
              <Image className="h-5 w-5 text-primary" aria-hidden="true" /> Tints from your pictures
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              Colourful can take its washes from your logo and photos, so the colours feel made for your site, while buttons and links keep the
              theme’s.
            </p>
          </Reveal>
        </div>

        <Reveal className="mt-10 text-center">
          <button
            type="button"
            onClick={openColourStyle}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-on-primary shadow-lg shadow-primary/30 transition hover:-translate-y-0.5"
          >
            <Palette className="h-5 w-5" aria-hidden="true" /> Try the three styles on this page
          </button>
        </Reveal>
      </div>
    </section>
  )
}
