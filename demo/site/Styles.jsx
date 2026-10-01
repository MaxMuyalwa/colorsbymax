// The landing page's spotlight on the three colour styles (Subtle, Balanced, Colourful), the strength
// slider and tints from the site's own pictures. Each style is shown as a small page painted the way
// that style paints, in the visitor's current theme.

import { Contrast, Image, Paintbrush, Palette, SlidersHorizontal } from 'lucide-react'
import { useTheme } from '../../src/index.js'
import { Reveal, SectionHeading, openColourStyle } from './ui.jsx'

const mixed = (token, amount, base = 'background') => `color-mix(in srgb, var(--color-${token}) ${amount}%, var(--color-${base}))`

const STYLES = [
  {
    id: 'subtle',
    Icon: Contrast,
    name: 'Subtle',
    text: 'Your site keeps its own backgrounds, cards and text. The theme comes in on buttons, links and highlights, with a quiet hint of it on badges.',
    // A site's own colours: plain neutrals, light or dark to match the mode (set below).
  },
  {
    id: 'balanced',
    Icon: Palette,
    name: 'Balanced',
    text: 'The theme in every role, with a soft wash of it across the page, cards and borders. Your own colours stay exactly as designed.',
    page: mixed('primary', 5),
    card: mixed('primary-alt', 3, 'surface'),
    heading: 'var(--color-ink)',
    band: 'var(--color-secondary)',
  },
  {
    id: 'colourful',
    Icon: Paintbrush,
    name: 'Colourful',
    text: 'An overhaul: tinted backgrounds, sections that take turns, headings and footers in the brand. Text still checked for contrast.',
    page: mixed('primary', 14),
    card: mixed('primary-alt', 9, 'surface'),
    heading: 'var(--color-primary-dark)',
    band: 'var(--color-primary)',
  },
]

/** A small page, painted the way a style paints. */
function MiniPage({ style: s }) {
  return (
    <div className="space-y-2.5 rounded-2xl border border-border p-3" style={{ background: s.page }} aria-hidden="true">
      <div className="flex items-center justify-between rounded-lg px-2 py-1.5" style={{ background: s.card }}>
        <span className="h-2 w-12 rounded-full" style={{ background: s.heading }} />
        <span className="h-4 w-12 rounded-full bg-primary" />
      </div>
      <div className="space-y-1.5 px-1 py-2">
        <span className="block h-3 w-3/4 rounded-full" style={{ background: s.heading }} />
        <span className="block h-2 w-1/2 rounded-full bg-ink-muted/50" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-1.5 rounded-lg border border-border/70 p-2" style={{ background: s.card }}>
            <span className="block h-4 w-4 rounded" style={{ background: s.id === 'subtle' ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'color-mix(in srgb, var(--color-primary) 28%, transparent)' }} />
            <span className="block h-1.5 w-3/4 rounded-full" style={{ background: s.heading }} />
          </div>
        ))}
      </div>
      <div className="h-5 rounded-lg" style={{ background: s.band }} />
    </div>
  )
}

// Neutral stand-ins for "your site's own colours" in Subtle.
const OWN = {
  light: { page: '#ffffff', card: '#ffffff', heading: '#111827', band: '#f3f4f6' },
  dark: { page: '#111113', card: '#1c1c1f', heading: '#f4f4f5', band: '#27272a' },
}

export function Styles() {
  const { mode } = useTheme()
  const styles = STYLES.map((s) => (s.id === 'subtle' ? { ...s, ...OWN[mode === 'dark' ? 'dark' : 'light'] } : s))
  return (
    <section aria-labelledby="styles-title" id="styles" className="relative overflow-hidden bg-surface/60 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading id="styles-title" eyebrow="New · Colour styles" title="As quiet or as bold as you like">
          Every theme comes three ways. Try a new colour on your buttons, see the theme as it’s meant to be, or let it take over the page for
          a whole new look. The pages below follow the theme you’re using right now.
        </SectionHeading>

        <div className="grid gap-5 md:grid-cols-3">
          {styles.map((s, i) => (
            <Reveal key={s.id} delay={i * 90} className="flex flex-col gap-4 rounded-3xl border border-border bg-background p-5">
              <MiniPage style={s} />
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
