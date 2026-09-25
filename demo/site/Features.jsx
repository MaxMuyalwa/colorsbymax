import { ClipboardPaste, Library, Paintbrush, Rocket, ScanLine, ScanSearch, ShieldCheck, SunMoon, WandSparkles } from 'lucide-react'
import { Reveal, SectionHeading } from './ui.jsx'

const FEATURES = [
  { Icon: Paintbrush, title: 'Your colours first', text: 'The panel opens on your site’s own theme, with an accessible version made for you if it needs one.', tone: 'data-1', motion: 'group-hover:-rotate-12' },
  { Icon: Library, title: '700+ library themes', text: 'Community-loved palettes in 14 moods, from pastel to moody, each turned into a full 35-role system.', tone: 'data-2', motion: 'group-hover:-translate-y-1' },
  { Icon: SunMoon, title: 'Light and dark', text: 'A dark twin of every theme, and a panel that follows. Or match each visitor’s device.', tone: 'data-3', motion: 'group-hover:rotate-180' },
  { Icon: ShieldCheck, title: 'Contrast built in', text: 'Every pairing checked against WCAG, with one-click fixes that change lightness, never your hues.', tone: 'data-4', motion: 'group-hover:scale-110' },
  { Icon: ScanLine, title: 'Scan your site', text: 'Reads the colours already on your pages and builds themes around them: soft, bold, complementary.', tone: 'data-5', motion: 'group-hover:translate-x-1' },
  { Icon: ClipboardPaste, title: 'Palettes from a picture', text: 'Paste a screenshot, drop a mood board or a brand-guide PDF, and get a palette built from it.', tone: 'data-6', motion: 'group-hover:-rotate-6' },
  { Icon: ScanSearch, title: 'Audit the page', text: 'Pins notes to anything that won’t look right in a theme: a logo that disappears, a picture with a white box.', tone: 'data-7', motion: 'group-hover:scale-110' },
  { Icon: WandSparkles, title: 'Works on any site', text: 'Hard-coded colours? colorsbymax reads what’s painted and re-colours it anyway. No rewrite needed.', tone: 'data-8', motion: 'group-hover:rotate-12' },
  { Icon: Rocket, title: 'Ship your pick', text: 'Done choosing? Keep your colours as the default and hide the switcher in production, in one step.', tone: 'primary', motion: 'group-hover:-translate-y-1 group-hover:translate-x-1' },
]

export function Features() {
  return (
    <section aria-labelledby="features-title" id="features" className="relative overflow-hidden px-6 py-24">
      <div className="blob top-1/4 -left-40 h-96 w-96 bg-primary-alt opacity-20" aria-hidden="true" />
      <div className="mx-auto max-w-6xl">
        <SectionHeading id="features-title" eyebrow="What’s inside" title="Everything in the colour panel">
          One small button. Behind it, a full colour studio that works on sites with or without Tailwind, and never touches your own CSS.
        </SectionHeading>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ Icon, title, text, tone, motion }, i) => (
            <Reveal
              key={title}
              delay={(i % 3) * 90}
              className="group relative overflow-hidden rounded-3xl border border-border bg-surface p-7 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-shadow/10"
            >
              <div
                className="absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-40"
                style={{ background: `var(--color-${tone})` }}
                aria-hidden="true"
              />
              <div className="relative mb-5 grid h-12 w-12 place-items-center rounded-2xl" style={{ background: `color-mix(in srgb, var(--color-${tone}) 14%, transparent)` }}>
                <Icon className={`h-6 w-6 transition-transform duration-500 ${motion}`} style={{ color: `var(--color-${tone})` }} aria-hidden="true" />
              </div>
              <h3 className="relative font-display text-xl font-bold text-ink">{title}</h3>
              <p className="relative mt-2 leading-relaxed text-ink-secondary">{text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
