import { Bot, Check, Hash, Pipette, SwatchBook } from 'lucide-react'
import { Reveal, SectionHeading } from './ui.jsx'

const DETOURS = [
  { Icon: Hash, title: 'Typing hex codes', text: 'Was it #5b3df5 or #5b3fd5? Tweak a code, save, reload, squint, repeat.' },
  { Icon: Pipette, title: 'Colour pickers', text: 'Great for choosing one colour. A site needs dozens that work together.' },
  { Icon: SwatchBook, title: 'Downloading swatches', text: 'Five pretty colours still leave you deciding which is the button, the border and the text.' },
  { Icon: Bot, title: 'Letting AI decide', text: 'Quick, but it can’t see your pages, and it rarely checks that text is readable.' },
]

const WINS = ['Every colour has a job, so it lands in the right place', 'Every text and icon pairing is checked for contrast', 'A dark version of every theme, built properly', 'Try it on your real pages, keep it with one line']

export function Why() {
  return (
    <section aria-labelledby="why-title" id="why" className="relative px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading id="why-title" eyebrow="Why colorsbymax" title="Stop guessing colours">
          Colouring a website usually means one of four detours. colorsbymax skips all of them.
        </SectionHeading>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DETOURS.map(({ Icon, title, text }, i) => (
            <Reveal key={title} delay={i * 80} className="group rounded-3xl border border-border bg-surface p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-shadow/10">
              <span className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-danger/10 text-danger transition-transform duration-300 group-hover:-rotate-6">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="font-display text-lg font-bold text-ink">
                <span className="decoration-danger/50 decoration-2 group-hover:line-through">{title}</span>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{text}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="relative mt-6 overflow-hidden rounded-[2rem] bg-primary p-8 text-on-primary md:p-12">
          <div className="blob -top-24 -right-16 h-72 w-72 bg-primary-alt opacity-60" aria-hidden="true" />
          <div className="blob blob-slow -bottom-28 left-1/3 h-64 w-64 bg-data-3 opacity-40" aria-hidden="true" />
          <div className="relative grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-center">
            <div>
              <p className="text-sm font-semibold tracking-wide uppercase opacity-80">The colorsbymax way</p>
              <h3 className="mt-2 font-display text-3xl font-bold md:text-4xl">The research is already done.</h3>
              <p className="mt-4 leading-relaxed opacity-90">
                Each of the 700+ themes is a complete colour system: 35 colours, each with a job, tuned so buttons stand out and text stays
                readable. Try them live on your own site, keep the one you love, and ship it.
              </p>
            </div>
            <ul className="space-y-3">
              {WINS.map((w) => (
                <li key={w} className="flex items-start gap-3 rounded-2xl bg-on-primary/10 px-4 py-3 backdrop-blur-sm">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-on-primary text-primary">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                  </span>
                  <span className="text-sm font-medium">{w}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

const STATS = [
  ['700+', 'library themes'],
  ['35', 'colour roles in each'],
  ['4.5:1', 'text contrast, checked'],
  ['1', 'line to install'],
]

export function Stats() {
  return (
    <section aria-label="colorsbymax in numbers" className="px-6 pt-10 md:pt-16">
      <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map(([value, label], i) => (
          <Reveal key={label} delay={i * 90} className="group rounded-3xl border border-border bg-surface p-6 text-center transition hover:-translate-y-1 hover:border-primary">
            <dt className="sr-only">{label}</dt>
            <dd className="text-gradient font-display text-4xl font-extrabold md:text-5xl">{value}</dd>
            <dd className="mt-1 text-sm text-ink-secondary">{label}</dd>
          </Reveal>
        ))}
      </dl>
    </section>
  )
}
