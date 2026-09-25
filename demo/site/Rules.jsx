import { CircleCheck, Info, OctagonX, TriangleAlert } from 'lucide-react'
import { contrastRatio, darkTokens, isDarkTheme, useTheme } from '../../src/index.js'
import { Reveal, SectionHeading } from './ui.jsx'

const fmt = (r) => `${(Math.floor(r * 10) / 10).toFixed(1)}:1`

function Pass({ ratio, need }) {
  const ok = ratio >= need
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ok ? 'bg-success/12 text-success' : 'bg-danger/12 text-danger'}`}>
      {fmt(ratio)} {ok ? 'pass' : 'fail'}
    </span>
  )
}

function Rule({ n, title, children, visual, delay }) {
  return (
    <Reveal delay={delay} className="group flex flex-col rounded-3xl border border-border bg-surface p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-shadow/10">
      <div className="mb-5 min-h-28 rounded-2xl bg-background p-4">{visual}</div>
      <p className="font-mono text-xs text-ink-muted">Rule {n}</p>
      <h3 className="mt-1 font-display text-xl font-bold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{children}</p>
    </Reveal>
  )
}

const HISTORY = [
  ['1704', 'Isaac Newton’s Opticks bends the spectrum into a circle: the first colour wheel.'],
  ['1961', 'Johannes Itten’s The Art of Color names seven kinds of colour contrast designers still use.'],
  ['2008', 'WCAG 2.0 turns “readable” into a number: 4.5:1 for normal text.'],
  ['2018', 'Material Design names “on” colours, the text that sits on a colour. colorsbymax’s on-primary is the same idea.'],
  ['Today', 'colorsbymax packs these rules into every one of its 700+ themes.'],
]

export function Rules() {
  const { tokens: t } = useTheme()
  const white = contrastRatio('#ffffff', t.primary)
  const dark = contrastRatio('#111111', t.primary)
  // Light themes get their dark twin beside them; a dark theme on the page is already a twin.
  const modes = isDarkTheme(t) ? [['This page, in dark', t]] : [['Light', t], ['Dark twin', darkTokens(t)]]

  return (
    <section aria-labelledby="rules-title" id="rules" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading id="rules-title" eyebrow="A little colour theory" title="The rules behind good colour">
          colorsbymax follows these for you. Knowing them helps you pick, tweak and trust the result. The examples use the colours on
          this page right now.
        </SectionHeading>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Rule
            n={1}
            title="60 · 30 · 10"
            delay={0}
            visual={
              <div>
                <div className="flex h-12 overflow-hidden rounded-xl border border-border">
                  <span className="w-[60%] bg-background" />
                  <span className="w-[30%] bg-secondary" />
                  <span className="w-[10%] bg-primary" />
                </div>
                <div className="mt-2 flex justify-between font-mono text-[11px] text-ink-muted">
                  <span>60 background</span>
                  <span>30 tint</span>
                  <span>10 brand</span>
                </div>
              </div>
            }
          >
            Let one colour lead. Roughly 60% calm background and surfaces, 30% supporting tints and text, 10% brand. It’s why primary is saved
            for the things you want clicked.
          </Rule>

          <Rule
            n={2}
            title="Contrast is a number"
            delay={80}
            visual={
              <div className="space-y-2 text-sm">
                <p className="flex items-center justify-between gap-2 rounded-lg bg-background">
                  <span className="text-ink">Text on the page</span> <Pass ratio={contrastRatio(t.ink, t.background)} need={4.5} />
                </p>
                <p className="flex items-center justify-between gap-2">
                  <span className="text-ink-muted">Muted text</span> <Pass ratio={contrastRatio(t['ink-muted'], t.background)} need={4.5} />
                </p>
                <p className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-primary px-2 py-0.5 text-on-primary">Button</span> <Pass ratio={contrastRatio(t['on-primary'], t.primary)} need={4.5} />
                </p>
              </div>
            }
          >
            Text needs at least 4.5:1 against its background, and large text and icons 3:1 (WCAG AA). colorsbymax checks every pairing and fixes
            failures by nudging lightness only, so your hues stay yours.
          </Rule>

          <Rule
            n={3}
            title="Lightness beats hue"
            delay={160}
            visual={
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['#ffffff', white, 'White'],
                  ['#111111', dark, 'Dark'],
                ].map(([c, r, label]) => (
                  <div key={label} className="rounded-xl bg-primary p-3 text-center" style={{ outline: r >= Math.max(white, dark) ? '2px solid var(--color-ink)' : undefined, outlineOffset: 2 }}>
                    <span className="block font-display text-2xl font-bold" style={{ color: c }}>
                      Aa
                    </span>
                    <span className="mt-1 block text-[11px] font-semibold" style={{ color: c }}>
                      {label} · {fmt(r)}
                    </span>
                  </div>
                ))}
              </div>
            }
          >
            Readability comes from the difference in lightness, not the hue. A vivid yellow or cyan looks strong but is light, so dark text reads
            better on it than white. That’s why a button’s text colour can be dark in one theme and white in the next. The outlined sample is
            the better one on this page’s primary.
          </Rule>

          <Rule
            n={4}
            title="Colour carries meaning"
            delay={0}
            visual={
              <div className="flex flex-wrap gap-2">
                {[
                  ['success', CircleCheck, 'Saved'],
                  ['warning', TriangleAlert, 'Check this'],
                  ['danger', OctagonX, 'Failed'],
                  ['info', Info, 'Tip'],
                ].map(([k, Icon, label]) => (
                  <span key={k} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ color: `var(--color-${k})`, background: `color-mix(in srgb, var(--color-${k}) 12%, transparent)` }}>
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
                  </span>
                ))}
              </div>
            }
          >
            Green for done, amber for careful, red for stop, blue for information. These keep their meaning in every theme, and colour is never
            the only signal: an icon or a word goes with it, for colour-blind readers.
          </Rule>

          <Rule
            n={5}
            title="Tint your neutrals"
            delay={80}
            visual={
              <div className="grid grid-cols-2 gap-3 text-center text-[11px] text-ink-muted">
                <div>
                  <div className="flex gap-1">
                    {['#f4f4f5', '#e4e4e7', '#a1a1aa'].map((c) => (
                      <span key={c} className="h-10 flex-1 rounded-lg" style={{ background: c }} />
                    ))}
                  </div>
                  <p className="mt-1.5">Flat greys</p>
                </div>
                <div>
                  <div className="flex gap-1">
                    {['accent', 'secondary', 'border'].map((k) => (
                      <span key={k} className="h-10 flex-1 rounded-lg" style={{ background: `var(--color-${k})` }} />
                    ))}
                  </div>
                  <p className="mt-1.5">Brand-tinted</p>
                </div>
              </div>
            }
          >
            Greys borrowed from the brand’s hue feel designed; flat greys feel unfinished. Surfaces, borders and even shadows carry a hint of
            the brand, so the whole page feels like one family.
          </Rule>

          <Rule
            n={6}
            title="Dark mode isn’t inverted"
            delay={160}
            visual={
              <div className={`grid gap-2 ${modes.length > 1 ? 'grid-cols-2' : ''}`}>
                {modes.map(([label, x]) => (
                  <div key={label} className="rounded-xl p-3" style={{ background: x.background, boxShadow: '0 0 0 1px color-mix(in srgb, var(--color-ink) 10%, transparent)' }}>
                    <span className="block text-xs font-bold" style={{ color: x.ink }}>
                      {label}
                    </span>
                    <span className="mt-1 block h-1.5 w-3/4 rounded-full" style={{ background: x['ink-secondary'] }} />
                    <span className="mt-2 inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold" style={{ background: x.primary, color: x['on-primary'] }}>
                      Button
                    </span>
                  </div>
                ))}
              </div>
            }
          >
            Swapping black and white isn’t enough. Dark themes use deep tinted surfaces, soften pure white text, and lift brand colours so they
            still read. Every colorsbymax theme has a dark twin built this way: this is this page’s.
          </Rule>
        </div>

        <Reveal className="mt-16 rounded-[2rem] border border-border bg-surface p-6 md:p-10">
          <h3 className="font-display text-2xl font-bold text-ink">Where these rules come from</h3>
          <ol className="relative mt-8 grid gap-6 md:grid-cols-5 md:gap-4">
            <span className="absolute top-3 right-0 left-0 hidden h-0.5 rounded-full bg-gradient-to-r from-primary via-primary-alt to-data-3 md:block" aria-hidden="true" />
            {HISTORY.map(([year, text]) => (
              <li key={year} className="relative">
                <span className="relative grid h-6 w-6 place-items-center rounded-full border-4 border-surface bg-primary shadow-md shadow-primary/30" aria-hidden="true" />
                <p className="mt-3 font-display text-lg font-bold text-ink">{year}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{text}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  )
}
