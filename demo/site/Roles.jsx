import { useState } from 'react'
import { useTheme } from '../../src/index.js'
import { Reveal, SectionHeading } from './ui.jsx'
import { Specimen } from './Specimen.jsx'

// Why each role exists, in plain words. Grouped as in colorsbymax's token schema.
const GROUPS = [
  {
    name: 'Brand',
    intro: 'Your identity. Used sparingly, so it guides the eye to what matters.',
    roles: [
      ['primary', 'Primary', 'Your main brand colour, kept for what should be clicked: buttons, links and focus rings. Rarity is what makes it pop.'],
      ['primary-dark', 'Primary dark', 'A deeper shade of the brand for the logo and brand text, where the brighter primary would be too soft to read.'],
      ['primary-alt', 'Primary alt', 'The gradient partner. It sits beside primary in gradients and glows, adding depth without becoming a second brand.'],
      ['on-primary', 'On primary', 'The text and icons that sit on primary. Chosen for contrast, so a button’s label is always readable.'],
    ],
  },
  {
    name: 'Surfaces',
    intro: 'The paper the page is printed on. Calm, so the content can speak.',
    roles: [
      ['background', 'Background', 'Behind everything, and most of the screen. A near-white or near-black with a hint of the brand.'],
      ['surface', 'Surface', 'Cards, panels and inputs, lifted off the background so related content reads as one group.'],
      ['secondary', 'Tint', 'A soft wash of the brand for badges, highlighted areas and footers: colour without shouting.'],
      ['on-secondary', 'On tint', 'Text on the tint: a deep shade of the same hue, so it matches and still reads.'],
      ['accent', 'Hover tint', 'The quiet change under a hovered link or row that says “this is interactive”.'],
      ['on-accent', 'On hover tint', 'Text on the hover tint, readable at a glance.'],
      ['border', 'Border', 'Dividers and outlines. Subtle, because borders organise; they don’t carry meaning.'],
      ['shadow', 'Shadow', 'Shadows tinted with the brand look natural. Pure black ones look muddy on a coloured page.'],
    ],
  },
  {
    name: 'Text',
    intro: 'Three steps of emphasis, so readers know what to read first.',
    roles: [
      ['ink', 'Ink', 'Headings and body text: the strongest contrast on the page.'],
      ['ink-secondary', 'Secondary ink', 'Paragraphs and navigation: a step softer, so headings lead.'],
      ['ink-muted', 'Muted ink', 'Placeholders, captions and footnotes: the quietest text that’s still comfortable to read.'],
    ],
  },
  {
    name: 'Status',
    intro: 'Colours with a meaning that must survive every theme.',
    roles: [
      ['success', 'Success', 'Done, paid, saved. Green in every theme, so it never has to be learned twice.'],
      ['warning', 'Warning', 'Careful, due soon. Amber, a step before trouble.'],
      ['danger', 'Danger', 'Errors and destructive actions. Red means stop, whatever the brand.'],
      ['info', 'Info', 'Neutral news and tips, in a calm blue.'],
    ],
  },
  {
    name: 'Data',
    intro: 'Eight colours far enough apart to tell apart, even side by side in a chart.',
    roles: Array.from({ length: 8 }, (_, i) => [`data-${i + 1}`, `Data ${i + 1}`, i === 0 ? 'Charts, tags and categories. Each is distinct from its neighbours and readable as an icon.' : 'The next category colour, spaced from the others in hue and lightness.']),
  },
  {
    name: 'Second area',
    intro: 'A distinct zone, like a sign-in page or dashboard, with its own soft look.',
    roles: [
      ['app-background', 'Area background', 'A separate section of the site that should feel its own.'],
      ['app-input', 'Area input', 'Form fields inside that area.'],
      ['app-border', 'Area border', 'Card and field outlines there.'],
      ['app-primary', 'Area primary', 'Its buttons and links.'],
      ['app-shadow-dark', 'Area shadow', 'The lower, darker half of a soft raised look.'],
      ['app-shadow-light', 'Area highlight', 'The upper, lighter half of that look.'],
      ['app-ink', 'Area ink', 'Labels and input text.'],
      ['app-ink-muted', 'Area muted ink', 'Descriptions, placeholders and icons.'],
    ],
  },
]

export function Roles() {
  const { tokens } = useTheme()
  const [group, setGroup] = useState(0)
  const [hovered, setHovered] = useState(null)
  const g = GROUPS[group]
  const shown = hovered ?? g.roles[0][0]
  const detail = g.roles.find((r) => r[0] === shown) ?? g.roles[0]

  return (
    <section aria-labelledby="roles-title" id="roles" className="relative overflow-hidden px-6 py-24">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-secondary/50 to-transparent" aria-hidden="true" />
      <div className="mx-auto max-w-6xl">
        <SectionHeading id="roles-title" eyebrow="Colour roles, explained" title="Every colour has a job">
          A palette is more than five pretty colours. Every colorsbymax theme gives each of its 35 colours a role, so each one lands where
          it works. Hover a role to see where it’s used.
        </SectionHeading>

        <Reveal className="mb-8 flex flex-wrap justify-center gap-2" role="group" aria-label="Role groups">
          {GROUPS.map((x, i) => (
            <button
              key={x.name}
              type="button"
              aria-pressed={i === group}
              onClick={() => {
                setGroup(i)
                setHovered(null)
              }}
              className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                i === group ? 'bg-primary text-on-primary shadow-lg shadow-primary/25' : 'border border-border bg-surface text-ink-secondary hover:-translate-y-px hover:border-primary hover:text-ink'
              }`}
            >
              {x.name}
            </button>
          ))}
        </Reveal>

        <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:items-start">
          <Reveal className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
            <p className="mb-4 px-1 text-sm text-ink-secondary">{g.intro}</p>
            <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1" onMouseLeave={() => setHovered(null)}>
              {g.roles.map(([key, label]) => (
                <li key={key}>
                  <button
                    type="button"
                    onMouseEnter={() => setHovered(key)}
                    onFocus={() => setHovered(key)}
                    onClick={() => setHovered(key)}
                    aria-pressed={shown === key}
                    className={`group flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                      shown === key ? 'bg-accent text-on-accent' : 'hover:bg-accent/60'
                    }`}
                  >
                    <span
                      className="h-9 w-9 shrink-0 rounded-xl shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"
                      style={{ background: `var(--color-${key})`, boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-ink) 12%, transparent)' }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="block truncate font-mono text-xs opacity-70">
                        {key} · {tokens[key]}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div aria-live="polite" className="mt-4 rounded-2xl bg-background p-4">
              <p className="font-mono text-xs text-ink-muted">--color-{detail[0]}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink">{detail[2]}</p>
            </div>
          </Reveal>

          <Reveal delay={120} className="lg:sticky lg:top-28">
            <Specimen highlight={shown} />
            <p className="mt-3 text-center text-xs text-ink-muted">The dashed outline shows where the selected role paints.</p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
